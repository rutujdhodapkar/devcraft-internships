/**
 * data.js — Database operations using Firebase Realtime Database (RTDB).
 * All methods operate instantly via WebSockets (RTDB).
 *
 * RTDB structure:
 *   /careerPaths/{pushId}
 *   /howItWorks/{pushId}
 *   /faqs/{pushId}
 *   /enrollments/{pushId}
 *     /submissions/{projectIndex} — { text, submittedAt, verified, verifiedAt }
 *   /config/templates/offer_letter
 *   /config/templates/certificate
 *   /config/aboutText
 *   /users/{uid}
 *   /referrals/{CODE}
 *   /referralVisits/{pushId}
 *   /admins/{encodedEmail}
 */

import {
  ref,
  push,
  set,
  get,
  update,
  remove,
  increment,
} from "firebase/database";
import { rtdb, isFirebaseConfigured } from "../firebase";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const encodeEmail = (email) => email.toLowerCase().trim().replace(/\./g, ",");
const decodeEmail = (key) => key.replace(/,/g, ".");

const API_BASE = import.meta.env.VITE_SERVER_URL || "";

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  if (!text || !text.trim()) {
    throw new Error(
      "Server returned an empty response. Make sure the server is running.",
    );
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

function snapToArray(val) {
  if (!val) return [];
  return Object.entries(val).map(([id, data]) => ({ id, ...data }));
}

/** Generate a stable readable intern ID per user like dev-craft-AB3X9ZKQ */
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

// ─── Default Career Paths ──────────────────────────────────────────────────────
const DEFAULT_CAREER_PATHS = [
  {
    id: "path_python",
    title: "Python Development",
    duration: "4 Weeks",
    description:
      "Gain hands-on software development experience with Python scripting, data structures, and backends.",
    features: [
      "Basic Python syntax & scripting",
      "OOP & Data structures",
      "Flask & Django web development",
      "Final capstone project",
    ],
    projects: [
      "Personal Portfolio Website",
      "Weather Web App",
      "Task Manager API",
    ],
    paymentQr:
      "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png",
  },
  {
    id: "path_java",
    title: "Java Development",
    duration: "4 Weeks",
    description:
      "Build enterprise-ready applications using Java Core, Spring Boot microservices, and databases.",
    features: [
      "Java Core & JVM concepts",
      "OOP & Interface Design",
      "Spring Boot microservices",
      "Database integration & SQL",
    ],
    projects: [
      "Library Management System",
      "REST API Backend",
      "Student Registry Platform",
    ],
    paymentQr:
      "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png",
  },
  {
    id: "path_web",
    title: "Web Development",
    duration: "4 Weeks",
    description:
      "Learn to design and deploy modern, responsive frontend user interfaces using React.js and CSS.",
    features: [
      "HTML5 & CSS3 layout systems",
      "JavaScript ES6+ fundamentals",
      "React.js frontend frameworks",
      "State management & deployment",
    ],
    projects: [
      "Responsive Portfolio",
      "Interactive Quiz App",
      "Admin Dashboard UI",
    ],
    paymentQr:
      "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png",
  },
];

// ─── Default How It Works steps ─────────────────────────────────────────────────
const DEFAULT_HOW_IT_WORKS = [
  {
    id: "step_1",
    step: 1,
    title: "Select Domain",
    description:
      "Browse our available career paths and select your preferred domain.",
  },
  {
    id: "step_2",
    step: 2,
    title: "Instant Offer Letter",
    description:
      "Log in with Google, fill in your profile, and receive your official offer letter instantly.",
  },
  {
    id: "step_3",
    step: 3,
    title: "Complete Projects",
    description: "Work through structured real-world tasks and submit them.",
  },
  {
    id: "step_4",
    step: 4,
    title: "Get Certified",
    description:
      "Once verified, download your industry-ready internship completion certificate.",
  },
];

// ─── Default FAQs ────────────────────────────────────────────────────────────────
const DEFAULT_FAQS = [
  {
    id: "faq_1",
    question: "Are the internships really 100% free?",
    answer:
      "Yes, all our virtual internships are 100% free of cost. There are no hidden fees or charges for learning and certification.",
  },
  {
    id: "faq_2",
    question: "Who is eligible to apply?",
    answer:
      "Any college student or self-taught learner looking to gain practical software development and coding experience is welcome to apply.",
  },
  {
    id: "faq_3",
    question: "How will my internship progress be tracked?",
    answer:
      "You will work on self-paced projects. Once you complete the projects, you submit them through the student area, and the team will verify your completion.",
  },
  {
    id: "faq_4",
    question: "Is the certificate verified?",
    answer:
      "Yes, every certificate has a unique ID and can be verified publicly on our website through the verify button.",
  },
];

// ─── Default HTML Templates ──────────────────────────────────────────────────────
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
      <div class="meta-col">
        <div class="sig-line">Date of Issue</div>
        <div>{{date}}</div>
      </div>
      <div class="meta-col">
        <div style="height: 30px; line-height: 30px; font-size: 16px; font-family: 'Georgia', serif; font-style: italic; color: #bda068;">DevCraft</div>
        <div class="sig-line">Authorized Signatory</div>
      </div>
      <div class="meta-col">
        <div class="sig-line">Intern ID</div>
        <div>{{internId}}</div>
      </div>
    </div>

    <div class="footer">
      DevCraft © 2026. Credential ID: {{id}} | Verify at devcraft.internship
    </div>
  </div>
</body>
</html>`;

export { DEFAULT_CAREER_PATHS, DEFAULT_HOW_IT_WORKS, DEFAULT_FAQS };

// ─── Fetch / Save Career Paths ──────────────────────────────────────────────────
export async function fetchCareerPaths() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, "careerPaths"));
      if (snap.exists()) {
        return snapToArray(snap.val());
      }
    } catch (err) {
      console.warn("Could not fetch career paths from RTDB:", err.message);
    }
  }
  return DEFAULT_CAREER_PATHS;
}

export async function saveCareerPaths(paths) {
  if (isFirebaseConfigured && rtdb) {
    const dataMap = {};
    paths.forEach((p) => {
      const id = p.id || push(ref(rtdb, "careerPaths")).key;
      dataMap[id] = { ...p, id };
    });
    await set(ref(rtdb, "careerPaths"), dataMap);
    return;
  }
  throw new Error("Firebase RTDB is not configured.");
}

// ─── Fetch / Save How It Works ─────────────────────────────────────────────────
export async function fetchHowItWorks() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, "howItWorks"));
      if (snap.exists()) {
        return snapToArray(snap.val()).sort(
          (a, b) => (a.step || 0) - (b.step || 0),
        );
      }
    } catch (err) {
      console.warn("Could not fetch howItWorks from RTDB:", err.message);
    }
  }
  return DEFAULT_HOW_IT_WORKS;
}

export async function saveHowItWorks(steps) {
  if (isFirebaseConfigured && rtdb) {
    const dataMap = {};
    steps.forEach((step, idx) => {
      const id = step.id || `step_${idx + 1}`;
      dataMap[id] = { ...step, id, step: Number(step.step) || idx + 1 };
    });
    await set(ref(rtdb, "howItWorks"), dataMap);
    return;
  }
  throw new Error("Firebase RTDB is not configured.");
}

// ─── Fetch / Save FAQs ─────────────────────────────────────────────────────────
export async function fetchFAQs() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, "faqs"));
      if (snap.exists()) {
        return snapToArray(snap.val());
      }
    } catch (err) {
      console.warn("Could not fetch FAQs from RTDB:", err.message);
    }
  }
  return DEFAULT_FAQS;
}

export async function saveFAQs(faqs) {
  if (isFirebaseConfigured && rtdb) {
    const dataMap = {};
    faqs.forEach((f, idx) => {
      const id = f.id || `faq_${idx + 1}`;
      dataMap[id] = { ...f, id };
    });
    await set(ref(rtdb, "faqs"), dataMap);
    return;
  }
  throw new Error("Firebase RTDB is not configured.");
}

// ─── Fetch / Save HTML Templates ────────────────────────────────────────────────
export async function fetchTemplates() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, "config/templates"));
      if (snap.exists()) {
        const data = snap.val();
        return {
          offer_letter: data.offer_letter || DEFAULT_OFFER_LETTER_TEMPLATE,
          certificate: data.certificate || DEFAULT_CERTIFICATE_TEMPLATE,
        };
      }
    } catch (err) {
      console.warn("Could not fetch templates from RTDB:", err.message);
    }
  }
  return {
    offer_letter: DEFAULT_OFFER_LETTER_TEMPLATE,
    certificate: DEFAULT_CERTIFICATE_TEMPLATE,
  };
}

export async function saveTemplates(templates) {
  if (isFirebaseConfigured && rtdb) {
    await set(ref(rtdb, "config/templates"), templates);
    return;
  }
  throw new Error("Firebase RTDB is not configured.");
}

// ─── Fetch / Save About Content ─────────────────────────────────────────────────
export async function fetchAboutText() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, "config/aboutText"));
      if (snap.exists()) return snap.val();
    } catch (err) {
      console.warn("Could not fetch aboutText:", err.message);
    }
  }
  return "DevCraft provides top-tier 100% free virtual internships for university and college students. Gain verified work experience, finish structured programming projects, and receive certified validation for your software engineering credentials.";
}

export async function saveAboutText(text) {
  if (isFirebaseConfigured && rtdb) {
    await set(ref(rtdb, "config/aboutText"), text);
    return;
  }
  throw new Error("Firebase RTDB is not configured.");
}

// ─── User Profile ───────────────────────────────────────────────────────────────
export async function fetchUserProfile(uid) {
  if (isFirebaseConfigured && rtdb) {
    const snap = await get(ref(rtdb, `users/${uid}`));
    return snap.exists() ? snap.val() : null;
  }
  return null;
}

export async function saveUserProfile(uid, profile) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `users/${uid}`), {
      ...profile,
      updatedAt: new Date().toISOString(),
    });
  }
}

// ─── Student Enrollments & Internship Operations ────────────────────────────────
export async function enrollStudent(uid, profile, domainObj) {
  if (isFirebaseConfigured && rtdb) {
    const existing = await fetchUserEnrollments(uid);
    const duplicate = existing.find(
      (e) =>
        e.domainId === domainObj.id ||
        (e.domain || "").toLowerCase() ===
          (domainObj.title || "").toLowerCase(),
    );
    if (duplicate) {
      return duplicate;
    }

    const newRef = push(ref(rtdb, "enrollments"));
    const enrollmentId = newRef.key;

    // Check referral code from: localStorage (immediate), then permanent profile (persistent)
    let refCode = localStorage.getItem("detected_referral_code") || "";
    if (refCode) localStorage.removeItem("detected_referral_code");

    if (!refCode) {
      try {
        const permanentCode = await fetchPermanentReferralCode(uid);
        if (permanentCode) refCode = permanentCode;
      } catch {}
    }

    // Generate a human-readable intern ID
    const internId = generateInternId(uid);

    const enrollment = {
      id: enrollmentId,
      internId,
      uid,
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
      status: "Active", // 'Active', 'Completed'
      submissions: {}, // { [projectIndex]: { text, submittedAt, verified, verifiedAt } }
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      referralCode: refCode,
    };

    // Save enrollment
    await set(newRef, enrollment);

    // If referral exists, increment both visited/selected counts!
    if (refCode) {
      try {
        const refCodeUpper = refCode.toUpperCase();
        const referralRef = ref(rtdb, `referrals/${refCodeUpper}`);
        const refSnap = await get(referralRef);
        if (refSnap.exists()) {
          await update(referralRef, {
            selected: increment(1),
            lastSelectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn(
          "Could not update referral enrollment statistics:",
          err.message,
        );
      }
    }

    return enrollment;
  }
  throw new Error("Firebase RTDB is not configured.");
}

export async function fetchEnrollments() {
  if (isFirebaseConfigured && rtdb) {
    const snap = await get(ref(rtdb, "enrollments"));
    return snap.exists() ? snapToArray(snap.val()) : [];
  }
  return [];
}

export async function fetchUserEnrollments(uid) {
  if (isFirebaseConfigured && rtdb) {
    const all = await fetchEnrollments();
    const userEnrollments = all.filter((e) => e.uid === uid);
    const stableInternId = generateInternId(uid);
    await Promise.all(
      userEnrollments
        .filter((e) => e.internId !== stableInternId)
        .map((e) =>
          update(ref(rtdb, `enrollments/${e.id}`), {
            internId: stableInternId,
            updatedAt: new Date().toISOString(),
          }).catch(() => null),
        ),
    );
    return userEnrollments.map((e) => ({ ...e, internId: stableInternId }));
  }
  return [];
}

export async function updateEnrollmentStatus(enrollmentId, status) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      status,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function submitTransactionId(enrollmentId, transactionId) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      transactionId,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function recordReferralLogin(referralCode, user) {
  if (!referralCode || !user?.uid) return;
  const code = String(referralCode).toUpperCase();

  if (isFirebaseConfigured && rtdb) {
    const referralRef = ref(rtdb, `referrals/${code}`);
    const snap = await get(referralRef);
    if (!snap.exists()) return;

    const loginRef = ref(rtdb, `referralUsers/${code}/${user.uid}`);
    const loginSnap = await get(loginRef);
    const payload = {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      referralCode: code,
      lastLoginAt: new Date().toISOString(),
    };

    await set(
      loginRef,
      loginSnap.exists()
        ? { ...loginSnap.val(), ...payload }
        : {
            ...payload,
            firstLoginAt: new Date().toISOString(),
          },
    );

    if (!loginSnap.exists()) {
      await update(referralRef, {
        loggedIn: increment(1),
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function allowCertificate(enrollmentId, allowed) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      allowedCertificate: allowed, // 'yes' or 'no'
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function verifyInternship(enrollmentId) {
  if (isFirebaseConfigured && rtdb) {
    const snap = await get(ref(rtdb, `enrollments/${enrollmentId}`));
    if (snap.exists()) {
      return snap.val();
    }
    const all = await fetchEnrollments();
    return all.find((e) => e.internId === enrollmentId) || null;
  }
  return null;
}

// ─── Project Submission ────────────────────────────────────────────────────────
/**
 * Submit a project for a given enrollment.
 * @param {string} enrollmentId
 * @param {number} projectIndex — 0-based index of the project
 * @param {string} submissionText — link or text the intern submits
 */
export async function submitProject(
  enrollmentId,
  projectIndex,
  submissionText,
) {
  if (isFirebaseConfigured && rtdb) {
    await update(
      ref(rtdb, `enrollments/${enrollmentId}/submissions/${projectIndex}`),
      {
        text: submissionText,
        submittedAt: new Date().toISOString(),
        verified: false,
        verifiedAt: null,
        resubmit: false,
      },
    );
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  throw new Error("Firebase RTDB is not configured.");
}

export async function submitQuizAnswer(enrollmentId, projectIndex, answers, project) {
  if (isFirebaseConfigured && rtdb) {
    const questions = project.quizQuestions || [];
    const totalQ = questions.length;
    let correctCount = 0;
    const results = {};
    const parsedAnswers = typeof answers === "string" ? answers : JSON.stringify(answers);

    questions.forEach((q, qi) => {
      const userAns = String((answers && answers[qi]) || "").trim().toLowerCase();
      results[qi] = false;
      if (q.type === "text") {
        // Text input requires admin verification - not auto-graded
        results[qi] = null;
      } else {
        const correctAns = String(q.answer || "").trim().toLowerCase();
        if (q.type === "number") {
          results[qi] = parseFloat(userAns) === parseFloat(correctAns);
        } else {
          results[qi] = userAns === correctAns;
        }
        if (results[qi]) correctCount++;
      }
    });

    const autoGradedCount = questions.filter((q) => q.type !== "text").length;
    const score = autoGradedCount > 0 ? Math.round((correctCount / autoGradedCount) * 100) : 0;
    const passingGrade = Number(project.passingGrade) || 100;
    const passed = autoGradedCount > 0 && score >= passingGrade;
    const allAutoGradedPassed = questions.every((q, qi) => q.type === "text" || results[qi]);

    await update(
      ref(rtdb, `enrollments/${enrollmentId}/submissions/${projectIndex}`),
      {
        text: parsedAnswers,
        submittedAt: new Date().toISOString(),
        verified: allAutoGradedPassed,
        verifiedAt: allAutoGradedPassed ? new Date().toISOString() : null,
        resubmit: !allAutoGradedPassed,
        quizAnswers: answers,
        quizResults: results,
        quizScore: score,
        quizPassed: passed,
      },
    );
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      updatedAt: new Date().toISOString(),
    });
    return { results, score, passed };
  }
  throw new Error("Firebase RTDB is not configured.");
}

/**
 * Admin verifies a submitted project.
 * @param {string} enrollmentId
 * @param {number} projectIndex
 */
export async function verifyProject(enrollmentId, projectIndex) {
  if (isFirebaseConfigured && rtdb) {
    await update(
      ref(rtdb, `enrollments/${enrollmentId}/submissions/${projectIndex}`),
      {
        verified: true,
        verifiedAt: new Date().toISOString(),
      },
    );
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  throw new Error("Firebase RTDB is not configured.");
}

export async function saveProjectFeedback(
  enrollmentId,
  projectIndex,
  feedback,
) {
  if (isFirebaseConfigured && rtdb) {
    await update(
      ref(rtdb, `enrollments/${enrollmentId}/submissions/${projectIndex}`),
      {
        feedback,
        feedbackAt: new Date().toISOString(),
      },
    );
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  throw new Error("Firebase RTDB is not configured.");
}

export async function rejectProject(enrollmentId, projectIndex, feedback) {
  if (isFirebaseConfigured && rtdb) {
    await update(
      ref(rtdb, `enrollments/${enrollmentId}/submissions/${projectIndex}`),
      {
        verified: false,
        resubmit: true,
        feedback,
        rejectedAt: new Date().toISOString(),
        submittedAt: null, // clear submittedAt so they can submit again
      },
    );
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  throw new Error("Firebase RTDB is not configured.");
}

/**
 * Fetch a single enrollment by ID.
 */
export async function fetchEnrollmentById(enrollmentId) {
  if (isFirebaseConfigured && rtdb) {
    const snap = await get(ref(rtdb, `enrollments/${enrollmentId}`));
    return snap.exists() ? snap.val() : null;
  }
  return null;
}

// ─── Admin Data ────────────────────────────────────────────────────────────────
export async function fetchAdminData() {
  if (isFirebaseConfigured && rtdb) {
    const [referralsSnap, visitsSnap, enrollmentsSnap, referralUsersSnap, siteVisitsSnap] =
      await Promise.all([
        get(ref(rtdb, "referrals")),
        get(ref(rtdb, "referralVisits")),
        get(ref(rtdb, "enrollments")),
        get(ref(rtdb, "referralUsers")),
        get(ref(rtdb, "siteVisits")),
      ]);

    const enrollments = snapToArray(enrollmentsSnap.val()).sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
    const referralUsers = referralUsersSnap.val() || {};
    const completionInfo = (enrollment) => {
      const projects = Array.isArray(enrollment.projects)
        ? enrollment.projects
        : [];
      const submissions = enrollment.submissions || {};
      const verifiedCount = projects.filter(
        (_, i) => submissions[i]?.verified,
      ).length;
      return {
        total: projects.length,
        verified: verifiedCount,
        completed: projects.length > 0 && verifiedCount === projects.length,
      };
    };

    const referrals = snapToArray(referralsSnap.val())
      .map((referral) => {
        const code = String(referral.code || referral.id || "").toUpperCase();
        const loginUsers = Object.values(referralUsers[code] || {});
        const relatedEnrollments = enrollments.filter(
          (e) => String(e.referralCode || "").toUpperCase() === code,
        );
        const relatedVisitCount = snapToArray(visitsSnap.val()).filter(
          (v) => String(v.referralCode || "").toUpperCase() === code,
        ).length;
        const loginUidSet = new Set(
          loginUsers.map((u) => u.uid).filter(Boolean),
        );
        relatedEnrollments.forEach((e) => {
          if (e.uid) loginUidSet.add(e.uid);
        });
        const assigned = relatedEnrollments;
        const completed = relatedEnrollments.filter((e) => {
          const info = completionInfo(e);
          return info.completed;
        });
        const completedNotPaid = relatedEnrollments.filter((e) => {
          const info = completionInfo(e);
          return info.completed && e.allowedCertificate !== "yes";
        });
        const completedAndPaid = relatedEnrollments.filter(
          (e) => e.allowedCertificate === "yes",
        );
        const internIds = (rows) =>
          rows.map((e) => e.internId || e.id).filter(Boolean);

        return {
          ...referral,
          code,
          totalLogined: loginUidSet.size,
          visited: relatedVisitCount || Number(referral.visited || 0),
          assignedInternships: assigned.length,
          completedInterns: completed.length,
          completedInternIds: internIds(completed),
          completedNotPaidInterns: completedNotPaid.length,
          completedNotPaidInternIds: internIds(completedNotPaid),
          completedAndPaidInterns: completedAndPaid.length,
          completedAndPaidInternIds: internIds(completedAndPaid),
          loggedInUsers: loginUsers,
          assignedInternIds: internIds(assigned),
        };
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    const visits = snapToArray(visitsSnap.val())
      .sort((a, b) => (b.visitedAt || "").localeCompare(a.visitedAt || ""))
      .slice(0, 200)
      .map((visit) => ({
        ...visit,
        id: visit.visitId || visit.id,
        referralCode: visit.referralCode || "-",
        browser: visit.browser || "Unknown",
        visitedFrom: visit.visitedFrom || visit.referrer || "Direct",
        device: visit.device || "Unknown",
        country: visit.country || "Unknown",
        city: visit.city || "Unknown",
        ip: visit.ip || "Unknown",
        isVpn:
          visit.isVpn === true
            ? "Yes"
            : visit.isVpn === false
              ? "No"
              : "Unknown",
        link: visit.link || "-",
        matched: visit.matched === true,
        visitedAtRaw: visit.visitedAt,
        visitedAt: visit.visitedAt
          ? new Date(visit.visitedAt).toLocaleString()
          : "-",
      }));

    const siteVisits = snapToArray(siteVisitsSnap.val())
      .sort((a, b) => (b.visitedAt || "").localeCompare(a.visitedAt || ""))
      .slice(0, 200)
      .map((v) => ({
        ...v,
        type: "site",
        name: v.name || v.email || "-",
        visitedAt: v.visitedAt ? new Date(v.visitedAt).toLocaleString() : "-",
      }));
    return { requests: enrollments, referrals, visits, siteVisits };
  }

  const data = await apiFetch("/api/admin-data");
  const visits = (data.data.visits || []).map((visit) => ({
    ...visit,
    matched: visit.matched === true,
    visitedAt: visit.visitedAt
      ? new Date(visit.visitedAt).toLocaleString()
      : "-",
  }));
  return {
    requests: data.data.requests || [],
    referrals: data.data.referrals || [],
    visits,
    siteVisits: [],
  };
}

// ─── Referral Creation ─────────────────────────────────────────────────────────
export async function isReferralCodeMatched(referralCode) {
  const code = String(referralCode || "")
    .trim()
    .toUpperCase();
  if (!code) return false;

  if (isFirebaseConfigured && rtdb) {
    const snap = await get(ref(rtdb, `referrals/${code}`));
    return snap.exists();
  }

  try {
    const data = await apiFetch("/api/admin-data");
    const referrals = data.data?.referrals || [];
    return referrals.some(
      (item) => String(item.code || item.id || "").toUpperCase() === code,
    );
  } catch {
    return false;
  }
}

export const PAYMENT_QR_DEFAULT =
  "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png";
export const PAYMENT_QR_REFERRAL =
  "https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR(1).png";

// ─── Referral / Enrollment Deletion ──────────────────────────────────────────
export async function deleteReferral(code) {
  if (!code) throw new Error("Referral code is required.");
  const normalizedCode = code.toUpperCase();

  if (isFirebaseConfigured && rtdb) {
    await remove(ref(rtdb, `referrals/${normalizedCode}`));
    // Clean up related data
    try {
      await remove(ref(rtdb, `referralUsers/${normalizedCode}`));
    } catch {}
    return;
  }

  await apiFetch(`/api/referrals/${encodeURIComponent(normalizedCode)}`, {
    method: "DELETE",
  });
}

export async function deleteEnrollment(enrollmentId) {
  if (!enrollmentId) throw new Error("Enrollment ID is required.");

  if (isFirebaseConfigured && rtdb) {
    await remove(ref(rtdb, `enrollments/${enrollmentId}`));
    return;
  }

  await apiFetch(`/api/inquiries/${encodeURIComponent(enrollmentId)}`, {
    method: "DELETE",
  });
}

export async function createReferral(details) {
  const code = `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const payload = {
    ...details,
    code,
    visited: 0,
    selected: 0,
    loggedIn: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isFirebaseConfigured && rtdb) {
    await set(ref(rtdb, `referrals/${code}`), payload);
    return payload;
  }

  const data = await apiFetch("/api/referrals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.data;
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
  const geo = {
    ip: "Unknown",
    country: "Unknown",
    city: "Unknown",
    region: "Unknown",
    isp: "Unknown",
    timezone: "Unknown",
    isVpn: false,
    isProxy: false,
    isHosting: false,
  };

  const fetchWithTimeout = (url, timeoutMs) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
  };

  try {
    const geoRes = await fetchWithTimeout(
      "https://ip-api.com/json/?fields=status,message,query,country,regionName,city,timezone,isp,proxy,hosting,mobile",
      5000,
    );
    if (geoRes.ok) {
      const g = await geoRes.json();
      if (g.status === "success") {
        geo.ip = g.query || "Unknown";
        geo.country = g.country || "Unknown";
        geo.city = g.city || "Unknown";
        geo.region = g.regionName || "Unknown";
        geo.isp = g.isp || "Unknown";
        geo.timezone = g.timezone || "Unknown";
        geo.isProxy = g.proxy === true;
        geo.isHosting = g.hosting === true;
        geo.isVpn = g.proxy === true || g.hosting === true;
        return geo;
      }
    }
  } catch {
    /* try fallback */
  }

  try {
    const geoRes = await fetchWithTimeout("https://ipapi.co/json/", 4000);
    if (geoRes.ok) {
      const g = await geoRes.json();
      geo.ip = g.ip || "Unknown";
      geo.country = g.country_name || g.country || "Unknown";
      geo.city = g.city || "Unknown";
      geo.region = g.region || "Unknown";
      geo.isp = g.org || "Unknown";
      geo.timezone = g.timezone || "Unknown";
    }
  } catch {
    /* ignore */
  }

  return geo;
}

