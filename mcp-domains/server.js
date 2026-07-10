import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_SECRET = process.env.MCP_DOMAINS_ADMIN_SECRET || "";
const ROOT_ADMIN_EMAIL = "rutujdhodapkar@gmail.com";
const DATA_DIR = join(__dirname, "data");
const PROPOSALS_FILE = join(DATA_DIR, "proposals.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ── Storage helpers ──

function readJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function loadProposals() {
  return readJSON(PROPOSALS_FILE) || [];
}

function saveProposals(proposals) {
  writeJSON(PROPOSALS_FILE, proposals);
}

let _db = null;
async function getDb() {
  if (_db) return _db;
  try {
    const { initCosmosDb } = await import("../server/cosmos.js");
    _db = await initCosmosDb();
  } catch { _db = null; }
  return _db;
}

// ── Auth helpers ──

function isAdmin(adminSecret) {
  if (!ADMIN_SECRET) return true;
  return adminSecret === ADMIN_SECRET;
}

async function verifyAgency(email, agencyId) {
  if (!email || !agencyId) return false;
  const db = await getDb();
  if (!db) return false;
  try {
    const snap = await db.collection("agencies").doc(agencyId).get();
    if (!snap.exists) return false;
    const agency = snap.data();
    if (!agency.approved) return false;
    const emails = agency.emails || (agency.email ? [agency.email] : []);
    return emails.some(e => e.toLowerCase() === email.toLowerCase());
  } catch { return false; }
}

// ── Available collections & their schemas ──

const COLLECTIONS = {
  careerPaths: { description: "Internship domains/career paths", agencyScoped: false },
  agencies: { description: "Partner agencies", agencyScoped: true },
  enrollments: { description: "Student enrollments", agencyScoped: true },
  users: { description: "Registered users", agencyScoped: false },
  admins: { description: "Admin users", agencyScoped: false },
  referrals: { description: "Referral codes", agencyScoped: false },
  referralUsers: { description: "Referral-linked users", agencyScoped: false },
  siteConfig: { description: "Site configuration", agencyScoped: false },
  config: { description: "App config (templates, etc.)", agencyScoped: false },
  badges: { description: "Achievement badges", agencyScoped: false },
  userBadges: { description: "User badge awards", agencyScoped: false },
  adminMessages: { description: "Admin broadcast messages", agencyScoped: false },
  siteNotices: { description: "Site notices", agencyScoped: false },
  bannedUsers: { description: "Banned users", agencyScoped: false },
  paymentHistory: { description: "Payment transaction history", agencyScoped: false },
  auditLog: { description: "System audit log", agencyScoped: false },
};

function generateId() {
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Scoped read from Firestore ──

async function executeQuery(collection, filters, agencyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const col = db.collection(collection);
  let query = col;

  if (agencyId && COLLECTIONS[collection]?.agencyScoped) {
    query = query.where("agencyId", "==", agencyId);
  }

  if (filters && filters.length > 0) {
    for (const f of filters) {
      if (f.field && f.op && f.value !== undefined) {
        query = query.where(f.field, f.op, f.value);
      }
    }
  }

  const snap = await query.get();
  return snap.docs.map(d => d.data());
}

async function executeMutate(collection, action, data, id, agencyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const col = db.collection(collection);

  // Verify agency scoping on mutations
  if (agencyId && COLLECTIONS[collection]?.agencyScoped) {
    if (action === "update" || action === "delete") {
      const existing = await col.doc(id).get();
      if (!existing.exists) throw new Error("Document not found");
      if (existing.data().agencyId !== agencyId) throw new Error("Not authorized: document belongs to another agency");
    }
    if (action === "create" && collection === "enrollments") {
      data.agencyId = agencyId;
    }
  }

  switch (action) {
    case "create": {
      const docId = data.id || `${collection}_${Date.now()}`;
      await col.doc(docId).set({ ...data, id: docId, updatedAt: new Date().toISOString() });
      return `Created ${collection}/${docId}`;
    }
    case "update": {
      if (!id) throw new Error("Document ID required for update");
      await col.doc(id).update({ ...data, updatedAt: new Date().toISOString() });
      return `Updated ${collection}/${id}`;
    }
    case "delete": {
      if (!id) throw new Error("Document ID required for delete");
      await col.doc(id).delete();
      return `Deleted ${collection}/${id}`;
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ── Tool definitions ──

const toolDefinitions = [
  {
    name: "propose_query",
    description: "Propose reading data from any collection. Requires admin approval before execution. Agencies can only see their scoped data.",
    inputSchema: {
      type: "object",
      properties: {
        requester_email: { type: "string", description: "Your email for identity" },
        agency_id: { type: "string", description: "Required if you're an agency user" },
        collection: { type: "string", enum: Object.keys(COLLECTIONS), description: "Data collection to query" },
        filters: {
          type: "array", description: "Optional filters [{ field, op, value }]",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              op: { type: "string", enum: ["==", ">", "<", ">=", "<=", "!="], default: "==" },
              value: { type: "string" },
            },
          },
        },
        reason: { type: "string", description: "Why you need this data" },
      },
      required: ["requester_email", "collection"],
    },
  },
  {
    name: "propose_mutate",
    description: "Propose creating, updating, or deleting data. Requires admin approval before execution. Agencies can only modify their own scoped data.",
    inputSchema: {
      type: "object",
      properties: {
        requester_email: { type: "string", description: "Your email for identity" },
        agency_id: { type: "string", description: "Required if you're an agency user" },
        collection: { type: "string", enum: Object.keys(COLLECTIONS), description: "Target collection" },
        action: { type: "string", enum: ["create", "update", "delete"], description: "Operation type" },
        document_id: { type: "string", description: "Document ID (required for update/delete)" },
        data: {
          type: "object", description: "Document fields (required for create/update)",
          additionalProperties: true,
        },
        reason: { type: "string", description: "Why you need to make this change" },
      },
      required: ["requester_email", "collection", "action"],
    },
  },
  {
    name: "approve_proposal",
    description: "Approve a pending proposal. The proposed operation will execute immediately.",
    inputSchema: {
      type: "object",
      properties: {
        proposal_id: { type: "string", description: "Proposal ID to approve" },
        admin_secret: { type: "string", description: "Admin secret for authorization" },
      },
      required: ["proposal_id"],
    },
  },
  {
    name: "reject_proposal",
    description: "Reject a pending proposal with a reason.",
    inputSchema: {
      type: "object",
      properties: {
        proposal_id: { type: "string", description: "Proposal ID to reject" },
        reason: { type: "string", description: "Rejection reason" },
        admin_secret: { type: "string", description: "Admin secret for authorization" },
      },
      required: ["proposal_id"],
    },
  },
  {
    name: "list_proposals",
    description: "List all proposals filtered by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "approved", "rejected", "all"], default: "pending", description: "Filter by status" },
        requester_email: { type: "string", description: "Filter by who proposed it" },
      },
    },
  },
  {
    name: "admin_query",
    description: "Directly query any collection without approval. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: Object.keys(COLLECTIONS), description: "Collection to query" },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              op: { type: "string", enum: ["==", ">", "<", ">=", "<=", "!="], default: "==" },
              value: { type: "string" },
            },
          },
        },
        admin_secret: { type: "string", description: "Admin secret" },
      },
      required: ["collection"],
    },
  },
  {
    name: "admin_mutate",
    description: "Directly create/update/delete data without approval. Admin only.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: Object.keys(COLLECTIONS), description: "Target collection" },
        action: { type: "string", enum: ["create", "update", "delete"], description: "Operation type" },
        document_id: { type: "string", description: "Document ID (required for update/delete)" },
        data: { type: "object", description: "Document fields (for create/update)", additionalProperties: true },
        admin_secret: { type: "string", description: "Admin secret" },
      },
      required: ["collection", "action"],
    },
  },
  {
    name: "list_collections",
    description: "List available data collections and their descriptions.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ── Tool handler ──

async function handleToolCall(name, args) {
  switch (name) {
    // ── Public: Propose Query ──
    case "propose_query": {
      const { requester_email, agency_id, collection, filters, reason } = args;

      if (!requester_email) throw new Error("requester_email is required");

      // Verify agency identity if agency_id provided
      if (agency_id) {
        const valid = await verifyAgency(requester_email, agency_id);
        if (!valid) throw new Error("Not authorized for this agency or agency not approved");
      }

      const proposals = loadProposals();
      const proposal = {
        id: generateId(),
        type: "query",
        requester_email,
        agency_id: agency_id || null,
        collection,
        filters: filters || [],
        reason: reason || "",
        status: "pending",
        submittedAt: new Date().toISOString(),
      };
      proposals.push(proposal);
      saveProposals(proposals);
      return `Query proposal submitted.\nID: ${proposal.id}\nCollection: ${collection}\nStatus: pending\nWaiting for admin approval.`;
    }

    // ── Public: Propose Mutate ──
    case "propose_mutate": {
      const { requester_email, agency_id, collection, action, document_id, data, reason } = args;

      if (!requester_email) throw new Error("requester_email is required");

      if (agency_id) {
        const valid = await verifyAgency(requester_email, agency_id);
        if (!valid) throw new Error("Not authorized for this agency or agency not approved");
      }

      if (collection === "admins" && !isAdmin(args.admin_secret)) {
        throw new Error("Only main admin can modify admins");
      }

      const proposals = loadProposals();
      const proposal = {
        id: generateId(),
        type: "mutate",
        requester_email,
        agency_id: agency_id || null,
        collection,
        action,
        document_id: document_id || null,
        data: data || {},
        reason: reason || "",
        status: "pending",
        submittedAt: new Date().toISOString(),
      };
      proposals.push(proposal);
      saveProposals(proposals);
      return `Mutation proposal submitted.\nID: ${proposal.id}\nCollection: ${collection}\nAction: ${action}\nStatus: pending\nWaiting for admin approval.`;
    }

    // ── Admin: Approve Proposal ──
    case "approve_proposal": {
      if (!isAdmin(args.admin_secret)) throw new Error("Unauthorized: invalid admin_secret");
      const proposals = loadProposals();
      const idx = proposals.findIndex(p => p.id === args.proposal_id);
      if (idx === -1) throw new Error(`Proposal "${args.proposal_id}" not found`);
      if (proposals[idx].status !== "pending") throw new Error(`Proposal already ${proposals[idx].status}`);

      const prop = proposals[idx];
      let result;

      if (prop.type === "query") {
        try {
          const docs = await executeQuery(prop.collection, prop.filters, prop.agency_id);
          result = `Query executed: ${prop.collection} returned ${docs.length} documents.\n${JSON.stringify(docs.slice(0, 50), null, 2)}`;
          if (docs.length > 50) result += `\n... and ${docs.length - 50} more`;
        } catch (err) {
          result = `Query failed: ${err.message}`;
        }
      } else {
        try {
          result = await executeMutate(prop.collection, prop.action, prop.data, prop.document_id, prop.agency_id);
        } catch (err) {
          result = `Mutation failed: ${err.message}`;
        }
      }

      prop.status = "approved";
      prop.approvedAt = new Date().toISOString();
      prop.approvedBy = "admin";
      prop.executionResult = result;
      proposals[idx] = prop;
      saveProposals(proposals);
      return `Proposal "${args.proposal_id}" approved.\n${result}`;
    }

    // ── Admin: Reject Proposal ──
    case "reject_proposal": {
      if (!isAdmin(args.admin_secret)) throw new Error("Unauthorized: invalid admin_secret");
      const proposals = loadProposals();
      const idx = proposals.findIndex(p => p.id === args.proposal_id);
      if (idx === -1) throw new Error(`Proposal "${args.proposal_id}" not found`);
      if (proposals[idx].status !== "pending") throw new Error(`Proposal already ${proposals[idx].status}`);

      proposals[idx].status = "rejected";
      proposals[idx].rejectedAt = new Date().toISOString();
      proposals[idx].rejectionReason = args.reason || "No reason provided";
      saveProposals(proposals);
      return `Proposal "${args.proposal_id}" rejected.\nReason: ${proposals[idx].rejectionReason}`;
    }

    // ── Public: List Proposals ──
    case "list_proposals": {
      let proposals = loadProposals();
      const { status = "pending", requester_email } = args;

      if (status !== "all") {
        proposals = proposals.filter(p => p.status === status);
      }
      if (requester_email) {
        proposals = proposals.filter(p => p.requester_email?.toLowerCase() === requester_email.toLowerCase());
      }

      if (proposals.length === 0) return "No proposals found.";
      return `Proposals (${proposals.length}):\n${proposals.map(p =>
        `• ${p.id}: ${p.type} ${p.collection} [${p.status}] by ${p.requester_email}${p.agency_id ? ` (agency: ${p.agency_id})` : ""}${p.status === "rejected" ? ` — ${p.rejectionReason}` : ""}`
      ).join("\n")}`;
    }

    // ── Admin: Direct Query ──
    case "admin_query": {
      if (!isAdmin(args.admin_secret)) throw new Error("Unauthorized: invalid admin_secret");
      const docs = await executeQuery(args.collection, args.filters, null);
      return `Query ${args.collection}: ${docs.length} documents.\n${JSON.stringify(docs.slice(0, 100), null, 2)}${docs.length > 100 ? `\n... and ${docs.length - 100} more` : ""}`;
    }

    // ── Admin: Direct Mutate ──
    case "admin_mutate": {
      if (!isAdmin(args.admin_secret)) throw new Error("Unauthorized: invalid admin_secret");
      const result = await executeMutate(args.collection, args.action, args.data || {}, args.document_id, null);
      return result;
    }

    // ── Public: List Collections ──
    case "list_collections": {
      return `Available collections:\n${Object.entries(COLLECTIONS).map(([key, val]) =>
        `  • ${key} — ${val.description}${val.agencyScoped ? " (agency-scoped)" : ""}`
      ).join("\n")}`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP server setup ──

const server = new Server(
  { name: "mcp-domains", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));

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

main();

export function getToolDefinitions() { return toolDefinitions; }
export { getDb, COLLECTIONS, handleToolCall };
