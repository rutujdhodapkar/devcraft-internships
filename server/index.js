import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import apiHandler from '../api/index.js';
import { sendEmail, isConfigured } from './brevoClient.js';
import { renderTemplate, TEMPLATES, getTemplate } from './emailTemplates.js';
import { runDailyCron, getEmailStats, processEmailCampaign, processLifecycleTransitions, determineLifecycleStages, EMAIL_TYPES, EMAIL_CATEGORIES } from './emailEngine.js';


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
  } catch {
    // .env is optional in local development
  }
}

await loadEnvFile();

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (raw) {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    return parsed;
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID || 'login-data-680b9',
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  return null;
}

let fbInitPromise = null;
async function initFirebase() {
  if (fbInitPromise) return fbInitPromise;
  fbInitPromise = (async () => {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const apps = getApps();
    if (apps.length) return getFirestore(apps[0], 'intern');
    const sa = getServiceAccount();
    if (!sa) {
      // Return null so the server stays alive — routes handle the missing db gracefully
      console.warn('[Firebase] Credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in server/.env to enable database features.');
      return null;
    }
    const app = initializeApp({
      credential: cert(sa),
      projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID || 'login-data-680b9',
    });
    return getFirestore(app, 'intern');
  })();
  return fbInitPromise;
}

const INQUIRIES_FILE = path.join(__dirname, 'inquiries.json');
const REFERRALS_FILE = path.join(__dirname, 'referrals.json');
const VISITS_FILE = path.join(__dirname, 'referral-visits.json');
const ADMINS_FILE = path.join(__dirname, 'admins.json');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

// In-memory caching for currency exchange rates
let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Helper to get fallback rates in case API is down
const fallbackRates = {
  USD: 1.0,
  INR: 83.5,
  EUR: 0.93,
  GBP: 0.79,
  CAD: 1.37,
  AUD: 1.51,
  JPY: 157.4
};

// Route: Get live currency conversion rates proxy
app.get('/api/rates', async (req, res) => {
  const now = Date.now();
  if (cachedRates && (now - lastFetchTime < CACHE_DURATION)) {
    return res.json({ success: true, rates: cachedRates, source: 'cache' });
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('Failed to fetch from exchange API');
    const data = await response.json();
    
    if (data && data.rates) {
      cachedRates = data.rates;
      lastFetchTime = now;
      return res.json({ success: true, rates: cachedRates, source: 'network' });
    }
  } catch (error) {
    console.error('Error fetching currency rates, using fallback:', error.message);
  }

  // Fallback if network fails
  return res.json({ success: true, rates: fallbackRates, source: 'fallback' });
});

// Route: Save design/development inquiry
app.post('/api/inquire', async (req, res) => {
  const {
    name,
    email,
    phone,
    projectType,
    planTier,
    customSpecs,
    estimatedPrice,
    currency,
    requirements,
    message,
    referralCode,
  } = req.body;

  if (!name || !email || !phone || !projectType || !planTier) {
    return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
  }

  const newInquiry = {
    id: `INQ-${Date.now()}`,
    createdAt: new Date().toISOString(),
    name,
    email,
    phone,
    ...req.body,
    projectType, // 'software' or 'documentation'
    planTier, // 'basic', 'advance', 'pro'
    customSpecs: customSpecs || [],
    estimatedPrice,
    currency: currency || 'USD',
    message: requirements || message || '',
    referralCode: referralCode || '',
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
    console.log(`Price Est: ${newInquiry.estimatedPrice} ${newInquiry.currency}`);
    console.log(`Phone: ${newInquiry.phone}`);
    console.log(`Specs: ${(newInquiry.customSpecs || []).join(', ') || 'None'}`);
    console.log(`Message: ${newInquiry.message}`);
    console.log('-----------------------------\n');

    return res.status(201).json({ 
      success: true, 
      message: 'Inquiry received successfully! We will contact you soon.',
      inquiryId: newInquiry.id
    });
  } catch (error) {
    console.error('Error saving inquiry:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while saving project inquiry.' });
  }
});

