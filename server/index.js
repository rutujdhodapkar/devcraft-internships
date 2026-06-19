import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    const content = await fs.readFile(envPath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch {}
}
await loadEnvFile();

// ─── Initialize Firestore Admin SDK ────────────────────────────────────
let firestore = null;
try {
  if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString());
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
  }
  if (admin.apps.length) {
    firestore = admin.firestore();
    console.log('Firestore Admin SDK initialized');
  }
} catch (e) {
  console.error('Firestore init failed (optional if using JSON fallback):', e.message);
}

// ─── JSON file fallback paths (for non-Firestore data) ─────────────────
const INQUIRIES_FILE = path.join(__dirname, 'inquiries.json');
const REFERRALS_FILE = path.join(__dirname, 'referrals.json');
const VISITS_FILE = path.join(__dirname, 'referral-visits.json');
const ADMINS_FILE = path.join(__dirname, 'admins.json');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

async function readJson(filePath, fallback = []) {
  try {
    const fileData = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileData);
  } catch {
    return fallback;
  }
}
async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Auth middleware ───────────────────────────────────────────────────
async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    req.authUser = null;
    return next();
  }
  try {
    const resp = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    if (resp.ok) {
      const info = await resp.json();
      req.authUser = { uid: info.sub, email: info.email };
    } else {
      req.authUser = null;
    }
  } catch {
    req.authUser = null;
  }
  next();
}
app.use(verifyToken);

