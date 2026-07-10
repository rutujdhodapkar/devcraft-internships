import { handleToolCall, getToolDefinitions } from "../mcp-domains/server.js";

const TOOLS = getToolDefinitions();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.json({
      server: "mcp-domains",
      version: "2.0.0",
      info: "Permission system: anyone can propose operations, main admin approves. Agencies scoped to their data.",
      tools: TOOLS.map(t => ({ name: t.name, description: t.description.split(".")[0] })),
      endpoint: "POST /api/mcp-domains with JSON-RPC body",
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

  if (method === "tools/list") {
    return res.json({ jsonrpc, id, result: { tools: TOOLS } });
  }

  if (method === "tools/call") {
    try {
      const text = await handleToolCall(params.name, params.arguments || {});
      return res.json({ jsonrpc, id, result: { content: [{ type: "text", text }] } });
    } catch (err) {
      return res.json({ jsonrpc, id, error: { code: -32603, message: err.message } });
    }
  }

  if (method === "initialize") {
    return res.json({
      jsonrpc, id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mcp-domains", version: "2.0.0" },
      },
    });
  }

  return res.json({ jsonrpc, id, error: { code: -32601, message: `Method not found: ${method}` } });
}
