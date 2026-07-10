import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_SECRET_FALLBACK = process.env.MCP_DOMAINS_ADMIN_SECRET || "";
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
  // ── Access management (public: request / admin: manage) ──
  {
    name: "request_access",
    description: "Request authorization to propose data operations. Admin will review and approve/deny.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Your email address" },
        name: { type: "string", description: "Your name" },
        reason: { type: "string", description: "Why you need access to propose data changes" },
        agency_id: { type: "string", description: "If you represent an agency, provide its ID" },
      },
      required: ["email"],
    },
  },
  {
    name: "authorize_user",
    description: "Approve a user's access request or directly authorize them. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email of user to authorize" },
        request_id: { type: "string", description: "Specific access request ID to approve (optional)" },
        admin_token: { type: "string", description: "Firebase ID token" },
        admin_secret: { type: "string", description: "Fallback admin secret" },
      },
      required: ["email"],
    },
  },
  {
    name: "revoke_user",
    description: "Revoke a user's authorization. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email of user to revoke" },
        admin_token: { type: "string", description: "Firebase ID token" },
        admin_secret: { type: "string", description: "Fallback admin secret" },
      },
      required: ["email"],
    },
  },
  {
    name: "list_pending_access",
    description: "List all pending access requests. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        admin_token: { type: "string", description: "Firebase ID token" },
        admin_secret: { type: "string", description: "Fallback admin secret" },
      },
    },
  },
  {
    name: "list_authorized_users",
    description: "List all authorized users who can propose data operations.",
    inputSchema: { type: "object", properties: {} },
  },

  // ── Data operations (authorized users only) ──
  {
    name: "propose_query",
    description: "Propose reading data. Only authorized users can call this. Admin must approve to execute.",
    inputSchema: {
      type: "object",
      properties: {
        requester_email: { type: "string", description: "Your authorized email" },
        agency_id: { type: "string", description: "Agency ID (if agency user)" },
        collection: { type: "string", enum: Object.keys(COLLECTIONS), description: "Collection to query" },
        filters: { type: "array", items: { type: "object", properties: { field: { type: "string" }, op: { type: "string", enum: ["==", ">", "<", ">=", "<=", "!="], default: "==" }, value: { type: "string" } } } },
        reason: { type: "string", description: "Why you need this data" },
      },
      required: ["requester_email", "collection"],
    },
  },
  {
    name: "propose_mutate",
    description: "Propose creating, updating, or deleting data. Only authorized users can call this. Admin must approve to execute.",
    inputSchema: {
      type: "object",
      properties: {
        requester_email: { type: "string", description: "Your authorized email" },
        agency_id: { type: "string", description: "Agency ID (if agency user)" },
        collection: { type: "string", enum: Object.keys(COLLECTIONS) },
        action: { type: "string", enum: ["create", "update", "delete"] },
        document_id: { type: "string" },
        data: { type: "object", additionalProperties: true },
        reason: { type: "string" },
      },
      required: ["requester_email", "collection", "action"],
    },
  },

  // ── Admin approval ──
  {
    name: "approve_proposal",
    description: "Approve a pending proposal — executes it and makes data live on web. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        proposal_id: { type: "string" },
        admin_token: { type: "string" },
        admin_secret: { type: "string" },
      },
      required: ["proposal_id"],
    },
  },
  {
    name: "reject_proposal",
    description: "Reject a pending proposal with a reason. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        proposal_id: { type: "string" },
        reason: { type: "string" },
        admin_token: { type: "string" },
        admin_secret: { type: "string" },
      },
      required: ["proposal_id"],
    },
  },
  {
    name: "list_proposals",
    description: "List proposals filtered by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "approved", "rejected", "all"], default: "pending" },
        requester_email: { type: "string" },
      },
    },
  },

  // ── Admin bypass (direct operations, no proposal needed) ──
  {
    name: "admin_query",
    description: "Directly query any collection without proposal/approval. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: Object.keys(COLLECTIONS) },
        filters: { type: "array", items: { type: "object", properties: { field: { type: "string" }, op: { type: "string", enum: ["==", ">", "<", ">=", "<=", "!="], default: "==" }, value: { type: "string" } } } },
        admin_token: { type: "string" },
        admin_secret: { type: "string" },
      },
      required: ["collection"],
    },
  },
  {
    name: "admin_mutate",
    description: "Directly create/update/delete data without proposal/approval. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: Object.keys(COLLECTIONS) },
        action: { type: "string", enum: ["create", "update", "delete"] },
        document_id: { type: "string" },
        data: { type: "object", additionalProperties: true },
        admin_token: { type: "string" },
        admin_secret: { type: "string" },
      },
      required: ["collection", "action"],
    },
  },

  // ── Info ──
  {
    name: "list_collections",
    description: "List available data collections.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── Tool handler ──

async function handleToolCall(name, args) {
  switch (name) {
    // ── Access Management ──

    case "request_access": {
      const { email, name: userName, reason, agency_id } = args;
      if (!email) throw new Error("Email is required");

      // Check if already authorized
      if (isAuthorized(email)) return `You're already authorized. Start using propose_query / propose_mutate.`;

      const requests = loadAccessRequests();
      const existing = requests.find(r => r.email.toLowerCase() === email.toLowerCase() && r.status === "pending");
      if (existing) return `Access request already pending (ID: ${existing.id}). Wait for admin approval.`;

      const req = {
        id: generateId(),
        email: email.toLowerCase(),
        name: userName || "",
        reason: reason || "",
        agency_id: agency_id || null,
        status: "pending",
        submittedAt: new Date().toISOString(),
      };
      requests.push(req);
      saveAccessRequests(requests);
      return `Access request submitted.\nID: ${req.id}\nEmail: ${email}\nStatus: pending\nWaiting for admin to authorize you.`;
    }

    case "authorize_user": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const email = args.email.toLowerCase();

      // If request_id provided, mark that request as approved
      if (args.request_id) {
        const requests = loadAccessRequests();
        const idx = requests.findIndex(r => r.id === args.request_id);
        if (idx !== -1) { requests[idx].status = "approved"; requests[idx].approvedAt = new Date().toISOString(); saveAccessRequests(requests); }
      }

      const users = loadAuthUsers();
      if (users.some(u => u.email.toLowerCase() === email)) return `User ${email} is already authorized.`;
      users.push({ email: email.toLowerCase(), authorizedAt: new Date().toISOString(), authorizedBy: "admin" });
      saveAuthUsers(users);
      return `User ${email} is now authorized to propose data operations.`;
    }

    case "revoke_user": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const email = args.email.toLowerCase();
      let users = loadAuthUsers();
      const before = users.length;
      users = users.filter(u => u.email.toLowerCase() !== email);
      if (users.length === before) return `User ${email} was not authorized.`;
      saveAuthUsers(users);
      return `Authorization revoked for ${email}.`;
    }

    case "list_pending_access": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const requests = loadAccessRequests().filter(r => r.status === "pending");
      if (requests.length === 0) return "No pending access requests.";
      return `Pending access requests (${requests.length}):\n${requests.map(r =>
        `• ${r.id}: ${r.email}${r.name ? ` (${r.name})` : ""}${r.agency_id ? ` [agency: ${r.agency_id}]` : ""} — "${r.reason}"`
      ).join("\n")}`;
    }

    case "list_authorized_users": {
      const users = loadAuthUsers();
      if (users.length === 0) return "No authorized users yet. Use request_access to get started.";
      return `Authorized users (${users.length}):\n${users.map(u => `• ${u.email} (since ${u.authorizedAt})`).join("\n")}`;
    }

    // ── Proposal Operations (authorized users only) ──

    case "propose_query": {
      const { requester_email, agency_id, collection, filters, reason } = args;
      if (!requester_email) throw new Error("requester_email is required");
      if (!isAuthorized(requester_email)) throw new Error("Not authorized. Use request_access first, then wait for admin approval.");

      const proposals = loadProposals();
      const proposal = {
        id: `prop_${generateId()}`, type: "query", requester_email, agency_id: agency_id || null,
        collection, filters: filters || [], reason: reason || "",
        status: "pending", submittedAt: new Date().toISOString(),
      };
      proposals.push(proposal);
      saveProposals(proposals);
      return `Query proposal submitted.\nID: ${proposal.id}\nCollection: ${collection}\nStatus: pending\nWaiting for admin to approve and make live.`;
    }

    case "propose_mutate": {
      const { requester_email, agency_id, collection, action, document_id, data, reason } = args;
      if (!requester_email) throw new Error("requester_email is required");
      if (!isAuthorized(requester_email)) throw new Error("Not authorized. Use request_access first, then wait for admin approval.");

      if (collection === "admins" && !(await verifyAdmin(args.admin_token, args.admin_secret))) {
        throw new Error("Only main admin can modify admins");
      }

      const proposals = loadProposals();
      const proposal = {
        id: `prop_${generateId()}`, type: "mutate", requester_email, agency_id: agency_id || null,
        collection, action, document_id: document_id || null, data: data || {}, reason: reason || "",
        status: "pending", submittedAt: new Date().toISOString(),
      };
      proposals.push(proposal);
      saveProposals(proposals);
      return `Mutation proposal submitted.\nID: ${proposal.id}\nCollection: ${collection}\nAction: ${action}\nStatus: pending\nWaiting for admin to approve and make live.`;
    }

    // ── Admin: Approve/Reject Proposals (makes data LIVE) ──

    case "approve_proposal": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized: admin_token or admin_secret required");
      const proposals = loadProposals();
      const idx = proposals.findIndex(p => p.id === args.proposal_id);
      if (idx === -1) throw new Error(`Proposal "${args.proposal_id}" not found`);
      if (proposals[idx].status !== "pending") throw new Error(`Proposal already ${proposals[idx].status}`);

      const prop = proposals[idx];
      let result;
      if (prop.type === "query") {
        try { const docs = await executeQuery(prop.collection, prop.filters, prop.agency_id); result = `Query executed: ${prop.collection} returned ${docs.length} documents.\n${JSON.stringify(docs.slice(0, 50), null, 2)}${docs.length > 50 ? `\n... and ${docs.length - 50} more` : ""}`; }
        catch (err) { result = `Query failed: ${err.message}`; }
      } else {
        try { result = await executeMutate(prop.collection, prop.action, prop.data, prop.document_id, prop.agency_id); }
        catch (err) { result = `Mutation failed: ${err.message}`; }
      }

      prop.status = "approved";
      prop.approvedAt = new Date().toISOString();
      prop.approvedBy = "admin";
      prop.executionResult = result;
      proposals[idx] = prop;
      saveProposals(proposals);
      return `✅ Proposal "${args.proposal_id}" approved and made LIVE.\n${result}`;
    }

    case "reject_proposal": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized: admin_token or admin_secret required");
      const proposals = loadProposals();
      const idx = proposals.findIndex(p => p.id === args.proposal_id);
      if (idx === -1) throw new Error(`Proposal "${args.proposal_id}" not found`);
      if (proposals[idx].status !== "pending") throw new Error(`Proposal already ${proposals[idx].status}`);
      proposals[idx].status = "rejected";
      proposals[idx].rejectedAt = new Date().toISOString();
      proposals[idx].rejectionReason = args.reason || "No reason provided";
      saveProposals(proposals);
      return `❌ Proposal "${args.proposal_id}" rejected.\nReason: ${proposals[idx].rejectionReason}`;
    }

    case "list_proposals": {
      let proposals = loadProposals();
      const { status = "pending", requester_email } = args;
      if (status !== "all") proposals = proposals.filter(p => p.status === status);
      if (requester_email) proposals = proposals.filter(p => p.requester_email?.toLowerCase() === requester_email.toLowerCase());
      if (proposals.length === 0) return "No proposals found.";
      return `Proposals (${proposals.length}):\n${proposals.map(p =>
        `• ${p.id}: ${p.type} ${p.collection} [${p.status}] by ${p.requester_email}${p.agency_id ? ` (agency: ${p.agency_id})` : ""}${p.status === "rejected" ? ` — ${p.rejectionReason}` : ""}`
      ).join("\n")}`;
    }

    // ── Admin Direct (bypass) ──

    case "admin_query": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const docs = await executeQuery(args.collection, args.filters, null);
      return `Admin query ${args.collection}: ${docs.length} documents.\n${JSON.stringify(docs.slice(0, 100), null, 2)}${docs.length > 100 ? `\n... and ${docs.length - 100} more` : ""}`;
    }

    case "admin_mutate": {
      if (!(await verifyAdmin(args.admin_token, args.admin_secret))) throw new Error("Unauthorized");
      const result = await executeMutate(args.collection, args.action, args.data || {}, args.document_id, null);
      return result;
    }

    case "list_collections": {
      return `Available collections:\n${Object.entries(COLLECTIONS).map(([k, v]) => `  • ${k} — ${v.desc}${v.scoped ? " (agency-scoped)" : ""}`).join("\n")}`;
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