// ─── Referral Visit Tracking ───────────────────────────────────────────────────
export async function trackReferralVisit(referralCode) {
  if (!referralCode) return null;

  const ua = navigator.userAgent;
  let os = "Unknown OS";
  if (ua.indexOf("Windows") !== -1) os = "Windows";
  else if (ua.indexOf("Macintosh") !== -1) os = "MacOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";
  else if (ua.indexOf("Android") !== -1) os = "Android";
  else if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS";

  const cores = navigator.hardwareConcurrency || "Unknown";
  const memory = navigator.deviceMemory || "Unknown";

  let connectionType = "Unknown",
    downlink = "Unknown",
    rtt = "Unknown";
  if (navigator.connection) {
    try {
      connectionType = navigator.connection.effectiveType || "Unknown";
      downlink = navigator.connection.downlink || "Unknown";
      rtt = navigator.connection.rtt || "Unknown";
    } catch {}
  }

  const normalizedCode = referralCode.toUpperCase();

  const visitedFrom = document.referrer || "Direct";
  const browser = parseBrowserName(ua);
  let geo;
  try { geo = await fetchGeoDetails(); } catch { geo = {}; }

  const visitBase = {
    referralCode: normalizedCode,
    browser,
    browserFull: ua.substring(0, 300),
    os,
    hardware: `Cores: ${cores}, RAM: ${memory}GB`,
    network: `Type: ${connectionType}, Downlink: ${downlink}Mbps, RTT: ${rtt}ms`,
    device: getDeviceType(),
    language: navigator.language,
    link: window.location.href,
    visitedFrom,
    referrer: document.referrer || "",
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timezone: (Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || "Unknown",
    visitedAt: new Date().toISOString(),
    ip: geo?.ip || "Unknown",
    country: geo?.country || "Unknown",
    city: geo?.city || "Unknown",
    region: geo?.region || "Unknown",
    isp: geo?.isp || "Unknown",
    isVpn: geo?.isVpn === true,
    isProxy: geo?.isProxy === true,
    isHosting: geo?.isHosting === true,
    action: "visited",
    matched: false,
  };

  if (isFirebaseConfigured && rtdb) {
    try {
      let referralRef = ref(rtdb, `referrals/${normalizedCode}`);
      let referralSnap = await get(referralRef);

      if (!referralSnap.exists()) {
        const allReferralsSnap = await get(ref(rtdb, "referrals"));
        if (allReferralsSnap.exists()) {
          const entries = Object.entries(allReferralsSnap.val());
          const matchedEntry = entries.find(
            ([, data]) =>
              String(data.code || "").toUpperCase() === normalizedCode,
          );
          if (matchedEntry) {
            referralRef = ref(rtdb, `referrals/${matchedEntry[0]}`);
            referralSnap = await get(referralRef);
          }
        }
      }

      const visitRef = push(ref(rtdb, "referralVisits"));
      visitBase.visitId = visitRef.key;
      visitBase.referralCode = normalizedCode;

      await set(visitRef, visitBase);

      const matched = referralSnap.exists();
      visitBase.matched = matched;

      await Promise.all([
        update(visitRef, { matched }),
        matched
          ? update(referralRef, {
              visited: increment(1),
              lastVisitedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          : Promise.resolve(),
      ]).catch(() => {});
      return { ...visitBase, matched };
    } catch (e) {
      console.warn("trackReferralVisit Firebase error:", e.message);
      return null;
    }
  }

  try {
    const data = await apiFetch("/api/referral-visits", {
      method: "POST",
      body: JSON.stringify(visitBase),
    });
    return data.data;
  } catch {
    return null;
  }
}

/**
 * Read referral code from URL, persist to localStorage, track the visit, and return status.
 * Called once on app mount from App.jsx.
 */
export async function processReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("ref") || "").trim().toUpperCase();
  if (!code) {
    localStorage.removeItem("detected_referral_code");
    return { code: "", matched: false };
  }

  // Track the visit (deduplicated via sessionStorage)
  try {
    await trackReferralVisit(code);
  } catch {
    /* silent */
  }

  // Independently check if this referral code matches an existing referral
  const matched = await isReferralCodeMatched(code);
  if (matched) {
    localStorage.setItem("detected_referral_code", code);
  } else {
    localStorage.removeItem("detected_referral_code");
  }
  return { code, matched };
}

export async function markReferralContacted(referralCode) {
  if (!referralCode) return;
  const code = referralCode.toUpperCase();

  if (isFirebaseConfigured && rtdb) {
    const referralRef = ref(rtdb, `referrals/${code}`);
    const snap = await get(referralRef);
    if (snap.exists()) {
      await update(referralRef, {
        selected: increment(1),
        lastSelectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  await apiFetch(`/api/referrals/${code}/contacted`, { method: "POST" });
}

// ─── Admin Management ──────────────────────────────────────────────────────────
export async function checkAdminStatus(email) {
  if (!email) return { isAdmin: false };
  const root = "rutujdhodapkar@gmail.com";
  if (email.toLowerCase().trim() === root) return { isAdmin: true };

  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, `admins/${encodeEmail(email)}`));
      return { isAdmin: snap.exists() };
    } catch {
      return { isAdmin: false };
    }
  }

  return await apiFetch("/api/check-admin", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function fetchAdmins() {
  if (isFirebaseConfigured && rtdb) {
    const snap = await get(ref(rtdb, "admins"));
    if (!snap.exists()) return [];
    return Object.keys(snap.val()).map(decodeEmail);
  }

  const res = await apiFetch("/api/admins");
  return res.data;
}

export async function addAdmin(email) {
  const cleanEmail = email.toLowerCase().trim();
  if (isFirebaseConfigured && rtdb) {
    await set(ref(rtdb, `admins/${encodeEmail(cleanEmail)}`), {
      email: cleanEmail,
      addedAt: new Date().toISOString(),
    });
    return;
  }

  await apiFetch("/api/admins", {
    method: "POST",
    body: JSON.stringify({ email: cleanEmail }),
  });
}

export async function removeAdmin(email) {
  const cleanEmail = email.toLowerCase().trim();
  if (isFirebaseConfigured && rtdb) {
    await remove(ref(rtdb, `admins/${encodeEmail(cleanEmail)}`));
    return;
  }

  await apiFetch(`/api/admins/${encodeURIComponent(cleanEmail)}`, {
    method: "DELETE",
  });
}

// ─── Self-Referral (Earn Section) ─────────────────────────────────────────────
export async function createSelfReferral(details, uid) {
  if (!uid) throw new Error("You must be logged in to create a referral code.");
  const name = (details.name || "").trim();
  const email = (details.email || "").trim();
  const phone = (details.phone || "").trim();
  const college = (details.college || "").trim();
  const city = (details.city || "").trim();
  const country = (details.country || "").trim();
  const upiId = (details.upiId || "").trim();
  if (!name || !email || !phone || !college || !city || !country || !upiId) {
    throw new Error(
      "Name, email, phone, college, city, country, and UPI ID are required.",
    );
  }

  const prefix = name
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 5)
    .toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const code = `${prefix}-${suffix}`;

  const payload = {
    code,
    name,
    email,
    phone,
    college,
    city,
    country,
    upiId,
    createdBy: uid,
    isSelfReferral: true,
    visited: 0,
    selected: 0,
    loggedIn: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isFirebaseConfigured && rtdb) {
    await set(ref(rtdb, `referrals/${code}`), payload);
    await set(ref(rtdb, `selfReferralOwners/${uid}`), {
      code,
      createdAt: payload.createdAt,
    });
    await update(ref(rtdb, `users/${uid}`), { selfReferralCode: code });
    return payload;
  }
  throw new Error("Firebase RTDB is not configured.");
}

export async function fetchSelfReferralCode(uid) {
  if (!uid) return null;
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, `selfReferralOwners/${uid}`));
      if (snap.exists()) return snap.val().code;
    } catch {}
    try {
      const userSnap = await get(ref(rtdb, `users/${uid}/selfReferralCode`));
      if (userSnap.exists()) return userSnap.val();
    } catch {}
  }
  return null;
}

