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

let fbInitPromise = null;
async function initFirebase() {
  if (fbInitPromise) return fbInitPromise;
  fbInitPromise = (async () => {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const apps = getApps();
    if (apps.length) return getFirestore(apps[0]);
    const sa = getServiceAccount();
    if (!sa) {
      throw new Error("Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY on Vercel.");
    }
    const app = initializeApp({
      credential: cert(sa),
      projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID || "login-data-680b9",
    });
    return getFirestore(app);
  })();
  return fbInitPromise;
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

// Firestore helpers
async function pushDoc(db, name, data) {
  const ref = await db.collection(name).add(data);
  return { id: ref.id, ...data };
}

async function listCollection(db, name) {
  const snap = await db.collection(name).get();
  if (snap.empty) return [];
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getDoc(db, collection, id, fallback = null) {
  const snap = await db.collection(collection).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : fallback;
}

async function setDoc(db, collection, id, data, merge = true) {
  await db.collection(collection).doc(id).set(data, { merge });
  return { id, ...data };
}

async function deleteDoc(db, collection, id) {
  await db.collection(collection).doc(id).delete();
  return { id };
}

async function replaceKeyedCollection(db, collection, items, fallbackPrefix) {
  const batch = db.batch();
  const ids = new Set();
  items.forEach((item, idx) => {
    const id = cleanId(item.id) || `${fallbackPrefix}_${idx + 1}`;
    ids.add(id);
    batch.set(db.collection(collection).doc(id), { ...item, id, updatedAt: now() }, { merge: true });
  });
  const existing = await db.collection(collection).listDocuments();
  for (const doc of existing) {
    if (!ids.has(doc.id)) batch.delete(doc);
  }
  await batch.commit();
  return items;
}

async function listUserEnrollments(db, uid) {
  const snap = await db.collection("enrollments").where("uid", "==", uid).get();
  if (snap.empty) return [];
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function listReferralInterns(db, code) {
  const snap = await db.collection("enrollments").where("referralCode", "==", code).get();
  if (snap.empty) return [];
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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



async function handleAiGradeQuiz(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const { questions, answers } = req.body || {};
  if (!questions || !answers) return send(res, 400, { error: "Missing questions or answers" });
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return send(res, 503, { error: "AI grading not configured" });
  const results = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ans = answers[i];
    if (ans === undefined || String(ans).trim() === "") {
      results.push({ index: i, correct: false, reason: "No answer provided" });
      continue;
    }
    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "meta/llama-3.3-70b-instruct",
          messages: [
            { role: "system", content: 'You grade quiz answers. Respond ONLY with JSON: {"correct": boolean, "reason": "brief explanation"}' },
            { role: "user", content: `Question: ${q.question || q}\nStudent's Answer: ${ans}\n\nIs this answer correct?` },
          ],
          temperature: 0.2,
          max_tokens: 300,
        }),
      });
      const ai = await response.json();
      const content = ai.choices?.[0]?.message?.content || "";
      const match = content.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : { correct: false, reason: "AI parse error" };
      results.push({ index: i, ...parsed });
    } catch {
      results.push({ index: i, correct: false, reason: "AI service error" });
    }
  }
  const allCorrect = results.every((r) => r.correct);
  return send(res, 200, { success: true, data: { results, allCorrect } });
}

