import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  verifyFirebaseToken,
  isFirebaseAdmin,
  resolveIdentity,
  isAuthorizedEmail,
} from "../server/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

// Vercel's filesystem (including /tmp) is ephemeral.  These records live in
// Cosmos whenever it is configured; JSON is only a local-development fallback.
async function loadPersistent(collection, fallback) {
  const db = await getDb();
  if (!db) return readJSON(fallback) || [];
  const snapshot = await db.collection(collection).get();
  return snapshot.docs.map((doc) => doc.data());
}
async function savePersistent(collection, rows, fallback) {
  const db = await getDb();
  if (!db) { writeJSON(fallback, rows); return; }
  const refs = await db.collection(collection).listDocuments();
  const nextIds = new Set(rows.map((row) => row.id || row.email.toLowerCase()));
  await Promise.all([
    ...rows.map((row) => db.collection(collection).doc(row.id || row.email.toLowerCase()).set(row)),
    ...refs.filter((ref) => !nextIds.has(ref.id)).map((ref) => ref.delete()),
  ]);
}
async function loadProposals() { return loadPersistent("mcpProposals", PROPOSALS_FILE); }
async function saveProposals(p) { return savePersistent("mcpProposals", p, PROPOSALS_FILE); }
async function loadAuthUsers() { return loadPersistent("mcpAuthorizedUsers", AUTH_USERS_FILE); }
async function saveAuthUsers(u) { return savePersistent("mcpAuthorizedUsers", u, AUTH_USERS_FILE); }
async function loadAccessRequests() { return loadPersistent("mcpAccessRequests", ACCESS_REQUESTS_FILE); }
async function saveAccessRequests(r) { return savePersistent("mcpAccessRequests", r, ACCESS_REQUESTS_FILE); }

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

// ── Auth helpers (delegated to shared server/auth.js) ──

async function verifyAdmin(args) {
  // Service keys (admin_secret / MCP_API_KEY) are intentionally NOT accepted
  // for mcp-domains — only Firebase-authenticated admins, approved-user JWTs,
  // or the local operator (MCP_LOCAL_TRUSTED) may administer MCP.
  const id = await resolveIdentity({
    admin_token: args.admin_token,
    bearer: args.bearer,
    user_token: args.user_token,
  });
  return !!(id && id.role === "admin");
}

async function isAuthorized(email) {
  if (!email) return false;
  const users = await loadAuthUsers();
  return users.some(u => u.email.toLowerCase() === email.toLowerCase());
}