export async function fetchReferralDashboardData(uid) {
  if (!uid) return null;
  if (isFirebaseConfigured && rtdb) {
    const code = await fetchSelfReferralCode(uid);
    if (!code) return null;

    const codeUpper = code.toUpperCase();
    const [referralSnap, allEnrollmentsSnap, visitsSnap, referralUsersSnap] =
      await Promise.all([
        get(ref(rtdb, `referrals/${codeUpper}`)),
        get(ref(rtdb, "enrollments")),
        get(ref(rtdb, "referralVisits")),
        get(ref(rtdb, `referralUsers/${codeUpper}`)),
      ]);

    const referral = referralSnap.exists() ? referralSnap.val() : null;
    const allEnrollments = snapToArray(allEnrollmentsSnap.val() || {});
    const visits = snapToArray(visitsSnap.val() || {});
    const referralUsers = referralUsersSnap.exists()
      ? referralUsersSnap.val()
      : {};

    const relatedEnrollments = allEnrollments.filter(
      (e) => String(e.referralCode || "").toUpperCase() === codeUpper,
    );
    const relatedVisits = visits.filter(
      (v) => String(v.referralCode || "").toUpperCase() === codeUpper,
    );
    const loginUsers = Object.values(referralUsers || {});

    const completionInfo = (enrollment) => {
      const projects = Array.isArray(enrollment.projects)
        ? enrollment.projects
        : [];
      const submissions = enrollment.submissions || {};
      const verifiedCount = projects.filter(
        (_, i) => submissions[i]?.verified,
      ).length;
      return {
        total: projects.length,
        verified: verifiedCount,
        completed: projects.length > 0 && verifiedCount === projects.length,
      };
    };

    const completedInterns = relatedEnrollments.filter(
      (e) => completionInfo(e).completed,
    );

    return {
      code: codeUpper,
      referral,
      visits: relatedVisits
        .sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt))
        .slice(0, 50),
      totalVisits: relatedVisits.length,
      totalLogins: loginUsers.length,
      enrolledInterns: relatedEnrollments,
      totalEnrolled: relatedEnrollments.length,
      completedInterns: completedInterns.length,
      completedInternIds: completedInterns.map((e) => e.internId || e.id),
    };
  }
  return null;
}

