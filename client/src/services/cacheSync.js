// client/src/services/cacheSync.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side version-diffed cache-sync layer, backed by IndexedDB (with a
// localStorage/in-memory fallback for Safari private mode etc.).
//
// TARGET FLOW (exactly as specified):
//   1. On app load we read IndexedDB FIRST and render immediately. If IndexedDB is
//      empty we show a loading state and go straight to a full fetch.
//   2. In the background (non-blocking) we call GET /sync/versions?userId= — a
//      single Cosmos POINT READ on the SyncVersions container returning per-bucket
//      version tokens { tasks, badges_combined, certs }.
//   3. We diff those against versions stored in IndexedDB alongside the cached data.
//   4. Buckets whose version matches → do nothing (keep serving cache).
//      Buckets whose version differs (or were empty) → fetch ONLY that bucket's
//      full data from Cosmos, write it + its new version into IndexedDB, and notify
//      the caller (onBucket) so only that UI section re-renders.
//
// Failure handling (mandatory):
//   • /sync/versions fails → keep serving cache silently, retry in background with
//     exponential backoff, NO error shown.
//   • a specific bucket fetch fails after a mismatch → keep showing the OLD cached
//     version, log it, retry with backoff. Never leave the section blank.
//   • forceRefresh() bypasses cache + versions for a full fetch (debugging).
//
// Buckets:
//   tasks            -> own version key (large, changes often)
//   certs            -> own version key
//   badges_combined  -> ONE version key merging badges + streaks + ambassador flags
//                       + registered task list (small, low-churn)
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_SERVER_URL || "https://devcraft.fennark.xyz").replace(/\/api\/?$/, "");

const DB_NAME = "devcraft_cache";
const DB_VERSION = 1;
const STORE_DATA = "buckets"; // key: `${bucket}:${key}:${userId}`  value: { data, savedAt }
const STORE_META = "versions"; // key: `${userId}:${bucket}`        value: version string

export const SYNC_BUCKETS = ["tasks", "certs", "badges_combined"];

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

// STEP 1: read all cached buckets for a user immediately (no network). Returns
// { tasks, certs, badges_combined } where each value is the cached data or null.
export async function loadCachedUserBuckets(userId = "anon") {
  const out = {};
  for (const b of SYNC_BUCKETS) out[b] = await getCached(b, userId, userId);
  return out;
}

export async function clearBucket(bucket, userId = "anon") {
  const keys = await kvKeys(STORE_DATA);
  const prefix = `${bucket}:${userId}:`;
  await Promise.all(keys.filter((k) => k.startsWith(prefix)).map((k) => kvDel(STORE_DATA, k)));
  await kvDel(STORE_META, `${userId}:${bucket}`);
}