// Get all inquiries (simple dashboard read)
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

  // Sort requests descending by date
  const sortedRequests = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // Sort visits descending by date and limit to 100
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
  const { id } = req.params;
  const inquiries = await readJson(INQUIRIES_FILE);
  const filtered = inquiries.filter((item) => item.id !== id);
  await writeJson(INQUIRIES_FILE, filtered);
  res.json({ success: true, message: `Inquiry ${id} deleted.` });
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

// Admin management APIs
app.post('/api/check-admin', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email required.' });
  }
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === 'rutujdhodapkar@gmail.com') {
    return res.json({ success: true, isAdmin: true });
  }
  const admins = await readJson(ADMINS_FILE);
  const isAdmin = admins.some(adminEmail => adminEmail.toLowerCase().trim() === cleanEmail);
  return res.json({ success: true, isAdmin });
});

app.get('/api/admins', async (req, res) => {
  const admins = await readJson(ADMINS_FILE);
  return res.json({ success: true, data: admins });
});

app.post('/api/admins', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email required.' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const admins = await readJson(ADMINS_FILE);
  if (!admins.includes(cleanEmail)) {
    admins.push(cleanEmail);
    await writeJson(ADMINS_FILE, admins);
  }
  return res.json({ success: true, data: admins });
});

app.delete('/api/admins/:email', async (req, res) => {
  const { email } = req.params;
  const cleanEmail = email.toLowerCase().trim();
  const admins = await readJson(ADMINS_FILE);
  const updated = admins.filter(adminEmail => adminEmail.toLowerCase().trim() !== cleanEmail);
  await writeJson(ADMINS_FILE, updated);
  return res.json({ success: true, data: updated });
});

// ─── AI Task Verification (NVIDIA API) ─────────────────────────────────────────
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
    if (taskNotices && taskNotices.trim()) {
      promptParts.push(`Task Instructions/Notices:\n${taskNotices}`);
    }
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
      promptParts.push(`\nCRITICAL: Carefully check if the code above actually implements what was asked in the task. Check for: 1) Does the code solve the problem described? 2) Are there any placeholder/boilerplate/todo comments? 3) Does the code look like it was written specifically for this task? If the code is wrong, incomplete, or doesn't match the task, set verified to false with specific reasons.`);
    } else {
      promptParts.push(`\nIMPORTANT: No actual code could be fetched from the student's submission. The provided link may be invalid, private, or not a code repository. You MUST set verified to false and explain that the code could not be accessed. Do NOT verify submissions whose code cannot be read.`);
    }
    promptParts.push('\nEvaluate this submission and respond with JSON only.');

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.3-70b-instruct',
        messages: [
          {
            role: 'system',
            content: `You are an AI internship task verifier. Evaluate the student's project submission against the task requirements.

Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "verified": boolean,
  "confidence": number (0-100),
  "reason": "brief explanation of your decision",
  "message": "constructive feedback for the student; if rejected explain what is missing or wrong, if verified give positive confirmation"
}`
          },
          {
            role: 'user',
            content: promptParts.join('\n')
          }
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
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON in response');
      }
    } catch (parseErr) {
      result = {
        verified: false,
        confidence: 0,
        reason: 'AI response could not be parsed',
        message: 'AI verification failed to produce a clear result. Please review manually.',
      };
    }

    return res.json({ success: true, data: { ...result, rawResponse: content } });
  } catch (error) {
    console.error('AI verification error:', error.message);
    return res.status(500).json({ success: false, message: 'AI verification failed: ' + error.message });
  }
});

// ─── Dodo Payments ─────────────────────────────────────────────────────────
const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
const DODO_WEBHOOK_SECRET = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
const DODO_PRODUCT_ID = process.env.DODO_PAYMENTS_PRODUCT_ID;
const DODO_ENV = process.env.DODO_PAYMENTS_ENVIRONMENT === 'live' ? 'live' : 'test';

