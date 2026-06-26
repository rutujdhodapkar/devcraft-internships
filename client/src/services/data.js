const API_BASE = (import.meta.env.VITE_SERVER_URL || "https://devcraft.rutujdhodapkar.tech").replace(/\/api\/?$/, "");

const FALLBACK_PATHS = [
  { id: "path_web", title: "Web Development", duration: "4 Weeks", description: "Build responsive frontend projects with HTML, CSS, JavaScript, and React.", features: ["HTML/CSS layouts", "JavaScript fundamentals", "React components", "Final project"], projects: [{ title: "Responsive Portfolio", description: "Build a responsive personal portfolio website.", type: "text", links: [], quizQuestions: [], passingGrade: 100 }, { title: "Web Development Quiz", description: "Test your understanding of web basics.", type: "quiz", links: [], passingGrade: 60, quizQuestions: [{ question: "Which HTML tag links an external CSS file?", type: "option", options: ["<style>", "<script>", "<link>", "<meta>"], answer: "<link>" }, { question: "Which JavaScript method adds an item to an array?", type: "option", options: ["push()", "pop()", "shift()", "slice()"], answer: "push()" }] }] },
  { id: "path_python", title: "Python Development", duration: "4 Weeks", description: "Practice Python scripting, data structures, and backend fundamentals.", features: ["Python syntax", "OOP", "Flask basics", "Capstone project"], projects: [{ title: "Weather Web App", description: "Create a weather app using Python and a public API.", type: "text", links: [], quizQuestions: [], passingGrade: 100 }] },
  { id: "path_java", title: "Java Development", duration: "4 Weeks", description: "Master Java programming with object-oriented concepts and real-world projects.", features: ["Java syntax & OOP", "Data structures", "File I/O", "Capstone project"], projects: [{ title: "Student Management System", description: "Build a console-based student management system in Java.", type: "text", links: [], quizQuestions: [], passingGrade: 100 }] },
];

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
  const res = await fetch(`${API_BASE}/api/firebase-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, path, data, query }),
  });
  const json = await res.json();
  if (!res.ok || json.success === false) throw new Error(json.message || `Proxy ${action} ${path} failed`);
  return json.data;
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
  try { await dbProxy("delete", path); } catch {}
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
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || "Request failed.");
  return data;
}

// Career Paths
export async function fetchCareerPaths() {
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
  if (!mergedPaths.length && !categories.length) return { paths: FALLBACK_PATHS, categories: [] };
  return { paths: mergedPaths, categories };
}

export async function saveCareerPaths(paths, categories) {
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
  const steps = await dbList("howItWorks");
  const sorted = steps.sort((a, b) => (a.step || 0) - (b.step || 0));
  return sorted.length ? sorted : FALLBACK_STEPS;
}

export async function saveHowItWorks(steps) {
  const now = new Date().toISOString();
  const obj = {};
  steps.forEach(step => { obj[step.id] = { ...step, updatedAt: now }; });
  if (Object.keys(obj).length) await dbPut("howItWorks", obj);
  return steps;
}

// FAQs
export async function fetchFAQs() {
  const faqs = await dbList("faqs");
  return faqs.length ? faqs : FALLBACK_FAQS;
}

export async function saveFAQs(faqs) {
  const now = new Date().toISOString();
  const obj = {};
  faqs.forEach(faq => { obj[faq.id] = { ...faq, updatedAt: now }; });
  if (Object.keys(obj).length) await dbPut("faqs", obj);
  return faqs;
}

// Templates
export async function fetchTemplates() {
  const d = await dbGet("config/templates");
  const raw = d?.value || null;
  if (!raw) return { templates: { "Offer Letter": "", "Certificate": "" }, templateOrder: ["Offer Letter", "Certificate"] };
  if (raw.templates) return { ...raw, templateOrder: raw.templateOrder || Object.keys(raw.templates) };
  const old = raw;
  return { templates: { "Offer Letter": old.offer_letter || "", "Certificate": old.certificate || "" }, templateOrder: ["Offer Letter", "Certificate"] };
}

export async function saveTemplates(data) {
  await dbPut("config/templates", { value: data, updatedAt: new Date().toISOString() });
  return data;
}

// About Text
export async function fetchAboutText() {
  const d = await dbGet("config/aboutText");
  return d?.value || "";
}

export async function saveAboutText(text) {
  await dbPut("config/aboutText", { value: text, updatedAt: new Date().toISOString() });
  return text;
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
  const permanentRefCode = await fetchPermanentReferralCode(uid);
  const refCode = (detectedReferralCode || permanentRefCode || "").toUpperCase().trim();
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

export async function fetchUserEnrollments(uid) {
  const list = await dbQueryList("enrollments", "uid", uid);
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
  await dbPatch(`enrollments/${enrollmentId}/submissions/${projectIndex}`, {
    text: submissionText,
    url: submissionUrl,
    submittedAt: new Date().toISOString(),
    verified: false,
    rejected: false,
    resubmit: false
  });
}

export async function submitQuizAnswer(enrollmentId, projectIndex, answers, project) {
  await dbPut(`enrollments/${enrollmentId}/submissions/${projectIndex}`, {
    answers,
    project,
    submittedAt: new Date().toISOString(),
    verified: false,
    type: "quiz",
    rejected: false,
    resubmit: false
  });
}

export async function verifyProject(enrollmentId, projectIndex) {
  await dbPatch(`enrollments/${enrollmentId}/submissions/${projectIndex}`, {
    verified: true,
    verifiedAt: new Date().toISOString(),
    rejected: false,
    resubmit: false
  });
}

export async function saveProjectFeedback(enrollmentId, projectIndex, feedback) {
  await dbPatch(`enrollments/${enrollmentId}/submissions/${projectIndex}`, { feedback });
}

export async function rejectProject(enrollmentId, projectIndex, feedback) {
  await dbPatch(`enrollments/${enrollmentId}/submissions/${projectIndex}`, { verified: false, rejected: true, resubmit: true, feedback, rejectedAt: new Date().toISOString() });
}

export async function fetchEnrollmentById(enrollmentId) {
  const data = await dbGet(`enrollments/${enrollmentId}`);
  return data ? { id: enrollmentId, ...data } : null;
}

export async function fetchAdminData() {
  const [requests, referrals, visits, siteVisits] = await Promise.all([dbList("enrollments"), dbList("referrals"), dbList("referralVisits"), dbList("siteVisits")]);
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
  const data = await apiFetch("/api/data/referral-visits", {
    method: "POST",
    body: JSON.stringify({
      action: "visited", referralCode: code, visitedAt: now,
      link: window.location.href, language: navigator.language || "",
      browser: navigator.userAgent || "",
      fingerprint,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    }),
  });
  return data.data || null;
}

export async function associateVisitsWithUser(fingerprint, email, name, uid) {
  if (!fingerprint) return;
  try {
    await apiFetch("/api/data/associate-visits", {
      method: "POST",
      body: JSON.stringify({ fingerprint, email, name, uid }),
    });
  } catch (e) {
    console.warn("Could not associate visits:", e.message);
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
  if (cleanEmail === "rutujdhodapkar@gmail.com") return { isAdmin: true };
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

export async function removeAdmin(email) {
  const cleanEmail = email.toLowerCase().trim();
  await apiFetch(`/api/data/admins/${encodeURIComponent(cleanEmail)}`, {
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

export async function fetchReferralDashboardData(uid) {
  const owner = await dbGet(`selfReferralOwners/${uid}`);
  if (!owner?.code) return { referral: null, visits: [], interns: [], totals: { visits: 0, interns: 0, completed: 0, earnings: 0 }, totalVisits: 0, totalLogins: 0, totalEnrolled: 0, completedInterns: 0, enrolledInterns: [] };
  const code = owner.code.toUpperCase().trim();
  const visits = await dbQueryList("referralVisits", "referralCode", code);
  const referral = await dbGet(`referrals/${code}`);
  const interns = await dbQueryList("enrollments", "referralCode", code);
  const completed = interns.filter(i => i.status === "Completed" && i.paymentStatus === "paid");
  const earnings = completed.reduce((s, i) => s + Math.max(0, (i.paymentAmount || 200) - 170), 0);
  // Count unique logins from referralUsers where code == code
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
    // Flat fields for UI
    totalVisits: referral?.visited || 0,
    totalLogins,
    totalEnrolled: interns.length,
    completedInterns: completed.length,
    enrolledInterns: interns,
    referredUsers,
    code,
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
    // Flat fields for UI fallback
    visited: referral.visited || 0,
    assignedInternships: interns.length,
    completedInterns: completed,
  };
}

export async function fetchAdminReferralUsersWithInterns() {
  const referrals = await dbList("referrals");
  const allEnrollments = await dbList("enrollments");
  return referrals
    .filter((r) => r.upiId && r.upiId.trim())
    .map(r => {
    const code = (r.code || r.id || "").toUpperCase().trim();
    const interns = allEnrollments.filter(e => (e.referralCode || "").toUpperCase().trim() === code);
    const paidCompleted = interns.filter(i => i.status === "Completed" && i.paymentStatus === "paid");
    const earnings = paidCompleted.reduce((s, i) => s + Math.max(0, (i.paymentAmount || 200) - 170), 0);
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
  const d = await dbGet("siteConfig/earnSettings");
  return d?.value || null;
}

export async function saveEarnSettings(settings) {
  await dbPut("siteConfig/earnSettings", { value: settings, updatedAt: new Date().toISOString() });
  return settings;
}

export async function fetchEarnDetails() {
  const d = await dbGet("siteConfig/earnDetails");
  return d?.value || null;
}

export async function saveEarnDetails(details) {
  await dbPut("siteConfig/earnDetails", { value: details, updatedAt: new Date().toISOString() });
  return details;
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
  const d = await dbGet("siteConfig/homepage");
  return d?.value || null;
}

export async function saveHomepageContent(content) {
  await dbPut("siteConfig/homepage", { value: content, updatedAt: new Date().toISOString() });
  return content;
}

export async function trackSiteVisit() {
  return dbPost("siteVisits", {
    visitedAt: new Date().toISOString(),
    userAgent: navigator.userAgent || "", language: navigator.language || "",
    referrer: document.referrer || "", url: window.location.href || "",
    screen: `${window.screen?.width || "?"}x${window.screen?.height || "?"}`,
    viewport: `${window.innerWidth || "?"}x${window.innerHeight || "?"}`,
    fingerprint: getDeviceFingerprint(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  });
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

export async function fetchUPISettings() {
  const d = await dbGet("siteConfig/upiSettings");
  return d?.value || null;
}

export async function saveUPISettings(settings) {
  await dbPut("siteConfig/upiSettings", { value: settings, updatedAt: new Date().toISOString() });
  return settings;
}

export async function fetchPaymentSettings() {
  const d = await dbGet("siteConfig/paymentSettings");
  return d?.value || null;
}

export async function savePaymentSettings(settings) {
  await dbPut("siteConfig/paymentSettings", { value: settings, updatedAt: new Date().toISOString() });
  return settings;
}

export async function overrideCompleteEnrollment(enrollmentId, adminEmail) {
  await dbPatch(`enrollments/${enrollmentId}`, { status: "Completed", allowedCertificate: "yes", completedAt: new Date().toISOString(), overrideCompleted: true, overriddenBy: adminEmail, updatedAt: new Date().toISOString() });
}

export async function unverifyProject(enrollmentId, projectIndex) {
  await dbPatch(`enrollments/${enrollmentId}/submissions/${projectIndex}`, { verified: false, verifiedAt: null });
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

export async function aiGradeQuiz(questions, answers) {
  const data = await apiFetch("/api/ai/grade-quiz", { method: "POST", body: JSON.stringify({ questions, answers }) });
  return data.data;
}

export async function fetchPaymentStats() {
  const enrollments = await dbList("enrollments");
  const paidEnrollments = enrollments.filter(e => e.paymentStatus === "paid");
  const referrals = await dbList("referrals");
  const totalCollected = paidEnrollments.reduce((sum, e) => sum + (e.paymentAmount || 0), 0);
  const referralPayouts = referrals.map(r => {
    const code = (r.code || r.id || "").toUpperCase().trim();
    const interns = enrollments.filter(e => (e.referralCode || "").toUpperCase().trim() === code && e.status === "Completed");
    const completedPaid = interns.filter(i => i.paymentStatus === "paid");
    const earnings = completedPaid.reduce((s, i) => s + Math.max(0, (i.paymentAmount || 200) - 170), 0);
    return { code: r.code || r.id, name: r.name, email: r.email, earned: earnings, interns: interns.length, completedPaid: completedPaid.length, payoutStatus: r.payoutStatus || "pending", payoutAt: r.payoutAt || null, payoutAmount: r.payoutAmount || null };
  });
  const totalDistribute = referralPayouts.reduce((s, r) => s + r.earned, 0);
  return { totalCollected, totalDistribute, netTotal: totalCollected - totalDistribute, paidEnrollments: paidEnrollments.length, referralPayouts };
}

export async function fetchUserTypes() {
  const d = await dbGet("siteConfig/userTypes");
  return d?.value || [];
}

export async function saveUserTypes(types) {
  await dbPut("siteConfig/userTypes", { value: types, updatedAt: new Date().toISOString() });
  return types;
}

export async function fetchPayoutConfig() {
  const d = await dbGet("siteConfig/payoutConfig");
  return d?.value || { payoutDays: 30, defaultPayoutPerIntern: 30 };
}

export async function savePayoutConfig(config) {
  await dbPut("siteConfig/payoutConfig", { value: config, updatedAt: new Date().toISOString() });
  return config;
}

export async function markReferralPayout(code, payoutAmount, payoutNote) {
  await dbPatch(`referrals/${code.toUpperCase().trim()}`, { payoutStatus: "done", payoutAmount, payoutNote, payoutAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function clearReferralPayout(code) {
  await dbPatch(`referrals/${code.toUpperCase().trim()}`, { payoutStatus: "pending", payoutAmount: null, payoutNote: null, payoutAt: null, updatedAt: new Date().toISOString() });
}

export async function fetchDodoConfig() {
  const d = await dbGet("siteConfig/dodoConfig");
  return d?.value || null;
}

export async function saveDodoConfig(config) {
  await dbPut("siteConfig/dodoConfig", { value: config, updatedAt: new Date().toISOString() });
  return config;
}

export async function fetchPaymentMethods() {
  const d = await dbGet("siteConfig/paymentMethods");
  return d?.value || { upi: true, dodo: false };
}

export async function savePaymentMethods(config) {
  await dbPut("siteConfig/paymentMethods", { value: config, updatedAt: new Date().toISOString() });
  return config;
}

// Audit log
export async function fetchAuditLog() {
  const data = await apiFetch("/api/data/audit-log");
  return data.data || [];
}

export async function logAdminAction(action, details = {}) {
  try {
    await apiFetch("/api/data/audit-log", {
      method: "POST",
      body: JSON.stringify({ action, ...details, timestamp: new Date().toISOString() }),
    });
  } catch {}
}

// Site config (generic key-value)
export async function fetchSiteConfig(key) {
  const data = await apiFetch(`/api/data/site-config?key=${encodeURIComponent(key)}`);
  return data.data || null;
}

export async function saveSiteConfig(key, value) {
  await apiFetch(`/api/data/site-config?key=${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify(value),
  });
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
  const data = await apiFetch("/api/data/what-do-you-get");
  return data.data || null;
}

