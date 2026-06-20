const DB_URL = "https://login-data-680b9-default-rtdb.firebaseio.com";
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

function dbUrl(path) {
  return `${DB_URL}/${path}.json`;
}

async function dbGet(path) {
  try {
    const res = await fetch(dbUrl(path));
    if (!res.ok) { console.warn("dbGet", path, res.status); return null; }
    const data = await res.json();
    if (data === null) return null;
    if (data.error) { console.warn("dbGet", path, data.error); return null; }
    return data;
  } catch (e) { console.warn("dbGet", path, e.message); return null; }
}

async function dbPut(path, data) {
  const res = await fetch(dbUrl(path), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`Firebase PUT ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function dbPutSilent(path, data) {
  try { return await dbPut(path, data); } catch (e) { console.warn("dbPut:", e.message); return null; }
}

async function dbPost(path, data) {
  const res = await fetch(dbUrl(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) { console.warn("dbPost", path, res.status); return { id: null, ...data }; }
  const result = await res.json();
  return { id: result.name, ...data };
}

async function dbPatch(path, data) {
  const res = await fetch(dbUrl(path), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`Firebase PATCH ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function dbDelete(path) {
  try { await fetch(dbUrl(path), { method: "DELETE" }); } catch {}
}

async function dbList(path) {
  const data = await dbGet(path);
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).map(([key, val]) => ({ id: key, ...val }));
}

async function dbQueryList(path, field, value) {
  const data = await dbGet(path);
  if (!data || typeof data !== "object") return [];
  return Object.entries(data)
    .filter(([, val]) => val[field] === value)
    .map(([key, val]) => ({ id: key, ...val }));
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
  if (!paths.length && !categories.length) return { paths: FALLBACK_PATHS, categories: [] };
  return { paths, categories };
}

export async function saveCareerPaths(paths, categories) {
  const now = new Date().toISOString();
  const obj = {};
  paths.forEach((item, idx) => {
    const id = (item.id || `DEV-CRAFT-${String(idx + 1).padStart(3, '0')}`).toUpperCase();
    obj[id] = { ...item, id, updatedAt: now };
  });
  await dbPut("careerPaths", obj);
  if (categories) await dbPut("siteConfig/domainCategories", { value: categories, updatedAt: now });
  return { paths, categories };
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
  if (raw.templates) return raw;
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
  const data = await dbPatch(`users/${uid}`, { ...profile, updatedAt: new Date().toISOString() });
  return { ...profile, uid };
}

// Enrollment
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
  const enrollment = {
    internId, uid, name: profile.name || profile.displayName || "Student", email: profile.email || "", photoURL: profile.photoURL || "",
    phone: profile.phone || "", college: profile.college || "", city: profile.city || "", country: profile.country || "", upiId: profile.upiId || "",
    domain: domainObj.title || domainObj.name || "", domainId: domainObj.id || "", projects: domainObj.projects || [],
    referralCode: refCode, status: "Active", allowedCertificate: "no", submissions: {},
    paymentStatus: "none", paymentStage: "none", paymentAmount: domainAmount,
    paymentStartAmount: pmtStart, paymentEndAmount: pmtEnd, paymentTiming, paymentIntentId: "", overrideCompleted: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await dbPut(`enrollments/${internId}`, enrollment);
  enrollment.id = internId;
  if (refCode) {
    const ref = await dbGet(`referrals/${refCode}/contacted`);
    await dbPatch(`referrals/${refCode}`, { contacted: (ref || 0) + 1, updatedAt: new Date().toISOString() });
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
  await dbPatch(`enrollments/${enrollmentId}`, { status: "Completed", allowedCertificate: "yes", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return { ...enrollment, status: "Completed", allowedCertificate: "yes" };
}

export async function submitProject(enrollmentId, projectIndex, submissionText, submissionUrl = "") {
  await dbPatch(`enrollments/${enrollmentId}/submissions/${projectIndex}`, { text: submissionText, url: submissionUrl, submittedAt: new Date().toISOString(), verified: false });
}

export async function submitQuizAnswer(enrollmentId, projectIndex, answers, project) {
  await dbPut(`enrollments/${enrollmentId}/submissions/${projectIndex}`, { answers, project, submittedAt: new Date().toISOString(), verified: false, type: "quiz" });
}

export async function verifyProject(enrollmentId, projectIndex) {
  await dbPatch(`enrollments/${enrollmentId}/submissions/${projectIndex}`, { verified: true, verifiedAt: new Date().toISOString(), rejected: false });
}

export async function saveProjectFeedback(enrollmentId, projectIndex, feedback) {
  await dbPatch(`enrollments/${enrollmentId}/submissions/${projectIndex}`, { feedback });
}

export async function rejectProject(enrollmentId, projectIndex, feedback) {
  await dbPatch(`enrollments/${enrollmentId}/submissions/${projectIndex}`, { verified: false, rejected: true, feedback, rejectedAt: new Date().toISOString() });
}

export async function fetchEnrollmentById(enrollmentId) { return dbGet(`enrollments/${enrollmentId}`); }

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

export async function trackReferralVisit(referralCode) {
  if (!referralCode) return null;
  const code = referralCode.toUpperCase().trim();
  const now = new Date().toISOString();
  const visit = await dbPost("referralVisits", {
    action: "visited", referralCode: code, visitedAt: now, matched: true,
    link: window.location.href, language: navigator.language || "",
    browser: navigator.userAgent || "",
  });
  const ref = await dbGet(`referrals/${code}/visited`);
  await dbPatch(`referrals/${code}`, { visited: (ref || 0) + 1, lastVisitedAt: now, updatedAt: now });
  return visit;
}

export async function processReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("ref") || params.get("referral") || "").trim().toUpperCase();
  if (!code) return { code: "", matched: false };
  const matched = await isReferralCodeMatched(code);
  if (matched) { localStorage.setItem("detected_referral_code", code); await trackReferralVisit(code); }
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
  const cleanEmail = email.toLowerCase().trim();
  const emailId = cleanEmail.replace(/\./g, ",");
  await dbPut(`admins/${emailId}`, { email: cleanEmail, createdAt: new Date().toISOString() });
}

export async function removeAdmin(email) {
  await dbDelete(`admins/${email.toLowerCase().trim().replace(/\./g, ",")}`);
}

export async function createSelfReferral(details, uid) {
  const code = (details.code || `REF-${String(uid).slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`).toUpperCase();
  const now = new Date().toISOString();
  await dbPut(`referrals/${code}`, { id: code, code, ...details, uid, selfCreated: true, createdAt: now, updatedAt: now });
  await dbPut(`selfReferralOwners/${uid}`, { uid, code, createdAt: now });
  await dbPatch(`users/${uid}`, { selfReferralCode: code, updatedAt: now });
  return { code };
}

export async function fetchSelfReferralCode(uid) {
  const data = await dbGet(`selfReferralOwners/${uid}`);
  return data?.code || null;
}

export async function fetchReferralDashboardData(uid) {
  const owner = await dbGet(`selfReferralOwners/${uid}`);
  if (!owner?.code) return { referral: null, visits: [], interns: [], totals: { visits: 0, interns: 0, completed: 0, earnings: 0 } };
  const code = owner.code.toUpperCase().trim();
  const visits = await dbQueryList("referralVisits", "referralCode", code);
  const referral = await dbGet(`referrals/${code}`);
  const interns = await dbQueryList("enrollments", "referralCode", code);
  const completed = interns.filter(i => i.status === "Completed" && i.paymentStatus === "paid");
  const earnings = completed.reduce((s, i) => s + Math.max(0, (i.paymentAmount || 200) - 170), 0);
  return { referral, visits, interns, totals: { visits: visits.length, interns: interns.length, completed: completed.length, earnings } };
}

export async function fetchUserReferralStat(email) {
  const list = await dbQueryList("referrals", "email", email);
  if (!list.length) return null;
  const referral = list[0];
  const code = (referral.code || referral.id || "").toUpperCase().trim();
  const interns = await dbQueryList("enrollments", "referralCode", code);
  return { referral, interns, internCount: interns.length, completed: interns.filter(i => i.status === "Completed").length };
}

export async function fetchAdminReferralUsersWithInterns() {
  const referrals = await dbList("referrals");
  const allEnrollments = await dbList("enrollments");
  return referrals.map(r => {
    const code = (r.code || r.id || "").toUpperCase().trim();
    const interns = allEnrollments.filter(e => (e.referralCode || "").toUpperCase().trim() === code);
    const paidCompleted = interns.filter(i => i.status === "Completed" && i.paymentStatus === "paid");
    const earnings = paidCompleted.reduce((s, i) => s + Math.max(0, (i.paymentAmount || 200) - 170), 0);
    return { ...r, code, internCount: interns.length, interns, earnings, paidCompletedCount: paidCompleted.length };
  });
}

export async function savePermanentReferralCode(uid, code) {
  if (!uid || !code) return null;
  await dbPatch(`users/${uid}`, { permanentReferralCode: code.toUpperCase().trim(), permanentReferralDetectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
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

export async function createPaymentIntent(enrollmentId, amount, paymentStage = "full") {
  const data = await apiFetch("/api/create-payment-intent", { method: "POST", body: JSON.stringify({ enrollmentId, amount, paymentStage }) });
  return data.data;
}

export async function fetchStripeConfig() {
  const d = await dbGet("siteConfig/stripe-config");
  return d?.data || { publishableKey: "" };
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
    if (paymentStage === "end" || paymentStage === "full") { patch.allowedCertificate = "yes"; patch.paymentStage = "fully_paid"; }
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