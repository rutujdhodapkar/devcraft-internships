// ── DEV/CRAFT Cache Engine ──
// Version-diffed, event-driven client cache.
// No timers, no polling, no fixed TTLs.
//
// Triggers (defined in wireEvents below):
//   - Initial page load
//   - Route navigation (pathname change)
//   - visibilitychange → "visible" (tab re-focus)
//
// Version storage:
//   - Firebase Firestore manifest docs hold version strings per key
//   - localStorage holds both data + version side-by-side
//   - On trigger, check version first (cheap Firebase read)
//   - Match → extend cache, 0 Azure reads
//   - Mismatch → fetch fresh data from Azure, update cache + version

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

// ── Firebase Config ──
// Uses the same Firebase project as auth — Firestore manifests live here.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_GOOGLE_CLIENT_ID ? undefined : undefined,
  authDomain: "login-data-680b9.firebaseapp.com",
  projectId: "login-data-680b9",
};

let _app = null;
let _firestore = null;

function getFs() {
  if (_firestore) return _firestore;
  try {
    _app = initializeApp(firebaseConfig, "cacheEngine");
    _firestore = getFirestore(_app);
  } catch {
    // Fallback to existing Firebase app
    const { getFirestore: getExistingFs } = require("firebase/firestore");
    _firestore = getExistingFs();
  }
  return _firestore;
}

// ── localStorage helpers ──

