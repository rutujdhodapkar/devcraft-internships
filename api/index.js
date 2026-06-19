import admin from "firebase-admin";

const ROOT_ADMIN_EMAIL = "rutujdhodapkar@gmail.com";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";

function send(res, status, payload) {
  res.status(status).json(payload);
}

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (raw) {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID || "login-data-680b9",
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }
  return null;
}

function initFirebase() {
  if (admin.apps.length) return admin.firestore();
  const credential = getServiceAccount();
  if (!credential) {
    throw new Error("Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY on Vercel.");
  }
  admin.initializeApp({
    credential: admin.credential.cert(credential),
    projectId: credential.project_id || process.env.FIREBASE_PROJECT_ID || "login-data-680b9",
  });
  return admin.firestore();
}

function cleanId(value) {
  return String(value || "").trim();
}

function codeId(value) {
  return cleanId(value).toUpperCase();
}

function emailId(email) {
  return cleanId(email).toLowerCase().replace(/\./g, ",");
}

function now() {
  return new Date().toISOString();
}

async function listCollection(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function getDoc(db, collection, id, fallback = null) {
  const doc = await db.collection(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : fallback;
}

async function setDoc(db, collection, id, data, merge = true) {
  const ref = db.collection(collection).doc(id);
  await ref.set(data, { merge });
  const doc = await ref.get();
  return { id: doc.id, ...doc.data() };
}

async function deleteDoc(db, collection, id) {
  await db.collection(collection).doc(id).delete();
  return { id };
}

async function replaceKeyedCollection(db, collection, items, fallbackPrefix) {
  const batch = db.batch();
  const existing = await db.collection(collection).get();
  existing.docs.forEach((doc) => batch.delete(doc.ref));
  items.forEach((item, idx) => {
    const id = cleanId(item.id) || `${fallbackPrefix}_${idx + 1}`;
    batch.set(db.collection(collection).doc(id), { ...item, id, updatedAt: now() });
  });
  await batch.commit();
  return items;
}

async function listUserEnrollments(db, uid) {
  const snap = await db.collection("enrollments").where("uid", "==", uid).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function listReferralInterns(db, code) {
  const snap = await db.collection("enrollments").where("referralCode", "==", code).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function handleAuth(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, message: "Method not allowed." });
  const credential = req.body?.credential;
  if (!credential) return send(res, 400, { success: false, message: "Missing Google credential." });
  if (!GOOGLE_CLIENT_ID) return send(res, 500, { success: false, message: "Google client ID is not configured." });

  const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const response = await fetch(verifyUrl);
  const payload = await response.json();
  if (!response.ok || payload.aud !== GOOGLE_CLIENT_ID) {
    return send(res, 401, { success: false, message: "Google token verification failed." });
  }
  return send(res, 200, { success: true, user: payload });
}

async function fetchGithubRepo(owner, repo, dirPath = "") {
  const MAX_FILES = 15;
  const MAX_SIZE = 200000;
  const extensions = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".h", ".hpp", ".cs", ".go", ".rb", ".php", ".swift", ".kt", ".scala", ".rs", ".html", ".css", ".scss", ".sass", ".less", ".vue", ".svelte", ".json", ".yaml", ".yml", ".md", ".txt", ".sql", ".sh", ".bash", ".ipynb"]);
  const skipDirs = new Set(["node_modules", ".git", ".github", "__pycache__", ".next", "dist", "build", ".vscode", "venv", "env", "vendor", ".idea", "coverage", ".nyc_output"]);
  const code = [];

  async function walk(path, depth = 0) {
    if (depth > 3 || code.length >= MAX_FILES) return;
    let items;
    try {
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
      const res = await fetch(apiUrl, { headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "devcraft-verifier" } });
      if (!res.ok) return;
      items = await res.json();
    } catch { return; }
    if (!Array.isArray(items)) {
      if (items.type === "file" && items.download_url) {
        const ext = "." + (items.name.split(".").pop() || "").toLowerCase();
        if (extensions.has(ext) && (items.size || 0) < MAX_SIZE) {
          try {
            const res = await fetch(items.download_url);
            if (res.ok) {
              const content = await res.text();
              code.push({ path: items.path, content: content.slice(0, 10000), size: items.size });
            }
          } catch {}
        }
      }
      return;
    }
    const sorted = items.sort((a, b) => (a.type === "dir" ? 1 : -1));
    for (const item of sorted) {
      if (item.type === "dir") {
        if (!skipDirs.has(item.name)) await walk(item.path, depth + 1);
      } else if (item.type === "file") {
        const ext = "." + (item.name.split(".").pop() || "").toLowerCase();
        if (extensions.has(ext) && (item.size || 0) < MAX_SIZE && code.length < MAX_FILES) {
          try {
            const res = await fetch(item.download_url);
            if (res.ok) {
              const content = await res.text();
              code.push({ path: item.path, content: content.slice(0, 10000), size: item.size });
            }
          } catch {}
        }
      }
    }
  }

  await walk(dirPath, 0);
  return code;
}