async function authorizedMcpUser(args, tool, requiredPermission = "read") {
  const id = await resolveIdentity({ user_token: args.user_token, bearer: args.bearer });
  if (!id) throw new Error("Sign in with an approved email to use MCP.");
  // Service/admin identities (local, api_key, admin_secret, admin JWT) bypass
  // per-account tool gating.
  if (id.role === "admin" || (id.email && id.email.endsWith("@devcraft.local"))) return id;
  if (!id.email) throw new Error("Sign in with an approved email to use MCP.");
  if (args.email && args.email.toLowerCase() !== id.email.toLowerCase()) throw new Error("Requested email does not match the signed-in user.");
  const record = (await loadAuthUsers()).find((item) => item.email.toLowerCase() === id.email.toLowerCase());
  if (!record) throw new Error("This email has not been approved for MCP access.");
  // Empty permissions mean no access, never unrestricted access.  Hooks are
  // stored independently so selecting GitHub/Slack cannot accidentally grant
  // or deny MCP operations.
  const allowed = (record.allowed_tools || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!allowed.length) throw new Error("No MCP permissions have been granted for this account.");
  if (allowed.length && !allowed.includes(tool)) throw new Error(`Your role is not allowed to use ${tool}.`);
  if (!record.permissions?.[requiredPermission] && !record.permissions?.admin) throw new Error(`Your role does not have ${requiredPermission} permission.`);
  return { ...id, ...record };
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

let mcpLog = [];
function logAction(action, by, detail) {
  mcpLog.push({ action, by, detail, time: new Date().toISOString() });
  try { writeFileSync(join(DATA_DIR, "mcp-log.json"), JSON.stringify(mcpLog.slice(-200)), "utf8"); } catch {}
}

const toolDefinitions = [
  {
    name: "request_access",
    description: "Request access to use the system. Provide your email.",
    inputSchema: { type: "object", properties: {
      email: { type: "string" }, name: { type: "string" }, reason: { type: "string" }, agency_id: { type: "string" },
      webhook_url: { type: "string", description: "URL to receive notifications" },
      allowed_tools: { type: "string", description: "Comma-separated MCP tools requested" },
      requested_hooks: { type: "string", description: "Comma-separated API/hooks requested" },
    }, required: ["email"] },
  },
  {
    name: "approve_user",
    description: "Approve a user's access request.",
    inputSchema: { type: "object", properties: {
      email: { type: "string" }, name: { type: "string" }, agency_id: { type: "string" }, request_id: { type: "string" },
      allowed_tools: { type: "string", description: "Comma-separated MCP tools this user can access" },
      allowed_hooks: { type: "string", description: "Comma-separated API/hooks approved by admin" },
      permissions: { type: "object", description: "Read/write/execute/admin permission flags" },
      webhook_url: { type: "string", description: "Webhook URL for notifications" },
    }, required: ["email"] },
  },
  {
    name: "remove_user",
    description: "Revoke a user's access.",
    inputSchema: { type: "object", properties: { email: { type: "string" } }, required: ["email"] },
  },
  {
    name: "pending_users",
    description: "List users waiting for approval.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "active_users",
    description: "List users who have access.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_domains",
    description: "List all internship domains. Provide email if you are an authorized user, or use admin auth for full access.",
    inputSchema: { type: "object", properties: { email: { type: "string" } } },
  },
  {
    name: "get_tasks",
    description: "List projects/tasks for a specific domain.",
    inputSchema: { type: "object", properties: { email: { type: "string" }, domain_id: { type: "string" } }, required: ["domain_id"] },
  },
  {
    name: "add_domain",
    description: "Suggest adding a new domain. Goes to admin for review.",
    inputSchema: { type: "object", properties: {
      email: { type: "string" }, id: { type: "string" }, title: { type: "string" },
      duration: { type: "string" }, paymentAmount: { type: "number" }, paymentAmountReferral: { type: "number" },
      description: { type: "string" }, features: { type: "array", items: { type: "string" } }, icon: { type: "string" },
    }, required: ["email", "id", "title"] },
  },
  {
    name: "add_task",
    description: "Suggest adding a project/task to a domain. Goes to admin for review.",
    inputSchema: { type: "object", properties: {
      email: { type: "string" }, domain_id: { type: "string" }, title: { type: "string" },
      description: { type: "string" }, type: { type: "string", enum: ["project", "quiz"], default: "project" },
      links: { type: "array", items: { type: "string" } },
    }, required: ["email", "domain_id", "title"] },
  },
  {
    name: "list_changes",
    description: "List all pending or past change suggestions.",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["pending", "approved", "rejected", "all"], default: "pending" } } },
  },
  {
    name: "approve_change",
    description: "Approve a pending change suggestion to make it live.",
    inputSchema: { type: "object", properties: { change_id: { type: "string" } }, required: ["change_id"] },
  },
  {
    name: "reject_change",
    description: "Reject a pending change suggestion.",
    inputSchema: { type: "object", properties: { change_id: { type: "string" }, reason: { type: "string" } }, required: ["change_id"] },
  },
  {
    name: "lookup",
    description: "Query any collection directly.",
    inputSchema: { type: "object", properties: {
      collection: { type: "string", enum: Object.keys(COLLECTIONS) },
      filters: { type: "array", items: { type: "object", properties: { field: { type: "string" }, op: { type: "string", enum: ["==", ">", "<", ">=", "<=", "!="], default: "==" }, value: { type: "string" } } } },
    }, required: ["collection"] },
  },
  {
    name: "edit_data",
    description: "Create, update, or delete any data directly.",
    inputSchema: { type: "object", properties: {
      collection: { type: "string", enum: Object.keys(COLLECTIONS) },
      action: { type: "string", enum: ["create", "update", "delete"] },
      document_id: { type: "string" }, data: { type: "object", additionalProperties: true },
    }, required: ["collection", "action"] },
  },
  {
    name: "collections",
    description: "List available collections.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "audit_log",
    description: "View all MCP usage logs (reads, writes, approvals).",
    inputSchema: { type: "object", properties: {} },
  },
];

