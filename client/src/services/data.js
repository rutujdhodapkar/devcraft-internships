const API_BASE = import.meta.env.VITE_SERVER_URL || "";

let _accessToken = null;
export function setAccessToken(token) { _accessToken = token; }

function getAccessToken() { return _accessToken; }

async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await response.text();
  if (!text || !text.trim()) throw new Error("Server returned an empty response.");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Server returned invalid JSON: " + text.slice(0, 150)); }
  if (!response.ok || data.error) throw new Error(data.error || data.message || "Request failed.");
  return data;
}

function fsGet(collection, doc) {
  return apiFetch('/api/firestore/get', { method: 'POST', body: JSON.stringify({ collection, doc }) });
}
function fsSet(collection, doc, data) {
  return apiFetch('/api/firestore/set', { method: 'POST', body: JSON.stringify({ collection, doc, data }) });
}
function fsUpdate(collection, doc, data) {
  return apiFetch('/api/firestore/update', { method: 'POST', body: JSON.stringify({ collection, doc, data }) });
}
function fsPush(collection, data) {
  return apiFetch('/api/firestore/push', { method: 'POST', body: JSON.stringify({ collection, data }) });
}
function fsDelete(collection, doc) {
  return apiFetch('/api/firestore/delete', { method: 'POST', body: JSON.stringify({ collection, doc }) });
}
function fsQuery(collection, queries) {
  return apiFetch('/api/firestore/query', { method: 'POST', body: JSON.stringify({ collection, queries }) });
}

function snapToArray(result) {
  if (!result || !result.data) return [];
  return Array.isArray(result.data) ? result.data : [];
}

const encodeEmail = (email) => email.toLowerCase().trim().replace(/\./g, ",");
const decodeEmail = (key) => key.replace(/,/g, ".");

function generateInternId(uid = "") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const source = String(uid || "anonymous-user");
  let hashA = 2166136261;
  let hashB = 0x9e3779b9;
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    hashA ^= code;
    hashA = Math.imul(hashA, 16777619);
    hashB ^= code + i;
    hashB = Math.imul(hashB, 1597334677);
  }
  let value = (BigInt(hashA >>> 0) << 32n) | BigInt(hashB >>> 0);
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Number(value % BigInt(chars.length))];
    value /= BigInt(chars.length);
  }
  return `dev-craft-${result}`;
}

