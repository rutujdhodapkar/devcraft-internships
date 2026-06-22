import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';


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

const DATABASE_URL = 'https://login-data-680b9-default-rtdb.firebaseio.com';

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
    const { getDatabase } = await import('firebase-admin/database');
    const apps = getApps();
    if (apps.length) return getDatabase(apps[0]);
    const sa = getServiceAccount();
    if (!sa) {
      throw new Error('Firebase Admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env');
    }
    const app = initializeApp({
      credential: cert(sa),
      databaseURL: DATABASE_URL,
      projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID || 'login-data-680b9',
    });
    return getDatabase(app);
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
        const snap = await db.ref('siteConfig/dodoConfig').once('value');
        const val = snap.val();
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
        const ref = db.ref(`enrollments/${enrollmentId}`);
        await ref.update({ paymentStatus: 'paid', paymentStage: 'fully_paid', paidAt: new Date().toISOString(), paymentIntentId: paymentId, updatedAt: new Date().toISOString() });
        const snap = await ref.once('value');
        const enr = snap.val();
        if (enr) {
          const projects = enr.projects || [];
          const submissions = enr.submissions || {};
          const allVerified = projects.length > 0 && projects.every((_, i) => submissions[i]?.verified);
          if (allVerified) {
            await ref.update({ allowedCertificate: 'yes', status: 'Completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          }
        }
        console.log(`Dodo: Payment succeeded for ${enrollmentId}`);
      } catch (fbErr) { console.error('Firebase update failed:', fbErr.message); }
    } else if (eventType === 'payment.failed' && enrollmentId) {
      try {
        const db = await initFirebase();
        await db.ref(`enrollments/${enrollmentId}`).update({ paymentStatus: 'failed', updatedAt: new Date().toISOString() });
      } catch {}
    }
    res.json({ received: true });
  } catch (error) {
    console.error('Dodo webhook error:', error);
    res.status(500).json({ received: false, error: error.message });
  }
});

// Firebase proxy (used by client to access RTDB via Admin SDK)
app.post('/api/firebase-proxy', async (req, res) => {
  try {
    const db = await initFirebase();
    const { action, path, data, query } = req.body || {};
    if (!action || !path) return res.status(400).json({ success: false, message: 'action and path required' });
    const blockedWrites = ['admins', 'users'];
    const root = path.split('/')[0];
    if (blockedWrites.includes(root) && ['set', 'update', 'push', 'delete'].includes(action)) {
      return res.status(403).json({ success: false, message: `Direct write to ${root}/ denied via proxy` });
    }
    let result;
    const ref = db.ref(path);
    switch (action) {
      case 'get': { const snap = await ref.once('value'); result = snap.exists() ? snap.val() : null; break; }
      case 'set': await ref.set(data); result = data; break;
      case 'update': await ref.update(data); result = data; break;
      case 'push': { const childRef = ref.push(); await childRef.set(data); result = { id: childRef.key, ...data }; break; }
      case 'delete': await ref.remove(); result = true; break;
      case 'list': {
        const snap = await ref.once('value');
        if (!snap.exists()) { result = []; break; }
        const arr = []; snap.forEach((child) => arr.push({ id: child.key, ...child.val() })); result = arr; break;
      }
      case 'query': {
        let q = ref;
        if (query?.orderBy) q = q.orderByChild(query.orderBy);
        if (query?.limitToLast) q = q.limitToLast(query.limitToLast);
        if (query?.limitToFirst) q = q.limitToFirst(query.limitToFirst);
        if (query?.equalTo !== undefined) q = q.equalTo(query.equalTo);
        const snap = await q.once('value');
        if (!snap.exists()) { result = query?.single ? null : []; break; }
        if (query?.single) { result = snap.val(); break; }
        const arr = []; snap.forEach((child) => arr.push({ id: child.key, ...child.val() })); result = arr; break;
      }
      default: return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Enrollment status (used by client for polling after Dodo payment)
app.get('/api/enrollment-status/:id', async (req, res) => {
  try {
    const db = await initFirebase();
    const snap = await db.ref(`enrollments/${req.params.id}`).once('value');
    const data = snap.val();
    return res.json({ paymentStatus: data?.paymentStatus || 'none', paymentIntentId: data?.paymentIntentId || '' });
  } catch {
    return res.json({ paymentStatus: 'none', paymentIntentId: '' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
