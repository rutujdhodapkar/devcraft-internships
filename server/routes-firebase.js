import { fbRtdb } from "./firebase.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const encodeEmail = (email) => (email || "").toLowerCase().trim().replace(/\./g, ",");
const decodeEmail = (key) => key.replace(/,/g, ".");

function snapToArray(snapshot) {
  if (!snapshot || !snapshot.val()) return [];
  const data = snapshot.val();
  return Object.keys(data).map((id) => ({ id, ...data[id] }));
}

function ref(path) {
  if (!fbRtdb) throw new Error("Firebase not initialized");
  return fbRtdb.ref(path);
}

async function getSnapshot(path) {
  const snap = await ref(path).once("value");
  return snap;
}

async function setData(path, data) {
  await ref(path).set(data);
}

async function updateData(path, data) {
  await ref(path).update(data);
}

async function pushData(path, data) {
  const newRef = ref(path).push();
  await newRef.set(data);
  return newRef.key;
}

async function removeData(path) {
  await ref(path).remove();
}

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

// ─── Register all Firebase routes ────────────────────────────────────────────
export default function registerFirebaseRoutes(app) {
  // Middleware: ensure Firebase is initialized
  app.use("/api/fb", (req, res, next) => {
    if (!fbRtdb) {
      return res.status(503).json({ success: false, message: "Firebase Admin not configured on server. Add FIREBASE_SERVICE_ACCOUNT_KEY to env." });
    }
    next();
  });

  // ── Career Paths ───────────────────────────────────────────────────────────
  app.get("/api/fb/career-paths", async (req, res) => {
    try {
      const snap = await getSnapshot("careerPaths");
      res.json({ success: true, data: snapToArray(snap) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/fb/career-paths", async (req, res) => {
    try {
      const dataMap = {};
      (req.body || []).forEach((p) => {
        const id = p.id || `path_${Date.now()}`;
        dataMap[id] = { ...p, id };
      });
      await setData("careerPaths", dataMap);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── How It Works ───────────────────────────────────────────────────────────
  app.get("/api/fb/how-it-works", async (req, res) => {
    try {
      const snap = await getSnapshot("howItWorks");
      res.json({ success: true, data: snapToArray(snap) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/fb/how-it-works", async (req, res) => {
    try {
      const dataMap = {};
      (req.body || []).forEach((step, idx) => {
        const id = step.id || `step_${idx + 1}`;
        dataMap[id] = { ...step, id, step: Number(step.step) || idx + 1 };
      });
      await setData("howItWorks", dataMap);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── FAQs ──────────────────────────────────────────────────────────────────
  app.get("/api/fb/faqs", async (req, res) => {
    try {
      const snap = await getSnapshot("faqs");
      res.json({ success: true, data: snapToArray(snap) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/fb/faqs", async (req, res) => {
    try {
      const dataMap = {};
      (req.body || []).forEach((f, idx) => {
        const id = f.id || `faq_${idx + 1}`;
        dataMap[id] = { ...f, id };
      });
      await setData("faqs", dataMap);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── HTML Templates ─────────────────────────────────────────────────────────
  app.get("/api/fb/templates", async (req, res) => {
    try {
      const snap = await getSnapshot("config/templates");
      res.json({ success: true, data: snap.val() || {} });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/fb/templates", async (req, res) => {
    try {
      await setData("config/templates", req.body || {});
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── About Text ────────────────────────────────────────────────────────────
  app.get("/api/fb/about", async (req, res) => {
    try {
      const snap = await getSnapshot("config/aboutText");
      res.json({ success: true, data: snap.val() || "" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/fb/about", async (req, res) => {
    try {
      await setData("config/aboutText", req.body.text || "");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── User Profile ──────────────────────────────────────────────────────────
  app.get("/api/fb/users/:uid/profile", async (req, res) => {
    try {
      const snap = await getSnapshot(`users/${req.params.uid}`);
      res.json({ success: true, data: snap.val() || null });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/fb/users/:uid/profile", async (req, res) => {
    try {
      await updateData(`users/${req.params.uid}`, {
        ...req.body,
        updatedAt: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Enrollments ──────────────────────────────────────────────────────────
  app.get("/api/fb/enrollments", async (req, res) => {
    try {
      const snap = await getSnapshot("enrollments");
      res.json({ success: true, data: snapToArray(snap) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/fb/enrollments/:id", async (req, res) => {
    try {
      const snap = await getSnapshot(`enrollments/${req.params.id}`);
      res.json({ success: true, data: snap.val() || null });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/enrollments", async (req, res) => {
    try {
      const { uid, profile, domainObj } = req.body;
      if (!uid || !profile || !domainObj) {
        return res.status(400).json({ success: false, message: "Missing uid, profile, or domainObj" });
      }

      // Check for duplicate
      const allSnap = await getSnapshot("enrollments");
      const existing = snapToArray(allSnap).filter((e) => e.uid === uid);
      const duplicate = existing.find(
        (e) => e.domainId === domainObj.id || (e.domain || "").toLowerCase() === (domainObj.title || "").toLowerCase(),
      );
      if (duplicate) {
        return res.json({ success: true, data: duplicate });
      }

      const enrollmentId = ref("enrollments").push().key;
      const internId = generateInternId(uid);
      const refCode = req.body.referralCode || "";

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
        status: "Active",
        submissions: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        referralCode: refCode,
      };

      await setData(`enrollments/${enrollmentId}`, enrollment);

      // Update referral stats if code exists
      if (refCode) {
        try {
          const refSnap = await getSnapshot(`referrals/${refCode.toUpperCase()}`);
          if (refSnap.exists()) {
            await ref(`referrals/${refCode.toUpperCase()}`).update({
              selected: (refSnap.val().selected || 0) + 1,
              lastSelectedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch {}
      }

      res.json({ success: true, data: enrollment });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.patch("/api/fb/enrollments/:id", async (req, res) => {
    try {
      await updateData(`enrollments/${req.params.id}`, {
        ...req.body,
        updatedAt: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/fb/enrollments/:id", async (req, res) => {
    try {
      await removeData(`enrollments/${req.params.id}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Submissions ──────────────────────────────────────────────────────────
  app.post("/api/fb/enrollments/:id/submissions/:projectIndex", async (req, res) => {
    try {
      const { text } = req.body;
      const updateObj = {
        text,
        submittedAt: new Date().toISOString(),
        verified: false,
        verifiedAt: null,
        resubmit: false,
      };
      if (req.body.quizAnswers) {
        updateObj.quizAnswers = req.body.quizAnswers;
        updateObj.quizResults = req.body.quizResults;
        updateObj.quizScore = req.body.quizScore;
        updateObj.quizPassed = req.body.quizPassed;
      }
      await updateData(`enrollments/${req.params.id}/submissions/${req.params.projectIndex}`, updateObj);
      await updateData(`enrollments/${req.params.id}`, { updatedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/enrollments/:id/submissions/:projectIndex/verify", async (req, res) => {
    try {
      await updateData(`enrollments/${req.params.id}/submissions/${req.params.projectIndex}`, {
        verified: true,
        verifiedAt: new Date().toISOString(),
      });
      await updateData(`enrollments/${req.params.id}`, { updatedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/enrollments/:id/submissions/:projectIndex/reject", async (req, res) => {
    try {
      await updateData(`enrollments/${req.params.id}/submissions/${req.params.projectIndex}`, {
        verified: false,
        resubmit: true,
        feedback: req.body.feedback || "",
        rejectedAt: new Date().toISOString(),
        submittedAt: null,
      });
      await updateData(`enrollments/${req.params.id}`, { updatedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/enrollments/:id/submissions/:projectIndex/feedback", async (req, res) => {
    try {
      await updateData(`enrollments/${req.params.id}/submissions/${req.params.projectIndex}`, {
        feedback: req.body.feedback,
        feedbackAt: new Date().toISOString(),
      });
      await updateData(`enrollments/${req.params.id}`, { updatedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Mark Complete / Certificate ──────────────────────────────────────────
  app.post("/api/fb/enrollments/:id/complete", async (req, res) => {
    try {
      await updateData(`enrollments/${req.params.id}`, {
        status: "Completed",
        allowedCertificate: "yes",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/enrollments/:id/allow-certificate", async (req, res) => {
    try {
      await updateData(`enrollments/${req.params.id}`, {
        allowedCertificate: req.body.allowed || "no",
        updatedAt: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Referrals ────────────────────────────────────────────────────────────
  app.get("/api/fb/referrals", async (req, res) => {
    try {
      const snap = await getSnapshot("referrals");
      res.json({ success: true, data: snapToArray(snap) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/fb/referrals/:code", async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const snap = await getSnapshot(`referrals/${code}`);
      res.json({ success: true, data: snap.val() || null });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/referrals", async (req, res) => {
    try {
      const code = `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const payload = {
        ...req.body,
        code,
        visited: 0,
        selected: 0,
        loggedIn: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setData(`referrals/${code}`, payload);
      res.json({ success: true, data: payload });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/fb/referrals/:code", async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      await removeData(`referrals/${code}`);
      try { await removeData(`referralUsers/${code}`); } catch {}
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/referrals/self", async (req, res) => {
    try {
      const { uid, details } = req.body;
      if (!uid || !details) {
        return res.status(400).json({ success: false, message: "Missing uid or details" });
      }
      const prefix = (details.name || "").replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase();
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const code = `${prefix}-${suffix}`;

      const payload = {
        code,
        ...details,
        createdBy: uid,
        isSelfReferral: true,
        visited: 0,
        selected: 0,
        loggedIn: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setData(`referrals/${code}`, payload);
      await setData(`selfReferralOwners/${uid}`, { code, createdAt: payload.createdAt });
      await updateData(`users/${uid}`, { selfReferralCode: code });
      res.json({ success: true, data: payload });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/fb/referrals/self/:uid", async (req, res) => {
    try {
      const snap = await getSnapshot(`selfReferralOwners/${req.params.uid}`);
      res.json({ success: true, data: snap.val() || null });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/fb/referrals/stat/:email", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const refSnap = await getSnapshot("referrals");
      if (!refSnap.exists()) return res.json({ success: true, data: null });

      const referrals = refSnap.val();
      const matchedKey = Object.keys(referrals).find(
        (k) => String(referrals[k].email || "").toLowerCase().trim() === email,
      );
      if (!matchedKey) return res.json({ success: true, data: null });

      const referral = referrals[matchedKey];
      const enrollSnap = await getSnapshot("enrollments");
      const allEnrollments = snapToArray(enrollSnap);
      const related = allEnrollments.filter(
        (e) => String(e.referralCode || "").toUpperCase() === matchedKey,
      );
      const verifiedCount = related.filter((e) => {
        const subs = e.submissions || {};
        const projects = Array.isArray(e.projects) ? e.projects : [];
        return projects.length > 0 && projects.every((_, i) => subs[i]?.verified);
      }).length;

      res.json({
        success: true,
        data: {
          code: matchedKey,
          visited: Number(referral.visited || 0),
          assignedInternships: related.length,
          completedInterns: verifiedCount,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/fb/referrals/dashboard/:uid", async (req, res) => {
    try {
      const ownerSnap = await getSnapshot(`selfReferralOwners/${req.params.uid}`);
      if (!ownerSnap.exists()) return res.json({ success: true, data: null });
      const code = ownerSnap.val().code;
      const codeUpper = code.toUpperCase();

      const [refSnap, enrollSnap, visitsSnap, usersSnap] = await Promise.all([
        getSnapshot(`referrals/${codeUpper}`),
        getSnapshot("enrollments"),
        getSnapshot("referralVisits"),
        getSnapshot(`referralUsers/${codeUpper}`),
      ]);

      const referral = refSnap.val();
      const allEnrollments = snapToArray(enrollSnap);
      const allVisits = snapToArray(visitsSnap);
      const loginUsers = usersSnap.exists() ? Object.values(usersSnap.val()) : [];

      const relatedEnrollments = allEnrollments.filter(
        (e) => String(e.referralCode || "").toUpperCase() === codeUpper,
      );
      const relatedVisits = allVisits.filter(
        (v) => String(v.referralCode || "").toUpperCase() === codeUpper,
      );
      const completedInterns = relatedEnrollments.filter((e) => {
        const subs = e.submissions || {};
        const projects = Array.isArray(e.projects) ? e.projects : [];
        return projects.length > 0 && projects.every((_, i) => subs[i]?.verified);
      });

      res.json({
        success: true,
        data: {
          code: codeUpper,
          referral,
          visits: relatedVisits.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 50),
          totalVisits: relatedVisits.length,
          totalLogins: loginUsers.length,
          enrolledInterns: relatedEnrollments,
          totalEnrolled: relatedEnrollments.length,
          completedInterns: completedInterns.length,
          completedInternIds: completedInterns.map((e) => e.internId || e.id),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Referral Visit Tracking ─────────────────────────────────────────────
  app.post("/api/fb/referral-visits", async (req, res) => {
    try {
      const code = String(req.body.referralCode || "").toUpperCase();
      const visitRef = ref("referralVisits").push();
      const visitId = visitRef.key;
      const visitBase = {
        visitId,
        ...req.body,
        referralCode: code,
        visitedAt: new Date().toISOString(),
        action: "visited",
        matched: false,
      };
      await setData(`referralVisits/${visitId}`, visitBase);

      // Check if referral exists and increment visit count
      const refSnap = await getSnapshot(`referrals/${code}`);
      if (refSnap.exists()) {
        visitBase.matched = true;
        await updateData(`referralVisits/${visitId}`, { matched: true });
        await ref(`referrals/${code}`).update({
          visited: (refSnap.val().visited || 0) + 1,
          lastVisitedAt: visitBase.visitedAt,
          updatedAt: new Date().toISOString(),
        });
      }
      res.json({ success: true, data: visitBase });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Record Referral Login ───────────────────────────────────────────────
  app.post("/api/fb/referral-login", async (req, res) => {
    try {
      const { referralCode, user } = req.body;
      if (!referralCode || !user?.uid) {
        return res.json({ success: true });
      }
      const code = String(referralCode).toUpperCase();
      const refSnap = await getSnapshot(`referrals/${code}`);
      if (!refSnap.exists()) return res.json({ success: true });

      const loginSnap = await getSnapshot(`referralUsers/${code}/${user.uid}`);
      const payload = {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        referralCode: code,
        lastLoginAt: new Date().toISOString(),
      };
      if (loginSnap.exists()) {
        await setData(`referralUsers/${code}/${user.uid}`, { ...loginSnap.val(), ...payload });
      } else {
        await setData(`referralUsers/${code}/${user.uid}`, { ...payload, firstLoginAt: new Date().toISOString() });
        await ref(`referrals/${code}`).update({
          loggedIn: (refSnap.val().loggedIn || 0) + 1,
          lastLoginAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Permanent Referral Code ─────────────────────────────────────────────
  app.get("/api/fb/users/:uid/permanent-referral", async (req, res) => {
    try {
      const snap = await getSnapshot(`users/${req.params.uid}/permanentReferralCode`);
      res.json({ success: true, data: snap.val() || null });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/users/:uid/permanent-referral", async (req, res) => {
    try {
      const existingSnap = await getSnapshot(`users/${req.params.uid}/permanentReferralCode`);
      if (!existingSnap.exists()) {
        await updateData(`users/${req.params.uid}`, {
          permanentReferralCode: (req.body.code || "").toUpperCase(),
          permanentReferralDetectedAt: new Date().toISOString(),
        });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Admin: Full admin data ──────────────────────────────────────────────
  app.get("/api/fb/admin-data", async (req, res) => {
    try {
      const [refSnap, visitsSnap, enrollSnap, refUsersSnap, siteVisitsSnap] = await Promise.all([
        getSnapshot("referrals"),
        getSnapshot("referralVisits"),
        getSnapshot("enrollments"),
        getSnapshot("referralUsers"),
        getSnapshot("siteVisits"),
      ]);

      const enrollments = snapToArray(enrollSnap).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      const referralUsers = refUsersSnap.val() || {};

      const completionInfo = (enrollment) => {
        const projects = Array.isArray(enrollment.projects) ? enrollment.projects : [];
        const submissions = enrollment.submissions || {};
        const verifiedCount = projects.filter((_, i) => submissions[i]?.verified).length;
        return { total: projects.length, verified: verifiedCount, completed: projects.length > 0 && verifiedCount === projects.length };
      };

      const referrals = snapToArray(refSnap).map((referral) => {
        const code = String(referral.code || referral.id || "").toUpperCase();
        const loginUsers = Object.values(referralUsers[code] || {});
        const relatedEnrollments = enrollments.filter((e) => String(e.referralCode || "").toUpperCase() === code);
        const loginUidSet = new Set(loginUsers.map((u) => u.uid).filter(Boolean));
        relatedEnrollments.forEach((e) => { if (e.uid) loginUidSet.add(e.uid); });
        const completed = relatedEnrollments.filter((e) => completionInfo(e).completed);
        return {
          ...referral, code, totalLogined: loginUidSet.size,
          visited: Number(referral.visited || 0),
          assignedInternships: relatedEnrollments.length,
          completedInterns: completed.length,
          completedInternIds: completed.map((e) => e.internId || e.id),
          loggedInUsers: loginUsers,
          assignedInternIds: relatedEnrollments.map((e) => e.internId || e.id),
        };
      }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

      const visits = snapToArray(visitsSnap).sort((a, b) => (b.visitedAt || "").localeCompare(a.visitedAt || "")).slice(0, 200);
      const siteVisits = snapToArray(siteVisitsSnap).sort((a, b) => (b.visitedAt || "").localeCompare(a.visitedAt || "")).slice(0, 200);

      res.json({ success: true, data: { enrollments, referrals, visits, siteVisits } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Admin: Messages ─────────────────────────────────────────────────────
  app.get("/api/fb/admin-messages", async (req, res) => {
    try {
      const snap = await getSnapshot("adminMessages");
      const items = snap.exists() ? Object.entries(snap.val()).map(([id, msg]) => ({ ...msg, id })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
      res.json({ success: true, data: items });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/admin-messages", async (req, res) => {
    try {
      const id = await pushData("adminMessages", {
        ...req.body,
        createdAt: new Date().toISOString(),
        acknowledgedBy: {},
      });
      res.json({ success: true, data: { id, ...req.body } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/fb/admin-messages/:id", async (req, res) => {
    try {
      await removeData(`adminMessages/${req.params.id}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/admin-messages/:id/acknowledge", async (req, res) => {
    try {
      const { uid, userInfo } = req.body;
      await updateData(`adminMessages/${req.params.id}/acknowledgedBy/${uid}`, {
        uid,
        email: userInfo?.email || "",
        name: userInfo?.name || "",
        acknowledgedAt: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Site Notices ────────────────────────────────────────────────────────
  app.get("/api/fb/site-notices", async (req, res) => {
    try {
      const snap = await getSnapshot("siteNotices");
      const items = snap.exists() ? Object.entries(snap.val()).map(([id, n]) => ({ ...n, id })).filter((n) => n.active !== false).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
      res.json({ success: true, data: items });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/site-notices", async (req, res) => {
    try {
      const id = await pushData("siteNotices", { ...req.body, createdAt: new Date().toISOString(), active: true });
      res.json({ success: true, data: { id } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.patch("/api/fb/site-notices/:id", async (req, res) => {
    try {
      await updateData(`siteNotices/${req.params.id}`, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/fb/site-notices/:id", async (req, res) => {
    try {
      await removeData(`siteNotices/${req.params.id}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Banned Users ────────────────────────────────────────────────────────
  app.get("/api/fb/banned-users", async (req, res) => {
    try {
      const snap = await getSnapshot("bannedUsers");
      const items = snap.exists() ? Object.entries(snap.val()).map(([key, val]) => ({ ...val, id: key })) : [];
      res.json({ success: true, data: items });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/fb/banned-users", async (req, res) => {
    try {
      const { email, banType, reason, bannedBy } = req.body;
      const key = encodeEmail(email);
      await setData(`bannedUsers/${key}`, {
        email: email.toLowerCase().trim(),
        banType: banType || "both",
        reason: reason || "",
        bannedAt: new Date().toISOString(),
        bannedBy: bannedBy || "",
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/fb/banned-users/:email", async (req, res) => {
    try {
      const key = encodeEmail(req.params.email);
      await removeData(`bannedUsers/${key}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Earn Settings ───────────────────────────────────────────────────────
  app.get("/api/fb/earn-settings", async (req, res) => {
    try {
      const snap = await getSnapshot("siteSettings/earn");
      res.json({ success: true, data: snap.val() || { rewardPerCompletion: 20, milestoneCount: 50, milestoneBonus: 1000 } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/fb/earn-settings", async (req, res) => {
    try {
      await setData("siteSettings/earn", req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Earn Details ────────────────────────────────────────────────────────
  app.get("/api/fb/earn-details", async (req, res) => {
    try {
      const snap = await getSnapshot("siteSettings/earnDetails");
      const defaults = {
        title: "How Refer & Earn Works",
        description: "Share your unique referral link with friends and classmates. When they complete their internship you get paid.",
        items: [
          { title: "Apply Once", description: "Submit your UPI ID to get a unique referral code instantly.", links: "" },
          { title: "Share Your Link", description: "Share anywhere — WhatsApp, LinkedIn, or social media.", links: "" },
          { title: "Track Progress", description: "See who enrolled using your link and track completions in real time.", links: "" },
          { title: "Get Paid", description: "Earn ₹20 per completion + ₹1,000 bonus at 50 completions directly to your UPI.", links: "" },
        ],
      };
      res.json({ success: true, data: snap.val() || defaults });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/fb/earn-details", async (req, res) => {
    try {
      await setData("siteSettings/earnDetails", req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Homepage Content ────────────────────────────────────────────────────
  app.get("/api/fb/homepage", async (req, res) => {
    try {
      const snap = await getSnapshot("siteContent/homepage");
      res.json({ success: true, data: snap.val() || null });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/fb/homepage", async (req, res) => {
    try {
      await setData("siteContent/homepage", { ...req.body, updatedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Referral Mark Achieved ──────────────────────────────────────────────
  app.post("/api/fb/referrals/:code/achieved", async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const { achieved } = req.body;
      if (achieved) {
        await updateData(`referrals/${code}`, { achieved: true, achievedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      } else {
        await updateData(`referrals/${code}`, { achieved: false, updatedAt: new Date().toISOString() });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── General Site Visit Tracking ─────────────────────────────────────────
  app.post("/api/fb/site-visits", async (req, res) => {
    try {
      const id = await pushData("siteVisits", {
        ...req.body,
        visitedAt: new Date().toISOString(),
      });
      res.json({ success: true, data: { id } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Verify Internship (public) ──────────────────────────────────────────
  app.get("/api/fb/verify/:internId", async (req, res) => {
    try {
      const enrollSnap = await getSnapshot("enrollments");
      let result = null;
      if (enrollSnap.exists()) {
        const all = snapToArray(enrollSnap);
        result = all.find((e) => e.internId === req.params.internId) || null;
        if (!result) {
          result = all.find((e) => e.id === req.params.internId) || null;
        }
      }
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
}
