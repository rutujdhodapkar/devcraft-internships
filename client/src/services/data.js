/**
 * data.js — All operations via server API (/api/fb/*).
 * Falls back to default data when server is unavailable.
 */

// ─── Helpers ───────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_SERVER_URL || "";

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  if (!text || !text.trim()) {
    throw new Error("Server returned an empty response. Make sure the server is running.");
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Server returned invalid JSON: " + text.slice(0, 150));
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}

async function fbGet(path) {
  const res = await apiFetch(`/api/fb${path}`);
  return res.data;
}

async function fbPost(path, body) {
  const res = await apiFetch(`/api/fb${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

async function fbPut(path, body) {
  const res = await apiFetch(`/api/fb${path}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return res.data;
}

async function fbPatch(path, body) {
  const res = await apiFetch(`/api/fb${path}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.data;
}

async function fbDelete(path) {
  const res = await apiFetch(`/api/fb${path}`, { method: "DELETE" });
  return res.data;
}

async function safeGet(path, fallback) {
  try { return await fbGet(path); } catch { return fallback; }
}

async function safePost(path, body, fallback) {
  try { return await fbPost(path, body); } catch { return fallback; }
}

// ─── Default Data ──────────────────────────────────────────────────────────────
const DEFAULT_CAREER_PATHS = [
  {
    id: "path_python", title: "Python Development", duration: "4 Weeks",
    description: "Gain hands-on software development experience with Python scripting, data structures, and backends.",
    features: ["Basic Python syntax & scripting", "OOP & Data structures", "Flask & Django web development", "Final capstone project"],
    projects: [
      { title: "Personal Portfolio Website", description: "Build a personal portfolio website using Python Flask to showcase your projects and skills.", type: "text", links: [], quizQuestions: [], passingGrade: 100 },
      { title: "Weather Web App", description: "Create a weather web application that fetches real-time weather data from a public API.", type: "text", links: [], quizQuestions: [], passingGrade: 100 },
      { title: "Python Basics Quiz", description: "Test your understanding of Python fundamentals.", type: "quiz", links: [], passingGrade: 60, quizQuestions: [
        { question: "What keyword is used to define a function in Python?", type: "option", options: ["func", "def", "function", "define"], answer: "def" },
        { question: "Which data type is immutable in Python?", type: "option", options: ["list", "dict", "tuple", "set"], answer: "tuple" },
        { question: "What is the output of print(2 ** 3)?", type: "number", options: [], answer: "8" },
      ]},
    ],
    paymentQr: "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png",
  },
  {
    id: "path_java", title: "Java Development", duration: "4 Weeks",
    description: "Build enterprise-ready applications using Java Core, Spring Boot microservices, and databases.",
    features: ["Java Core & JVM concepts", "OOP & Interface Design", "Spring Boot microservices", "Database integration & SQL"],
    projects: [
      { title: "Library Management System", description: "Design a console-based library management system using Java OOP principles.", type: "text", links: [], quizQuestions: [], passingGrade: 100 },
      { title: "REST API Backend", description: "Build a RESTful API backend using Spring Boot with CRUD operations.", type: "text", links: [], quizQuestions: [], passingGrade: 100 },
      { title: "Java Fundamentals Quiz", description: "Test your knowledge of Java core concepts.", type: "quiz", links: [], passingGrade: 60, quizQuestions: [
        { question: "Which keyword is used to inherit a class in Java?", type: "option", options: ["implements", "extends", "inherits", "super"], answer: "extends" },
        { question: "What is the default value of a boolean variable in Java?", type: "option", options: ["true", "false", "0", "null"], answer: "false" },
        { question: "How many bits does a 'short' data type occupy in Java?", type: "number", options: [], answer: "16" },
      ]},
    ],
    paymentQr: "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png",
  },
  {
    id: "path_web", title: "Web Development", duration: "4 Weeks",
    description: "Learn to design and deploy modern, responsive frontend user interfaces using React.js and CSS.",
    features: ["HTML5 & CSS3 layout systems", "JavaScript ES6+ fundamentals", "React.js frontend frameworks", "State management & deployment"],
    projects: [
      { title: "Responsive Portfolio", description: "Build a responsive personal portfolio website using HTML, CSS, and JavaScript.", type: "text", links: [], quizQuestions: [], passingGrade: 100 },
      { title: "Admin Dashboard UI", description: "Create an admin dashboard interface with charts and data tables using React.", type: "text", links: [], quizQuestions: [], passingGrade: 100 },
      { title: "Web Development Quiz", description: "Test your understanding of web technologies.", type: "quiz", links: [], passingGrade: 60, quizQuestions: [
        { question: "Which HTML tag is used to link an external CSS file?", type: "option", options: ["<style>", "<script>", "<link>", "<meta>"], answer: "<link>" },
        { question: "What does CSS selector '.class' target?", type: "option", options: ["ID", "Class", "Element", "Attribute"], answer: "Class" },
        { question: "Which JavaScript method adds an element to the end of an array?", type: "option", options: ["push()", "pop()", "shift()", "unshift()"], answer: "push()" },
      ]},
    ],
    paymentQr: "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png",
  },
];

const DEFAULT_HOW_IT_WORKS = [
  { id: "step_1", step: 1, title: "Select Domain", description: "Browse our available career paths and select your preferred domain." },
  { id: "step_2", step: 2, title: "Instant Offer Letter", description: "Log in with Google, fill in your profile, and receive your official offer letter instantly." },
  { id: "step_3", step: 3, title: "Complete Projects", description: "Work through structured real-world tasks and submit them." },
  { id: "step_4", step: 4, title: "Get Certified", description: "Once verified, download your industry-ready internship completion certificate." },
];

const DEFAULT_FAQS = [
  { id: "faq_1", question: "Are the internships really 100% free?", answer: "Yes, all our virtual internships are 100% free of cost. There are no hidden fees or charges for learning and certification." },
  { id: "faq_2", question: "Who is eligible to apply?", answer: "Any college student or self-taught learner looking to gain practical software development and coding experience is welcome to apply." },
  { id: "faq_3", question: "How will my internship progress be tracked?", answer: "You will work on self-paced projects. Once you complete the projects, you submit them through the student area, and the team will verify your completion." },
  { id: "faq_4", question: "Is the certificate verified?", answer: "Yes, every certificate has a unique ID and can be verified publicly on our website through the verify button." },
];

const DEFAULT_OFFER_LETTER_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; margin: 45px; line-height: 1.6; }
  .logo { font-size: 28px; font-weight: bold; letter-spacing: 2px; color: #000; margin-bottom: 20px; }
  .title { font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 40px; text-transform: uppercase; }
  .content { font-size: 14px; margin-bottom: 30px; }
  .date { margin-bottom: 20px; }
  .signature-section { margin-top: 60px; }
  .signature { border-top: 1px solid #111; width: 200px; padding-top: 5px; font-size: 12px; }
  .footer { margin-top: 80px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 10px; }
</style>
</head>
<body>
  <div class="logo">DevCraft</div>
  <div class="date">Date: {{date}}</div>
  <div class="title">Letter of Internship Offer</div>
  <div class="content">
    <p>Dear <strong>{{name}}</strong>,</p>
    <p>We are pleased to offer you a virtual internship in the domain of <strong>{{domain}}</strong> at DevCraft. Your internship is scheduled to begin on <strong>{{date}}</strong> for a duration of <strong>4 Weeks</strong>.</p>
    <p>During this program, you will gain hands-on experience in software development by working on real-world projects and solving technical challenges. You will be expected to complete all assigned projects and submit them for review before the program's completion date.</p>
    <p>Upon successful completion and evaluation of your projects, you will be awarded an official Internship Completion Certificate from DevCraft.</p>
    <p>We look forward to working with you. If you accept this offer, please proceed with your virtual onboarding.</p>
    <p>Best regards,</p>
  </div>
  <div class="signature-section">
    <div class="signature">
      <strong>DevCraft Team</strong><br>
      Program Coordinator
    </div>
  </div>
  <div class="footer">
    DevCraft © 2026. This is an automatically generated document. Verification ID: {{id}} | Intern ID: {{internId}}
  </div>
</body>
</html>`;

const DEFAULT_CERTIFICATE_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Georgia', serif; color: #1a1a1a; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background-color: #fcfcfc; }
  .cert-container { border: 15px double #bda068; padding: 40px; width: 750px; background-color: #fff; text-align: center; margin: 30px; }
  .header { font-size: 26px; font-weight: bold; letter-spacing: 3px; color: #bda068; margin-bottom: 20px; font-family: 'Helvetica Neue', Arial, sans-serif; }
  .subtitle { font-size: 14px; font-style: italic; color: #666; margin-bottom: 30px; }
  .presented-to { font-size: 13px; text-transform: uppercase; color: #888; margin-bottom: 10px; letter-spacing: 2px; }
  .student-name { font-size: 32px; font-weight: bold; color: #111; margin-bottom: 25px; border-bottom: 2px solid #eee; display: inline-block; padding-bottom: 5px; }
  .cert-text { font-size: 15px; line-height: 1.8; color: #444; margin: 20px 50px; }
  .domain-highlight { font-weight: bold; color: #bda068; }
  .meta-row { display: flex; justify-content: space-between; margin-top: 50px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; }
  .meta-col { text-align: center; width: 150px; }
  .sig-line { border-top: 1px solid #aaa; margin-bottom: 5px; padding-top: 5px; font-weight: bold; }
  .footer { margin-top: 40px; font-size: 11px; color: #999; font-family: 'Helvetica Neue', Arial, sans-serif; }
</style>
</head>
<body>
  <div class="cert-container">
    <div class="header">CERTIFICATE OF COMPLETION</div>
    <div class="subtitle">DEVCRAFT VIRTUAL INTERNSHIP PROGRAM</div>
    <div class="presented-to">This is proudly presented to</div>
    <div class="student-name">{{name}}</div>
    <div class="cert-text">
      for successfully completing the 4-week virtual internship in <span class="domain-highlight">{{domain}}</span>.
      During this tenure, the candidate demonstrated outstanding commitment, built industry-grade projects, and met all program criteria.
    </div>
    <div class="meta-row">
      <div class="meta-col"><div class="sig-line">Date of Issue</div><div>{{date}}</div></div>
      <div class="meta-col"><div style="height: 30px; line-height: 30px; font-size: 16px; font-family: 'Georgia', serif; font-style: italic; color: #bda068;">DevCraft</div><div class="sig-line">Authorized Signatory</div></div>
      <div class="meta-col"><div class="sig-line">Intern ID</div><div>{{internId}}</div></div>
    </div>
    <div class="footer">
      DevCraft © 2026. Credential ID: {{id}} | Verify at devcraft.internship
    </div>
  </div>
</body>
</html>`;

export { DEFAULT_CAREER_PATHS, DEFAULT_HOW_IT_WORKS, DEFAULT_FAQS };

// ─── Career Paths ──────────────────────────────────────────────────────────────
export async function fetchCareerPaths() {
  try { return await fbGet("/career-paths"); } catch { return DEFAULT_CAREER_PATHS; }
}

export async function saveCareerPaths(paths) {
  await fbPut("/career-paths", paths);
}

// ─── How It Works ──────────────────────────────────────────────────────────────
export async function fetchHowItWorks() {
  try {
    const data = await fbGet("/how-it-works");
    return data.sort((a, b) => (a.step || 0) - (b.step || 0));
  } catch { return DEFAULT_HOW_IT_WORKS; }
}

export async function saveHowItWorks(steps) {
  await fbPut("/how-it-works", steps);
}

// ─── FAQs ──────────────────────────────────────────────────────────────────────
export async function fetchFAQs() {
  try { return await fbGet("/faqs"); } catch { return DEFAULT_FAQS; }
}

export async function saveFAQs(faqs) {
  await fbPut("/faqs", faqs);
}

// ─── Templates ─────────────────────────────────────────────────────────────────
export async function fetchTemplates() {
  try {
    const data = await fbGet("/templates");
    return {
      offer_letter: data.offer_letter || DEFAULT_OFFER_LETTER_TEMPLATE,
      certificate: data.certificate || DEFAULT_CERTIFICATE_TEMPLATE,
    };
  } catch {
    return { offer_letter: DEFAULT_OFFER_LETTER_TEMPLATE, certificate: DEFAULT_CERTIFICATE_TEMPLATE };
  }
}

export async function saveTemplates(templates) {
  await fbPut("/templates", templates);
}

// ─── About Text ────────────────────────────────────────────────────────────────
export async function fetchAboutText() {
  try { return await fbGet("/about") || "DevCraft provides top-tier 100% free virtual internships..."; } catch { return "DevCraft provides top-tier 100% free virtual internships..."; }
}

export async function saveAboutText(text) {
  await fbPut("/about", { text });
}

// ─── User Profile ──────────────────────────────────────────────────────────────
export async function fetchUserProfile(uid) {
  try { return await fbGet(`/users/${uid}/profile`); } catch { return null; }
}

export async function saveUserProfile(uid, profile) {
  await fbPut(`/users/${uid}/profile`, profile);
}

// ─── Enrollments ───────────────────────────────────────────────────────────────
export async function enrollStudent(uid, profile, domainObj) {
  let refCode = localStorage.getItem("detected_referral_code") || "";
  if (refCode) localStorage.removeItem("detected_referral_code");
  if (!refCode) {
    try {
      const permanentCode = await fetchPermanentReferralCode(uid);
      if (permanentCode) refCode = permanentCode;
    } catch {}
  }
  try {
    return await fbPost("/enrollments", { uid, profile, domainObj, referralCode: refCode });
  } catch (err) {
    throw new Error("Enrollment failed: " + err.message);
  }
}

export async function fetchEnrollments() {
  try { return await fbGet("/enrollments"); } catch { return []; }
}

export async function fetchUserEnrollments(uid) {
  try {
    const all = await fbGet("/enrollments");
    return (all || []).filter((e) => e.uid === uid);
  } catch { return []; }
}

export async function fetchEnrollmentById(enrollmentId) {
  try { return await fbGet(`/enrollments/${enrollmentId}`); } catch { return null; }
}

export async function updateEnrollmentStatus(enrollmentId, status) {
  await fbPatch(`/enrollments/${enrollmentId}`, { status });
}

export async function deleteEnrollment(enrollmentId) {
  await fbDelete(`/enrollments/${enrollmentId}`);
}

export async function submitTransactionId(enrollmentId, transactionId) {
  await fbPatch(`/enrollments/${enrollmentId}`, { transactionId });
}

export async function allowCertificate(enrollmentId, allowed) {
  await fbPost(`/enrollments/${enrollmentId}/allow-certificate`, { allowed });
}

export async function markEnrollmentComplete(enrollmentId) {
  await fbPost(`/enrollments/${enrollmentId}/complete`, {});
}

export async function rejectEnrollmentCompletion(enrollmentId, reason) {
  await fbPatch(`/enrollments/${enrollmentId}`, { completionRejectedAt: new Date().toISOString(), completionRejectReason: reason || "" });
}

export async function clearCompletionRejection(enrollmentId) {
  await fbPatch(`/enrollments/${enrollmentId}`, { completionRejectedAt: null, completionRejectReason: null });
}

export async function verifyInternship(internId) {
  try { return await fbGet(`/verify/${internId}`); } catch { return null; }
}

// ─── Project Submission ────────────────────────────────────────────────────────
export async function submitProject(enrollmentId, projectIndex, submissionText) {
  await fbPost(`/enrollments/${enrollmentId}/submissions/${projectIndex}`, { text: submissionText });
}

export async function submitQuizAnswer(enrollmentId, projectIndex, answers, project) {
  const questions = project.quizQuestions || [];
  let correctCount = 0;
  const results = {};
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const userAns = String((answers && answers[qi]) || "").trim().toLowerCase();
    results[qi] = false;
    if (q.type !== "text") {
      const correctAns = String(q.answer || "").trim().toLowerCase();
      results[qi] = q.type === "number" ? parseFloat(userAns) === parseFloat(correctAns) : userAns === correctAns;
    } else {
      results[qi] = null;
    }
    if (results[qi]) correctCount++;
  }
  const autoGradedCount = questions.filter((q, qi) => results[qi] !== null).length;
  const score = autoGradedCount > 0 ? Math.round((correctCount / autoGradedCount) * 100) : 0;
  const passingGrade = Number(project.passingGrade) || 100;
  const passed = autoGradedCount > 0 && score >= passingGrade;

  await fbPost(`/enrollments/${enrollmentId}/submissions/${projectIndex}`, {
    text: JSON.stringify(answers),
    quizAnswers: answers,
    quizResults: results,
    quizScore: score,
    quizPassed: passed,
  });
  return { results, score, passed };
}

export async function verifyProject(enrollmentId, projectIndex) {
  await fbPost(`/enrollments/${enrollmentId}/submissions/${projectIndex}/verify`, {});
}

export async function rejectProject(enrollmentId, projectIndex, feedback) {
  await fbPost(`/enrollments/${enrollmentId}/submissions/${projectIndex}/reject`, { feedback });
}

export async function saveProjectFeedback(enrollmentId, projectIndex, feedback) {
  await fbPost(`/enrollments/${enrollmentId}/submissions/${projectIndex}/feedback`, { feedback });
}

// ─── Referral Code Check ───────────────────────────────────────────────────────
export async function isReferralCodeMatched(referralCode) {
  const code = String(referralCode || "").trim().toUpperCase();
  if (!code) return false;
  try {
    const data = await fbGet(`/referrals/${code}`);
    return !!data;
  } catch { return false; }
}

// ─── Referral Creation ─────────────────────────────────────────────────────────
export async function createReferral(details) {
  return await fbPost("/referrals", details);
}

export async function deleteReferral(code) {
  await fbDelete(`/referrals/${code}`);
}

export async function createSelfReferral(details, uid) {
  if (!uid) throw new Error("You must be logged in to create a referral code.");
  return await fbPost("/referrals/self", { uid, details });
}

export async function fetchSelfReferralCode(uid) {
  if (!uid) return null;
  try {
    const data = await fbGet(`/referrals/self/${uid}`);
    return data?.code || null;
  } catch { return null; }
}

export async function fetchReferralDashboardData(uid) {
  if (!uid) return null;
  try { return await fbGet(`/referrals/dashboard/${uid}`); } catch { return null; }
}

export async function fetchUserReferralStat(email) {
  if (!email) return null;
  try { return await fbGet(`/referrals/stat/${encodeURIComponent(email)}`); } catch { return null; }
}

export async function markReferralContacted(referralCode) {
  // tracked via enrollment creation now
}

export async function markReferralAchieved(referralCode, achieved) {
  await fbPost(`/referrals/${referralCode}/achieved`, { achieved });
}

export async function autoUnachieveIfActivity(referralCode) {
  if (!referralCode) return false;
  try {
    const data = await fbGet(`/referrals/${referralCode.toUpperCase()}`);
    if (!data || !data.achieved || !data.achievedAt) return false;
    const achievedAt = new Date(data.achievedAt).getTime();
    const updatedAt = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    if (updatedAt > achievedAt) {
      await markReferralAchieved(referralCode, false);
      return true;
    }
  } catch {}
  return false;
}

// ─── Permanent Referral Code ──────────────────────────────────────────────────
export async function savePermanentReferralCode(uid, code) {
  await safePost(`/users/${uid}/permanent-referral`, { code }, null);
}

export async function fetchPermanentReferralCode(uid) {
  if (!uid) return null;
  try { return await fbGet(`/users/${uid}/permanent-referral`); } catch { return null; }
}

// ─── Payment QR Constants ─────────────────────────────────────────────────────
export const PAYMENT_QR_DEFAULT = "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png";
export const PAYMENT_QR_REFERRAL = "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR(1).png";

// ─── Referral Visit Tracking ──────────────────────────────────────────────────
export async function trackReferralVisit(referralCode) {
  if (!referralCode) return null;
  const normalizedCode = referralCode.toUpperCase();
  const ua = navigator.userAgent;
  let os = "Unknown OS";
  if (ua.indexOf("Windows") !== -1) os = "Windows";
  else if (ua.indexOf("Macintosh") !== -1) os = "MacOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";
  else if (ua.indexOf("Android") !== -1) os = "Android";
  else if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS";

  function parseBrowserName(u) {
    if (/Edg\//i.test(u)) return "Edge";
    if (/OPR\//i.test(u) || /Opera/i.test(u)) return "Opera";
    if (/Chrome\//i.test(u) && !/Edg\//i.test(u)) return "Chrome";
    if (/Firefox\//i.test(u)) return "Firefox";
    if (/Safari\//i.test(u) && !/Chrome\//i.test(u)) return "Safari";
    return "Other";
  }

  const visitBase = {
    referralCode: normalizedCode,
    browser: parseBrowserName(ua),
    os,
    device: (/Mobi|Android/i.test(ua) || window.innerWidth < 768) ? "Mobile" : (window.innerWidth < 1100 ? "Tablet" : "Desktop"),
    language: navigator.language,
    link: window.location.href,
    visitedFrom: document.referrer || "Direct",
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    visitedAt: new Date().toISOString(),
  };

  try {
    const data = await fbPost("/referral-visits", visitBase);
    return data;
  } catch { return null; }
}

export async function recordReferralLogin(referralCode, user) {
  if (!referralCode || !user?.uid) return;
  await safePost("/referral-login", { referralCode, user }, null);
}

export async function processReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("ref") || "").trim().toUpperCase();
  if (!code) {
    localStorage.removeItem("detected_referral_code");
    return { code: "", matched: false };
  }
  try { await trackReferralVisit(code); } catch {}
  const matched = await isReferralCodeMatched(code);
  if (matched) localStorage.setItem("detected_referral_code", code);
  else localStorage.removeItem("detected_referral_code");
  return { code, matched };
}

// ─── Admin ─────────────────────────────────────────────────────────────────────
export async function fetchAdminData() {
  try {
    return await fbGet("/admin-data");
  } catch {
    const data = await apiFetch("/api/admin-data");
    return {
      enrollments: data.data.requests || [],
      referrals: data.data.referrals || [],
      visits: data.data.visits || [],
      siteVisits: data.data.siteVisits || [],
    };
  }
}

export async function checkAdminStatus(email) {
  if (!email) return { isAdmin: false };
  if (email.toLowerCase().trim() === "rutujdhodapkar@gmail.com") return { isAdmin: true };
  try {
    return await apiFetch("/api/check-admin", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  } catch { return { isAdmin: false }; }
}

export async function fetchAdmins() {
  try { return await apiFetch("/api/admins"); } catch { return []; }
}

export async function addAdmin(email) {
  await apiFetch("/api/admins", { method: "POST", body: JSON.stringify({ email: email.toLowerCase().trim() }) });
}

export async function removeAdmin(email) {
  await apiFetch(`/api/admins/${encodeURIComponent(email.toLowerCase().trim())}`, { method: "DELETE" });
}

export async function fetchAdminReferralUsersWithInterns() {
  try {
    const data = await fbGet("/admin-data");
    const enrollments = data.enrollments || [];
    const referrals = data.referrals || [];
    return referrals.map((r) => {
      const relatedEnrollments = enrollments.filter((e) => String(e.referralCode || "").toUpperCase() === String(r.code || "").toUpperCase());
      return {
        code: r.code, name: r.name || "", email: r.email || "", phone: r.phone || "",
        city: r.city || "", upiId: r.upiId || "",
        lastActivityAt: r.lastActivityAt || r.updatedAt || r.createdAt,
        createdAt: r.createdAt, internCount: relatedEnrollments.length,
        internIds: relatedEnrollments.map((e) => e.internId || e.id),
        interns: relatedEnrollments.map((e) => ({ id: e.id, internId: e.internId || e.id, name: e.name || "", email: e.email || "", status: e.status || "Active", appliedAt: e.createdAt, completedAt: e.completedAt, paymentDate: e.paymentDate })),
      };
    });
  } catch { return []; }
}

// ─── Banned Users ──────────────────────────────────────────────────────────────
export async function fetchBannedUsers() {
  try { return await fbGet("/banned-users"); } catch { return []; }
}

export async function checkUserBan(email) {
  if (!email) return null;
  try {
    const all = await fbGet("/banned-users");
    const match = (all || []).find((b) => b.email?.toLowerCase() === email.toLowerCase());
    return match || null;
  } catch { return null; }
}

export async function banUser(email, banType, reason, bannedBy) {
  await fbPost("/banned-users", { email, banType, reason, bannedBy });
}

export async function unbanUser(email) {
  await fbDelete(`/banned-users/${encodeURIComponent(email)}`);
}

// ─── Admin Messages ────────────────────────────────────────────────────────────
export async function fetchAdminMessages(userEmail, { context, uid } = {}) {
  try {
    const all = await fbGet("/admin-messages");
    const now = new Date();
    return (all || []).filter((msg) => {
      if (msg.expiresAt && new Date(msg.expiresAt) < now) return false;
      if (msg.target !== "all" && msg.target?.toLowerCase() !== userEmail?.toLowerCase()) return false;
      if (context && msg.context && msg.context !== context) return false;
      if (uid && msg.acknowledgedBy?.[uid]) return false;
      return true;
    });
  } catch { return []; }
}

export async function fetchAllAdminMessages() {
  try { return await fbGet("/admin-messages"); } catch { return []; }
}

export async function saveAdminMessage(message) {
  return await fbPost("/admin-messages", message);
}

export async function deleteAdminMessage(id) {
  await fbDelete(`/admin-messages/${id}`);
}

export async function acknowledgeAdminMessage(messageId, uid, userInfo = {}) {
  if (!messageId || !uid) return;
  await fbPost(`/admin-messages/${messageId}/acknowledge`, { uid, userInfo });
}

// ─── Site Notices ──────────────────────────────────────────────────────────────
export async function saveSiteNotice(notice) {
  return await fbPost("/site-notices", notice);
}

export async function fetchSiteNotices() {
  try { return await fbGet("/site-notices"); } catch { return []; }
}

export async function toggleSiteNotice(id, active) {
  await fbPatch(`/site-notices/${id}`, { active });
}

export async function deleteSiteNotice(id) {
  await fbDelete(`/site-notices/${id}`);
}

// ─── Stripe Payment ────────────────────────────────────────────────────────────
export async function createCheckoutSession({ plan, enrollmentId, userId, email, name }) {
  return await apiFetch("/api/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ plan, enrollmentId, userId, email, name }),
  });
}

export async function verifyPayment(sessionId) {
  return await apiFetch("/api/verify-payment", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function markPaymentComplete(enrollmentId, paymentInfo) {
  await fbPatch(`/enrollments/${enrollmentId}`, {
    stripePaymentId: paymentInfo.sessionId || "",
    stripePaymentStatus: paymentInfo.paymentStatus || "paid",
    paymentAmount: paymentInfo.amount || "",
    paidAt: new Date().toISOString(),
    transactionId: paymentInfo.sessionId || `stripe_${Date.now()}`,
  });
}

// ─── Earn Settings ─────────────────────────────────────────────────────────────
export async function fetchEarnSettings() {
  try { return await fbGet("/earn-settings"); } catch { return { rewardPerCompletion: 20, milestoneCount: 50, milestoneBonus: 1000 }; }
}

export async function saveEarnSettings(settings) {
  await fbPut("/earn-settings", settings);
}

// ─── Earn Details ──────────────────────────────────────────────────────────────
export async function fetchEarnDetails() {
  try { return await fbGet("/earn-details"); } catch {
    return {
      title: "How Refer & Earn Works",
      description: "Share your unique referral link with friends and classmates...",
      items: [
        { title: "Apply Once", description: "Submit your UPI ID to get a unique referral code instantly.", links: "" },
        { title: "Share Your Link", description: "Share anywhere — WhatsApp, LinkedIn, or social media.", links: "" },
        { title: "Track Progress", description: "See who enrolled using your link and track completions in real time.", links: "" },
        { title: "Get Paid", description: "Earn ₹20 per completion + ₹1,000 bonus at 50 completions directly to your UPI.", links: "" },
      ],
    };
  }
}

export async function saveEarnDetails(details) {
  await fbPut("/earn-details", details);
}

// ─── Homepage Content ──────────────────────────────────────────────────────────
export async function fetchHomepageContent() {
  try { return await fbGet("/homepage"); } catch { return null; }
}

export async function saveHomepageContent(content) {
  await fbPut("/homepage", content);
}

// ─── AI Task Verification ─────────────────────────────────────────────────────
export async function verifyTaskWithAI(params) {
  const { fetchCodeFromSubmission } = await import("../utils/aiVerify");
  let codeFiles = [];
  try { codeFiles = await fetchCodeFromSubmission(params.submissionText, params.submissionUrl); } catch {}
  const paramsWithCode = { ...params, codeFiles };

  try {
    const data = await apiFetch("/api/ai/verify-task", {
      method: "POST",
      body: JSON.stringify(paramsWithCode),
    });
    if (data.success && data.data) return { success: true, data: { ...data.data, codeFilesCount: codeFiles.length, source: "server-nvidia" } };
  } catch {}
  const { verifyTaskInBrowser } = await import("../utils/aiVerify");
  return verifyTaskInBrowser(paramsWithCode);
}

// ─── General Site Visit Tracking ─────────────────────────────────────────────
export async function trackSiteVisit(user) {
  const visitData = {
    userAgent: navigator.userAgent || "",
    language: navigator.language || "",
    referrer: document.referrer || "",
    url: window.location.href || "",
    screen: `${window.screen?.width || "?"}x${window.screen?.height || "?"}`,
    viewport: `${window.innerWidth || "?"}x${window.innerHeight || "?"}`,
  };
  if (user?.uid) {
    visitData.uid = user.uid;
    visitData.email = user.email || "";
    visitData.name = user.displayName || "";
  }
  await safePost("/site-visits", visitData, null);
}
