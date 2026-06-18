import admin from "firebase-admin";

let raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const databaseURL = process.env.FIREBASE_DATABASE_URL || "https://login-data-680b9-default-rtdb.firebaseio.com";

// Support both raw JSON and base64-encoded JSON
if (raw && !raw.trim().startsWith("{")) {
  try {
    raw = Buffer.from(raw, "base64").toString("utf-8");
  } catch {}
}

let fbApp = null;
let fbRtdb = null;

if (raw) {
  try {
    const serviceAccount = JSON.parse(raw);
    fbApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
    });
    fbRtdb = fbApp.database();
    console.log("Firebase Admin initialized successfully");
  } catch (err) {
    console.error("Firebase Admin init failed:", err.message);
  }
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT_KEY not set — Firebase API routes will return errors");
}

export { admin, fbApp, fbRtdb };
