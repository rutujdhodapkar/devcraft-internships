// ── Data Categorization Map ──
// Every Cosmos document path maps to a category. Used by the Change Feed
// Function and server write paths to decide how version manifests are bumped.
//
// Categories:
//   SHARED   — identical for all users; versioned per key in manifest/shared-versions
//   SELF     — user's own writes; no version bump needed (optimistic local update)
//   EXTERNAL — changed by admin/mentor without user action; versioned per user field
//   DOMAIN   — domain-scoped data; versioned per domain in manifest/domain-versions/{id}

const CATEGORY = {
  // ── SHARED: Site config, content, listings ──
  "siteConfig/careerPaths":           { cat: "SHARED",  manifestKey: "careerPaths" },
  "siteConfig/courses":               { cat: "SHARED",  manifestKey: "courses" },
  "siteConfig/courseContent_":        { cat: "SHARED",  manifestKey: "courseContent", keyPrefix: true },
  "siteConfig/domainCategories":      { cat: "SHARED",  manifestKey: "domainCategories" },
  "siteConfig/homepage":              { cat: "SHARED",  manifestKey: "homepage" },
  "siteConfig/homepageLayout":        { cat: "SHARED",  manifestKey: "homepageLayout" },
  "siteConfig/headerSettings":        { cat: "SHARED",  manifestKey: "headerSettings" },
  "siteConfig/theme":                 { cat: "SHARED",  manifestKey: "theme" },
  "siteConfig/footer":                { cat: "SHARED",  manifestKey: "footer" },
  "siteConfig/popup":                 { cat: "SHARED",  manifestKey: "popup" },
  "siteConfig/howItWorks":            { cat: "SHARED",  manifestKey: "howItWorks" },
  "siteConfig/faqs":                  { cat: "SHARED",  manifestKey: "faqs" },
  "siteConfig/whatDoYouGet":          { cat: "SHARED",  manifestKey: "whatDoYouGet" },
  "siteConfig/universityCollab":      { cat: "SHARED",  manifestKey: "universityCollab" },
  "siteConfig/logoLoop":              { cat: "SHARED",  manifestKey: "logoLoop" },
  "siteConfig/slidingStrips":         { cat: "SHARED",  manifestKey: "slidingStrips" },
  "siteConfig/terms":                 { cat: "SHARED",  manifestKey: "terms" },
  "siteConfig/privacy":               { cat: "SHARED",  manifestKey: "privacy" },
  "siteConfig/refund":                { cat: "SHARED",  manifestKey: "refund" },
  "siteConfig/paymentSettings":       { cat: "SHARED",  manifestKey: "paymentSettings" },
  "siteConfig/dodoConfig":            { cat: "SHARED",  manifestKey: "dodoConfig" },
  "siteConfig/earnSettings":          { cat: "SHARED",  manifestKey: "earnSettings" },
  "siteConfig/earnDetails":           { cat: "SHARED",  manifestKey: "earnDetails" },
  "siteConfig/payoutConfig":          { cat: "SHARED",  manifestKey: "payoutConfig" },
  "siteConfig/userTypes":             { cat: "SHARED",  manifestKey: "userTypes" },
  "siteConfig/organization":          { cat: "SHARED",  manifestKey: "organization" },
  "siteConfig/paymentMethods":        { cat: "SHARED",  manifestKey: "paymentMethods" },
  "siteConfig/emailConfig":           { cat: "SHARED",  manifestKey: "emailConfig" },
  "siteConfig/configVersions":        { cat: "SHARED",  manifestKey: "configVersions" },
  "siteConfig/rootAdmin":             { cat: "SHARED",  manifestKey: "rootAdmin" },
  "siteConfig/revenueHistory":        { cat: "SHARED",  manifestKey: "revenueHistory" },
  "config/templates":                 { cat: "SHARED",  manifestKey: "templates" },
  "config/aboutText":                 { cat: "SHARED",  manifestKey: "aboutText" },
  "careerPaths":                      { cat: "SHARED",  manifestKey: "careerPaths" },
  "howItWorks":                       { cat: "SHARED",  manifestKey: "howItWorks" },
  "faqs":                             { cat: "SHARED",  manifestKey: "faqs" },
  "badges":                           { cat: "SHARED",  manifestKey: "badges" },
  "emailTemplates":                   { cat: "SHARED",  manifestKey: "emailTemplates" },

  // ── DOMAIN-SCOPED: per-domain task data ──
  // enrollments where type === "course" or domainId present
  // Individual enrollment docs are handled dynamically in the resolver

  // ── PERSONAL - self-writable: user's own task submissions ──
  // enrollments: task submission edits by the owning user
  // users: profile updates by the user

  // ── PERSONAL - externally-writable: mentor/cloud fn changes ──
  // enrollments: verification status, cert eligibility, payment status
  // users: ban status
  // userBadges: badge awards
};

// Dynamic resolver for paths with variable segments (enrollments/{id}, users/{id}, etc.)
export function resolveCategory(collection, docId, docData) {
  const staticKey = `${collection}/${docId}`;
  if (CATEGORY[staticKey]) return CATEGORY[staticKey];

  // Prefix matching for siteConfig/courseContent_{id}
  for (const [key, val] of Object.entries(CATEGORY)) {
    if (val.keyPrefix && staticKey.startsWith(key)) return val;
  }

  // Dynamic collections
  if (collection === "enrollments") {
    const isTaskEdit = docData?._updatedBy === docData?.uid;
    if (isTaskEdit) return { cat: "SELF", manifestKey: null };
    return { cat: "EXTERNAL", manifestKey: `enrollment:${docId}` };
  }

  if (collection === "users") {
    const isSelfEdit = docData?._updatedBy === docId;
    if (isSelfEdit) return { cat: "SELF", manifestKey: null };
    return { cat: "EXTERNAL", manifestKey: `user:${docId}` };
  }

  if (collection === "enrollments") {
    // Domain-scoped if it has a domainId — version per domain
    if (docData?.domainId || docData?.domain) {
      const domainId = docData.domainId || docData.domain?.toLowerCase().replace(/\s+/g, "_");
      return { cat: "DOMAIN", manifestKey: domainId };
    }
  }

  if (collection === "userBadges") return { cat: "EXTERNAL", manifestKey: `userBadge:${docId}` };
  if (collection === "referrals") return { cat: "SHARED", manifestKey: "referrals" };
  if (collection === "admins") return { cat: "SHARED", manifestKey: "admins" };
  if (collection === "bannedUsers") return { cat: "SHARED", manifestKey: "bannedUsers" };
  if (collection === "adminMessages") return { cat: "SHARED", manifestKey: "adminMessages" };
  if (collection === "siteNotices") return { cat: "SHARED", manifestKey: "siteNotices" };
  if (collection === "agencies") return { cat: "SHARED", manifestKey: "agencies" };

  // Default: treat as self-writable (no version bump)
  return { cat: "SELF", manifestKey: null };
}

export function isShared(cat) { return cat === "SHARED"; }
export function isExternal(cat) { return cat === "EXTERNAL"; }
export function isDomain(cat) { return cat === "DOMAIN"; }
export function isSelf(cat) { return cat === "SELF"; }
