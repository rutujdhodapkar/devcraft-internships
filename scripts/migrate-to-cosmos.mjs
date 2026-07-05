/**
 * Migration script: Firestore → Azure Cosmos DB
 *
 * Usage:
 *   1. Set env vars:
 *      FIREBASE_SERVICE_ACCOUNT_KEY (JSON string or path)
 *      COSMOS_DB_CONNECTION_STRING
 *   2. Run: node scripts/migrate-to-cosmos.mjs
 *
 * Collections migrated:
 *   enrollments, users, referrals, referralVisits, referralUsers,
 *   siteConfig, config, careerPaths, howItWorks, faqs, admins,
 *   bannedUsers, adminMessages, siteNotices, auditLog, emailTemplates,
 *   emailSubscriptions, emailLogs, emailAutomationLog, selfReferralOwners,
 *   inquiries, siteVisits, deviceUsers
 */

import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CosmosClient } from "@azure/cosmos";

const COLLECTIONS = [
  "enrollments", "users", "referrals", "referralVisits", "referralUsers",
  "siteConfig", "config", "careerPaths", "howItWorks", "faqs", "admins",
  "bannedUsers", "adminMessages", "siteNotices", "auditLog", "emailTemplates",
  "emailSubscriptions", "emailLogs", "emailAutomationLog", "selfReferralOwners",
  "inquiries", "siteVisits", "deviceUsers",
];

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    || process.env.FIREBASE_SERVICE_ACCOUNT
    || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (raw) {
    if (raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw);
      if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      return parsed;
    }
    // Could be a file path
    try {
      const content = readFileSync(raw, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      return parsed;
    } catch {}
    // Could be base64
    try {
      const json = Buffer.from(raw, "base64").toString("utf8");
      const parsed = JSON.parse(json);
      if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      return parsed;
    } catch {}
  }
  // Try file path from env
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    try {
      const content = readFileSync(keyPath, "utf-8");
      const parsed = JSON.parse(content);
      return parsed;
    } catch (e) {
      console.error("Failed to read GOOGLE_APPLICATION_CREDENTIALS:", e.message);
    }
  }
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY not set");
  process.exit(1);
}

function cleanDoc(doc) {
  const { entityType, _rid, _self, _etag, _attachments, _ts, ...rest } = doc;
  return rest;
}

async function main() {
  // Init Firestore
  const sa = getServiceAccount();
  const apps = getApps();
  const app = apps.length ? apps[0] : initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const databaseId = process.env.FIRESTORE_DATABASE_ID || 'intern';
  const firestore = getFirestore(app, databaseId);

  // Init Cosmos DB
  const connStr = process.env.COSMOS_DB_CONNECTION_STRING;
  if (!connStr) {
    console.error("COSMOS_DB_CONNECTION_STRING not set");
    process.exit(1);
  }
  const dbName = process.env.COSMOS_DB_DATABASE || "devcraft";
  const containerName = process.env.COSMOS_DB_CONTAINER || "main";
  const client = new CosmosClient(connStr);

  // Create database if not exists
  const { database } = await client.databases.createIfNotExists({ id: dbName });

  // Ensure container exists with entityType as partition key
  const { container } = await database.containers.createIfNotExists({
    id: containerName,
    partitionKey: { paths: ["/entityType"] },
  });

  let totalMigrated = 0;
  let totalErrors = 0;

  for (const collection of COLLECTIONS) {
    process.stdout.write(`Migrating ${collection}... `);
    try {
      const snap = await firestore.collection(collection).get();
      if (snap.empty) {
        console.log("0 docs (empty)");
        continue;
      }

      let count = 0;
      const batch = [];
      for (const doc of snap.docs) {
        const docData = doc.data();
        const item = { ...docData, id: doc.id, entityType: collection };
        batch.push(item);
        count++;
      }

      // Upsert in batches of 100 (Cosmos DB supports up to 100 items per batch)
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        await Promise.all(chunk.map(item =>
          container.items.upsert(item).catch(e => {
            console.error(`\n  Error upserting ${collection}/${item.id}: ${e.message}`);
            totalErrors++;
          })
        ));
      }

      totalMigrated += count;
      console.log(`${count} docs migrated`);
    } catch (e) {
      console.error(`FAILED: ${e.message}`);
      totalErrors++;
    }
  }

  console.log(`\nMigration complete: ${totalMigrated} docs migrated, ${totalErrors} errors`);
}

main().catch(console.error);