async function handleData(req, res, routeParts) {
  const [resource, id, sub, extra, extra2] = routeParts;

  const db = await initFirebase();

  if (resource === "career-paths") {
    if (req.method === "GET") {
      const paths = await listCollection(db, "careerPaths");
      const categories = (await getDoc(db, "siteConfig", "domainCategories", null))?.value || [];
      return send(res, 200, { success: true, data: { paths, categories } });
    }
    await replaceKeyedCollection(db, "careerPaths", req.body.paths || [], "path");
    if (req.body.categories) await setDoc(db, "siteConfig", "domainCategories", { value: req.body.categories, updatedAt: now() });
    return send(res, 200, { success: true, data: { paths: req.body.paths || [], categories: req.body.categories || [] } });
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
  if (resource === "payment-settings") return getSetConfig(db, req, res, "paymentSettings", req.body);
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
    const data = { ...req.body, referralCode: code, matched: Boolean(referral), visitedAt: req.body.visitedAt || now(), createdAt: now() };
    const newRef = await db.collection("referralVisits").add(data);
    if (referral) {
      await db.collection("referrals").doc(code).update({ visited: (referral.visited || 0) + 1, lastVisitedAt: data.visitedAt, updatedAt: now() });
    }
    data.id = newRef.id;
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
    const newRef = await db.collection("siteVisits").add({ ...req.body, createdAt: now() });
    return send(res, 201, { success: true, data: { id: newRef.id } });
  }
  if (resource === "payment-stats") {
    const enrollments = await listCollection(db, "enrollments");
    const paidEnrollments = enrollments.filter((e) => e.paymentStatus === "paid");
    const referrals = await listCollection(db, "referrals");
    const totalCollected = paidEnrollments.reduce((sum, e) => sum + (e.paymentAmount || 0), 0);
    let totalDistribute = 0;
    const referralPayouts = referrals.map((r) => {
      const interns = enrollments.filter((e) => e.referralCode === codeId(r.code || r.id) && e.status === "Completed");
      const completedPaid = interns.filter((i) => i.paymentStatus === "paid");
      const earnings = completedPaid.reduce((s, i) => s + Math.max(0, (i.paymentAmount || 200) - 170), 0);
      return { code: r.code || r.id, name: r.name, email: r.email, earned: earnings, interns: interns.length, completedPaid: completedPaid.length, payoutStatus: r.payoutStatus || "pending", payoutAt: r.payoutAt || null, payoutAmount: r.payoutAmount || null };
    });
    totalDistribute = referralPayouts.reduce((s, r) => s + r.earned, 0);
    return send(res, 200, { success: true, data: { totalCollected, totalDistribute, netTotal: totalCollected - totalDistribute, paidEnrollments: paidEnrollments.length, referralPayouts } });
  }
  if (resource === "user-types") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await getDoc(db, "siteConfig", "userTypes", null))?.value || [] });
    return send(res, 200, { success: true, data: (await setDoc(db, "siteConfig", "userTypes", { value: req.body || [], updatedAt: now() })).value });
  }
  if (resource === "payout-config") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await getDoc(db, "siteConfig", "payoutConfig", null))?.value || { payoutDays: 30, defaultPayoutPerIntern: 30 } });
    return send(res, 200, { success: true, data: (await setDoc(db, "siteConfig", "payoutConfig", { value: req.body || {}, updatedAt: now() })).value });
  }
  if (resource === "audit-log") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await listCollection(db, "auditLog")).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 500) });
    return send(res, 200, { success: true, data: (await pushDoc(db, "auditLog", { ...req.body, createdAt: now() })) });
  }
  if (resource === "site-config") {
    const key = req.query?.key || id;
    if (req.method === "GET" && key) return send(res, 200, { success: true, data: (await getDoc(db, "siteConfig", key, null))?.value || null });
    if (req.method === "PUT" && key) return send(res, 200, { success: true, data: (await setDoc(db, "siteConfig", key, { value: req.body, updatedAt: now() })).value });
  }
  if (resource === "receipt" && id) {
    const enr = await getDoc(db, "enrollments", id, null);
    if (!enr) return send(res, 404, { success: false, message: "Enrollment not found." });
    return send(res, 200, {
      success: true, data: {
        receiptNo: `RCP-${String(enr.internId || id).slice(0, 8).toUpperCase()}`,
        date: enr.paidAt || enr.updatedAt || enr.createdAt,
        name: enr.name || "",
        email: enr.email || "",
        domain: enr.domain || "",
        amount: enr.paymentAmount || 0,
        paymentMethod: enr.paymentMethod || "UPI",
        transactionId: enr.transactionId || enr.dodoPaymentId || "",
        status: enr.paymentStatus || "",
      }
    });
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
    const paymentSettings = (await getDoc(db, "siteConfig", "paymentSettings", null))?.value || { defaultAmount: 200, defaultAmountReferral: 170 };
    const refCode = codeId(req.body.referralCode);
    const isReferral = Boolean(refCode);
    const domainAmount = domain.paymentAmount || (isReferral ? (paymentSettings.defaultAmountReferral || 170) : paymentSettings.defaultAmount || 200);
    const paymentTiming = domain.paymentTiming || paymentSettings.defaultTiming || "end";
    const splitPercent = domain.paymentSplitPercent || paymentSettings.defaultSplitPercent || 50;
    const paymentStartAmount = paymentTiming === "both" ? Math.round(domainAmount * splitPercent / 100) : 0;
    const paymentEndAmount = paymentTiming === "both" ? domainAmount - paymentStartAmount : domainAmount;
    const internId = `DEV-CRAFT-${Date.now().toString(36).toUpperCase().slice(-6).padStart(6, '0')}`;
    const enrollment = {
      id: internId,
      internId,
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
      referralCode: refCode,
      status: "Active",
      allowedCertificate: "no",
      submissions: {},
      paymentStatus: "none",
      paymentStage: "none",
      paymentAmount: domainAmount,
      paymentStartAmount: paymentStartAmount,
      paymentEndAmount: paymentEndAmount,
      paymentTiming: paymentTiming,
      paymentIntentId: "",
      overrideCompleted: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await setDoc(db, "enrollments", internId, enrollment, false);
    if (enrollment.referralCode) {
      const refCode = enrollment.referralCode;
      const contactSnap = await db.collection("referrals").doc(refCode).get();
      const contactData = contactSnap.data() || {};
      await db.collection("referrals").doc(refCode).update({ contacted: (contactData.contacted || 0) + 1, updatedAt: now() });
    }
    return send(res, 201, { success: true, data: enrollment });
  }
  if (id && req.method === "GET") return send(res, 200, { success: true, data: await getDoc(db, "enrollments", id, null) });
  if (id && req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(db, "enrollments", id) });
  const patch = { updatedAt: now() };
  if (sub === "status") patch.status = req.body.status;
  if (sub === "transaction") patch.transactionId = req.body.transactionId;
  if (sub === "certificate") patch.allowedCertificate = req.body.allowed;
  if (sub === "complete") {
    patch.status = "Completed";
    patch.allowedCertificate = "yes";
    patch.completedAt = now();
  }
  if (sub === "override-complete") {
    patch.status = "Completed";
    patch.allowedCertificate = "yes";
    patch.completedAt = now();
    patch.overrideCompleted = true;
    patch.overriddenBy = req.body.adminEmail || "admin";
  }
  if (sub === "completion-reject" && extra === "clear") Object.assign(patch, { completionRejectedAt: null, completionRejectReason: null });
  else if (sub === "completion-reject") Object.assign(patch, { completionRejectedAt: now(), completionRejectReason: req.body.reason || "" });
  if (sub === "payment-status") {
    patch.paymentStatus = req.body.paymentStatus;
    patch.paymentStage = req.body.paymentStage || "none";
    if (req.body.paymentStatus === "paid") {
      if (req.body.paymentStage === "start" || !req.body.paymentStage) {
        patch.paidAt = now();
        patch.paymentStage = "start_paid";
      }
      if (req.body.paymentStage === "end" || (req.body.paymentStage === "full")) {
        patch.paidAt = now();
        patch.allowedCertificate = "yes";
        patch.paymentStage = "fully_paid";
      }
    }
    if (req.body.paymentAmount != null) patch.paymentAmount = req.body.paymentAmount;
    if (req.body.paymentStartAmount != null) patch.paymentStartAmount = req.body.paymentStartAmount;
    if (req.body.paymentEndAmount != null) patch.paymentEndAmount = req.body.paymentEndAmount;
  }
  if (sub === "payment-amount") {
    patch.paymentAmount = req.body.paymentAmount;
    if (req.body.paymentStartAmount != null) patch.paymentStartAmount = req.body.paymentStartAmount;
    if (req.body.paymentEndAmount != null) patch.paymentEndAmount = req.body.paymentEndAmount;
  }
  if (sub === "unverify-payment") {
    patch.paymentStatus = "none";
    patch.paymentStage = "none";
    patch.paidAt = null;
    patch.paymentIntentId = "";
    patch.allowedCertificate = "no";
    if (req.body.reason) patch.paymentUnverifyReason = req.body.reason;
  }
  if (sub === "projects") {
    const projectIndex = Number(extra);
    const base = `submissions.${projectIndex}`;
    if (extra2 === "submit") Object.assign(patch, { [base]: { text: req.body.submissionText || "", url: req.body.submissionUrl || "", submittedAt: now(), verified: false } });
    if (extra2 === "quiz") Object.assign(patch, { [base]: { answers: req.body.answers || {}, project: req.body.project || null, submittedAt: now(), verified: false, type: "quiz" } });
    if (extra2 === "verify") Object.assign(patch, { [`${base}.verified`]: true, [`${base}.verifiedAt`]: now(), [`${base}.rejected`]: false, [`${base}.aiVerified`]: req.body.aiVerified || false });
    if (extra2 === "unverify") Object.assign(patch, { [`${base}.verified`]: false, [`${base}.verifiedAt`]: null, [`${base}.aiVerified`]: false });
    if (extra2 === "feedback") Object.assign(patch, { [`${base}.feedback`]: req.body.feedback || "" });
    if (extra2 === "reject") Object.assign(patch, { [`${base}.verified`]: false, [`${base}.rejected`]: true, [`${base}.feedback`]: req.body.feedback || "", [`${base}.rejectedAt`]: now() });
  }
  await db.collection("enrollments").doc(id).update(patch);
  if (extra2 === "verify") {
    try {
      const snap = await db.collection("enrollments").doc(id).get();
      const enr = snap.data();
      if (enr) {
        const projects = enr.projects || [];
        const submissions = enr.submissions || {};
        const allVerified = projects.length > 0 && projects.every((_, i) => submissions[i]?.verified);
        const isPaid = enr.paymentStatus === "paid" || enr.paymentStage === "fully_paid";
        if (allVerified && isPaid) {
          await db.collection("enrollments").doc(id).update({ allowedCertificate: "yes", status: "Completed", completedAt: now(), updatedAt: now() });
        }
      }
    } catch {}
  }
  const updated = await getDoc(db, "enrollments", id, null);
  return send(res, 200, { success: true, data: updated || patch });
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
    const snap = await db.collection("referrals").doc(codeId(id)).get();
    const refData = snap.data() || {};
    await db.collection("referrals").doc(codeId(id)).update({ contacted: (refData.contacted || 0) + 1, lastContactedAt: now(), updatedAt: now() });
    return send(res, 200, { success: true, data: await getDoc(db, "referrals", codeId(id), null) });
  }
  if (sub === "achieved") return send(res, 200, { success: true, data: await setDoc(db, "referrals", codeId(id), { achieved: Boolean(req.body.achieved), achievedAt: req.body.achieved ? now() : null, updatedAt: now() }) });
  if (sub === "auto-unachieve") return send(res, 200, { success: true, data: { unachieved: false } });
  if (sub === "mark-payout") {
    const payoutAmount = req.body.payoutAmount || 0;
    const payoutNote = req.body.payoutNote || "";
    await db.collection("referrals").doc(codeId(id)).update({ payoutStatus: "done", payoutAmount, payoutNote, payoutAt: now(), updatedAt: now() });
    return send(res, 200, { success: true, data: await getDoc(db, "referrals", codeId(id), null) });
  }
  if (sub === "clear-payout") {
    await db.collection("referrals").doc(codeId(id)).update({ payoutStatus: "pending", payoutAmount: null, payoutNote: null, payoutAt: null, updatedAt: now() });
    return send(res, 200, { success: true, data: await getDoc(db, "referrals", codeId(id), null) });
  }
  return send(res, 404, { success: false, message: "Unknown referral route." });
}