export async function fetchUserReferralStat(email) {
  if (!email) return null;
  const emailLower = email.toLowerCase().trim();

  if (isFirebaseConfigured && rtdb) {
    try {
      const referralsSnap = await get(ref(rtdb, "referrals"));
      if (!referralsSnap.exists()) return null;

      const referrals = referralsSnap.val();
      const matchedKey = Object.keys(referrals).find(
        (k) =>
          String(referrals[k].email || "")
            .toLowerCase()
            .trim() === emailLower,
      );
      if (!matchedKey) return null;

      const referral = referrals[matchedKey];
      const enrollmentsSnap = await get(ref(rtdb, "enrollments"));
      const allEnrollments = snapToArray(enrollmentsSnap.val() || {});
      const related = allEnrollments.filter(
        (e) => String(e.referralCode || "").toUpperCase() === matchedKey,
      );

      const verifiedCount = related.filter((e) => {
        const subs = e.submissions || {};
        const projects = Array.isArray(e.projects) ? e.projects : [];
        return (
          projects.length > 0 && projects.every((_, i) => subs[i]?.verified)
        );
      }).length;

      return {
        code: matchedKey,
        visited: Number(referral.visited || 0),
        assignedInternships: related.length,
        completedInterns: verifiedCount,
      };
    } catch (err) {
      console.warn("Error in fetchUserReferralStat:", err.message);
      return null;
    }
  }

  try {
    const data = await apiFetch("/api/admin-data");
    const referrals = data.data?.referrals || [];
    const matched = referrals.find(
      (r) =>
        String(r.email || "")
          .toLowerCase()
          .trim() === emailLower,
    );
    if (!matched) return null;
    return {
      code: matched.code || matched.id,
      visited: Number(matched.visited || 0),
      assignedInternships: Number(matched.assignedInternships || 0),
      completedInterns: 0,
    };
  } catch {
    return null;
  }
}

