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
    throw new Error(`MCP domains module load failed: ${e.message}`);
  }
}

export default async function mcpHandler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  let handler;
  try {
    handler = await getHandler();
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }

  if (req.method === "GET") {
    return res.json({
      server: "mcp-domains", version: "2.0.0",
      info: "request_access -> admin authorize -> propose_query/mutate -> admin approve -> LIVE on web",
      tools: _tools.map(t => ({ name: t.name, desc: t.description?.split(".")[0] })),
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