async function fetchCodeFromUrls(text, url) {
  const codeFiles = [];
  const urls = [];
  if (url) urls.push(url.trim());
  const urlMatch = text ? text.match(/https?:\/\/[^\s<>"']+/g) : null;
  if (urlMatch) urls.push(...urlMatch);

  const seen = new Set();
  for (const u of urls) {
    const lower = u.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    // GitHub repo
    const match = u.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\/|$|\.git)/);
    if (match) {
      const owner = match[1], repo = match[2].replace(/\.git$/, "");
      const blobMatch = u.match(/github\.com\/[\w.-]+\/[\w.-]+\/blob\/([^/]+)\/(.+)/);
      const treeMatch = u.match(/github\.com\/[\w.-]+\/[\w.-]+\/tree\/([^/]+)(?:\/(.*))?/);

      if (blobMatch) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${blobMatch[1]}/${blobMatch[2]}`;
        try {
          const res = await fetch(rawUrl);
          if (res.ok) {
            const content = await res.text();
            codeFiles.push({ path: `${repo}/${blobMatch[2]}`, content: content.slice(0, 10000) });
          }
        } catch {}
      } else {
        const dir = treeMatch ? (treeMatch[2] || "") : "";
        const files = await fetchGithubRepo(owner, repo, dir);
        codeFiles.push(...files);
      }
      continue;
    }

    // Raw file URL
    if (/(?:raw\.githubusercontent|github\.io)/i.test(u) && u.startsWith("http")) {
      try {
        const res = await fetch(u);
        if (res.ok) {
          const content = await res.text();
          codeFiles.push({ path: u, content: content.slice(0, 10000) });
        }
      } catch {}
    }
  }

  return codeFiles;
}

async function handleAiVerify(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, message: "Method not allowed." });
  const { taskTitle, taskDescription, taskNotices, submissionText, submissionUrl, internName } = req.body || {};
  if (!taskTitle || !submissionText) return send(res, 400, { success: false, message: "Task title and submission text are required." });
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return send(res, 500, { success: false, message: "NVIDIA API key not configured on server." });

  // Fetch code from submitted URLs server-side
  let codeFiles = [];
  let fetchError = null;
  try {
    codeFiles = await fetchCodeFromUrls(submissionText, submissionUrl);
  } catch (err) {
    fetchError = err.message;
  }

  const promptParts = [
    `Task Title: ${taskTitle}`,
    `Task Description: ${taskDescription || "No description provided"}`,
  ];
  if (taskNotices) promptParts.push(`Task Instructions/Notices:\n${taskNotices}`);
  promptParts.push(`Student Name: ${internName || "Unknown"}`);
  promptParts.push(`Student's Submission Text: ${submissionText}`);
  if (submissionUrl) promptParts.push(`Submission URL: ${submissionUrl}`);

  if (codeFiles.length > 0) {
    promptParts.push("\n=== ACTUAL CODE FETCHED FROM REPOSITORY ===");
    codeFiles.forEach((file) => promptParts.push(`\n--- File: ${file.path || file.name || "unknown"} ---\n${file.content || ""}`));
    promptParts.push("\n=== END OF CODE ===");
    promptParts.push("\nCRITICAL: Carefully check if the code above actually implements what was asked in the task. Check for: 1) Does the code solve the problem described? 2) Are there any placeholder/boilerplate/todo comments? 3) Does the code look like it was written specifically for this task? If the code is wrong, incomplete, or doesn't match the task, set verified to false with specific reasons.");
  } else {
    promptParts.push(`\nIMPORTANT: No code could be fetched from the submission link. The link may be invalid or private. Base your evaluation on the submission text only. If the submission text describes the work done in detail, consider it. If it's minimal or unclear, set verified to false.`);
  }
  promptParts.push("Respond with ONLY valid JSON: { verified: boolean, confidence: number (0-100), reason: string, message: string }");

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      messages: [
        {
          role: "system",
          content: "You are a STRICT internship task verifier. Compare the student's submission against the task requirements. If code is provided, check if it actually implements what was asked. If no code could be fetched, evaluate based on the submission text description. Be biased toward rejection — only verify if you are CERTAIN. Respond ONLY with valid JSON (no markdown, no extra text): { verified: boolean, confidence: number (0-100), reason: string, message: string }"
        },
        { role: "user", content: promptParts.join("\n") },
      ],
      temperature: 0.3,
      max_tokens: 700,
    }),
  });
  const ai = await response.json();
  if (!response.ok) return send(res, 502, { success: false, message: `NVIDIA API error ${response.status}` });
  const content = ai.choices?.[0]?.message?.content || "{}";
  const match = content.match(/\{[\s\S]*\}/);
  const result = match ? JSON.parse(match[0]) : { verified: false, confidence: 0, reason: "Invalid AI response", message: content };
  result.codeFilesCount = codeFiles.length;
  result.fetchError = fetchError;
  return send(res, 200, { success: true, data: result });
}

