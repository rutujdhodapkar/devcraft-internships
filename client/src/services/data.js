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
} from 'firebase/database';
import { rtdb, isFirebaseConfigured } from '../firebase';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const encodeEmail = (email) => email.toLowerCase().trim().replace(/\./g, ',');
const decodeEmail = (key) => key.replace(/,/g, '.');

const API_BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Request failed.');
  }
  return data;
}

function snapToArray(val) {
  if (!val) return [];
  return Object.entries(val).map(([id, data]) => ({ id, ...data }));
}

/** Generate a stable readable intern ID per user like dev-craft-AB3X9ZKQ */
function generateInternId(uid = '') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const source = String(uid || 'anonymous-user');
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
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Number(value % BigInt(chars.length))];
    value /= BigInt(chars.length);
  }
  return `dev-craft-${result}`;
}

// ─── Default Career Paths ──────────────────────────────────────────────────────
const DEFAULT_CAREER_PATHS = [
  {
    id: 'path_python',
    title: 'Python Development',
    duration: '4 Weeks',
    description: 'Gain hands-on software development experience with Python scripting, data structures, and backends.',
    features: ['Basic Python syntax & scripting', 'OOP & Data structures', 'Flask & Django web development', 'Final capstone project'],
    projects: ['Personal Portfolio Website', 'Weather Web App', 'Task Manager API'],
  },
  {
    id: 'path_java',
    title: 'Java Development',
    duration: '4 Weeks',
    description: 'Build enterprise-ready applications using Java Core, Spring Boot microservices, and databases.',
    features: ['Java Core & JVM concepts', 'OOP & Interface Design', 'Spring Boot microservices', 'Database integration & SQL'],
    projects: ['Library Management System', 'REST API Backend', 'Student Registry Platform'],
  },
  {
    id: 'path_web',
    title: 'Web Development',
    duration: '4 Weeks',
    description: 'Learn to design and deploy modern, responsive frontend user interfaces using React.js and CSS.',
    features: ['HTML5 & CSS3 layout systems', 'JavaScript ES6+ fundamentals', 'React.js frontend frameworks', 'State management & deployment'],
    projects: ['Responsive Portfolio', 'Interactive Quiz App', 'Admin Dashboard UI'],
  }
];

// ─── Default How It Works steps ─────────────────────────────────────────────────
const DEFAULT_HOW_IT_WORKS = [
  { id: 'step_1', step: 1, title: 'Select Domain', description: 'Browse our available career paths and select your preferred domain.' },
  { id: 'step_2', step: 2, title: 'Instant Offer Letter', description: 'Log in with Google, fill in your profile, and receive your official offer letter instantly.' },
  { id: 'step_3', step: 3, title: 'Complete Projects', description: 'Work through structured real-world tasks and submit them.' },
  { id: 'step_4', step: 4, title: 'Get Certified', description: 'Once verified, download your industry-ready internship completion certificate.' }
];

// ─── Default FAQs ────────────────────────────────────────────────────────────────
const DEFAULT_FAQS = [
  { id: 'faq_1', question: 'Are the internships really 100% free?', answer: 'Yes, all our virtual internships are 100% free of cost. There are no hidden fees or charges for learning and certification.' },
  { id: 'faq_2', question: 'Who is eligible to apply?', answer: 'Any college student or self-taught learner looking to gain practical software development and coding experience is welcome to apply.' },
  { id: 'faq_3', question: 'How will my internship progress be tracked?', answer: 'You will work on self-paced projects. Once you complete the projects, you submit them through the student area, and the team will verify your completion.' },
  { id: 'faq_4', question: 'Is the certificate verified?', answer: 'Yes, every certificate has a unique ID and can be verified publicly on our website through the verify button.' }
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
      const snap = await get(ref(rtdb, 'careerPaths'));
      if (snap.exists()) {
        return snapToArray(snap.val());
      }
    } catch (err) {
      console.warn('Could not fetch career paths from RTDB:', err.message);
    }
  }
  return DEFAULT_CAREER_PATHS;
}

