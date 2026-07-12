import { initCosmosDb, getSyncVersion, putSyncVersion } from "../server/cosmos.js";
import { firestoreGetDoc, firestoreSetDoc } from "../server/firestore.js";
import { generateText, generateImage, buildPromoPrompt } from "../server/aiContent.js";

const ROOT_ADMIN_EMAIL = "rutujdhodapkar@gmail.com";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";

function send(res, status, payload) {
  res.status(status).json(payload);
}

async function verifyFirebaseToken(idToken) {
  if (!idToken) return null;
  try {
    const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) return null;
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return null;
    const u = data.users[0];
    return { uid: u.localId, email: u.email, name: u.displayName, picture: u.photoUrl };
  } catch { return null; }
}

async function requireAdmin(db, req, res) {
  const idToken = req.body?.idToken || req.query?.idToken || req.headers["x-id-token"];
  const decoded = idToken ? await verifyFirebaseToken(idToken) : null;
  const email = decoded?.email ? cleanId(decoded.email).toLowerCase() : null;
  if (!email) return send(res, 401, { success: false, message: "Authentication required." });
  if (email === ROOT_ADMIN_EMAIL) return email;
  const adminDoc = await getDoc(db, "admins", emailId(email), null);
  if (!adminDoc) return send(res, 403, { success: false, message: "Unauthorized. Admin access required." });
  return email;
}

async function requireEnrollmentAccess(db, req, res, enrollment) {
  const idToken = req.body?.idToken || req.query?.idToken || req.headers["x-id-token"];
  const decoded = idToken ? await verifyFirebaseToken(idToken) : null;
  if (!decoded) {
    send(res, 401, { success: false, message: "Authentication required." });
    return null;
  }
  const email = decoded.email ? cleanId(decoded.email).toLowerCase() : null;
  const adminDoc = email ? await getDoc(db, "admins", emailId(email), null) : null;
  const isAdmin = email === ROOT_ADMIN_EMAIL || Boolean(adminDoc);
  if (!isAdmin && enrollment?.uid !== decoded.uid) {
    send(res, 403, { success: false, message: "You do not own this enrollment." });
    return null;
  }
  return { decoded, isAdmin };
}

async function requireAdminFromToken(db, idToken) {
  if (!idToken) return null;
  const decoded = await verifyFirebaseToken(idToken);
  const email = decoded?.email ? cleanId(decoded.email).toLowerCase() : null;
  if (!email) return null;
  if (email === ROOT_ADMIN_EMAIL) return email;
  const adminDoc = await getDoc(db, "admins", emailId(email), null);
  return adminDoc ? email : null;
}