async function handleQuiz(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const { question, answer } = req.body || {};
  if (!question || !answer) return send(res, 400, { error: "Missing question or answer" });
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return send(res, 503, { error: "AI grading not configured" });
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      messages: [
        { role: "system", content: 'You grade quiz answers. Respond ONLY with JSON: {"correct": boolean, "reason": "brief explanation"}' },
        { role: "user", content: `Question: ${question}\nStudent's Answer: ${answer}\n\nIs this answer correct?` },
      ],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });
  const ai = await response.json();
  if (!response.ok) return send(res, 502, { error: `AI service error: ${response.status}` });
  const content = ai.choices?.[0]?.message?.content || "";
  const match = content.match(/\{[\s\S]*\}/);
  return send(res, 200, match ? JSON.parse(match[0]) : { correct: false, reason: "Invalid AI response" });
}

async function handleData(req, res, routeParts) {
  const db = initFirebase();
  const [resource, id, sub, extra, extra2] = routeParts;

  if (resource === "career-paths") {
    if (req.method === "GET") return send(res, 200, { success: true, data: await listCollection(db, "careerPaths") });
    return send(res, 200, { success: true, data: await replaceKeyedCollection(db, "careerPaths", req.body.paths || [], "path") });
  }
  if (resource === "how-it-works") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await listCollection(db, "howItWorks")).sort((a, b) => (a.step || 0) - (b.step || 0)) });
    return send(res, 200, { success: true, data: await replaceKeyedCollection(db, "howItWorks", req.body.steps || [], "step") });
  }
  if (resource === "faqs") {
    if (req.method === "GET") return send(res, 200, { success: true, data: await listCollection(db, "faqs") });
    return send(res, 200, { success: true, data: await replaceKeyedCollection(db, "faqs", req.body.faqs || [], "faq") });
  }
  if (resource === "templates") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await getDoc(db, "config", "templates", null))?.value || null });
    return send(res, 200, { success: true, data: (await setDoc(db, "config", "templates", { value: req.body.templates || {}, updatedAt: now() })).value });
  }
  if (resource === "about-text") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await getDoc(db, "config", "aboutText", null))?.value || "" });
    return send(res, 200, { success: true, data: (await setDoc(db, "config", "aboutText", { value: req.body.text || "", updatedAt: now() })).value });
  }
  if (resource === "users") return handleUsers(db, req, res, id, sub, extra);
  if (resource === "enrollments") return handleEnrollments(db, req, res, id, sub, extra, extra2);
  if (resource === "admin-data") {
    const [requests, referrals, visits] = await Promise.all([listCollection(db, "enrollments"), listCollection(db, "referrals"), listCollection(db, "referralVisits")]);
    return send(res, 200, { success: true, data: { requests: requests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), referrals, visits } });
  }
  if (resource === "referrals") return handleReferrals(db, req, res, id, sub);
  if (resource === "referral-visits") {
    const code = codeId(req.body.referralCode);
    const referral = code ? await getDoc(db, "referrals", code, null) : null;
    const ref = db.collection("referralVisits").doc();
    const data = { id: ref.id, ...req.body, referralCode: code, matched: Boolean(referral), visitedAt: req.body.visitedAt || now() };
    await ref.set(data);
    if (referral) await db.collection("referrals").doc(code).set({ visited: admin.firestore.FieldValue.increment(1), lastVisitedAt: data.visitedAt, updatedAt: now() }, { merge: true });
    return send(res, 201, { success: true, data });
  }
  if (resource === "referral-logins") return handleReferralLogin(db, req, res);
  if (resource === "check-admin") return handleCheckAdmin(db, req, res);
  if (resource === "admins") return handleAdmins(db, req, res, id);
  if (resource === "self-referrals") return handleSelfReferrals(db, req, res);
  if (resource === "admin-referral-users") return send(res, 200, { success: true, data: await buildReferralUsers(db) });
  if (resource === "earn-settings") return getSetConfig(db, req, res, "earnSettings", req.body.settings);
  if (resource === "earn-details") return getSetConfig(db, req, res, "earnDetails", req.body.details);
  if (resource === "banned-users") return handleBannedUsers(db, req, res, id);
  if (resource === "admin-messages") return handleMessages(db, req, res, id, sub);
  if (resource === "site-notices") return handleNotices(db, req, res, id, sub);
  if (resource === "homepage") return getSetConfig(db, req, res, "homepage", req.body.content);
  if (resource === "site-visits") {
    const ref = db.collection("siteVisits").doc();
    await ref.set({ id: ref.id, ...req.body, createdAt: now() });
    return send(res, 201, { success: true, data: { id: ref.id } });
  }
  return send(res, 404, { success: false, message: "Unknown API route." });
}

