// Shared authentication for MCP servers and API routes.
// Resolves an identity from (in priority order):
//   1. MCP_LOCAL_TRUSTED=1  -> local/dev trusted caller (opencode stdio)
//   2. MCP_DOMAINS_ADMIN_SECRET (env) -> admin
//   3. MCP_API_KEY (env) -> service/admin (machine-to-machine)
//   4. JWT bearer signed with CRYPTO_SECRET -> role from payload
//   5. Firebase idToken (admin_token / user_token / bearer) -> admin or user
// No hardcoded fallback secrets: missing env => auth simply fails closed.

import { createHmac, timingSafeEqual } from "node:crypto";

export const ROOT_ADMIN_EMAIL = "rutujdhodapkar@gmail.com";

export function isLocalTrusted() {
  return process.env.MCP_LOCAL_TRUSTED === "1" || process.env.MCP_LOCAL_TRUSTED === "true";
}

// ── Firebase idToken verification (server-side lookup, no default key) ──
export async function verifyFirebaseToken(idToken) {
  if (!idToken) return null;
  const apiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    const data = await res.json();
    if (!data.users || !data.users.length) return null;
    const u = data.users[0];
    return { uid: u.localId, email: u.email, name: u.displayName, picture: u.photoUrl };
  } catch {
    return null;
  }
}

export async function isFirebaseAdmin(email) {
  if (!email) return false;
  if (email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase()) return true;
  try {
    const { initCosmosDb } = await import("./cosmos.js");
    const db = await initCosmosDb();
    if (!db) return false;
    const snap = await db
      .collection("admins")
      .doc(String(email).toLowerCase().replace(/\./g, ","))
      .get();
    return snap.exists;
  } catch {
    return false;
  }
}

// ── JWT (HS256) signed with CRYPTO_SECRET ──
function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function getCryptoSecret() {
  const s = process.env.CRYPTO_SECRET;
  if (!s) throw new Error("CRYPTO_SECRET is not configured");
  return s;
}

export function signJwt(payload, opts = {}) {
  const secret = getCryptoSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: payload.iat || now,
    exp: payload.exp || now + (opts.expiresIn || 86400),
  };
  const data = `${b64urlJson(header)}.${b64urlJson(body)}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const secret = getCryptoSecret();
  const [h, p, s] = parts;
  let expected;
  try {
    expected = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  } catch {
    return null;
  }
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(p, "base64url").toString());
    if (body.exp && Math.floor(Date.now() / 1000) > body.exp) return null;
    return body;
  } catch {
    return null;
  }
}

// ── Central identity resolver ──
export async function resolveIdentity(creds = {}) {
  const { bearer, user_token, admin_token, admin_secret, api_key } = creds;

  if (isLocalTrusted()) {
    return { email: "local@devcraft.local", role: "admin", source: "local" };
  }

  const adminSecret = process.env.MCP_DOMAINS_ADMIN_SECRET;
  if (adminSecret && admin_secret && admin_secret === adminSecret) {
    return { email: "admin@devcraft.local", role: "admin", source: "admin_secret" };
  }

  const apiKey = process.env.MCP_API_KEY;
  if (apiKey && api_key) {
    const a = Buffer.from(api_key);
    const b = Buffer.from(apiKey);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { email: "service@devcraft.local", role: "admin", source: "api_key" };
    }
  }

  // JWT (bearer or any token-shaped arg)
  const jwtRaw = bearer || admin_token || user_token;
  if (jwtRaw) {
    let jwt = null;
    try {
      jwt = verifyJwt(jwtRaw);
    } catch {
      jwt = null;
    }
    if (jwt) return { email: jwt.email, role: jwt.role || "user", source: "jwt", jwt };
  }

  // Firebase admin
  if (admin_token) {
    const u = await verifyFirebaseToken(admin_token);
    if (u?.email && (await isFirebaseAdmin(u.email))) {
      return { email: u.email, role: "admin", source: "firebase" };
    }
  }

  // Firebase user
  const fbToken = user_token || bearer;
  if (fbToken && fbToken !== jwtRaw) {
    const u = await verifyFirebaseToken(fbToken);
    if (u?.email) return { email: u.email, role: "user", source: "firebase", firebase: u };
  }

  return null;
}

export async function requireIdentity(creds = {}) {
  const id = await resolveIdentity(creds);
  if (!id) throw new Error("Unauthorized: valid authentication required.");
  return id;
}

// Is the given email allowed to use MCP at all (admin or approved user)?
export async function isAuthorizedEmail(email) {
  if (!email) return false;
  if (await isFirebaseAdmin(email)) return true;
  try {
    const { initCosmosDb } = await import("./cosmos.js");
    const db = await initCosmosDb();
    if (!db) return false;
    const snap = await db.collection("mcpAuthorizedUsers").get();
    return snap.docs.some(
      (d) => (d.data().email || "").toLowerCase() === String(email).toLowerCase()
    );
  } catch {
    return false;
  }
}
