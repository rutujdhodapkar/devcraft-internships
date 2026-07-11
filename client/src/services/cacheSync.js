// client/src/services/cacheSync.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side cache-sync layer backed by IndexedDB, with a localStorage/in-memory
// fallback for environments where IndexedDB is unavailable (e.g. Safari private
// mode). Network reads are gated by a lightweight per-bucket version check so only
// changed buckets are re-fetched; unchanged buckets serve straight from cache.
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
export async function getCached(bucket, key) {
  const entry = await kvGet(STORE_DATA, `${bucket}:${key}`);
  return entry && entry.data != null ? entry.data : null;
}

export async function putCached(bucket, key, data) {
  await kvSet(STORE_DATA, `${bucket}:${key}`, { data, savedAt: Date.now() });
}

export async function getLocalVersion(bucket) {
  const v = await kvGet(STORE_META, bucket);
  return typeof v === "string" ? v : (v && v.version ? v.version : null);
}

export async function putLocalVersion(bucket, version) {
  await kvSet(STORE_META, bucket, version);
}

export async function clearBucket(bucket) {
  const keys = await kvKeys(STORE_DATA);
  await Promise.all(keys.filter((k) => k.startsWith(`${bucket}:`)).map((k) => kvDel(STORE_DATA, k)));
  await kvDel(STORE_META, bucket);
}

// Manual "force refresh" escape hatch: drop all stored versions so the next sync
// re-fetches every bucket from the server. Cached data is left in place (and
// overwritten on re-fetch) to avoid a blank flash if the network is down.
export async function forceCacheRefresh() {
  const keys = await kvKeys(STORE_META);
  await Promise.all(keys.map((k) => kvDel(STORE_META, k)));
}

// ── Server version endpoint ───────────────────────────────────────────────────
export async function fetchServerVersions() {
  const res = await fetch(`${API_BASE}/api/sync/versions`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    throw new Error(json?.message || `versions fetch failed (${res.status})`);
  }
  return json.data || {};
}

// ── Core sync orchestrator ────────────────────────────────────────────────────
// items: [{ bucket, key, fetcher, force? }]
// opts.force: force re-fetch of every bucket
// Returns: { [bucket]: data }
export async function syncBuckets(items, opts = {}) {
  const forceAll = !!opts.force;
  let serverVersions = {};
  try {
    serverVersions = await fetchServerVersions();
  } catch (e) {
    // Network/endpoint failure: fall back to whatever is cached so the app still
    // renders. If nothing is cached, re-run the fetchers so we don't return empty.
    console.warn("[cacheSync] version fetch failed, using cache fallback:", e.message);
  }

  const results = {};
  for (const item of items) {
    const { bucket, key, fetcher } = item;
    const localVer = await getLocalVersion(bucket);
    const serverVer = serverVersions[bucket] ?? null;
    const changed = forceAll || item.force || localVer === null || localVer !== serverVer;

    if (!changed) {
      const cached = await getCached(bucket, key);
      if (cached != null) {
        results[bucket] = cached;
        continue;
      }
      // Cached data missing despite a matching version — fall through to fetch.
    }

    try {
      const data = await fetcher();
      await putCached(bucket, key, data);
      if (serverVer != null) await putLocalVersion(bucket, serverVer);
      results[bucket] = data;
    } catch (err) {
      // Fetch failed: serve stale cache if present, otherwise rethrow-free null.
      console.warn(`[cacheSync] fetch failed for bucket "${bucket}":`, err.message);
      const stale = await getCached(bucket, key);
      results[bucket] = stale;
    }
  }
  return results;
}

export function isIdbAvailable() {
  return _idbAvailable === true;
}