async function handleUsers(db, req, res, uid, sub, extra) {
  if (!uid) return send(res, 400, { success: false, message: "Missing user id." });
  if (!sub && req.method === "GET") return send(res, 200, { success: true, data: await getDoc(db, "users", uid, null) });
  if (!sub && req.method === "POST") return send(res, 200, { success: true, data: await setDoc(db, "users", uid, { ...req.body.profile, uid, updatedAt: now() }) });
  if (sub === "enrollments") return send(res, 200, { success: true, data: await listUserEnrollments(db, uid) });
  if (sub === "permanent-referral") {
    if (req.method === "GET") return send(res, 200, { success: true, data: { code: (await getDoc(db, "users", uid, {})).permanentReferralCode || null } });
    await setDoc(db, "users", uid, { permanentReferralCode: codeId(req.body.code), permanentReferralDetectedAt: now() });
    return send(res, 200, { success: true, data: { code: codeId(req.body.code) } });
  }
  if (sub === "self-referral") return send(res, 200, { success: true, data: { code: (await getDoc(db, "selfReferralOwners", uid, {})).code || null } });
  if (sub === "referral-dashboard") return send(res, 200, { success: true, data: await buildReferralDashboard(db, uid) });
  if (uid === "by-email" && extra === "referral-stat") return send(res, 200, { success: true, data: await buildEmailReferralStat(db, decodeURIComponent(sub)) });
  return send(res, 404, { success: false, message: "Unknown user route." });
}

