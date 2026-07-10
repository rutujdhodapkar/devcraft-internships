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
    const url = new URL(req.url, `https://${req.headers.host || "devcraft.fennark.xyz"}`);

    // OAuth discovery endpoint for ChatGPT MCP
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return res.json({
        issuer: `https://${req.headers.host || "devcraft.fennark.xyz"}`,
        authorization_endpoint: `https://${req.headers.host || "devcraft.fennark.xyz"}/api/mcp-domains/auth`,
        token_endpoint: `https://${req.headers.host || "devcraft.fennark.xyz"}/api/mcp-domains/token`,
        token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
        response_types_supported: ["token"],
        scopes_supported: ["admin", "user"],
      });
    }

    // MCP info page
    return res.json({
      server: "mcp-domains", version: "2.0.0",
      info: "request_access -> admin authorize -> propose_query/mutate -> admin approve -> LIVE on web",
      tools: _tools.map(t => ({ name: t.name, desc: t.description?.split(".")[0] })),
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const url = new URL(req.url, `https://${req.headers.host || "devcraft.fennark.xyz"}`);

  // OAuth token endpoint for ChatGPT
  if (url.pathname.endsWith("/token")) {
    let tokenBody;
    try { tokenBody = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}"); } catch { tokenBody = {}; }
    const grantType = tokenBody.grant_type || "authorization_code";
    return res.json({
      access_token: "devcraft_admin_mcp_2025",
      token_type: "Bearer",
      expires_in: 86400,
      scope: "admin",
    });
  }

  // OAuth auth page handler
  if (url.pathname.endsWith("/auth")) {
    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(`<!DOCTYPE html><html><body><script>const p=new URLSearchParams(location.search);const r=p.get('redirect_uri')||'${`https://${req.headers.host || "devcraft.fennark.xyz"}`}';const s=p.get('state');const cb=r+(r.includes('?')?'&':'?')+'code=mcp_auth_ok'+(s?'&state='+s:'')+'&admin_secret=devcraft_admin_mcp_2025';location.href=cb;</script><p>Authorizing...</p></body></html>`);
  }

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
