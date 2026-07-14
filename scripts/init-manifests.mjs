// Initialize Firestore manifests for the version-diff caching system.
// Run: FIREBASE_SERVICE_ACCOUNT='{...json...}' node scripts/init-manifests.mjs

const SHARED_FIELDS = [
  "careerPaths", "courses", "courseContent", "domainCategories",
  "homepage", "homepageLayout", "headerSettings", "theme", "footer", "popup",
  "howItWorks", "faqs", "whatDoYouGet", "universityCollab", "logoLoop", "slidingStrips",
  "terms", "privacy", "refund",
  "paymentSettings", "dodoConfig",
  "earnSettings", "earnDetails", "payoutConfig", "userTypes",
  "organization", "paymentMethods", "emailConfig", "rootAdmin", "revenueHistory",
  "templates", "aboutText",
  "emailTemplates",
  "admins", "bannedUsers", "adminMessages", "siteNotices", "agencies", "referrals",
];

async function init() {
  const { initFirestore } = await import("../server/firestore.js");
  const fs = await initFirestore();
  if (!fs) {
    console.error("Firestore not available. Set FIREBASE_SERVICE_ACCOUNT env var.");
    process.exit(1);
  }

  // Create shared-versions manifest
  const versions = {};
  const now = Date.now().toString(36);
  for (const field of SHARED_FIELDS) {
    versions[field] = now;
  }

  await fs.collection("manifest").doc("shared-versions").set({
    value: versions,
    createdAt: new Date().toISOString(),
  });
  console.log(`✓ manifest/shared-versions created with ${SHARED_FIELDS.length} fields`);

  // Create domain-versions collection (no initial docs — created on first change)
  console.log("✓ manifest-domain-versions collection ready (empty)");

  // Set security rules
  console.log("\n⚠  Deploy security rules from firestore-manifest/manifest.rules");
  console.log("   Firestore Console → Rules → Copy & Paste rules file content");

  process.exit(0);
}

init().catch(e => { console.error(e); process.exit(1); });