async function handleEnrollments(db, req, res, id, sub, extra, extra2) {
  if (!id && req.method === "GET") return send(res, 200, { success: true, data: await listCollection(db, "enrollments") });
  if (!id && req.method === "POST") {
    const domain = req.body.domain || {};
    const profile = req.body.profile || {};
    const ref = db.collection("enrollments").doc();
    const enrollment = {
      id: ref.id,
      uid: req.body.uid,
      name: profile.name || profile.displayName || "Student",
      email: profile.email || "",
      photoURL: profile.photoURL || "",
      phone: profile.phone || "",
      college: profile.college || "",
      city: profile.city || "",
      country: profile.country || "",
      upiId: profile.upiId || "",
      domain: domain.title || domain.name || "",
      domainId: domain.id || "",
      projects: domain.projects || [],
      referralCode: codeId(req.body.referralCode),
      status: "Active",
      allowedCertificate: "no",
      submissions: {},
      createdAt: now(),
      updatedAt: now(),
    };
    await ref.set(enrollment);
    if (enrollment.referralCode) await db.collection("referrals").doc(enrollment.referralCode).set({ contacted: admin.firestore.FieldValue.increment(1), updatedAt: now() }, { merge: true });
    return send(res, 201, { success: true, data: enrollment });
  }
  if (id && req.method === "GET") return send(res, 200, { success: true, data: await getDoc(db, "enrollments", id, null) });
  if (id && req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(db, "enrollments", id) });
  const ref = db.collection("enrollments").doc(id);
  const patch = { updatedAt: now() };
  if (sub === "status") patch.status = req.body.status;
  if (sub === "transaction") patch.transactionId = req.body.transactionId;
  if (sub === "certificate") patch.allowedCertificate = req.body.allowed;
  if (sub === "complete") Object.assign(patch, { status: "Completed", allowedCertificate: "yes", completedAt: now() });
  if (sub === "completion-reject" && extra === "clear") Object.assign(patch, { completionRejectedAt: null, completionRejectReason: null });
  else if (sub === "completion-reject") Object.assign(patch, { completionRejectedAt: now(), completionRejectReason: req.body.reason || "" });
  if (sub === "projects") {
    const projectIndex = Number(extra);
    const base = `submissions.${projectIndex}`;
    if (extra2 === "submit") Object.assign(patch, { [base]: { text: req.body.submissionText || "", url: req.body.submissionUrl || "", submittedAt: now(), verified: false } });
    if (extra2 === "quiz") Object.assign(patch, { [base]: { answers: req.body.answers || {}, project: req.body.project || null, submittedAt: now(), verified: false, type: "quiz" } });
    if (extra2 === "verify") Object.assign(patch, { [`${base}.verified`]: true, [`${base}.verifiedAt`]: now(), [`${base}.rejected`]: false });
    if (extra2 === "feedback") Object.assign(patch, { [`${base}.feedback`]: req.body.feedback || "" });
    if (extra2 === "reject") Object.assign(patch, { [`${base}.verified`]: false, [`${base}.rejected`]: true, [`${base}.feedback`]: req.body.feedback || "", [`${base}.rejectedAt`]: now() });
  }
  await ref.set(patch, { merge: true });
  return send(res, 200, { success: true, data: await getDoc(db, "enrollments", id, null) });
}