export async function saveCareerPaths(paths) {
  if (isFirebaseConfigured && rtdb) {
    const dataMap = {};
    paths.forEach(p => {
      const id = p.id || push(ref(rtdb, 'careerPaths')).key;
      dataMap[id] = { ...p, id };
    });
    await set(ref(rtdb, 'careerPaths'), dataMap);
    return;
  }
  throw new Error('Firebase RTDB is not configured.');
}

// ─── Fetch / Save How It Works ─────────────────────────────────────────────────
export async function fetchHowItWorks() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, 'howItWorks'));
      if (snap.exists()) {
        return snapToArray(snap.val()).sort((a, b) => (a.step || 0) - (b.step || 0));
      }
    } catch (err) {
      console.warn('Could not fetch howItWorks from RTDB:', err.message);
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
    await set(ref(rtdb, 'howItWorks'), dataMap);
    return;
  }
  throw new Error('Firebase RTDB is not configured.');
}

// ─── Fetch / Save FAQs ─────────────────────────────────────────────────────────
export async function fetchFAQs() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, 'faqs'));
      if (snap.exists()) {
        return snapToArray(snap.val());
      }
    } catch (err) {
      console.warn('Could not fetch FAQs from RTDB:', err.message);
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
    await set(ref(rtdb, 'faqs'), dataMap);
    return;
  }
  throw new Error('Firebase RTDB is not configured.');
}

// ─── Fetch / Save HTML Templates ────────────────────────────────────────────────
export async function fetchTemplates() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, 'config/templates'));
      if (snap.exists()) {
        const data = snap.val();
        return {
          offer_letter: data.offer_letter || DEFAULT_OFFER_LETTER_TEMPLATE,
          certificate: data.certificate || DEFAULT_CERTIFICATE_TEMPLATE
        };
      }
    } catch (err) {
      console.warn('Could not fetch templates from RTDB:', err.message);
    }
  }
  return {
    offer_letter: DEFAULT_OFFER_LETTER_TEMPLATE,
    certificate: DEFAULT_CERTIFICATE_TEMPLATE
  };
}

export async function saveTemplates(templates) {
  if (isFirebaseConfigured && rtdb) {
    await set(ref(rtdb, 'config/templates'), templates);
    return;
  }
  throw new Error('Firebase RTDB is not configured.');
}

// ─── Fetch / Save About Content ─────────────────────────────────────────────────
export async function fetchAboutText() {
  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, 'config/aboutText'));
      if (snap.exists()) return snap.val();
    } catch (err) {
      console.warn('Could not fetch aboutText:', err.message);
    }
  }
  return "DevCraft provides top-tier 100% free virtual internships for university and college students. Gain verified work experience, finish structured programming projects, and receive certified validation for your software engineering credentials.";
}

export async function saveAboutText(text) {
  if (isFirebaseConfigured && rtdb) {
    await set(ref(rtdb, 'config/aboutText'), text);
    return;
  }
  throw new Error('Firebase RTDB is not configured.');
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
    const duplicate = existing.find((e) => (
      e.domainId === domainObj.id ||
      (e.domain || '').toLowerCase() === (domainObj.title || '').toLowerCase()
    ));
    if (duplicate) {
      return duplicate;
    }

    if (profile.email) {
      const referralsSnap = await get(ref(rtdb, 'referrals'));
      let hasReferral = false;
      if (referralsSnap.exists()) {
        const allRefs = snapToArray(referralsSnap.val());
        hasReferral = allRefs.some(r => r.email === profile.email);
      }
      if (!hasReferral) {
        await createReferral({
          name: profile.name || profile.displayName || '',
          email: profile.email,
          phone: profile.phone || '',
          city: profile.city || ''
        });
      }
    }

    const newRef = push(ref(rtdb, 'enrollments'));
    const enrollmentId = newRef.key;

    // Check localStorage for referral code (only set if matched)
    const refCode = localStorage.getItem('detected_referral_code') || '';
    if (refCode) localStorage.removeItem('detected_referral_code');

    // Generate a human-readable intern ID
    const internId = generateInternId(uid);

    const enrollment = {
      id: enrollmentId,
      internId,
      uid,
      name: profile.name || profile.displayName || '',
      email: profile.email || '',
      phone: profile.phone || '',
      college: profile.college || '',
      city: profile.city || '',
      country: profile.country || '',
      domainId: domainObj.id,
      domain: domainObj.title,
      duration: domainObj.duration || '4 Weeks',
      projects: domainObj.projects || [],
      status: 'Active', // 'Active', 'Completed'
      submissions: {},   // { [projectIndex]: { text, submittedAt, verified, verifiedAt } }
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      referralCode: refCode
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
        console.warn('Could not update referral enrollment statistics:', err.message);
      }
    }

    return enrollment;
  }
  throw new Error('Firebase RTDB is not configured.');
}

