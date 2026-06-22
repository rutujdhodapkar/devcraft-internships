// Reads from FIREBASE_SERVICE_ACCOUNT_KEY (env var) — no file path needed
// Usage: node scripts/migrate-to-firestore.js

import admin from "firebase-admin";

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY env var not set");
    process.exit(1);
  }
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

const sa = getServiceAccount();

admin.initializeApp({
  credential: admin.credential.cert(sa),
  databaseURL: "https://login-data-680b9-default-rtdb.firebaseio.com",
});
const rtdb = admin.database();
const firestore = admin.firestore();

function col(name) { return firestore.collection(name); }

async function readRTDB(path) {
  const snap = await rtdb.ref(path).get();
  return snap.exists() ? snap.val() : null;
}

async function migrateMap(rtdbPath, fsCollection) {
  const data = await readRTDB(rtdbPath);
  if (!data || typeof data !== "object") { console.log(`  Skipped ${rtdbPath}`); return 0; }
  const entries = Object.entries(data);
  let batch = firestore.batch();
  let count = 0;
  for (const [key, value] of entries) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      batch.set(col(fsCollection).doc(key), { id: key, ...value });
    } else {
      batch.set(col(fsCollection).doc(key), { id: key, value });
    }
    count++;
    if (count % 400 === 0) { await batch.commit(); batch = firestore.batch(); }
  }
  if (count % 400 !== 0) await batch.commit();
  console.log(`  ${count} docs → ${fsCollection}/`);
  return count;
}

async function main() {
  console.log("=== RTDB → Firestore Migration ===\n");
  let total = 0;

  total += await migrateMap("admins", "admins");
  total += await migrateMap("careerPaths", "careerPaths");

  const t = await readRTDB("config/templates");
  if (t) { await col("config").doc("templates").set(t); console.log("  config/templates"); total++; }

  const a = await readRTDB("config/aboutText");
  if (a) { await col("config").doc("aboutText").set(a); console.log("  config/aboutText"); total++; }

  const enrs = await readRTDB("enrollments");
  if (enrs) {
    let batch = firestore.batch(); let c = 0;
    for (const [id, e] of Object.entries(enrs)) { batch.set(col("enrollments").doc(id), { id, ...e }); c++; if (c % 400 === 0) { await batch.commit(); batch = firestore.batch(); } }
    if (c % 400 !== 0) await batch.commit();
    console.log(`  ${c} docs → enrollments/`); total += c;
  }

  total += await migrateMap("faqs", "faqs");
  total += await migrateMap("howItWorks", "howItWorks");

  const ru = await readRTDB("referralUsers");
  if (ru) {
    let batch = firestore.batch(); let c = 0;
    for (const [code, users] of Object.entries(ru)) {
      if (users && typeof users === "object") {
        for (const [uid, d] of Object.entries(users)) {
          const data = (typeof d === "object" && d !== null) ? d : {};
          batch.set(col("referralUsers").doc(`${code}_${uid}`), { ...data, code, uid });
          c++; if (c % 400 === 0) { await batch.commit(); batch = firestore.batch(); }
        }
      }
    }
    if (c % 400 !== 0) await batch.commit();
    console.log(`  ${c} docs → referralUsers/`); total += c;
  }

  total += await migrateMap("referralVisits", "referralVisits");
  total += await migrateMap("referrals", "referrals");
  total += await migrateMap("selfReferralOwners", "selfReferralOwners");
  total += await migrateMap("sentEmails", "sentEmails");
  total += await migrateMap("serviceRequests", "serviceRequests");
  total += await migrateMap("siteConfig", "siteConfig");
  total += await migrateMap("siteNotices", "siteNotices");
  total += await migrateMap("siteVisits", "siteVisits");
  total += await migrateMap("users", "users");
  total += await migrateMap("bannedUsers", "bannedUsers");
  total += await migrateMap("auditLog", "auditLog");
  total += await migrateMap("adminMessages", "adminMessages");
  total += await migrateMap("inquiries", "inquiries");
  total += await migrateMap("emailtamp", "emailtamp");

  const cp = await readRTDB("coupons");
  if (cp) { await col("coupons").doc("config").set({ value: cp, updatedAt: new Date().toISOString() }); console.log("  coupons/config"); total++; }

  const rc = await readRTDB("referralCodes");
  if (rc) { await col("referralCodes").doc("config").set({ value: rc }); console.log("  referralCodes/config"); total++; }

  console.log(`\n✓ Done! ${total} documents migrated.`);
  console.log("\nNext steps:");
  console.log("  1. Paste firestore.rules into Firebase Console → Firestore → Rules");
  console.log("  2. Set FIREBASE_SERVICE_ACCOUNT_KEY on Vercel (already set if RTDB works)");
  console.log("  3. Redeploy to Vercel");
  process.exit(0);
}

main().catch(e => { console.error("Failed:", e); process.exit(1); });