async function handleReferrals(db, req, res, id, sub) {
  if (!id && req.method === "POST") {
    const details = req.body.details || {};
    const code = codeId(details.code) || `REF-${Date.now().toString(36).toUpperCase()}`;
    return send(res, 201, { success: true, data: await setDoc(db, "referrals", code, { id: code, code, ...details, visited: 0, contacted: 0, createdAt: now(), updatedAt: now() }) });
  }
  if (id && req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(db, "referrals", codeId(id)) });
  if (sub === "matched") return send(res, 200, { success: true, data: { matched: Boolean(await getDoc(db, "referrals", codeId(id), null)) } });
  if (sub === "contacted") {
    await db.collection("referrals").doc(codeId(id)).set({ contacted: admin.firestore.FieldValue.increment(1), lastContactedAt: now(), updatedAt: now() }, { merge: true });
    return send(res, 200, { success: true, data: await getDoc(db, "referrals", codeId(id), null) });
  }
  if (sub === "achieved") return send(res, 200, { success: true, data: await setDoc(db, "referrals", codeId(id), { achieved: Boolean(req.body.achieved), achievedAt: req.body.achieved ? now() : null, updatedAt: now() }) });
  if (sub === "auto-unachieve") return send(res, 200, { success: true, data: { unachieved: false } });
  return send(res, 404, { success: false, message: "Unknown referral route." });
}

async function handleReferralLogin(db, req, res) {
  const code = codeId(req.body.referralCode);
  const user = req.body.user || {};
  await db.collection("referralUsers").doc(`${code}_${user.uid}`).set({ ...user, code, loginAt: now(), updatedAt: now() }, { merge: true });
  await db.collection("referrals").doc(code).set({ lastActivityAt: now(), updatedAt: now() }, { merge: true });
  return send(res, 201, { success: true, data: { code } });
}

async function handleCheckAdmin(db, req, res) {
  const email = cleanId(req.body.email).toLowerCase();
  if (email === ROOT_ADMIN_EMAIL) return send(res, 200, { success: true, isAdmin: true });
  const adminDoc = await getDoc(db, "admins", emailId(email), null);
  return send(res, 200, { success: true, isAdmin: Boolean(adminDoc) });
}

async function handleAdmins(db, req, res, id) {
  if (req.method === "GET") return send(res, 200, { success: true, data: (await listCollection(initFirebase(), "admins")).map((a) => a.email || a.id) });
  if (req.method === "POST") {
    const email = cleanId(req.body.email).toLowerCase();
    return send(res, 200, { success: true, data: await setDoc(initFirebase(), "admins", emailId(email), { email, createdAt: now() }) });
  }
  if (req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(initFirebase(), "admins", emailId(id)) });
}