async function adminWrite(db, req, res, writeFn) {
  const email = await requireAdmin(db, req, res);
  if (!email) return;
  return writeFn(email);
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

async function bumpVersion(db, key) {
  let attempt = 0;
  const maxRetries = 4;
  while (attempt <= maxRetries) {
    try {
      const vDoc = await getDoc(db, "siteConfig", "configVersions", null);
      const versions = vDoc?.value || {};
      versions[key] = now();
      await setDoc(db, "siteConfig", "configVersions", { value: versions, updatedAt: now() });
      return;
    } catch (e) {
      // 412 Precondition Failed / 409 Conflict — concurrent write, retry
      if (e.code === 412 || e.code === 409 || (e.message && (e.message.includes("412") || e.message.includes("precondition") || e.message.includes("ETag")))) {
        attempt++;
        if (attempt > maxRetries) {
          console.error(`[bumpVersion] FAILED after ${maxRetries} retries for key="${key}": ${e.message}`);
          return;
        }
        await new Promise(r => setTimeout(r, 50 * attempt)); // linear backoff: 50, 100, 150, 200ms
        continue;
      }
      // Non-conflict error — log but don't retry
      console.warn(`[bumpVersion] Non-retriable error for key="${key}": ${e.message}`);
      return;
    }
  }
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

async function getDoc(db, collection, id, fallback = null, options = null) {
  const snap = await db.collection(collection).doc(id).get(options || undefined);
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

    const ghMatch = u.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\/|$|\.git)/);
    if (ghMatch) {
      const owner = ghMatch[1], repo = ghMatch[2].replace(/\.git$/, "");
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

    // GitLab: blob URL → raw URL
    const glMatch = u.match(/gitlab\.com\/([\w.-]+)\/([\w.-]+?)(?:\/|$)/);
    if (glMatch) {
      const glOwner = glMatch[1], glRepo = glMatch[2];
      const glBlob = u.match(/gitlab\.com\/[\w.-]+\/[\w.-]+\/-\/blob\/([^/]+)\/(.+)/);
      if (glBlob) {
        const rawUrl = `https://gitlab.com/${glOwner}/${glRepo}/-/raw/${glBlob[1]}/${glBlob[2]}`;
        try {
          const res = await fetch(rawUrl);
          if (res.ok) {
            const content = await res.text();
            codeFiles.push({ path: `${glRepo}/${glBlob[2]}`, content: content.slice(0, 10000) });
          }
        } catch {}
      }
      continue;
    }

    // Bitbucket: src URL → raw URL
    const bbMatch = u.match(/bitbucket\.org\/([\w.-]+)\/([\w.-]+?)(?:\/|$)/);
    if (bbMatch) {
      const bbOwner = bbMatch[1], bbRepo = bbMatch[2];
      const bbSrc = u.match(/bitbucket\.org\/[\w.-]+\/[\w.-]+\/src\/([^/]+)\/(.+)/);
      if (bbSrc) {
        const rawUrl = `https://bitbucket.org/${bbOwner}/${bbRepo}/raw/${bbSrc[1]}/${bbSrc[2]}`;
        try {
          const res = await fetch(rawUrl);
          if (res.ok) {
            const content = await res.text();
            codeFiles.push({ path: `${bbRepo}/${bbSrc[2]}`, content: content.slice(0, 10000) });
          }
        } catch {}
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
    // Also try any raw-looking URL (direct file)
    if (/\.(js|jsx|ts|tsx|py|html|css|json|md|txt|rs|go|rb|php|java|cpp|c|cs|swift|kt|scala|sql|sh|yml|yaml)$/i.test(u) && u.startsWith("http")) {
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

  const db = await initCosmosDb();

  if (resource === "career-paths") {
    if (req.method === "GET") {
      const clientVersion = req.query?._v;
      if (clientVersion) {
        try {
          const vDoc = await getDoc(db, "siteConfig", "configVersions", null);
          const currentVersion = vDoc?.value?.careerPaths;
          if (currentVersion && clientVersion === currentVersion) {
            return res.status(304).end();
          }
        } catch {}
      }
      let paths = [];
      let categories = [];
      let vers = "";
      try {
        const vDoc = await getDoc(db, "siteConfig", "configVersions", null);
        vers = vDoc?.value?.careerPaths || "";
      } catch {}
      try {
        const fsPaths = await firestoreGetDoc("careerPaths", "_all");
        if (fsPaths?.list) {
          paths = fsPaths.list;
          const fsCats = await firestoreGetDoc("siteConfig", "domainCategories");
          categories = fsCats?.value || [];
        } else {
          throw new Error('no firestore data');
        }
      } catch {
        const cosPaths = await getDoc(db, "siteConfig", "careerPaths", null);
        paths = cosPaths?.value?.list || [];
        const cosCats = await getDoc(db, "siteConfig", "domainCategories", null);
        categories = cosCats?.value || [];
      }
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=3600");
      return send(res, 200, { success: true, data: { paths, categories }, _v: vers });
    }
    const adminEmail = await requireAdmin(db, req, res);
    if (!adminEmail) return;
    const paths = req.body.paths || [];
    try {
      await firestoreSetDoc("careerPaths", "_all", { list: paths, updatedAt: now() });
    } catch {}
    await replaceKeyedCollection(db, "careerPaths", paths, "path");
    await setDoc(db, "siteConfig", "careerPaths", { value: { list: paths }, updatedAt: now() });
    await bumpVersion(db, "careerPaths");
    if (req.body.categories) {
      try {
        await firestoreSetDoc("siteConfig", "domainCategories", { value: req.body.categories, updatedAt: now() });
      } catch {}
      await setDoc(db, "siteConfig", "domainCategories", { value: req.body.categories, updatedAt: now() });
    }
    const ps = (await getDoc(db, "siteConfig", "paymentSettings", null))?.value || { defaultAmount: 200, defaultAmountReferral: 170, defaultTiming: "end" };
    const domainOverrides = paths.filter(p => p.paymentAmount || p.paymentTiming).map(p => ({
      domain: p.title,
      amount: p.paymentAmount || null,
      amountReferral: p.paymentAmountReferral || null,
      timing: p.paymentTiming || null,
    }));
    ps.domains = domainOverrides;
    await setDoc(db, "siteConfig", "paymentSettings", { value: ps, updatedAt: now() });
    return send(res, 200, { success: true, data: { paths, categories: req.body.categories || [] } });
  }
  // ── Courses (Firestore + Cosmos fallback) ──
  if (resource === "courses") {
    const fallbackCourses = async (db) => {
      const cd = await getDoc(db, "siteConfig", "courses", null);
      return cd?.value?.list || cd?.value || [];
    };
    const fallbackContent = async (db, courseId) => {
      const cd = await getDoc(db, "siteConfig", `courseContent_${courseId}`, null);
      return cd?.value || null;
    };
    if (!id) {
      if (req.method === "GET") {
        const clientVersion = req.query?._v;
        if (clientVersion) {
          try {
            const vDoc = await getDoc(db, "siteConfig", "configVersions", null);
            if (vDoc?.value?.courses && clientVersion === vDoc.value.courses) {
              return res.status(304).end();
            }
          } catch {}
        }
        const fb = await firestoreGetDoc("courses", "_all");
        if (fb?.list) {
          res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=3600");
          return send(res, 200, { success: true, data: fb.list });
        }
        const cos = await fallbackCourses(db);
        res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=3600");
        return send(res, 200, { success: true, data: cos });
      }
      return adminWrite(db, req, res, async () => {
        const list = req.body.list || [];
        await firestoreSetDoc("courses", "_all", { list, updatedAt: now() });
        await setDoc(db, "siteConfig", "courses", { value: { list }, updatedAt: now() });
        await bumpVersion(db, "courses");
        return send(res, 200, { success: true, data: list });
      });
    }
    if (sub === "content") {
      if (req.method === "GET") {
        const clientVersion = req.query?._v;
        if (clientVersion) {
          try {
            const vDoc = await getDoc(db, "siteConfig", "configVersions", null);
            if (vDoc?.value?.courses && clientVersion === vDoc.value.courses) {
              return res.status(304).end();
            }
          } catch {}
        }
        let vers = "";
        try {
          const vDoc = await getDoc(db, "siteConfig", "configVersions", null);
          vers = vDoc?.value?.courses || "";
        } catch {}
        const fb = await firestoreGetDoc("courseContent", id);
        if (fb) return send(res, 200, { success: true, data: fb, _v: vers });
        const cos = await fallbackContent(db, id);
        if (cos) return send(res, 200, { success: true, data: cos, _v: vers });
        return send(res, 404, { success: false, message: "Course content not found" });
      }
      return adminWrite(db, req, res, async () => {
        await firestoreSetDoc("courseContent", id, { ...req.body, updatedAt: now() });
        await setDoc(db, "siteConfig", `courseContent_${id}`, { value: req.body, updatedAt: now() });
        return send(res, 200, { success: true, data: req.body });
      });
    }
    return send(res, 400, { success: false, message: "Invalid course route" });
  }
  // ── Course Enrollment ──
  async function fetchCourseContentFromPaths(courseId) {
    try {
      const fsPaths = await firestoreGetDoc("careerPaths", "_all");
      const list = fsPaths?.list || [];
      const path = list.find(p => p.id === courseId);
      return path?.content || null;
    } catch {
      const cosPaths = await getDoc(db, "siteConfig", "careerPaths", null);
      const list = cosPaths?.value?.list || [];
      const path = list.find(p => p.id === courseId);
      return path?.content || null;
    }
  }
  if (resource === "course-enroll") {
    if (req.method === "POST" && !id) {
      const { courseId, name, idToken } = req.body || {};
      const decoded = await verifyFirebaseToken(idToken);
      if (!decoded) return send(res, 401, { success: false, message: "Authentication required" });
      if (!courseId) return send(res, 400, { success: false, message: "courseId required" });
      const firestorePaths = await firestoreGetDoc("careerPaths", "_all");
      const paths = firestorePaths?.list || (await getDoc(db, "siteConfig", "careerPaths", null))?.value?.list || [];
      const course = paths.find((path) => path?.id === courseId && path.type === "course");
      if (!course) return send(res, 404, { success: false, message: "Course not found" });
      const existing = await db.collection("enrollments").where("uid", "==", decoded.uid).get();
      const enrolled = existing.docs.find((doc) => doc.data().courseId === courseId && doc.data().type === "course");
      if (enrolled) return send(res, 200, { success: true, data: { id: enrolled.id, ...enrolled.data() } });
      const paymentSettings = (await getDoc(db, "siteConfig", "paymentSettings", null))?.value || {};
      const amount = Math.max(0, Number(course.paymentAmount ?? course.price ?? paymentSettings.defaultAmount ?? 0));
      const paymentTiming = amount > 0 ? (course.paymentTiming || paymentSettings.defaultTiming || "end") : "none";
      const splitPercent = Math.min(100, Math.max(0, Number(course.paymentSplitPercent ?? paymentSettings.defaultSplitPercent ?? 50)));
      const paymentStartAmount = paymentTiming === "both" ? Math.round(amount * splitPercent / 100) : 0;
      const paymentEndAmount = paymentTiming === "both" ? amount - paymentStartAmount : amount;
      const enrollment = {
        type: "course", courseId, domainId: courseId, domain: course.title || courseId,
        uid: decoded.uid, email: cleanId(decoded.email).toLowerCase(), name: decoded.name || name || "Student",
        status: "Active", allowedCertificate: "no", progress: { completedBlocks: [] },
        courseBlockCount: Array.isArray(course.content) ? course.content.length : 0,
        paymentStatus: amount > 0 ? "none" : "paid", paymentStage: amount > 0 ? "none" : "fully_paid",
        paymentAmount: amount, paymentStartAmount, paymentEndAmount, paymentTiming, paymentIntentId: "",
        createdAt: now(), updatedAt: now(),
      };
      const ref = await db.collection("enrollments").add(enrollment);
      return send(res, 201, { success: true, data: { id: ref.id, ...enrollment } });
    }
    if (id && sub === "progress" && req.method === "PUT") {
      const enrollment = await getDoc(db, "enrollments", id, null);
      if (!enrollment || enrollment.type !== "course") return send(res, 404, { success: false, message: "Course enrollment not found" });
      if (!await requireEnrollmentAccess(db, req, res, enrollment)) return;
      const completedBlocks = [...new Set((req.body?.completedBlocks || []).filter((index) => Number.isInteger(index) && index >= 0 && index < enrollment.courseBlockCount))];
      const complete = enrollment.courseBlockCount > 0 && completedBlocks.length === enrollment.courseBlockCount;
      const paid = enrollment.paymentAmount <= 0 || (enrollment.paymentTiming === "both" ? enrollment.paymentStage === "fully_paid" : enrollment.paymentStatus === "paid");
      const patch = { progress: { ...(enrollment.progress || {}), completedBlocks }, updatedAt: now() };
      if (complete && paid) Object.assign(patch, { status: "Completed", allowedCertificate: "yes", completedAt: now() });
      await db.collection("enrollments").doc(id).update(patch);
      return send(res, 200, { success: true, data: { ...enrollment, ...patch } });
    }
    return send(res, 400, { success: false, message: "Invalid course-enroll route" });
  }
  if (resource === "how-it-works") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await listCollection(db, "howItWorks")).sort((a, b) => (a.step || 0) - (b.step || 0)) });
    return adminWrite(db, req, res, async () => {
      const data = await replaceKeyedCollection(db, "howItWorks", req.body.steps || [], "step");
      await bumpVersion(db, "howItWorks");
      return send(res, 200, { success: true, data });
    });
  }
  if (resource === "faqs") {
    if (req.method === "GET") return send(res, 200, { success: true, data: await listCollection(db, "faqs") });
    return adminWrite(db, req, res, async () => {
      const data = await replaceKeyedCollection(db, "faqs", req.body.faqs || [], "faq");
      await bumpVersion(db, "faqs");
      return send(res, 200, { success: true, data });
    });
  }
  if (resource === "templates") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await getDoc(db, "config", "templates", null))?.value || null });
    return adminWrite(db, req, res, async () => {
      const data = await setDoc(db, "config", "templates", { value: req.body.templates || {}, updatedAt: now() });
      await bumpVersion(db, "templates");
      return send(res, 200, { success: true, data: data.value });
    });
  }
  if (resource === "about-text") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await getDoc(db, "config", "aboutText", null))?.value || "" });
    return adminWrite(db, req, res, async () => {
      const data = await setDoc(db, "config", "aboutText", { value: req.body.text || "", updatedAt: now() });
      await bumpVersion(db, "aboutText");
      return send(res, 200, { success: true, data: data.value });
    });
  }
  if (resource === "payment-settings") {
    if (req.method === "GET") return getSetConfig(db, req, res, "paymentSettings", req.body);
    return adminWrite(db, req, res, async () => getSetConfig(db, req, res, "paymentSettings", req.body));
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
    const data = { ...req.body, referralCode: code, matched: Boolean(referral), visitedAt: req.body.visitedAt || now(), createdAt: now() };
    const newRef = await db.collection("referralVisits").add(data);
    if (referral) {
      await db.collection("referrals").doc(code).update({ visited: (referral.visited || 0) + 1, lastVisitedAt: data.visitedAt, updatedAt: now() });
    }
    data.id = newRef.id;
    return send(res, 201, { success: true, data });
  }
  if (resource === "associate-visits") {
    const { fingerprint, email, name, uid } = req.body || {};
    if (!fingerprint) return send(res, 400, { success: false, message: "Fingerprint required" });
    const updateData = { userId: uid || null, userEmail: email || null, userName: name || null, associatedAt: now() };
    let updated = 0;
    const refSnap = await db.collection("referralVisits").where("fingerprint", "==", fingerprint).get();
    if (!refSnap.empty) {
      const batch = db.batch();
      refSnap.docs.forEach((doc) => batch.update(doc.ref, updateData));
      await batch.commit();
      updated += refSnap.size;
    }
    const siteSnap = await db.collection("siteVisits").where("fingerprint", "==", fingerprint).get();
    if (!siteSnap.empty) {
      const batch = db.batch();
      siteSnap.docs.forEach((doc) => batch.update(doc.ref, updateData));
      await batch.commit();
      updated += siteSnap.size;
    }
    return send(res, 200, { success: true, data: { updated } });
  }
  if (resource === "referral-logins") return handleReferralLogin(db, req, res);
  if (resource === "check-admin") return handleCheckAdmin(db, req, res);
  if (resource === "admins") {
    if (req.method === "GET") return handleAdmins(db, req, res, id);
    return adminWrite(db, req, res, async () => handleAdmins(db, req, res, id));
  }
  if (resource === "self-referrals") return handleSelfReferrals(db, req, res);
  if (resource === "admin-referral-users") return send(res, 200, { success: true, data: await buildReferralUsers(db) });
  if (resource === "earn-settings") {
    if (req.method === "GET") return getSetConfig(db, req, res, "earnSettings", req.body.settings);
    return adminWrite(db, req, res, async () => {
      const r = await getSetConfig(db, req, res, "earnSettings", req.body.settings);
      await bumpVersion(db, "earnSettings");
      return r;
    });
  }
  if (resource === "earn-details") {
    if (req.method === "GET") return getSetConfig(db, req, res, "earnDetails", req.body.details);
    return adminWrite(db, req, res, async () => {
      const r = await getSetConfig(db, req, res, "earnDetails", req.body.details);
      await bumpVersion(db, "earnDetails");
      return r;
    });
  }
  if (resource === "banned-users") {
    if (req.method === "GET") return send(res, 200, { success: true, data: await listCollection(db, "bannedUsers") });
    return adminWrite(db, req, res, async () => handleBannedUsers(db, req, res, id));
  }
  if (resource === "admin-messages") {
    if (req.method === "GET") return handleMessages(db, req, res, id, sub);
    return adminWrite(db, req, res, async () => handleMessages(db, req, res, id, sub));
  }
  if (resource === "site-notices") {
    if (req.method === "GET") return handleNotices(db, req, res, id, sub);
    return adminWrite(db, req, res, async () => handleNotices(db, req, res, id, sub));
  }
  if (resource === "homepage") {
    if (req.method === "GET") return getSetConfig(db, req, res, "homepage", req.body.content);
    return adminWrite(db, req, res, async () => {
      const r = await getSetConfig(db, req, res, "homepage", req.body.content);
      await bumpVersion(db, "homepage");
      return r;
    });
  }
  if (resource === "what-do-you-get") {
    if (req.method === "GET") return getSetConfig(db, req, res, "whatDoYouGet", req.body.whatDoYouGet);
    return adminWrite(db, req, res, async () => {
      const r = await getSetConfig(db, req, res, "whatDoYouGet", req.body.whatDoYouGet);
      await bumpVersion(db, "whatDoYouGet");
      return r;
    });
  }
  if (resource === "university-collab") {
    if (req.method === "GET") return getSetConfig(db, req, res, "universityCollab", req.body.content);
    return adminWrite(db, req, res, async () => {
      const r = await getSetConfig(db, req, res, "universityCollab", req.body.content);
      await bumpVersion(db, "universityCollab");
      return r;
    });
  }
  if (resource === "logo-loop") {
    if (req.method === "GET") return getSetConfig(db, req, res, "logoLoop", req.body.content);
    return adminWrite(db, req, res, async () => {
      const r = await getSetConfig(db, req, res, "logoLoop", req.body.content);
      await bumpVersion(db, "logoLoop");
      return r;
    });
  }
  if (resource === "sliding-strips") {
    if (req.method === "GET") return getSetConfig(db, req, res, "slidingStrips", req.body.content);
    return adminWrite(db, req, res, async () => {
      const r = await getSetConfig(db, req, res, "slidingStrips", req.body.content);
      await bumpVersion(db, "slidingStrips");
      return r;
    });
  }
  // ── Bulk version check — one read returns all version timestamps ──
  if (resource === "versions") {
    if (req.method !== "GET") return send(res, 405, { error: "GET only" });
    const vDoc = await getDoc(db, "siteConfig", "configVersions", null);
    return send(res, 200, { success: true, data: vDoc?.value || {} });
  }
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
    return adminWrite(db, req, res, async () => send(res, 200, { success: true, data: (await setDoc(db, "siteConfig", "userTypes", { value: req.body || [], updatedAt: now() })).value }));
  }
  if (resource === "payout-config") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await getDoc(db, "siteConfig", "payoutConfig", null))?.value || { payoutDays: 30, defaultPayoutPerIntern: 30 } });
    return adminWrite(db, req, res, async () => send(res, 200, { success: true, data: (await setDoc(db, "siteConfig", "payoutConfig", { value: req.body || {}, updatedAt: now() })).value }));
  }
  if (resource === "audit-log") {
    if (req.method === "GET") return send(res, 200, { success: true, data: (await listCollection(db, "auditLog")).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 500) });
    return adminWrite(db, req, res, async () => send(res, 200, { success: true, data: (await pushDoc(db, "auditLog", { ...req.body, createdAt: now() })) }));
  }
  if (resource === "site-config") {
    const key = req.query?.key || id;
    if (req.method === "GET" && key) {
      const clientVersion = req.query?._v;
      if (clientVersion) {
        const vDoc = await getDoc(db, "siteConfig", "configVersions", null);
        const currentVersion = vDoc?.value?.[key];
        if (currentVersion && clientVersion === currentVersion) {
          res.status(304).end();
          return;
        }
      }
      const doc = await getDoc(db, "siteConfig", key, null);
      const vDoc = await getDoc(db, "siteConfig", "configVersions", null);
      return send(res, 200, { success: true, data: doc?.value || null, _v: vDoc?.value?.[key] || doc?.updatedAt || "" });
    }
    if (req.method === "PUT" && key) {
      return adminWrite(db, req, res, async () => {
        await setDoc(db, "siteConfig", key, { value: req.body?.value ?? req.body, updatedAt: now() });
        await bumpVersion(db, key);
        return send(res, 200, { success: true, data: req.body?.value ?? req.body });
      });
    }
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
  // Admin: download intern document (certificate / offer letter / any doc)
  if (resource === "admin-download" && id) {
    const adminEmail = await requireAdmin(db, req, res);
    if (!adminEmail) return;
    const enr = await getDoc(db, "enrollments", id, null);
    if (!enr) return send(res, 404, { success: false, message: "Enrollment not found." });
    const docType = (req.query?.type || req.body?.type || "certificate").toLowerCase();
    const allDocs = {
      certificate: true,
      "offer-letter": true,
      receipt: true,
    };
    if (!allDocs[docType]) return send(res, 400, { success: false, message: "Unknown document type." });
    // For certificate, auto-allow if admin is requesting
    if (enr.allowedCertificate !== "yes" && docType === "certificate") {
      await db.collection("enrollments").doc(id).update({ allowedCertificate: "yes", updatedAt: now() });
    }
    const templatesDoc = await getDoc(db, "config", "templates", null);
    const tpls = templatesDoc?.value?.templates || {};
    let html = "";
    if (docType === "offer-letter") html = tpls["Offer Letter"] || "";
    else if (docType === "certificate") html = tpls["Certificate"] || "";
    if (!html) return send(res, 200, { success: true, data: { html: "", message: "No template configured for " + docType } });
    const vars = {
      internName: enr.name || "",
      internId: enr.internId || id,
      domain: enr.domain || "",
      college: enr.college || "",
      city: enr.city || "",
      country: enr.country || "",
      email: enr.email || "",
      date: new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
      certificateId: `CERT-${String(enr.internId || id).toUpperCase()}`,
    };
    Object.entries(vars).forEach(([k, v]) => { html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || ""); });
    return send(res, 200, { success: true, data: { html, filename: `${docType}_${id}.html` } });
  }
  // Admin: update enrollment profile fields
  if (resource === "admin-update-enrollment" && id) {
    const adminEmail = await requireAdmin(db, req, res);
    if (!adminEmail) return;
    const allowedFields = [
      "name", "email", "phone", "college", "city", "country", "upiId", "photoURL",
      "domain", "domainId", "uid", "status", "referralCode",
      "paymentStatus", "paymentStage", "paymentAmount", "paymentStartAmount",
      "paymentEndAmount", "paymentTiming", "paymentIntentId", "transactionId",
      "allowedCertificate", "overrideCompleted", "duration",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    // Handle date fields separately with proper parsing
    const dateFields = ["startDate", "endDate", "deadline", "completedAt", "createdAt", "certificateDate"];
    for (const field of dateFields) {
      if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== "") {
        const d = new Date(req.body[field]);
        if (!isNaN(d.getTime())) updates[field] = d.toISOString();
      } else if (req.body[field] === null || req.body[field] === "") {
        updates[field] = null;
      }
    }
    // Clear fields
    if (req.body._clearFields) {
      req.body._clearFields.forEach(f => { updates[f] = null; });
    }
    if (Object.keys(updates).length === 0) return send(res, 400, { success: false, message: "No valid fields to update." });
    updates.updatedAt = now();
    updates.lastEditedBy = adminEmail;
    updates.taskVersion = now();
    await db.collection("enrollments").doc(id).update(updates);
    try {
      const enrSnap = await db.collection("enrollments").doc(id).get();
      const enr = enrSnap.data();
      if (enr?.uid) {
        await db.collection("users").doc(enr.uid).update({ externalUpdateVersion: now() });
      }
    } catch {}
    const updated = await getDoc(db, "enrollments", id, null);
    return send(res, 200, { success: true, data: updated });
  }
  return send(res, 404, { success: false, message: "Unknown API route." });
}

