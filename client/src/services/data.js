const API_BASE = (import.meta.env.VITE_SERVER_URL || "https://devcraft.fennark.xyz").replace(/\/api\/?$/, "");

// Firebase Realtime Database — used ONLY for site visits, referral visits, and device-user mapping
import { db as rtdb, ref, get as rtdbGet, set as rtdbSet, push as rtdbPush, update as rtdbUpdate, remove as rtdbRemove, query as rtdbQuery, orderByChild, equalTo, getFirebaseIdToken } from "../firebase";
import { getCookie, setCookie, removeCookie, clearCookies } from "../utils/cookies";
import { syncBuckets, forceCacheRefresh, getCached, putCached, getLocalVersion, putLocalVersion, clearBucket, fetchServerVersions } from "./cacheSync";

async function _rtdbRead(path) {
  try { const s = await rtdbGet(ref(rtdb, path)); return s.val(); } catch { return null; }
}

async function _rtdbReadList(path) {
  try {
    const s = await rtdbGet(ref(rtdb, path));
    if (!s.exists()) return [];
    const v = s.val();
    return Object.keys(v).map(k => ({ id: k, ...v[k] }));
  } catch { return []; }
}

async function _rtdbAppend(path, data) {
  try {
    const newRef = rtdbPush(ref(rtdb, path));
    await rtdbSet(newRef, { ...data, id: newRef.key, createdAt: new Date().toISOString() });
    return { id: newRef.key, ...data };
  } catch (e) { console.warn("rtdbAppend", path, e.message); return null; }
}

async function _rtdbPut(path, data) {
  try { await rtdbSet(ref(rtdb, path), { ...data, updatedAt: new Date().toISOString() }); return data; } catch { return null; }
}

async function _rtdbPatch(path, data) {
  try { await rtdbUpdate(ref(rtdb, path), { ...data, updatedAt: new Date().toISOString() }); return data; } catch { return null; }
}

async function _rtdbDelete(path) {
  try { await rtdbRemove(ref(rtdb, path)); return true; } catch { return false; }
}

// Simple in-memory cache with TTL to reduce redundant Firestore reads
const _cache = new Map();
const _inflightReads = new Map();
const STATIC_CACHE_TTL = 10 * 60 * 1000;
const STATIC_COLLECTIONS = new Set(["careerPaths", "howItWorks", "faqs", "homepage", "logoLoop", "slidingStrips", "universityCollab"]);
const CACHE_TTL = 15 * 1000; // 15 seconds — short enough to avoid stale admin data, long enough to prevent double fetches

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