async function handleSelfReferrals(db, req, res) {
  const uid = req.body.uid;
  const details = req.body.details || {};
  const code = codeId(details.code) || `REF-${String(uid).slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  await setDoc(db, "referrals", code, { id: code, code, ...details, uid, selfCreated: true, createdAt: now(), updatedAt: now() });
  await setDoc(db, "selfReferralOwners", uid, { uid, code, createdAt: now() });
  await setDoc(db, "users", uid, { selfReferralCode: code, updatedAt: now() });
  return send(res, 201, { success: true, data: { code } });
}

async function getSetConfig(db, req, res, id, value) {
  if (req.method === "GET") return send(res, 200, { success: true, data: (await getDoc(db, "siteConfig", id, null))?.value || null });
  const saved = await setDoc(db, "siteConfig", id, { value: value || {}, updatedAt: now() });
  return send(res, 200, { success: true, data: saved.value });
}

async function handleBannedUsers(db, req, res, id) {
  if (!id && req.method === "GET") return send(res, 200, { success: true, data: await listCollection(db, "bannedUsers") });
  if (!id && req.method === "POST") {
    const email = cleanId(req.body.email).toLowerCase();
    return send(res, 201, { success: true, data: await setDoc(db, "bannedUsers", emailId(email), { email, banType: req.body.banType || "both", reason: req.body.reason || "", bannedBy: req.body.bannedBy || "", bannedAt: now() }) });
  }
  if (req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(db, "bannedUsers", emailId(id)) });
  return send(res, 200, { success: true, data: await getDoc(db, "bannedUsers", emailId(id), null) });
}

async function handleMessages(db, req, res, id, sub) {
  if (id === "all") return send(res, 200, { success: true, data: await listCollection(db, "adminMessages") });
  if (!id && req.method === "GET") {
    const { email = "", context = "", uid = "" } = req.query || {};
    const msgs = (await listCollection(db, "adminMessages")).filter((m) => {
      if (m.expiresAt && new Date(m.expiresAt) < new Date()) return false;
      if (m.target && m.target !== "all" && m.target.toLowerCase() !== String(email).toLowerCase()) return false;
      if (context && m.context && m.context !== context) return false;
      if (uid && m.acknowledgedBy?.[uid]) return false;
      return true;
    });
    return send(res, 200, { success: true, data: msgs });
  }
  if (!id && req.method === "POST") {
    const ref = db.collection("adminMessages").doc();
    const data = { id: ref.id, ...req.body.message, acknowledgedBy: {}, createdAt: now() };
    await ref.set(data);
    return send(res, 201, { success: true, data });
  }
  if (sub === "ack") {
    await db.collection("adminMessages").doc(id).set({ [`acknowledgedBy.${req.body.uid}`]: { ...(req.body.userInfo || {}), uid: req.body.uid, acknowledgedAt: now() } }, { merge: true });
    return send(res, 200, { success: true, data: { id } });
  }
  if (req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(db, "adminMessages", id) });
}

async function handleNotices(db, req, res, id, sub) {
  if (!id && req.method === "GET") return send(res, 200, { success: true, data: (await listCollection(db, "siteNotices")).filter((n) => n.active !== false) });
  if (!id && req.method === "POST") {
    const ref = db.collection("siteNotices").doc();
    const data = { id: ref.id, ...req.body.notice, active: true, createdAt: now() };
    await ref.set(data);
    return send(res, 201, { success: true, data });
  }
  if (sub === "toggle") return send(res, 200, { success: true, data: await setDoc(db, "siteNotices", id, { active: Boolean(req.body.active), updatedAt: now() }) });
  if (req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(db, "siteNotices", id) });
}

async function buildReferralUsers(db) {
  const referrals = await listCollection(db, "referrals");
  return Promise.all(referrals.map(async (referral) => {
    const code = codeId(referral.code || referral.id);
    const interns = await listReferralInterns(db, code);
    return {
      ...referral,
      code,
      internCount: interns.length,
      internIds: interns.map((i) => i.internId || i.id),
      interns,
    };
  }));
}

async function buildReferralDashboard(db, uid) {
  const owner = await getDoc(db, "selfReferralOwners", uid, null);
  if (!owner?.code) return { referral: null, visits: [], interns: [], totals: { visits: 0, interns: 0, completed: 0, earnings: 0 } };
  const code = codeId(owner.code);
  const [referral, interns, visits] = await Promise.all([
    getDoc(db, "referrals", code, null),
    listReferralInterns(db, code),
    db.collection("referralVisits").where("referralCode", "==", code).get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
  ]);
  const completed = interns.filter((i) => i.status === "Completed").length;
  return { referral, interns, visits, totals: { visits: visits.length, interns: interns.length, completed, earnings: completed * 20 } };
}

async function buildEmailReferralStat(db, email) {
  const refs = await db.collection("referrals").where("email", "==", email).get();
  if (refs.empty) return null;
  const referral = { id: refs.docs[0].id, ...refs.docs[0].data() };
  const interns = await listReferralInterns(db, codeId(referral.code || referral.id));
  return { referral, interns, internCount: interns.length, completed: interns.filter((i) => i.status === "Completed").length };
}

export default async function handler(req, res) {
  try {
    const path = (req.url || "").split("?")[0].replace(/^\/api\/?/, "");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts[0] === "auth" && parts[1] === "google") return handleAuth(req, res);
    if (parts[0] === "ai" && parts[1] === "verify-task") return handleAiVerify(req, res);
    if (parts[0] === "grade-quiz-text") return handleQuiz(req, res);
    if (parts[0] === "data") return handleData(req, res, parts.slice(1));
    return send(res, 404, { success: false, message: "API route not found." });
  } catch (error) {
    console.error("API error:", error);
    return send(res, 500, { success: false, message: error.message || "Server error." });
  }
}
