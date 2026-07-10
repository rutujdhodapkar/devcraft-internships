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
    description: "Request to use the system. Provide your email and reason.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Your email address" },
        name: { type: "string", description: "Your name" },
        reason: { type: "string", description: "Why you need access" },
        agency_id: { type: "string", description: "Agency ID if applicable" },
      },
      required: ["email"],
    },
  },
  {
    name: "approve_user",
    description: "Grant access to a user who requested it.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "User's email" },
        name: { type: "string", description: "User's name" },
        agency_id: { type: "string", description: "Agency ID if applicable" },
        request_id: { type: "string", description: "Request ID to approve (optional)" },
      },
      required: ["email"],
    },
  },
  {
    name: "remove_user",
    description: "Revoke a user's access.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "User's email" },
      },
      required: ["email"],
    },
  },
  {
    name: "pending_users",
    description: "List users waiting for access approval.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "active_users",
    description: "List users who already have access.",
    inputSchema: { type: "object", properties: {} },
  },

  {
    name: "read_data",
    description: "Request to view data from a collection.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Your email" },
        collection: { type: "string", enum: Object.keys(COLLECTIONS), description: "Collection name" },
        filters: { type: "array", items: { type: "object", properties: { field: { type: "string" }, op: { type: "string", enum: ["==", ">", "<", ">=", "<=", "!="], default: "==" }, value: { type: "string" } } } },
        reason: { type: "string", description: "Why you need this" },
      },
      required: ["email", "collection"],
    },
  },
  {
    name: "write_data",
    description: "Request to create, update, or delete data.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Your email" },
        collection: { type: "string", enum: Object.keys(COLLECTIONS) },
        action: { type: "string", enum: ["create", "update", "delete"] },
        document_id: { type: "string" },
        data: { type: "object", additionalProperties: true },
        reason: { type: "string" },
      },
      required: ["email", "collection", "action"],
    },
  },

  {
    name: "approve_change",
    description: "Approve a pending change request to make it live.",
    inputSchema: {
      type: "object",
      properties: {
        change_id: { type: "string", description: "ID of the change to approve" },
      },
      required: ["change_id"],
    },
  },
  {
    name: "reject_change",
    description: "Reject a pending change request.",
    inputSchema: {
      type: "object",
      properties: {
        change_id: { type: "string", description: "ID of the change to reject" },
        reason: { type: "string" },
      },
      required: ["change_id"],
    },
  },
  {
    name: "list_changes",
    description: "List change requests by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "approved", "rejected", "all"], default: "pending" },
        email: { type: "string" },
      },
    },
  },

  {
    name: "lookup",
    description: "Directly view data from any collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: Object.keys(COLLECTIONS) },
        filters: { type: "array", items: { type: "object", properties: { field: { type: "string" }, op: { type: "string", enum: ["==", ">", "<", ">=", "<=", "!="], default: "==" }, value: { type: "string" } } } },
      },
      required: ["collection"],
    },
  },
  {
    name: "edit_data",
    description: "Directly create, update, or delete data.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: Object.keys(COLLECTIONS) },
        action: { type: "string", enum: ["create", "update", "delete"] },
        document_id: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      required: ["collection", "action"],
    },
  },

  {
    name: "collections",
    description: "List available collections.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── Tool handler ──

async function handleToolCall(name, args) {
  // Map old names to new for backwards compat
  const NAME_MAP = {
    authorize_user: "approve_user", revoke_user: "remove_user",
    list_pending_access: "pending_users", list_authorized_users: "active_users",
    propose_query: "read_data", propose_mutate: "write_data",
    approve_proposal: "approve_change", reject_proposal: "reject_change",
    list_proposals: "list_changes", admin_query: "lookup", admin_mutate: "edit_data",
    list_collections: "collections",
  };
  name = NAME_MAP[name] || name;

  switch (name) {
    case "request_access": {
      const { email, name: userName, reason, agency_id } = args;
      if (!email) throw new Error("Email is required");
      if (isAuthorized(email)) return `You already have access. Use read_data or write_data.`;
      const requests = loadAccessRequests();
      const existing = requests.find(r => r.email.toLowerCase() === email.toLowerCase() && r.status === "pending");
      if (existing) return `Request already pending (ID: ${existing.id}). Wait for approval.`;
      const req = { id: generateId(), email: email.toLowerCase(), name: userName || "", reason: reason || "", agency_id: agency_id || null, status: "pending", submittedAt: new Date().toISOString() };
      requests.push(req); saveAccessRequests(requests);
      return `Request submitted. ID: ${req.id} - Waiting for approval.`;
    }

    case "approve_user": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const email = args.email.toLowerCase();
      const name = args.name || "";
      const agency_id = args.agency_id || null;
      if (args.request_id) { const requests = loadAccessRequests(); const idx = requests.findIndex(r => r.id === args.request_id); if (idx !== -1) { requests[idx].status = "approved"; requests[idx].approvedAt = new Date().toISOString(); saveAccessRequests(requests); } }
      const users = loadAuthUsers();
      if (users.some(u => u.email.toLowerCase() === email)) return JSON.stringify({ ok: true, message: `${email} already has access.` });
      users.push({ email: email.toLowerCase(), name, agency_id, authorizedAt: new Date().toISOString(), authorizedBy: "admin" });
      saveAuthUsers(users);
      return JSON.stringify({ ok: true, message: `${email} now has access.` });
    }

    case "remove_user": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const email = args.email.toLowerCase();
      let users = loadAuthUsers();
      const before = users.length;
      users = users.filter(u => u.email.toLowerCase() !== email);
      if (users.length === before) return `${email} had no access.`;
      saveAuthUsers(users);
      return `Access removed for ${email}.`;
    }

    case "pending_users": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      return JSON.stringify(loadAccessRequests().filter(r => r.status === "pending"));
    }

    case "active_users": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      return JSON.stringify(loadAuthUsers());
    }

    case "read_data": {
      const { email: re, collection, filters, reason } = args;
      if (!re) throw new Error("email is required");
      if (!isAuthorized(re)) throw new Error("No access. Use request_access first.");
      const proposals = loadProposals();
      const proposal = { id: `prop_${generateId()}`, type: "query", requester_email: re, agency_id: null, collection, filters: filters || [], reason: reason || "", status: "pending", submittedAt: new Date().toISOString() };
      proposals.push(proposal); saveProposals(proposals);
      return `Read request submitted. ID: ${proposal.id} - Waiting for approval.`;
    }

    case "write_data": {
      const { email: we, collection, action, document_id, data, reason } = args;
      if (!we) throw new Error("email is required");
      if (!isAuthorized(we)) throw new Error("No access. Use request_access first.");
      if (collection === "admins" && !(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Only admin can modify admins");
      const proposals = loadProposals();
      const proposal = { id: `prop_${generateId()}`, type: "mutate", requester_email: we, agency_id: null, collection, action, document_id: document_id || null, data: data || {}, reason: reason || "", status: "pending", submittedAt: new Date().toISOString() };
      proposals.push(proposal); saveProposals(proposals);
      return `Change request submitted. ID: ${proposal.id} - Waiting for approval.`;
    }

    case "approve_change": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const proposals = loadProposals();
      const idx = proposals.findIndex(p => p.id === args.change_id);
      if (idx === -1) throw new Error(`Change "${args.change_id}" not found`);
      if (proposals[idx].status !== "pending") throw new Error(`Already ${proposals[idx].status}`);
      const prop = proposals[idx];
      let result;
      if (prop.type === "query") { try { const docs = await executeQuery(prop.collection, prop.filters, prop.agency_id); result = `Found ${docs.length} documents.`; } catch (err) { result = `Error: ${err.message}`; } }
      else { try { result = await executeMutate(prop.collection, prop.action, prop.data, prop.document_id, prop.agency_id); } catch (err) { result = `Error: ${err.message}`; } }
      prop.status = "approved"; prop.approvedAt = new Date().toISOString(); prop.approvedBy = "admin"; prop.executionResult = result;
      proposals[idx] = prop; saveProposals(proposals);
      return `Approved. ${result}`;
    }

    case "reject_change": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const proposals = loadProposals();
      const idx = proposals.findIndex(p => p.id === args.change_id);
      if (idx === -1) throw new Error(`Change "${args.change_id}" not found`);
      if (proposals[idx].status !== "pending") throw new Error(`Already ${proposals[idx].status}`);
      proposals[idx].status = "rejected"; proposals[idx].rejectedAt = new Date().toISOString(); proposals[idx].rejectionReason = args.reason || "No reason";
      saveProposals(proposals);
      return `Rejected. Reason: ${proposals[idx].rejectionReason}`;
    }

    case "list_changes": {
      const isAdmin = await verifyAdmin(args.admin_token, args.admin_secret);
      if (!isAdmin && !args.email) throw new Error("Unauthorized: provide email or admin auth");
      if (!isAdmin && !isAuthorized(args.email)) throw new Error("Not authorized");
      let proposals = loadProposals();
      const { status = "pending", email } = args;
      if (status !== "all") proposals = proposals.filter(p => p.status === status);
      if (email) proposals = proposals.filter(p => p.requester_email?.toLowerCase() === email.toLowerCase());
      if (proposals.length === 0) return "No changes found.";
      return proposals.map(p => `${p.id}: ${p.type} ${p.collection} [${p.status}] by ${p.requester_email}`).join("\n");
    }

    case "lookup": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const docs = await executeQuery(args.collection, args.filters, null);
      return JSON.stringify(docs.slice(0, 100), null, 2);
    }

    case "edit_data": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      return await executeMutate(args.collection, args.action, args.data || {}, args.document_id, null);
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
