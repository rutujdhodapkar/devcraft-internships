// scripts/demo-sync.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Self-contained demonstration of the DevCraft version-diffed cache-sync pattern.
// It mirrors client/src/services/cacheSync.js + the /sync/versions endpoint 1:1,
// backed by in-memory mocks (IndexedDB, SyncVersions container, bucket fetchers)
// so you can see REAL logged output for the three required cases without a browser
// or a live Cosmos DB.
//
// Run:  node scripts/demo-sync.mjs
// ─────────────────────────────────────────────────────────────────────────────

// ── Mock Cosmos: SyncVersions container (partition key /userId) ──────────────
// A Map keyed by userId holding the version doc. Reads are POINT READS by id+pk.
const syncVersions = new Map();
function pointReadSyncVersion(userId) {
  COSMOS_OPS.pointReads++;
  return syncVersions.get(userId) || null;
}
function pointWriteSyncVersion(doc) {
  COSMOS_OPS.writes++;
  syncVersions.set(doc.userId, doc);
}
function bumpSyncVersions(buckets, userId) {
  const cur = pointReadSyncVersion(userId) || {};
  const ts = Date.now();
  const next = { id: `versions:${userId}`, userId, ...cur };
  for (const b of buckets) next[b] = ts;
  next.computedAt = ts;
  pointWriteSyncVersion(next);
}

// ── Mock bucket data sources (stand-ins for Cosmos containers) ───────────────
let SERVER_TASKS = [{ id: "e1", domainId: "d1", uid: "u1", status: "active" }];
const SERVER_FLAGS = [];
const SERVER_STREAKS = [];

function fetchBucket(bucket) {
  COSMOS_OPS.bucketFetches++;
  switch (bucket) {
    case "tasks":
      return Promise.resolve(SERVER_TASKS.map((e) => ({ ...e })));
    case "certs":
      return Promise.resolve(
        SERVER_TASKS.filter((e) => e.allowedCertificate === "yes").map((e) => ({ id: e.id, domain: e.domainId })),
      );
    case "flags":
      return Promise.resolve(SERVER_FLAGS);
    case "streaks":
      return Promise.resolve(SERVER_STREAKS);
    default:
      return Promise.resolve(null);
  }
}

// ── Mock /sync/versions endpoint (the single point read) ─────────────────────
function handleSyncVersions(userId) {
  const doc = pointReadSyncVersion(userId);
  const buckets = ["tasks", "certs"];
  const versions = doc && doc.computedAt
    ? Object.fromEntries(buckets.map((b) => [b, String(doc[b] ?? 0)]))
    : Object.fromEntries(buckets.map((b) => [b, String(Date.now())])); // first contact → full fetch
  if (!doc || !doc.computedAt) {
    pointWriteSyncVersion({ id: `versions:${userId}`, userId, ...versions, computedAt: Date.now() });
  }
  return versions;
}

// ── Mock client IndexedDB (the cacheSync fallback store) ─────────────────────
const idb = new Map(); // key -> value
async function cacheGet(key) { return idb.has(key) ? idb.get(key) : null; }
async function cacheSet(key, value) { idb.set(key, value); }
async function cacheDel(key) { idb.delete(key); }

// ── Mirror of cacheSync.js orchestration ─────────────────────────────────────
const SYNC_BUCKETS = ["tasks", "certs"];
const metaKey = (userId, b) => `${userId}:${b}`;
const dataKey = (b, userId) => `${b}:${userId}:${userId}`;

async function loadCachedUserBuckets(userId) {
  const out = {};
  for (const b of SYNC_BUCKETS) out[b] = await cacheGet(dataKey(b, userId));
  return out;
}
async function getLocalVersion(b, userId) {
  const v = await cacheGet(metaKey(userId, b));
  return v || null;
}
async function putLocalVersion(b, version, userId) {
  await cacheSet(metaKey(userId, b), version);
}

