// client/src/services/cacheSync.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side cache-sync layer backed by IndexedDB, with a localStorage/in-memory
// fallback for environments where IndexedDB is unavailable (e.g. Safari private
// mode). Network reads are gated by a per-user, per-bucket version check so only
// changed buckets are re-fetched; unchanged buckets serve straight from cache.
//
// Version stamps are PER USER (the server keeps one stamp doc per `userId`), so a
// write by user A advances only A's stamps and never invalidates user B's cache.
// The version check is a single point read; on failure we serve cache and retry
// silently on the next load.
//
// Failure handling (no data loss, no blank flash):
//   • version fetch fails      → serve cache where present, else fetch once; retry next load
//   • bucket fetch fails        → serve stale cache + console.warn; keep last good version
//   • force refresh (?refresh=1 or window.__DEVCRAFT_FORCE_SYNC) → re-fetch everything
//
// Bucket model:
//   tasks            -> large/volatile (task history / enrollments)  own version
//   certs            -> large/volatile (certificate records)         own version
//   badges_combined  -> small/low-churn (badges + userBadges + streaks + flags)
//                       merged into ONE bucket with a shared version
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_SERVER_URL || "https://devcraft.fennark.xyz").replace(/\/api\/?$/, "");

const DB_NAME = "devcraft_cache";
const DB_VERSION = 1;
const STORE_DATA = "buckets"; // key: `${bucket}:${key}`  value: { data, savedAt }
const STORE_META = "versions"; // key: bucket name        value: version string

// In-memory fallback maps (used when IndexedDB is unavailable)
const _mem = new Map();
const _memMeta = new Map();

let _dbPromise = null;
let _idbAvailable = null; // null = unknown, true/false once probed

// ── IndexedDB availability probe ─────────────────────────────────────────────
async function probeIdb() {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        try { req.result.close(); } catch {}
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE_DATA)) d.createObjectStore(STORE_DATA);
        if (!d.objectStoreNames.contains(STORE_META)) d.createObjectStore(STORE_META);
      };
    });
    return !!db;
  } catch {
    return false;
  }
}

async function usingIdb() {
  if (_idbAvailable === null) {
    try { _idbAvailable = await probeIdb(); } catch { _idbAvailable = false; }
  }
  return _idbAvailable;
}

async function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE_DATA)) d.createObjectStore(STORE_DATA);
      if (!d.objectStoreNames.contains(STORE_META)) d.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

// ── Generic key/value helpers (IndexedDB with fallback) ───────────────────────
function lsKey(store, key) {
  return `cs_${store}_${key}`;
}

async function kvGet(store, key) {
  if (await usingIdb()) {
    try {
      const db = await openDB();
      return await new Promise((resolve) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
    } catch {
      /* fall through to fallback */
    }
  }
  try {
    const raw = localStorage.getItem(lsKey(store, key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return _mem.get(lsKey(store, key)) ?? null;
  }
}

async function kvSet(store, key, value) {
  if (await usingIdb()) {
    try {
      const db = await openDB();
      await new Promise((resolve) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return;
    } catch {
      /* fall through to fallback */
    }
  }
  try {
    localStorage.setItem(lsKey(store, key), JSON.stringify(value));
  } catch {
    _mem.set(lsKey(store, key), value);
  }
}

async function kvDel(store, key) {
  if (await usingIdb()) {
    try {
      const db = await openDB();
      await new Promise((resolve) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}
  }
  try { localStorage.removeItem(lsKey(store, key)); } catch {}
  _mem.delete(lsKey(store, key));
}

// List keys in a store (used to clear a whole bucket). Returns array of raw keys.
async function kvKeys(store) {
  if (await usingIdb()) {
    try {
      const db = await openDB();
      return await new Promise((resolve) => {
        const keys = [];
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).openKeyCursor();
        req.onsuccess = () => {
          if (req.result) { keys.push(req.result.key); req.result.continue(); }
          else resolve(keys);
        };
        req.onerror = () => resolve(keys);
      });
    } catch {}
  }
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`cs_${store}_`)) out.push(k.slice(`cs_${store}_`.length));
    }
  } catch {}
  if (out.length === 0) {
    for (const k of _mem.keys()) {
      const prefix = `cs_${store}_`;
      if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
    }
  }
  return out;
}

// ── Public bucket API ─────────────────────────────────────────────────────────
export async function getCached(bucket, key, userId = "anon") {
  const entry = await kvGet(STORE_DATA, `${bucket}:${key}:${userId}`);
  return entry && entry.data != null ? entry.data : null;
}

export async function putCached(bucket, key, data, userId = "anon") {
  await kvSet(STORE_DATA, `${bucket}:${key}:${userId}`, { data, savedAt: Date.now() });
}

export async function getLocalVersion(bucket, userId = "anon") {
  const v = await kvGet(STORE_META, `${userId}:${bucket}`);
  return typeof v === "string" ? v : (v && v.version ? v.version : null);
}