async function handleReferralLogin(db, req, res) {
  const code = codeId(req.body.referralCode);
  const user = req.body.user || {};
  await db.collection("referralUsers").doc(`${code}_${user.uid}`).set({ ...user, code, uid: user.uid, loginAt: now(), updatedAt: now() }, { merge: true });
  await db.collection("referrals").doc(code).update({ lastActivityAt: now(), updatedAt: now() });
  return send(res, 201, { success: true, data: { code } });
}

async function handleCheckAdmin(db, req, res) {
  const email = cleanId(req.body.email).toLowerCase();
  if (email === ROOT_ADMIN_EMAIL) return send(res, 200, { success: true, isAdmin: true });
  const adminDoc = await getDoc(db, "admins", emailId(email), null);
  return send(res, 200, { success: true, isAdmin: Boolean(adminDoc) });
}

async function handleAdmins(db, req, res, id) {
  if (req.method === "GET") return send(res, 200, { success: true, data: (await listCollection(db, "admins")).map((a) => a.email || a.id) });
  if (req.method === "POST") {
    const email = cleanId(req.body.email).toLowerCase();
    return send(res, 200, { success: true, data: await setDoc(db, "admins", emailId(email), { email, createdAt: now() }) });
  }
  if (req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(db, "admins", emailId(id)) });
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
    const newRef = await db.collection("adminMessages").add({ ...req.body.message, acknowledgedBy: {}, createdAt: now() });
    const data = { id: newRef.id, ...req.body.message, acknowledgedBy: {}, createdAt: now() };
    return send(res, 201, { success: true, data });
  }
  if (sub === "ack") {
    await db.collection("adminMessages").doc(id).update({ [`acknowledgedBy.${req.body.uid}`]: { ...(req.body.userInfo || {}), uid: req.body.uid, acknowledgedAt: now() } });
    return send(res, 200, { success: true, data: { id } });
  }
  if (req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(db, "adminMessages", id) });
}