export async function fetchAdminReferralUsersWithInterns() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const [referralsSnap, enrollmentsSnap] = await Promise.all([
        get(ref(rtdb, "referrals")),
        get(ref(rtdb, "enrollments")),
      ]);

      const referrals = referralsSnap.exists() ? referralsSnap.val() : {};
      const allEnrollments = snapToArray(enrollmentsSnap.val() || {});

      return Object.entries(referrals).map(([code, refData]) => {
        const relatedEnrollments = allEnrollments.filter(
          (e) => String(e.referralCode || "").toUpperCase() === code,
        );
        return {
          code,
          name: refData.name || "",
          email: refData.email || "",
          phone: refData.phone || "",
          city: refData.city || "",
          upiId: refData.upiId || "",
          lastActivityAt:
            refData.lastActivityAt || refData.updatedAt || refData.createdAt,
          createdAt: refData.createdAt,
          internCount: relatedEnrollments.length,
          internIds: relatedEnrollments.map((e) => e.internId || e.id),
          interns: relatedEnrollments.map((e) => ({
            id: e.id,
            internId: e.internId || e.id,
            name: e.name || "",
            email: e.email || "",
            status: e.status || "Active",
            appliedAt: e.createdAt || e.appliedAt,
            completedAt: e.completedAt,
            paymentDate: e.paymentDate,
          })),
        };
      });
    } catch (err) {
      console.warn("Error in fetchAdminReferralUsersWithInterns:", err.message);
      return [];
    }
  }

  try {
    const data = await apiFetch("/api/admin-data");
    const referrals = data.data?.referrals || [];
    return referrals.map((r) => ({
      code: r.code || r.id,
      name: r.name || "",
      email: r.email || "",
      phone: r.phone || "",
      city: r.city || "",
      upiId: r.upiId || "",
      lastActivityAt: r.lastActivityAt || r.updatedAt || r.createdAt,
      createdAt: r.createdAt,
      internCount: Number(r.assignedInternships || 0),
      internIds: [],
      interns: [],
    }));
  } catch {
    return [];
  }
}