async function handleToolCall(name, args) {
  const NAME_MAP = {
    authorize_user: "approve_user", revoke_user: "remove_user",
    list_pending_access: "pending_users", list_authorized_users: "active_users",
    propose_query: "get_domains", propose_mutate: "add_domain",
    admin_query: "lookup", admin_mutate: "edit_data",
    list_collections: "collections", read_data: "get_domains", write_data: "add_domain", list_logs: "audit_log",
  };
  name = NAME_MAP[name] || name;

  switch (name) {
    case "request_access": {
      const id = await resolveIdentity({ user_token: args.user_token, bearer: args.bearer, admin_token: args.admin_token });
      // Anonymous/local operators may specify any email; everyone else can only
      // request access for their own signed-in account.
      const isOperator = id && (id.source === "local" || id.role === "admin");
      const email = (isOperator && args.email ? args.email : id?.email || "").toLowerCase();
      if (!email || email.endsWith("@devcraft.local")) throw new Error("Sign in with your account to request MCP access.");
      const requesterName = args.name || id?.name || "";
      const { reason, agency_id, webhook_url, allowed_tools, requested_hooks } = args;
      if (await isAuthorized(email)) return "You already have access.";
      const reqs = await loadAccessRequests();
      if (reqs.find(r => r.email.toLowerCase() === email.toLowerCase() && r.status === "pending")) return "Request already pending.";
      reqs.push({ id: generateId(), email: email.toLowerCase(), name: requesterName, reason: reason||"", agency_id: agency_id||null, webhook_url: webhook_url||"", allowed_tools: allowed_tools||"", requested_hooks: requested_hooks||"", status: "pending", submittedAt: new Date().toISOString() });
      await saveAccessRequests(reqs);
      logAction("request_access", email, `Requested access${agency_id ? ` (agency: ${agency_id})` : ""}`);
      return "Request submitted. Admin will review. You will be notified when approved.";
    }
    case "approve_user": {
      if (!(await verifyAdmin(args))) throw new Error("Unauthorized");
      const e = args.email.toLowerCase();
      if (args.request_id) { const r = await loadAccessRequests(); const i = r.findIndex(x => x.id === args.request_id); if (i>-1) { r[i].status="approved"; r[i].approvedAt=new Date().toISOString(); r[i].allowed_tools = args.allowed_tools || r[i].allowed_tools || ""; r[i].webhook_url = args.webhook_url || r[i].webhook_url || ""; await saveAccessRequests(r); } }
      const u = await loadAuthUsers();
      if (u.some(x => x.email.toLowerCase() === e)) return JSON.stringify({ok:true, message:"Already has access"});
      u.push({ email: e, name: args.name||"", agency_id: args.agency_id||null, allowed_tools: args.allowed_tools||"", allowed_hooks: args.allowed_hooks || "", permissions: args.permissions || { read: true, write: false, execute: false, admin: false }, webhook_url: args.webhook_url||"", authorizedAt: new Date().toISOString(), authorizedBy: "admin" });
      await saveAuthUsers(u);
      logAction("approve_user", "admin", `Approved ${e}${args.allowed_tools ? ` tools: ${args.allowed_tools}` : ""}`);
      return JSON.stringify({ok:true, message:`${e} now has access`});
    }
    case "remove_user": {
      if (!(await verifyAdmin(args))) throw new Error("Unauthorized");
      let u = await loadAuthUsers(); const b = u.length;
      u = u.filter(x => x.email.toLowerCase() !== args.email.toLowerCase());
      if (u.length === b) return "Not found";
      await saveAuthUsers(u);
      logAction("remove_user", "admin", `Removed ${args.email}`);
      return "Removed";
    }
    case "pending_users": {
      if (!(await verifyAdmin(args))) throw new Error("Unauthorized");
      return JSON.stringify((await loadAccessRequests()).filter(r => r.status === "pending"));
    }
    case "active_users": {
      if (!(await verifyAdmin(args))) throw new Error("Unauthorized");
      return JSON.stringify(await loadAuthUsers());
    }
    case "get_domains": {
      const isAdmin = await verifyAdmin(args);
      const member = isAdmin ? null : await authorizedMcpUser(args, "get_domains");
      const docs = await executeQuery("careerPaths", [], null);
      logAction("get_domains", isAdmin ? "admin" : member.email, `Read ${docs.length} domains`);
      return JSON.stringify(docs.map(d => ({ id: d.id, title: d.title, duration: d.duration, paymentAmount: d.paymentAmount, description: d.description, features: d.features, icon: d.icon, projects: (d.projects||[]).length })), null, 2);
    }
    case "get_tasks": {
      const isAdmin = await verifyAdmin(args);
      const member = isAdmin ? null : await authorizedMcpUser(args, "get_tasks");
      const docs = await executeQuery("careerPaths", [], null);
      const domain = docs.find(d => d.id === args.domain_id);
      if (!domain) throw new Error("Domain not found");
      logAction("get_tasks", isAdmin ? "admin" : member.email, `Read tasks for ${args.domain_id}`);
      return JSON.stringify(domain.projects || [], null, 2);
    }
    case "add_domain": {
      const isAdmin = await verifyAdmin(args);
      if (isAdmin) {
        const r = await executeMutate("careerPaths", "create", { id: args.id, title: args.title, duration: args.duration||"8 Weeks", paymentAmount: args.paymentAmount||249, paymentAmountReferral: args.paymentAmountReferral||220, description: args.description||"", features: args.features||[], icon: args.icon||"⭐", projects: [] }, null, null);
        logAction("add_domain", "admin", `Added domain live: ${args.title}`);
        return `Domain "${args.title}" added live. (ID: ${args.id})`;
      }
      const member = await authorizedMcpUser(args, "add_domain", "write");
      const email = member.email;
      const proposals = await loadProposals();
      const proposal = { id: `prop_${generateId()}`, type: "add_domain", requester_email: email, data: { id: args.id, title: args.title, duration: args.duration||"8 Weeks", paymentAmount: args.paymentAmount||249, paymentAmountReferral: args.paymentAmountReferral||220, description: args.description||"", features: args.features||[], icon: args.icon||"⭐" }, status: "pending", submittedAt: new Date().toISOString() };
      proposals.push(proposal); await saveProposals(proposals);
      logAction("add_domain", email, `Suggested new domain: ${args.title}`);
      return `Domain "${args.title}" submitted for review (ID: ${proposal.id}). Admin will review and make it live.`;
    }
    case "add_task": {
      const isAdmin = await verifyAdmin(args);
      if (isAdmin) {
        const docs = await executeQuery("careerPaths", [], null);
        const domain = docs.find(d => d.id === args.domain_id);
        if (!domain) throw new Error("Domain not found");
        const projects = domain.projects || [];
        projects.push({ title: args.title, description: args.description||"", type: args.type||"project", links: args.links||[] });
        const r = await executeMutate("careerPaths", "update", { projects }, args.domain_id, null);
        logAction("add_task", "admin", `Added task live: ${args.title} for ${args.domain_id}`);
        return `Task "${args.title}" added live.`;
      }
      const member = await authorizedMcpUser(args, "add_task", "write");
      const email = member.email;
      const proposals = await loadProposals();
      const proposal = { id: `prop_${generateId()}`, type: "add_task", requester_email: email, data: { domain_id: args.domain_id, title: args.title, description: args.description||"", type: args.type||"project", links: args.links||[] }, status: "pending", submittedAt: new Date().toISOString() };
      proposals.push(proposal); await saveProposals(proposals);
      logAction("add_task", email, `Suggested new task: ${args.title} for ${args.domain_id}`);
      return `Task "${args.title}" submitted for review (ID: ${proposal.id}). Admin will review and make it live.`;
    }
    case "list_changes": {
      if (!(await verifyAdmin(args))) throw new Error("Unauthorized");
      let proposals = await loadProposals();
      const s = args.status || "pending";
      if (s !== "all") proposals = proposals.filter(p => p.status === s);
      return JSON.stringify(proposals, null, 2);
    }
    case "approve_change": {
      if (!(await verifyAdmin(args))) throw new Error("Unauthorized");
      const proposals = await loadProposals();
      const idx = proposals.findIndex(p => p.id === args.change_id);
      if (idx === -1) throw new Error(`Change "${args.change_id}" not found`);
      if (proposals[idx].status !== "pending") throw new Error(`Already ${proposals[idx].status}`);
      const prop = proposals[idx];
      let result = "";
      if (prop.type === "add_domain") {
        try { result = await executeMutate("careerPaths", "create", { id: prop.data.id, title: prop.data.title, duration: prop.data.duration, paymentAmount: prop.data.paymentAmount, paymentAmountReferral: prop.data.paymentAmountReferral, description: prop.data.description, features: prop.data.features, icon: prop.data.icon, projects: [] }, null, null); } catch (err) { result = `Error: ${err.message}`; }
      } else if (prop.type === "add_task") {
        try { const docs = await executeQuery("careerPaths", [], null); const domain = docs.find(d => d.id === prop.data.domain_id); if (!domain) throw new Error("Domain not found"); const projects = domain.projects || []; projects.push({ title: prop.data.title, description: prop.data.description, type: prop.data.type, links: prop.data.links }); result = await executeMutate("careerPaths", "update", { projects }, prop.data.domain_id, null); } catch (err) { result = `Error: ${err.message}`; }
      } else if (prop.type === "edit_data") {
        try { result = await executeMutate(prop.data.collection, prop.data.action, prop.data.data, prop.data.document_id, null); } catch (err) { result = `Error: ${err.message}`; }
      }
      prop.status = "approved"; prop.approvedAt = new Date().toISOString(); prop.executionResult = result;
      proposals[idx] = prop; await saveProposals(proposals);
      logAction("approve_change", "admin", `Approved ${prop.type}: ${prop.data?.title || args.change_id}`);
      return `Approved. ${result}`;
    }
    case "reject_change": {
      if (!(await verifyAdmin(args))) throw new Error("Unauthorized");
      const proposals = await loadProposals();
      const idx = proposals.findIndex(p => p.id === args.change_id);
      if (idx === -1) throw new Error(`Change "${args.change_id}" not found`);
      if (proposals[idx].status !== "pending") throw new Error(`Already ${proposals[idx].status}`);
      proposals[idx].status = "rejected"; proposals[idx].rejectionReason = args.reason || "No reason";
      await saveProposals(proposals);
      logAction("reject_change", "admin", `Rejected ${args.change_id}: ${args.reason||"No reason"}`);
      return `Rejected. Reason: ${proposals[idx].rejectionReason}`;
    }
    case "lookup": {
      const isAdmin = await verifyAdmin(args);
      const who = isAdmin ? "admin" : (await authorizedMcpUser(args, "lookup")).email;
      const docs = await executeQuery(args.collection, args.filters||[], null);
      logAction("lookup", who, `Queried ${args.collection}: ${docs.length} results`);
      return JSON.stringify(docs, null, 2);
    }
    case "edit_data": {
      const isAdmin = await verifyAdmin(args);
      if (isAdmin) {
        const r = await executeMutate(args.collection, args.action, args.data||{}, args.document_id, null);
        logAction("edit_data", "admin", `${args.action} on ${args.collection}/${args.document_id||""}`);
        return r;
      }
      const member = await authorizedMcpUser(args, "edit_data", "write");
      const proposals = await loadProposals();
      const proposal = { id: `prop_${generateId()}`, type: "edit_data", requester_email: member.email, data: { collection: args.collection, action: args.action, data: args.data||{}, document_id: args.document_id }, status: "pending", submittedAt: new Date().toISOString() };
      proposals.push(proposal); await saveProposals(proposals);
      logAction("edit_data", member.email, `Proposed edit on ${args.collection}/${args.document_id||""}`);
      return `Edit proposed (ID: ${proposal.id}). Admin will review and apply.`;
    }
    case "collections": {
      if (!(await verifyAdmin(args))) throw new Error("Unauthorized");
      return Object.keys(COLLECTIONS).join(", ");
    }
    case "audit_log": {
      if (!(await verifyAdmin(args))) throw new Error("Unauthorized");
      try { return JSON.stringify(readJSON(join(DATA_DIR, "mcp-log.json")) || [], null, 2); } catch { return "[]"; }
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
