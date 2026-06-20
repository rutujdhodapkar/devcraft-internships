  const API_BASE = (import.meta.env.VITE_SERVER_URL || "https://devcraft.rutujdhodapkar.tech").replace(/\/api\/?$/, "");

function userIdentity(user) {
  if (!user) return null;
  return {
    uid: user.uid || user.id || "",
    email: user.email || "",
    displayName: user.displayName || user.name || "",
    photoURL: user.photoURL || "",
  };
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

async function deleteData(path) {
  const data = await apiFetch(`/api/data/${path}`, { method: "DELETE" });
  return data.data;
}

export async function fetchCareerPaths() {
  return getData("career-paths");
}

export async function saveCareerPaths(paths, categories) {
  return postData("career-paths", { paths, categories });
}

export async function fetchHowItWorks() {
  return getData("how-it-works");
}

export async function saveHowItWorks(steps) {
  return postData("how-it-works", { steps });
}

export async function fetchFAQs() {
  return getData("faqs");
}

export async function saveFAQs(faqs) {
  return postData("faqs", { faqs });
}

export async function fetchTemplates() {
  return getData("templates");
}

export async function saveTemplates(templates) {
  return postData("templates", { templates });
}

export async function fetchAboutText() {
  return getData("about-text");
}

export async function saveAboutText(text) {
  return postData("about-text", { text });
}

export async function saveInquiry(inquiry) {
  return postData("inquiries", { inquiry });
}

export async function fetchUserProfile(uid) {
  if (!uid) return null;
  return getData(`users/${encodeURIComponent(uid)}`);
}

export async function saveUserProfile(uid, profile) {
  return postData(`users/${encodeURIComponent(uid)}`, { profile });
}

export async function enrollStudent(uid, profile, domainObj) {
  const detectedReferralCode = localStorage.getItem("detected_referral_code") || "";
  const permanentReferralCode = await fetchPermanentReferralCode(uid);
  const payload = {
    uid,
    profile,
    domain: domainObj,
    referralCode: detectedReferralCode || permanentReferralCode || "",
  };
  const result = await postData("enrollments", payload);
  if (detectedReferralCode) localStorage.removeItem("detected_referral_code");
  return result;
}

export async function fetchEnrollments() {
  return getData("enrollments");
}

export async function fetchUserEnrollments(uid) {
  return getData(`users/${encodeURIComponent(uid)}/enrollments`);
}

export async function updateEnrollmentStatus(enrollmentId, status) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/status`, { status });
}

export async function submitTransactionId(enrollmentId, transactionId) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/transaction`, { transactionId });
}

export async function recordReferralLogin(referralCode, user) {
  if (!referralCode || !user?.uid) return null;
  return postData("referral-logins", { referralCode, user: userIdentity(user) });
}

export async function allowCertificate(enrollmentId, allowed) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/certificate`, { allowed });
}

export async function verifyInternship(enrollmentId) {
  return updateEnrollmentStatus(enrollmentId, "Completed");
}

export async function submitProject(enrollmentId, projectIndex, submissionText, submissionUrl = "") {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/projects/${projectIndex}/submit`, {
    submissionText,
    submissionUrl,
  });
}

export async function submitQuizAnswer(enrollmentId, projectIndex, answers, project) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/projects/${projectIndex}/quiz`, {
    answers,
    project,
  });
}

export async function verifyProject(enrollmentId, projectIndex) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/projects/${projectIndex}/verify`);
}

export async function saveProjectFeedback(enrollmentId, projectIndex, feedback) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/projects/${projectIndex}/feedback`, { feedback });
}

export async function rejectProject(enrollmentId, projectIndex, feedback) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/projects/${projectIndex}/reject`, { feedback });
}

export async function fetchEnrollmentById(enrollmentId) {
  return getData(`enrollments/${encodeURIComponent(enrollmentId)}`);
}

export async function fetchAdminData() {
  return getData("admin-data");
}

export async function isReferralCodeMatched(referralCode) {
  if (!referralCode) return false;
  const data = await getData(`referrals/${encodeURIComponent(referralCode.toUpperCase())}/matched`);
  return Boolean(data?.matched);
}

export async function deleteReferral(code) {
  return deleteData(`referrals/${encodeURIComponent(code)}`);
}

export async function deleteEnrollment(enrollmentId) {
  return deleteData(`enrollments/${encodeURIComponent(enrollmentId)}`);
}

export async function createReferral(details) {
  return postData("referrals", { details });
}

export async function trackReferralVisit(referralCode) {
  if (!referralCode) return null;
  return postData("referral-visits", {
    referralCode,
    visitedAt: new Date().toISOString(),
    url: window.location.href,
    referrer: document.referrer,
  });
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
  return postData(`referrals/${encodeURIComponent(referralCode)}/contacted`);
}

export async function checkAdminStatus(email) {
  return postData("check-admin", { email });
}

export async function fetchAdmins() {
  return getData("admins");
}

export async function addAdmin(email) {
  return postData("admins", { email });
}

export async function removeAdmin(email) {
  return deleteData(`admins/${encodeURIComponent(email)}`);
}

export async function createSelfReferral(details, uid) {
  return postData("self-referrals", { details, uid });
}

export async function fetchSelfReferralCode(uid) {
  const data = await getData(`users/${encodeURIComponent(uid)}/self-referral`);
  return data?.code || null;
}

export async function fetchReferralDashboardData(uid) {
  return getData(`users/${encodeURIComponent(uid)}/referral-dashboard`);
}

