// ── RTDB Manifest Writer ──
// Called by:
//   1. Azure Function (Cosmos Change Feed trigger)
//   2. Server admin write paths (inline, for immediate consistency)
//
// Writes version bumps to Firebase Realtime Database.
// RTDB is used ONLY for these tiny version manifests — no user data.

import { resolveCategory, isShared, isExternal, isDomain } from "./categories.js";

const RTDB_PATH = "manifest/versions";

let _rtdb = null;
let _rtdbInit = false;

async function getRtdb() {
  if (_rtdb) return _rtdb;
  if (_rtdbInit) return null;
  _rtdbInit = true;
  try {
    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    const { getDatabase } = await import("firebase-admin/database");
    if (!getApps().length) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!raw) { console.warn("[manifest] FIREBASE_SERVICE_ACCOUNT not configured"); return null; }
      initializeApp({ credential: cert(JSON.parse(raw)) });
    }
    _rtdb = getDatabase();
    console.log("[manifest] RTDB connected");
    return _rtdb;
  } catch (e) {
    console.warn("[manifest] RTDB init failed:", e.message);
    return null;
  }
}

function bumpTimestamp() {
  return Math.floor(Date.now() / 86400000).toString(36);
}

async function readVersions() {
  const db = await getRtdb();
  if (!db) return null;
  try {
    const snap = await db.ref(RTDB_PATH).once("value");
    return snap.val() || {};
  } catch { return null; }
}

async function writeVersions(versions) {
  const db = await getRtdb();
  if (!db) return;
  try { await db.ref(RTDB_PATH).set(versions); } catch {}
}

// ── Public API ──

export async function bumpSharedVersion(manifestKey) {
  const versions = await readVersions();
  if (!versions) return;
  versions[manifestKey] = bumpTimestamp();
  await writeVersions(versions);
}

export async function bumpDomainVersion(domainId) {
  const versions = await readVersions();
  if (!versions) return;
  versions[`domain:${domainId}`] = bumpTimestamp();
  await writeVersions(versions);
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

  // external & self: no RTDB version bump (handled via Cosmos field)
}

// ── Client-facing read helpers (used by cacheEngine / server) ──

export async function fetchSharedVersions() {
  return (await readVersions()) || {};
}

export async function fetchDomainVersion(domainId) {
  const versions = await readVersions();
  return versions?.[`domain:${domainId}`] || null;
}

export async function fetchDomainVersions(domainIds) {
  if (!domainIds || domainIds.length === 0) return {};
  const versions = await readVersions();
  if (!versions) return {};
  const results = {};
  for (const id of domainIds) {
    const v = versions[`domain:${id}`];
    if (v) results[id] = v;
  }
  return results;
}