// ─── Defaults ──────────────────────────────────────────────────────────
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
      { title: "Java Fundamentals Quiz", type: "quiz", links: [], passingGrade: 60, quizQuestions: [
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
      { title: "Web Development Quiz", type: "quiz", links: [], passingGrade: 60, quizQuestions: [
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

const DEFAULT_OFFER_LETTER_TEMPLATE = `<!DOCTYPE html><html><head><style>body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;margin:45px;line-height:1.6}.logo{font-size:28px;font-weight:bold;letter-spacing:2px;color:#000;margin-bottom:20px}.title{font-size:22px;font-weight:bold;text-align:center;margin-bottom:40px}.date{margin-bottom:20px}.signature-section{margin-top:60px}.signature{border-top:1px solid #111;width:200px;padding-top:5px;font-size:12px}.footer{margin-top:80px;text-align:center;font-size:11px;color:#666;border-top:1px solid #eee;padding-top:10px}</style></head><body><div class="logo">DevCraft</div><div class="date">Date: {{date}}</div><div class="title">Letter of Internship Offer</div><div class="content"><p>Dear <strong>{{name}}</strong>,</p><p>We are pleased to offer you a virtual internship in <strong>{{domain}}</strong> at DevCraft starting <strong>{{date}}</strong> for 4 Weeks.</p><p>Upon successful completion, you will receive an official Internship Completion Certificate.</p><p>Best regards,<br>DevCraft Team</p></div><div class="signature-section"><div class="signature">DevCraft Team<br>Program Coordinator</div></div><div class="footer">DevCraft &copy; 2026. ID: {{id}} | Intern: {{internId}}</div></body></html>`;
const DEFAULT_CERTIFICATE_TEMPLATE = `<!DOCTYPE html><html><head><style>body{font-family:'Georgia',serif;color:#1a1a1a;margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:#fcfcfc}.cert-container{border:15px double #bda068;padding:40px;width:750px;background:#fff;text-align:center;margin:30px}.header{font-size:26px;font-weight:bold;letter-spacing:3px;color:#bda068;margin-bottom:20px;font-family:'Helvetica Neue',Arial,sans-serif}.presented-to{font-size:13px;text-transform:uppercase;color:#888;margin-bottom:10px}.student-name{font-size:32px;font-weight:bold;color:#111;margin-bottom:25px;border-bottom:2px solid #eee;display:inline-block;padding-bottom:5px}.cert-text{font-size:15px;line-height:1.8;color:#444;margin:20px 50px}.domain-highlight{font-weight:bold;color:#bda068}.meta-row{display:flex;justify-content:space-between;margin-top:50px;font-size:12px}.sig-line{border-top:1px solid #aaa;margin-bottom:5px;padding-top:5px;font-weight:bold}.footer{margin-top:40px;font-size:11px;color:#999}</style></head><body><div class="cert-container"><div class="header">CERTIFICATE OF COMPLETION</div><div class="presented-to">Presented to</div><div class="student-name">{{name}}</div><div class="cert-text">for completing the 4-week virtual internship in <span class="domain-highlight">{{domain}}</span>.</div><div class="meta-row"><div class="meta-col"><div class="sig-line">Date</div><div>{{date}}</div></div><div class="meta-col"><div style="font-style:italic;color:#bda068">DevCraft</div><div class="sig-line">Authorized Signatory</div></div><div class="meta-col"><div class="sig-line">Intern ID</div><div>{{internId}}</div></div></div><div class="footer">DevCraft &copy; 2026. ID: {{id}}</div></div></body></html>`;
export { DEFAULT_CAREER_PATHS, DEFAULT_HOW_IT_WORKS, DEFAULT_FAQS };

export async function fetchCareerPaths() {
  try {
    const r = await fsGet("careerPaths");
    if (r.data) {
      const d = Array.isArray(r.data) ? r.data : Object.values(r.data).map(v => ({ ...v }));
      if (d.length > 0) return d;
    }
  } catch {}
  return DEFAULT_CAREER_PATHS;
}

export async function saveCareerPaths(paths) {
  const dataMap = {};
  paths.forEach((p) => {
    const id = p.id || `path_${Math.random().toString(36).slice(2, 8)}`;
    dataMap[id] = { ...p, id };
  });
  for (const [id, val] of Object.entries(dataMap)) {
    await fsSet("careerPaths", id, val);
  }
}

export async function fetchHowItWorks() {
  try {
    const r = await fsGet("howItWorks");
    if (r.data) {
      const d = Array.isArray(r.data) ? r.data : Object.values(r.data);
      if (d.length > 0) return d.sort((a, b) => (a.step || 0) - (b.step || 0));
    }
  } catch {}
  return DEFAULT_HOW_IT_WORKS;
}

export async function saveHowItWorks(steps) {
  for (const step of steps) {
    const id = step.id || `step_${step.step || Math.random().toString(36).slice(2)}`;
    await fsSet("howItWorks", id, { ...step, id, step: Number(step.step) || 1 });
  }
}

export async function fetchFAQs() {
  try {
    const r = await fsGet("faqs");
    if (r.data) {
      const d = Array.isArray(r.data) ? r.data : Object.values(r.data);
      if (d.length > 0) return d;
    }
  } catch {}
  return DEFAULT_FAQS;
}

export async function saveFAQs(faqs) {
  for (const f of faqs) {
    const id = f.id || `faq_${Math.random().toString(36).slice(2)}`;
    await fsSet("faqs", id, { ...f, id });
  }
}

export async function fetchTemplates() {
  try {
    const r = await fsGet("siteTemplates");
    if (r.data && r.data.offer_letter) {
      return { offer_letter: r.data.offer_letter, certificate: r.data.certificate };
    }
  } catch {}
  try {
    const r = await fsGet("siteTemplates", "default");
    if (r.data) { return r.data; }
  } catch {}
  return { offer_letter: DEFAULT_OFFER_LETTER_TEMPLATE, certificate: DEFAULT_CERTIFICATE_TEMPLATE };
}

export async function saveTemplates(templates) {
  await fsSet("siteTemplates", "default", templates);
}

export async function fetchAboutText() {
  try {
    const r = await fsGet("siteContent", "about");
    if (r.data?.text) return r.data.text;
  } catch {}
  return "DevCraft provides top-tier 100% free virtual internships for university and college students. Gain verified work experience, finish structured programming projects, and receive certified validation for your software engineering credentials.";
}

export async function saveAboutText(text) {
  await fsSet("siteContent", "about", { text, updatedAt: new Date().toISOString() });
}

export async function fetchUserProfile(uid) {
  if (!uid) return null;
  try {
    const r = await fsGet("users", uid);
    return r.data || null;
  } catch { return null; }
}

export async function saveUserProfile(uid, profile) {
  await fsUpdate("users", uid, { ...profile, updatedAt: new Date().toISOString() });
}

export async function enrollStudent(uid, profile, domainObj) {
  const existing = await fetchUserEnrollments(uid);
  const duplicate = existing.find(e => e.domainId === domainObj.id || (e.domain || "").toLowerCase() === (domainObj.title || "").toLowerCase());
  if (duplicate) return duplicate;

  // Check referral code from localStorage or permanent profile
  let refCode = localStorage.getItem("detected_referral_code") || "";
  if (refCode) localStorage.removeItem("detected_referral_code");
  if (!refCode) {
    const permanentCode = await fetchPermanentReferralCode(uid);
    if (permanentCode) refCode = permanentCode;
  }

  const internId = generateInternId(uid);
  const enrollment = {
    internId, uid,
    name: profile.name || profile.displayName || "",
    email: profile.email || "",
    phone: profile.phone || "",
    college: profile.college || "",
    city: profile.city || "",
    country: profile.country || "",
    domainId: domainObj.id,
    domain: domainObj.title,
    duration: domainObj.duration || "4 Weeks",
    projects: domainObj.projects || [],
    status: "Active",
    submissions: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    referralCode: refCode,
  };

  const r = await fsPush("enrollments", enrollment);
  const saved = r.data;

  if (refCode) {
    try {
      const refR = await fsGet("referrals", refCode.toUpperCase());
      if (refR.data) {
        await fsUpdate("referrals", refCode.toUpperCase(), {
          selected: (refR.data.selected || 0) + 1,
          lastSelectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {}
  }

  return { ...saved, id: saved.id };
}

export async function fetchEnrollments() {
  try {
    const r = await fsGet("enrollments");
    return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : [];
  } catch { return []; }
}

export async function fetchUserEnrollments(uid) {
  if (!uid) return [];
  try {
    const all = await fetchEnrollments();
    const userEnrollments = all.filter(e => e.uid === uid);
    const stableInternId = generateInternId(uid);
    for (const e of userEnrollments) {
      if (e.internId !== stableInternId) {
        try { await fsUpdate("enrollments", e.id, { internId: stableInternId, updatedAt: new Date().toISOString() }); } catch {}
      }
    }
    return userEnrollments.map(e => ({ ...e, internId: stableInternId }));
  } catch { return []; }
}

export async function updateEnrollmentStatus(enrollmentId, status) {
  await fsUpdate("enrollments", enrollmentId, { status, updatedAt: new Date().toISOString() });
}

export async function submitTransactionId(enrollmentId, transactionId) {
  await fsUpdate("enrollments", enrollmentId, { transactionId, updatedAt: new Date().toISOString() });
}

export async function recordReferralLogin(referralCode, user) {
  if (!referralCode || !user?.uid) return;
  const code = String(referralCode).toUpperCase();
  try {
    const refR = await fsGet("referrals", code);
    if (!refR.data) return;
    const loginRef = `referralUsers/${code}/${user.uid}`;
    const loginR = await fsGet("referralUsers", `${code}/${user.uid}`).catch(() => ({ data: null }));
    const payload = { uid: user.uid, name: user.displayName || "", email: user.email || "", photoURL: user.photoURL || "", referralCode: code, lastLoginAt: new Date().toISOString() };
    if (loginR?.data) {
      await fsUpdate("referralUsers", `${code}/${user.uid}`, { ...loginR.data, ...payload });
    } else {
      await fsSet("referralUsers", `${code}/${user.uid}`, { ...payload, firstLoginAt: new Date().toISOString() });
      await fsUpdate("referrals", code, { loggedIn: (refR.data.loggedIn || 0) + 1, lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
  } catch {}
}

export async function allowCertificate(enrollmentId, allowed) {
  await fsUpdate("enrollments", enrollmentId, { allowedCertificate: allowed, updatedAt: new Date().toISOString() });
}

export async function verifyInternship(enrollmentId) {
  try {
    const r = await fsGet("enrollments", enrollmentId);
    if (r.data) return r.data;
    const all = await fetchEnrollments();
    return all.find(e => e.internId === enrollmentId) || null;
  } catch { return null; }
}

export async function submitProject(enrollmentId, projectIndex, submissionText) {
  await fsUpdate("enrollments", enrollmentId, {
    [`submissions.${projectIndex}`]: { text: submissionText, submittedAt: new Date().toISOString(), verified: false, verifiedAt: null, resubmit: false },
    updatedAt: new Date().toISOString(),
  });
}

export async function submitQuizAnswer(enrollmentId, projectIndex, answers, project) {
  const questions = project.quizQuestions || [];
  let correctCount = 0;
  const results = {};
  const parsedAnswers = typeof answers === "string" ? answers : JSON.stringify(answers);
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const userAns = String((answers && answers[qi]) || "").trim().toLowerCase();
    results[qi] = false;
    if (q.type === "text") { results[qi] = null; }
    else {
      const correctAns = String(q.answer || "").trim().toLowerCase();
      if (q.type === "number") results[qi] = parseFloat(userAns) === parseFloat(correctAns);
      else results[qi] = userAns === correctAns;
    }
    if (results[qi]) correctCount++;
  }
  const autoGradedCount = questions.filter((q, qi) => results[qi] !== null).length;
  const score = autoGradedCount > 0 ? Math.round((correctCount / autoGradedCount) * 100) : 0;
  const passingGrade = Number(project.passingGrade) || 100;
  const passed = autoGradedCount > 0 && score >= passingGrade;

  await fsUpdate("enrollments", enrollmentId, {
    [`submissions.${projectIndex}`]: {
      text: parsedAnswers, submittedAt: new Date().toISOString(), verified: false, verifiedAt: null, resubmit: false,
      quizAnswers: answers, quizResults: results, quizScore: score, quizPassed: passed,
    },
    updatedAt: new Date().toISOString(),
  });
  return { results, score, passed };
}

export async function verifyProject(enrollmentId, projectIndex) {
  await fsUpdate("enrollments", enrollmentId, {
    [`submissions.${projectIndex}.verified`]: true,
    [`submissions.${projectIndex}.verifiedAt`]: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function saveProjectFeedback(enrollmentId, projectIndex, feedback) {
  await fsUpdate("enrollments", enrollmentId, {
    [`submissions.${projectIndex}.feedback`]: feedback,
    [`submissions.${projectIndex}.feedbackAt`]: new Date().toISOString(),
  });
}

export async function rejectProject(enrollmentId, projectIndex, feedback) {
  await fsUpdate("enrollments", enrollmentId, {
    [`submissions.${projectIndex}.verified`]: false,
    [`submissions.${projectIndex}.resubmit`]: true,
    [`submissions.${projectIndex}.feedback`]: feedback,
    [`submissions.${projectIndex}.rejectedAt`]: new Date().toISOString(),
    [`submissions.${projectIndex}.submittedAt`]: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function fetchEnrollmentById(enrollmentId) {
  try {
    const r = await fsGet("enrollments", enrollmentId);
    return r.data || null;
  } catch { return null; }
}

export async function fetchAdminData() {
  try {
    const [referrals, enrollments, visits] = await Promise.all([
      fsGet("referrals"),
      fsGet("enrollments"),
      fsGet("referralVisits"),
    ]);
    const enrollmentsArr = snapToArray(enrollments).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const visitsArr = snapToArray(visits).sort((a, b) => (b.visitedAt || "").localeCompare(a.visitedAt || "")).slice(0, 200);

    const referralsArr = snapToArray(referrals).map((referral) => {
      const code = String(referral.code || referral.id || "").toUpperCase();
      const relatedEnrollments = enrollmentsArr.filter(e => String(e.referralCode || "").toUpperCase() === code);
      const completionInfo = (enrollment) => {
        const projects = Array.isArray(enrollment.projects) ? enrollment.projects : [];
        const submissions = enrollment.submissions || {};
        const verifiedCount = projects.filter((_, i) => submissions[i]?.verified).length;
        return { total: projects.length, verified: verifiedCount, completed: projects.length > 0 && verifiedCount === projects.length };
      };
      const completed = relatedEnrollments.filter(e => completionInfo(e).completed);
      const completedNotPaid = relatedEnrollments.filter(e => completionInfo(e).completed && e.allowedCertificate !== "yes");
      const completedAndPaid = relatedEnrollments.filter(e => e.allowedCertificate === "yes");
      return {
        ...referral, code, assignedInternships: relatedEnrollments.length,
        completedInterns: completed.length, completedInternIds: completed.map(e => e.internId || e.id),
        completedNotPaidInterns: completedNotPaid.length, completedNotPaidInternIds: completedNotPaid.map(e => e.internId || e.id),
        completedAndPaidInterns: completedAndPaid.length, completedAndPaidInternIds: completedAndPaid.map(e => e.internId || e.id),
        loggedInUsers: [],
      };
    });

    return { requests: enrollmentsArr, referrals: referralsArr, visits: visitsArr, siteVisits: [] };
  } catch {
    const data = await apiFetch("/api/admin-data");
    return { requests: data.data?.requests || [], referrals: data.data?.referrals || [], visits: (data.data?.visits || []).slice(0, 200), siteVisits: [] };
  }
}

export async function isReferralCodeMatched(referralCode) {
  const code = String(referralCode || "").trim().toUpperCase();
  if (!code) return false;
  try {
    const r = await fsGet("referrals", code);
    return !!r.data;
  } catch {
    try {
      const data = await apiFetch("/api/admin-data");
      return (data.data?.referrals || []).some(item => String(item.code || item.id || "").toUpperCase() === code);
    } catch { return false; }
  }
}

export const PAYMENT_QR_DEFAULT = "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png";
export const PAYMENT_QR_REFERRAL = "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR(1).png";

export async function deleteReferral(code) {
  if (!code) throw new Error("Referral code is required.");
  const normalizedCode = code.toUpperCase();
  try { await fsDelete("referrals", normalizedCode); } catch {}
  try { await fsDelete("referralUsers", normalizedCode); } catch {}
}

export async function deleteEnrollment(enrollmentId) {
  if (!enrollmentId) throw new Error("Enrollment ID is required.");
  await fsDelete("enrollments", enrollmentId);
}

export async function createReferral(details) {
  const code = `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const payload = { ...details, code, visited: 0, selected: 0, loggedIn: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await fsSet("referrals", code, payload);
  return payload;
}

function getDeviceType() {
  const width = window.innerWidth;
  if (/Mobi|Android/i.test(navigator.userAgent) || width < 768) return "Mobile";
  if (/Tablet|iPad/i.test(navigator.userAgent) || width < 1100) return "Tablet";
  return "Desktop";
}
function parseBrowserName(ua) {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  return "Other";
}
async function fetchGeoDetails() {
  const geo = { ip: "Unknown", country: "Unknown", city: "Unknown", region: "Unknown", isp: "Unknown", timezone: "Unknown", isVpn: false, isProxy: false, isHosting: false };
  const fetchWithTimeout = (url, timeoutMs) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
  };
  try {
    const geoRes = await fetchWithTimeout("https://ip-api.com/json/?fields=status,message,query,country,regionName,city,timezone,isp,proxy,hosting,mobile", 5000);
    if (geoRes.ok) {
      const g = await geoRes.json();
      if (g.status === "success") {
        Object.assign(geo, { ip: g.query, country: g.country, city: g.city, region: g.regionName, isp: g.isp, timezone: g.timezone, isProxy: g.proxy === true, isHosting: g.hosting === true, isVpn: g.proxy === true || g.hosting === true });
        return geo;
      }
    }
  } catch {}
  try {
    const geoRes = await fetchWithTimeout("https://ipapi.co/json/", 4000);
    if (geoRes.ok) {
      const g = await geoRes.json();
      Object.assign(geo, { ip: g.ip, country: g.country_name || g.country, city: g.city, region: g.region, isp: g.org, timezone: g.timezone });
    }
  } catch {}
  return geo;
}

export async function trackReferralVisit(referralCode) {
  if (!referralCode) return null;
  const ua = navigator.userAgent;
  let os = "Unknown OS";
  if (ua.indexOf("Windows") !== -1) os = "Windows";
  else if (ua.indexOf("Macintosh") !== -1) os = "MacOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";
  else if (ua.indexOf("Android") !== -1) os = "Android";
  else if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS";
  const normalizedCode = referralCode.toUpperCase();
  const visitBase = {
    referralCode: normalizedCode, browser: parseBrowserName(ua), browserFull: ua.substring(0, 300), os,
    device: getDeviceType(), language: navigator.language, link: window.location.href,
    visitedFrom: document.referrer || "Direct", screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timezone: (Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || "Unknown",
    visitedAt: new Date().toISOString(), action: "visited", matched: false,
  };
  const geo = await fetchGeoDetails().catch(() => ({}));
  Object.assign(visitBase, geo);

  try {
    const refR = await fsGet("referrals", normalizedCode);
    const matched = !!refR.data;
    visitBase.matched = matched;
    const r = await fsPush("referralVisits", visitBase);
    if (matched) {
      await fsUpdate("referrals", normalizedCode, { visited: (refR.data?.visited || 0) + 1, lastVisitedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    return { ...visitBase, visitId: r.data?.id };
  } catch { return null; }
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

export async function markReferralContacted(referralCode) {
  if (!referralCode) return;
  const code = referralCode.toUpperCase();
  try {
    const refR = await fsGet("referrals", code);
    if (refR.data) {
      await fsUpdate("referrals", code, { selected: (refR.data.selected || 0) + 1, lastSelectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
  } catch {}
}

export async function checkAdminStatus(email) {
  if (!email) return { isAdmin: false };
  if (email.toLowerCase().trim() === "rutujdhodapkar@gmail.com") return { isAdmin: true };
  try {
    const r = await fsGet("admins", encodeEmail(email));
    return { isAdmin: !!r.data };
  } catch {
    return await apiFetch("/api/check-admin", { method: "POST", body: JSON.stringify({ email }) });
  }
}

export async function fetchAdmins() {
  try {
    const r = await fsGet("admins");
    if (!r.data) return [];
    const arr = Array.isArray(r.data) ? r.data : Object.values(r.data);
    return arr.map(a => a.email || a);
  } catch {
    const res = await apiFetch("/api/admins");
    return res.data || [];
  }
}

export async function addAdmin(email) {
  const cleanEmail = email.toLowerCase().trim();
  await fsSet("admins", encodeEmail(cleanEmail), { email: cleanEmail, addedAt: new Date().toISOString() });
}

export async function removeAdmin(email) {
  const cleanEmail = email.toLowerCase().trim();
  await fsDelete("admins", encodeEmail(cleanEmail));
}

export async function createSelfReferral(details, uid) {
  if (!uid) throw new Error("You must be logged in to create a referral code.");
  const { name, email, phone, college, city, country, upiId } = details;
  if (!name || !email || !phone || !college || !city || !country || !upiId) {
    throw new Error("Name, email, phone, college, city, country, and UPI ID are required.");
  }
  const prefix = name.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const code = `${prefix}-${suffix}`;
  const payload = {
    code, name, email, phone, college, city, country, upiId, createdBy: uid,
    isSelfReferral: true, visited: 0, selected: 0, loggedIn: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await fsSet("referrals", code, payload);
  await fsSet("selfReferralOwners", uid, { code, createdAt: payload.createdAt });
  await fsUpdate("users", uid, { selfReferralCode: code });
  return payload;
}

export async function fetchSelfReferralCode(uid) {
  if (!uid) return null;
  try {
    const r = await fsGet("selfReferralOwners", uid);
    if (r.data?.code) return r.data.code;
  } catch {}
  try {
    const r = await fsGet("users", uid);
    if (r.data?.selfReferralCode) return r.data.selfReferralCode;
  } catch {}
  return null;
}

export async function fetchReferralDashboardData(uid) {
  if (!uid) return null;
  const code = await fetchSelfReferralCode(uid);
  if (!code) return null;
  const codeUpper = code.toUpperCase();
  try {
    const [referralR, enrollmentsR, visitsR] = await Promise.all([
      fsGet("referrals", codeUpper),
      fsGet("enrollments"),
      fsGet("referralVisits"),
    ]);
    const referral = referralR.data;
    if (!referral) return null;
    const allEnrollments = snapToArray(enrollmentsR);
    const visits = snapToArray(visitsR);
    const relatedEnrollments = allEnrollments.filter(e => String(e.referralCode || "").toUpperCase() === codeUpper);
    const relatedVisits = visits.filter(v => String(v.referralCode || "").toUpperCase() === codeUpper);
    const completionInfo = (enrollment) => {
      const projects = Array.isArray(enrollment.projects) ? enrollment.projects : [];
      const submissions = enrollment.submissions || {};
      const verifiedCount = projects.filter((_, i) => submissions[i]?.verified).length;
      return { total: projects.length, verified: verifiedCount, completed: projects.length > 0 && verifiedCount === projects.length };
    };
    const completedInterns = relatedEnrollments.filter(e => completionInfo(e).completed);
    return {
      code: codeUpper, referral, visits: relatedVisits.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 50),
      totalVisits: relatedVisits.length, totalLogins: 0, enrolledInterns: relatedEnrollments,
      totalEnrolled: relatedEnrollments.length, completedInterns: completedInterns.length,
      completedInternIds: completedInterns.map(e => e.internId || e.id),
    };
  } catch { return null; }
}

export async function fetchUserReferralStat(email) {
  if (!email) return null;
  try {
    const referralsR = await fsGet("referrals");
    const referrals = snapToArray(referralsR);
    const matched = referrals.find(r => String(r.email || "").toLowerCase().trim() === email.toLowerCase().trim());
    if (!matched) return null;
    const enrollments = await fetchEnrollments();
    const related = enrollments.filter(e => String(e.referralCode || "").toUpperCase() === (matched.code || matched.id).toUpperCase());
    const verifiedCount = related.filter(e => {
      const subs = e.submissions || {};
      const projects = Array.isArray(e.projects) ? e.projects : [];
      return projects.length > 0 && projects.every((_, i) => subs[i]?.verified);
    }).length;
    return { code: matched.code || matched.id, visited: Number(matched.visited || 0), assignedInternships: related.length, completedInterns: verifiedCount };
  } catch { return null; }
}

export async function fetchAdminReferralUsersWithInterns() {
  try {
    const [referralsR, enrollmentsR] = await Promise.all([fsGet("referrals"), fsGet("enrollments")]);
    const referrals = snapToArray(referralsR);
    const allEnrollments = snapToArray(enrollmentsR);
    return referrals.map(ref => {
      const code = (ref.code || ref.id || "").toUpperCase();
      const relatedEnrollments = allEnrollments.filter(e => String(e.referralCode || "").toUpperCase() === code);
      return {
        code, name: ref.name || "", email: ref.email || "", phone: ref.phone || "", city: ref.city || "",
        upiId: ref.upiId || "", lastActivityAt: ref.lastActivityAt || ref.updatedAt || ref.createdAt, createdAt: ref.createdAt,
        internCount: relatedEnrollments.length, internIds: relatedEnrollments.map(e => e.internId || e.id),
        interns: relatedEnrollments.map(e => ({ id: e.id, internId: e.internId || e.id, name: e.name || "", email: e.email || "", status: e.status || "Active", appliedAt: e.createdAt, completedAt: e.completedAt, paymentDate: e.paymentDate })),
      };
    });
  } catch { return []; }
}

export async function savePermanentReferralCode(uid, code) {
  if (!uid || !code) return;
  try {
    const r = await fsGet("users", uid);
    if (!r.data?.permanentReferralCode) {
      await fsUpdate("users", uid, { permanentReferralCode: code.toUpperCase(), permanentReferralDetectedAt: new Date().toISOString() });
    }
  } catch {}
}

export async function fetchPermanentReferralCode(uid) {
  if (!uid) return null;
  try {
    const r = await fsGet("users", uid);
    return r.data?.permanentReferralCode || null;
  } catch { return null; }
}

export async function verifyTaskWithAI(params) {
  const { fetchCodeFromSubmission } = await import("../utils/aiVerify");
  let codeFiles = [];
  try { codeFiles = await fetchCodeFromSubmission(params.submissionText, params.submissionUrl); } catch {}
  try {
    const data = await apiFetch('/api/ai/verify-task', { method: 'POST', body: JSON.stringify({ ...params, codeFiles }) });
    if (data.success && data.data) return { success: true, data: { ...data.data, codeFilesCount: codeFiles.length, source: 'server-nvidia' } };
  } catch {}
  const { verifyTaskInBrowser } = await import("../utils/aiVerify");
  return verifyTaskInBrowser({ ...params, codeFiles });
}

export async function fetchEarnSettings() {
  try { const r = await fsGet("siteSettings", "earn"); if (r.data) return r.data; } catch {}
  return { rewardPerCompletion: 20, milestoneCount: 50, milestoneBonus: 1000 };
}

export async function saveEarnSettings(settings) {
  await fsSet("siteSettings", "earn", settings);
}

export async function fetchEarnDetails() {
  try { const r = await fsGet("siteSettings", "earnDetails"); if (r.data) return r.data; } catch {}
  return { title: "How Refer & Earn Works", description: "Share your unique referral link with friends and classmates. When they complete their internship you get paid.", items: [
    { title: "Apply Once", description: "Submit your UPI ID to get a unique referral code instantly.", links: "" },
    { title: "Share Your Link", description: "Share anywhere — WhatsApp, LinkedIn, or social media.", links: "" },
    { title: "Track Progress", description: "See who enrolled using your link and track completions in real time.", links: "" },
    { title: "Get Paid", description: "Earn ₹20 per completion + ₹1,000 bonus at 50 completions directly to your UPI.", links: "" },
  ]};
}

export async function saveEarnDetails(details) {
  await fsSet("siteSettings", "earnDetails", details);
}

export async function fetchBannedUsers() {
  try {
    const r = await fsGet("bannedUsers");
    if (!r.data) return [];
    const arr = Array.isArray(r.data) ? r.data : Object.values(r.data);
    return arr.map((v, i) => ({ ...v, id: v.id || v.email || String(i) }));
  } catch { return []; }
}

export async function checkUserBan(email) {
  if (!email) return null;
  try {
    const r = await fsGet("bannedUsers", encodeEmail(email));
    return r.data || null;
  } catch { return null; }
}

export async function banUser(email, banType, reason, bannedBy) {
  const key = encodeEmail(email.toLowerCase().trim());
  await fsSet("bannedUsers", key, { email: email.toLowerCase().trim(), banType: banType || "both", reason: reason || "", bannedAt: new Date().toISOString(), bannedBy: bannedBy || "" });
}

export async function unbanUser(email) {
  const key = encodeEmail(email.toLowerCase().trim());
  await fsDelete("bannedUsers", key);
}

function messageMatchesUser(msg, userEmail) {
  if (msg.target === "all") return true;
  if (userEmail && msg.target && msg.target.toLowerCase() === userEmail.toLowerCase()) return true;
  return false;
}

export async function fetchAdminMessages(userEmail, { context, uid } = {}) {
  try {
    const r = await fsGet("adminMessages");
    if (!r.data) return [];
    const arr = Array.isArray(r.data) ? r.data : Object.values(r.data);
    const now = new Date();
    return arr
      .filter(msg => {
        if (msg.expiresAt && new Date(msg.expiresAt) < now) return false;
        if (!messageMatchesUser(msg, userEmail)) return false;
        if (context && msg.context && msg.context !== context) return false;
        if (uid && msg.acknowledgedBy?.[uid]) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch { return []; }
}

export async function fetchAllAdminMessages() {
  try {
    const r = await fsGet("adminMessages");
    if (!r.data) return [];
    const arr = Array.isArray(r.data) ? r.data : Object.values(r.data);
    return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch { return []; }
}

export async function saveAdminMessage(message) {
  const payload = { ...message, createdAt: new Date().toISOString(), acknowledgedBy: {} };
  if (!payload.expiresAt) delete payload.expiresAt;
  const r = await fsPush("adminMessages", payload);
  return r.data?.id;
}

export async function acknowledgeAdminMessage(messageId, uid, userInfo = {}) {
  await fsUpdate("adminMessages", messageId, {
    [`acknowledgedBy.${uid}`]: { uid, email: userInfo.email || "", name: userInfo.name || "", acknowledgedAt: new Date().toISOString() }
  });
}

export async function deleteAdminMessage(id) {
  await fsDelete("adminMessages", id);
}

export async function saveSiteNotice(notice) {
  const r = await fsPush("siteNotices", { ...notice, createdAt: new Date().toISOString(), active: true });
  return r.data?.id;
}

export async function fetchSiteNotices() {
  try {
    const r = await fsGet("siteNotices");
    if (!r.data) return [];
    const arr = Array.isArray(r.data) ? r.data : Object.values(r.data);
    return arr.filter(n => n.active !== false).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch { return []; }
}

export async function toggleSiteNotice(id, active) {
  await fsUpdate("siteNotices", id, { active });
}

export async function deleteSiteNotice(id) {
  await fsDelete("siteNotices", id);
}

export async function fetchHomepageContent() {
  try {
    const r = await fsGet("siteContent", "homepage");
    if (r.data) return r.data;
  } catch {}
  return { headline: "Kickstart Your Developer Career with Virtual Internships.", description: "Gain hands-on software engineering experience, build real production-grade code, and receive verified completion credentials. Self-paced, industry-aligned, and 100% virtual.", buttons: [{ label: "Apply Internship", action: "apply", enabled: true }, { label: "Explore Domains", action: "explore", enabled: true }], badges: [{ label: "✦ 100% FREE INTERNSHIP" }, { label: "✦ BEST INTERNSHIP FOR COLLEGE STUDENTS" }], features: [{ icon: "✓", label: "Verified Program" }, { icon: "✓", label: "Instant Offer Letter" }, { icon: "✓", label: "100% Virtual" }] };
}

export async function saveHomepageContent(content) {
  await fsSet("siteContent", "homepage", { ...content, updatedAt: new Date().toISOString() });
}

export async function markReferralAchieved(referralCode, achieved) {
  if (!referralCode) return;
  const code = referralCode.toUpperCase();
  if (achieved) {
    await fsUpdate("referrals", code, { achieved: true, achievedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  } else {
    await fsUpdate("referrals", code, { achieved: false, updatedAt: new Date().toISOString() });
  }
}

export async function markEnrollmentComplete(enrollmentId) {
  await fsUpdate("enrollments", enrollmentId, { status: "Completed", allowedCertificate: "yes", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function rejectEnrollmentCompletion(enrollmentId, reason) {
  await fsUpdate("enrollments", enrollmentId, { completionRejectedAt: new Date().toISOString(), completionRejectReason: reason || "", updatedAt: new Date().toISOString() });
}

export async function clearCompletionRejection(enrollmentId) {
  await fsUpdate("enrollments", enrollmentId, { completionRejectedAt: null, completionRejectReason: null, updatedAt: new Date().toISOString() });
}

export async function autoUnachieveIfActivity(referralCode) {
  if (!referralCode) return;
  const code = referralCode.toUpperCase();
  try {
    const r = await fsGet("referrals", code);
    if (!r.data) return;
    const d = r.data;
    if (!d.achieved || !d.achievedAt) return;
    if (new Date(d.updatedAt || 0).getTime() > new Date(d.achievedAt).getTime()) {
      await fsUpdate("referrals", code, { achieved: false, autoUnachievedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return true;
    }
  } catch {}
  return false;
}

export async function trackSiteVisit(user) {
  const visitData = {
    visitedAt: new Date().toISOString(), userAgent: navigator.userAgent || "", language: navigator.language || "",
    referrer: document.referrer || "", url: window.location.href || "",
    screen: `${window.screen?.width || "?"}x${window.screen?.height || "?"}`,
    viewport: `${window.innerWidth || "?"}x${window.innerHeight || "?"}`,
  };
  if (user && user.uid) { visitData.uid = user.uid; visitData.email = user.email || ""; visitData.name = user.displayName || ""; }
  try { await fsPush("siteVisits", visitData); } catch {}
}

export async function saveInquiry(payload) {
  const data = await apiFetch('/api/inquire', { method: 'POST', body: JSON.stringify(payload) });
  return data;
}

const DEFAULT_SERVICES = [];
export async function fetchServices() { return []; }