async function handleNotices(db, req, res, id, sub) {
  if (!id && req.method === "GET") return send(res, 200, { success: true, data: (await listCollection(db, "siteNotices")).filter((n) => n.active !== false) });
  if (!id && req.method === "POST") {
    const newRef = await db.collection("siteNotices").add({ ...req.body.notice, active: true, createdAt: now() });
    const data = { id: newRef.id, ...req.body.notice, active: true, createdAt: now() };
    return send(res, 201, { success: true, data });
  }
  if (sub === "toggle") return send(res, 200, { success: true, data: await setDoc(db, "siteNotices", id, { active: Boolean(req.body.active), updatedAt: now() }) });
  if (req.method === "DELETE") return send(res, 200, { success: true, data: await deleteDoc(db, "siteNotices", id) });
}

async function buildReferralUsers(db) {
  const [referrals, allEnrollments, payoutConfig] = await Promise.all([
    listCollection(db, "referrals"),
    listCollection(db, "enrollments"),
    (await getDoc(db, "siteConfig", "payoutConfig", null))?.value || { payoutDays: 30, defaultPayoutPerIntern: 30 },
  ]);
  return Promise.all(referrals.map(async (referral) => {
    const code = codeId(referral.code || referral.id);
    const interns = await listReferralInterns(db, code);
    const paidCompleted = interns.filter((i) => i.status === "Completed" && i.paymentStatus === "paid");
    const earnings = paidCompleted.reduce((s, i) => s + Math.max(0, (i.paymentAmount || 200) - 170), 0);
    return {
      ...referral,
      code,
      internCount: interns.length,
      internIds: interns.map((i) => i.internId || i.id),
      interns,
      earnings,
      paidCompletedCount: paidCompleted.length,
      payoutConfig,
    };
  }));
}