async function handleUsers(db, req, res, uid, sub, extra) {
  if (!uid) return send(res, 400, { success: false, message: "Missing user id." });
  if (!sub && req.method === "GET") {
    const data = await getDoc(db, "users", uid, null);
    const fields = req.query.fields;
    if (fields && data) {
      const selected = fields.split(",").reduce((acc, f) => { acc[f.trim()] = data[f.trim()]; return acc; }, {});
      return send(res, 200, { success: true, data: selected });
    }
    return send(res, 200, { success: true, data });
  }
  if (!sub && req.method === "POST") {
    const profile = req.body.profile || {};
    const newData = { ...profile, uid, _updatedBy: uid, externalUpdateVersion: 0, updatedAt: now() };
    return send(res, 200, { success: true, data: await setDoc(db, "users", uid, newData) });
  }
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
  if (!id && req.method === "GET") {
    const adminEmail = await requireAdmin(db, req, res);
    if (!adminEmail) return;
    return send(res, 200, { success: true, data: await listCollection(db, "enrollments") });
  }
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
      _updatedBy: req.body.uid,
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
      taskVersion: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    await setDoc(db, "enrollments", internId, enrollment, false);
    if (enrollment.referralCode) {
      const refCode = enrollment.referralCode;
      const contactSnap = await db.collection("referrals").doc(refCode).get();
      const contactData = contactSnap.data() || {};
      await db.collection("referrals").doc(refCode).update({ contacted: (contactData.contacted || 0) + 1, updatedAt: now() });
      const uid = enrollment.uid;
      if (uid) {
        await db.collection("referralUsers").doc(`${refCode}_${uid}`).set({
          uid, email: enrollment.email || "", displayName: enrollment.name || "",
          code: refCode, enrolledAt: now(), updatedAt: now(),
        }, { merge: true });
      }
    }
    return send(res, 201, { success: true, data: enrollment });
  }
  if (id && req.method === "GET") {
    const data = await getDoc(db, "enrollments", id, null);
    if (!data) return send(res, 404, { success: false, message: "Enrollment not found" });
    if (!await requireEnrollmentAccess(db, req, res, data)) return;
    const fields = req.query.fields;
    if (fields && data) {
      const selected = fields.split(",").reduce((acc, f) => { acc[f.trim()] = data[f.trim()]; return acc; }, {});
      return send(res, 200, { success: true, data: selected });
    }
    return send(res, 200, { success: true, data });
  }
  if (id && req.method === "DELETE") {
    const adminEmail = await requireAdmin(db, req, res);
    if (!adminEmail) return;
    return send(res, 200, { success: true, data: await deleteDoc(db, "enrollments", id) });
  }
  const existingEnrollment = id ? await getDoc(db, "enrollments", id, null) : null;
  if (id && !existingEnrollment) return send(res, 404, { success: false, message: "Enrollment not found" });
  if (id && !await requireEnrollmentAccess(db, req, res, existingEnrollment)) return;
  // Admin-only enrollment mutations (status, cert, payment, verify)
  const adminSubs = ["status", "certificate", "complete", "override-complete", "completion-reject", "payment-status", "payment-amount", "unverify-payment"];
  if (sub && (adminSubs.includes(sub) || (sub === "projects" && ["verify", "unverify", "feedback", "reject"].includes(extra2)))) {
    const adminEmail = await requireAdmin(db, req, res);
    if (!adminEmail) return;
  }
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
    if (extra2 === "submit" || extra2 === "quiz") {
      const snap = await db.collection("enrollments").doc(id).get();
      const enr = snap.data();
      const existingSub = enr?.submissions?.[projectIndex];
      if (existingSub?.submittedAt && !existingSub?.resubmit) {
        return send(res, 400, { success: false, message: "This task has already been submitted. Only resubmit after admin requests revision." });
      }
      if (existingSub?.verified) {
        return send(res, 400, { success: false, message: "This task is already verified and cannot be resubmitted." });
      }
    }
    if (extra2 === "submit") Object.assign(patch, { [base]: { text: req.body.submissionText || "", url: req.body.submissionUrl || "", submittedAt: now(), verified: false, rejected: false, resubmit: false } });
    if (extra2 === "quiz") {
      const quizAnswers = req.body.answers || {};
      const project = req.body.project || null;
      const patchData = { quizAnswers, project, submittedAt: now(), verified: false, rejected: false, resubmit: false, type: "quiz" };
      // Auto-grade MCQ quizzes that have answer keys
      if (project && project.quizQuestions && Array.isArray(project.quizQuestions)) {
        const allMCQ = project.quizQuestions.every(q => q.type === "option" && q.options?.length > 0);
        const allHaveKeys = project.quizQuestions.every(q => q.answer !== undefined && q.answer !== "");
        if (allMCQ && allHaveKeys) {
          const results = {};
          let correctCount = 0;
          project.quizQuestions.forEach((q, qi) => {
            const submitted = quizAnswers[qi];
            const correct = submitted === q.answer;
            results[qi] = correct;
            if (correct) correctCount++;
          });
          const score = Math.round((correctCount / project.quizQuestions.length) * 100);
          const passingGrade = project.passingGrade || 100;
          Object.assign(patchData, {
            verified: true,
            verifiedAt: now(),
            quizScore: score,
            quizPassed: score >= passingGrade,
            quizResults: results,
            aiVerified: true,
          });
        }
      }
      Object.assign(patch, { [base]: patchData });
    }
    if (extra2 === "verify") Object.assign(patch, { [`${base}.verified`]: true, [`${base}.verifiedAt`]: now(), [`${base}.rejected`]: false, [`${base}.aiVerified`]: req.body.aiVerified || false });
    if (extra2 === "unverify") Object.assign(patch, { [`${base}.verified`]: false, [`${base}.verifiedAt`]: null, [`${base}.aiVerified`]: false });
    if (extra2 === "feedback") Object.assign(patch, { [`${base}.feedback`]: req.body.feedback || "" });
    if (extra2 === "reject") Object.assign(patch, { [`${base}.verified`]: false, [`${base}.rejected`]: true, [`${base}.resubmit`]: true, [`${base}.feedback`]: req.body.feedback || "", [`${base}.rejectedAt`]: now() });
  }
  await db.collection("enrollments").doc(id).update(patch);

  // ── Version bumping ──
  // Admin task verification = bump taskVersion on enrollment
  if (sub === "projects" && ["verify", "unverify", "reject"].includes(extra2)) {
    try {
      await db.collection("enrollments").doc(id).update({ taskVersion: now() });
    } catch {}
  }
  // Admin status/cert/payment changes on enrollment = bump externalUpdateVersion on user doc
  if (sub && !(sub === "projects" && extra2 === "submit")) {
    try {
      const snap = await db.collection("enrollments").doc(id).get();
      const enr = snap.data();
      if (enr?.uid) {
        const userSnap = await db.collection("users").doc(enr.uid).get();
        const user = userSnap.data();
        if (user) {
          await db.collection("users").doc(enr.uid).update({ externalUpdateVersion: now() });
        }
      }
    } catch {}
  }

  const shouldCheckCompletion = extra2 === "verify" || sub === "payment-status";
  if (shouldCheckCompletion) {
    try {
      const snap = await db.collection("enrollments").doc(id).get();
      const enr = snap.data();
      if (enr) {
        const projects = enr.projects || [];
        const submissions = enr.submissions || {};
        const allVerified = projects.length > 0 && projects.every((_, i) => submissions[i]?.verified);
        const isPaid = enr.paymentTiming === "both" ? enr.paymentStage === "fully_paid" : enr.paymentStatus === "paid";
        const courseComplete = enr.type === "course" && enr.courseBlockCount > 0 && (enr.progress?.completedBlocks || []).length >= enr.courseBlockCount;
        if ((allVerified || courseComplete) && isPaid) {
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
  if (email === ROOT_ADMIN_EMAIL) {
    await setDoc(db, "admins", emailId(email), { email, createdAt: new Date().toISOString() });
    return send(res, 200, { success: true, isAdmin: true });
  }
  const adminDoc = await getDoc(db, "admins", emailId(email), null);
  return send(res, 200, { success: true, isAdmin: Boolean(adminDoc) });
}

async function handleAdmins(db, req, res, id) {
  if (req.method === "GET") return send(res, 200, { success: true, data: (await listCollection(db, "admins")).map((a) => a.email || a.id) });
  if (req.method === "POST") {
    const email = cleanId(req.body.email).toLowerCase();
    return send(res, 200, { success: true, data: await setDoc(db, "admins", emailId(email), { email, createdAt: now() }) });
  }
  if (req.method === "DELETE") {
    const rootDoc = await getDoc(db, "siteConfig", "rootAdmin", null);
    const rootEmail = rootDoc?.value?.email ? cleanId(rootDoc.value.email).toLowerCase() : null;
    if (rootEmail && emailId(id) === emailId(rootEmail)) {
      return send(res, 403, { success: false, message: "Root admin cannot be deleted." });
    }
    return send(res, 200, { success: true, data: await deleteDoc(db, "admins", emailId(id)) });
  }
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
  const [referral, interns, earnSettingsDoc] = await Promise.all([
    getDoc(db, "referrals", code, null),
    listReferralInterns(db, code),
    getDoc(db, "siteConfig", "earnSettings", null),
  ]);
  const earnSettings = earnSettingsDoc?.value || {};
  const rewardPerCompletion = earnSettings.rewardPerCompletion || 20;
  const milestoneBonus = earnSettings.milestoneBonus || 1000;
  const milestoneCount = earnSettings.milestoneCount || 50;
  const paidCompleted = interns.filter((i) => i.status === "Completed" && i.paymentStatus === "paid");
  const earnings = paidCompleted.length * rewardPerCompletion + Math.floor(paidCompleted.length / milestoneCount) * milestoneBonus;
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
  const keyPreview = DODO_KEY ? DODO_KEY.slice(0, 8) + "..." : "(empty)";
  console.log(`Dodo API call: ${base}${path} (env=${DODO_ENV}, key=${keyPreview})`);
  const response = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DODO_KEY}`, ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Dodo API error ${response.status}: ${text.slice(0, 300)} (key=${keyPreview}, env=${DODO_ENV})`);
    throw new Error(`Dodo API error ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

function dodoPaymentDetails(enrollment, requestedStage = "full") {
  const timing = enrollment?.paymentTiming || "end";
  const stage = requestedStage === "start" ? "start" : "end";
  if (timing === "both") {
    if (stage === "start") {
      if (enrollment.paymentStage === "start_paid" || enrollment.paymentStage === "fully_paid") throw new Error("The start payment has already been completed");
      return { stage, amount: Number(enrollment.paymentStartAmount) };
    }
    if (enrollment.paymentStage !== "start_paid") throw new Error("Complete the start payment before the final payment");
    return { stage, amount: Number(enrollment.paymentEndAmount) };
  }
  if (stage === "start") throw new Error("This enrollment does not have a start payment");
  if (enrollment?.paymentStatus === "paid") throw new Error("This enrollment has already been paid");
  return { stage: "full", amount: Number(enrollment?.paymentEndAmount || enrollment?.paymentAmount) };
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
      const { enrollmentId, customerEmail, customerName, paymentStage, idToken } = req.body || {};
      if (!enrollmentId) return send(res, 400, { success: false, message: "enrollmentId is required" });
      const decoded = await verifyFirebaseToken(idToken);
      if (!decoded) return send(res, 401, { success: false, message: "Authentication required" });
      const db2 = await initCosmosDb();
      const enrollment = (await db2.collection("enrollments").doc(enrollmentId).get()).data();
      if (!enrollment) return send(res, 404, { success: false, message: "Enrollment not found" });
      if (enrollment.uid !== decoded.uid) return send(res, 403, { success: false, message: "You do not own this enrollment" });
      let payment;
      try { payment = dodoPaymentDetails(enrollment, paymentStage); }
      catch (error) { return send(res, 400, { success: false, message: error.message }); }
      if (!Number.isFinite(payment.amount) || payment.amount <= 0) return send(res, 400, { success: false, message: "A valid enrollment payment amount is required" });
      let productId = DODO_PRODUCT_ID;
      if (!productId) {
        try {
          const snap2 = await db2.collection("siteConfig").doc("dodoConfig").get();
          const val = snap2.data();
          productId = val?.value?.productId || null;
        } catch {}
      }
      if (!productId) return send(res, 400, { success: false, message: "Dodo product not configured" });
      const amountPaise = Math.round(payment.amount * 100);
      const body = {
        product_cart: [{ product_id: productId, quantity: 1, amount: amountPaise }],
        metadata: { enrollment_id: enrollmentId, payment_stage: payment.stage },
        return_url: `${req.headers.origin || "https://devcraft.fennark.xyz"}/dashboard?dodo_success=1`,
        cancel_url: `${req.headers.origin || "https://devcraft.fennark.xyz"}/dashboard?dodo_cancelled=1`,
        billing_address: { country: "IN" },
        feature_flags: { allow_currency_selection: true, redirect_immediately: false },
      };
      if (customerEmail) body.customer = { email: customerEmail, name: customerName || "" };
      const session = await dodoApi("/checkouts", { method: "POST", body: JSON.stringify(body) });
      if (!session.checkout_url || !session.session_id) {
        throw new Error("Dodo did not return a checkout session URL");
      }
      // The browser SDK uses this value to select its checkout host. Keeping it
      // coupled to the server-side API environment prevents test/live URL swaps.
      return send(res, 200, { success: true, data: { checkout_url: session.checkout_url, session_id: session.session_id, mode: DODO_ENV } });
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
      const paymentMethod = payload.payment_method || payload.method || "";
      const paymentCurrency = payload.currency || "";
      const paymentAmount = payload.amount || 0;
      if ((eventType === "payment.succeeded") && enrollmentId) {
        try {
          let verifiedStatus = false;
          let verifiedPayment = null;
          if (DODO_KEY && paymentId) {
            try {
              const payment = await dodoApi(`/payments/${paymentId}`);
              verifiedStatus = payment?.status === "succeeded";
              verifiedPayment = payment;
              if (payment) {
                Object.assign(payload, { currency: payment.currency, amount: payment.amount, payment_method: payment.payment_method });
              }
            } catch {}
          }
          if (!DODO_KEY) {
            verifiedStatus = true;
          }
          if (!verifiedStatus) {
            console.warn("Dodo webhook: payment verification failed for", paymentId);
            return send(res, 402, { received: false, error: "payment verification failed" });
          }
          const db3 = await initCosmosDb();
          const enrRef = db3.collection("enrollments").doc(enrollmentId);
          const enrBefore = (await enrRef.get()).data();
          if (!enrBefore) return send(res, 404, { received: false, error: "enrollment not found" });
          const stage = metadata.payment_stage === "start" ? "start" : "end";
          let expectedPayment;
          try { expectedPayment = dodoPaymentDetails(enrBefore, stage); }
          catch (error) { return send(res, 400, { received: false, error: error.message }); }
          const verifiedAmount = Number(verifiedPayment?.amount ?? paymentAmount);
          if (verifiedAmount !== Math.round(expectedPayment.amount * 100)) {
            console.warn("Dodo webhook: payment amount mismatch", { enrollmentId, paymentId, verifiedAmount, expectedAmount: expectedPayment.amount });
            return send(res, 400, { received: false, error: "payment amount mismatch" });
          }
          const updateData = {
            paymentStatus: "paid", paymentStage: expectedPayment.stage === "start" ? "start_paid" : "fully_paid",
            paidAt: now(), paymentIntentId: paymentId,
            transactionId: paymentId, paymentMethod,
            paymentCurrency: verifiedPayment?.currency || paymentCurrency,
            paidAmount: expectedPayment.amount,
            paymentGateway: "dodo", updatedAt: now()
          };
          await enrRef.update(updateData);
          const historyRef = db3.collection("paymentHistory").doc();
          await historyRef.set({
            enrollmentId, paymentId, eventType: "payment.succeeded",
            amount: expectedPayment.amount, currency: verifiedPayment?.currency || paymentCurrency,
            method: paymentMethod, gateway: "dodo",
            createdAt: now(), updatedAt: now()
          });
          const snap3 = await enrRef.get();
          const enr = snap3.data();
          if (enr) {
            const projects = enr.projects || [];
            const submissions = enr.submissions || {};
            const allVerified = projects.length > 0 && projects.every((_, i) => submissions[i]?.verified);
            const courseComplete = enr.type === "course" && enr.courseBlockCount > 0 && (enr.progress?.completedBlocks || []).length >= enr.courseBlockCount;
            if ((allVerified || courseComplete) && updateData.paymentStage === "fully_paid") {
              await enrRef.update({ allowedCertificate: "yes", status: "Completed", completedAt: now(), updatedAt: now() });
            }
          }
          if (enr && enr.uid) {
            await bumpSyncVersions(db3, ["tasks", "certs"], enr.uid);
          }
        } catch (e) { console.error("Dodo webhook update failed:", e.message); }
      } else if (eventType === "payment.failed" && enrollmentId) {
        try {
          const db4 = await initCosmosDb();
          const enrRef4 = db4.collection("enrollments").doc(enrollmentId);
          const snap4 = await enrRef4.get();
          const enr4 = snap4.data();
          // Do not overwrite a completed payment because a different/retried
          // checkout session failed later.
          const failedUpdate = enr4?.paymentStatus === "paid"
            ? { lastPaymentFailedAt: now(), lastPaymentFailedId: paymentId, updatedAt: now() }
            : { paymentStatus: "failed", updatedAt: now() };
          await enrRef4.update(failedUpdate);
          if (enr4 && enr4.uid) {
            await bumpSyncVersions(db4, ["tasks", "certs"], enr4.uid);
          }
          const failRef = db4.collection("paymentHistory").doc();
          await failRef.set({
            enrollmentId, paymentId, eventType: "payment.failed",
            amount: paymentAmount, currency: paymentCurrency,
            method: paymentMethod, gateway: "dodo",
            createdAt: now(), updatedAt: now()
          });
        } catch {}
      }
      return send(res, 200, { received: true });
    }
    return send(res, 404, { success: false, message: `Unknown Dodo endpoint: ${sub}` });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

async function handleQR(req, res, enrollmentId) {
  try {
    const QRCode = await import("qrcode");
    const origin = req.headers["x-forwarded-host"] ? `https://${req.headers["x-forwarded-host"]}` : `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host || "devcraft.fennark.xyz"}`;
    const verifyUrl = `${origin}/verify/${encodeURIComponent(enrollmentId)}`;
    const svg = await QRCode.toString(verifyUrl, { type: "svg", width: 400, margin: 2, color: { dark: "#000", light: "#fff" } });
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).send(svg);
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

async function handleVerify(req, res, enrollmentId) {
  try {
    const db = await initCosmosDb();
    const snap = await db.collection("enrollments").doc(enrollmentId).get();
    let html;
    if (!snap.exists) {
      html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;text-align:center;padding:40px;background:#f5f5f5}h1{color:#d32f2f}p{font-size:18px}</style></head><body><h1>Not Found</h1><p>No intern found with ID: ${escapeHtml(enrollmentId)}</p></body></html>`;
    } else {
      const e = snap.data();
      const statusColor = e.status === "Completed" ? "#2e7d32" : e.status === "Active" ? "#1565c0" : "#ff8f00";
      const certStatus = e.allowedCertificate === "yes" ? "Available" : "Locked";
      html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;text-align:center;padding:40px;background:#f5f5f5}h1{color:#333}h2{color:${statusColor}}table{margin:20px auto;border-collapse:collapse}td{padding:8px 16px;border-bottom:1px solid #ddd;text-align:left}td:first-child{font-weight:700;color:#555}</style></head><body><h1>${escapeHtml(e.name || "Intern")}</h1><h2>${escapeHtml(e.domain || "")}</h2><table><tr><td>Status</td><td>${escapeHtml(e.status || "N/A")}</td></tr><tr><td>Intern ID</td><td>${escapeHtml(e.internId || enrollmentId)}</td></tr><tr><td>Certificate</td><td>${certStatus}</td></tr><tr><td>Started</td><td>${e.createdAt ? new Date(e.createdAt).toLocaleDateString() : "N/A"}</td></tr><tr><td>Completed</td><td>${e.completedAt ? new Date(e.completedAt).toLocaleDateString() : "In progress"}</td></tr></table><p style="margin-top:30px;color:#888;font-size:14px">DEV/CRAFT Virtual Internship</p></body></html>`;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

function escapeHtml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function handleVerifyData(req, res, enrollmentId) {
  try {
    const db = await initCosmosDb();
    const snap = await db.collection("enrollments").doc(enrollmentId).get();
    if (!snap.exists) return send(res, 200, { success: false, message: "No intern found with this ID." });
    const e = snap.data();
    return send(res, 200, { success: true, data: {
      name: e.name || "Intern",
      domain: e.domain || "",
      status: e.status || "N/A",
      internId: e.internId || enrollmentId,
      certificate: e.allowedCertificate === "yes" ? "Available" : "Locked",
      started: e.createdAt ? new Date(e.createdAt).toLocaleDateString() : "N/A",
      completed: e.completedAt ? new Date(e.completedAt).toLocaleDateString() : "In progress",
    }});
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
if (!CRYPTO_SECRET) {
  console.error("[cert] CRYPTO_SECRET is not configured; certificate signing disabled.");
}

function parseDuration(durationStr) {
  if (!durationStr) return 28;
  const str = String(durationStr).toLowerCase().trim();
  const num = parseInt(str, 10) || 1;
  if (str.includes("month")) return num * 30;
  if (str.includes("week")) return num * 7;
  if (str.includes("day")) return num;
  return 28;
}

async function handleCertificateData(req, res, enrollmentId) {
  try {
    const db = await initCosmosDb();
    const idToken = req.body?.idToken;
    const decoded = idToken ? await verifyFirebaseToken(idToken) : null;
    if (!decoded) return send(res, 401, { success: false, message: "Authentication required." });

    const snap = await db.collection("enrollments").doc(enrollmentId).get();
    if (!snap.exists) return send(res, 404, { success: false, message: "Enrollment not found." });

    const enrollment = snap.data();

    // Verify ownership or admin (using emailId for Cosmos admin lookup)
    const adminEmail = decoded?.email ? cleanId(decoded.email).toLowerCase() : null;
    let isAdmin = false;
    if (adminEmail) {
      if (adminEmail === ROOT_ADMIN_EMAIL) {
        isAdmin = true;
      } else {
        try {
          const adminSnap = await db.collection("admins").doc(emailId(adminEmail)).get();
          isAdmin = adminSnap?.exists;
        } catch {}
      }
    }
    const isOwner = enrollment.uid === decoded.uid || enrollment.userId === decoded.uid;
    if (!isAdmin && !isOwner) return send(res, 403, { success: false, message: "Access denied." });

    // Server-side condition check
    const projects = enrollment.projects || [];
    const submissions = enrollment.submissions || {};
    const allVerified = projects.length > 0 && projects.every((_, i) => submissions[i]?.verified);
    const isPaid = enrollment.paymentTiming === "both" ? enrollment.paymentStage === "fully_paid" : enrollment.paymentStatus === "paid";
    const courseComplete = enrollment.type === "course" && enrollment.courseBlockCount > 0 && (enrollment.progress?.completedBlocks || []).length >= enrollment.courseBlockCount;
    const eligible = enrollment.allowedCertificate === "yes" || ((allVerified || courseComplete) && (isPaid || enrollment.status === "Completed"));
    const status = eligible ? "Completed" : (enrollment.status || "Active");

    // Get org settings (MSME ID)
    const orgDoc = await getDoc(db, "siteConfig", "organization", null);
    const msmeId = orgDoc?.value?.msmeId || "";

    // Date computations — use stored startDate/endDate if available, else calculate from createdAt + duration
    const start = enrollment.startDate ? new Date(enrollment.startDate) : new Date(enrollment.createdAt || Date.now());
    const end = enrollment.endDate ? new Date(enrollment.endDate) : new Date(start.getTime() + parseDuration(enrollment.duration) * 24 * 60 * 60 * 1000);
    const certDate = enrollment.certificateDate ? new Date(enrollment.certificateDate) : start;
    const fmt = (d) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const origin = req.headers["x-forwarded-host"] ? `https://${req.headers["x-forwarded-host"]}` : `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host || "devcraft.fennark.xyz"}`;
    const qrCodeUrl = `${origin}/api/qr/${encodeURIComponent(enrollment.id || enrollment.internId || enrollmentId)}`;

    const certData = {
      name: enrollment.name || "",
      email: enrollment.email || "",
      domain: enrollment.domain || "",
      internId: enrollment.internId || enrollment.id || enrollmentId,
      id: enrollment.id || enrollmentId,
      status,
      completed: eligible ? "Yes" : "No",
      msmeId,
      date: fmt(certDate),
      startDate: fmt(start),
      endDate: fmt(end),
      qrCodeUrl,
      eligible,
      verifiedTasks: allVerified,
      paymentComplete: isPaid,
    };

    // HMAC signature
    if (!CRYPTO_SECRET) return send(res, 500, { success: false, message: "CRYPTO_SECRET is not configured." });
    const { createHmac } = await import("crypto");
    const hmac = createHmac("sha256", CRYPTO_SECRET);
    hmac.update(JSON.stringify({ name: certData.name, domain: certData.domain, status: certData.status, internId: certData.internId, date: certData.date }));
    certData._signature = hmac.digest("hex");

    return send(res, 200, { success: true, data: certData });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

async function handleFirebaseProxy(req, res) {
  if (req.method !== "POST") return send(res, 405, { success: false, message: "Only POST allowed" });
  try {
    const db = await initCosmosDb();
    const { action, path, data, query } = req.body || {};
    if (!action || !path) return send(res, 400, { success: false, message: "action and path required" });

    // Optional read consistency: clients pass consistencyLevel:"Eventual" for
    // non-critical reads (badges/certs). Writes keep the default (Session+); we
    // deliberately do NOT alter consistency on task-state change paths.
    const readOpts = req.body?.consistencyLevel ? { consistencyLevel: req.body.consistencyLevel } : undefined;

    const adminCollections = ["admins", "siteConfig", "config", "careerPaths", "howItWorks", "faqs", "bannedUsers", "adminMessages", "siteNotices", "auditLog", "badges", "userBadges"];
    const root = path.split("/")[0];
    const isWrite = ["set", "update", "push", "delete"].includes(action);
    let decoded = null;

    // Enrollment records include student identity, submissions, and payment
    // data. They are visible only to their owner or an administrator.
    if (!isWrite && root === "enrollments") {
      decoded = await verifyFirebaseToken(req.body?.idToken);
      if (!decoded) return send(res, 401, { success: false, message: "Authentication required to read enrollments." });
      const email = decoded.email ? cleanId(decoded.email).toLowerCase() : null;
      const adminDoc = email ? await getDoc(db, "admins", emailId(email), null) : null;
      const isAdmin = email === ROOT_ADMIN_EMAIL || Boolean(adminDoc);
      const pathParts = path.split("/");
      if (action === "list" && !isAdmin) return send(res, 403, { success: false, message: "Administrator access is required to list enrollments." });
      if (action === "query" && !isAdmin) {
        const ownUidQuery = query?.orderBy === "uid" && query?.equalTo === decoded.uid;
        const ownEmailQuery = query?.orderBy === "email" && query?.equalTo === decoded.email;
        if (!ownUidQuery && !ownEmailQuery) return send(res, 403, { success: false, message: "You may only query your own enrollments." });
      }
      if (action === "get" && pathParts[1] && !isAdmin) {
        const enrollment = await getDoc(db, "enrollments", pathParts[1], null);
        if (enrollment?.uid !== decoded.uid) return send(res, 403, { success: false, message: "You do not own this enrollment." });
      }
    }

    // Badge awards are private to each student. Definition reads are public,
    // but only administrators may create, revoke, or enumerate awards.
    if (!isWrite && root === "userBadges") {
      decoded = await verifyFirebaseToken(req.body?.idToken);
      if (!decoded) return send(res, 401, { success: false, message: "Authentication required to read badge awards." });
      const email = decoded.email ? cleanId(decoded.email).toLowerCase() : null;
      const adminDoc = email ? await getDoc(db, "admins", emailId(email), null) : null;
      const isAdmin = email === ROOT_ADMIN_EMAIL || Boolean(adminDoc);
      if (action === "list" && !isAdmin) return send(res, 403, { success: false, message: "Administrator access is required to list badge awards." });
      if (action === "query" && !isAdmin && !(query?.orderBy === "userId" && query?.equalTo === decoded.uid)) {
        return send(res, 403, { success: false, message: "You may only read your own badge awards." });
      }
      if (action === "get" && !isAdmin) {
        const award = await getDoc(db, "userBadges", path.split("/")[1], null);
        if (!award || award.userId !== decoded.uid) return send(res, 403, { success: false, message: "You do not own this badge award." });
      }
    }

    if (isWrite && adminCollections.includes(root)) {
      const adminEmail = await requireAdmin(db, req, res);
      if (!adminEmail) return;
    }

    // Require auth on all non-admin writes (enrollments, referrals, users, etc.)
    if (isWrite && !adminCollections.includes(root)) {
      decoded = await verifyFirebaseToken(req.body?.idToken);
      if (!decoded) return send(res, 401, { success: false, message: "Authentication required for writes." });
      // For enrollments: verify uid ownership or admin
      if (root === "enrollments") {
        const parts = path.split("/");
        const docId = parts[1];
        if (docId && action !== "push") {
          const doc = await getDoc(db, "enrollments", docId, null);
          const email = decoded.email ? cleanId(decoded.email).toLowerCase() : null;
          const adminDoc = email ? await getDoc(db, "admins", emailId(email), null) : null;
          const isAdmin = email === ROOT_ADMIN_EMAIL || Boolean(adminDoc);
          if (doc && doc.uid !== decoded.uid && !isAdmin) {
            return send(res, 403, { success: false, message: "Unauthorized. You do not own this enrollment." });
          }
          // Enrollment owners may record a UPI reference and learning progress,
          // but never payment, certificate, status, or task-verification fields.
          if (!isAdmin && action === "update") {
            const ownerWritableFields = new Set(["transactionId", "progress", "updatedAt"]);
            if (parts.length !== 2 || !data || Object.keys(data).some((key) => !ownerWritableFields.has(key))) {
              return send(res, 403, { success: false, message: "This enrollment field can only be changed by an administrator." });
            }
          } else if (!isAdmin && action !== "update") {
            return send(res, 403, { success: false, message: "Enrollment changes require administrator access." });
          }
        } else if (action === "push" && data?.uid && data.uid !== decoded.uid) {
          return send(res, 403, { success: false, message: "Cannot create enrollment for another user." });
        }
      }
    }

    let result;
    const parts = path.split("/");
    const collection = parts[0];

    if (action === "list" || action === "query" || action === "push") {
      const colRef = db.collection(collection);
      if (action === "list") {
        const snap = await colRef.get(readOpts);
        if (snap.empty) { result = []; } else { result = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
      } else if (action === "push") {
        const docRef = await colRef.add(data);
        result = { id: docRef.id, ...data };
      } else if (action === "query") {
        let q = colRef;
        if (query?.orderBy && query?.equalTo !== undefined) q = q.where(query.orderBy, "==", query.equalTo);
        if (query?.limitToLast) q = q.limit(query.limitToLast);
        if (query?.limitToFirst) q = q.limit(query.limitToFirst);
        const snap = await q.get(readOpts);
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
          const snap = await docRef.get(readOpts);
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
            await docRef.set(updateData, { merge: true });
          } else {
            await docRef.set(data, { merge: true });
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
    if (isWrite) {
      const syncBuckets = BUCKET_FOR_COLLECTION[collection];
      if (syncBuckets && syncBuckets.length) {
        // Scope the invalidation to the user whose data actually changed.
        const affectedUid =
          (data && (data.uid || data.userId)) ||
          (decoded && decoded.uid) ||
          null;
        await bumpSyncVersions(db, syncBuckets, affectedUid);
      }
    }
    return send(res, 200, { success: true, data: result });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

// ─── Email Automation ──────────────────────────────────────────────────────
async function handleEmail(req, res, parts) {
  const sub = parts[0] || '';
  const db = await initCosmosDb();
  if (!db) return send(res, 503, { success: false, message: 'Firebase not configured' });
  const { sendEmail, isConfigured } = await import('../server/brevoClient.js');
  const { renderTemplate, TEMPLATES, getTemplate } = await import('../server/emailTemplates.js');
  const { runDailyCron, getEmailStats, processEmailCampaign, determineLifecycleStages, EMAIL_TYPES, EMAIL_CATEGORIES, triggerManualType } = await import('../server/emailEngine.js');

  if (sub === 'trigger' && req.method === 'POST') {
    const { type, email, dryRun } = req.query || {};
    if (!type) return send(res, 400, { success: false, message: 'type query param required' });
    const result = await triggerManualType(db, type, email || null, dryRun === 'true');
    return send(res, 200, { success: true, data: result });
  }
  if (sub === 'run' && req.method === 'POST') {
    const result = await runDailyCron(db);
    return send(res, 200, { success: true, data: result });
  }
  if (sub === 'dry-run' && req.method === 'POST') {
    const config = req.body?.config || {};
    const result = await processEmailCampaign(db, config, true);
    return send(res, 200, { success: true, data: result });
  }
  if (sub === 'send-test' && req.method === 'POST') {
    const { email, type, name, domain } = req.body || {};
    if (!email || !type) return send(res, 400, { success: false, message: 'email and type required' });
    const rendered = renderTemplate(type, {
      name: name || 'Test User', domain: domain || 'Web Development', amount: '200',
      enrolledSince: '5 days ago', deadline: '2026-07-10', daysUntilDeadline: '3',
      pendingTasks: '2', taskList: [{ title: 'Project 1', status: 'Pending' }],
      completedProjects: '1', totalProjects: '3', status: 'active',
      completedAt: '2026-07-01',
      unsubscribeUrl: `https://devcraft.fennark.xyz/api/email/unsubscribe?email=${encodeURIComponent(email)}`,
    });
    if (!rendered) return send(res, 400, { success: false, message: `Unknown email type: ${type}` });
    const result = await sendEmail({ to: email, subject: rendered.subject, html: rendered.html, type });
    return send(res, 200, { success: true, data: result });
  }
  if (sub === 'templates' && !parts[1] && req.method === 'GET') {
    const templates = {};
    for (const [type, tpl] of Object.entries(TEMPLATES)) {
      templates[type] = { subject: tpl.subject, defaultCategory: tpl.defaultCategory || 'general', sendOnce: tpl.sendOnce || false, intervalDays: tpl.intervalDays || 0 };
    }
    return send(res, 200, { success: true, data: templates });
  }
  if (sub === 'templates' && parts[1] && req.method === 'GET') {
    const tpl = getTemplate(parts[1]);
    if (!tpl) return send(res, 404, { success: false, message: `Unknown template: ${parts[1]}` });
    let customHtml = null, customSubject = null;
    try { const snap = await db.collection('emailTemplates').doc(parts[1]).get(); if (snap.exists) { customHtml = snap.data().html; customSubject = snap.data().subject; } } catch (e) {}
    return send(res, 200, { success: true, data: { type: parts[1], subject: tpl.subject, defaultCategory: tpl.defaultCategory || 'general', sendOnce: tpl.sendOnce || false, intervalDays: tpl.intervalDays || 0, customHtml, customSubject } });
  }
  if (sub === 'templates' && parts[1] && req.method === 'PUT') {
    const { html, subject } = req.body || {};
    await db.collection('emailTemplates').doc(parts[1]).set({ html: html || '', subject: subject || '', updatedAt: new Date().toISOString() }, { merge: true });
    return send(res, 200, { success: true, data: { type: parts[1], updated: true } });
  }
  if (sub === 'templates' && parts[1] && req.method === 'DELETE') {
    await db.collection('emailTemplates').doc(parts[1]).delete();
    return send(res, 200, { success: true, data: { type: parts[1], reset: true } });
  }
  if (sub === 'config' && req.method === 'GET') {
    const snap = await db.collection('siteConfig').doc('emailConfig').get();
    return send(res, 200, { success: true, data: snap.exists ? snap.data().value || {} : {} });
  }
  if (sub === 'config' && req.method === 'PUT') {
    await db.collection('siteConfig').doc('emailConfig').set({ value: req.body || {}, updatedAt: new Date().toISOString() }, { merge: true });
    return send(res, 200, { success: true, data: req.body || {} });
  }
  if (sub === 'stats' && req.method === 'GET') {
    const stats = await getEmailStats(db);
    return send(res, 200, { success: true, data: stats });
  }
  if (sub === 'logs' && req.method === 'GET') {
    const maxLimit = Math.min(parseInt(req.query?.limit) || 100, 500);
    try {
      const snap = await db.collection('emailLogs').orderBy('sentAt', 'desc').limit(maxLimit).get();
      let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (req.query?.type) logs = logs.filter(l => l.type === req.query.type);
      if (req.query?.status) logs = logs.filter(l => l.status === req.query.status);
      return send(res, 200, { success: true, data: logs });
    } catch (e) {
      const snap = await db.collection('emailLogs').get();
      let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
      return send(res, 200, { success: true, data: logs.slice(0, maxLimit) });
    }
  }
  if (sub === 'unsubscribe' && req.method === 'GET') {
    const email = req.query?.email;
    const done = req.query?.done;
    if (!email) return send(res, 400, { success: false, message: 'Email required' });
    const docId = email.toLowerCase().replace(/\./g, ',');
    const snap = await db.collection('emailSubscriptions').doc(docId).get();
    const subData = snap.exists ? snap.data() : null;

    if (done === 'all') {
      if (subData) await db.collection('emailSubscriptions').doc(docId).update({ status: 'unsubscribed', unsubscribedAt: new Date().toISOString() });
      else await db.collection('emailSubscriptions').doc(docId).set({ email: email.toLowerCase(), status: 'unsubscribed', categories: {}, subscribedAt: new Date().toISOString(), unsubscribedAt: new Date().toISOString() });
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(
        `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Unsubscribed</title><style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
          .card{max-width:520px;width:100%;border:2px solid #000;box-shadow:6px 6px 0 #000;padding:32px}
          h1{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
          .sub{color:#888;font-size:13px;margin-bottom:20px}
          hr{border:none;border-top:2px solid #000;margin:16px 0}
          .btn{display:inline-block;padding:10px 24px;background:#000;color:#fff;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:2px solid #000}
          p{font-size:14px;color:#444;margin-bottom:10px}
          .msg{padding:10px 14px;border:2px solid #34A853;font-size:13px;font-weight:700;margin-bottom:16px}
        </style></head><body>
        <div class="card">
          <h1>Unsubscribed</h1>
          <div class="sub">DEV/CRAFT Internship Platform</div>
          <div class="msg">You have been unsubscribed from all emails.</div>
          <p>You will not receive any further messages from DEV/CRAFT.</p>
          <hr><a class="btn" href="https://devcraft.fennark.xyz">Return to Website</a>
        </div></body></html>`
      );
    }

    // Load categories from config
    const categories = {};
    try {
      const cfgSnap = await db.collection('siteConfig').doc('emailConfig').get();
      if (cfgSnap.exists) {
        const cfg = cfgSnap.data();
        for (const [key, val] of Object.entries(cfg.types || {})) {
          if (val.active !== false) {
            categories[key] = { label: key.replace(/_/g, ' ') };
          }
        }
      }
    } catch (_) {}

    const catParam = req.query?.cat || '';
    const isUnsubscribed = subData?.status === 'unsubscribed';
    const catCheckboxes = Object.entries(categories).map(([key]) =>
      `<label><input type="checkbox" name="cats" value="${key}"${!isUnsubscribed || key === catParam ? ' checked' : ''}>${key.replace(/_/g, ' ')}</label>`
    ).join('');

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Email Preferences</title><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
        .card{max-width:520px;width:100%;border:2px solid #000;box-shadow:6px 6px 0 #000;padding:32px}
        h1{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
        .sub{color:#888;font-size:13px;margin-bottom:20px}
        hr{border:none;border-top:2px solid #000;margin:16px 0}
        .btn{display:inline-block;padding:10px 24px;background:#000;color:#fff;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:2px solid #000;cursor:pointer;font-family:inherit}
        .btn-outline{background:#fff;color:#000;font-size:11px;padding:6px 14px}
        p{font-size:14px;color:#444;margin-bottom:10px;line-height:1.6}
        label{display:flex;align-items:center;gap:8px;padding:8px 0;font-size:14px;color:#333;cursor:pointer;border-bottom:1px solid #eee}
        label input{margin:0;width:16px;height:16px;accent-color:#000;cursor:pointer}
      </style></head><body>
      <div class="card">
        <h1>Email Preferences</h1>
        <div class="sub">DEV/CRAFT Internship Platform</div>
        <p>Manage the types of emails you receive.</p>
        <hr>
        <form method="POST" action="/api/email/unsubscribe" style="margin-bottom:16px">
          <input type="hidden" name="email" value="${email}">
          ${catCheckboxes || '<p style="color:#888">No categories available.</p>'}
          <hr>
          <button type="submit" class="btn" style="margin-top:4px">Save Preferences</button>
        </form>
        <a href="/api/email/unsubscribe?email=${encodeURIComponent(email)}&done=all" class="btn btn-outline">Unsubscribe from All</a>
      </div></body></html>`
    );
  }

  if (sub === 'unsubscribe' && req.method === 'POST') {
    const { email, cats } = req.body || {};
    if (!email) return send(res, 400, { success: false, message: 'Email required' });
    const docId = email.toLowerCase().replace(/\./g, ',');
    const categories = {};
    if (cats) {
      const selected = Array.isArray(cats) ? cats : [cats];
      selected.forEach(c => { categories[c] = true; });
    }
    await db.collection('emailSubscriptions').doc(docId).set({
      email: email.toLowerCase(), categories, status: 'subscribed',
      subscribedAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
    }, { merge: true });
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Preferences Saved</title><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
        .card{max-width:520px;width:100%;border:2px solid #000;box-shadow:6px 6px 0 #000;padding:32px}
        h1{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
        .sub{color:#888;font-size:13px;margin-bottom:20px}
        hr{border:none;border-top:2px solid #000;margin:16px 0}
        .btn{display:inline-block;padding:10px 24px;background:#000;color:#fff;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:2px solid #000}
        p{font-size:14px;color:#444;margin-bottom:10px}
        .msg{padding:10px 14px;border:2px solid #34A853;font-size:13px;font-weight:700;margin-bottom:16px}
      </style></head><body>
      <div class="card">
        <h1>Preferences Saved</h1>
        <div class="sub">DEV/CRAFT Internship Platform</div>
        <div class="msg">Your email preferences have been updated.</div>
        <p>You will only receive the email types you selected.</p>
        <hr><a class="btn" href="https://devcraft.fennark.xyz">Return to Website</a>
      </div></body></html>`
    );
  }
  if (sub === 'subscriptions' && req.method === 'GET') {
    const snap = await db.collection('emailSubscriptions').get();
    return send(res, 200, { success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  }
  if (sub === 'subscriptions' && parts[1] === 'update' && req.method === 'POST') {
    const { email, status, categories } = req.body || {};
    if (!email) return send(res, 400, { success: false, message: 'Email required' });
    const docId = email.toLowerCase().replace(/\./g, ',');
    const existing = await db.collection('emailSubscriptions').doc(docId).get();
    const update = { email: email.toLowerCase(), updatedAt: new Date().toISOString() };
    if (status) update.status = status;
    if (categories) update.categories = categories;
    if (!existing.exists) { update.subscribedAt = new Date().toISOString(); update.status = update.status || 'active'; update.categories = update.categories || {}; }
    await db.collection('emailSubscriptions').doc(docId).set(update, { merge: true });
    return send(res, 200, { success: true, data: { docId, ...update } });
  }
  if (sub === 'automation-log' && req.method === 'GET') {
    try {
      const snap = await db.collection('emailAutomationLog').orderBy('triggeredAt', 'desc').limit(200).get();
      return send(res, 200, { success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (e) {
      const snap = await db.collection('emailAutomationLog').get();
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => new Date(b.triggeredAt || 0) - new Date(a.triggeredAt || 0));
      return send(res, 200, { success: true, data: logs.slice(0, 200) });
    }
  }
  if (sub === 'types' && req.method === 'GET') {
    return send(res, 200, { success: true, data: { types: EMAIL_TYPES, categories: EMAIL_CATEGORIES } });
  }
  return send(res, 404, { success: false, message: `Unknown email endpoint: ${sub}` });
}

async function handleLinkedIn(req, res, parts) {
  const sub = parts[0];
  if (sub === "auth") {
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return send(res, 400, { success: false, message: "LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET not set in Vercel env vars" });
    }
    return send(res, 200, { success: true, url: getAuthUrl() });
  }
  if (sub === "callback") {
    try {
      const query = Object.fromEntries(new URL(req.url, "http://x").searchParams);
      const code = query.code || req.body?.code;
      const errParam = query.error;
      if (errParam) {
        console.error("LinkedIn OAuth error:", errParam, query.error_description);
        res.writeHead(302, { Location: "/admin" });
        return res.end();
      }
      if (!code) return send(res, 400, { success: false, message: "No authorization code received" });
      console.error("[LinkedIn] Callback received, exchanging code...");
      await linkedinCallback(code);
      console.error("[LinkedIn] Callback succeeded, redirecting to /admin");
      res.writeHead(302, { Location: "/admin" });
      return res.end();
    } catch (e) {
      console.error("LinkedIn callback error:", e.message);
      console.error("LinkedIn callback stack:", e.stack);
      res.writeHead(302, { Location: "/admin" });
      return res.end();
    }
  }
  if (sub === "status") {
    const token = await getStoredToken();
    console.error("[LinkedIn] Status check - authenticated:", !!token.accessToken, "hasMemberUrn:", !!token.memberUrn);
    return send(res, 200, { success: true, authenticated: !!token.accessToken });
  }
  if (sub === "post") {
    const adminEmail = await requireAdminFromDb(req, res);
    if (!adminEmail) return;
    try {
      const db = await initCosmosDb();
      const enrollments = db ? await (await db.collection("enrollments").get()).docs.map(d => d.data()) : [];
      const activeCount = enrollments.filter(e => e.status !== "Archived" && e.status !== "Completed").length;
      const prompt = buildPromoPrompt(activeCount, "new projects completed");
      const [text, imageB64] = await Promise.all([generateText(prompt), generateImage("DEV/CRAFT internships")]);
      const result = await postToLinkedIn(text, imageB64);
      return send(res, 200, { success: true, data: { post: result, text } });
    } catch (e) {
      return send(res, 500, { success: false, message: e.message });
    }
  }
  return send(res, 404, { success: false, message: "Unknown linkedin route" });
}

async function requireAdminFromDb(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.body?.idToken || "";
  if (!token) { send(res, 401, { success: false, message: "No auth token" }); return null; }
  try {
    const decoded = await verifyFirebaseToken(token);
    if (!decoded) { send(res, 401, { success: false, message: "Invalid token" }); return null; }
    const email = decoded.email ? cleanId(decoded.email).toLowerCase() : null;
    if (email === ROOT_ADMIN_EMAIL) return email;
    if (!email) { send(res, 403, { success: false, message: "No email in token" }); return null; }
    const db = await initCosmosDb();
    const adminDoc = await getDoc(db, "admins", emailId(email), null);
    if (!adminDoc) { send(res, 403, { success: false, message: "Admin access required" }); return null; }
    return email;
  } catch { send(res, 401, { success: false, message: "Auth failed" }); return null; }
}

const ALLOWED_ORIGINS = [
  "https://devcraft.fennark.xyz",
  "https://devcraft.rutujdhodapkar.tech",
  "http://localhost:5173",
  "http://localhost:5174",
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  // Match complete origins. A prefix check would trust a hostile origin such as
  // https://devcraft.fennark.xyz.attacker.example.
  if (origin && ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ""))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://devcraft.fennark.xyz");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-id-token");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") return send(res, 200, { success: true });
  try {
  // Ensure root admin exists in the admins collection on first request
  try {
    const fDb = await initCosmosDb();
    if (fDb) await setDoc(fDb, "admins", emailId(ROOT_ADMIN_EMAIL), { email: ROOT_ADMIN_EMAIL, createdAt: new Date().toISOString() }, true);
  } catch (_) { /* non-blocking */ }
  const rawUrl = (req.url || "");
  const reqPath = rawUrl.split("?")[0].replace(/^\/api\/?/, "");
  const parts = reqPath.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "ping") return send(res, 200, { success: true, message: "pong", env: { hasGoogle: !!GOOGLE_CLIENT_ID, node: process.version, url: rawUrl, method: req.method } });
    if (parts[0] === "auth" && parts[1] === "google") return handleAuth(req, res);
    if (parts[0] === "ai" && parts[1] === "verify-task") return handleAiVerify(req, res);
    if (parts[0] === "ai" && parts[1] === "grade-quiz") return handleAiGradeQuiz(req, res);
    if (parts[0] === "grade-quiz-text") return handleQuiz(req, res);
    if (parts[0] === "firebase-proxy") return handleFirebaseProxy(req, res);
    if (parts[0] === "data") return handleData(req, res, parts.slice(1));
    if (parts[0] === "dodo") return handleDodo(req, res, parts.slice(1));
    if (parts[0] === "email") return handleEmail(req, res, parts.slice(1));
    if (parts[0] === "qr" && parts[1]) return handleQR(req, res, parts[1]);
    if (parts[0] === "certificate-data" && parts[1]) return handleCertificateData(req, res, parts[1]);
    if (parts[0] === "verify-data" && parts[1]) return handleVerifyData(req, res, parts[1]);
    if (parts[0] === "verify" && parts[1]) return handleVerify(req, res, parts[1]);
    if (parts[0] === "payment-history" && parts[1]) return handlePaymentHistory(req, res, parts[1]);
    if (parts[0] === "auto-expire-enrollments") return handleAutoExpire(req, res);
    if (parts[0] === "sync" && parts[1] === "versions") return handleSyncVersions(req, res);
    console.warn("Unmatched API route:", { url: rawUrl, method: req.method, path: reqPath, parts, first: parts[0] });
    return send(res, 404, { success: false, message: `API route not found (${req.method} ${rawUrl})`, parts, first: parts[0] });
  } catch (error) {
    console.error("API error:", error);
    return send(res, 500, { success: false, message: error.message || "Server error." });
  }
}

async function handlePaymentHistory(req, res, enrollmentId) {
  try {
    const db = await initCosmosDb();
    if (!db) return send(res, 503, { success: false, message: "Database not configured" });
    const idToken = req.headers["x-id-token"] || req.query?.idToken || "";
    const decoded = await verifyFirebaseToken(idToken);
    if (!decoded) return send(res, 401, { success: false, message: "Authentication required" });
    const enrollment = await getDoc(db, "enrollments", enrollmentId, null);
    if (!enrollment) return send(res, 404, { success: false, message: "Enrollment not found" });
    const email = decoded.email ? cleanId(decoded.email).toLowerCase() : null;
    const adminDoc = email ? await getDoc(db, "admins", emailId(email), null) : null;
    const isAdmin = email === ROOT_ADMIN_EMAIL || Boolean(adminDoc);
    if (!isAdmin && enrollment.uid !== decoded.uid) return send(res, 403, { success: false, message: "You do not own this enrollment" });
    const snap = await db.collection("paymentHistory").where("enrollmentId", "==", enrollmentId).get();
    const records = [];
    snap.forEach(doc => {
      const d = doc.data();
      const record = { id: doc.id };
      ["enrollmentId","paymentId","eventType","amount","currency","method","gateway","createdAt","updatedAt"].forEach(k => { record[k] = d[k] ?? null; });
      records.push(record);
    });
    records.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") * -1);
    return send(res, 200, { success: true, data: records });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

async function handleAutoExpire(req, res) {
  try {
    const db = await initCosmosDb();
    if (!db) return send(res, 503, { success: false, message: "Database not configured" });
    const now = new Date().toISOString();
    const snap = await db.collection("enrollments").where("status", "==", "Active").get();
    if (snap.empty) return send(res, 200, { success: true, expired: 0, message: "No active enrollments" });
    let expired = 0;
    const affectedUids = new Set();
    const batch = db.batch();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const deadline = data.deadline || data.createdAt;
      if (deadline && now > deadline) {
        const ref = db.collection("enrollments").doc(doc.id);
        batch.update(ref, { status: "Expired", expiredAt: now, updatedAt: now });
        if (data.uid) affectedUids.add(data.uid);
        expired++;
      }
    });
    if (expired > 0) {
      await batch.commit();
      for (const uid of affectedUids) {
        await bumpSyncVersions(db, ["tasks", "certs"], uid).catch(e => console.warn("[auto-expire] bump failed:", e.message));
      }
    }
    return send(res, 200, { success: true, expired, message: `${expired} enrollment(s) expired` });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}

// ── Per-user cache-sync version stamps ────────────────────────────────────────
// The client calls this on load and re-fetches a bucket ONLY when its stamp changed.
// Stamps are PER USER: a write by user A advances only A's stamp, so B's cache is
// never needlessly invalidated. This is the key correctness property the previous
// global `siteConfig/syncVersions` doc lacked.
//
// Storage model: each user's stamps live in a dedicated "SyncVersions" Cosmos
// container (partition key /userId) as a single doc id `versions:<userId>`. Every
// read is a genuine Cosmos POINT READ — container.item("versions:<userId>", userId)
// .read() — by id + partition key, never a cross-partition query. Per-user scoping
// means a write by user A advances only A's stamp, so B's cache is never invalidated.
//
// Consistency: version reads use Eventual consistency (forwarded via the shim). Non-
// critical badge/template data tolerates Eventual staleness; writes go through
// set/update which default to Session+ so a read immediately after a user's own write
// sees it.
//
// Buckets:
//   tasks            -> enrollments (per user)
//   certs            -> enrollments where allowedCertificate === "yes" (per user)
//   badges_combined  -> userBadges + userStreaks + userFlags (+ global badge defs)
const SYNC_BUCKETS = ["tasks", "certs", "badges_combined"];

// Maps a written collection to the sync buckets whose stamp must advance.
const BUCKET_FOR_COLLECTION = {
  enrollments: ["tasks", "certs"],
  badges: ["badges_combined"],
  userBadges: ["badges_combined"],
  userStreaks: ["badges_combined"],
  userFlags: ["badges_combined"],
};

// Advance the given user's stamps, scoped to that user (so only they re-fetch).
// Written to the dedicated SyncVersions container via a POINT WRITE (upsert by id).
async function bumpSyncVersions(db, buckets, userId) {
  try {
    if (!buckets || !buckets.length || !userId) return;
    const cur = (await getSyncVersion(userId)) || {};
    const ts = Date.now();
    const next = { id: `versions:${userId}`, userId, ...cur };
    for (const b of buckets) next[b] = ts;
    next.computedAt = ts;
    await putSyncVersion(next);
  } catch (e) {
    console.warn("[sync] bump failed:", e.message);
  }
}

async function handleSyncVersions(req, res) {
  try {
    const db = await initCosmosDb();
    if (!db) return send(res, 503, { success: false, message: "Database not configured" });

    const userId = (req.query && req.query.userId) || null;
    const now = Date.now();

    // No userId → cannot scope; tell the client to fetch everything.
    if (!userId) {
      return send(res, 200, {
        success: true,
        userId: null,
        data: Object.fromEntries(SYNC_BUCKETS.map((b) => [b, "0"])),
        serverTime: now,
      });
    }

    // POINT READ: container.item("versions:<userId>", userId).read() — by id +
    // partition key /userId on the SyncVersions container. This is a single-document
    // read (O(1) RU), NOT a query. Eventual consistency is fine for a version stamp.
    const doc = await getSyncVersion(userId);

    const versions = doc && doc.computedAt
      ? Object.fromEntries(SYNC_BUCKETS.map((b) => [b, String(doc[b] ?? 0)]))
      : Object.fromEntries(SYNC_BUCKETS.map((b) => [b, String(now)])); // first contact → force full fetch

    // First contact: persist a fresh stamp doc so subsequent loads can diff.
    if (!doc || !doc.computedAt) {
      await putSyncVersion({ id: `versions:${userId}`, userId, ...versions, computedAt: now }).catch(() => {});
    }

    return send(res, 200, { success: true, userId, data: versions, serverTime: now });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message });
  }
}



