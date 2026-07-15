const API_BASE = (import.meta.env.VITE_SERVER_URL || "https://devcraft.fennark.xyz").replace(/\/api\/?$/, "");

// Firebase Realtime Database — used ONLY for site visits, referral visits, and device-user mapping
import { getRtdb, ref, get as rtdbGet, set as rtdbSet, push as rtdbPush, update as rtdbUpdate, remove as rtdbRemove, query as rtdbQuery, orderByChild, equalTo, getFirebaseIdToken } from "../firebase";
import { getCookie, setCookie, removeCookie, clearCookies } from "../utils/cookies";
import { syncBuckets, loadCachedUserBuckets, startSyncLoop, stopSyncLoop } from "./cacheSync";
export { loadCachedUserBuckets, startSyncLoop, stopSyncLoop };

// ── Session cache for slow-changing auth data ──
const _authCache = new Map();
function _authCacheGet(key) {
  const entry = _authCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  const ls = _lsGet("ac_" + key);
  if (ls) { _authCache.set(key, { data: ls, expiresAt: Date.now() + 300000 }); return ls; }
  return null;
}
function _authCacheSet(key, data, ttl) {
  const expiresAt = Date.now() + (ttl || 300000);
  _authCache.set(key, { data, expiresAt });
  _lsSet("ac_" + key, data, ttl || 300000);
}
function _authCacheClear() { _authCache.clear(); }
export function clearAuthCache() { _authCacheClear(); }

function _rtdb() { return getRtdb(); }

async function _rtdbRead(path) {
  try { const d = _rtdb(); if (!d) return null; const s = await rtdbGet(ref(d, path)); return s.val(); } catch { return null; }
}

async function _rtdbReadList(path) {
  try { const d = _rtdb(); if (!d) return []; const s = await rtdbGet(ref(d, path));
    if (!s.exists()) return [];
    const v = s.val();
    return Object.keys(v).map(k => ({ id: k, ...v[k] }));
  } catch { return []; }
}

async function _rtdbAppend(path, data) {
  try { const d = _rtdb(); if (!d) return null;
    const newRef = rtdbPush(ref(d, path));
    await rtdbSet(newRef, { ...data, id: newRef.key, createdAt: new Date().toISOString() });
    return { id: newRef.key, ...data };
  } catch (e) { console.warn("rtdbAppend", path, e.message); return null; }
}

async function _rtdbPut(path, data) {
  try { const d = _rtdb(); if (!d) return null; await rtdbSet(ref(d, path), { ...data, updatedAt: new Date().toISOString() }); return data; } catch { return null; }
}

async function _rtdbPatch(path, data) {
  try { const d = _rtdb(); if (!d) return null; await rtdbUpdate(ref(d, path), { ...data, updatedAt: new Date().toISOString() }); return data; } catch { return null; }
}

async function _rtdbDelete(path) {
  try { const d = _rtdb(); if (!d) return false; await rtdbRemove(ref(d, path)); return true; } catch { return false; }
}

// Simple in-memory cache with TTL to reduce redundant Firestore reads
const _cache = new Map();
const _inflightReads = new Map();
const STATIC_CACHE_TTL = 10 * 60 * 1000;
const STATIC_COLLECTIONS = new Set(["careerPaths", "courses", "courseContent", "howItWorks", "faqs", "homepage", "logoLoop", "slidingStrips", "universityCollab"]);
const CACHE_TTL = 60 * 1000; // 60 seconds — reduce redundant reads within same page session

function _cacheKey(action, path, query) {
  return `${action}:${path}${query ? ":" + JSON.stringify(query) : ""}`;
}

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data;
}

function _cacheSet(key, data, ttl) {
  _cache.set(key, { data, expiresAt: Date.now() + (ttl || CACHE_TTL) });
}

function _cacheTtl(path) {
  const collection = path.split("/")[0];
  return STATIC_COLLECTIONS.has(collection) || path.startsWith("siteConfig/") ? STATIC_CACHE_TTL : CACHE_TTL;
}

function _cacheClear(docPath) {
  if (!docPath) { _cache.clear(); return; }
  const parts = docPath.split("/");
  const collection = parts[0];
  const docId = parts[1];
  const exactGetKey = docId ? `get:${collection}/${docId}` : null;
  for (const key of _cache.keys()) {
    if (key === exactGetKey) { _cache.delete(key); continue; }
    if (docId && key === `get:${docPath}`) { _cache.delete(key); continue; }
    if (key === `list:${collection}`) { _cache.delete(key); continue; }
    if (key.startsWith(`query:${collection}:`)) { _cache.delete(key); continue; }
  }
}

// localStorage cache for static data — persists across page reloads
const LS_TTL = 30 * 60 * 1000; // 30 minutes
function _lsGet(key) {
  try {
    const raw = localStorage.getItem("lsc_" + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) { localStorage.removeItem("lsc_" + key); return null; }
    return entry.data;
  } catch { return null; }
}
function _lsSet(key, data, ttl) {
  try { localStorage.setItem("lsc_" + key, JSON.stringify({ data, expiresAt: Date.now() + (ttl || LS_TTL) })); } catch {}
}
function _lsRemove(key) {
  try { localStorage.removeItem("lsc_" + key); } catch {}
}

// Version-diff storage: data lives forever in localStorage, version is the freshness signal
function _lsSetV(key, data, version) {
  try { localStorage.setItem("lsv_" + key, JSON.stringify({ d: data, v: version })); } catch {}
}
function _lsGetV(key) {
  try { const raw = localStorage.getItem("lsv_" + key); if (!raw) return null; const e = JSON.parse(raw); return { data: e.d, version: e.v }; } catch { return null; }
}

async function _fetchVersions() {
  try {
    const resp = await fetch(`${API_BASE}/api/data/versions`);
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.data || null;
  } catch { return null; }
}

const FALLBACK_STEPS = [
  { id: "step_1", step: 1, title: "Select Domain", description: "Choose your internship domain from available career paths." },
  { id: "step_2", step: 2, title: "Generate Offer", description: "Sign in with Google and complete your profile to receive an instant offer letter." },
  { id: "step_3", step: 3, title: "Complete Projects", description: "Submit your assigned project work through the student dashboard." },
  { id: "step_4", step: 4, title: "Get Certified", description: "Receive your verified completion certificate after admin review." },
];

const FALLBACK_FAQS = [
  { id: "faq_1", question: "Are the internships really free?", answer: "Yes, all virtual internships on DEV/CRAFT are 100% free. No hidden charges." },
  { id: "faq_2", question: "Who can apply?", answer: "College students, recent graduates, and self-taught learners from any background can apply." },
  { id: "faq_3", question: "How is progress verified?", answer: "Submitted projects are reviewed from the admin dashboard. Our team verifies each submission." },
  { id: "faq_4", question: "Will I get a certificate?", answer: "Yes, after completing all projects and admin verification, you receive a verified completion certificate." },
  { id: "faq_5", question: "How long does the internship last?", answer: "Each domain is designed for 4 weeks, but you can work at your own pace." },
];

