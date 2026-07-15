// ── Manifest Version Bumps ──
// Called by the Azure Function (Cosmos Change Feed trigger) and
// server admin write paths. Currently a no-op — Cosmos configVersions
// is the single source of truth for shared versions. Per-domain and
// per-user versions are handled inline in the API layer.

import { resolveCategory, isShared, isExternal, isDomain } from "./categories.js";

export async function bumpSharedVersion(_manifestKey) {}
export async function bumpDomainVersion(_domainId) {}

export async function onDocumentChange(collection, docId, docData) {
  const info = resolveCategory(collection, docId, docData);
  if (!info) return;
  // Cosmos configVersions is the source of truth — no secondary manifest needed.
}

export async function fetchSharedVersions() { return {}; }
export async function fetchDomainVersion(_domainId) { return null; }
export async function fetchDomainVersions(_domainIds) { return {}; }
