import { initCosmosDb } from "../server/cosmos.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

const envContent = readFileSync(resolve(__dirname, "../server/.env"), "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^\s*(\w+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const db = await initCosmosDb();
if (!db) { console.log("Failed to connect"); process.exit(1); }

for (const key of ["terms", "privacy", "refund"]) {
  const snap = await db.collection("siteConfig").doc(key).get();
  const val = snap.exists ? snap.data()?.value : null;
  console.log(`\n=== ${key} ===`);
  console.log("exists:", snap.exists);
  console.log("value type:", typeof val);
  console.log("value:", JSON.stringify(val).slice(0, 300));
}
console.log("\nDone");
process.exit(0);
