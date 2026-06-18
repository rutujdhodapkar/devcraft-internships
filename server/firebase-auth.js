import { admin } from "./firebase.js";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "__session";

async function exchangeGoogleCode(code, redirectUri) {
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await resp.json();
  if (!data.id_token) throw new Error("Failed to exchange Google code");
  return data;
}

export function initFirebaseAuth(app) {
  if (!admin.apps?.length) {
    console.warn("Firebase Admin not initialized — auth routes disabled");
    return;
  }

  const getBaseUrl = (req) =>
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

  const getClientUrl = () =>
    process.env.CLIENT_URL || "http://localhost:5173";

  // Google OAuth login (server-side redirect, no keys exposed to client)
  app.get("/api/auth/google", (req, res) => {
    const redirect = req.query.redirect || "/";
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ success: false, message: "GOOGLE_CLIENT_ID not configured on server" });
    }
    const callbackUrl = `${getBaseUrl(req)}/api/auth/callback`;
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${clientId}` +
      `&response_type=code` +
      `&scope=openid%20profile%20email` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&state=${encodeURIComponent(redirect)}`;
    res.redirect(authUrl);
  });

  // OAuth callback — exchange code, create Firebase user + session
  app.get("/api/auth/callback", async (req, res) => {
    const clientUrl = getClientUrl();
    const redirectTo = req.query.state || "/";
    const { code } = req.query;
    if (!code) return res.redirect(`${clientUrl}/?auth=failed`);

    try {
      const callbackUrl = `${getBaseUrl(req)}/api/auth/callback`;
      const tokens = await exchangeGoogleCode(code, callbackUrl);

      // Validate the Google ID token and extract user info
      const decoded = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64").toString(),
      );
      const { sub, email, name, picture } = decoded;

      // Find or create Firebase Auth user
      let uid = sub;
      try {
        const existing = await admin.auth().getUserByEmail(email);
        uid = existing.uid;
      } catch {
        await admin.auth().createUser({
          uid: sub,
          email,
          displayName: name || "",
          photoURL: picture || "",
        });
      }

      // Create a custom token → exchange for Firebase ID token → session cookie
      const customToken = await admin.auth().createCustomToken(uid);
      const apiKey = process.env.FIREBASE_WEB_API_KEY;

      if (apiKey) {
        const resp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: customToken, returnSecureToken: true }),
          },
        );
        const firebaseAuth = await resp.json();
        if (firebaseAuth.idToken) {
          const sessionCookie = await admin.auth().createSessionCookie(firebaseAuth.idToken, {
            expiresIn: SESSION_MAX_AGE,
          });
          res.cookie(COOKIE_NAME, sessionCookie, {
            httpOnly: true,
            secure: getBaseUrl(req).startsWith("https"),
            sameSite: "lax",
            maxAge: SESSION_MAX_AGE,
            path: "/",
          });
          return res.redirect(`${clientUrl}${redirectTo}`);
        }
      }

      // Fallback: store user info directly in JWT (no API key needed)
      const jwt = (await import("jsonwebtoken")).default;
      const token = jwt.sign(
        { uid, email, displayName: name || "", photoURL: picture || "" },
        process.env.JWT_SECRET || "devcraft-fallback-secret",
        { expiresIn: "7d" },
      );
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: getBaseUrl(req).startsWith("https"),
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
        path: "/",
      });
      res.redirect(`${clientUrl}${redirectTo}`);
    } catch (err) {
      console.error("Auth callback error:", err.message);
      res.redirect(`${clientUrl}/?auth=failed`);
    }
  });

  // Get current user from session cookie
  app.get("/api/auth/me", async (req, res) => {
    const sessionCookie = req.cookies?.[COOKIE_NAME];
    if (!sessionCookie) return res.json({ success: true, user: null });

    // Try Firebase session cookie first
    try {
      const decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
      return res.json({
        success: true,
        user: {
          uid: decoded.uid,
          email: decoded.firebase?.identities?.email?.[0] || decoded.email || "",
          displayName: decoded.name || "",
          photoURL: decoded.picture || "",
        },
      });
    } catch {}

    // Try JWT fallback
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const decoded = jwt.verify(sessionCookie, process.env.JWT_SECRET || "devcraft-fallback-secret");
      return res.json({ success: true, user: decoded });
    } catch {}

    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true, user: null });
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });
}
