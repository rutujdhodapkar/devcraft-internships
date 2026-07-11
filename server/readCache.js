// server/readCache.js
// ─────────────────────────────────────────────────────────────────────────────
// Tiny in-memory, TTL-bounded read-through cache for Cosmos reads.
//
// WHY: the client already avoids re-fetching unchanged buckets (IndexedDB + per-user
// version stamps), but every *changed* bucket still triggered a full Cosmos query
// (e.g. fetchUserBadges scanned the ENTIRE userBadges collection per user). This
// cache absorbs those repeated reads at the server: a warm instance serves badges
// once per 5 min globally and per-user enrollments/badges once per 30 s, so Cosmos
// RU drops dramatically under reload/concurrent load.
//
// SCOPE: module-level memory only — it is per serverless instance and resets on a
// cold start. That is fine: entries are TTL-bounded, correctness never depends on a
// hit (a miss just falls through to Cosmos), and writes explicitly invalidate the
// affected keys (see api/index.js invalidateSyncCaches). No external dependency.
// ─────────────────────────────────────────────────────────────────────────────

const _store = new Map(); // key -> { value, expires }

export function cacheGet(key) {
  const hit = _store.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    _store.delete(key);
    return undefined;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlMs) {
  _store.set(key, { value, expires: Date.now() + ttlMs });
}

export function cacheDelete(key) {
  _store.delete(key);
}

export function cacheDeleteByPrefix(prefix) {
  for (const k of _store.keys()) {
    if (k.startsWith(prefix)) _store.delete(k);
  }
}

// Read-through: return cached value or compute+store it. Concurrent callers for the
// same key share a single in-flight promise so we never stampede Cosmos.
const _inflight = new Map();
export async function readThrough(key, ttlMs, fetcher) {
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  if (_inflight.has(key)) return _inflight.get(key);

  const p = (async () => {
    try {
      const value = await fetcher();
      cacheSet(key, value, ttlMs);
      return value;
    } finally {
      _inflight.delete(key);
    }
  })();
  _inflight.set(key, p);
  return p;
}

// TTLs (ms)
export const TTL = {
  BADGES: 5 * 60 * 1000, // global badge defs: rare
  USER_DATA: 30 * 1000, // per-user enrollments/badges/streaks/flags
};