async function dbProxy(action, path, data, query, opts) {
  const key = _cacheKey(action, path, query);
  const ck = `db_${key}`;
  const siteConfigRead = path.startsWith("siteConfig/");
  if (action === "get" || action === "list" || action === "query") {
    const cached = _cacheGet(key);
    if (cached) return cached;
    const pending = _inflightReads.get(key);
    if (pending) return pending;
    if (siteConfigRead) {
      const cookieData = getCookie(ck);
      if (cookieData !== null) return cookieData;
    }
  }
  const body = { action, path, data, query };
  // Enrollment records contain student PII and payment state. Supply an
  // identity for reads as well as writes so the server can enforce ownership.
  if (["enrollments"].includes(path.split("/")[0])) {
    const token = await getFirebaseIdToken().catch(() => null);
    if (token) body.idToken = token;
  }
  // Forward read consistency (Eventual) for non-critical reads. Writes are untouched.
  if (opts && opts.consistencyLevel) body.consistencyLevel = opts.consistencyLevel;
  if (action !== "get" && action !== "list" && action !== "query") {
    const token = await getFirebaseIdToken().catch(() => null);
    if (token) body.idToken = token;
  }
  const request = (async () => {
    const res = await fetch(`${API_BASE}/api/firebase-proxy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok || json.success === false) throw new Error(json.message || `Proxy ${action} ${path} failed`);
    const result = json.data;
    if (action === "get" || action === "list" || action === "query") {
      if (result !== null) {
        _cacheSet(key, result, _cacheTtl(path));
        if (siteConfigRead) { try { const s = JSON.stringify(result); if (s.length < 3500) setCookie(ck, result); } catch {} }
      }
    } else { _cacheClear(path); removeCookie(ck); }
    return result;
  })();
  if (action === "get" || action === "list" || action === "query") _inflightReads.set(key, request);
  try { return await request; } finally { _inflightReads.delete(key); }
}

async function dbGet(path, opts) {
  try { return await dbProxy("get", path, null, null, opts); } catch (e) { console.warn("dbGet", path, e.message); return null; }
}

async function dbPut(path, data) {
  try { return await dbProxy("set", path, data); } catch (e) { throw new Error(`Firebase PUT ${path} failed: ${e.message}`); }
}

async function dbPutSilent(path, data) {
  try { return await dbProxy("set", path, data); } catch (e) { console.warn("dbPut:", e.message); return null; }
}

async function dbPost(path, data) {
  try { return await dbProxy("push", path, data); } catch (e) { console.warn("dbPost", path, e.message); return { id: null, ...data }; }
}

async function dbPatch(path, data) {
  try { return await dbProxy("update", path, data); } catch (e) { throw new Error(`Firebase PATCH ${path} failed: ${e.message}`); }
}

async function dbDelete(path) {
  try { await dbProxy("delete", path); } catch (e) { console.warn("dbDelete", path, e.message); }
}

async function dbList(path, opts) {
  try { return await dbProxy("list", path, null, null, opts); } catch (e) { console.warn("dbList", path, e.message); return []; }
}

async function dbQueryList(path, field, value, opts) {
  try { return await dbProxy("query", path, null, { orderBy: field, equalTo: value }, opts); } catch (e) { console.warn("dbQueryList", path, e.message); return []; }
}

function userIdentity(user) {
  if (!user) return null;
  return { uid: user.uid || user.id || "", email: user.email || "", displayName: user.displayName || user.name || "", photoURL: user.photoURL || "" };
}

async function apiFetch(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  let finalOptions = { ...options };
  if (method !== "GET") {
    let body = options.body ? JSON.parse(options.body) : {};
    if (!body.idToken) {
      const token = await getFirebaseIdToken().catch(() => null);
      if (token) body = { ...body, idToken: token };
    }
    finalOptions.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...finalOptions,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || "Request failed.");
  if (method !== "GET") { _cacheClear(); clearCookies(); }
  return data;
}

// Career Paths — version-based cache (no TTL expiry, only re-fetches on version change)
export async function fetchCareerPaths() {
  const cached = _lsGetV("careerPaths");
  if (cached?.data) {
    _ensureVersions().then(vMap => {
      const remoteVersion = vMap?.careerPaths || null;
      if (remoteVersion && cached.version !== remoteVersion) {
        _fetchAndCacheCareerPaths().catch(() => {});
      }
    }).catch(() => {});
    return cached.data;
  }
  return _fetchAndCacheCareerPaths();
}

async function _fetchAndCacheCareerPaths() {
  const bundled = await fetchSiteConfig("careerPaths");
  let paths = bundled?.list || [];
  let categories = bundled?.categories || [];
  if (!paths.length) {
    paths = await dbList("careerPaths");
    const catData = await dbGet("siteConfig/domainCategories");
    categories = catData?.value || [];
  }
  const psData = await dbGet("siteConfig/paymentSettings");
  const ps = psData?.value || { defaultAmount: 200, defaultAmountReferral: 170, defaultTiming: "end" };
  const domainOverrides = (ps.domains || []).reduce((acc, d) => {
    if (d.domain) acc[d.domain.toLowerCase()] = d;
    return acc;
  }, {});
  const mergedPaths = paths.map((p) => {
    const override = domainOverrides[(p.title || "").toLowerCase()];
    if (override) {
      return { ...p, paymentAmount: override.amount || p.paymentAmount, paymentAmountReferral: override.amountReferral || p.paymentAmountReferral, paymentTiming: override.timing || p.paymentTiming || ps.defaultTiming };
    }
    return p;
  });
  const result = { paths: mergedPaths, categories };
  const vMap = await _ensureVersions().catch(() => null);
  const version = vMap?.careerPaths || "";
  _lsSetV("careerPaths", result, version);
  return result;
}

export async function saveCareerPaths(paths, categories) {
  _lsRemove("careerPaths");
  const body = { paths: paths || [] };
  if (categories) body.categories = categories;
  await apiFetch("/api/data/career-paths", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return paths;
}

// How It Works
// ── Session version map (in-memory, backed by localStorage) ──
let _sessionVersions = null;
let _sessionVersionsPromise = null;

const _dailyStamp = () => Math.floor(Date.now() / 86400000).toString(36);

async function _ensureVersions() {
  if (_sessionVersions) return _sessionVersions;
  if (_sessionVersionsPromise) return _sessionVersionsPromise;
  // Check localStorage for today's version map — zero server reads if fresh
  const local = _lsGetV("_versions");
  if (local?.data && local.version === _dailyStamp()) {
    _sessionVersions = local.data;
    return _sessionVersions;
  }
  _sessionVersionsPromise = _fetchVersions().then(v => {
    _sessionVersions = v || {};
    _lsSetV("_versions", _sessionVersions, _dailyStamp());
    return _sessionVersions;
  }).catch(() => { _sessionVersions = {}; return _sessionVersions; });
  return _sessionVersionsPromise;
}

// Call this on route change / visibility change to refresh the version map (cheap — 1 doc read)
export function refreshVersionMap() {
  _sessionVersions = null;
  _sessionVersionsPromise = null;
}

// ── Domain-scoped task version check (one partial field read) ──
// Fetches ONLY the taskVersion field from the enrollment doc.
// If matches localStorage, zero further reads. On mismatch, caller
// should fetch the full enrollment fresh.
const _domainVersionCache = new Map(); // enrollmentId → { version, promise }

export async function checkEnrollmentTaskVersion(enrollmentId) {
  const key = "enr_" + enrollmentId;
  const cached = _lsGetV(key);
  let remoteVersion;
  if (_domainVersionCache.has(enrollmentId)) {
    remoteVersion = await _domainVersionCache.get(enrollmentId);
  } else {
    const promise = _fetchEnrollmentTaskVersion(enrollmentId);
    _domainVersionCache.set(enrollmentId, promise);
    remoteVersion = await promise;
    _domainVersionCache.delete(enrollmentId);
  }
  if (cached && remoteVersion !== null && remoteVersion !== undefined && String(cached.version) === String(remoteVersion)) {
    console.log(`[cache] HIT enrollment:${enrollmentId}  v${remoteVersion}`);
    return { changed: false, data: cached.data };
  }
  console.log(`[cache] MISS enrollment:${enrollmentId}  local=${cached?.version || "none"} remote=${remoteVersion}`);
  return { changed: true, remoteVersion };
}

async function _fetchEnrollmentTaskVersion(enrollmentId) {
  try {
    const token = await getFirebaseIdToken().catch(() => null);
    const resp = await fetch(`${API_BASE}/api/data/enrollments/${encodeURIComponent(enrollmentId)}?fields=taskVersion`, {
      headers: token ? { "x-id-token": token } : {},
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.data?.taskVersion ?? null;
  } catch { return null; }
}

// ── User external status version check (one partial field read) ──
const _extVersionCache = new Map();

export async function checkUserExternalVersion(uid) {
  const key = "ext_" + uid;
  const cached = _lsGetV(key);
  let remoteVersion;
  if (_extVersionCache.has(uid)) {
    remoteVersion = await _extVersionCache.get(uid);
  } else {
    const promise = _fetchUserExternalVersion(uid);
    _extVersionCache.set(uid, promise);
    remoteVersion = await promise;
    _extVersionCache.delete(uid);
  }
  if (cached && remoteVersion !== null && remoteVersion !== undefined && String(cached.version) === String(remoteVersion)) {
    console.log(`[cache] HIT external:${uid}  v${remoteVersion}`);
    return { changed: false, data: cached.data };
  }
  console.log(`[cache] MISS external:${uid}  local=${cached?.version || "none"} remote=${remoteVersion}`);
  return { changed: true, remoteVersion };
}

async function _fetchUserExternalVersion(uid) {
  try {
    const resp = await fetch(`${API_BASE}/api/data/users/${encodeURIComponent(uid)}?fields=externalUpdateVersion`);
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.data?.externalUpdateVersion ?? null;
  } catch { return null; }
}

async function _versionedFetch(key, lsKey, fetcher, opts = {}) {
  const k = lsKey || key;
  const vKey = opts.versionKey || key;
  const vMap = await _ensureVersions();
  const remoteVersion = vMap[vKey] || null;

  // Version-tracked key
  if (remoteVersion) {
    const cached = _lsGetV(k);
    if (cached && cached.version === remoteVersion) return cached.data;
    const data = await fetcher();
    _lsSetV(k, data, remoteVersion);
    return data;
  }

  // Untracked key: TTL fallback
  const cached = _lsGet(k);
  if (cached !== null) return cached;
  const data = await fetcher();
  _lsSet(k, data, opts.ttl);
  return data;
}

export async function fetchHowItWorks() {
  return _versionedFetch("howItWorks", "howItWorks", async () => {
    const steps = await dbList("howItWorks");
    const sorted = steps.sort((a, b) => (a.step || 0) - (b.step || 0));
    return sorted.length ? sorted : FALLBACK_STEPS;
  });
}

export async function saveHowItWorks(steps) {
  _lsRemove("howItWorks");
  const now = new Date().toISOString();
  const obj = {};
  steps.forEach(step => { obj[step.id] = { ...step, updatedAt: now }; });
  if (Object.keys(obj).length) await dbPut("howItWorks", obj);
  return steps;
}

// FAQs
export async function fetchFAQs() {
  return _versionedFetch("faqs", "faqs", async () => {
    const faqs = await dbList("faqs");
    return faqs.length ? faqs : FALLBACK_FAQS;
  });
}

export async function saveFAQs(faqs) {
  _lsRemove("faqs");
  const now = new Date().toISOString();
  const obj = {};
  faqs.forEach(faq => { obj[faq.id] = { ...faq, updatedAt: now }; });
  if (Object.keys(obj).length) await dbPut("faqs", obj);
  return faqs;
}

// Templates
export async function fetchTemplates() {
  return _versionedFetch("templates", "templates", async () => {
    const d = await dbGet("config/templates");
    const raw = d?.value || null;
    if (!raw) return { templates: { "Offer Letter": "", "Certificate": "" }, templateOrder: ["Offer Letter", "Certificate"] };
    if (raw.templates) return { ...raw, templateOrder: raw.templateOrder || Object.keys(raw.templates) };
    return { templates: { "Offer Letter": raw.offer_letter || "", "Certificate": raw.certificate || "" }, templateOrder: ["Offer Letter", "Certificate"] };
  });
}

export async function saveTemplates(data) {
  _lsRemove("templates");
  await dbPut("config/templates", { value: data, updatedAt: new Date().toISOString() });
  return data;
}

// About Text
export async function fetchAboutText() {
  return _versionedFetch("aboutText", "aboutText", async () => {
    const d = await dbGet("config/aboutText");
    return d?.value || "";
  }, "aboutText");
}

export async function saveAboutText(text) {
  _lsRemove("aboutText");
  return saveSiteConfig("aboutText", text);
}

// Inquiries
export async function saveInquiry(inquiry) {
  return dbPost("inquiries", inquiry);
}

// User Profile
export async function fetchUserProfile(uid) {
  if (!uid) return null;
  const key = "profile_" + uid;
  const cached = _authCacheGet(key);
  if (cached !== null) return cached;
  const data = await dbGet(`users/${uid}`);
  if (data) _authCacheSet(key, data, 300000);
  return data;
}

export async function saveUserProfile(uid, profile) {
  const data = await apiFetch(`/api/data/users/${uid}`, {
    method: "POST",
    body: JSON.stringify({ profile }),
  });
  _authCache.delete("profile_" + uid);
  return data;
}

export function hideEnrollmentFromUser(uid, enrollmentId) {
  const key = `hiddenEnrollments_${uid}`;
  const hidden = JSON.parse(localStorage.getItem(key) || "[]");
  if (!hidden.includes(enrollmentId)) {
    hidden.push(enrollmentId);
    localStorage.setItem(key, JSON.stringify(hidden));
  }
}

export function getHiddenEnrollments(uid) {
  const key = `hiddenEnrollments_${uid}`;
  return JSON.parse(localStorage.getItem(key) || "[]");
}

export function unhideEnrollmentFromUser(uid, enrollmentId) {
  const key = `hiddenEnrollments_${uid}`;
  const hidden = JSON.parse(localStorage.getItem(key) || "[]");
  const updated = hidden.filter((id) => id !== enrollmentId);
  localStorage.setItem(key, JSON.stringify(updated));
}

// Enrollment
function parseDurationToMs(duration) {
  if (!duration) return 28 * 24 * 60 * 60 * 1000;
  const num = parseInt(duration, 10);
  if (isNaN(num)) return 28 * 24 * 60 * 60 * 1000;
  const unit = duration.toLowerCase().includes("month") ? "month"
    : duration.toLowerCase().includes("week") ? "week"
    : duration.toLowerCase().includes("day") ? "day"
    : "week";
  const multipliers = { day: 1, week: 7, month: 30 };
  return num * (multipliers[unit] || 7) * 24 * 60 * 60 * 1000;
}

export async function enrollStudent(uid, profile, domainObj) {
  const detectedReferralCode = localStorage.getItem("detected_referral_code") || "";
  const refCode = detectedReferralCode.toUpperCase().trim();
  const psData = await dbGet("siteConfig/paymentSettings");
  const ps = psData?.value || { defaultAmount: 200, defaultAmountReferral: 170 };
  const isReferral = !!refCode;
  const domainAmount = domainObj.paymentAmount || (isReferral ? ps.defaultAmountReferral : ps.defaultAmount);
  const paymentTiming = domainObj.paymentTiming || ps.defaultTiming || "end";
  const splitPercent = domainObj.paymentSplitPercent || ps.defaultSplitPercent || 50;
  const pmtStart = paymentTiming === "both" ? Math.round(domainAmount * splitPercent / 100) : 0;
  const pmtEnd = paymentTiming === "both" ? domainAmount - pmtStart : domainAmount;
  const internId = `DEV-CRAFT-${Date.now().toString(36).toUpperCase().slice(-6).padStart(6, '0')}`;
  const now = new Date();
  const createdAt = now.toISOString();
  const durationMs = parseDurationToMs(domainObj.duration);
  const deadline = new Date(now.getTime() + durationMs).toISOString();
  const enrollment = {
    internId, uid, name: profile.name || profile.displayName || "Student", email: profile.email || "", photoURL: profile.photoURL || "",
    phone: profile.phone || "", college: profile.college || "", city: profile.city || "", country: profile.country || "", upiId: profile.upiId || "",
    domain: domainObj.title || domainObj.name || "", domainId: domainObj.id || "", projects: domainObj.projects || [],
    duration: domainObj.duration || "",
    referralCode: refCode, status: "Active", allowedCertificate: "no", submissions: {},
    deadline, createdAt, updatedAt: createdAt,
    paymentStatus: "none", paymentStage: "none", paymentAmount: domainAmount,
    paymentStartAmount: pmtStart, paymentEndAmount: pmtEnd, paymentTiming, paymentIntentId: "", overrideCompleted: false,
  };
  await dbPut(`enrollments/${internId}`, enrollment);
  enrollment.id = internId;
  if (refCode) {
    const ref = await dbGet(`referrals/${refCode}/contacted`);
    await dbPatch(`referrals/${refCode}`, { contacted: (ref || 0) + 1, updatedAt: new Date().toISOString() });
    const existingUser = await dbGet(`referralUsers/${refCode}/${uid}`);
    await dbPut(`referralUsers/${refCode}/${uid}`, { uid, email: profile.email || "", displayName: profile.name || profile.displayName || "", code: refCode, firstLoginAt: existingUser?.firstLoginAt || new Date().toISOString(), enrolledAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  if (detectedReferralCode) localStorage.removeItem("detected_referral_code");
  return enrollment;
}

export async function fetchEnrollments() { return dbList("enrollments"); }

export async function fetchUserEnrollments(uid, email, opts) {
  const list = await dbQueryList("enrollments", "uid", uid, opts);
  // Also fetch by email to catch manually-added interns where uid was not set
  if (email) {
    try {
      const emailList = await dbQueryList("enrollments", "email", email, opts);
      const existingIds = new Set(list.map((e) => e.id));
      const patches = [];
      for (const e of emailList) {
        if (!existingIds.has(e.id)) {
          if (!e.uid || e.uid === "") {
            patches.push(dbPatch(`enrollments/${e.id}`, { uid, updatedAt: new Date().toISOString() }).catch(() => {}));
          }
          list.push(e);
          existingIds.add(e.id);
        }
      }
      // Fire uid patches in background
      if (patches.length > 0) Promise.all(patches).catch(() => {});
    } catch {}
  }
  return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function updateEnrollmentStatus(enrollmentId, status) {
  await apiFetch(`/api/data/enrollments/${encodeURIComponent(enrollmentId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function submitTransactionId(enrollmentId, transactionId) {
  await dbPatch(`enrollments/${enrollmentId}`, { transactionId, updatedAt: new Date().toISOString() });
}

export async function recordReferralLogin(referralCode, user) {
  if (!referralCode || !user?.uid) return null;
  const code = referralCode.toUpperCase().trim();
  const now = new Date().toISOString();
  const existing = await dbGet(`referralUsers/${code}/${user.uid}`);
  await dbPut(`referralUsers/${code}/${user.uid}`, { ...userIdentity(user), code, uid: user.uid, firstLoginAt: existing?.firstLoginAt || now, lastLoginAt: now, updatedAt: now });
  await dbPatch(`referrals/${code}`, { lastActivityAt: now, updatedAt: now });
  return { code };
}

export async function allowCertificate(enrollmentId, allowed) {
  await dbPatch(`enrollments/${enrollmentId}`, { allowedCertificate: allowed, updatedAt: new Date().toISOString() });
}

export async function verifyInternship(enrollmentId) {
  const enrollment = await dbGet(`enrollments/${enrollmentId}`);
  if (!enrollment) return null;
  const projects = enrollment.projects || [];
  const submissions = enrollment.submissions || {};
  const allVerified = projects.length > 0 && projects.every((_, i) => submissions[i]?.verified);
  const submittedCount = projects.filter((_, i) => submissions[i]?.submittedAt).length;
  return {
    ...enrollment,
    status: allVerified ? "Completed" : "Incomplete",
    allVerified,
    submittedCount,
    totalTasks: projects.length,
  };
}

export async function submitProject(enrollmentId, projectIndex, submissionText, submissionUrl = "") {
  await apiFetch(`/api/data/enrollments/${enrollmentId}/projects/${projectIndex}/submit`, {
    method: "POST",
    body: JSON.stringify({ submissionText, submissionUrl }),
  });
  // Optimistic local update — no re-read
  _optimisticUpdateEnrollment(enrollmentId, (enr) => {
    const subs = { ...(enr.submissions || {}) };
    subs[projectIndex] = {
      ...(subs[projectIndex] || {}),
      text: submissionText,
      url: submissionUrl,
      submittedAt: new Date().toISOString(),
      verified: false, rejected: false, resubmit: false,
    };
    return { ...enr, submissions: subs };
  });
}

function _optimisticUpdateEnrollment(enrollmentId, updater) {
  const cached = _lsGetV("enr_" + enrollmentId);
  if (cached) {
    const updated = updater(cached.data);
    _lsSetV("enr_" + enrollmentId, updated, cached.version);
  }
}

export async function submitQuizAnswer(enrollmentId, projectIndex, answers, project) {
  await apiFetch(`/api/data/enrollments/${enrollmentId}/projects/${projectIndex}/quiz`, {
    method: "POST",
    body: JSON.stringify({ answers, project }),
  });
}

export async function verifyProject(enrollmentId, projectIndex) {
  await apiFetch(`/api/data/enrollments/${enrollmentId}/projects/${projectIndex}/verify`, {
    method: "POST",
  });
}

export async function saveProjectFeedback(enrollmentId, projectIndex, feedback) {
  await apiFetch(`/api/data/enrollments/${enrollmentId}/projects/${projectIndex}/feedback`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

export async function rejectProject(enrollmentId, projectIndex, feedback) {
  await apiFetch(`/api/data/enrollments/${enrollmentId}/projects/${projectIndex}/reject`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

export async function fetchEnrollmentById(enrollmentId) {
  const data = await dbGet(`enrollments/${enrollmentId}`);
  return data ? { id: enrollmentId, ...data } : null;
}

export async function fetchAdminData() {
  const [requests, referrals, visits, siteVisits] = await Promise.all([
    dbList("enrollments"),
    dbList("referrals"),
    _rtdbReadList("referralVisits"),
    _rtdbReadList("siteVisits"),
  ]);
  return {
    requests: requests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    referrals,
    visits: visits.sort((a, b) => new Date(b.visitedAt || 0) - new Date(a.visitedAt || 0)).slice(0, 100),
    siteVisits: siteVisits.sort((a, b) => new Date(b.visitedAt || 0) - new Date(a.visitedAt || 0)).slice(0, 100),
  };
}

export async function isReferralCodeMatched(referralCode) {
  if (!referralCode) return false;
  const code = referralCode.toUpperCase().trim();
  const key = "refmatch_" + code;
  const cached = _authCacheGet(key);
  if (cached !== null) return cached;
  const data = await dbGet(`referrals/${code}`);
  const result = !!data;
  _authCacheSet(key, result, 300000);
  return result;
}

export async function deleteReferral(code) { await dbDelete(`referrals/${code.toUpperCase().trim()}`); }

export async function deleteEnrollment(enrollmentId) {
  await apiFetch(`/api/data/enrollments/${encodeURIComponent(enrollmentId)}`, { method: "DELETE" });
}

export async function createReferral(details) {
  const namePart = (details.name || "REF").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "REF";
  const code = (details.code || `${namePart}-${Date.now().toString(36).toUpperCase().slice(-4)}`).toUpperCase().trim();
  const referral = { id: code, code, ...details, visited: 0, contacted: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await dbPut(`referrals/${code}`, referral);
  return referral;
}

export function getDeviceFingerprint() {
  const KEY = "_device_fp";
  let fp = localStorage.getItem(KEY);
  if (fp) return fp;
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height + "x" + screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || "",
    navigator.deviceMemory || "",
  ];
  let hash = 0;
  const str = components.join("|||");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  fp = "fp_" + Math.abs(hash).toString(36);
  localStorage.setItem(KEY, fp);
  return fp;
}

export async function trackReferralVisit(referralCode) {
  if (!referralCode) return null;
  const code = referralCode.toUpperCase().trim();
  const now = new Date().toISOString();
  const fingerprint = getDeviceFingerprint();
  const visitData = {
    action: "visited", referralCode: code, visitedAt: now,
    link: window.location.href, language: navigator.language || "",
    browser: navigator.userAgent || "",
    fingerprint,
    screen: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  };
  const result = await _rtdbAppend("referralVisits", visitData);
  if (result) {
    const refData = await dbGet(`referrals/${code}/visited`);
    await dbPatch(`referrals/${code}`, { visited: (refData || 0) + 1, lastVisitedAt: now, updatedAt: now });
    return result;
  }
  // Fallback to server
  const data = await apiFetch("/api/data/referral-visits", {
    method: "POST",
    body: JSON.stringify(visitData),
  });
  return data.data || null;
}

export async function associateVisitsWithUser(fingerprint, email, name, uid) {
  if (!fingerprint) return;
  const now = new Date().toISOString();
  const update = { userId: uid || null, userEmail: email || null, userName: name || null, associatedAt: now };
  try {
    // Update referralVisits in RTDB
    const rv = await _rtdbReadList("referralVisits");
    const rvUpdates = rv.filter(v => v.fingerprint === fingerprint);
    for (const v of rvUpdates) await _rtdbPatch(`referralVisits/${v.id}`, update);
    // Update siteVisits in RTDB
    const sv = await _rtdbReadList("siteVisits");
    const svUpdates = sv.filter(v => v.fingerprint === fingerprint);
    for (const v of svUpdates) await _rtdbPatch(`siteVisits/${v.id}`, update);
  } catch (e) {
    console.warn("Could not associate visits via RTDB:", e.message);
    // Fallback to server
    try {
      await apiFetch("/api/data/associate-visits", {
        method: "POST",
        body: JSON.stringify({ fingerprint, email, name, uid }),
      });
    } catch (e) { console.warn("getDeviceFingerprint backup:", e.message); }
  }
}

export async function processReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("ref") || params.get("referral") || "").trim().toUpperCase();
  if (!code) return { code: "", matched: false };
  const matched = await isReferralCodeMatched(code);
  if (matched) {
    localStorage.setItem("detected_referral_code", code);
    const visitedKey = `_ref_visited_${code}`;
    if (!sessionStorage.getItem(visitedKey)) {
      sessionStorage.setItem(visitedKey, "1");
      await trackReferralVisit(code);
    }
  }
  return { code, matched };
}

export async function markReferralContacted(referralCode) {
  const code = referralCode.toUpperCase().trim();
  const ref = await dbGet(`referrals/${code}/contacted`);
  await dbPatch(`referrals/${code}`, { contacted: (ref || 0) + 1, lastContactedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function checkAdminStatus(email) {
  const cleanEmail = (email || "").toLowerCase().trim();
  const key = "admin_" + cleanEmail;
  const cached = _authCacheGet(key);
  if (cached !== null) return cached;
  const emailId = cleanEmail.replace(/\./g, ",");
  const data = await dbGet(`admins/${emailId}`);
  const result = { isAdmin: !!data };
  _authCacheSet(key, result, 300000);
  return result;
}

export async function fetchAdmins() {
  const list = await dbList("admins");
  return list.map(a => a.email || a.id);
}

export async function addAdmin(email) {
  await apiFetch("/api/data/admins", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function fetchRootAdmin() {
  try {
    const data = await fetchSiteConfig("rootAdmin");
    return data?.email || null;
  } catch { return null; }
}

export async function setRootAdmin(email) {
  await saveSiteConfig("rootAdmin", { email, setAt: new Date().toISOString() });
}

export async function removeAdmin(email) {
  await apiFetch(`/api/data/admins/${encodeURIComponent(email.toLowerCase().trim())}`, {
    method: "DELETE",
  });
}

export async function createSelfReferral(details, uid) {
  return apiFetch("/api/data/self-referrals", {
    method: "POST",
    body: JSON.stringify({ uid, details }),
  });
}

export async function fetchSelfReferralCode(uid) {
  const key = "selfref_" + uid;
  const cached = _authCacheGet(key);
  if (cached !== null) return cached;
  const data = await dbGet(`selfReferralOwners/${uid}`);
  const result = data?.code || null;
  _authCacheSet(key, result, 300000);
  return result;
}

export async function autoAssignReferralCode(uid, profile) {
  if (!uid || !profile?.upiId) return null;
  const existing = await fetchSelfReferralCode(uid);
  if (existing) return existing;
  const payload = {
    name: profile.name || "",
    email: profile.email || "",
    phone: profile.phone || "",
    college: profile.college || "",
    city: profile.city || "",
    country: profile.country || "",
    upiId: profile.upiId,
  };
  try {
    const res = await createSelfReferral(payload, uid);
    if (res?.data?.code) _authCache.delete("selfref_" + uid);
    return res?.data?.code || null;
  } catch (e) {
    console.warn("Auto-assign referral code failed:", e.message);
    return null;
  }
}

export async function fetchReferralDashboardData(uid) {
  const owner = await dbGet(`selfReferralOwners/${uid}`);
  if (!owner?.code) return { referral: null, visits: [], interns: [], totals: { visits: 0, interns: 0, completed: 0, earnings: 0 }, totalVisits: 0, totalLogins: 0, totalEnrolled: 0, completedInterns: 0, enrolledInterns: [], rewardPerCompletion: 20, milestoneBonus: 1000, milestoneCount: 50 };
  const code = owner.code.toUpperCase().trim();
  const [allVisits, referral, interns, earnSettings] = await Promise.all([
    _rtdbReadList("referralVisits"),
    dbGet(`referrals/${code}`),
    dbQueryList("enrollments", "referralCode", code),
    fetchEarnSettings(),
  ]);
  const visits = allVisits.filter(v => v.referralCode === code);
  const completed = interns.filter(i => i.status === "Completed" && i.paymentStatus === "paid");
  const rewardPerCompletion = earnSettings?.rewardPerCompletion || 20;
  const milestoneBonus = earnSettings?.milestoneBonus || 1000;
  const milestoneCount = earnSettings?.milestoneCount || 50;
  const earnings = completed.length * rewardPerCompletion + Math.floor(completed.length / milestoneCount) * milestoneBonus;
  const loginUsers = await dbQueryList("referralUsers", "code", code);
  const totalLogins = loginUsers.length;
  const referredUsers = loginUsers.map(ru => {
    const enrollment = interns.find(i => i.uid === ru.uid);
    let status = "loggedin";
    if (enrollment) {
      if (enrollment.status === "Completed") status = "completed";
      else if (enrollment.paymentStatus === "paid") status = "paid";
      else status = "assigned domain";
    }
    return {
      name: ru.displayName || ru.email?.split("@")[0] || "Unknown",
      email: ru.email || "",
      domain: enrollment?.domain || "-",
      status,
      paymentStatus: enrollment?.paymentStatus || "none",
      uid: ru.uid,
      firstLoginAt: ru.firstLoginAt,
      enrolledAt: ru.enrolledAt || null,
    };
  });
  return {
    referral, visits, interns,
    totals: { visits: visits.length, interns: interns.length, completed: completed.length, earnings },
    totalVisits: referral?.visited || 0,
    totalLogins,
    totalEnrolled: interns.length,
    completedInterns: completed.length,
    enrolledInterns: interns,
    referredUsers,
    code,
    rewardPerCompletion,
    milestoneBonus,
    milestoneCount,
  };
}

export async function fetchUserReferralStat(email) {
  if (!email) return null;
  const key = "refstat_" + email;
  const cached = _authCacheGet(key);
  if (cached !== null) return cached;
  const list = await dbQueryList("referrals", "email", email);
  if (!list.length) return null;
  const referral = list[0];
  const code = (referral.code || referral.id || "").toUpperCase().trim();
  const interns = await dbQueryList("enrollments", "referralCode", code);
  const completed = interns.filter(i => i.status === "Completed").length;
  const result = {
    referral, interns, internCount: interns.length, completed,
    visited: referral.visited || 0,
    assignedInternships: interns.length,
    completedInterns: completed,
  };
  _authCacheSet(key, result, 300000);
  return result;
}

export async function fetchAdminReferralUsersWithInterns() {
  const [referrals, allEnrollments, earnSettings] = await Promise.all([
    dbList("referrals"),
    dbList("enrollments"),
    fetchEarnSettings(),
  ]);
  const rewardPerCompletion = earnSettings?.rewardPerCompletion || 20;
  const milestoneBonus = earnSettings?.milestoneBonus || 1000;
  const milestoneCount = earnSettings?.milestoneCount || 50;
  return referrals
    .filter((r) => r.upiId && r.upiId.trim())
    .map(r => {
    const code = (r.code || r.id || "").toUpperCase().trim();
    const interns = allEnrollments.filter(e => (e.referralCode || "").toUpperCase().trim() === code);
    const paidCompleted = interns.filter(i => i.status === "Completed" && i.paymentStatus === "paid");
    const earnings = paidCompleted.length * rewardPerCompletion + Math.floor(paidCompleted.length / milestoneCount) * milestoneBonus;
    return { ...r, code, internCount: interns.length, interns, earnings, paidCompletedCount: paidCompleted.length };
  });
}

export async function savePermanentReferralCode(uid, code) {
  if (!uid || !code) return null;
  await apiFetch(`/api/data/users/${uid}/permanent-referral`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return { code: code.toUpperCase().trim() };
}

export async function fetchPermanentReferralCode(uid) {
  const user = await dbGet(`users/${uid}`);
  return user?.permanentReferralCode || null;
}

export async function fetchEarnSettings() {
  return fetchSiteConfig("earnSettings");
}

export async function saveEarnSettings(settings) {
  _lsRemove("earnSettings");
  await dbPut("siteConfig/earnSettings", { value: settings, updatedAt: new Date().toISOString() });
  return settings;
}

export async function fetchEarnDetails() {
  return fetchSiteConfig("earnDetails");
}

export async function saveEarnDetails(details) {
  _lsRemove("earnDetails");
  return saveSiteConfig("earnDetails", details);
}

export async function fetchBannedUsers() { return dbList("bannedUsers"); }

export async function checkUserBan(email) {
  const cleanEmail = (email || "").toLowerCase().trim();
  const key = "ban_" + cleanEmail;
  const cached = _authCacheGet(key);
  if (cached !== null) return cached;
  const emailId = cleanEmail.replace(/\./g, ",");
  const result = await dbGet(`bannedUsers/${emailId}`);
  _authCacheSet(key, result, 300000);
  return result;
}

export async function banUser(email, banType, reason, bannedBy) {
  const emailId = email.toLowerCase().trim().replace(/\./g, ",");
  await dbPut(`bannedUsers/${emailId}`, { email: email.toLowerCase().trim(), banType, reason, bannedBy, bannedAt: new Date().toISOString() });
}

export async function unbanUser(email) {
  await dbDelete(`bannedUsers/${email.toLowerCase().trim().replace(/\./g, ",")}`);
}

export async function fetchAdminMessages(userEmail, { context, uid } = {}) {
  const msgs = await dbList("adminMessages");
  const now = new Date();
  return msgs.filter(m => {
    if (m.expiresAt && new Date(m.expiresAt) < now) return false;
    if (m.target && m.target !== "all" && m.target.toLowerCase() !== String(userEmail).toLowerCase()) return false;
    if (context && m.context && m.context !== context) return false;
    if (uid && m.acknowledgedBy?.[uid]) return false;
    return true;
  });
}

export async function fetchAllAdminMessages() { return dbList("adminMessages"); }

export async function saveAdminMessage(message) {
  return dbPost("adminMessages", { ...message, acknowledgedBy: {} });
}

export async function acknowledgeAdminMessage(messageId, uid, userInfo = {}) {
  await dbPut(`adminMessages/${messageId}/acknowledgedBy/${uid}`, { ...userInfo, uid, acknowledgedAt: new Date().toISOString() });
}

export async function deleteAdminMessage(id) { await dbDelete(`adminMessages/${id}`); }

export async function saveSiteNotice(notice) {
  return dbPost("siteNotices", { ...notice, active: true });
}

export async function fetchSiteNotices() {
  const list = await dbList("siteNotices");
  return list.filter(n => n.active !== false);
}

export async function toggleSiteNotice(id, active) {
  await dbPatch(`siteNotices/${id}`, { active, updatedAt: new Date().toISOString() });
}

export async function deleteSiteNotice(id) { await dbDelete(`siteNotices/${id}`); }

export async function fetchHomepageContent() {
  return fetchSiteConfig("homepage");
}

export async function saveHomepageContent(content) {
  _lsRemove("homepageContent");
  return saveSiteConfig("homepageContent", content);
}

// ─── Enhanced Visit Tracking ───────────────────────────────────────────────
function _parseBrowser(ua) {
  const u = (ua || "").toLowerCase();
  let name = "Unknown", version = "", os = "";
  if (u.includes("firefox/") && !u.includes("seamonkey")) { name = "Firefox"; const m = u.match(/firefox\/([\d.]+)/); if (m) version = m[1]; }
  else if (u.includes("edg/") || u.includes("edge/")) { name = "Edge"; const m = u.match(/edg[ea]?\/([\d.]+)/); if (m) version = m[1]; }
  else if (u.includes("chrome/") && !u.includes("edg") && !u.includes("opr/")) { name = "Chrome"; const m = u.match(/chrome\/([\d.]+)/); if (m) version = m[1]; }
  else if (u.includes("safari/") && !u.includes("chrome")) { name = "Safari"; const m = u.match(/version\/([\d.]+)/); if (m) version = m[1]; }
  else if (u.includes("opr/") || u.includes("opera")) { name = "Opera"; const m = u.match(/(?:opr|opera)\/([\d.]+)/); if (m) version = m[1]; }
  if (u.includes("windows nt 10")) os = "Windows 10";
  else if (u.includes("windows nt 11")) os = "Windows 11";
  else if (u.includes("mac os x")) os = "macOS";
  else if (u.includes("android")) os = "Android";
  else if (u.includes("linux")) os = "Linux";
  else if (u.includes("iphone") || u.includes("ipad")) os = "iOS";
  return { name, version, os };
}

function _detectTor() {
  const ua = (navigator.userAgent || "").toLowerCase();
  // Tor Browser signs: no WebRTC, specific fonts, userAgent patterns
  const noWebrtc = typeof RTCPeerConnection === "undefined" && typeof webkitRTCPeerConnection === "undefined";
  const torUA = ua.includes("tor") || ua.includes("torbrowser");
  const noPlugins = navigator.plugins?.length === 0;
  return torUA || (noWebrtc && noPlugins);
}

function _toIST(date) {
  const d = new Date(date);
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().replace("T", " ").slice(0, 19) + " IST";
}

function _fetchGeo() { return null; }

export async function associateDeviceWithUser(fingerprint, user) {
  if (!fingerprint || !user?.uid) return;
  const now = new Date().toISOString();
  const data = { fingerprint, uid: user.uid, email: user.email || "", displayName: user.displayName || user.name || "", lastSeenAt: now, firstSeenAt: now };
  const r = await _rtdbPut(`deviceUsers/${fingerprint}`, data);
  if (r) return r;
  // Fallback to Firestore
  try { await dbPut(`deviceUsers/${fingerprint}`, data); } catch (e) { console.warn("dbPut deviceUsers:", e.message); }
}

export async function getDeviceUser(fingerprint) {
  if (!fingerprint) return null;
  const data = await _rtdbRead(`deviceUsers/${fingerprint}`);
  if (data) return data;
  // Fallback to Firestore
  try { return await dbGet(`deviceUsers/${fingerprint}`); } catch { return null; }
}

export async function trackSiteVisit() {
  const fingerprint = getDeviceFingerprint();
  const ua = navigator.userAgent || "";
  const browser = _parseBrowser(ua);
  const now = new Date();
  const visitedAtUTC = now.toISOString();
  const visitedAtIST = _toIST(now);
  const isTor = _detectTor();
  // Check if this device is known to belong to a user
  const knownUser = await getDeviceUser(fingerprint);
  // Fetch IP geolocation (fire-and-forget with timeout, don't block visit tracking)
  const geoPromise = _fetchGeo();
  // Build the visit record
  const baseVisit = {
    visitedAt: visitedAtUTC,
    visitedAtIST,
    userAgent: ua,
    language: navigator.language || "",
    referrer: document.referrer || "",
    url: window.location.href || "",
    screen: `${window.screen?.width || "?"}x${window.screen?.height || "?"}`,
    viewport: `${window.innerWidth || "?"}x${window.innerHeight || "?"}`,
    fingerprint,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    browserName: browser.name,
    browserVersion: browser.version,
    os: browser.os,
    isTor,
    isMobile: /mobile|android|iphone|ipad/i.test(ua),
    isTablet: /ipad|tablet/i.test(ua),
    knownUser: knownUser ? { uid: knownUser.uid, name: knownUser.displayName, email: knownUser.email } : null,
  };
  // Try RTDB first (public write allowed)
  let geo = null;
  try { geo = await geoPromise; } catch (e) { console.warn("geo fetch:", e.message); }
  const visit = { ...baseVisit, ...(geo || {}) };
  if (typeof rtdb !== "undefined" && rtdb) {
    const result = await _rtdbAppend("siteVisits", visit);
    if (result) {
      // If user is logged in, auto-associate this device
      const authUser = knownUser || null;
      return result;
    }
  }
  // Fallback to Firestore proxy
  return dbPost("siteVisits", visit);
}

export async function markReferralAchieved(referralCode, achieved) {
  const code = referralCode.toUpperCase().trim();
  await dbPatch(`referrals/${code}`, { achieved, achievedAt: achieved ? new Date().toISOString() : null, updatedAt: new Date().toISOString() });
}

export async function markEnrollmentComplete(enrollmentId) {
  await dbPatch(`enrollments/${enrollmentId}`, { status: "Completed", allowedCertificate: "yes", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function rejectEnrollmentCompletion(enrollmentId, reason) {
  await dbPatch(`enrollments/${enrollmentId}`, { completionRejectedAt: new Date().toISOString(), completionRejectReason: reason, updatedAt: new Date().toISOString() });
}

export async function clearCompletionRejection(enrollmentId) {
  await dbPatch(`enrollments/${enrollmentId}`, { completionRejectedAt: null, completionRejectReason: null, updatedAt: new Date().toISOString() });
}

export async function autoUnachieveIfActivity() { return { unachieved: false }; }

export async function verifyTaskWithAI(params) {
  const data = await apiFetch("/api/ai/verify-task", { method: "POST", body: JSON.stringify(params) });
  return { success: true, data: data.data };
}

export async function fetchAiPendingEnrollments() {
  try {
    const res = await apiFetch("/api/data/enrollments");
    return (res.data || []).filter(e => e.status === "Active");
  } catch { return []; }
}

export async function fetchUPISettings() {
  return fetchSiteConfig("upiSettings");
}

export async function saveUPISettings(settings) {
  _lsRemove("upiSettings");
  await dbPut("siteConfig/upiSettings", { value: settings, updatedAt: new Date().toISOString() });
  return settings;
}

export async function fetchPaymentSettings() {
  return fetchSiteConfig("paymentSettings");
}

export async function savePaymentSettings(settings) {
  _lsRemove("paymentSettings");
  return saveSiteConfig("paymentSettings", settings);
}

export async function unverifyProject(enrollmentId, projectIndex) {
  await apiFetch(`/api/data/enrollments/${enrollmentId}/projects/${projectIndex}/unverify`, {
    method: "POST",
  });
}

export async function unverifyPayment(enrollmentId, reason) {
  await dbPatch(`enrollments/${enrollmentId}`, { paymentStatus: "none", paymentStage: "none", paidAt: null, paymentIntentId: "", allowedCertificate: "no", paymentUnverifyReason: reason, updatedAt: new Date().toISOString() });
}

export async function updatePaymentStatus(enrollmentId, paymentStatus, paymentStage) {
  const now = new Date().toISOString();
  const patch = { paymentStatus, paymentStage, updatedAt: now };
  if (paymentStatus === "paid") {
    patch.paidAt = now;
    if (paymentStage === "start" || !paymentStage) patch.paymentStage = "start_paid";
    if (paymentStage === "end" || paymentStage === "full") patch.paymentStage = "fully_paid";
  }
  await dbPatch(`enrollments/${enrollmentId}`, patch);
}

export async function setPaymentAmount(enrollmentId, paymentAmount) {
  await dbPatch(`enrollments/${enrollmentId}`, { paymentAmount, updatedAt: new Date().toISOString() });
}

export async function fetchPaymentHistory(enrollmentId) {
  try {
    const token = await getFirebaseIdToken().catch(() => null);
    const res = await fetch(`${API_BASE}/api/payment-history/${enrollmentId}`, {
      headers: token ? { "x-id-token": token } : {},
    });
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}

export async function updateEnrollmentField(enrollmentId, field, value) {
  await dbPatch(`enrollments/${enrollmentId}`, { [field]: value, updatedAt: new Date().toISOString() });
}

export async function adminUpdateEnrollment(enrollmentId, updates) {
  return apiFetch(`/api/data/admin-update-enrollment/${enrollmentId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function adminDownloadDoc(enrollmentId, docType) {
  const { getFirebaseIdToken } = await import("../firebase");
  const idToken = await getFirebaseIdToken();
  return apiFetch(`/api/data/admin-download/${enrollmentId}`, {
    method: "POST",
    body: JSON.stringify({ type: docType, idToken }),
  });
}

export async function createEnrollment(data) {
  const id = data.internId || `DEV-CRAFT-${Date.now().toString(36).toUpperCase().slice(-6).padStart(6, "0")}`;
  const isCompleted = data.status === "Completed";
  const projects = data.projects || [];
  // If status is Completed, auto-verify all submissions and set transactionId
  let submissions = data.submissions || {};
  let transactionId = data.transactionId || "";
  if (isCompleted && projects.length > 0 && Object.keys(submissions).length === 0) {
    submissions = {};
    projects.forEach((_, i) => { submissions[i] = { verified: true, verifiedAt: new Date().toISOString() }; });
  }
  if (isCompleted && !transactionId) {
    transactionId = `manual_${id}_${Date.now()}`;
  }
  // Parse dates properly
  const now = new Date();
  const createdAt = data.createdAt || now.toISOString();
  const parseDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };
  const startDate = parseDate(data.startDate);
  const endDate = parseDate(data.endDate);
  const completedAt = isCompleted && !data.completedAt ? now.toISOString() : parseDate(data.completedAt);
  // Calculate deadline: use endDate if provided, otherwise use duration from startDate
  const durationMs = parseDurationToMs(data.duration);
  const deadlineStart = startDate ? new Date(startDate) : new Date(createdAt);
  const deadline = endDate || new Date(deadlineStart.getTime() + durationMs).toISOString();
  const enrollment = {
    id,
    internId: id,
    uid: data.uid || "",
    name: data.name || "Student",
    email: data.email || "",
    photoURL: data.photoURL || "",
    phone: data.phone || "",
    college: data.college || "",
    city: data.city || "",
    country: data.country || "",
    upiId: data.upiId || "",
    domain: data.domain || "",
    domainId: data.domainId || "",
    projects,
    duration: data.duration || "",
    referralCode: (data.referralCode || "").toUpperCase().trim(),
    status: data.status || "Active",
    allowedCertificate: isCompleted ? "yes" : (data.allowedCertificate || "no"),
    submissions,
    paymentStatus: isCompleted ? "paid" : (data.paymentStatus || "none"),
    paymentStage: isCompleted ? "fully_paid" : (data.paymentStage || "none"),
    paymentAmount: data.paymentAmount || 0,
    paymentStartAmount: data.paymentStartAmount || 0,
    paymentEndAmount: data.paymentEndAmount || 0,
    paymentTiming: data.paymentTiming || "end",
    paymentIntentId: data.paymentIntentId || "",
    transactionId,
    overrideCompleted: data.overrideCompleted || false,
    startDate,
    endDate,
    deadline,
    completedAt,
    createdAt,
    updatedAt: now.toISOString(),
  };
  await dbPut(`enrollments/${id}`, enrollment);
  return enrollment;
}

export async function aiGradeQuiz(questions, answers) {
  const data = await apiFetch("/api/ai/grade-quiz", { method: "POST", body: JSON.stringify({ questions, answers }) });
  return data.data;
}

export async function fetchPaymentStats() {
  const enrollments = await dbList("enrollments");
  const paidEnrollments = enrollments.filter(e => e.paymentStatus === "paid");
  const referrals = await dbList("referrals");
  const psData = await dbGet("siteConfig/paymentSettings");
  const ps = psData?.value || {};
  const defaultAmount = ps.defaultAmount || 200;
  const defaultAmountReferral = ps.defaultAmountReferral || 170;
  const totalCollected = paidEnrollments.reduce((sum, e) => sum + (e.paymentAmount || 0), 0);
  const referralPayouts = referrals.map(r => {
    const code = (r.code || r.id || "").toUpperCase().trim();
    const interns = enrollments.filter(e => (e.referralCode || "").toUpperCase().trim() === code && e.status === "Completed");
    const completedPaid = interns.filter(i => i.paymentStatus === "paid");
    const earnings = completedPaid.reduce((s, i) => s + Math.max(0, (i.paymentAmount || defaultAmount) - defaultAmountReferral), 0);
    return { code: r.code || r.id, name: r.name, email: r.email, earned: earnings, interns: interns.length, completedPaid: completedPaid.length, payoutStatus: r.payoutStatus || "pending", payoutAt: r.payoutAt || null, payoutAmount: r.payoutAmount || null };
  });
  const totalDistribute = referralPayouts.reduce((s, r) => s + r.earned, 0);
  return { totalCollected, totalDistribute, netTotal: totalCollected - totalDistribute, paidEnrollments: paidEnrollments.length, referralPayouts };
}

export async function resetRevenue() {
  const stats = await fetchPaymentStats();
  const entry = { ...stats, resetAt: new Date().toISOString() };
  const history = (await dbGet("siteConfig/revenueHistory"))?.value || [];
  history.push(entry);
  await dbPut("siteConfig/revenueHistory", { value: history, updatedAt: new Date().toISOString() });
  return entry;
}

export async function fetchUserTypes() {
  return fetchSiteConfig("userTypes");
}

export async function saveUserTypes(types) {
  _lsRemove("userTypes");
  await dbPut("siteConfig/userTypes", { value: types, updatedAt: new Date().toISOString() });
  return types;
}

export async function fetchPayoutConfig() {
  return fetchSiteConfig("payoutConfig");
}

export async function savePayoutConfig(config) {
  _lsRemove("payoutConfig");
  return saveSiteConfig("payoutConfig", config);
}

export async function markReferralPayout(code, payoutAmount, payoutNote) {
  await dbPatch(`referrals/${code.toUpperCase().trim()}`, { payoutStatus: "done", payoutAmount, payoutNote, payoutAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function clearReferralPayout(code) {
  await dbPatch(`referrals/${code.toUpperCase().trim()}`, { payoutStatus: "pending", payoutAmount: null, payoutNote: null, payoutAt: null, updatedAt: new Date().toISOString() });
}

export async function fetchDodoConfig() {
  return fetchSiteConfig("dodoConfig");
}

export async function saveDodoConfig(config) {
  _lsRemove("dodoConfig");
  await dbPut("siteConfig/dodoConfig", { value: config, updatedAt: new Date().toISOString() });
  return config;
}

export async function fetchOrgSettings() {
  return fetchSiteConfig("organization");
}

export async function fetchPaymentMethods() {
  return fetchSiteConfig("paymentMethods");
}

export async function savePaymentMethods(config) {
  _lsRemove("paymentMethods");
  return saveSiteConfig("paymentMethods", config);
}

// Audit log (RTDB)
export async function fetchAuditLog() {
  const data = await _rtdbReadList("auditLogs");
  return (data || []).sort((a, b) => {
    const ta = a.timestamp || a.createdAt || "";
    const tb = b.timestamp || b.createdAt || "";
    return tb.localeCompare(ta);
  });
}

export async function logAdminAction(action, details = {}) {
  try {
    await _rtdbAppend("auditLogs", { action, ...details, timestamp: new Date().toISOString() });
  } catch (e) { console.warn("logAdminAction:", e.message); }
}

// Site config (generic key-value)
export async function fetchSiteConfig(key) {
  const cached = _lsGet("sc_" + key);
  if (cached !== null) {
    const localVersion = _lsGet("sc_v_" + key);
    const vMap = await _ensureVersions().catch(() => null);
    const remoteVersion = vMap?.[key] || null;
    if (localVersion && remoteVersion && localVersion === remoteVersion) {
      _lsSet("sc_" + key, cached);
      return cached;
    }
    if (!remoteVersion) return cached;
    // Fall through to re-fetch if version mismatch
  }
  const cachedCookie = getCookie(`sc_${key}`);
  if (cachedCookie !== null) return cachedCookie;
  const data = await apiFetch(`/api/data/site-config?key=${encodeURIComponent(key)}`);
  const result = data.data || null;
  if (result !== null) {
    _lsSet("sc_" + key, result);
    if (data._v) _lsSet("sc_v_" + key, data._v);
    setCookie(`sc_${key}`, result);
  }
  return result;
}

export async function saveSiteConfig(key, value) {
  _lsRemove("sc_" + key);
  _cacheClear(`siteConfig/${key}`);
  await apiFetch(`/api/data/site-config?key=${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  removeCookie(`sc_${key}`);
  return value;
}

// ── Courses ──────────────────────────────────────────────────────────────
export async function fetchCourses() {
  const result = await fetchCareerPaths();
  const paths = result.paths || result || [];
  return paths.filter((p) => p.type === "course");
}

export async function saveCourses(list) {
  return apiFetch("/api/data/courses", { method: "PUT", body: JSON.stringify({ list }) });
}

export async function fetchCourseContent(courseId) {
  const cacheKey = "cc_" + courseId;
  const cached = _lsGet(cacheKey);
  const localVersion = _lsGet("cc_v_" + courseId);
  if (cached && localVersion) {
    const vMap = await _ensureVersions().catch(() => null);
    const remoteVersion = vMap?.courses || null;
    if (remoteVersion && localVersion === remoteVersion) {
      _lsSet(cacheKey, cached);
      return cached;
    }
    if (!remoteVersion) {
      try {
        const resp = await fetch(`${API_BASE}/api/data/courses/${encodeURIComponent(courseId)}/content?_v=${encodeURIComponent(localVersion)}`);
        if (resp.status === 304) { _lsSet(cacheKey, cached); return cached; }
        if (resp.ok) {
          const data = await resp.json();
          const result = data.data || null;
          if (result) { _lsSet(cacheKey, result); if (data._v) _lsSet("cc_v_" + courseId, data._v); }
          return result;
        }
      } catch {}
    }
  }
  try {
    const data = await apiFetch(`/api/data/courses/${encodeURIComponent(courseId)}/content`);
    if (data?.data) {
      _lsSet(cacheKey, data.data);
      return data.data;
    }
  } catch {}
  const r = await fetchCareerPaths();
  const p = (r.paths || r || []).find(x => x.id === courseId);
  const fallback = p?.content ? { modules: p.content } : null;
  if (fallback) _lsSet(cacheKey, fallback);
  return fallback;
}

export async function saveCourseContent(courseId, content) {
  return apiFetch(`/api/data/courses/${encodeURIComponent(courseId)}/content`, {
    method: "PUT", body: JSON.stringify(content),
  });
}

export async function courseEnroll(courseId, profile) {
  const referralCode = localStorage.getItem("detected_referral_code") || "";
  const data = await apiFetch("/api/data/course-enroll", {
    method: "POST", body: JSON.stringify({ courseId, referralCode, ...profile }),
  });
  return data.data;
}

export async function markLessonComplete(enrollmentId, moduleIdx, lessonIdx) {
  return apiFetch(`/api/data/course-enroll/${encodeURIComponent(enrollmentId)}/lesson`, {
    method: "PUT", body: JSON.stringify({ moduleIdx, lessonIdx }),
  });
}

export async function submitCourseQuiz(enrollmentId, moduleIdx, answers) {
  const data = await apiFetch(`/api/data/course-enroll/${encodeURIComponent(enrollmentId)}/quiz`, {
    method: "POST", body: JSON.stringify({ moduleIdx, answers }),
  });
  return data.data;
}

// Theme
export async function fetchTheme() {
  return fetchSiteConfig("theme");
}

export async function saveTheme(theme) {
  return saveSiteConfig("theme", theme);
}

// What Do You Get (dedicated endpoint)
export async function fetchWhatDoYouGet() {
  return fetchSiteConfig("whatDoYouGet");
}

export async function saveWhatDoYouGet(whatDoYouGet) {
  _lsRemove("whatDoYouGet");
  await apiFetch("/api/data/what-do-you-get", {
    method: "PUT",
    body: JSON.stringify({ whatDoYouGet }),
  });
  return whatDoYouGet;
}

export async function fetchUniversityCollab() {
  return fetchSiteConfig("universityCollab");
}

export async function saveUniversityCollab(content) {
  _lsRemove("universityCollab");
  await apiFetch("/api/data/university-collab", {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
  return content;
}

export async function fetchLogoLoopContent() {
  return fetchSiteConfig("logoLoop");
}

export async function saveLogoLoopContent(content) {
  _lsRemove("logoLoop");
  await apiFetch("/api/data/logo-loop", {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
  return content;
}

export async function fetchSlidingStripsContent() {
  return fetchSiteConfig("slidingStrips");
}

export async function saveSlidingStripsContent(content) {
  _lsRemove("slidingStrips");
  return dbPut("config/slidingStrips", { content, updatedAt: new Date().toISOString() });
}

// Header Settings
export async function fetchHeaderSettings() {
  return fetchSiteConfig("headerSettings");
}

export async function saveHeaderSettings(settings) {
  return saveSiteConfig("headerSettings", settings);
}

// Terms & Conditions
export async function fetchTermsContent() {
  return fetchSiteConfig("terms");
}

export async function saveTermsContent(html) {
  return saveSiteConfig("terms", html);
}

// Privacy Policy
export async function fetchPrivacyContent() {
  return fetchSiteConfig("privacy");
}

export async function savePrivacyContent(html) {
  return saveSiteConfig("privacy", html);
}

// Refund Policy
export async function fetchRefundContent() {
  return fetchSiteConfig("refund");
}

export async function saveRefundContent(html) {
  return saveSiteConfig("refund", html);
}

// Footer Settings
export async function fetchFooterSettings() {
  return fetchSiteConfig("footer");
}

export async function saveFooterSettings(settings) {
  return saveSiteConfig("footer", settings);
}

// Popup Settings
export async function fetchPopupSettings() {
  return fetchSiteConfig("popup");
}

export async function savePopupSettings(settings) {
  return saveSiteConfig("popup", settings);
}

// Homepage Settings (which domains to show, max visible before "View All")
export async function fetchHomepageSettings() {
  return fetchSiteConfig("homepageLayout");
}

export async function saveHomepageSettings(settings) {
  return saveSiteConfig("homepage", settings);
}

// Receipt
export async function fetchReceipt(enrollmentId) {
  return apiFetch(`/api/data/receipt/${enrollmentId}`);
}

export async function fetchReceiptTemplate() {
  return fetchSiteConfig("receiptTemplate");
}

export async function saveReceiptTemplate(html) {
  return saveSiteConfig("receiptTemplate", html);
}

// Leaderboard
export async function fetchReferralLeaderboard() {
  const referrals = await dbList("referrals");
  const enrollments = await dbList("enrollments");
  const earnData = await dbGet("siteConfig/earnSettings");
  const rewardPerCompletion = earnData?.rewardPerCompletion || 20;
  return referrals
    .filter((r) => r.name && r.code)
    .map((r) => {
      const interns = enrollments.filter((e) => (e.referralCode || "").toUpperCase().trim() === (r.code || "").toUpperCase().trim());
      const completedPaid = interns.filter((i) => i.status === "Completed" && i.paymentStatus === "paid");
      return { name: r.name, email: r.email || r.name, code: r.code, interns: interns.length, completed: completedPaid.length, earnings: completedPaid.length * rewardPerCompletion };
    })
    .sort((a, b) => b.completed - a.completed);
}

// Progress timeline
export async function fetchProgressTimeline(enrollmentId) {
  const enr = await fetchEnrollmentById(enrollmentId);
  if (!enr) return [];
  const timeline = [];
  const projects = enr.projects || [];
  const submissions = enr.submissions || {};
  projects.forEach((p, i) => {
    const sub = submissions[i];
    if (sub?.submittedAt) timeline.push({ type: "submitted", projectIndex: i, projectTitle: p.title, date: sub.submittedAt });
    if (sub?.verifiedAt) timeline.push({ type: "verified", projectIndex: i, projectTitle: p.title, date: sub.verifiedAt });
    if (sub?.rejectedAt) timeline.push({ type: "rejected", projectIndex: i, projectTitle: p.title, date: sub.rejectedAt, feedback: sub.feedback });
  });
  if (enr.paidAt) timeline.push({ type: "paid", date: enr.paidAt, amount: enr.paymentAmount });
  if (enr.createdAt) timeline.push({ type: "enrolled", date: enr.createdAt });
  if (enr.completedAt) timeline.push({ type: "completed", date: enr.completedAt });
  return timeline.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
}

// Auto-expire past-deadline enrollments
export async function autoExpireEnrollments() {
  try {
    const res = await fetch(`${API_BASE}/api/auto-expire-enrollments`, { method: 'POST' });
    if (!res.ok) return { success: false, message: `Auto-expire returned ${res.status}` };
    return await res.json();
  } catch {
    return { success: false, message: 'Auto-expire check failed' };
  }
}

// Logged-in users tracking (RTDB)
export async function recordUserLogin(uid, user) {
  try {
    await _rtdbPut(`loggedInUsers/${uid}`, {
      uid,
      email: user.email || "",
      displayName: user.displayName || "Unknown",
      photoURL: user.photoURL || "",
      lastSeen: new Date().toISOString(),
      signedInAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("Failed to record user login:", e.message);
  }
}

export async function updateUserLastSeen(uid) {
  try {
    await _rtdbPatch(`loggedInUsers/${uid}`, {
      lastSeen: new Date().toISOString(),
    });
  } catch (e) { console.warn("recordUserLogin:", e.message); }
}

export async function recordUserLogout(uid) {
  try {
    await _rtdbDelete(`loggedInUsers/${uid}`);
  } catch (e) { console.warn("recordUserLogout:", e.message); }
}

export async function fetchLoggedInUsers() {
  const list = await _rtdbReadList("loggedInUsers");
  return list.sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));
}

// CSV export
export async function exportEnrollmentsCSV() {
  const enrollments = await dbList("enrollments");
  const headers = ["Intern ID", "Name", "Email", "Phone", "College", "Domain", "Status", "Payment Status", "Payment Amount", "Paid At", "Completed At", "Referral Code", "Certificate Allowed"];
  const rows = enrollments.map((e) => [
    e.internId || e.id || "",
    e.name || "",
    e.email || "",
    e.phone || "",
    e.college || "",
    e.domain || "",
    e.status || "",
    e.paymentStatus || "",
    e.paymentAmount || "",
    e.paidAt || "",
    e.completedAt || "",
    e.referralCode || "",
    e.allowedCertificate || "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  return csv;
}

// ─── Email Automation API ──────────────────────────────────────────────────
export async function fetchEmailTypes() {
  return apiFetch("/api/email/types");
}

export async function fetchEmailConfig() {
  return apiFetch("/api/email/config");
}

export async function saveEmailConfig(config) {
  return apiFetch("/api/email/config", { method: "PUT", body: JSON.stringify(config) });
}

export async function fetchEmailTemplates() {
  return apiFetch("/api/email/templates");
}

export async function fetchEmailTemplate(type) {
  return apiFetch(`/api/email/templates/${type}`);
}

export async function saveEmailTemplate(type, { html, subject }) {
  return apiFetch(`/api/email/templates/${type}`, { method: "PUT", body: JSON.stringify({ html, subject }) });
}

export async function resetEmailTemplate(type) {
  return apiFetch(`/api/email/templates/${type}`, { method: "DELETE" });
}

export async function fetchEmailStats() {
  return apiFetch("/api/email/stats");
}

export async function fetchEmailLogs(params = {}) {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/api/email/logs${q ? "?" + q : ""}`);
}

export async function fetchEmailSubscriptions() {
  return apiFetch("/api/email/subscriptions");
}

export async function updateEmailSubscription(email, { status, categories }) {
  return apiFetch("/api/email/subscriptions/update", { method: "POST", body: JSON.stringify({ email, status, categories }) });
}

export async function triggerEmailCron(dryRun = false) {
  if (dryRun) return apiFetch("/api/email/dry-run", { method: "POST", body: JSON.stringify({}) });
  return apiFetch("/api/email/run", { method: "POST" });
}

export async function sendTestEmail(email, type, name = "") {
  return apiFetch("/api/email/send-test", { method: "POST", body: JSON.stringify({ email, type, name }) });
}

export async function fetchEmailAutomationLog() {
  return apiFetch("/api/email/automation-log");
}

export async function triggerManualEmailType(type, email = "", dryRun = false) {
  const params = { type };
  if (dryRun) params.dryRun = "true";
  if (email) params.email = email;
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/api/email/trigger?${q}`, { method: "POST" });
}

export async function saveCourseProgress(enrollmentId, completedBlocks) {
  const data = await apiFetch(`/api/data/course-enroll/${encodeURIComponent(enrollmentId)}/progress`, {
    method: "PUT", body: JSON.stringify({ completedBlocks }),
  });
  return data.data;
}

// ─── IndexedDB cache-sync wrappers ────────────────────────────────────────────
// Serve unchanged data straight from IndexedDB (via ./cacheSync) when the server
// bucket version is unchanged. The orchestrator (syncBuckets) decides per-bucket
// whether to fetch from Cosmos. Consistency: certs reads use Eventual (non-critical);
// tasks reads keep the default Session consistency and we never touch consistency
// on the task-completion write path.

const EVENTUAL = { consistencyLevel: "Eventual" };

// Large/volatile bucket: user task history (enrollments). Own version key.
export async function fetchUserEnrollmentsCached(uid, email, { force = false } = {}) {
  const res = await syncBuckets([
    { bucket: "tasks", key: uid, fetcher: () => fetchUserEnrollments(uid, email), force },
  ], { force, userId: uid, email });
  return res.tasks || [];
}

// Large/volatile bucket: certificate records (enrollments where allowedCertificate === "yes").
// Own version key. Eventual consistency (reads tolerate staleness).
export async function fetchUserCertificatesCached(uid, email, { force = false } = {}) {
  const res = await syncBuckets([
    {
      bucket: "certs",
      key: uid,
      fetcher: async () => {
        const enrollments = await fetchUserEnrollments(uid, email, EVENTUAL);
        return enrollments
          .filter((e) => e.allowedCertificate === "yes")
          .map((e) => ({
            id: e.id,
            domain: e.domain,
            domainId: e.domainId,
            status: e.status,
            completedAt: e.completedAt || e.updatedAt,
            name: e.name,
            email: e.email,
          }));
      },
      force,
    },
  ], { force, userId: uid, email });
  return res.certs || [];
}

// Combined boot orchestrator used by App.jsx. Renders from cache first (via
// loadCachedUserBuckets), then runs this in the background; onBucket lets the UI
// re-render only the section that actually changed.
export async function syncUserCache(uid, email, { force = false, onBucket } = {}) {
  const res = await syncBuckets([
    { bucket: "tasks", key: uid, fetcher: () => fetchUserEnrollments(uid, email), force },
    {
      bucket: "certs",
      key: uid,
      fetcher: async () =>
        (await fetchUserEnrollments(uid, email, EVENTUAL))
          .filter((e) => e.allowedCertificate === "yes")
          .map((e) => ({ id: e.id, domain: e.domain, domainId: e.domainId, status: e.status, completedAt: e.completedAt || e.updatedAt, name: e.name, email: e.email })),
      force,
    },
  ], { force, userId: uid, email, onBucket });
  return {
    enrollments: res.tasks || [],
    certificates: res.certs || [],
  };
}

// ─── Team / Agency Accounts ───
export async function fetchAgencies({ fresh = false } = {}) {
  const cached = !fresh && _lsGet("agencies");
  if (cached) return cached;
  const d = await dbList("agencies");
  const result = d || [];
  _lsSet("agencies", result);
  return result;
}

export async function saveAgency(agency) {
  _lsRemove("agencies");
  const now = new Date().toISOString();
  const { id, ...rest } = agency;
  const data = { ...rest, updatedAt: now };
  if (!data.emails) data.emails = data.email ? [data.email] : [];
  if (id) {
    await dbPut(`agencies/${id}`, data);
  } else {
    const newRef = await dbPost("agencies", { ...data, createdAt: now, approved: false });
    return { id: newRef?.id, ...data };
  }
  return agency;
}

export async function approveAgency(agencyId, approved) {
  await dbPatch(`agencies/${agencyId}`, { approved, updatedAt: new Date().toISOString() });
}

export async function deleteAgency(agencyId) {
  _lsRemove("agencies");
  return dbDelete(`agencies/${agencyId}`);
}

export async function fetchAgencyTemplates(agencyId) {
  const all = await dbList("agencyTemplates");
  return all.filter(t => t.agencyId === agencyId);
}

export async function saveAgencyTemplate(template) {
  const now = new Date().toISOString();
  if (template.id) {
    await dbPatch(`agencyTemplates/${template.id}`, { ...template, updatedAt: now });
    return template;
  }
  const newRef = await dbPost("agencyTemplates", { ...template, createdAt: now, updatedAt: now });
  return { id: newRef?.id, ...template };
}

export async function deleteAgencyTemplate(templateId) {
  return dbDelete(`agencyTemplates/${templateId}`);
}

export async function checkAgencyStatus(email) {
  const clean = (email || "").toLowerCase().trim();
  if (!clean) return { isAgency: false, agencies: [] };
  const key = "agency_" + clean;
  const cached = _authCacheGet(key);
  if (cached !== null) return cached;
  const all = await fetchAgencies().catch(() => []);
  const matched = all.filter(a => (a.emails || []).some(e => e.toLowerCase().trim() === clean) && a.approved);
  const result = { isAgency: matched.length > 0, agencies: matched };
  _authCacheSet(key, result, 300000);
  return result;
}

export async function fetchAgencyEnrollments(agencyId) {
  const all = await dbList("enrollments").catch(() => []);
  return all.filter(e => e.agencyId === agencyId);
}

export async function assignEnrollmentAgency(enrollmentId, agencyId) {
  await dbPatch(`enrollments/${enrollmentId}`, { agencyId, updatedAt: new Date().toISOString() });
}

export async function addAgencyAdminEmail(agencyId, email) {
  const agency = await dbGet(`agencies/${agencyId}`);
  const emails = agency?.emails || [];
  if (emails.includes(email)) return;
  emails.push(email);
  await dbPatch(`agencies/${agencyId}`, { emails, memberRoles: { ...(agency?.memberRoles || {}), [email]: "admin" }, updatedAt: new Date().toISOString() });
  _lsRemove("agencies");
}

export async function removeAgencyAdminEmail(agencyId, email) {
  const agency = await dbGet(`agencies/${agencyId}`);
  const emails = (agency?.emails || []).filter(e => e !== email);
  const memberRoles = { ...(agency?.memberRoles || {}) };
  delete memberRoles[email];
  await dbPatch(`agencies/${agencyId}`, { emails, memberRoles, updatedAt: new Date().toISOString() });
  _lsRemove("agencies");
}

// Partner workspaces use the existing approval flow and are separated by type.
export async function fetchPartnerAccounts(type) {
  // Requests must never be hidden behind a browser cache: the approval queue
  // is operational data and needs to reflect every submitted application.
  const accounts = await fetchAgencies({ fresh: true });
  return accounts.filter((account) => account.partnerType === type);
}

export async function fetchPartnerCourses(partnerId) {
  const courses = await dbList("partnerCourses");
  return (courses || []).filter((course) => course.partnerId === partnerId);
}

export async function savePartnerCourse(course) {
  const now = new Date().toISOString();
  if (course.id) {
    await dbPatch(`partnerCourses/${course.id}`, { ...course, updatedAt: now });
    return course;
  }
  const created = await dbPost("partnerCourses", { ...course, createdAt: now, updatedAt: now });
  return { ...course, id: created?.id };
}

export async function deletePartnerCourse(courseId) {
  return dbDelete(`partnerCourses/${courseId}`);
}

export async function fetchPartnerAudit(partnerId) {
  const events = await dbList("partnerAudit");
  return (events || []).filter((event) => event.partnerId === partnerId).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function logPartnerAudit(partnerId, actor, action, detail = "") {
  return dbPost("partnerAudit", { partnerId, actor, action, detail, createdAt: new Date().toISOString() });
}