async function buildReferralDashboard(db, uid) {
  const owner = await getDoc(db, "selfReferralOwners", uid, null);
  if (!owner?.code) return { referral: null, visits: [], interns: [], totals: { visits: 0, interns: 0, completed: 0, earnings: 0 } };
  const code = codeId(owner.code);
  const visitSnap = await db.collection("referralVisits").where("referralCode", "==", code).get();
  const visits = visitSnap.empty ? [] : visitSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const [referral, interns] = await Promise.all([
    getDoc(db, "referrals", code, null),
    listReferralInterns(db, code),
  ]);
  const paidCompleted = interns.filter((i) => i.status === "Completed" && i.paymentStatus === "paid");
  const earnings = paidCompleted.reduce((s, i) => s + Math.max(0, (i.paymentAmount || 200) - 170), 0);
  return { referral, interns, visits, totals: { visits: visits.length, interns: interns.length, completed: paidCompleted.length, earnings } };
}

async function buildEmailReferralStat(db, email) {
  const snap = await db.collection("referrals").where("email", "==", email).get();
  if (snap.empty) return null;
  const referral = { id: snap.docs[0].id, ...snap.docs[0].data() };
  const interns = await listReferralInterns(db, codeId(referral.code || referral.id));
  return { referral, interns, internCount: interns.length, completed: interns.filter((i) => i.status === "Completed").length };
}

// ─── Dodo Payments ──────────────────────────────────────────────────────────
const DODO_KEY = process.env.DODO_PAYMENTS_API_KEY || "";
const DODO_WH_SECRET = process.env.DODO_PAYMENTS_WEBHOOK_SECRET || "";
const DODO_PRODUCT_ID = process.env.DODO_PAYMENTS_PRODUCT_ID || "";
const DODO_ENV = process.env.DODO_PAYMENTS_ENVIRONMENT === "live" ? "live" : "test";