export async function fetchUserReferralStat(email) {
  return getData(`users/by-email/${encodeURIComponent(email)}/referral-stat`);
}

export async function fetchAdminReferralUsersWithInterns() {
  return getData("admin-referral-users");
}

export async function savePermanentReferralCode(uid, code) {
  if (!uid || !code) return null;
  return postData(`users/${encodeURIComponent(uid)}/permanent-referral`, { code });
}

export async function fetchPermanentReferralCode(uid) {
  const data = await getData(`users/${encodeURIComponent(uid)}/permanent-referral`);
  return data?.code || null;
}

export async function verifyTaskWithAI(params) {
  const data = await apiFetch("/api/ai/verify-task", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return { success: true, data: data.data };
}

export async function fetchEarnSettings() {
  return getData("earn-settings");
}

export async function saveEarnSettings(settings) {
  return postData("earn-settings", { settings });
}

export async function fetchEarnDetails() {
  return getData("earn-details");
}

export async function saveEarnDetails(details) {
  return postData("earn-details", { details });
}

export async function fetchBannedUsers() {
  return getData("banned-users");
}

export async function checkUserBan(email) {
  return getData(`banned-users/${encodeURIComponent(email)}`);
}

export async function banUser(email, banType, reason, bannedBy) {
  return postData("banned-users", { email, banType, reason, bannedBy });
}

export async function unbanUser(email) {
  return deleteData(`banned-users/${encodeURIComponent(email)}`);
}

export async function fetchAdminMessages(userEmail, { context, uid } = {}) {
  const qs = new URLSearchParams({ email: userEmail || "", context: context || "", uid: uid || "" });
  return getData(`admin-messages?${qs.toString()}`);
}

export async function fetchAllAdminMessages() {
  return getData("admin-messages/all");
}

export async function saveAdminMessage(message) {
  return postData("admin-messages", { message });
}

export async function acknowledgeAdminMessage(messageId, uid, userInfo = {}) {
  return postData(`admin-messages/${encodeURIComponent(messageId)}/ack`, { uid, userInfo });
}

export async function deleteAdminMessage(id) {
  return deleteData(`admin-messages/${encodeURIComponent(id)}`);
}

export async function saveSiteNotice(notice) {
  return postData("site-notices", { notice });
}

export async function fetchSiteNotices() {
  return getData("site-notices");
}

export async function toggleSiteNotice(id, active) {
  return postData(`site-notices/${encodeURIComponent(id)}/toggle`, { active });
}

export async function deleteSiteNotice(id) {
  return deleteData(`site-notices/${encodeURIComponent(id)}`);
}

export async function fetchHomepageContent() {
  return getData("homepage");
}

export async function saveHomepageContent(content) {
  return postData("homepage", { content });
}

export async function markReferralAchieved(referralCode, achieved) {
  return postData(`referrals/${encodeURIComponent(referralCode)}/achieved`, { achieved });
}

export async function markEnrollmentComplete(enrollmentId) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/complete`);
}

export async function rejectEnrollmentCompletion(enrollmentId, reason) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/completion-reject`, { reason });
}

export async function clearCompletionRejection(enrollmentId) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/completion-reject/clear`);
}

export async function autoUnachieveIfActivity(referralCode) {
  const data = await postData(`referrals/${encodeURIComponent(referralCode)}/auto-unachieve`);
  return Boolean(data?.unachieved);
}

export async function trackSiteVisit(user) {
  return postData("site-visits", {
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

// Stripe payment functions
export async function createPaymentIntent(enrollmentId, amount, paymentStage = "full") {
  const data = await apiFetch("/api/create-payment-intent", {
    method: "POST",
    body: JSON.stringify({ enrollmentId, amount, paymentStage }),
  });
  return data.data;
}

export async function fetchStripeConfig() {
  return getData("stripe-config");
}

export async function fetchPaymentSettings() {
  return getData("payment-settings");
}

export async function savePaymentSettings(settings) {
  return postData("payment-settings", settings);
}

export async function overrideCompleteEnrollment(enrollmentId, adminEmail) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/override-complete`, { adminEmail });
}

export async function unverifyProject(enrollmentId, projectIndex) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/projects/${projectIndex}/unverify`);
}

export async function unverifyPayment(enrollmentId, reason) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/unverify-payment`, { reason });
}

export async function updatePaymentStatus(enrollmentId, paymentStatus, paymentStage) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/payment-status`, { paymentStatus, paymentStage });
}

export async function setPaymentAmount(enrollmentId, paymentAmount) {
  return postData(`enrollments/${encodeURIComponent(enrollmentId)}/payment-amount`, { paymentAmount });
}

export async function aiGradeQuiz(questions, answers) {
  const data = await apiFetch("/api/ai/grade-quiz", {
    method: "POST",
    body: JSON.stringify({ questions, answers }),
  });
  return data.data;
}

export async function fetchPaymentStats() {
  return getData("payment-stats");
}

export async function fetchUserTypes() {
  return getData("user-types");
}

export async function saveUserTypes(types) {
  return postData("user-types", types);
}

export async function fetchPayoutConfig() {
  return getData("payout-config");
}

export async function savePayoutConfig(config) {
  return postData("payout-config", config);
}

export async function markReferralPayout(code, payoutAmount, payoutNote) {
  return postData(`referrals/${encodeURIComponent(code)}/mark-payout`, { payoutAmount, payoutNote });
}

export async function clearReferralPayout(code) {
  return postData(`referrals/${encodeURIComponent(code)}/clear-payout`);
}
