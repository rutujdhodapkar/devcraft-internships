// ── Azure Function: Cosmos DB Change Feed Trigger ──
// Fires on every write to the Cosmos "main" container.
// Routes by document category and bumps the appropriate Firestore manifest.
//
// Retry: exponential backoff (configured in function.json)
// Dead-letter: failed Firestore writes are logged to Azure Monitor
//              + written to the dead-letter container for manual replay.

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Category Resolution ──
// Mirrors server/categories.js — duplicated here so the Function is self-contained.

const CATEGORY = {
  "siteConfig/careerPaths":           { cat: "SHARED",  key: "careerPaths" },
  "siteConfig/courses":               { cat: "SHARED",  key: "courses" },
  "siteConfig/homepageLayout":        { cat: "SHARED",  key: "homepageLayout" },
  "siteConfig/headerSettings":        { cat: "SHARED",  key: "headerSettings" },
  "siteConfig/theme":                 { cat: "SHARED",  key: "theme" },
  "siteConfig/footer":                { cat: "SHARED",  key: "footer" },
  "siteConfig/popup":                 { cat: "SHARED",  key: "popup" },
  "siteConfig/homepage":              { cat: "SHARED",  key: "homepage" },
  "siteConfig/howItWorks":            { cat: "SHARED",  key: "howItWorks" },
  "siteConfig/faqs":                  { cat: "SHARED",  key: "faqs" },
  "siteConfig/whatDoYouGet":          { cat: "SHARED",  key: "whatDoYouGet" },
  "siteConfig/universityCollab":      { cat: "SHARED",  key: "universityCollab" },
  "siteConfig/logoLoop":              { cat: "SHARED",  key: "logoLoop" },
  "siteConfig/slidingStrips":         { cat: "SHARED",  key: "slidingStrips" },
  "siteConfig/domainCategories":      { cat: "SHARED",  key: "domainCategories" },
  "siteConfig/terms":                 { cat: "SHARED",  key: "terms" },
  "siteConfig/privacy":               { cat: "SHARED",  key: "privacy" },
  "siteConfig/refund":                { cat: "SHARED",  key: "refund" },
  "siteConfig/paymentSettings":       { cat: "SHARED",  key: "paymentSettings" },
  "siteConfig/dodoConfig":            { cat: "SHARED",  key: "dodoConfig" },
  "siteConfig/earnSettings":          { cat: "SHARED",  key: "earnSettings" },
  "siteConfig/earnDetails":           { cat: "SHARED",  key: "earnDetails" },
  "siteConfig/payoutConfig":          { cat: "SHARED",  key: "payoutConfig" },
  "siteConfig/userTypes":             { cat: "SHARED",  key: "userTypes" },
  "siteConfig/organization":          { cat: "SHARED",  key: "organization" },
  "siteConfig/paymentMethods":        { cat: "SHARED",  key: "paymentMethods" },
  "siteConfig/emailConfig":           { cat: "SHARED",  key: "emailConfig" },
  "siteConfig/rootAdmin":             { cat: "SHARED",  key: "rootAdmin" },
  "siteConfig/revenueHistory":        { cat: "SHARED",  key: "revenueHistory" },
  "config/templates":                 { cat: "SHARED",  key: "templates" },
  "config/aboutText":                 { cat: "SHARED",  key: "aboutText" },
  "careerPaths":                      { cat: "SHARED",  key: "careerPaths" },
  "howItWorks":                       { cat: "SHARED",  key: "howItWorks" },
  "faqs":                             { cat: "SHARED",  key: "faqs" },
  "emailTemplates":                   { cat: "SHARED",  key: "emailTemplates" },
  "admins":                           { cat: "SHARED",  key: "admins" },
  "bannedUsers":                      { cat: "SHARED",  key: "bannedUsers" },
  "adminMessages":                    { cat: "SHARED",  key: "adminMessages" },
  "siteNotices":                      { cat: "SHARED",  key: "siteNotices" },
  "agencies":                         { cat: "SHARED",  key: "agencies" },
  "referrals":                        { cat: "SHARED",  key: "referrals" },
};

// ── Helpers ──

let _firestore = null;

function getFirestoreDb() {
  if (_firestore) return _firestore;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
  const sa = JSON.parse(raw);
  if (!getApps().length) initializeApp({ credential: cert(sa) });
  _firestore = getFirestore("intern");
  return _firestore;
}

function bumpTs() {
  return Date.now().toString(36);
}

function resolveCategory(collection, docId, docData) {
  const staticKey = `${collection}/${docId}`;
  if (CATEGORY[staticKey]) return CATEGORY[staticKey];
  for (const [key, val] of Object.entries(CATEGORY)) {
    if (val.keyPrefix && staticKey.startsWith(key)) return val;
  }
  if (collection === "enrollments") {
    const isSelfEdit = docData?._updatedBy === docData?.uid;
    if (isSelfEdit) return { cat: "SELF" };
    if (docData?.domainId || docData?.domain) {
      const domainId = docData.domainId || docData.domain?.toLowerCase().replace(/\s+/g, "_");
      return { cat: "DOMAIN", key: domainId };
    }
    return { cat: "EXTERNAL", key: `enrollment:${docId}` };
  }
  if (collection === "users") {
    const isSelfEdit = docData?._updatedBy === docId;
    if (isSelfEdit) return { cat: "SELF" };
    return { cat: "EXTERNAL", key: `user:${docId}` };
  }
  return { cat: "SELF" };
}