export async function savePermanentReferralCode(uid, code) {
  if (!uid || !code) return;
  if (isFirebaseConfigured && rtdb) {
    try {
      const userSnap = await get(
        ref(rtdb, `users/${uid}/permanentReferralCode`),
      );
      if (!userSnap.exists()) {
        await update(ref(rtdb, `users/${uid}`), {
          permanentReferralCode: code.toUpperCase(),
          permanentReferralDetectedAt: new Date().toISOString(),
        });
      }
    } catch {}
  }
}

export async function fetchPermanentReferralCode(uid) {
  if (!uid) return null;
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, `users/${uid}/permanentReferralCode`));
      if (snap.exists()) return snap.val();
    } catch {}
  }
  return null;
}

// ─── AI Task Verification ─────────────────────────────────────────────────────
export async function verifyTaskWithAI(params) {
  const { fetchCodeFromSubmission } = await import("../utils/aiVerify");
  let codeFiles = [];
  try {
    codeFiles = await fetchCodeFromSubmission(params.submissionText, params.submissionUrl);
  } catch (err) {
    console.warn('Failed to fetch code from submission:', err.message);
  }
  const paramsWithCode = { ...params, codeFiles };

  try {
    const data = await apiFetch('/api/ai/verify-task', {
      method: 'POST',
      body: JSON.stringify(paramsWithCode),
    });
    if (data.success && data.data) {
      return { success: true, data: { ...data.data, codeFilesCount: codeFiles.length, source: 'server-nvidia' } };
    }
  } catch (err) {
    console.warn('Server AI verification failed, falling back to browser:', err.message);
  }
  const { verifyTaskInBrowser } = await import("../utils/aiVerify");
  return verifyTaskInBrowser(paramsWithCode);
}