async function dodoApi(path, options = {}) {
  const base = DODO_ENV === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
  const response = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DODO_KEY}`, ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dodo API error ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function handleDodo(req, res, parts) {
  if (req.method !== "POST") return send(res, 405, { success: false, message: "Method not allowed" });
  const sub = parts[0] || "";
  try {
    if (sub === "setup") {
      if (!DODO_KEY) return send(res, 400, { success: false, message: "Dodo API key not configured" });
      const product = await dodoApi("/products", {
        method: "POST",
        body: JSON.stringify({
          name: "DEV/CRAFT Internship Payment",
          description: "Internship enrollment payment",
          price: { type: "one_time_price", currency: "INR", price: 0, discount: 0, purchasing_power_parity: false, pay_what_you_want: true, suggested_price: 20000, tax_inclusive: true },
          tax_category: "digital_products",
        }),
      });
      return send(res, 200, { success: true, data: { product_id: product.product_id } });
    }
    if (!DODO_KEY) return send(res, 400, { success: false, message: "Dodo API key not configured in Vercel env" });
    if (sub === "create-checkout-session") {
      const { amount, enrollmentId, customerEmail, customerName } = req.body || {};
      if (!amount || amount <= 0 || !enrollmentId) return send(res, 400, { success: false, message: "Valid amount and enrollmentId required" });
      let productId = DODO_PRODUCT_ID;
      if (!productId) {
        try {
const db2 = await initFirebase();
      const snap2 = await db2.collection("siteConfig").doc("dodoConfig").get();
          const val = snap2.data();
          productId = val?.value?.productId || null;
        } catch {}
      }
      if (!productId) return send(res, 400, { success: false, message: "Dodo product not configured" });
      const amountPaise = Math.round(amount * 100);
      const body = {
        product_cart: [{ product_id: productId, quantity: 1, amount: amountPaise }],
        metadata: { enrollment_id: enrollmentId },
        return_url: `${req.headers.origin || "https://devcraft.rutujdhodapkar.tech"}/dashboard?dodo_success=1`,
        cancel_url: `${req.headers.origin || "https://devcraft.rutujdhodapkar.tech"}/dashboard?dodo_cancelled=1`,
        billing_address: { country: "IN" },
        feature_flags: { allow_currency_selection: true, redirect_immediately: false },
      };
      if (customerEmail) body.customer = { email: customerEmail, name: customerName || "" };
      const session = await dodoApi("/checkouts", { method: "POST", body: JSON.stringify(body) });
      return send(res, 200, { success: true, data: { checkout_url: session.checkout_url, session_id: session.session_id } });
    }
    if (sub === "webhook") {
      const rawBody = JSON.stringify(req.body);
      if (!DODO_WH_SECRET) return send(res, 500, { received: false });
      const webhookId = req.headers["webhook-id"];
      const webhookSignature = req.headers["webhook-signature"];
      const webhookTimestamp = req.headers["webhook-timestamp"];
      if (!webhookId || !webhookSignature || !webhookTimestamp) return send(res, 401, { received: false });
      const { createHmac, timingSafeEqual } = await import("crypto");
      const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
      const computedSig = createHmac("sha256", DODO_WH_SECRET).update(signedContent).digest("base64");
      const expectedSigs = webhookSignature.split(" ").map(s => { const p = s.split(",").find(x => x.trim().startsWith("v1=")); return p ? p.trim().slice(3) : null; }).filter(Boolean);
      let valid = false;
      for (const sig of expectedSigs) { try { if (timingSafeEqual(Buffer.from(computedSig), Buffer.from(sig))) { valid = true; break; } } catch {} }
      if (!valid) return send(res, 401, { received: false });
      const eventType = req.body.type || req.body.event_type || "";
      const payload = req.body.data || req.body;
      const metadata = payload.metadata || {};
      const enrollmentId = metadata.enrollment_id;
      const paymentId = payload.id || payload.payment_id || "";
      if ((eventType === "payment.succeeded") && enrollmentId) {
        try {
          let verifiedStatus = false;
          if (DODO_KEY && paymentId) {
            try {
              const payment = await dodoApi(`/payments/${paymentId}`);
              verifiedStatus = payment?.status === "succeeded";
            } catch {}
          }
          if (!verifiedStatus) {
            console.warn("Dodo webhook: payment verification skipped or failed for", paymentId);
          }
          const db3 = await initFirebase();
          const enrRef = db3.collection("enrollments").doc(enrollmentId);
          await enrRef.update({ paymentStatus: "paid", paymentStage: "fully_paid", paidAt: now(), paymentIntentId: paymentId, updatedAt: now() });
          const snap3 = await enrRef.get();
          const enr = snap3.data();
          if (enr) {
            const projects = enr.projects || [];
            const submissions = enr.submissions || {};
            const allVerified = projects.length > 0 && projects.every((_, i) => submissions[i]?.verified);
            if (allVerified) {
              await enrRef.update({ allowedCertificate: "yes", status: "Completed", completedAt: now(), updatedAt: now() });
            }
          }
        } catch (e) { console.error("Dodo webhook update failed:", e.message); }
      } else if (eventType === "payment.failed" && enrollmentId) {
        try { const db4 = await initFirebase(); await db4.collection("enrollments").doc(enrollmentId).update({ paymentStatus: "failed", updatedAt: now() }); } catch {}
      }
      return send(res, 200, { received: true });
    }
    return send(res, 404, { success: false, message: `Unknown Dodo endpoint: ${sub}` });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

// One-time endpoint: copies all RTDB data to Firestore
// Call POST /api/migrate once after deploy, then remove this route
async function handleMigrate(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, message: "POST only" });
  // Simple secret check to prevent accidental triggers
  if (req.headers["x-migrate-secret"] !== process.env.MIGRATE_SECRET) {
    return send(res, 401, { success: false, message: "Invalid or missing x-migrate-secret header" });
  }
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getDatabase } = await import("firebase-admin/database");
    const { getFirestore } = await import("firebase-admin/firestore");
    const sa = getServiceAccount();
    if (!sa) return send(res, 500, { success: false, message: "Service account not configured" });

    // Use existing Firestore app
    const apps = getApps();
    const firestore = apps.length ? getFirestore(apps[0]) : (() => { const a = initializeApp({ credential: cert(sa), projectId: sa.project_id || "login-data-680b9" }); return getFirestore(a); })();

    // Init separate RTDB app for reading old data (needs databaseURL)
    const rtdbApp = initializeApp({ credential: cert(sa), databaseURL: "https://login-data-680b9-default-rtdb.firebaseio.com", projectId: sa.project_id || "login-data-680b9" }, "rtdb-migration");
    const rtdb = getDatabase(rtdbApp);

    const col = (n) => firestore.collection(n);
    const readRtdb = async (path) => { const s = await rtdb.ref(path).get(); return s.exists() ? s.val() : null; };
    const migrateMap = async (rt, fs) => {
      const data = await readRtdb(rt); if (!data || typeof data !== "object") return 0;
      let batch = firestore.batch(); let c = 0;
      for (const [k, v] of Object.entries(data)) {
        batch.set(col(fs).doc(k), (v && typeof v === "object" && !Array.isArray(v)) ? { id: k, ...v } : { id: k, value: v });
        c++; if (c % 400 === 0) { await batch.commit(); batch = firestore.batch(); }
      }
      if (c % 400 !== 0) await batch.commit(); return c;
    };

    let total = 0;
    total += await migrateMap("admins", "admins");
    total += await migrateMap("careerPaths", "careerPaths");
    total += await migrateMap("faqs", "faqs");
    total += await migrateMap("howItWorks", "howItWorks");
    total += await migrateMap("inquiries", "inquiries");
    total += await migrateMap("referralVisits", "referralVisits");
    total += await migrateMap("referrals", "referrals");
    total += await migrateMap("selfReferralOwners", "selfReferralOwners");
    total += await migrateMap("sentEmails", "sentEmails");
    total += await migrateMap("serviceRequests", "serviceRequests");
    total += await migrateMap("siteConfig", "siteConfig");
    total += await migrateMap("siteNotices", "siteNotices");
    total += await migrateMap("siteVisits", "siteVisits");
    total += await migrateMap("users", "users");
    total += await migrateMap("bannedUsers", "bannedUsers");
    total += await migrateMap("auditLog", "auditLog");
    total += await migrateMap("adminMessages", "adminMessages");
    total += await migrateMap("emailtamp", "emailtamp");

    const t = await readRtdb("config/templates");
    if (t) { await col("config").doc("templates").set(t); total++; }
    const a = await readRtdb("config/aboutText");
    if (a) { await col("config").doc("aboutText").set(a); total++; }

    const enrs = await readRtdb("enrollments");
    if (enrs) {
      let batch = firestore.batch(); let c = 0;
      for (const [id, e] of Object.entries(enrs)) { batch.set(col("enrollments").doc(id), { id, ...e }); c++; if (c % 400 === 0) { await batch.commit(); batch = firestore.batch(); } }
      if (c % 400 !== 0) await batch.commit(); total += c;
    }

    const ru = await readRtdb("referralUsers");
    if (ru) {
      let batch = firestore.batch(); let c = 0;
      for (const [code, users] of Object.entries(ru)) {
        if (users && typeof users === "object") {
          for (const [uid, d] of Object.entries(users)) {
            batch.set(col("referralUsers").doc(`${code}_${uid}`), { ...((typeof d === "object" && d) ? d : {}), code, uid });
            c++; if (c % 400 === 0) { await batch.commit(); batch = firestore.batch(); }
          }
        }
      }
      if (c % 400 !== 0) await batch.commit(); total += c;
    }

    const cp = await readRtdb("coupons");
    if (cp) { await col("coupons").doc("config").set({ value: cp, updatedAt: new Date().toISOString() }); total++; }
    const rc = await readRtdb("referralCodes");
    if (rc) { await col("referralCodes").doc("config").set({ value: rc }); total++; }

    return send(res, 200, { success: true, data: { total, message: `Migrated ${total} documents from RTDB to Firestore` } });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

async function handleFirebaseProxy(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, message: "Only POST allowed" });
  try {
    const db = await initFirebase();
    const { action, path, data, query } = req.body || {};
    if (!action || !path) return send(res, 400, { success: false, message: "action and path required" });

    const blockedWrites = ["admins", "users"];
    const root = path.split("/")[0];
    if (blockedWrites.includes(root) && ["set", "update", "push", "delete"].includes(action)) {
      return send(res, 403, { success: false, message: `Direct write to ${root}/ denied via proxy` });
    }

    let result;
    const parts = path.split("/");
    const collection = parts[0];

    // For list/query/push: path is a collection (1 segment)
    if (action === "list" || action === "query" || action === "push") {
      const colRef = db.collection(collection);
      if (action === "list") {
        const snap = await colRef.get();
        if (snap.empty) { result = []; } else { result = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
      } else if (action === "push") {
        const docRef = await colRef.add(data);
        result = { id: docRef.id, ...data };
      } else if (action === "query") {
        let q = colRef;
        if (query?.orderBy && query?.equalTo !== undefined) q = q.where(query.orderBy, "==", query.equalTo);
        if (query?.limitToLast) q = q.limit(query.limitToLast);
        if (query?.limitToFirst) q = q.limit(query.limitToFirst);
        const snap = await q.get();
        if (snap.empty) { result = query?.single ? null : []; } else if (query?.single) { result = { id: snap.docs[0].id, ...snap.docs[0].data() }; } else { result = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
      }
    } else {
      // For get/set/update/delete: path is collection/doc, possibly with nested field
      let docId = parts[1];
      let fieldPath = parts.length > 2 ? parts.slice(2).join(".") : null;
      // Special case: referralUsers uses composite doc ID code_uid
      if (parts.length >= 3 && parts[0] === "referralUsers") {
        docId = parts.slice(1).join("_");
        fieldPath = null;
      }
      const docRef = db.collection(collection).doc(docId);

      switch (action) {
        case "get": {
          const snap = await docRef.get();
          if (!snap.exists) { result = null; break; }
          const docData = snap.data();
          if (fieldPath) {
            const val = fieldPath.split(".").reduce((obj, key) => obj?.[key], docData);
            result = val !== undefined ? val : null;
          } else {
            result = docData;
          }
          break;
        }
        case "set": {
          if (fieldPath) {
            await docRef.set({ [fieldPath]: data }, { merge: true });
          } else {
            await docRef.set(data);
          }
          result = data;
          break;
        }
        case "update": {
          if (fieldPath) {
            const updateData = {};
            for (const [key, value] of Object.entries(data)) {
              updateData[`${fieldPath}.${key}`] = value;
            }
            await docRef.update(updateData);
          } else {
            await docRef.update(data);
          }
          result = data;
          break;
        }
        case "delete": {
          await docRef.delete();
          result = true;
          break;
        }
        default:
          return send(res, 400, { success: false, message: `Unknown action: ${action}` });
      }
    }
    return send(res, 200, { success: true, data: result });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

export default async function handler(req, res) {
  try {
  const rawUrl = (req.url || "");
  const reqPath = rawUrl.split("?")[0].replace(/^\/api\/?/, "");
  const parts = reqPath.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "ping") return send(res, 200, { success: true, message: "pong", env: { hasGoogle: !!GOOGLE_CLIENT_ID, node: process.version, url: rawUrl, method: req.method } });
    if (parts[0] === "auth" && parts[1] === "google") return handleAuth(req, res);
    if (parts[0] === "ai" && parts[1] === "verify-task") return handleAiVerify(req, res);
    if (parts[0] === "ai" && parts[1] === "grade-quiz") return handleAiGradeQuiz(req, res);
    if (parts[0] === "grade-quiz-text") return handleQuiz(req, res);
    if (parts[0] === "firebase-proxy") return handleFirebaseProxy(req, res);
    if (parts[0] === "migrate") return handleMigrate(req, res);
    if (parts[0] === "data") return handleData(req, res, parts.slice(1));
    if (parts[0] === "dodo") return handleDodo(req, res, parts.slice(1));
    console.warn("Unmatched API route:", { url: rawUrl, method: req.method, path: reqPath, parts, first: parts[0] });
    return send(res, 404, { success: false, message: `API route not found (${req.method} ${rawUrl})`, parts, first: parts[0] });
  } catch (error) {
    console.error("API error:", error);
    return send(res, 500, { success: false, message: error.message || "Server error." });
  }
}