// ── Dead-letter helpers ──

const DEAD_LETTER_CONTAINER = "deadLetter";
let _deadLetterContainer = null;

async function getDeadLetterContainer() {
  if (_deadLetterContainer) return _deadLetterContainer;
  const { CosmosClient } = await import("@azure/cosmos");
  const connStr = process.env.COSMOS_DB_CONNECTION_STRING;
  const client = new CosmosClient(connStr);
  const db = client.database(process.env.COSMOS_DB_DATABASE || "devcraft");
  const { container } = await db.containers.createIfNotExists({ id: DEAD_LETTER_CONTAINER });
  _deadLetterContainer = container;
  return container;
}

async function writeDeadLetter(doc, operation, error) {
  try {
    const dlc = await getDeadLetterContainer();
    await dlc.items.create({
      id: `${doc.id}_${Date.now()}`,
      entityType: "deadLetter",
      docId: doc.id,
      collection: doc.entityType,
      operation,
      error: error.message || String(error),
      rawDoc: doc,
      failedAt: new Date().toISOString(),
      retryCount: 0,
    });
  } catch (dlErr) {
    console.error("[dead-letter] Failed to write dead-letter:", dlErr.message);
  }
}

// ── Main Function ──

export default async function cosmosChangeFeed(documents, context) {
  // context.log is the Azure Functions logger
  const log = context?.log || console.log;

  if (!documents || documents.length === 0) {
    log("[change-feed] No documents in batch");
    return;
  }

  log(`[change-feed] Processing ${documents.length} document(s)`);

  let firestore;
  try {
    firestore = getFirestoreDb();
  } catch (e) {
    log(`[change-feed] Firebase init failed: ${e.message}`);
    for (const doc of documents) {
      await writeDeadLetter(doc, "firebase_init", e);
    }
    throw e;
  }

  // Batch bumps per category to minimize Firestore writes
  const sharedBumps = {};
  const domainBumps = {};
  const externalUserIds = [];

  for (const doc of documents) {
    const collection = doc.entityType || "siteConfig";
    const docId = doc.id;
    const info = resolveCategory(collection, docId, doc);

    if (!info || info.cat === "SELF") continue;

    log(`[change-feed] cat=${info.cat} key=${info.key || "-"} col=${collection} id=${docId}`);

    if (info.cat === "SHARED" && info.key) {
      sharedBumps[info.key] = bumpTs();
    }

    if (info.cat === "DOMAIN" && info.key) {
      domainBumps[info.key] = bumpTs();
    }

    if (info.cat === "EXTERNAL" && info.key?.startsWith("enrollment:") && doc.uid) {
      externalUserIds.push(doc.uid);
    }
    if (info.cat === "EXTERNAL" && info.key?.startsWith("user:") && docId) {
      externalUserIds.push(docId);
    }
  }

  // ── Write shared version bumps ──
  if (Object.keys(sharedBumps).length > 0) {
    try {
      const snap = await firestore.collection("manifest").doc("shared-versions").get();
      const existing = snap.exists ? snap.data()?.value || {} : {};
      const merged = { ...existing, ...sharedBumps };
      await firestore.collection("manifest").doc("shared-versions").set({ value: merged });
      log(`[change-feed] Shared versions bumped: ${Object.keys(sharedBumps).join(", ")}`);
    } catch (e) {
      log(`[change-feed] Shared version write failed: ${e.message}`);
      for (const doc of documents) {
        await writeDeadLetter(doc, "shared_version_write", e);
      }
    }
  }

  // ── Write domain version bumps ──
  if (Object.keys(domainBumps).length > 0) {
    const batch = firestore.batch();
    for (const [domainId, ts] of Object.entries(domainBumps)) {
      const ref = firestore.collection("manifest-domain-versions").doc(domainId);
      batch.set(ref, { version: ts, updatedAt: new Date().toISOString() }, { merge: true });
    }
    try {
      await batch.commit();
      log(`[change-feed] Domain versions bumped: ${Object.keys(domainBumps).join(", ")}`);
    } catch (e) {
      log(`[change-feed] Domain version batch write failed: ${e.message}`);
      for (const doc of documents) {
        await writeDeadLetter(doc, "domain_version_write", e);
      }
    }
  }

  // ── External user version bumps (write to Cosmos user doc) ──
  if (externalUserIds.length > 0) {
    const uniqueIds = [...new Set(externalUserIds)];
    const { CosmosClient } = await import("@azure/cosmos");
    const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
    const container = client.database(process.env.COSMOS_DB_DATABASE || "devcraft")
      .container(process.env.COSMOS_DB_CONTAINER || "main");

    for (const uid of uniqueIds) {
      try {
        const { resource } = await container.item(uid, "users").read();
        const current = resource?.externalUpdateVersion || 0;
        await container.item(uid, "users").patch([
          { op: "set", path: "/externalUpdateVersion", value: current + 1 },
        ]);
        log(`[change-feed] externalUpdateVersion bumped for user ${uid} -> ${current + 1}`);
      } catch (e) {
        log(`[change-feed] Failed to bump externalUpdateVersion for ${uid}: ${e.message}`);
        // Non-critical — will be retried on next change
      }
    }
  }

  log("[change-feed] Batch complete");
}