function lsGet(key) {
  try {
    const raw = localStorage.getItem("ce_" + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function lsSet(key, data) {
  try { localStorage.setItem("ce_" + key, JSON.stringify(data)); } catch {}
}

function lsRemove(key) {
  try { localStorage.removeItem("ce_" + key); } catch {}
}

// Cache entry structure: { data, version, cachedAt }
function readCache(key) {
  const entry = lsGet(key);
  if (!entry) return null;
  return entry;
}

function writeCache(key, data, version) {
  lsSet(key, { data, version, cachedAt: Date.now() });
}

// ── Manifest readers ──

let _lastManifestFetch = 0;
let _cachedSharedVersions = null;

async function fetchSharedVersions() {
  try {
    const fs = getFs();
    const snap = await getDoc(doc(fs, "manifest", "shared-versions"));
    if (snap.exists()) {
      _cachedSharedVersions = snap.data()?.value || {};
      _lastManifestFetch = Date.now();
      return _cachedSharedVersions;
    }
  } catch (e) {
    console.warn("[cacheEngine] Failed to fetch shared versions:", e.message);
  }
  return _cachedSharedVersions || {};
}

async function fetchDomainVersion(domainId) {
  try {
    const fs = getFs();
    const snap = await getDoc(doc(fs, "manifest-domain-versions", domainId));
    return snap.exists() ? snap.data().version : null;
  } catch {
    return null;
  }
}

// ── Public API ──

const CATEGORY_API_PATHS = {
  careerPaths:      "/api/data/career-paths",
  courses:           "/api/data/courses",
  courseContent:     null, // needs dynamic ID
  headerSettings:    "/api/data/site-config?key=headerSettings",
  homepageLayout:    "/api/data/site-config?key=homepageLayout",
  homepage:          "/api/data/site-config?key=homepage",
  howItWorks:        "/api/data/how-it-works",
  faqs:              "/api/data/faqs",
  whatDoYouGet:      "/api/data/site-config?key=whatDoYouGet",
  universityCollab:  "/api/data/site-config?key=universityCollab",
  logoLoop:          "/api/data/site-config?key=logoLoop",
  slidingStrips:     "/api/data/site-config?key=slidingStrips",
  terms:             "/api/data/site-config?key=terms",
  privacy:           "/api/data/site-config?key=privacy",
  refund:            "/api/data/site-config?key=refund",
  paymentSettings:   "/api/data/site-config?key=paymentSettings",
  earnSettings:      "/api/data/site-config?key=earnSettings",
  earnDetails:       "/api/data/site-config?key=earnDetails",
  userTypes:         "/api/data/site-config?key=userTypes",
  templates:         "/api/data/site-config?key=templates",
  aboutText:         "/api/data/site-config?key=aboutText",
  badges:            "/api/data/badges",
};

const API_BASE = (import.meta.env.VITE_SERVER_URL || "https://devcraft.fennark.xyz").replace(/\/api\/?$/, "");

async function fetchFromApi(path) {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const json = await resp.json();
  return json.data;
}

// ── 1. Shared Category Data ──

export async function getSharedCategoryData(categoryName) {
  const apiPath = CATEGORY_API_PATHS[categoryName];
  if (!apiPath) throw new Error(`Unknown shared category: ${categoryName}`);

  const cacheKey = "sh_" + categoryName;
  const cached = readCache(cacheKey);

  // Fetch fresh versions from manifest
  const versions = await fetchSharedVersions();
  const remoteVersion = versions[categoryName] || null;

  if (cached && remoteVersion && cached.version === remoteVersion) {
    console.log(`[cache] HIT  ${categoryName}  v${remoteVersion}`);
    return cached.data;
  }

  // Mismatch or no cache — fetch from API
  console.log(`[cache] MISS ${categoryName}  local=${cached?.version || "none"} remote=${remoteVersion}`);
  try {
    const data = await fetchFromApi(apiPath);
    writeCache(cacheKey, data, remoteVersion || "");
    return data;
  } catch (e) {
    console.warn(`[cache] FETCH FAIL ${categoryName}:`, e.message);
    if (cached) return cached.data; // fallback to stale
    throw e;
  }
}

// ── 2. Domain Tasks ──

export async function getDomainTasks(domainId) {
  const cacheKey = "dm_" + domainId;
  const cached = readCache(cacheKey);

  const remoteVersion = await fetchDomainVersion(domainId);

  if (cached && remoteVersion && cached.version === remoteVersion) {
    console.log(`[cache] HIT  domain:${domainId}  v${remoteVersion}`);
    return cached.data;
  }

  console.log(`[cache] MISS domain:${domainId}  local=${cached?.version || "none"} remote=${remoteVersion}`);
  try {
    const data = await fetchFromApi(`/api/data/courses/${encodeURIComponent(domainId)}/content`);
    writeCache(cacheKey, data, remoteVersion || "");
    return data;
  } catch (e) {
    console.warn(`[cache] FETCH FAIL domain:${domainId}:`, e.message);
    if (cached) return cached.data;
    throw e;
  }
}

// ── 3. Optimistic Task Update (no re-read) ──

export function updateOwnTask(domainId, taskId, updates) {
  const cacheKey = "dm_" + domainId;
  const cached = readCache(cacheKey);
  if (!cached) return;

  const modules = cached.data?.modules || [];
  let changed = false;

  for (const mod of modules) {
    const lessons = mod.lessons || [];
    for (let i = 0; i < lessons.length; i++) {
      if (lessons[i].id === taskId) {
        lessons[i] = { ...lessons[i], ...updates };
        changed = true;
      }
    }
  }

  if (changed) {
    writeCache(cacheKey, { ...cached.data, modules }, cached.version);
    console.log(`[cache] OPTIMISTIC UPDATE domain:${domainId} task:${taskId}`);
  }
}

// ── 4. User External Status ──
// Reads externalUpdateVersion directly from the user's Cosmos doc (1 field)

export async function getUserExternalStatus(uid) {
  const cacheKey = "eu_" + uid;
  const cached = readCache(cacheKey);

  try {
    const resp = await fetch(`${API_BASE}/api/data/users/${encodeURIComponent(uid)}?fields=externalUpdateVersion,certEligible,paymentStatus`);
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const json = await resp.json();
    const data = json.data || {};
    const remoteVersion = data.externalUpdateVersion || 0;

    if (cached && cached.version === remoteVersion) {
      console.log(`[cache] HIT  external:${uid}  v${remoteVersion}`);
      return cached.data;
    }

    console.log(`[cache] MISS external:${uid}  local=${cached?.version} remote=${remoteVersion}`);
    writeCache(cacheKey, data, remoteVersion);
    return data;
  } catch (e) {
    console.warn(`[cache] FETCH FAIL external:${uid}:`, e.message);
    if (cached) return cached.data;
    return { externalUpdateVersion: 0 };
  }
}

// ── 5. Batch Re-check (called on trigger events) ──

const _pendingChecks = new Map();

export function queueCategoryCheck(categoryName) {
  if (_pendingChecks.has(categoryName)) return _pendingChecks.get(categoryName);
  const promise = getSharedCategoryData(categoryName)
    .catch(() => {})
    .finally(() => _pendingChecks.delete(categoryName));
  _pendingChecks.set(categoryName, promise);
  return promise;
}

export function queueDomainCheck(domainId) {
  const key = `domain:${domainId}`;
  if (_pendingChecks.has(key)) return _pendingChecks.get(key);
  const promise = getDomainTasks(domainId)
    .catch(() => {})
    .finally(() => _pendingChecks.delete(key));
  _pendingChecks.set(key, promise);
  return promise;
}

// ── 6. Preload (for initial page load) ──

export async function preloadSharedCategories(categories) {
  const versions = await fetchSharedVersions();
  const needed = [];

  for (const cat of categories) {
    const cacheKey = "sh_" + cat;
    const cached = readCache(cacheKey);
    const remoteVersion = versions[cat] || null;
    if (!cached || (remoteVersion && cached.version !== remoteVersion)) {
      needed.push(cat);
    } else {
      console.log(`[cache] PRELOAD HIT ${cat}  v${remoteVersion}`);
    }
  }

  if (needed.length === 0) return;

  console.log(`[cache] PRELOAD FETCH ${needed.join(", ")}`);
  await Promise.all(needed.map(cat => getSharedCategoryData(cat).catch(() => {})));
}

// ── 7. Event Wiring — the ONLY entry points ──

let _wired = false;
let _lastPathname = "";

export function wireEvents() {
  if (_wired) return;
  _wired = true;
  _lastPathname = window.location.pathname;

  // Trigger A: initial page load (fires once on first call)
  // Caller manually invokes preloadSharedCategories after wireEvents

  // Trigger B: route navigation (history.pushState / popstate)
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    _onRouteChange();
  };
  window.addEventListener("popstate", _onRouteChange);

  // Trigger C: visibilitychange → visible (tab re-focus)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      console.log("[cache] VISIBILITY CHANGE → visible");
      _onTabFocus();
    }
  });

  console.log("[cache] Event listeners wired");
}