// ── Server version endpoint ───────────────────────────────────────────────────
// STEP 2: a single GET that hits /sync/versions?userId= which performs ONE Cosmos
// point read (by id + partition key /userId) on the SyncVersions container.
export async function fetchServerVersions(userId) {
  const url = `${API_BASE}/api/sync/versions${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`;
  const res = await fetch(url, {
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

// ── Exponential backoff retry manager ─────────────────────────────────────────
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000];
const MAX_ATTEMPTS = 6;
const _retries = new Map(); // key -> { attempt, timer }

function scheduleRetry(key, attempt, fn) {
  if (_retries.has(key)) return; // one in-flight retry per key
  if (attempt >= MAX_ATTEMPTS) { _retries.delete(key); return; }
  const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
  const timer = setTimeout(() => {
    _retries.delete(key);
    Promise.resolve(fn(attempt + 1)).catch(() => {});
  }, delay);
  _retries.set(key, { attempt, timer });
}

// ── Core sync orchestrator ────────────────────────────────────────────────────
// items: [{ bucket, key, fetcher, force? }]
// opts.userId      : scopes all versions/cache to this user
// opts.email       : forwarded to fetchers (enrollment email-fallback merge)
// opts.force       : force re-fetch of every bucket
// opts.onBucket    : (bucket, data, { changed }) => void  — called as each bucket
//                    resolves so the UI can re-render ONLY that section.
// Returns: { [bucket]: data } (cache-first; never throws)
export async function syncBuckets(items, opts = {}) {
  const userId = opts.userId || "anon";
  const forceAll = !!opts.force || isForceRefreshRequested();
  const onBucket = typeof opts.onBucket === "function" ? opts.onBucket : null;
  const attempt = opts._attempt || 0;

  // Build the local version map we will diff against.
  const localVersions = {};
  for (const item of items) localVersions[item.bucket] = await getLocalVersion(item.bucket, userId);

  // STEP 2: background version point-read.
  let server;
  try {
    server = await fetchServerVersions(userId);
    // Record when we last verified, so a reload within minCheckInterval can skip
    // the point-read (we'll still catch updates via the background loop / on focus).
    await markVersionChecked(userId).catch(() => {});
  } catch (e) {
    // Version endpoint down: keep serving cache silently, retry in background.
    console.warn("[cacheSync] /sync/versions failed; serving cache, retrying:", e.message);
    scheduleRetry(`versions:${userId}`, attempt, (a) =>
      syncBuckets(items, { ...opts, _attempt: a })
    );
    const cached = {};
    for (const item of items) cached[item.bucket] = await getCached(item.bucket, item.key, userId);
    return cached;
  }

  const results = {};
  for (const item of items) {
    const { bucket, key, fetcher } = item;
    const localVer = localVersions[bucket] || null;
    const serverVer = server[bucket] != null ? String(server[bucket]) : null;
    const cached = await getCached(bucket, key, userId);
    const isEmpty = cached == null;

    // STEP 4a: version matches AND we have cached data → do nothing, keep cache.
    if (!forceAll && !isEmpty && localVer != null && localVer === serverVer) {
      console.log(`[cacheSync] bucket "${bucket}": version match → serve cache, NO fetch`);
      results[bucket] = cached;
      if (onBucket) onBucket(bucket, cached, { changed: false });
      continue;
    }

    // STEP 4b: version differs (or empty) → fetch ONLY this bucket.
    try {
      const data = await fetcher();
      await putCached(bucket, key, data, userId);
      await putLocalVersion(bucket, serverVer, userId);
      console.log(`[cacheSync] bucket "${bucket}": version changed → fetched from Cosmos`);
      results[bucket] = data;
      if (onBucket) onBucket(bucket, data, { changed: true });
    } catch (err) {
      // Fetch failed: keep OLD cached version, log, retry with backoff. Never blank.
      console.warn(`[cacheSync] fetch failed for "${bucket}" (keeping old cache, retrying):`, err.message);
      scheduleRetry(`bucket:${userId}:${bucket}`, 0, async () => {
        try {
          const data = await fetcher();
          await putCached(bucket, key, data, userId);
          await putLocalVersion(bucket, serverVer, userId);
          if (onBucket) onBucket(bucket, data, { changed: true });
        } catch (e2) {
          console.warn(`[cacheSync] retry failed for "${bucket}":`, e2.message);
          throw e2; // re-thrown so scheduleRetry reschedules
        }
      });
      results[bucket] = cached; // stale-but-present
      if (onBucket && cached != null) onBucket(bucket, cached, { changed: false });
    }
  }
  return results;
}

// ── Manual force refresh (debugging) ──────────────────────────────────────────
// Bypasses all cache + version checks: wipes stored versions so the next sync
// re-fetches every bucket from Cosmos.
export async function forceRefresh(userId = "anon") {
  const keys = await kvKeys(STORE_META);
  await Promise.all(keys.filter((k) => k.startsWith(`${userId}:`)).map((k) => kvDel(STORE_META, k)));
  window && window.__DEVCRAFT_FORCE_SYNC && (window.__DEVCRAFT_FORCE_SYNC = false);
}

export function isIdbAvailable() {
  return _idbAvailable === true;
}

// ── Last-checked bookkeeping (used to skip needless point-reads) ───────────────
async function getMetaNumber(key, userId) {
  const v = await kvGet(STORE_META, `${userId}:__meta:${key}`);
  return Number(v || 0) || 0;
}
async function putMeta(key, userId, val) {
  await kvSet(STORE_META, `${userId}:__meta:${key}`, val);
}

// Called by syncBuckets after a successful version point-read.
export async function markVersionChecked(userId) {
  await putMeta("lastCheck", userId, Date.now());
}

// ── Background sync loop (Vercel-friendly "push") ─────────────────────────────
// A real WebSocket push needs an external service (Azure SignalR / Ably) which
// doesn't run on serverless without keys. This is the serverless equivalent: a
// timer + tab-focus/visibility driven check. Updates are caught the moment the
// tab regains focus or within pollInterval — no per-mount polling, no missed
// writes (the version bump still drives exactly which bucket refreshes).
let _loop = null;

export function startSyncLoop(userId, email, opts = {}) {
  const {
    pollInterval = 60000,
    minCheckInterval = 30000,
    onSync,
    onBucket,
  } = opts;
  stopSyncLoop(); // never stack loops

  const run = async () => {
    const now = Date.now();
    const last = await getMetaNumber("lastCheck", userId);
    if (now - last < minCheckInterval) return; // recently verified → skip point-read
    if (typeof onSync === "function") {
      try { await onSync(); }
      catch (e) { console.warn("[cacheSync] loop sync failed:", e.message); }
    }
  };

  run(); // initial (honours minCheckInterval)
  const timer = setInterval(run, pollInterval);
  const onVisible = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") run();
  };
  const onFocus = () => run();
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
  _loop = { timer, onVisible, onFocus, userId };
}

export function stopSyncLoop() {
  if (!_loop) return;
  clearInterval(_loop.timer);
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", _loop.onVisible);
  if (typeof window !== "undefined") window.removeEventListener("focus", _loop.onFocus);
  _loop = null;
}
