import { createServer } from "http";
import { handleToolCall, getToolDefinitions } from "./server.js";
import { resolveIdentity } from "../server/auth.js";

const PORT = process.env.PORT || 3100;
const TOOLS = getToolDefinitions();

const ALLOWED_ORIGINS = [
  "https://devcraft.fennark.xyz",
  "http://localhost:5173",
  "http://localhost:5174",
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o.replace(/\/$/, "")))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (origin) {
    res.setHeader("Access-Control-Allow-Origin", "https://devcraft.fennark.xyz");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://devcraft.fennark.xyz");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Parse error")); }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  if (req.method === "GET") {
    send(200, {
      server: "mcp-domains",
      version: "2.0.0",
      info: "Propose → Admin Approve → Execute. Agencies scoped to own data.",
      tools: TOOLS.map(t => ({ name: t.name, description: t.description.split(".")[0] })),
    });
    return;
  }

  if (req.method !== "POST") { send(405, { error: "Method not allowed" }); return; }

  let body;
  try { body = await parseBody(req); }
  catch { send(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); return; }

  const { jsonrpc, id, method, params } = body;

  if (method === "tools/list") { send(200, { jsonrpc, id, result: { tools: TOOLS } }); return; }

  if (method === "initialize") {
    send(200, {
      jsonrpc, id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mcp-domains", version: "2.0.0" },
      },
    });
    return;
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    // `request_access` is the only open door (onboarding); everything else
    // requires a valid credential.
    if (toolName !== "request_access") {
      const authHeader = req.headers["authorization"] || "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : (args.bearer || "");
      const idn = await resolveIdentity({
        bearer,
        user_token: args.user_token,
        admin_token: args.admin_token,
        admin_secret: args.admin_secret,
        api_key: args.api_key,
      });
      if (!idn) {
        send(200, { jsonrpc, id, error: { code: -32001, message: "Unauthorized: valid authentication required." } });
        return;
      }
      if (!args.bearer && bearer) args.bearer = bearer;
    }

    try {
      const text = await handleToolCall(toolName, args);
      send(200, { jsonrpc, id, result: { content: [{ type: "text", text }] } });
    } catch (err) {
      send(200, { jsonrpc, id, error: { code: -32603, message: err.message } });
    }
    return;
  }

  send(200, { jsonrpc, id, error: { code: -32601, message: `Method not found: ${method}` } });
});

server.listen(PORT, () => {
  console.log(`[mcp-domains] HTTP server on http://localhost:${PORT}`);
});