function _onRouteChange() {
  const path = window.location.pathname;
  if (path === _lastPathname) return;
  _lastPathname = path;
  console.log(`[cache] ROUTE CHANGE → ${path}`);
  // Fire-and-forget re-check for relevant categories based on route
  const routeCats = _categoriesForRoute(path);
  for (const cat of routeCats) {
    queueCategoryCheck(cat);
  }
}

function _onTabFocus() {
  console.log("[cache] Tab re-focused — re-checking all cached data");
  // Re-fetch manifest silently, then diff
  // Use a debounce to avoid multiple rapid re-checks
  if (_focusTimer) clearTimeout(_focusTimer);
  _focusTimer = setTimeout(async () => {
    const versions = await fetchSharedVersions();
    if (!versions) return;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("ce_sh_")) {
        const cat = key.slice(6); // "ce_sh_" prefix = 6 chars
        const cached = readCache(key);
        const remoteVersion = versions[cat] || null;
        if (cached && remoteVersion && cached.version !== remoteVersion) {
          queueCategoryCheck(cat);
        }
      }
    }
  }, 300);
}

let _focusTimer = null;

function _categoriesForRoute(path) {
  if (path === "/" || path === "") {
    return ["careerPaths", "courses", "headerSettings", "homepageLayout", "howItWorks", "faqs", "whatDoYouGet", "universityCollab", "logoLoop", "slidingStrips", "earnSettings"];
  }
  if (path === "/dashboard") return ["careerPaths", "paymentSettings"];
  if (path === "/admin") return ["careerPaths", "courses", "paymentSettings", "earnSettings"];
  if (path.startsWith("/tandp")) return ["terms"];
  if (path.startsWith("/privacy")) return ["privacy"];
  if (path.startsWith("/refund")) return ["refund"];
  if (path.startsWith("/earn")) return ["earnSettings", "earnDetails"];
  return [];
}

// ── 8. Clear (for logout / data reset) ──

export function clearCache() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("ce_")) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  _cachedSharedVersions = null;
  _lastManifestFetch = 0;
  console.log(`[cache] Cleared ${keysToRemove.length} cache entries`);
}