// ─── Firestore proxy: get document or collection ───────────────────────
app.post('/api/firestore/get', async (req, res) => {
  if (!firestore) return res.status(503).json({ error: 'Firestore not available' });
  const { collection, doc, authRequired } = req.body;
  if (!collection) return res.status(400).json({ error: 'collection required' });
  if (authRequired && !req.authUser) return res.status(401).json({ error: 'auth required' });
  try {
    if (doc) {
      const snap = await firestore.collection(collection).doc(doc).get();
      if (!snap.exists) return res.json({ data: null });
      return res.json({ data: { id: snap.id, ...snap.data() } });
    }
    const snap = await firestore.collection(collection).get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Firestore proxy: set/overwrite a document ─────────────────────────
app.post('/api/firestore/set', async (req, res) => {
  if (!firestore) return res.status(503).json({ error: 'Firestore not available' });
  const { collection, doc, data, authRequired } = req.body;
  if (!collection || !data) return res.status(400).json({ error: 'collection and data required' });
  if (authRequired && !req.authUser) return res.status(401).json({ error: 'auth required' });
  try {
    const ref = doc ? firestore.collection(collection).doc(doc) : firestore.collection(collection).doc();
    await ref.set(data);
    return res.json({ data: { id: ref.id, ...data } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Firestore proxy: update fields ────────────────────────────────────
app.post('/api/firestore/update', async (req, res) => {
  if (!firestore) return res.status(503).json({ error: 'Firestore not available' });
  const { collection, doc, data, authRequired } = req.body;
  if (!collection || !doc || !data) return res.status(400).json({ error: 'collection, doc, data required' });
  if (authRequired && !req.authUser) return res.status(401).json({ error: 'auth required' });
  try {
    await firestore.collection(collection).doc(doc).set(data, { merge: true });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Firestore proxy: push (create with auto-ID, like RTDB push) ──────
app.post('/api/firestore/push', async (req, res) => {
  if (!firestore) return res.status(503).json({ error: 'Firestore not available' });
  const { collection, data, authRequired } = req.body;
  if (!collection || !data) return res.status(400).json({ error: 'collection and data required' });
  if (authRequired && !req.authUser) return res.status(401).json({ error: 'auth required' });
  try {
    const ref = await firestore.collection(collection).add(data);
    return res.json({ data: { id: ref.id, ...data } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Firestore proxy: delete ───────────────────────────────────────────
app.post('/api/firestore/delete', async (req, res) => {
  if (!firestore) return res.status(503).json({ error: 'Firestore not available' });
  const { collection, doc, authRequired } = req.body;
  if (!collection || !doc) return res.status(400).json({ error: 'collection and doc required' });
  if (authRequired && !req.authUser) return res.status(401).json({ error: 'auth required' });
  try {
    await firestore.collection(collection).doc(doc).delete();
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Firestore proxy: query with filters ──────────────────────────────
app.post('/api/firestore/query', async (req, res) => {
  if (!firestore) return res.status(503).json({ error: 'Firestore not available' });
  const { collection, queries, authRequired } = req.body;
  if (!collection) return res.status(400).json({ error: 'collection required' });
  if (authRequired && !req.authUser) return res.status(401).json({ error: 'auth required' });
  try {
    let ref = firestore.collection(collection);
    if (Array.isArray(queries)) {
      for (const q of queries) {
        if (q.where) ref = ref.where(q.field, q.op || '==', q.value);
        if (q.orderBy) ref = ref.orderBy(q.field, q.dir || 'asc');
        if (q.limit) ref = ref.limit(q.limit);
      }
    }
    const snap = await ref.get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Existing endpoints (AI verify, inquiries, referrals) ──────────────

// Currency rates
let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60;
const fallbackRates = { USD: 1.0, INR: 83.5, EUR: 0.93, GBP: 0.79, CAD: 1.37, AUD: 1.51, JPY: 157.4 };

app.get('/api/rates', async (req, res) => {
  const now = Date.now();
  if (cachedRates && (now - lastFetchTime < CACHE_DURATION)) {
    return res.json({ success: true, rates: cachedRates, source: 'cache' });
  }
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    if (data && data.rates) {
      cachedRates = data.rates;
      lastFetchTime = now;
      return res.json({ success: true, rates: cachedRates, source: 'network' });
    }
  } catch (error) {
    console.error('Error fetching currency rates, using fallback:', error.message);
  }
  return res.json({ success: true, rates: fallbackRates, source: 'fallback' });
});

// Save design/development inquiry
app.post('/api/inquire', async (req, res) => {
  const { name, email, phone, projectType, planTier } = req.body;
  if (!name || !email || !phone || !projectType || !planTier) {
    return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
  }
  const newInquiry = {
    id: `INQ-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...req.body,
    status: req.body.status || 'contacted',
    progress: req.body.progress || 'New request',
  };
  try {
    const inquiries = await readJson(INQUIRIES_FILE);
    inquiries.push(newInquiry);
    await writeJson(INQUIRIES_FILE, inquiries);
    console.log('\n--- NEW INQUIRY RECEIVED ---');
    console.log(`ID: ${newInquiry.id}`);
    console.log(`Client: ${newInquiry.name} (${newInquiry.email})`);
    console.log(`Service: ${newInquiry.projectType.toUpperCase()} - ${newInquiry.planTier.toUpperCase()}`);
    console.log('-----------------------------\n');
    return res.status(201).json({
      success: true,
      message: 'Inquiry received successfully! We will contact you soon.',
      inquiryId: newInquiry.id,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.get('/api/inquiries', async (req, res) => {
  const inquiries = await readJson(INQUIRIES_FILE);
  res.json({ success: true, data: inquiries });
});

app.get('/api/admin-data', async (req, res) => {
  const [requests, referrals, visits] = await Promise.all([
    readJson(INQUIRIES_FILE),
    readJson(REFERRALS_FILE),
    readJson(VISITS_FILE),
  ]);
  const sortedRequests = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const sortedVisits = [...visits].sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 100);
  res.json({ success: true, data: { requests: sortedRequests, referrals, visits: sortedVisits } });
});

app.post('/api/referrals', async (req, res) => {
  const referrals = await readJson(REFERRALS_FILE);
  const referral = {
    id: req.body.code,
    ...req.body,
    code: req.body.code || `REF-${Date.now().toString(36).toUpperCase()}`,
    visited: req.body.visited || 0,
    contacted: req.body.contacted || 0,
    createdAt: req.body.createdAt || new Date().toISOString(),
  };
  referrals.push(referral);
  await writeJson(REFERRALS_FILE, referrals);
  res.status(201).json({ success: true, data: referral });
});

app.post('/api/referral-visits', async (req, res) => {
  const [referrals, visits] = await Promise.all([
    readJson(REFERRALS_FILE),
    readJson(VISITS_FILE),
  ]);
  const code = String(req.body.referralCode || '').toUpperCase();
  const matchedReferral = referrals.find((item) => String(item.code).toUpperCase() === code);
  const visit = {
    id: `VIS-${Date.now()}`,
    ...req.body,
    referralCode: code,
    matched: Boolean(matchedReferral),
    visitedAt: req.body.visitedAt || new Date().toISOString(),
    action: 'visited',
  };
  visits.push(visit);
  if (matchedReferral) {
    matchedReferral.visited = Number(matchedReferral.visited || 0) + 1;
    matchedReferral.lastVisitedAt = visit.visitedAt;
  }
  await Promise.all([writeJson(VISITS_FILE, visits), writeJson(REFERRALS_FILE, referrals)]);
  res.status(201).json({ success: true, data: visit });
});

app.delete('/api/referrals/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const referrals = await readJson(REFERRALS_FILE);
  const filtered = referrals.filter((item) => String(item.code).toUpperCase() !== code);
  await writeJson(REFERRALS_FILE, filtered);
  res.json({ success: true, message: `Referral ${code} deleted.` });
});

app.delete('/api/inquiries/:id', async (req, res) => {
  const inquiries = await readJson(INQUIRIES_FILE);
  const filtered = inquiries.filter((item) => item.id !== req.params.id);
  await writeJson(INQUIRIES_FILE, filtered);
  res.json({ success: true, message: `Inquiry ${req.params.id} deleted.` });
});

app.post('/api/referrals/:code/contacted', async (req, res) => {
  const referrals = await readJson(REFERRALS_FILE);
  const code = String(req.params.code || '').toUpperCase();
  const matchedReferral = referrals.find((item) => String(item.code).toUpperCase() === code);
  if (matchedReferral) {
    matchedReferral.contacted = Number(matchedReferral.contacted || 0) + 1;
    matchedReferral.lastContactedAt = new Date().toISOString();
    await writeJson(REFERRALS_FILE, referrals);
  }
  res.json({ success: true, data: matchedReferral || null });
});

app.post('/api/check-admin', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required.' });
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === 'rutujdhodapkar@gmail.com') return res.json({ success: true, isAdmin: true });
  const admins = await readJson(ADMINS_FILE);
  const isAdmin = admins.some(a => a.toLowerCase().trim() === cleanEmail);
  return res.json({ success: true, isAdmin });
});

app.get('/api/admins', async (req, res) => {
  const admins = await readJson(ADMINS_FILE);
  return res.json({ success: true, data: admins });
});

app.post('/api/admins', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required.' });
  const cleanEmail = email.toLowerCase().trim();
  const admins = await readJson(ADMINS_FILE);
  if (!admins.includes(cleanEmail)) {
    admins.push(cleanEmail);
    await writeJson(ADMINS_FILE, admins);
  }
  return res.json({ success: true, data: admins });
});

app.delete('/api/admins/:email', async (req, res) => {
  const cleanEmail = req.params.email.toLowerCase().trim();
  const admins = await readJson(ADMINS_FILE);
  const updated = admins.filter(a => a.toLowerCase().trim() !== cleanEmail);
  await writeJson(ADMINS_FILE, updated);
  return res.json({ success: true, data: updated });
});

// AI Task Verification (NVIDIA API)
app.post('/api/ai/verify-task', async (req, res) => {
  const { taskTitle, taskDescription, taskNotices, submissionText, submissionUrl, internName, codeFiles } = req.body;
  if (!taskTitle || !submissionText) {
    return res.status(400).json({ success: false, message: 'Task title and submission text are required.' });
  }
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: 'NVIDIA API key not configured on server.' });
  }
  try {
    const promptParts = [
      `Task Title: ${taskTitle}`,
      `Task Description: ${taskDescription || 'No description provided'}`,
    ];
    if (taskNotices && taskNotices.trim()) promptParts.push(`Task Instructions/Notices:\n${taskNotices}`);
    promptParts.push(`Student Name: ${internName || 'Unknown'}`);
    promptParts.push(`Student's Submission Text: ${submissionText}`);
    if (submissionUrl) promptParts.push(`Submission URL: ${submissionUrl}`);
    if (codeFiles && Array.isArray(codeFiles) && codeFiles.length > 0) {
      promptParts.push(`\n=== ACTUAL CODE FETCHED FROM REPOSITORY ===`);
      for (const file of codeFiles) {
        const label = file.path || file.name || 'unknown';
        promptParts.push(`\n--- File: ${label} ---\n${file.content}`);
      }
      promptParts.push(`\n=== END OF CODE ===`);
      promptParts.push(`\nCRITICAL: Carefully check if the code above actually implements what was asked. Check for: 1) Does the code solve the problem described? 2) Are there any placeholder/boilerplate/todo comments? 3) Does the code look like it was written specifically for this task? If the code is wrong, incomplete, or doesn't match the task, set verified to false with specific reasons.`);
    } else {
      promptParts.push(`\nIMPORTANT: No actual code could be fetched from the student's submission. The provided link may be invalid, private, or not a code repository. You MUST set verified to false and explain that the code could not be accessed.`);
    }
    promptParts.push('\nEvaluate this submission and respond with JSON only.');
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'meta/llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: `You are an AI internship task verifier. Evaluate the student's project submission against the task requirements.
Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "verified": boolean,
  "confidence": number (0-100),
  "reason": "brief explanation of your decision",
  "message": "constructive feedback for the student; if rejected explain what is missing or wrong, if verified give positive confirmation"
}` },
          { role: 'user', content: promptParts.join('\n') },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API error ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('No JSON in response');
    } catch {
      result = { verified: false, confidence: 0, reason: 'AI response could not be parsed', message: 'AI verification failed to produce a clear result. Please review manually.' };
    }
    return res.json({ success: true, data: { ...result, rawResponse: content } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'AI verification failed: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