export async function fetchEnrollments() {
  if (isFirebaseConfigured && rtdb) {
    const snap = await get(ref(rtdb, 'enrollments'));
    return snap.exists() ? snapToArray(snap.val()) : [];
  }
  return [];
}

export async function fetchUserEnrollments(uid) {
  if (isFirebaseConfigured && rtdb) {
    const all = await fetchEnrollments();
    const userEnrollments = all.filter(e => e.uid === uid);
    const stableInternId = generateInternId(uid);
    await Promise.all(userEnrollments
      .filter(e => e.internId !== stableInternId)
      .map(e => update(ref(rtdb, `enrollments/${e.id}`), {
        internId: stableInternId,
        updatedAt: new Date().toISOString(),
      }).catch(() => null))
    );
    return userEnrollments.map(e => ({ ...e, internId: stableInternId }));
  }
  return [];
}

export async function updateEnrollmentStatus(enrollmentId, status) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      status,
      updatedAt: new Date().toISOString()
    });
  }
}

export async function submitTransactionId(enrollmentId, transactionId) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      transactionId,
      updatedAt: new Date().toISOString()
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
      name: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      referralCode: code,
      lastLoginAt: new Date().toISOString(),
    };

    await set(loginRef, loginSnap.exists() ? { ...loginSnap.val(), ...payload } : {
      ...payload,
      firstLoginAt: new Date().toISOString(),
    });

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
      updatedAt: new Date().toISOString()
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
    return all.find(e => e.internId === enrollmentId) || null;
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
export async function submitProject(enrollmentId, projectIndex, submissionText) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `enrollments/${enrollmentId}/submissions/${projectIndex}`), {
      text: submissionText,
      submittedAt: new Date().toISOString(),
      verified: false,
      verifiedAt: null,
      resubmit: false, // clear resubmit flag
    });
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  throw new Error('Firebase RTDB is not configured.');
}

/**
 * Admin verifies a submitted project.
 * @param {string} enrollmentId
 * @param {number} projectIndex
 */
export async function verifyProject(enrollmentId, projectIndex) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `enrollments/${enrollmentId}/submissions/${projectIndex}`), {
      verified: true,
      verifiedAt: new Date().toISOString(),
    });
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  throw new Error('Firebase RTDB is not configured.');
}

export async function saveProjectFeedback(enrollmentId, projectIndex, feedback) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `enrollments/${enrollmentId}/submissions/${projectIndex}`), {
      feedback,
      feedbackAt: new Date().toISOString(),
    });
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  throw new Error('Firebase RTDB is not configured.');
}

