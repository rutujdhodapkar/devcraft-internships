let _handler;
let _tools;

async function getHandler() {
  if (_handler) return _handler;
  try {
    const m = await import("../mcp-domains/server.js");
    _handler = { handleToolCall: m.handleToolCall, getToolDefinitions: m.getToolDefinitions };
    _tools = m.getToolDefinitions();
    return _handler;
  } catch (e) {
    // Module load error — could be missing SDK dependency in Vercel env
    console.error("[mcp-domains] Handler load failed:", e.message);
    return null;
  }
}

const ALLOWED_ORIGINS = [
  "https://devcraft.fennark.xyz",
  "https://devcraft.rutujdhodapkar.tech",
  "http://localhost:5173",
  "http://localhost:5174",
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o.replace(/\/$/, "")))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://devcraft.fennark.xyz");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export default async function mcpHandler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();

  const handler = await getHandler();

  if (!handler) {
    return res.status(503).json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "MCP service unavailable — SDK not loaded. Check server logs." } });
  }

  if (req.method === "GET") {
    const currentTools = _tools || handler.getToolDefinitions?.();
    return res.json({
      server: "mcp-domains", version: "2.0.0",
      info: "request_access -> email propose -> admin approve/reject -> live on web",
      tools: (currentTools || []).map(t => ({ name: t.name, desc: t.description?.split(".")[0] })),
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch {
    return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }

  const { jsonrpc, id, method, params } = body;

  // Extract Bearer token from Authorization header (used by ChatGPT OAuth)
  const authHeader = req.headers["authorization"] || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  // Propagate the bearer token as `bearer` for every call so JWT / API-key
  // credentials work uniformly with admin_secret / *_token arguments.
  if (method === "tools/call" && params && params.arguments) {
    if (bearerToken && !params.arguments.bearer) {
      params.arguments.bearer = bearerToken;
    }
  }

  try {
    if (method === "tools/list") {
      return res.json({ jsonrpc, id, result: { tools: _tools } });
    }

    if (method === "tools/call") {
      const text = await handler.handleToolCall(params.name, params.arguments || {});
      return res.json({ jsonrpc, id, result: { content: [{ type: "text", text }] } });
    }

    if (method === "initialize" || method === "notifications/initialized") {
      return res.json({
        jsonrpc, id,
        result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "mcp-domains", version: "2.0.0" } },
      });
    }

    if (method === "ping") {
      return res.json({ jsonrpc, id, result: {} });
    }

    return res.json({ jsonrpc, id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (err) {
    return res.json({ jsonrpc, id, error: { code: -32603, message: err.message } });
  }
}