export async function putLocalVersion(bucket, version, userId = "anon") {
  await kvSet(STORE_META, `${userId}:${bucket}`, version);
}

export async function clearBucket(bucket, userId = "anon") {
  const keys = await kvKeys(STORE_DATA);
  const prefix = `${bucket}:${userId === "*" ? "" : userId + ":"}`;
  await Promise.all(keys.filter((k) => k.startsWith(prefix)).map((k) => kvDel(STORE_DATA, k)));
  if (userId === "*") {
    const mkeys = await kvKeys(STORE_META);
    await Promise.all(mkeys.filter((k) => k.startsWith(`${bucket}:`)).map((k) => kvDel(STORE_META, k)));
  } else {
    await kvDel(STORE_META, `${userId}:${bucket}`);
  }
}

// Manual "force refresh" escape hatch: drop all stored versions so the next sync
// re-fetches every bucket from the server. Cached data is left in place (and
// overwritten on re-fetch) to avoid a blank flash if the network is down.
export async function forceCacheRefresh() {
  const keys = await kvKeys(STORE_META);
  await Promise.all(keys.map((k) => kvDel(STORE_META, k)));
}

// ── Unified sync/pull endpoint ────────────────────────────────────────────────
// One POST: the client sends its last-known per-bucket versions; the server point-
// reads the user's stamp doc and returns ONLY the buckets whose stamp changed
// (computed from its own in-memory read cache). Unchanged buckets are omitted, so
// they cost zero payload and zero extra server reads.
export async function pullBuckets(userId, email, localVersions) {
  const res = await fetch(`${API_BASE}/api/sync/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, email, versions: localVersions }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    throw new Error(json?.message || `sync/pull failed (${res.status})`);
  }
  return { versions: json.versions || {}, buckets: json.buckets || {} };
}

// Force-refresh escape hatch: ?refresh=1 on the URL or window.__DEVCRAFT_FORCE_SYNC.
export function isForceRefreshRequested() {
  try {
    if (typeof window !== "undefined") {
      if (window.__DEVCRAFT_FORCE_SYNC) return true;
      if (typeof window.location !== "undefined") {
        const p = new URLSearchParams(window.location.search);
        if (p.get("refresh") === "1") return true;
      }
    }
  } catch {}
  return false;
}

// ── Core sync orchestrator ────────────────────────────────────────────────────
// items: [{ bucket, key, fetcher, force? }]
// opts.userId: scopes all versions/cache to this user
// opts.email:  used server-side for the enrollment email-fallback merge
// opts.force:  force re-fetch of every bucket
// Returns: { [bucket]: data }
//
// Happy path: ONE request to /sync/pull. The server returns only changed buckets;
// they are written to IndexedDB and the new stamps cached. Unchanged buckets are
// served straight from IndexedDB (no network at all). If /sync/pull is unreachable,
// we fall back to each item's own fetcher (original behaviour) so the app still
// loads from cache or a direct fetch.
export async function syncBuckets(items, opts = {}) {
  const userId = opts.userId || "anon";
  const forceAll = !!opts.force || isForceRefreshRequested();

  // Build the per-bucket local version map we send to the server.
  const localVersions = {};
  for (const item of items) {
    localVersions[item.bucket] = forceAll ? "0" : (await getLocalVersion(item.bucket, userId) || "0");
  }

  let pulled = null;
  try {
    pulled = await pullBuckets(userId, opts.email, localVersions);
  } catch (e) {
    // Server unreachable: fall back to per-bucket fetchers (cache-first).
    console.warn("[cacheSync] /sync/pull failed, using fetcher fallback:", e.message);
  }

  const results = {};
  if (pulled) {
    for (const item of items) {
      const { bucket, key } = item;
      const payload = pulled.buckets[bucket];
      if (payload !== undefined) {
        // Changed (or forced): store server payload + new stamp.
        await putCached(bucket, key, payload, userId);
        await putLocalVersion(bucket, pulled.versions[bucket] ?? "0", userId);
        results[bucket] = payload;
      } else {
        // Unchanged: serve from IndexedDB, no network.
        const cached = await getCached(bucket, key, userId);
        results[bucket] = cached != null ? cached : null;
      }
    }
    return results;
  }

  // ── Fallback: no server. Use each item's fetcher, cache-first. ───────────────
  for (const item of items) {
    const { bucket, key, fetcher } = item;
    const localVer = await getLocalVersion(bucket, userId);
    const cached = await getCached(bucket, key, userId);
    const changed = forceAll || item.force || localVer === null || cached == null;
    if (!changed) { results[bucket] = cached; continue; }
    try {
      const data = await fetcher();
      await putCached(bucket, key, data, userId);
      await putLocalVersion(bucket, `local:${Date.now()}`, userId);
      results[bucket] = data;
    } catch (err) {
      console.warn(`[cacheSync] fetch failed for bucket "${bucket}", serving stale:`, err.message);
      results[bucket] = cached; // serve stale if present
    }
  }
  return results;
}

export function isIdbAvailable() {
  return _idbAvailable === true;
}
