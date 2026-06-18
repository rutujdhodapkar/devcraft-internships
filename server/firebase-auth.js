import { admin } from "./firebase.js";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "__session";

export function initFirebaseAuth(app) {
  if (!admin.apps?.length) {
    console.warn("Firebase Admin not initialized — auth routes disabled");
    return;
  }

  const getBaseUrl = (req) =>
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

  // POST /api/auth/session — verify Firebase ID token, create session cookie
  app.post("/api/auth/session", async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: "idToken required" });
    }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);

      const uid = decoded.uid;
      const email = decoded.email || "";
      const displayName = decoded.name || decoded.displayName || "";
      const photoURL = decoded.picture || decoded.photoURL || "";

      const apiKey = process.env.FIREBASE_WEB_API_KEY;
      if (apiKey) {
        const resp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }),
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
          return res.json({ success: true, user: { uid, email, displayName, photoURL } });
        }
      }

      // Fallback: JWT cookie
      const jwt = (await import("jsonwebtoken")).default;
      const token = jwt.sign(
        { uid, email, displayName, photoURL },
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
      res.json({ success: true, user: { uid, email, displayName, photoURL } });
    } catch (err) {
      console.error("Session creation error:", err.message);
      res.status(401).json({ success: false, message: "Invalid token" });
    }
  });

  // GET /api/auth/me — get current user from session cookie
  app.get("/api/auth/me", async (req, res) => {
    const sessionCookie = req.cookies?.[COOKIE_NAME];
    if (!sessionCookie) return res.json({ success: true, user: null });

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

    try {
      const jwt = (await import("jsonwebtoken")).default;
      const decoded = jwt.verify(sessionCookie, process.env.JWT_SECRET || "devcraft-fallback-secret");
      return res.json({ success: true, user: decoded });
    } catch {}

    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true, user: null });
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });
}
