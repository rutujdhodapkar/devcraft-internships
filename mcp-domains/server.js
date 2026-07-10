import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_SECRET_FALLBACK = process.env.MCP_DOMAINS_ADMIN_SECRET || "devcraft_admin_mcp_2025";
const ROOT_ADMIN_EMAIL = "rutujdhodapkar@gmail.com";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || "";
const DATA_DIR = process.env.VERCEL ? join("/tmp", "mcp-domains-data") : join(__dirname, "data");
try { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); } catch {}

const PROPOSALS_FILE = join(DATA_DIR, "proposals.json");
const AUTH_USERS_FILE = join(DATA_DIR, "authorized-users.json");
const ACCESS_REQUESTS_FILE = join(DATA_DIR, "access-requests.json");

// ── Storage helpers ──

function readJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function loadProposals() { return readJSON(PROPOSALS_FILE) || []; }
function saveProposals(p) { writeJSON(PROPOSALS_FILE, p); }

function loadAuthUsers() { return readJSON(AUTH_USERS_FILE) || []; }
function saveAuthUsers(u) { writeJSON(AUTH_USERS_FILE, u); }

function loadAccessRequests() { return readJSON(ACCESS_REQUESTS_FILE) || []; }
function saveAccessRequests(r) { writeJSON(ACCESS_REQUESTS_FILE, r); }

let _db = null;
async function getDb() {
  if (_db) return _db;
  try {
    const { initCosmosDb } = await import("../server/cosmos.js");
    _db = await initCosmosDb();
  } catch { _db = null; }
  return _db;
}

function cleanId(email) {
  if (!email) return email;
  return email.replace(/\./g, ",");
}

// ── Auth helpers ──

async function verifyFirebaseToken(idToken) {
  if (!idToken || !FIREBASE_API_KEY) return null;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return null;
    return { uid: data.users[0].localId, email: data.users[0].email };
  } catch { return null; }
}

async function isFirebaseAdmin(email) {
  if (!email) return false;
  if (email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase()) return true;
  const db = await getDb();
  if (!db) return false;
  try {
    const snap = await db.collection("admins").doc(cleanId(email.toLowerCase())).get();
    return snap.exists;
  } catch { return false; }
}

async function verifyAdmin(adminToken, adminSecret) {
  if (adminToken && FIREBASE_API_KEY) {
    const user = await verifyFirebaseToken(adminToken);
    if (!user || !user.email) return false;
    return isFirebaseAdmin(user.email);
  }
  if (adminSecret && ADMIN_SECRET_FALLBACK) return adminSecret === ADMIN_SECRET_FALLBACK;
  if (!ADMIN_SECRET_FALLBACK && !FIREBASE_API_KEY) return true;
  return false;
}

function isAuthorized(email) {
  if (!email) return false;
  const users = loadAuthUsers();
  return users.some(u => u.email.toLowerCase() === email.toLowerCase());
}

function generateId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ── Collections ──

const COLLECTIONS = {
  careerPaths: { desc: "Internship domains/career paths", scoped: false },
  agencies: { desc: "Partner agencies", scoped: true },
  enrollments: { desc: "Student enrollments", scoped: true },
  users: { desc: "Registered users", scoped: false },
  admins: { desc: "Admin users", scoped: false },
  referrals: { desc: "Referral codes", scoped: false },
  referralUsers: { desc: "Referral-linked users", scoped: false },
  siteConfig: { desc: "Site configuration", scoped: false },
  config: { desc: "App config (templates, etc.)", scoped: false },
  badges: { desc: "Achievement badges", scoped: false },
  userBadges: { desc: "User badge awards", scoped: false },
  adminMessages: { desc: "Admin broadcast messages", scoped: false },
  siteNotices: { desc: "Site notices", scoped: false },
  bannedUsers: { desc: "Banned users", scoped: false },
  paymentHistory: { desc: "Payment transaction history", scoped: false },
  auditLog: { desc: "System audit log", scoped: false },
};

// ── DB operations ──

async function executeQuery(collection, filters, agencyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let q = db.collection(collection);
  if (agencyId && COLLECTIONS[collection]?.scoped) q = q.where("agencyId", "==", agencyId);
  if (filters) for (const f of filters) { if (f.field && f.op && f.value !== undefined) q = q.where(f.field, f.op, f.value); }
  const snap = await q.get();
  return snap.docs.map(d => d.data());
}