export async function rejectProject(enrollmentId, projectIndex, feedback) {
  if (isFirebaseConfigured && rtdb) {
    await update(ref(rtdb, `enrollments/${enrollmentId}/submissions/${projectIndex}`), {
      verified: false,
      resubmit: true,
      feedback,
      rejectedAt: new Date().toISOString(),
      submittedAt: null, // clear submittedAt so they can submit again
    });
    await update(ref(rtdb, `enrollments/${enrollmentId}`), {
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  throw new Error('Firebase RTDB is not configured.');
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
    const [referralsSnap, visitsSnap, enrollmentsSnap, referralUsersSnap] = await Promise.all([
      get(ref(rtdb, 'referrals')),
      get(ref(rtdb, 'referralVisits')),
      get(ref(rtdb, 'enrollments')),
      get(ref(rtdb, 'referralUsers')),
    ]);

    const enrollments = snapToArray(enrollmentsSnap.val()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    const referralUsers = referralUsersSnap.val() || {};
    const completionInfo = (enrollment) => {
      const projects = Array.isArray(enrollment.projects) ? enrollment.projects : [];
      const submissions = enrollment.submissions || {};
      const verifiedCount = projects.filter((_, i) => submissions[i]?.verified).length;
      return {
        total: projects.length,
        verified: verifiedCount,
        completed: projects.length > 0 && verifiedCount === projects.length,
      };
    };

    const referrals = snapToArray(referralsSnap.val()).map((referral) => {
      const code = String(referral.code || referral.id || '').toUpperCase();
      const loginUsers = Object.values(referralUsers[code] || {});
      const relatedEnrollments = enrollments.filter(e => String(e.referralCode || '').toUpperCase() === code);
      const loginUidSet = new Set(loginUsers.map(u => u.uid).filter(Boolean));
      relatedEnrollments.forEach(e => {
        if (e.uid) loginUidSet.add(e.uid);
      });
      const assigned = relatedEnrollments;
      const completed = relatedEnrollments.filter(e => {
        const info = completionInfo(e);
        return info.completed;
      });
      const completedNotPaid = relatedEnrollments.filter(e => {
        const info = completionInfo(e);
        return info.completed && e.allowedCertificate !== 'yes';
      });
      const completedAndPaid = relatedEnrollments.filter(e => e.allowedCertificate === 'yes');
      const internIds = (rows) => rows.map(e => e.internId || e.id).filter(Boolean);

      return {
        ...referral,
        code,
        totalLogined: loginUidSet.size,
        visited: Number(referral.visited || 0),
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
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const visits = snapToArray(visitsSnap.val())
      .sort((a, b) => (b.visitedAt || '').localeCompare(a.visitedAt || ''))
      .slice(0, 200);

    return { requests: enrollments, referrals, visits };
  }

  const data = await apiFetch('/api/admin-data');
  return { requests: data.data.requests || [], referrals: data.data.referrals || [], visits: data.data.visits || [] };
}

// ─── Referral Creation ─────────────────────────────────────────────────────────
export async function isReferralCodeMatched(referralCode) {
  const code = String(referralCode || '').trim().toUpperCase();
  if (!code) return false;

  if (isFirebaseConfigured && rtdb) {
    const snap = await get(ref(rtdb, `referrals/${code}`));
    return snap.exists();
  }

  try {
    const data = await apiFetch('/api/admin-data');
    const referrals = data.data?.referrals || [];
    return referrals.some((item) => String(item.code || item.id || '').toUpperCase() === code);
  } catch {
    return false;
  }
}

export const PAYMENT_QR_DEFAULT = 'https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR.png';
export const PAYMENT_QR_REFERRAL = 'https://raw.githubusercontent.com/rutujdhodapkar/Image-Hosting/main/GooglePay_QR(1).png';

// ─── Referral / Enrollment Deletion ──────────────────────────────────────────
export async function deleteReferral(code) {
  if (!code) throw new Error('Referral code is required.');
  const normalizedCode = code.toUpperCase();

  if (isFirebaseConfigured && rtdb) {
    await remove(ref(rtdb, `referrals/${normalizedCode}`));
    // Clean up related data
    try { await remove(ref(rtdb, `referralUsers/${normalizedCode}`)); } catch {}
    return;
  }

  await apiFetch(`/api/referrals/${encodeURIComponent(normalizedCode)}`, {
    method: 'DELETE',
  });
}

export async function deleteEnrollment(enrollmentId) {
  if (!enrollmentId) throw new Error('Enrollment ID is required.');

  if (isFirebaseConfigured && rtdb) {
    await remove(ref(rtdb, `enrollments/${enrollmentId}`));
    return;
  }

  await apiFetch(`/api/inquiries/${encodeURIComponent(enrollmentId)}`, {
    method: 'DELETE',
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

  const data = await apiFetch('/api/referrals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.data;
}

// ─── Referral Visit Tracking ───────────────────────────────────────────────────
export async function trackReferralVisit(referralCode) {
  if (!referralCode) return null;

  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.indexOf('Windows') !== -1) os = 'Windows';
  else if (ua.indexOf('Macintosh') !== -1) os = 'MacOS';
  else if (ua.indexOf('Linux') !== -1) os = 'Linux';
  else if (ua.indexOf('Android') !== -1) os = 'Android';
  else if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) os = 'iOS';

  const cores = navigator.hardwareConcurrency || 'Unknown';
  const memory = navigator.deviceMemory || 'Unknown';

  let connectionType = 'Unknown', downlink = 'Unknown', rtt = 'Unknown';
  if (navigator.connection) {
    connectionType = navigator.connection.effectiveType || 'Unknown';
    downlink = navigator.connection.downlink || 'Unknown';
    rtt = navigator.connection.rtt || 'Unknown';
  }

  const normalizedCode = referralCode.toUpperCase();
  const sessionVisitKey = `referral_visit_${normalizedCode}`;
  if (sessionStorage.getItem(sessionVisitKey)) return null;

  const visitBase = {
    referralCode: normalizedCode,
    browser: ua.substring(0, 200),
    os,
    hardware: `Cores: ${cores}, RAM: ${memory}GB`,
    network: `Type: ${connectionType}, Downlink: ${downlink}Mbps, RTT: ${rtt}ms`,
    device: getDeviceType(),
    language: navigator.language,
    link: window.location.href,
    visitedAt: new Date().toISOString(),
    ip: 'Unknown',
    country: 'Unknown',
    city: 'Unknown',
    region: 'Unknown',
    isp: 'Unknown',
    action: 'visited',
    matched: false,
  };

  if (isFirebaseConfigured && rtdb) {
    const referralRef = ref(rtdb, `referrals/${normalizedCode}`);
    const visitRef = push(ref(rtdb, 'referralVisits'));
    visitBase.visitId = visitRef.key;

    const [referralSnap] = await Promise.all([
      get(referralRef),
      set(visitRef, visitBase),
    ]);

    const matched = referralSnap.exists();
    visitBase.matched = matched;

    const patchVisit = update(visitRef, { matched });
    const counterUpdates = matched
      ? update(referralRef, {
          visited: increment(1),
          lastVisitedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      : Promise.resolve();

    const patchGeo = async () => {
      let geo = {};
      try {
        const geoRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
        if (geoRes.ok) {
          const g = await geoRes.json();
          geo = { ip: g.ip || 'Unknown', country: g.country_name || g.country || 'Unknown', city: g.city || 'Unknown', region: g.region || 'Unknown', isp: g.org || 'Unknown' };
        }
      } catch {
        try {
          const geoRes2 = await fetch('https://ip-api.com/json/', { signal: AbortSignal.timeout(4000) });
          if (geoRes2.ok) {
            const g2 = await geoRes2.json();
            geo = { ip: g2.query || 'Unknown', country: g2.country || 'Unknown', city: g2.city || 'Unknown', region: g2.regionName || 'Unknown', isp: g2.isp || 'Unknown' };
          }
        } catch { /* ignore */ }
      }
      if (Object.keys(geo).length > 0) {
        try { await update(visitRef, geo); } catch { /* ignore */ }
      }
    };

    Promise.all([patchVisit, counterUpdates, patchGeo()]).catch(() => {});
    sessionStorage.setItem(sessionVisitKey, visitRef.key);
    return { ...visitBase };
  }

  try {
    const geoRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (geoRes.ok) {
      const g = await geoRes.json();
      visitBase.ip = g.ip || 'Unknown';
      visitBase.country = g.country_name || g.country || 'Unknown';
      visitBase.city = g.city || 'Unknown';
      visitBase.region = g.region || 'Unknown';
      visitBase.isp = g.org || 'Unknown';
    }
  } catch { /* ignore */ }

  const data = await apiFetch('/api/referral-visits', {
    method: 'POST',
    body: JSON.stringify(visitBase),
  });
  return data.data;
}

/**
 * Read referral code from URL, persist to localStorage, track the visit, and return status.
 * Called once on app mount from App.jsx.
 */
export async function processReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('ref') || '').trim().toUpperCase();
  if (!code) {
    localStorage.removeItem('detected_referral_code');
    return { code: '', matched: false };
  }

  // Track the visit (deduplicated via sessionStorage)
  try {
    await trackReferralVisit(code);
  } catch { /* silent */ }

  // Independently check if this referral code matches an existing referral
  const matched = await isReferralCodeMatched(code);
  if (matched) {
    localStorage.setItem('detected_referral_code', code);
  } else {
    localStorage.removeItem('detected_referral_code');
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

  await apiFetch(`/api/referrals/${code}/contacted`, { method: 'POST' });
}

// ─── User Referral Stats ────────────────────────────────────────────────────────
export async function fetchUserReferralStat(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();

  if (isFirebaseConfigured && rtdb) {
    const referralsSnap = await get(ref(rtdb, 'referrals'));
    let userReferral = null;
    if (referralsSnap.exists()) {
      const allRefs = snapToArray(referralsSnap.val());
      userReferral = allRefs.find(r => r.email?.toLowerCase().trim() === cleanEmail);
    }
    if (!userReferral) return null;

    const code = String(userReferral.code || userReferral.id || '').toUpperCase();
    
    const enrollmentsSnap = await get(ref(rtdb, 'enrollments'));
    let assignedCount = 0;
    let completedCount = 0;

    if (enrollmentsSnap.exists()) {
      const allEnrollments = snapToArray(enrollmentsSnap.val());
      const relatedEnrollments = allEnrollments.filter(e => String(e.referralCode || '').toUpperCase() === code);
      
      assignedCount = relatedEnrollments.length;
      completedCount = relatedEnrollments.filter(e => {
        const projects = Array.isArray(e.projects) ? e.projects : [];
        const submissions = e.submissions || {};
        const verifiedCount = projects.filter((_, i) => submissions[i]?.verified).length;
        return projects.length > 0 && verifiedCount === projects.length;
      }).length;
    }

    return {
      ...userReferral,
      code,
      visited: Number(userReferral.visited || 0),
      assignedInternships: assignedCount,
      completedInterns: completedCount,
    };
  }
  return null;
}

// ─── Admin Management ──────────────────────────────────────────────────────────
export async function checkAdminStatus(email) {
  if (!email) return { isAdmin: false };
  const root = 'rutujdhodapkar@gmail.com';
  if (email.toLowerCase().trim() === root) return { isAdmin: true };

  if (isFirebaseConfigured && rtdb) {
    try {
      const snap = await get(ref(rtdb, `admins/${encodeEmail(email)}`));
      return { isAdmin: snap.exists() };
    } catch {
      return { isAdmin: false };
    }
  }

  return await apiFetch('/api/check-admin', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function fetchAdmins() {
  if (isFirebaseConfigured && rtdb) {
    const snap = await get(ref(rtdb, 'admins'));
    if (!snap.exists()) return [];
    return Object.keys(snap.val()).map(decodeEmail);
  }

  const res = await apiFetch('/api/admins');
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

  await apiFetch('/api/admins', {
    method: 'POST',
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
    method: 'DELETE',
  });
}

function getDeviceType() {
  const width = window.innerWidth;
  if (/Mobi|Android/i.test(navigator.userAgent) || width < 768) return 'Mobile';
  if (/Tablet|iPad/i.test(navigator.userAgent) || width < 1100) return 'Tablet';
  return 'Desktop';
}
