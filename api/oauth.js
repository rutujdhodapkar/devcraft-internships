import { signJwt, verifyJwt, isAuthorizedEmail, isFirebaseAdmin } from "../server/auth.js";

const BASE = "https://devcraft.fennark.xyz";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Parse error")); }
    });
    req.on("error", reject);
  });
}

// Verify a Google id_token (returned by the Sign-In widget) and return email.
async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID is not configured.");
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const payload = await res.json();
  if (!res.ok || payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error("Google token verification failed.");
  }
  return payload.email;
}

function signInPage(redirectUri, state) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>DEV/CRAFT — Authorize</title>
<script src="https://accounts.google.com/gsi/client" async></script>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f1220;color:#fff}div{text-align:center}#msg{margin-top:16px;color:#9aa}</style>
</head><body><div>
<h2>DEV/CRAFT MCP Access</h2>
<p>Sign in with Google to authorize ChatGPT.</p>
<div id="gbtn"></div>
<div id="msg">Waiting…</div>
<script>
const REDIRECT_URI = ${JSON.stringify(redirectUri)};
const STATE = ${JSON.stringify(state)};
function show(m){ document.getElementById('msg').textContent = m; }
window.onload = () => {
  if (!REDIRECT_URI) { show('Missing redirect_uri.'); return; }
  google.accounts.id.initialize({
    client_id: ${JSON.stringify(GOOGLE_CLIENT_ID)},
    callback: async (resp) => {
      try {
        const r = await fetch('/api/oauth/callback', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ id_token: resp.credential, redirect_uri: REDIRECT_URI, state: STATE })
        });
        const data = await r.json();
        if (!r.ok || !data.access_token) { show('Access denied: ' + (data.message || 'not authorized')); return; }
        const hash = '#access_token=' + encodeURIComponent(data.access_token) + '&token_type=Bearer' + (STATE ? '&state=' + encodeURIComponent(STATE) : '');
        show('Authorized. Redirecting back to ChatGPT…');
        window.location.href = REDIRECT_URI + hash;
      } catch (e) { show('Error: ' + e.message); }
    }
  });
  google.accounts.id.renderButton(document.getElementById('gbtn'), { theme:'filled_blue', size:'large' });
};
</script></div></body></html>`;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = new URL(req.url, BASE);
  const path = url.pathname;

  // Authorization page (GET)
  if (path.endsWith("/auth")) {
    if (!GOOGLE_CLIENT_ID) {
      res.setHeader("Content-Type", "text/plain");
      return res.status(500).send("Google sign-in is not configured (GOOGLE_CLIENT_ID missing).");
    }
    const qs = new URLSearchParams(req.url.includes("?") ? req.url.split("?")[1] : "");
    const redirectUri = qs.get("redirect_uri") || BASE;
    const state = qs.get("state") || "";
    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(signInPage(redirectUri, state));
  }

  // Callback (POST): verify Google id_token, mint our JWT.
  // Approved accounts get a full token (admin/user). Not-yet-approved accounts
  // still get a limited "pending" token so they can call request_access from
  // any device and be upgraded once an admin approves them.
  if (path.endsWith("/callback")) {
    let body;
    try { body = await readBody(req); }
    catch { return res.status(400).json({ error: "Parse error" }); }
    try {
      const email = await verifyGoogleIdToken(body.id_token);
      const authorized = await isAuthorizedEmail(email);
      const role = authorized ? ((await isFirebaseAdmin(email)) ? "admin" : "user") : "pending";
      const access_token = signJwt({ email, role, source: "google" }, { expiresIn: 86400 });
      return res.status(200).json({ access_token, token_type: "Bearer", expires_in: 86400, scope: role });
    } catch (e) {
      return res.status(401).json({ error: e.message });
    }
  }

  // Token endpoint (POST): exchange the issued JWT (authorization code).
  if (path.endsWith("/token")) {
    let body;
    try { body = await readBody(req); }
    catch { return res.status(400).json({ error: "Parse error" }); }
    const code = body.code || body.access_token;
    if (!code || !verifyJwt(code)) {
      return res.status(401).json({ error: "Invalid or missing authorization code." });
    }
    const jwt = verifyJwt(code);
    return res.status(200).json({ access_token: code, token_type: "Bearer", expires_in: (jwt.exp || 0) - Math.floor(Date.now() / 1000), scope: jwt.role || "user" });
  }

  // OAuth discovery (default GET for this endpoint)
  return res.status(200).json({
    issuer: BASE,
    authorization_endpoint: `${BASE}/api/oauth/auth`,
    token_endpoint: `${BASE}/api/oauth/token`,
    token_endpoint_auth_methods_supported: ["none"],
    response_types_supported: ["token"],
    scopes_supported: ["admin", "user"],
    id_token_signing_alg_values_supported: ["HS256"],
  });
}