export async function fetchEarnSettings() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, "siteSettings/earn"));
      if (snap.exists()) return snap.val();
    } catch {}
  }
  return { rewardPerCompletion: 20, milestoneCount: 50, milestoneBonus: 1000 };
}

export async function saveEarnSettings(settings) {
  if (isFirebaseConfigured && rtdb) {
    await set(ref(rtdb, "siteSettings/earn"), settings);
    return;
  }
  // fallback: no-op for non-Firebase setups
}

// ─── Earn Details (admin-editable content) ────────────────────────────────────
export async function fetchEarnDetails() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, "siteSettings/earnDetails"));
      if (snap.exists()) return snap.val();
    } catch {}
  }
  return {
    title: "How Refer & Earn Works",
    description:
      "Share your unique referral link with friends and classmates. When they complete their internship you get paid.",
    items: [
      {
        title: "Apply Once",
        description:
          "Submit your UPI ID to get a unique referral code instantly.",
        links: "",
      },
      {
        title: "Share Your Link",
        description: "Share anywhere — WhatsApp, LinkedIn, or social media.",
        links: "",
      },
      {
        title: "Track Progress",
        description:
          "See who enrolled using your link and track completions in real time.",
        links: "",
      },
      {
        title: "Get Paid",
        description:
          "Earn ₹20 per completion + ₹1,000 bonus at 50 completions directly to your UPI.",
        links: "",
      },
    ],
  };
}

export async function saveEarnDetails(details) {
  if (isFirebaseConfigured && rtdb) {
    await set(ref(rtdb, "siteSettings/earnDetails"), details);
  }
}

// ─── Banned Users ──────────────────────────────────────────────────────────────
export async function fetchBannedUsers() {
  if (!isFirebaseConfigured || !rtdb) return [];
  try {
    const snap = await get(ref(rtdb, "bannedUsers"));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([key, val]) => ({
      ...val,
      id: key,
    }));
  } catch {
    return [];
  }
}

export async function checkUserBan(email) {
  if (!email || !isFirebaseConfigured || !rtdb) return null;
  try {
    const key = encodeEmail(email.toLowerCase().trim());
    const snap = await get(ref(rtdb, `bannedUsers/${key}`));
    if (snap.exists()) return snap.val();
  } catch {}
  return null;
}

export async function banUser(email, banType, reason, bannedBy) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  const key = encodeEmail(email.toLowerCase().trim());
  await set(ref(rtdb, `bannedUsers/${key}`), {
    email: email.toLowerCase().trim(),
    banType: banType || "both", // 'internship' | 'earn' | 'both'
    reason: reason || "",
    bannedAt: new Date().toISOString(),
    bannedBy: bannedBy || "",
  });
}

export async function unbanUser(email) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  const key = encodeEmail(email.toLowerCase().trim());
  await remove(ref(rtdb, `bannedUsers/${key}`));
}

// ─── Admin Messages ────────────────────────────────────────────────────────────
function messageMatchesUser(msg, userEmail) {
  if (msg.target === "all") return true;
  if (
    userEmail &&
    msg.target &&
    msg.target.toLowerCase() === userEmail.toLowerCase()
  )
    return true;
  return false;
}

function enrichMessageForAdmin(id, msg) {
  const acknowledgedBy = msg.acknowledgedBy || {};
  const ackList = Object.values(acknowledgedBy);
  const targetCount =
    msg.target && msg.target !== "all" ? 1 : null;
  return {
    ...msg,
    id,
    acknowledgedBy,
    acknowledgedCount: ackList.length,
    targetCount,
    pendingCount:
      msg.requireAck && targetCount !== null
        ? Math.max(0, targetCount - ackList.length)
        : null,
    remainingUsers:
      msg.requireAck && msg.target && msg.target !== "all" && ackList.length === 0
        ? [msg.target]
        : msg.requireAck && msg.target && msg.target !== "all" && ackList.length > 0
          ? []
          : null,
  };
}