async function dbProxy(action, path, data, query) {
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

async function dbGet(path) {
  try { return await dbProxy("get", path); } catch (e) { console.warn("dbGet", path, e.message); return null; }
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

async function dbList(path) {
  try { return await dbProxy("list", path); } catch (e) { console.warn("dbList", path, e.message); return []; }
}

async function dbQueryList(path, field, value) {
  try { return await dbProxy("query", path, null, { orderBy: field, equalTo: value }); } catch (e) { console.warn("dbQueryList", path, e.message); return []; }
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

// Career Paths
export async function fetchCareerPaths() {
  const cached = _lsGet("careerPaths");
  if (cached) return cached;
  const paths = await dbList("careerPaths");
  const catData = await dbGet("siteConfig/domainCategories");
  const categories = catData?.value || [];
  // Also fetch payment settings to merge domain-specific amounts
  const psData = await dbGet("siteConfig/paymentSettings");
  const ps = psData?.value || { defaultAmount: 200, defaultAmountReferral: 170, defaultTiming: "end" };
  // Merge payment overrides into each path if they exist
  const domainOverrides = (ps.domains || []).reduce((acc, d) => {
    if (d.domain) acc[d.domain.toLowerCase()] = d;
    return acc;
  }, {});
  const mergedPaths = paths.map((p) => {
    const override = domainOverrides[(p.title || "").toLowerCase()];
    if (override) {
      return {
        ...p,
        paymentAmount: override.amount || p.paymentAmount,
        paymentAmountReferral: override.amountReferral || p.paymentAmountReferral,
        paymentTiming: override.timing || p.paymentTiming || ps.defaultTiming,
      };
    }
    return p;
  });
  if (!mergedPaths.length && !categories.length) { const e = { paths: [], categories: [] }; _lsSet("careerPaths", e); return e; }
  const result = { paths: mergedPaths, categories };
  _lsSet("careerPaths", result);
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
export async function fetchHowItWorks() {
  const cached = _lsGet("howItWorks");
  if (cached) return cached;
  const steps = await dbList("howItWorks");
  const sorted = steps.sort((a, b) => (a.step || 0) - (b.step || 0));
  const result = sorted.length ? sorted : FALLBACK_STEPS;
  _lsSet("howItWorks", result);
  return result;
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
  const cached = _lsGet("faqs");
  if (cached) return cached;
  const faqs = await dbList("faqs");
  const result = faqs.length ? faqs : FALLBACK_FAQS;
  _lsSet("faqs", result);
  return result;
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
  const cached = _lsGet("templates");
  if (cached) return cached;
  const d = await dbGet("config/templates");
  const raw = d?.value || null;
  let result;
  if (!raw) result = { templates: { "Offer Letter": "", "Certificate": "" }, templateOrder: ["Offer Letter", "Certificate"] };
  else if (raw.templates) result = { ...raw, templateOrder: raw.templateOrder || Object.keys(raw.templates) };
  else {
    const old = raw;
    result = { templates: { "Offer Letter": old.offer_letter || "", "Certificate": old.certificate || "" }, templateOrder: ["Offer Letter", "Certificate"] };
  }
  _lsSet("templates", result);
  return result;
}

export async function saveTemplates(data) {
  _lsRemove("templates");
  await dbPut("config/templates", { value: data, updatedAt: new Date().toISOString() });
  return data;
}

// About Text
export async function fetchAboutText() {
  const cached = _lsGet("aboutText");
  if (cached) return cached;
  const d = await dbGet("config/aboutText");
  const result = d?.value || "";
  _lsSet("aboutText", result);
  return result;
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
  return dbGet(`users/${uid}`);
}

export async function saveUserProfile(uid, profile) {
  const data = await apiFetch(`/api/data/users/${uid}`, {
    method: "POST",
    body: JSON.stringify({ profile }),
  });
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

export async function fetchUserEnrollments(uid, email) {
  const list = await dbQueryList("enrollments", "uid", uid);
  // Also fetch by email to catch manually-added interns where uid was not set
  if (email) {
    try {
      const emailList = await dbQueryList("enrollments", "email", email);
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
      if (patches.length > 0) Promise.all(patches);
    } catch {}
  }
  return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function updateEnrollmentStatus(enrollmentId, status) {
  await dbPatch(`enrollments/${enrollmentId}`, { status, updatedAt: new Date().toISOString() });
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
  const data = await dbGet(`referrals/${referralCode.toUpperCase().trim()}`);
  return !!data;
}

export async function deleteReferral(code) { await dbDelete(`referrals/${code.toUpperCase().trim()}`); }

export async function deleteEnrollment(enrollmentId) { await dbDelete(`enrollments/${enrollmentId}`); }

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
  const emailId = cleanEmail.replace(/\./g, ",");
  const data = await dbGet(`admins/${emailId}`);
  return { isAdmin: !!data };
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
  const data = await dbGet(`selfReferralOwners/${uid}`);
  return data?.code || null;
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
  const list = await dbQueryList("referrals", "email", email);
  if (!list.length) return null;
  const referral = list[0];
  const code = (referral.code || referral.id || "").toUpperCase().trim();
  const interns = await dbQueryList("enrollments", "referralCode", code);
  const completed = interns.filter(i => i.status === "Completed").length;
  return {
    referral, interns, internCount: interns.length, completed,
    visited: referral.visited || 0,
    assignedInternships: interns.length,
    completedInterns: completed,
  };
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
  const cached = _lsGet("earnSettings");
  if (cached) return cached;
  const d = await dbGet("siteConfig/earnSettings");
  const result = d?.value || null;
  _lsSet("earnSettings", result);
  return result;
}

export async function saveEarnSettings(settings) {
  _lsRemove("earnSettings");
  await dbPut("siteConfig/earnSettings", { value: settings, updatedAt: new Date().toISOString() });
  return settings;
}

export async function fetchEarnDetails() {
  const cached = _lsGet("earnDetails");
  if (cached) return cached;
  const d = await dbGet("siteConfig/earnDetails");
  const result = d?.value || null;
  _lsSet("earnDetails", result);
  return result;
}

export async function saveEarnDetails(details) {
  _lsRemove("earnDetails");
  return saveSiteConfig("earnDetails", details);
}

export async function fetchBannedUsers() { return dbList("bannedUsers"); }

export async function checkUserBan(email) {
  const emailId = (email || "").toLowerCase().trim().replace(/\./g, ",");
  return dbGet(`bannedUsers/${emailId}`);
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
  const cached = _lsGet("homepageContent");
  if (cached) return cached;
  const d = await dbGet("siteConfig/homepage");
  const result = d?.value || null;
  _lsSet("homepageContent", result);
  return result;
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
  return dbQueryList("enrollments", "status", "Active");
}

export async function fetchUPISettings() {
  const cached = _lsGet("upiSettings");
  if (cached) return cached;
  const d = await dbGet("siteConfig/upiSettings");
  const result = d?.value || null;
  _lsSet("upiSettings", result);
  return result;
}

export async function saveUPISettings(settings) {
  _lsRemove("upiSettings");
  await dbPut("siteConfig/upiSettings", { value: settings, updatedAt: new Date().toISOString() });
  return settings;
}

export async function fetchPaymentSettings() {
  const cached = _lsGet("paymentSettings");
  if (cached) return cached;
  const d = await dbGet("siteConfig/paymentSettings");
  const result = d?.value || null;
  _lsSet("paymentSettings", result);
  return result;
}

export async function savePaymentSettings(settings) {
  _lsRemove("paymentSettings");
  return saveSiteConfig("paymentSettings", settings);
}

export async function overrideCompleteEnrollment(enrollmentId, adminEmail) {
  await dbPatch(`enrollments/${enrollmentId}`, { status: "Completed", allowedCertificate: "yes", completedAt: new Date().toISOString(), overrideCompleted: true, overriddenBy: adminEmail, updatedAt: new Date().toISOString() });
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
    const res = await fetch(`${API_BASE}/api/payment-history/${enrollmentId}`);
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
  const cached = _lsGet("userTypes");
  if (cached) return cached;
  const d = await dbGet("siteConfig/userTypes");
  const result = d?.value || [];
  _lsSet("userTypes", result);
  return result;
}

export async function saveUserTypes(types) {
  _lsRemove("userTypes");
  await dbPut("siteConfig/userTypes", { value: types, updatedAt: new Date().toISOString() });
  return types;
}

export async function fetchPayoutConfig() {
  const cached = _lsGet("payoutConfig");
  if (cached) return cached;
  const d = await dbGet("siteConfig/payoutConfig");
  const result = d?.value || { payoutDays: 30, defaultPayoutPerIntern: 30 };
  _lsSet("payoutConfig", result);
  return result;
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
  const cached = _lsGet("dodoConfig");
  if (cached) return cached;
  const d = await dbGet("siteConfig/dodoConfig");
  const result = d?.value || null;
  _lsSet("dodoConfig", result);
  return result;
}

export async function saveDodoConfig(config) {
  _lsRemove("dodoConfig");
  await dbPut("siteConfig/dodoConfig", { value: config, updatedAt: new Date().toISOString() });
  return config;
}

export async function fetchOrgSettings() {
  const cached = _lsGet("orgSettings");
  if (cached) return cached;
  const d = await dbGet("siteConfig/organization");
  const result = d?.value || null;
  _lsSet("orgSettings", result);
  return result;
}

export async function fetchPaymentMethods() {
  const cached = _lsGet("paymentMethods");
  if (cached) return cached;
  const d = await dbGet("siteConfig/paymentMethods");
  const result = d?.value || { upi: true, dodo: false };
  _lsSet("paymentMethods", result);
  return result;
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
  if (cached !== null) return cached;
  const cachedCookie = getCookie(`sc_${key}`);
  if (cachedCookie !== null) return cachedCookie;
  const data = await apiFetch(`/api/data/site-config?key=${encodeURIComponent(key)}`);
  const result = data.data || null;
  if (result !== null) {
    setCookie(`sc_${key}`, result);
    _lsSet("sc_" + key, result);
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

// Theme
export async function fetchTheme() {
  return fetchSiteConfig("theme");
}

export async function saveTheme(theme) {
  return saveSiteConfig("theme", theme);
}

// What Do You Get (dedicated endpoint)
export async function fetchWhatDoYouGet() {
  const cached = _lsGet("whatDoYouGet");
  if (cached) return cached;
  const data = await apiFetch("/api/data/what-do-you-get");
  const result = data.data || null;
  _lsSet("whatDoYouGet", result);
  return result;
}

export async function saveWhatDoYouGet(whatDoYouGet) {
  _lsRemove("whatDoYouGet");
  await apiFetch("/api/data/what-do-you-get", {
    method: "PUT",
    body: JSON.stringify({ whatDoYouGet }),
  });
  return whatDoYouGet;
}

// University Collaboration (dedicated endpoint)
export async function fetchUniversityCollab() {
  const cached = _lsGet("universityCollab");
  if (cached) return cached;
  const d = await apiFetch("/api/data/university-collab");
  const result = d.data || null;
  _lsSet("universityCollab", result);
  return result;
}

export async function saveUniversityCollab(content) {
  _lsRemove("universityCollab");
  await apiFetch("/api/data/university-collab", {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
  return content;
}

// Logo Loop (dedicated endpoint)
export async function fetchLogoLoopContent() {
  const cached = _lsGet("logoLoop");
  if (cached) return cached;
  const d = await apiFetch("/api/data/logo-loop");
  const result = d.data || null;
  _lsSet("logoLoop", result);
  return result;
}

export async function saveLogoLoopContent(content) {
  _lsRemove("logoLoop");
  await apiFetch("/api/data/logo-loop", {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
  return content;
}

// Sliding Strips (dedicated endpoint)
export async function fetchSlidingStripsContent() {
  const cached = _lsGet("slidingStrips");
  if (cached) return cached;
  const d = await apiFetch("/api/data/sliding-strips");
  const result = d.data || null;
  _lsSet("slidingStrips", result);
  return result;
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
  const d = await fetchSiteConfig("footer");
  return d || null;
}

export async function saveFooterSettings(settings) {
  return saveSiteConfig("footer", settings);
}

// Popup Settings
export async function fetchPopupSettings() {
  const d = await fetchSiteConfig("popup");
  return d || null;
}

export async function savePopupSettings(settings) {
  return saveSiteConfig("popup", settings);
}

// Homepage Settings (which domains to show, max visible before "View All")
export async function fetchHomepageSettings() {
  const d = await fetchSiteConfig("homepage");
  return d || null;
}

export async function saveHomepageSettings(settings) {
  return saveSiteConfig("homepage", settings);
}

// Receipt
export async function fetchReceipt(enrollmentId) {
  return apiFetch(`/api/data/receipt/${enrollmentId}`);
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

// ─── Skill Badges & Micro-Certifications ───
export async function fetchBadges() {
  const cached = _lsGet("badges");
  if (cached) return cached;
  const d = await dbList("badges");
  const result = d || [];
  _lsSet("badges", result);
  return result;
}

export async function saveBadges(badges) {
  _lsRemove("badges");
  const now = new Date().toISOString();
  const obj = {};
  badges.forEach(b => { obj[b.id] = { ...b, updatedAt: now }; });
  if (Object.keys(obj).length) await dbPut("badges", obj);
  return badges;
}

export async function awardBadge(userId, badgeId, awardedBy) {
  const entry = { userId, badgeId, awardedAt: new Date().toISOString(), awardedBy };
  return dbPost("userBadges", entry);
}

export async function fetchUserBadges(userId) {
  const all = await dbList("userBadges");
  return all.filter(b => b.userId === userId);
}

export async function revokeBadge(entryId) {
  return dbDelete(`userBadges/${entryId}`);
}

// ─── IndexedDB cache-sync wrappers ────────────────────────────────────────────
// These mirror the plain fetch functions but serve unchanged data straight from
// IndexedDB (via ./cacheSync) when the server-side bucket version is unchanged.

// Large/volatile bucket: user task history (enrollments).
export async function fetchUserEnrollmentsCached(uid, email, { force = false } = {}) {
  const res = await syncBuckets([
    { bucket: "tasks", key: uid, fetcher: () => fetchUserEnrollments(uid, email), force },
  ], { force });
  return res.tasks || [];
}

// Large/volatile bucket: certificate records (enrollments where allowedCertificate === "yes").
export async function fetchUserCertificatesCached(uid, email, { force = false } = {}) {
  const res = await syncBuckets([
    {
      bucket: "certs",
      key: uid,
      fetcher: async () => {
        const enrollments = await fetchUserEnrollments(uid, email);
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
  ], { force });
  return res.certs || [];
}

// Small/low-churn bucket: badges + userBadges (merged, shared version).
export async function fetchUserBadgesCached(uid, { force = false } = {}) {
  const res = await syncBuckets([
    {
      bucket: "badges_combined",
      key: uid,
      fetcher: async () => {
        const [badges, userBadges] = await Promise.all([fetchBadges(), fetchUserBadges(uid)]);
        return { badges: badges || [], userBadges: userBadges || [] };
      },
      force,
    },
  ], { force });
  const combined = res.badges_combined || {};
  return { badges: combined.badges || [], userBadges: combined.userBadges || [] };
}

// Combined boot orchestrator: sync all three buckets in one round-trip to the
// versions endpoint. Returns the data the dashboard needs.
export async function syncUserCache(uid, email, { force = false } = {}) {
  const res = await syncBuckets([
    { bucket: "tasks", key: uid, fetcher: () => fetchUserEnrollments(uid, email), force },
    {
      bucket: "certs",
      key: uid,
      fetcher: async () =>
        (await fetchUserEnrollments(uid, email))
          .filter((e) => e.allowedCertificate === "yes")
          .map((e) => ({ id: e.id, domain: e.domain, domainId: e.domainId, status: e.status, completedAt: e.completedAt || e.updatedAt, name: e.name, email: e.email })),
      force,
    },
    {
      bucket: "badges_combined",
      key: uid,
      fetcher: async () => {
        const [badges, userBadges] = await Promise.all([fetchBadges(), fetchUserBadges(uid)]);
        return { badges: badges || [], userBadges: userBadges || [] };
      },
      force,
    },
  ], { force });
  return {
    enrollments: res.tasks || [],
    certificates: res.certs || [],
    badges: (res.badges_combined || {}).badges || [],
    userBadges: (res.badges_combined || {}).userBadges || [],
  };
}

// Manual escape hatch — wipe stored versions so the next sync re-fetches all.
export async function forceRefreshUserCache() {
  await forceCacheRefresh();
}

export async function evaluateBadgeCriteriaAI(criteria, userData) {
  try {
    const res = await apiFetch("/api/ai/evaluate-badge-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria, userData }),
    });
    return { qualifies: res?.qualifies || false, reason: res?.reason || "" };
  } catch {
    return { qualifies: false, reason: "AI evaluation failed" };
  }
}

export async function checkAndAwardBadges(adminEmail) {
  const [badges, allEnrollments] = await Promise.all([
    fetchBadges().catch(() => []),
    fetchAllEnrollments().catch(() => []),
  ]);
  const autoBadges = badges.filter(b => b.criteriaType === "auto" && b.criteria);
  const results = [];
  const userIds = [...new Set((allEnrollments || []).map(e => e.userId).filter(Boolean))];
  for (const uid of userIds) {
    const userEnrollments = (allEnrollments || []).filter(e => e.userId === uid);
    const userBadges = await fetchUserBadges(uid).catch(() => []);
    const earnedIds = new Set((userBadges || []).map(b => b.badgeId));
    for (const badge of autoBadges) {
      if (earnedIds.has(badge.id)) continue;
      const { qualifies } = await evaluateBadgeCriteriaAI(badge.criteria, {
        enrollments: userEnrollments,
        completedCount: userEnrollments.filter(e => e.status === "Completed").length,
        activeCount: userEnrollments.filter(e => e.status === "Active" || e.status === "In Progress").length,
      });
      if (qualifies) {
        await awardBadge(uid, badge.id, adminEmail);
        results.push({ userId: uid, badgeId: badge.id });
      }
    }
  }
  return results;
}

async function fetchAllEnrollments() {
  return dbList("enrollments").catch(() => []);
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
  const all = await fetchAgencies().catch(() => []);
  const matched = all.filter(a => (a.emails || []).some(e => e.toLowerCase().trim() === clean) && a.approved);
  return { isAgency: matched.length > 0, agencies: matched };
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
