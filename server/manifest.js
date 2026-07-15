// ── Firestore Manifest Writer ──
// Called by:
//   1. Azure Function (Cosmos Change Feed trigger)
//   2. Server admin write paths (inline, for immediate consistency)
//
// Writes version bumps to Firestore manifests.
// Firebase Firestore is used ONLY for these tiny manifest docs — no user data.

import { initFirestore, firestoreGetDoc, firestoreSetDoc } from "./firestore.js";
import { resolveCategory, isShared, isExternal, isDomain } from "./categories.js";

const SHARED_MANIFEST_DOC = "manifest/shared-versions";
const DOMAIN_MANIFEST_COL = "manifest-domain-versions";

let _manifestCache = null;
let _cacheTs = 0;

function bumpTimestamp() {
  return Math.floor(Date.now() / 86400000).toString(36);
}

// ── Public API ──

export async function bumpSharedVersion(manifestKey) {
  const fs = await initFirestore();
  if (!fs) return;
  try {
    const doc = await firestoreGetDoc("manifest", "shared-versions");
    const versions = doc?.value || {};
    versions[manifestKey] = bumpTimestamp();
    await firestoreSetDoc("manifest", "shared-versions", { value: versions });
    _manifestCache = null;
  } catch (e) {
    console.error("[manifest] bumpSharedVersion failed:", e.message);
  }
}

export async function bumpDomainVersion(domainId) {
  const fs = await initFirestore();
  if (!fs) return;
  try {
    const docRef = fs.collection("manifest-domain-versions").doc(domainId);
    await docRef.set({ version: bumpTimestamp(), updatedAt: new Date().toISOString() }, { merge: true });
    _manifestCache = null;
  } catch (e) {
    console.error("[manifest] bumpDomainVersion failed:", e.message);
  }
}

// Called by the Change Feed Function when it detects a document change
export async function onDocumentChange(collection, docId, docData) {
  const info = resolveCategory(collection, docId, docData);
  if (!info) return;

  if (isShared(info.cat) && info.manifestKey) {
    await bumpSharedVersion(info.manifestKey);
    return;
  }

  if (isDomain(info.cat) && info.manifestKey) {
    await bumpDomainVersion(info.manifestKey);
    return;
  }

  if (isExternal(info.cat) && info.manifestKey) {
    // For external (admin/mentor) changes, bump per-user externalVersion
    // Handled via the user's Cosmos doc externalUpdateVersion field
    // No Firestore manifest needed — client reads the field directly
  }

  // SELF category: no version bump (optimistic local update)
}

// ── Client-facing read helpers ──

export async function fetchSharedVersions() {
  const doc = await firestoreGetDoc("manifest", "shared-versions");
  return doc?.value || {};
}

export async function fetchDomainVersion(domainId) {
  const doc = await firestoreGetDoc("manifest-domain-versions", domainId);
  return doc?.version || null;
}

export async function fetchDomainVersions(domainIds) {
  if (!domainIds || domainIds.length === 0) return {};
  const fs = await initFirestore();
  if (!fs) return {};
  const results = {};
  const chunks = [];
  for (let i = 0; i < domainIds.length; i += 30) {
    chunks.push(domainIds.slice(i, i + 30));
  }
  for (const chunk of chunks) {
    try {
      const snap = await fs.collection("manifest-domain-versions")
        .where("__name__", "in", chunk)
        .get();
      snap.forEach(d => { results[d.id] = d.data().version || null; });
    } catch { /* fire in, skip */ }
  }
  return results;
}
