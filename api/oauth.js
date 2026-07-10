const BASE = "https://devcraft.fennark.xyz";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const url = new URL(req.url, BASE);
  const path = url.pathname;

  // Auth page (GET) - must be checked before the generic GET handler
  if (path.endsWith("/auth")) {
    res.setHeader("Content-Type", "text/html");
    const qs = new URLSearchParams(req.url.includes("?") ? req.url.split("?")[1] : "");
    const redirectUri = qs.get("redirect_uri") || BASE;
    const state = qs.get("state") || "";
    const cb = `${redirectUri}${redirectUri.includes("?") ? "&" : "?"}code=mcp_auth_ok${state ? "&state=" + state : ""}`;
    return res.status(200).send(`<!DOCTYPE html><html><body><script>location.href=${JSON.stringify(cb)}</script><p>Authorizing... Redirecting back to ChatGPT.</p></body></html>`);
  }

  // Token endpoint
  if (path.endsWith("/token")) {
    return res.json({
      access_token: "devcraft_admin_mcp_2025",
      token_type: "Bearer",
      expires_in: 86400,
      scope: "admin",
    });
  }

  // OAuth discovery (default GET for this endpoint)
  return res.json({
    issuer: BASE,
    authorization_endpoint: `${BASE}/api/oauth/auth`,
    token_endpoint: `${BASE}/api/oauth/token`,
    token_endpoint_auth_methods_supported: ["none"],
    response_types_supported: ["token"],
    scopes_supported: ["admin", "user"],
  });
}