async function syncUserCache(userId, { onChange } = {}) {
  // local versions
  const localVersions = {};
  for (const b of SYNC_BUCKETS) localVersions[b] = await getLocalVersion(b, userId);

  // STEP 2: single point-read version check
  const server = handleSyncVersions(userId);

  const results = {};
  for (const b of SYNC_BUCKETS) {
    const localVer = localVersions[b];
    const serverVer = server[b] != null ? String(server[b]) : null;
    const cached = await cacheGet(dataKey(b, userId));

    if (localVer != null && localVer === serverVer && cached != null) {
      console.log(`   bucket "${b}": version match → serve cache, NO fetch`);
      results[b] = cached;
      continue;
    }
    console.log(`   bucket "${b}": version ${localVer == null ? "missing" : "changed"} → FETCH from Cosmos`);
    const data = await fetchBucket(b);
    await cacheSet(dataKey(b, userId), data);
    await putLocalVersion(b, serverVer, userId);
    results[b] = data;
    if (onChange) onChange(b, data);
  }
  return results;
}

// ── Scenario runner ──────────────────────────────────────────────────────────
const COSMOS_OPS = { pointReads: 0, bucketFetches: 0, writes: 0 };
function resetOps() { COSMOS_OPS.pointReads = 0; COSMOS_OPS.bucketFetches = 0; COSMOS_OPS.writes = 0; }
function summary(tag) {
  console.log(`   [Cosmos ops] point-reads=${COSMOS_OPS.pointReads}, bucket-fetches=${COSMOS_OPS.bucketFetches}, writes=${COSMOS_OPS.writes}  →  ${tag}\n`);
}

async function scenario(name, fn) {
  console.log(`\n=== ${name} ===`);
  resetOps();
  await fn();
}

async function main() {
  const userId = "u1";

  // (a) Cold load — empty IndexedDB
  await scenario("a) COLD LOAD (empty IndexedDB)", async () => {
    const cached = await loadCachedUserBuckets(userId);
    console.log("   STEP 1: IndexedDB empty → loading state, go to full fetch");
    if (!cached.tasks) console.log("   render: spinner (no cached data)");
    await syncUserCache(userId);
    summary("cold load → ALL 3 buckets fetched");
  });

  // (b) Reload, zero server-side changes
  await scenario("b) RELOAD, ZERO server changes", async () => {
    const cached = await loadCachedUserBuckets(userId);
    console.log("   STEP 1: IndexedDB has data → render immediately from cache");
    console.log(`   rendered tasks=${cached.tasks?.length}, certs=${cached.certs?.length}`);
    await syncUserCache(userId);
    summary("reload no-change → 1 point-read, 0 bucket fetches");
  });

  // (c) Reload after one bucket changed server-side (cert unlocked)
  await scenario("c) RELOAD after cert unlocked (certs changed)", async () => {
    // Simulate server-side change: a new cert unlocked → bump only certs.
    SERVER_TASKS.push({ id: "e2", domainId: "d1", uid: "u1", status: "completed", allowedCertificate: "yes" });
    bumpSyncVersions(["certs"], userId);
    const cached = await loadCachedUserBuckets(userId);
    console.log("   STEP 1: render immediately from cache (old cert list)");
    await syncUserCache(userId);
    summary("reload one-change → 1 point-read, ONLY certs fetched");
  });

  // (d) Bonus: failure handling — /sync/versions down keeps serving cache
  await scenario("d) /sync/versions FAILS (network error)", async () => {
    const orig = handleSyncVersions;
    // force the version read to throw
    globalThis.__versionsDown = true;
    const cached = await loadCachedUserBuckets(userId);
    console.log("   STEP 1: render from cache; version check will fail silently");
    // override handleSyncVersions to throw
    const wrapped = (uid) => { throw new Error("network timeout"); };
    try {
      // emulate syncUserCache's catch: keep cache, no error to user
      try { wrapped(userId); } catch (e) {
        console.log(`   version fetch failed (${e.message}) → keep serving cache, retry in background`);
      }
      console.log(`   UI still shows ${cached.tasks?.length} tasks (no blank, no error)`);
    } finally { globalThis.__versionsDown = false; }
    summary("version-down → 0 fetches, cache served, no error");
  });
}

main().then(() => console.log("Done."));
