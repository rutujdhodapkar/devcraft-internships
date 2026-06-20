import { ref, get, set, push, update, remove, query, orderByChild, equalTo } from "firebase/database";
import { db } from "../firebase";

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

function userIdentity(user) {
  if (!user) return null;
  return {
    uid: user.uid || user.id || "",
    email: user.email || "",
    displayName: user.displayName || user.name || "",
    photoURL: user.photoURL || "",
  };
}

async function listCollection(path) {
  const snap = await get(ref(db, path));
  if (!snap.exists()) return [];
  const result = [];
  snap.forEach(child => result.push({ id: child.key, ...child.val() }));
  return result;
}

async function getDoc(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}

async function pushDoc(path, data) {
  const newRef = push(ref(db, path));
  const item = { id: newRef.key, ...data };
  await set(newRef, item);
  return item;
}

async function deleteDoc(path) {
  await remove(ref(db, path));
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data.success === false) {
    throw new Error(data.message || data.error || "Request failed.");
  }
  return data;
}

async function getData(path) {
  const data = await apiFetch(`/api/data/${path}`);
  return data.data ?? null;
}

async function postData(path, payload) {
  const data = await apiFetch(`/api/data/${path}`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return data.data;
}

async function deleteApiData(path) {
  const data = await apiFetch(`/api/data/${path}`, { method: "DELETE" });
  return data.data;
}

// Career Paths
export async function fetchCareerPaths() {
  const paths = await listCollection("careerPaths");
  const categories = (await getDoc("siteConfig/domainCategories"))?.value || [];
  if (!paths.length && !categories.length) {
    return { paths: FALLBACK_PATHS, categories: [] };
  }
  return { paths, categories };
}

export async function saveCareerPaths(paths, categories) {
  await remove(ref(db, "careerPaths"));
  const updates = {};
  paths.forEach((item, idx) => {
    const id = item.id || `path_${idx + 1}`;
    updates[`careerPaths/${id}`] = { ...item, id, updatedAt: new Date().toISOString() };
  });
  if (Object.keys(updates).length) await update(ref(db), updates);
  if (categories) await set(ref(db, "siteConfig/domainCategories"), { value: categories, updatedAt: new Date().toISOString() });
  return { paths, categories };
}

// How It Works
export async function fetchHowItWorks() {
  const steps = await listCollection("howItWorks");
  const sorted = steps.sort((a, b) => (a.step || 0) - (b.step || 0));
  return sorted.length ? sorted : FALLBACK_STEPS;
}

export async function saveHowItWorks(steps) {
  await remove(ref(db, "howItWorks"));
  const updates = {};
  steps.forEach((step) => { updates[`howItWorks/${step.id}`] = { ...step, updatedAt: new Date().toISOString() }; });
  if (Object.keys(updates).length) await update(ref(db), updates);
  return steps;
}

// FAQs
export async function fetchFAQs() {
  const faqs = await listCollection("faqs");
  return faqs.length ? faqs : FALLBACK_FAQS;
}

export async function saveFAQs(faqs) {
  await remove(ref(db, "faqs"));
  const updates = {};
  faqs.forEach((faq) => { updates[`faqs/${faq.id}`] = { ...faq, updatedAt: new Date().toISOString() }; });
  if (Object.keys(updates).length) await update(ref(db), updates);
  return faqs;
}

// Templates
export async function fetchTemplates() {
  return (await getDoc("config/templates"))?.value || null;
}

export async function saveTemplates(templates) {
  await set(ref(db, "config/templates"), { value: templates, updatedAt: new Date().toISOString() });
  return templates;
}

// About Text
export async function fetchAboutText() {
  return (await getDoc("config/aboutText"))?.value || "";
}

export async function saveAboutText(text) {
  await set(ref(db, "config/aboutText"), { value: text, updatedAt: new Date().toISOString() });
  return text;
}

// Inquiries (stored in RTDB under "inquiries")
export async function saveInquiry(inquiry) {
  return pushDoc("inquiries", inquiry);
}

// User Profile
export async function fetchUserProfile(uid) {
  if (!uid) return null;
  return getDoc(`users/${uid}`);
}

export async function saveUserProfile(uid, profile) {
  await update(ref(db, `users/${uid}`), { ...profile, updatedAt: new Date().toISOString() });
  return { ...profile, uid };
}

// Enrollment
export async function enrollStudent(uid, profile, domainObj) {
  const detectedReferralCode = localStorage.getItem("detected_referral_code") || "";
  const permanentReferralCode = await fetchPermanentReferralCode(uid);
  const refCode = (detectedReferralCode || permanentReferralCode || "").toUpperCase().trim();
  const paymentSettings = await getDoc("siteConfig/paymentSettings");
  const ps = paymentSettings?.value || { defaultAmount: 200, defaultAmountReferral: 170 };
  const isReferral = !!refCode;
  const domainAmount = domainObj.paymentAmount || (isReferral ? ps.defaultAmountReferral : ps.defaultAmount);
  const paymentTiming = domainObj.paymentTiming || ps.defaultTiming || "end";
  const splitPercent = domainObj.paymentSplitPercent || ps.defaultSplitPercent || 50;
  const pmtStart = paymentTiming === "both" ? Math.round(domainAmount * splitPercent / 100) : 0;
  const pmtEnd = paymentTiming === "both" ? domainAmount - pmtStart : domainAmount;
  const enrollment = {
    uid,
    name: profile.name || profile.displayName || "Student",
    email: profile.email || "",
    photoURL: profile.photoURL || "",
    phone: profile.phone || "",
    college: profile.college || "",
    city: profile.city || "",
    country: profile.country || "",
    upiId: profile.upiId || "",
    domain: domainObj.title || domainObj.name || "",
    domainId: domainObj.id || "",
    projects: domainObj.projects || [],
    referralCode: refCode,
    status: "Active",
    allowedCertificate: "no",
    submissions: {},
    paymentStatus: "none",
    paymentStage: "none",
    paymentAmount: domainAmount,
    paymentStartAmount: pmtStart,
    paymentEndAmount: pmtEnd,
    paymentTiming,
    paymentIntentId: "",
    overrideCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const newRef = push(ref(db, "enrollments"));
  enrollment.id = newRef.key;
  await set(newRef, enrollment);
  if (refCode) {
    const refSnap = await get(ref(db, `referrals/${refCode}/contacted`));
    await update(ref(db, `referrals/${refCode}`), { contacted: (refSnap.val() || 0) + 1, updatedAt: new Date().toISOString() });
  }
  if (detectedReferralCode) localStorage.removeItem("detected_referral_code");
  return enrollment;
}

export async function fetchEnrollments() {
  return listCollection("enrollments");
}

export async function fetchUserEnrollments(uid) {
  const snap = await get(query(ref(db, "enrollments"), orderByChild("uid"), equalTo(uid)));
  if (!snap.exists()) return [];
  const result = [];
  snap.forEach(child => result.push({ id: child.key, ...child.val() }));
  return result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function updateEnrollmentStatus(enrollmentId, status) {
  await update(ref(db, `enrollments/${enrollmentId}`), { status, updatedAt: new Date().toISOString() });
}

export async function submitTransactionId(enrollmentId, transactionId) {
  await update(ref(db, `enrollments/${enrollmentId}`), { transactionId, updatedAt: new Date().toISOString() });
}

export async function recordReferralLogin(referralCode, user) {
  if (!referralCode || !user?.uid) return null;
  const code = referralCode.toUpperCase().trim();
  const data = { ...userIdentity(user), code, loginAt: new Date().toISOString() };
  await set(ref(db, `referralUsers/${code}_${user.uid}`), { ...data, updatedAt: new Date().toISOString() });
  await update(ref(db, `referrals/${code}`), { lastActivityAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return { code };
}

export async function allowCertificate(enrollmentId, allowed) {
  await update(ref(db, `enrollments/${enrollmentId}`), { allowedCertificate: allowed, updatedAt: new Date().toISOString() });
}

export async function verifyInternship(enrollmentId) {
  await update(ref(db, `enrollments/${enrollmentId}`), { status: "Completed", allowedCertificate: "yes", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function submitProject(enrollmentId, projectIndex, submissionText, submissionUrl = "") {
  const now = new Date().toISOString();
  await update(ref(db, `enrollments/${enrollmentId}/submissions/${projectIndex}`), { text: submissionText, url: submissionUrl, submittedAt: now, verified: false });
}

export async function submitQuizAnswer(enrollmentId, projectIndex, answers, project) {
  const now = new Date().toISOString();
  await set(ref(db, `enrollments/${enrollmentId}/submissions/${projectIndex}`), { answers, project, submittedAt: now, verified: false, type: "quiz" });
}

export async function verifyProject(enrollmentId, projectIndex) {
  const now = new Date().toISOString();
  await update(ref(db, `enrollments/${enrollmentId}/submissions/${projectIndex}`), { verified: true, verifiedAt: now, rejected: false });
}

export async function saveProjectFeedback(enrollmentId, projectIndex, feedback) {
  await update(ref(db, `enrollments/${enrollmentId}/submissions/${projectIndex}`), { feedback });
}

export async function rejectProject(enrollmentId, projectIndex, feedback) {
  const now = new Date().toISOString();
  await update(ref(db, `enrollments/${enrollmentId}/submissions/${projectIndex}`), { verified: false, rejected: true, feedback, rejectedAt: now });
}

export async function fetchEnrollmentById(enrollmentId) {
  return getDoc(`enrollments/${enrollmentId}`);
}

// Admin
export async function fetchAdminData() {
  const [requests, referrals, visits] = await Promise.all([
    listCollection("enrollments"),
    listCollection("referrals"),
    listCollection("referralVisits"),
  ]);
  return {
    requests: requests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    referrals,
    visits: visits.sort((a, b) => new Date(b.visitedAt || 0) - new Date(a.visitedAt || 0)).slice(0, 100),
  };
}

// Referrals
export async function isReferralCodeMatched(referralCode) {
  if (!referralCode) return false;
  const snap = await get(ref(db, `referrals/${referralCode.toUpperCase().trim()}`));
  return snap.exists();
}

export async function deleteReferral(code) {
  await remove(ref(db, `referrals/${code.toUpperCase().trim()}`));
}

export async function deleteEnrollment(enrollmentId) {
  await remove(ref(db, `enrollments/${enrollmentId}`));
}

export async function createReferral(details) {
  const code = (details.code || `REF-${Date.now().toString(36).toUpperCase()}`).toUpperCase().trim();
  const referral = { id: code, code, ...details, visited: 0, contacted: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await set(ref(db, `referrals/${code}`), referral);
  return referral;
}

export async function trackReferralVisit(referralCode) {
  if (!referralCode) return null;
  const code = referralCode.toUpperCase().trim();
  const visit = await pushDoc("referralVisits", { referralCode: code, visitedAt: new Date().toISOString(), url: window.location.href, referrer: document.referrer });
  const refSnap = await get(ref(db, `referrals/${code}/visited`));
  await update(ref(db, `referrals/${code}`), { visited: (refSnap.val() || 0) + 1, lastVisitedAt: visit.visitedAt, updatedAt: new Date().toISOString() });
  return visit;
}

export async function processReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("ref") || params.get("referral") || "").trim().toUpperCase();
  if (!code) return { code: "", matched: false };
  const matched = await isReferralCodeMatched(code);
  if (matched) {
    localStorage.setItem("detected_referral_code", code);
    await trackReferralVisit(code);
  }
  return { code, matched };
}

export async function markReferralContacted(referralCode) {
  const code = referralCode.toUpperCase().trim();
  const refSnap = await get(ref(db, `referrals/${code}/contacted`));
  await update(ref(db, `referrals/${code}`), { contacted: (refSnap.val() || 0) + 1, lastContactedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

// Admins
export async function checkAdminStatus(email) {
  const cleanEmail = (email || "").toLowerCase().trim();
  if (cleanEmail === "rutujdhodapkar@gmail.com") return { isAdmin: true };
  const emailId = cleanEmail.replace(/\./g, ",");
  const snap = await get(ref(db, `admins/${emailId}`));
  return { isAdmin: snap.exists() };
}

export async function fetchAdmins() {
  const list = await listCollection("admins");
  return list.map(a => a.email || a.id);
}

export async function addAdmin(email) {
  const cleanEmail = email.toLowerCase().trim();
  const emailId = cleanEmail.replace(/\./g, ",");
  await set(ref(db, `admins/${emailId}`), { email: cleanEmail, createdAt: new Date().toISOString() });
}

export async function removeAdmin(email) {
  const emailId = email.toLowerCase().trim().replace(/\./g, ",");
  await remove(ref(db, `admins/${emailId}`));
}

// Self Referrals
export async function createSelfReferral(details, uid) {
  const code = (details.code || `REF-${String(uid).slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`).toUpperCase();
  const now = new Date().toISOString();
  await set(ref(db, `referrals/${code}`), { id: code, code, ...details, uid, selfCreated: true, createdAt: now, updatedAt: now });
  await set(ref(db, `selfReferralOwners/${uid}`), { uid, code, createdAt: now });
  await update(ref(db, `users/${uid}`), { selfReferralCode: code, updatedAt: now });
  return { code };
}

export async function fetchSelfReferralCode(uid) {
  const data = await getDoc(`selfReferralOwners/${uid}`);
  return data?.code || null;
}

export async function fetchReferralDashboardData(uid) {
  const owner = await getDoc(`selfReferralOwners/${uid}`);
  if (!owner?.code) return { referral: null, visits: [], interns: [], totals: { visits: 0, interns: 0, completed: 0, earnings: 0 } };
  const code = owner.code.toUpperCase().trim();
  const visitSnap = await get(query(ref(db, "referralVisits"), orderByChild("referralCode"), equalTo(code)));
  const visits = [];
  if (visitSnap.exists()) visitSnap.forEach(child => visits.push({ id: child.key, ...child.val() }));
  const referral = await getDoc(`referrals/${code}`);
  const internSnap = await get(query(ref(db, "enrollments"), orderByChild("referralCode"), equalTo(code)));
  const interns = [];
  if (internSnap.exists()) internSnap.forEach(child => interns.push({ id: child.key, ...child.val() }));
  const completed = interns.filter(i => i.status === "Completed" && i.paymentStatus === "paid");
  const earnings = completed.reduce((s, i) => s + Math.max(0, (i.paymentAmount || 200) - 170), 0);
  return { referral, visits, interns, totals: { visits: visits.length, interns: interns.length, completed: completed.length, earnings } };
}

export async function fetchUserReferralStat(email) {
  const snap = await get(query(ref(db, "referrals"), orderByChild("email"), equalTo(email)));
  if (!snap.exists()) return null;
  let referral = null;
  snap.forEach(c => { if (!referral) referral = { id: c.key, ...c.val() }; });
  const code = (referral.code || referral.id || "").toUpperCase().trim();
  const internSnap = await get(query(ref(db, "enrollments"), orderByChild("referralCode"), equalTo(code)));
  const interns = [];
  if (internSnap.exists()) internSnap.forEach(child => interns.push({ id: child.key, ...child.val() }));
  return { referral, interns, internCount: interns.length, completed: interns.filter(i => i.status === "Completed").length };
}

export async function fetchAdminReferralUsersWithInterns() {
  const referrals = await listCollection("referrals");
  const allEnrollments = await listCollection("enrollments");
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
  const now = new Date().toISOString();
  await update(ref(db, `users/${uid}`), { permanentReferralCode: code.toUpperCase().trim(), permanentReferralDetectedAt: now, updatedAt: now });
  return { code: code.toUpperCase().trim() };
}

export async function fetchPermanentReferralCode(uid) {
  const user = await getDoc(`users/${uid}`);
  return user?.permanentReferralCode || null;
}

export async function fetchEarnSettings() {
  return (await getDoc("siteConfig/earnSettings"))?.value || null;
}

export async function saveEarnSettings(settings) {
  await set(ref(db, "siteConfig/earnSettings"), { value: settings, updatedAt: new Date().toISOString() });
  return settings;
}

export async function fetchEarnDetails() {
  return (await getDoc("siteConfig/earnDetails"))?.value || null;
}

export async function saveEarnDetails(details) {
  await set(ref(db, "siteConfig/earnDetails"), { value: details, updatedAt: new Date().toISOString() });
  return details;
}

// Banned Users
export async function fetchBannedUsers() {
  return listCollection("bannedUsers");
}

export async function checkUserBan(email) {
  const emailId = (email || "").toLowerCase().trim().replace(/\./g, ",");
  return getDoc(`bannedUsers/${emailId}`);
}

export async function banUser(email, banType, reason, bannedBy) {
  const emailId = email.toLowerCase().trim().replace(/\./g, ",");
  await set(ref(db, `bannedUsers/${emailId}`), { email: email.toLowerCase().trim(), banType, reason, bannedBy, bannedAt: new Date().toISOString() });
}

export async function unbanUser(email) {
  const emailId = email.toLowerCase().trim().replace(/\./g, ",");
  await remove(ref(db, `bannedUsers/${emailId}`));
}

// Admin Messages
export async function fetchAdminMessages(userEmail, { context, uid } = {}) {
  const msgs = await listCollection("adminMessages");
  const now = new Date();
  return msgs.filter(m => {
    if (m.expiresAt && new Date(m.expiresAt) < now) return false;
    if (m.target && m.target !== "all" && m.target.toLowerCase() !== String(userEmail).toLowerCase()) return false;
    if (context && m.context && m.context !== context) return false;
    if (uid && m.acknowledgedBy?.[uid]) return false;
    return true;
  });
}

export async function fetchAllAdminMessages() {
  return listCollection("adminMessages");
}

export async function saveAdminMessage(message) {
  return pushDoc("adminMessages", { ...message, acknowledgedBy: {} });
}

export async function acknowledgeAdminMessage(messageId, uid, userInfo = {}) {
  await set(ref(db, `adminMessages/${messageId}/acknowledgedBy/${uid}`), { ...userInfo, uid, acknowledgedAt: new Date().toISOString() });
}

export async function deleteAdminMessage(id) {
  await remove(ref(db, `adminMessages/${id}`));
}

// Site Notices
export async function saveSiteNotice(notice) {
  return pushDoc("siteNotices", { ...notice, active: true });
}

export async function fetchSiteNotices() {
  return (await listCollection("siteNotices")).filter(n => n.active !== false);
}

export async function toggleSiteNotice(id, active) {
  await update(ref(db, `siteNotices/${id}`), { active, updatedAt: new Date().toISOString() });
}

export async function deleteSiteNotice(id) {
  await remove(ref(db, `siteNotices/${id}`));
}

// Homepage
export async function fetchHomepageContent() {
  return (await getDoc("siteConfig/homepage"))?.value || null;
}

export async function saveHomepageContent(content) {
  await set(ref(db, "siteConfig/homepage"), { value: content, updatedAt: new Date().toISOString() });
  return content;
}

// Site Visit Tracking
export async function trackSiteVisit(user) {
  return pushDoc("siteVisits", {
    user: userIdentity(user),
    visitedAt: new Date().toISOString(),
    userAgent: navigator.userAgent || "",
    language: navigator.language || "",
    referrer: document.referrer || "",
    url: window.location.href || "",
    screen: `${window.screen?.width || "?"}x${window.screen?.height || "?"}`,
    viewport: `${window.innerWidth || "?"}x${window.innerHeight || "?"}`,
  });
}

// Referral achieved / auto-unachieve
export async function markReferralAchieved(referralCode, achieved) {
  const code = referralCode.toUpperCase().trim();
  await update(ref(db, `referrals/${code}`), { achieved, achievedAt: achieved ? new Date().toISOString() : null, updatedAt: new Date().toISOString() });
}

export async function markEnrollmentComplete(enrollmentId) {
  const now = new Date().toISOString();
  await update(ref(db, `enrollments/${enrollmentId}`), { status: "Completed", allowedCertificate: "yes", completedAt: now, updatedAt: now });
}

export async function rejectEnrollmentCompletion(enrollmentId, reason) {
  const now = new Date().toISOString();
  await update(ref(db, `enrollments/${enrollmentId}`), { completionRejectedAt: now, completionRejectReason: reason, updatedAt: now });
}

export async function clearCompletionRejection(enrollmentId) {
  await update(ref(db, `enrollments/${enrollmentId}`), { completionRejectedAt: null, completionRejectReason: null, updatedAt: new Date().toISOString() });
}

export async function autoUnachieveIfActivity(referralCode) {
  return { unachieved: false };
}

// AI Verification (still uses API for NVIDIA)
export async function verifyTaskWithAI(params) {
  const data = await apiFetch("/api/ai/verify-task", { method: "POST", body: JSON.stringify(params) });
  return { success: true, data: data.data };
}

// Stripe (still uses API)
export async function createPaymentIntent(enrollmentId, amount, paymentStage = "full") {
  const data = await apiFetch("/api/create-payment-intent", { method: "POST", body: JSON.stringify({ enrollmentId, amount, paymentStage }) });
  return data.data;
}

export async function fetchStripeConfig() {
  return (await getDoc("siteConfig/stripe-config"))?.data || { publishableKey: "" };
}

export async function fetchPaymentSettings() {
  return (await getDoc("siteConfig/paymentSettings"))?.value || null;
}

export async function savePaymentSettings(settings) {
  await set(ref(db, "siteConfig/paymentSettings"), { value: settings, updatedAt: new Date().toISOString() });
  return settings;
}

// Enrollment Override / Payment
export async function overrideCompleteEnrollment(enrollmentId, adminEmail) {
  const now = new Date().toISOString();
  await update(ref(db, `enrollments/${enrollmentId}`), { status: "Completed", allowedCertificate: "yes", completedAt: now, overrideCompleted: true, overriddenBy: adminEmail, updatedAt: now });
}

export async function unverifyProject(enrollmentId, projectIndex) {
  await update(ref(db, `enrollments/${enrollmentId}/submissions/${projectIndex}`), { verified: false, verifiedAt: null });
}

export async function unverifyPayment(enrollmentId, reason) {
  await update(ref(db, `enrollments/${enrollmentId}`), { paymentStatus: "none", paymentStage: "none", paidAt: null, paymentIntentId: "", allowedCertificate: "no", paymentUnverifyReason: reason, updatedAt: new Date().toISOString() });
}

export async function updatePaymentStatus(enrollmentId, paymentStatus, paymentStage) {
  const now = new Date().toISOString();
  const patch = { paymentStatus, paymentStage, updatedAt: now };
  if (paymentStatus === "paid") {
    patch.paidAt = now;
    if (paymentStage === "start" || !paymentStage) patch.paymentStage = "start_paid";
    if (paymentStage === "end" || paymentStage === "full") {
      patch.allowedCertificate = "yes";
      patch.paymentStage = "fully_paid";
    }
  }
  await update(ref(db, `enrollments/${enrollmentId}`), patch);
}

export async function setPaymentAmount(enrollmentId, paymentAmount) {
  await update(ref(db, `enrollments/${enrollmentId}`), { paymentAmount, updatedAt: new Date().toISOString() });
}

export async function aiGradeQuiz(questions, answers) {
  const data = await apiFetch("/api/ai/grade-quiz", { method: "POST", body: JSON.stringify({ questions, answers }) });
  return data.data;
}

// Payment Stats
export async function fetchPaymentStats() {
  const enrollments = await listCollection("enrollments");
  const paidEnrollments = enrollments.filter(e => e.paymentStatus === "paid");
  const referrals = await listCollection("referrals");
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

// User Types
export async function fetchUserTypes() {
  return (await getDoc("siteConfig/userTypes"))?.value || [];
}

export async function saveUserTypes(types) {
  await set(ref(db, "siteConfig/userTypes"), { value: types, updatedAt: new Date().toISOString() });
  return types;
}

// Payout Config
export async function fetchPayoutConfig() {
  return (await getDoc("siteConfig/payoutConfig"))?.value || { payoutDays: 30, defaultPayoutPerIntern: 30 };
}

export async function savePayoutConfig(config) {
  await set(ref(db, "siteConfig/payoutConfig"), { value: config, updatedAt: new Date().toISOString() });
  return config;
}

// Referral Payout
export async function markReferralPayout(code, payoutAmount, payoutNote) {
  const c = code.toUpperCase().trim();
  await update(ref(db, `referrals/${c}`), { payoutStatus: "done", payoutAmount, payoutNote, payoutAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function clearReferralPayout(code) {
  const c = code.toUpperCase().trim();
  await update(ref(db, `referrals/${c}`), { payoutStatus: "pending", payoutAmount: null, payoutNote: null, payoutAt: null, updatedAt: new Date().toISOString() });
}