export async function fetchAdminMessages(userEmail, { context, uid } = {}) {
  if (!isFirebaseConfigured || !rtdb) return [];
  try {
    const snap = await get(ref(rtdb, "adminMessages"));
    if (!snap.exists()) return [];
    const now = new Date();
    return Object.entries(snap.val())
      .map(([id, msg]) => ({ ...msg, id }))
      .filter((msg) => {
        if (msg.expiresAt && new Date(msg.expiresAt) < now) return false;
        if (!messageMatchesUser(msg, userEmail)) return false;
        if (context && msg.context && msg.context !== context) return false;
        if (uid && msg.acknowledgedBy?.[uid]) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch {
    return [];
  }
}

export async function fetchAllAdminMessages() {
  if (!isFirebaseConfigured || !rtdb) return [];
  try {
    const snap = await get(ref(rtdb, "adminMessages"));
    if (!snap.exists()) return [];
    return Object.entries(snap.val())
      .map(([id, msg]) => enrichMessageForAdmin(id, msg))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch {
    return [];
  }
}

export async function saveAdminMessage(message) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  const msgRef = push(ref(rtdb, "adminMessages"));
  const payload = {
    ...message,
    createdAt: new Date().toISOString(),
    acknowledgedBy: {},
  };
  if (!payload.expiresAt) delete payload.expiresAt;
  await set(msgRef, payload);
  return msgRef.key;
}

export async function acknowledgeAdminMessage(messageId, uid, userInfo = {}) {
  if (!messageId || !uid) return;
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  await update(ref(rtdb, `adminMessages/${messageId}/acknowledgedBy/${uid}`), {
    uid,
    email: userInfo.email || "",
    name: userInfo.name || "",
    acknowledgedAt: new Date().toISOString(),
  });
}

export async function deleteAdminMessage(id) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  await remove(ref(rtdb, `adminMessages/${id}`));
}

// ─── Site Notices (always-visible notice box) ─────────────────────────────────
export async function saveSiteNotice(notice) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  const noticeRef = push(ref(rtdb, "siteNotices"));
  await set(noticeRef, {
    ...notice,
    createdAt: new Date().toISOString(),
    active: true,
  });
  return noticeRef.key;
}

export async function fetchSiteNotices() {
  if (!isFirebaseConfigured || !rtdb) return [];
  try {
    const snap = await get(ref(rtdb, "siteNotices"));
    if (!snap.exists()) return [];
    return Object.entries(snap.val())
      .map(([id, n]) => ({ ...n, id }))
      .filter((n) => n.active !== false)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch { return []; }
}

export async function toggleSiteNotice(id, active) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  await update(ref(rtdb, `siteNotices/${id}`), { active });
}

export async function deleteSiteNotice(id) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  await remove(ref(rtdb, `siteNotices/${id}`));
}

// ─── Homepage Content (headline, description, buttons) ─────────────────────
export async function fetchHomepageContent() {
  if (!isFirebaseConfigured || !rtdb) {
    return {
      headline: "Kickstart Your Developer Career with Virtual Internships.",
      description: "Gain hands-on software engineering experience, build real production-grade code, and receive verified completion credentials. Self-paced, industry-aligned, and 100% virtual.",
      buttons: [
        { label: "Apply Internship", action: "apply", enabled: true },
        { label: "Explore Domains", action: "explore", enabled: true },
      ],
      badges: [
        { label: "✦ 100% FREE INTERNSHIP" },
        { label: "✦ BEST INTERNSHIP FOR COLLEGE STUDENTS" },
      ],
      features: [
        { icon: "✓", label: "Verified Program" },
        { icon: "✓", label: "Instant Offer Letter" },
        { icon: "✓", label: "100% Virtual" },
      ],
    };
  }
  try {
    const snap = await get(ref(rtdb, "siteContent/homepage"));
    if (snap.exists()) return snap.val();
    return {
      headline: "Kickstart Your Developer Career with Virtual Internships.",
      description: "Gain hands-on software engineering experience, build real production-grade code, and receive verified completion credentials. Self-paced, industry-aligned, and 100% virtual.",
      buttons: [
        { label: "Apply Internship", action: "apply", enabled: true },
        { label: "Explore Domains", action: "explore", enabled: true },
      ],
      badges: [
        { label: "✦ 100% FREE INTERNSHIP" },
        { label: "✦ BEST INTERNSHIP FOR COLLEGE STUDENTS" },
      ],
      features: [
        { icon: "✓", label: "Verified Program" },
        { icon: "✓", label: "Instant Offer Letter" },
        { icon: "✓", label: "100% Virtual" },
      ],
    };
  } catch { return null; }
}

export async function saveHomepageContent(content) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  await set(ref(rtdb, "siteContent/homepage"), {
    ...content,
    updatedAt: new Date().toISOString(),
  });
}

// ─── Referral User Achievement ────────────────────────────────────────────────
export async function markReferralAchieved(referralCode, achieved) {
  if (!referralCode) return;
  const code = referralCode.toUpperCase();
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  if (achieved) {
    await update(ref(rtdb, `referrals/${code}`), {
      achieved: true,
      achievedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    await update(ref(rtdb, `referrals/${code}`), {
      achieved: false,
      updatedAt: new Date().toISOString(),
    });
  }
}

// ─── Enrollment Completion Verification ──────────────────────────────────────
export async function markEnrollmentComplete(enrollmentId) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  await update(ref(rtdb, `enrollments/${enrollmentId}`), {
    status: "Completed",
    allowedCertificate: "yes",
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function rejectEnrollmentCompletion(enrollmentId, reason) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  await update(ref(rtdb, `enrollments/${enrollmentId}`), {
    completionRejectedAt: new Date().toISOString(),
    completionRejectReason: reason || "",
    updatedAt: new Date().toISOString(),
  });
}

export async function clearCompletionRejection(enrollmentId) {
  if (!isFirebaseConfigured || !rtdb)
    throw new Error("Firebase not configured.");
  await update(ref(rtdb, `enrollments/${enrollmentId}`), {
    completionRejectedAt: null,
    completionRejectReason: null,
    updatedAt: new Date().toISOString(),
  });
}

// ─── Check & auto-unachieve referral if activity after achievedAt ────────────
export async function autoUnachieveIfActivity(referralCode) {
  if (!referralCode) return;
  const code = referralCode.toUpperCase();
  if (!isFirebaseConfigured || !rtdb) return;
  try {
    const snap = await get(ref(rtdb, `referrals/${code}`));
    if (!snap.exists()) return;
    const data = snap.val();
    if (!data.achieved || !data.achievedAt) return;
    const achievedAt = new Date(data.achievedAt).getTime();
    const updatedAt = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    if (updatedAt > achievedAt) {
      await update(ref(rtdb, `referrals/${code}`), {
        achieved: false,
        autoUnachievedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return true; // was unachieved
    }
  } catch (err) {
    console.warn("autoUnachieveIfActivity error:", err.message);
  }
  return false;
}

// ─── General Site Visit Tracking ─────────────────────────────────────────────
export async function trackSiteVisit(user) {
  if (!isFirebaseConfigured || !rtdb) return;
  try {
    const visitRef = push(ref(rtdb, "siteVisits"));
    const visitData = {
      visitedAt: new Date().toISOString(),
      userAgent: navigator.userAgent || "",
      language: navigator.language || "",
      referrer: document.referrer || "",
      url: window.location.href || "",
      screen: `${window.screen?.width || "?"}x${window.screen?.height || "?"}`,
      viewport: `${window.innerWidth || "?"}x${window.innerHeight || "?"}`,
    };
    if (user && user.uid) {
      visitData.uid = user.uid;
      visitData.email = user.email || "";
      visitData.name = user.displayName || "";
    }
    await set(visitRef, visitData);
  } catch (err) {
    console.warn("trackSiteVisit error:", err.message);
  }
}