async function executeMutate(collection, action, data, id, agencyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const col = db.collection(collection);
  if (agencyId && COLLECTIONS[collection]?.scoped) {
    if (action === "update" || action === "delete") {
      const existing = await col.doc(id).get();
      if (!existing.exists) throw new Error("Document not found");
      if (existing.data().agencyId !== agencyId) throw new Error("Not authorized: document belongs to another agency");
    }
    if (action === "create" && collection === "enrollments") data.agencyId = agencyId;
  }
  switch (action) {
    case "create": {
      const docId = data.id || `${collection}_${Date.now()}`;
      await col.doc(docId).set({ ...data, id: docId, updatedAt: new Date().toISOString() });
      return `Created ${collection}/${docId}`;
    }
    case "update": {
      if (!id) throw new Error("Document ID required");
      await col.doc(id).update({ ...data, updatedAt: new Date().toISOString() });
      return `Updated ${collection}/${id}`;
    }
    case "delete": {
      if (!id) throw new Error("Document ID required");
      await col.doc(id).delete();
      return `Deleted ${collection}/${id}`;
    }
    default: throw new Error(`Unknown action: ${action}`);
  }
}

// ── Tool definitions ──

const toolDefinitions = [
  {
    name: "request_access",
    description: "Request access to use the system. Provide your email.",
    inputSchema: { type: "object", properties: {
      email: { type: "string" }, name: { type: "string" }, reason: { type: "string" }, agency_id: { type: "string" },
    }, required: ["email"] },
  },
  {
    name: "approve_user",
    description: "Approve a user's access request. Admin only.",
    inputSchema: { type: "object", properties: {
      email: { type: "string" }, name: { type: "string" }, agency_id: { type: "string" }, request_id: { type: "string" },
    }, required: ["email"] },
  },
  {
    name: "remove_user",
    description: "Revoke a user's access. Admin only.",
    inputSchema: { type: "object", properties: { email: { type: "string" } }, required: ["email"] },
  },
  {
    name: "pending_users",
    description: "List users waiting for approval. Admin only.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "active_users",
    description: "List users who have access. Admin only.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_domains",
    description: "List all internship domains (career paths). Anyone with access can use.",
    inputSchema: { type: "object", properties: { email: { type: "string", description: "Your authorized email" } }, required: ["email"] },
  },
  {
    name: "get_tasks",
    description: "List projects/tasks for a specific domain. Anyone with access can use.",
    inputSchema: { type: "object", properties: {
      email: { type: "string", description: "Your authorized email" },
      domain_id: { type: "string", description: "Domain ID (e.g. path_java)" },
    }, required: ["email", "domain_id"] },
  },
  {
    name: "add_domain",
    description: "Add a new internship domain. Creates it live immediately. Requires access.",
    inputSchema: { type: "object", properties: {
      email: { type: "string", description: "Your authorized email" },
      id: { type: "string", description: "Unique ID (e.g. path_ai_ml)" },
      title: { type: "string", description: "Domain name" },
      duration: { type: "string", description: "e.g. 8 Weeks" },
      paymentAmount: { type: "number", description: "Price in USD" },
      paymentAmountReferral: { type: "number", description: "Referral price" },
      description: { type: "string" },
      features: { type: "array", items: { type: "string" }, description: "List of features" },
      icon: { type: "string", description: "Emoji icon" },
    }, required: ["email", "id", "title"] },
  },
  {
    name: "add_task",
    description: "Add a project/task to an existing domain. Creates it live immediately. Requires access.",
    inputSchema: { type: "object", properties: {
      email: { type: "string", description: "Your authorized email" },
      domain_id: { type: "string", description: "Domain ID (e.g. path_java)" },
      title: { type: "string", description: "Project title" },
      description: { type: "string" },
      type: { type: "string", enum: ["project", "quiz"], default: "project" },
      links: { type: "array", items: { type: "string" }, description: "Resource links" },
    }, required: ["email", "domain_id", "title"] },
  },
  {
    name: "lookup",
    description: "Query any collection directly. Admin only.",
    inputSchema: { type: "object", properties: {
      collection: { type: "string", enum: Object.keys(COLLECTIONS) },
      filters: { type: "array", items: { type: "object", properties: { field: { type: "string" }, op: { type: "string", enum: ["==", ">", "<", ">=", "<=", "!="], default: "==" }, value: { type: "string" } } } },
    }, required: ["collection"] },
  },
  {
    name: "edit_data",
    description: "Create, update, or delete any data directly. Admin only.",
    inputSchema: { type: "object", properties: {
      collection: { type: "string", enum: Object.keys(COLLECTIONS) },
      action: { type: "string", enum: ["create", "update", "delete"] },
      document_id: { type: "string" }, data: { type: "object", additionalProperties: true },
    }, required: ["collection", "action"] },
  },
  {
    name: "collections",
    description: "List available collections. Admin only.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── Tool handler ──

async function handleToolCall(name, args) {
  const NAME_MAP = {
    authorize_user: "approve_user", revoke_user: "remove_user",
    list_pending_access: "pending_users", list_authorized_users: "active_users",
    propose_query: "get_domains", propose_mutate: "add_domain",
    approve_proposal: "approve_change", reject_proposal: "reject_change",
    list_proposals: "list_changes", admin_query: "lookup", admin_mutate: "edit_data",
    list_collections: "collections", read_data: "get_domains", write_data: "add_domain",
  };
  name = NAME_MAP[name] || name;

  switch (name) {
    case "request_access": {
      const { email, name: n, reason, agency_id } = args;
      if (!email) throw new Error("Email required");
      if (isAuthorized(email)) return "You already have access.";
      const reqs = loadAccessRequests();
      if (reqs.find(r => r.email.toLowerCase() === email.toLowerCase() && r.status === "pending")) return "Request already pending.";
      reqs.push({ id: generateId(), email: email.toLowerCase(), name: n||"", reason: reason||"", agency_id: agency_id||null, status: "pending", submittedAt: new Date().toISOString() });
      saveAccessRequests(reqs);
      return "Request submitted. Admin will review.";
    }
    case "approve_user": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const e = args.email.toLowerCase();
      if (args.request_id) { const r = loadAccessRequests(); const i = r.findIndex(x => x.id === args.request_id); if (i>-1) { r[i].status="approved"; r[i].approvedAt=new Date().toISOString(); saveAccessRequests(r); } }
      const u = loadAuthUsers();
      if (u.some(x => x.email.toLowerCase() === e)) return JSON.stringify({ok:true, message:"Already has access"});
      u.push({ email: e, name: args.name||"", agency_id: args.agency_id||null, authorizedAt: new Date().toISOString(), authorizedBy: "admin" });
      saveAuthUsers(u);
      return JSON.stringify({ok:true, message:`${e} now has access`});
    }
    case "remove_user": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      let u = loadAuthUsers(); const b = u.length;
      u = u.filter(x => x.email.toLowerCase() !== args.email.toLowerCase());
      if (u.length === b) return "Not found";
      saveAuthUsers(u); return "Removed";
    }
    case "pending_users": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      return JSON.stringify(loadAccessRequests().filter(r => r.status === "pending"));
    }
    case "active_users": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      return JSON.stringify(loadAuthUsers());
    }
    case "get_domains": {
      const email = args.email || args.requester_email;
      if (!email) throw new Error("Email required");
      if (!isAuthorized(email)) throw new Error("Not authorized. Use request_access first.");
      const docs = await executeQuery("careerPaths", [], null);
      return JSON.stringify(docs.map(d => ({ id: d.id, title: d.title, duration: d.duration, description: d.description, features: d.features, icon: d.icon, projects: (d.projects||[]).length })), null, 2);
    }
    case "get_tasks": {
      const email = args.email;
      if (!email) throw new Error("Email required");
      if (!isAuthorized(email)) throw new Error("Not authorized.");
      const docs = await executeQuery("careerPaths", [], null);
      const domain = docs.find(d => d.id === args.domain_id);
      if (!domain) throw new Error("Domain not found");
      return JSON.stringify(domain.projects || [], null, 2);
    }
    case "add_domain": {
      const email = args.email;
      if (!email) throw new Error("Email required");
      if (!isAuthorized(email)) throw new Error("Not authorized.");
      const userInfo = loadAuthUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
      if (userInfo?.agency_id) {
        return await executeMutate("careerPaths", "create", { id: args.id, title: args.title, duration: args.duration||"8 Weeks", paymentAmount: args.paymentAmount||249, paymentAmountReferral: args.paymentAmountReferral||220, description: args.description||"", features: args.features||[], icon: args.icon||"⭐", projects: [], agencyId: userInfo.agency_id }, null, null);
      }
      return await executeMutate("careerPaths", "create", { id: args.id, title: args.title, duration: args.duration||"8 Weeks", paymentAmount: args.paymentAmount||249, paymentAmountReferral: args.paymentAmountReferral||220, description: args.description||"", features: args.features||[], icon: args.icon||"⭐", projects: [] }, null, null);
    }
    case "add_task": {
      const email = args.email;
      if (!email) throw new Error("Email required");
      if (!isAuthorized(email)) throw new Error("Not authorized.");
      const docs = await executeQuery("careerPaths", [], null);
      const domain = docs.find(d => d.id === args.domain_id);
      if (!domain) throw new Error("Domain not found");
      const projects = domain.projects || [];
      projects.push({ title: args.title, description: args.description||"", type: args.type||"project", links: args.links||[] });
      return await executeMutate("careerPaths", "update", { projects }, args.domain_id, null);
    }
    case "lookup": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      return JSON.stringify(await executeQuery(args.collection, args.filters||[], null), null, 2);
    }
    case "edit_data": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      return await executeMutate(args.collection, args.action, args.data||{}, args.document_id, null);
    }
    case "collections": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      return Object.keys(COLLECTIONS).join(", ");
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP server setup ──

const server = new Server(
  { name: "mcp-domains", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleToolCall(name, args);
    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only start stdio transport when run directly (not when imported by Vercel function)
const isDirectRun = process.argv[1] && (process.argv[1].includes("server.js") || process.argv[1].includes("mcp-domains"));
if (isDirectRun) main();

export function getToolDefinitions() { return toolDefinitions; }
export { getDb, COLLECTIONS, handleToolCall };