async function dodoApi(path, options = {}) {
  const base = DODO_ENV === 'live' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com';
  const response = await fetch(`${base}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DODO_API_KEY}`,
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dodo API error ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

// Setup: Create Pay-What-You-Want product (run once from admin panel)
app.post('/api/dodo/setup', async (req, res) => {
  try {
    const product = await dodoApi('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'DEV/CRAFT Internship Payment',
        description: 'Internship enrollment payment',
        price: {
          type: 'one_time_price',
          currency: 'INR',
          price: 0,
          discount: 0,
          purchasing_power_parity: false,
          pay_what_you_want: true,
          suggested_price: 20000,
          tax_inclusive: true,
        },
        tax_category: 'digital_products',
      }),
    });
    return res.json({ success: true, data: { product_id: product.product_id } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Checkout session: Create a session and return checkout URL
app.post('/api/dodo/create-checkout-session', async (req, res) => {
  try {
    if (!DODO_KEY) return res.status(400).json({ success: false, message: 'Dodo API key not configured' });
    const { amount, enrollmentId, customerEmail, customerName } = req.body;
    if (!amount || amount <= 0 || !enrollmentId) {
      return res.status(400).json({ success: false, message: 'Valid amount and enrollmentId required' });
    }
    let productId = DODO_PRODUCT_ID;
    if (!productId) {
      try {
        const db = await initFirebase();
        const snap = await db.collection('siteConfig').doc('dodoConfig').get();
        const val = snap.data();
        productId = val?.value?.productId || null;
      } catch {}
    }
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Dodo Payments product not configured. Admin must run Dodo setup first.' });
    }
    const amountPaise = Math.round(amount * 100);
    const body = {
      product_cart: [{ product_id: productId, quantity: 1, amount: amountPaise }],
      metadata: { enrollment_id: enrollmentId },
      return_url: `${req.headers.origin || 'http://localhost:5173'}/dashboard?dodo_success=1`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/dashboard?dodo_cancelled=1`,
      billing_address: { country: 'IN' },
      feature_flags: { allow_currency_selection: true, redirect_immediately: false },
    };
    if (customerEmail) body.customer = { email: customerEmail, name: customerName || '' };
    const session = await dodoApi('/checkouts', { method: 'POST', body: JSON.stringify(body) });
    return res.json({ success: true, data: { checkout_url: session.checkout_url, session_id: session.session_id } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Webhook: Handle payment events from Dodo
app.post('/api/dodo/webhook', async (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    if (!DODO_WEBHOOK_SECRET) return res.status(500).json({ received: false });
    const webhookId = req.headers['webhook-id'];
    const webhookSignature = req.headers['webhook-signature'];
    const webhookTimestamp = req.headers['webhook-timestamp'];
    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      return res.status(401).json({ received: false });
    }
    const { createHmac, timingSafeEqual } = await import('crypto');
    const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const computedSig = createHmac('sha256', DODO_WEBHOOK_SECRET).update(signedContent).digest('base64');
    const expectedSigs = webhookSignature.split(' ').map(s => {
      const p = s.split(',').find(x => x.trim().startsWith('v1='));
      return p ? p.trim().slice(3) : null;
    }).filter(Boolean);
    let valid = false;
    for (const sig of expectedSigs) {
      try { if (timingSafeEqual(Buffer.from(computedSig), Buffer.from(sig))) { valid = true; break; } } catch {}
    }
    if (!valid) return res.status(401).json({ received: false });
    const eventType = req.body.type || req.body.event_type || '';
    const payload = req.body.data || req.body;
    const metadata = payload.metadata || {};
    const enrollmentId = metadata.enrollment_id;
    const paymentId = payload.id || payload.payment_id || '';
    if (eventType === 'payment.succeeded' && enrollmentId) {
      try {
        const db = await initFirebase();
        if (DODO_KEY && paymentId) {
          try {
            const pmtRes = await dodoApi(`/payments/${paymentId}`);
            if (pmtRes?.status !== 'succeeded') return res.json({ received: true, skipped: true });
          } catch (e) { console.warn('Dodo payment verification failed:', e.message); }
        }
        const enrRef = db.collection('enrollments').doc(enrollmentId);
        await enrRef.update({ paymentStatus: 'paid', paymentStage: 'fully_paid', paidAt: new Date().toISOString(), paymentIntentId: paymentId, updatedAt: new Date().toISOString() });
        const snap = await enrRef.get();
        const enr = snap.data();
        if (enr) {
          const projects = enr.projects || [];
          const submissions = enr.submissions || {};
          const allVerified = projects.length > 0 && projects.every((_, i) => submissions[i]?.verified);
          if (allVerified) {
            await enrRef.update({ allowedCertificate: 'yes', status: 'Completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          }
        }
        console.log(`Dodo: Payment succeeded for ${enrollmentId}`);
      } catch (fbErr) { console.error('Firebase update failed:', fbErr.message); }
    } else if (eventType === 'payment.failed' && enrollmentId) {
      try {
        const db = await initFirebase();
        await db.collection('enrollments').doc(enrollmentId).update({ paymentStatus: 'failed', updatedAt: new Date().toISOString() });
      } catch {}
    }
    res.json({ received: true });
  } catch (error) {
    console.error('Dodo webhook error:', error);
    res.status(500).json({ received: false, error: error.message });
  }
});

// Firebase proxy (used by client to access Firestore via Admin SDK)
app.post('/api/firebase-proxy', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) {
      return res.status(503).json({ success: false, message: 'Firebase not configured on this server. Add FIREBASE_SERVICE_ACCOUNT_KEY to server/.env' });
    }
    const { action, path, data, query } = req.body || {};
    if (!action || !path) return res.status(400).json({ success: false, message: 'action and path required' });
    const blockedWrites = ['admins', 'users'];
    const root = path.split('/')[0];
    if (blockedWrites.includes(root) && ['set', 'update', 'push', 'delete'].includes(action)) {
      return res.status(403).json({ success: false, message: `Direct write to ${root}/ denied via proxy` });
    }
    let result;
    const parts = path.split('/');
    const collection = parts[0];
    if (['list', 'query', 'push'].includes(action)) {
      const colRef = db.collection(collection);
      if (action === 'list') {
        const snap = await colRef.get();
        result = snap.empty ? [] : snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else if (action === 'push') {
        const docRef = await colRef.add(data);
        result = { id: docRef.id, ...data };
      } else if (action === 'query') {
        let q = colRef;
        if (query?.orderBy && query?.equalTo !== undefined) q = q.where(query.orderBy, '==', query.equalTo);
        if (query?.limitToLast) q = q.limit(query.limitToLast);
        if (query?.limitToFirst) q = q.limit(query.limitToFirst);
        const snap = await q.get();
        if (snap.empty) { result = query?.single ? null : []; } else if (query?.single) { result = { id: snap.docs[0].id, ...snap.docs[0].data() }; } else { result = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
      }
    } else {
      let docId = parts[1];
      let fieldPath = parts.length > 2 ? parts.slice(2).join('.') : null;
      if (parts.length >= 3 && parts[0] === 'referralUsers') {
        docId = parts.slice(1).join('_');
        fieldPath = null;
      }
      const docRef = db.collection(collection).doc(docId);
      switch (action) {
        case 'get': {
          const snap = await docRef.get();
          if (!snap.exists) { result = null; break; }
          const docData = snap.data();
          result = fieldPath ? fieldPath.split('.').reduce((o, k) => o?.[k], docData) ?? null : docData;
          break;
        }
        case 'set':
          await (fieldPath ? docRef.set({ [fieldPath]: data }, { merge: true }) : docRef.set(data));
          result = data;
          break;
        case 'update': {
          if (fieldPath) {
            const upd = {}; for (const [k, v] of Object.entries(data)) upd[`${fieldPath}.${k}`] = v;
            await docRef.set(upd, { merge: true });
          } else { await docRef.set(data, { merge: true }); }
          result = data;
          break;
        }
        case 'delete': await docRef.delete(); result = true; break;
        default: return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
      }
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Auto-expire active enrollments past their deadline
app.post('/api/auto-expire-enrollments', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) {
      return res.status(503).json({ success: false, message: 'Firebase not configured' });
    }
    const { FieldValue } = await import('firebase-admin/firestore');
    const now = new Date().toISOString();
    const snap = await db.collection('enrollments')
      .where('status', '==', 'Active')
      .get();
    if (snap.empty) return res.json({ success: true, expired: 0, message: 'No active enrollments' });
    let expired = 0;
    const batch = db.batch();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const deadline = data.deadline || data.createdAt;
      if (deadline && now > deadline) {
        const ref = db.collection('enrollments').doc(doc.id);
        batch.update(ref, { status: 'Expired', expiredAt: now, updatedAt: now });
        expired++;
      }
    });
    if (expired > 0) await batch.commit();
    return res.json({ success: true, expired, message: `${expired} enrollment(s) expired` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Enrollment status (used by client for polling after Dodo payment)
app.get('/api/enrollment-status/:id', async (req, res) => {
  try {
    const db = await initFirebase();
    const snap = await db.collection('enrollments').doc(req.params.id).get();
    const data = snap.data();
    return res.json({ paymentStatus: data?.paymentStatus || 'none', paymentIntentId: data?.paymentIntentId || '' });
  } catch {
    return res.json({ paymentStatus: 'none', paymentIntentId: '' });
  }
});

// ─── Referral visits (dedicated API via Firestore) ────────────────────────
app.post('/api/data/referral-visits', async (req, res) => {
  try {
    const db = await initFirebase();
    const { FieldValue } = await import('firebase-admin/firestore');
    const code = String(req.body.referralCode || '').toUpperCase().trim();
    const snap = code ? await db.collection('referrals').doc(code).get() : null;
    const referral = snap?.exists ? { id: snap.id, ...snap.data() } : null;
    const data = { ...req.body, referralCode: code, matched: Boolean(referral), visitedAt: req.body.visitedAt || new Date().toISOString(), createdAt: new Date().toISOString() };
    const newRef = await db.collection('referralVisits').add(data);
    if (referral) {
      await db.collection('referrals').doc(code).update({ visited: FieldValue.increment(1), lastVisitedAt: data.visitedAt, updatedAt: new Date().toISOString() });
    }
    data.id = newRef.id;
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Audit log (dedicated API via Firestore) ─────────────────────────────
app.post('/api/data/audit-log', async (req, res) => {
  try {
    const db = await initFirebase();
    const ref = await db.collection('auditLog').add({ ...req.body, createdAt: new Date().toISOString() });
    return res.json({ success: true, data: { id: ref.id, ...req.body } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/data/audit-log', async (req, res) => {
  try {
    const db = await initFirebase();
    const snap = await db.collection('auditLog').get();
    const data = snap.empty ? [] : snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return res.json({ success: true, data: data.slice(0, 500) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Email Automation Routes ────────────────────────────────────────────────

// POST /api/email/run — Trigger the daily cron manually (admin)
app.post('/api/email/run', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const result = await runDailyCron(db);
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/email/dry-run — Preview what would be sent without sending
app.post('/api/email/dry-run', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const config = req.body.config || {};
    const stages = await determineLifecycleStages(db);
    const result = await processEmailCampaign(db, config, true);
    return res.json({ success: true, data: { ...result, totalUsers: stages.length } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/email/send-test — Send a test email to a specific address
app.post('/api/email/send-test', async (req, res) => {
  try {
    const { email, type, name, domain } = req.body;
    if (!email || !type) return res.status(400).json({ success: false, message: 'email and type required' });
    if (!isConfigured()) return res.status(500).json({ success: false, message: 'Brevo not configured. Add BREVO_API_KEY to .env' });
    const rendered = renderTemplate(type, {
      name: name || 'Test User',
      domain: domain || 'Web Development',
      amount: '200',
      enrolledSince: '5 days ago',
      deadline: '2026-07-10',
      daysUntilDeadline: '3',
      pendingTasks: '2',
      taskList: [{ title: 'Project 1', status: 'Pending' }, { title: 'Project 2', status: 'Pending' }],
      completedProjects: '1',
      totalProjects: '3',
      status: 'active',
      completedAt: '2026-07-01',
      unsubscribeUrl: `https://devcraft.rutujdhodapkar.tech/api/email/unsubscribe?email=${encodeURIComponent(email)}`,
    });
    if (!rendered) return res.status(400).json({ success: false, message: `Unknown email type: ${type}` });
    const result = await sendEmail({ to: email, subject: rendered.subject, html: rendered.html, type });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/email/templates — List all available templates
app.get('/api/email/templates', (req, res) => {
  const templates = {};
  for (const [type, tpl] of Object.entries(TEMPLATES)) {
    templates[type] = {
      subject: tpl.subject,
      defaultCategory: tpl.defaultCategory || 'general',
      sendOnce: tpl.sendOnce || false,
      intervalDays: tpl.intervalDays || 0,
    };
  }
  return res.json({ success: true, data: templates });
});

// GET /api/email/templates/:type — Get template with preview HTML
app.get('/api/email/templates/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const tpl = getTemplate(type);
    if (!tpl) return res.status(404).json({ success: false, message: `Unknown template: ${type}` });
    const db = await initFirebase();
    let customHtml = null;
    let customSubject = null;
    if (db) {
      try {
        const snap = await db.collection('emailTemplates').doc(type).get();
        if (snap.exists) {
          customHtml = snap.data().html || null;
          customSubject = snap.data().subject || null;
        }
      } catch (e) {}
    }
    return res.json({
      success: true,
      data: {
        type,
        subject: tpl.subject,
        defaultCategory: tpl.defaultCategory || 'general',
        sendOnce: tpl.sendOnce || false,
        intervalDays: tpl.intervalDays || 0,
        defaultHtml: tpl.html({ name: '{{name}}', domain: '{{domain}}', UNSUBSCRIBE_URL: '{{unsubscribeUrl}}' }),
        customHtml,
        customSubject,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/email/templates/:type — Save custom template
app.put('/api/email/templates/:type', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const { type } = req.params;
    const { html, subject } = req.body;
    await db.collection('emailTemplates').doc(type).set({
      html: html || '',
      subject: subject || '',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return res.json({ success: true, data: { type, updated: true } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/email/templates/:type — Reset to default template
app.delete('/api/email/templates/:type', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const { type } = req.params;
    await db.collection('emailTemplates').doc(type).delete();
    return res.json({ success: true, data: { type, reset: true } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/email/config — Get email automation config
app.get('/api/email/config', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const snap = await db.collection('siteConfig').doc('emailConfig').get();
    const config = snap.exists ? snap.data().value || {} : {};
    return res.json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/email/config — Save email automation config
app.put('/api/email/config', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    await db.collection('siteConfig').doc('emailConfig').set({
      value: req.body,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return res.json({ success: true, data: req.body });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/email/stats — Email statistics
app.get('/api/email/stats', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const stats = await getEmailStats(db);
    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/email/logs — View email logs (paginated)
app.get('/api/email/logs', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const { limit: limitParam, type, status, email } = req.query;
    const maxLimit = Math.min(parseInt(limitParam) || 100, 500);
    let query = db.collection('emailLogs').orderBy('sentAt', 'desc').limit(maxLimit);
    const snap = await query.get();
    let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (type) logs = logs.filter(l => l.type === type);
    if (status) logs = logs.filter(l => l.status === status);
    if (email) logs = logs.filter(l => l.email?.includes(email.toLowerCase()));
    return res.json({ success: true, data: logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/email/logs/stats — Aggregated log stats
app.get('/api/email/logs/stats', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const stats = await getEmailStats(db);
    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/email/unsubscribe — Unsubscribe endpoint (link in emails)
app.get('/api/email/unsubscribe', async (req, res) => {
  try {
    const db = await initFirebase();
    const email = req.query.email;
    if (!email || !db) {
      return res.status(400).send('<html><body style="background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2>Error</h2><p>Invalid unsubscribe link.</p></div></body></html>');
    }
    const docId = email.toLowerCase().replace(/\./g, ',');
    const snap = await db.collection('emailSubscriptions').doc(docId).get();
    if (snap.exists) {
      await db.collection('emailSubscriptions').doc(docId).update({ status: 'unsubscribed', unsubscribedAt: new Date().toISOString() });
    } else {
      await db.collection('emailSubscriptions').doc(docId).set({ email: email.toLowerCase(), status: 'unsubscribed', categories: {}, unsubscribedAt: new Date().toISOString(), subscribedAt: new Date().toISOString() });
    }
    res.send(`<html><body style="background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0"><div style="text-align:center;max-width:400px;padding:20px"><h2 style="color:#a78bfa">Unsubscribed ✅</h2><p style="color:#aaa;margin-top:12px">You've been unsubscribed from all DEV/CRAFT emails. You won't receive any further messages.</p><a href="https://devcraft.rutujdhodapkar.tech" style="display:inline-block;margin-top:20px;padding:10px 24px;background:linear-gradient(135deg,#a78bfa,#60a5fa);color:#fff;text-decoration:none;border-radius:6px;font-size:14px">Return to Website</a></div></body></html>`);
  } catch (error) {
    res.status(500).send('<html><body style="background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2>Error</h2><p>Something went wrong. Please try again.</p></div></body></html>');
  }
});

// GET /api/email/subscriptions — List all subscriptions
app.get('/api/email/subscriptions', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const snap = await db.collection('emailSubscriptions').get();
    const subs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, data: subs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/email/subscriptions/update — Update a user's subscription preferences
app.post('/api/email/subscriptions/update', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const { email, status, categories } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const docId = emailDocId(email);
    const existing = await db.collection('emailSubscriptions').doc(docId).get();
    const update = { email: email.toLowerCase(), updatedAt: new Date().toISOString() };
    if (status) update.status = status;
    if (categories) update.categories = categories;
    if (!existing.exists) {
      update.subscribedAt = new Date().toISOString();
      update.status = update.status || 'active';
      update.categories = update.categories || {};
    }
    await db.collection('emailSubscriptions').doc(docId).set(update, { merge: true });
    return res.json({ success: true, data: { docId, ...update } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/email/automation-log — View lifecycle transitions
app.get('/api/email/automation-log', async (req, res) => {
  try {
    const db = await initFirebase();
    if (!db) return res.status(503).json({ success: false, message: 'Firebase not configured' });
    const snap = await db.collection('emailAutomationLog').orderBy('triggeredAt', 'desc').limit(200).get();
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, data: logs });
  } catch (error) {
    // Fallback if no index exists
    try {
      const db = await initFirebase();
      const snap = await db.collection('emailAutomationLog').get();
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => new Date(b.triggeredAt || 0) - new Date(a.triggeredAt || 0));
      return res.json({ success: true, data: logs.slice(0, 200) });
    } catch (e2) {
      return res.status(500).json({ success: false, message: e2.message });
    }
  }
});

// GET /api/email/types — List all email types and categories
app.get('/api/email/types', (req, res) => {
  return res.json({ success: true, data: { types: EMAIL_TYPES, categories: EMAIL_CATEGORIES } });
});

function emailDocId(email) {
  return email.toLowerCase().replace(/\./g, ',');
}

app.all('/api/*', apiHandler);