export async function saveWhatDoYouGet(whatDoYouGet) {
  await apiFetch("/api/data/what-do-you-get", {
    method: "PUT",
    body: JSON.stringify({ whatDoYouGet }),
  });
  return whatDoYouGet;
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

// Coupons
export async function fetchCoupons() {
  const d = await dbGet("siteConfig/coupons");
  return d?.value || [];
}

export async function saveCoupons(coupons) {
  await dbPut("siteConfig/coupons", { value: coupons, updatedAt: new Date().toISOString() });
  return coupons;
}

export async function validateCoupon(code) {
  if (!code || !code.trim()) return { valid: false, message: "Enter a coupon code." };
  const all = await fetchCoupons();
  const c = all.find((c) => c.code === code.toUpperCase().trim());
  if (!c) return { valid: false, message: "Invalid coupon code." };
  if (!c.active) return { valid: false, message: "This coupon has expired or been deactivated." };
  if (c.expiryDate && new Date(c.expiryDate) < new Date(new Date().toDateString())) return { valid: false, message: "This coupon has expired." };
  const used = c.usedCount || 0;
  if (c.maxUses && used >= c.maxUses) return { valid: false, message: "This coupon has reached its usage limit." };
  const discountPercent = Math.min(100, Math.max(0, Number(c.discountPercent) || 0));
  return { valid: true, coupon: c, discountPercent, message: `${discountPercent}% discount applied!` };
}

export async function incrementCouponUsage(code) {
  if (!code) return;
  const all = await fetchCoupons();
  const idx = all.findIndex((c) => c.code === code.toUpperCase().trim());
  if (idx === -1) return;
  all[idx] = { ...all[idx], usedCount: (all[idx].usedCount || 0) + 1 };
  await saveCoupons(all);
}

// Receipt
export async function fetchReceipt(enrollmentId) {
  return apiFetch(`/api/data/receipt/${enrollmentId}`);
}

// Leaderboard
export async function fetchReferralLeaderboard() {
  const referrals = await dbList("referrals");
  const enrollments = await dbList("enrollments");
  return referrals
    .filter((r) => r.name && r.code)
    .map((r) => {
      const interns = enrollments.filter((e) => (e.referralCode || "").toUpperCase().trim() === (r.code || "").toUpperCase().trim());
      const completedPaid = interns.filter((i) => i.status === "Completed" && i.paymentStatus === "paid");
      return { name: r.name, code: r.code, interns: interns.length, completed: completedPaid.length, earnings: completedPaid.length * 30 };
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