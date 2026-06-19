import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: 'https://login-data-680b9-default-rtdb.firebaseio.com' });
  } else {
    admin.initializeApp({ databaseURL: 'https://login-data-680b9-default-rtdb.firebaseio.com' });
  }
}

const db = admin.database();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { req.authUser = null; return next(); }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.authUser = { uid: decoded.uid, email: decoded.email || '' };
  } catch { req.authUser = null; }
  next();
}
app.use(verifyToken);

function snapArr(snap) {
  const a = [];
  snap.forEach(c => a.push({ id: c.key, ...c.val() }));
  return a;
}

async function proxy(action, coll, doc, data) {
  if (!coll) return [400, { error: 'collection required' }];
  try {
    const ref = db.ref(coll);
    switch (action) {
      case 'get': {
        if (doc) {
          const snap = await ref.child(doc).once('value');
          return [200, { data: snap.exists() ? { id: doc, ...snap.val() } : null }];
        }
        const snap = await ref.once('value');
        const arr = snapArr(snap);
        arr.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        return [200, { data: arr }];
      }
      case 'set': {
        await ref.child(doc || crypto.randomUUID()).set(data || {});
        return [200, { data: { id: doc, ...data } }];
      }
      case 'update': {
        if (!data) return [400, { error: 'data required' }];
        await ref.child(doc).update(data);
        return [200, { success: true }];
      }
      case 'push': {
        const d = data || {};
        if (doc) {
          await ref.child(doc).set(d);
          return [200, { data: { id: doc, ...d } }];
        }
        const newRef = ref.push();
        await newRef.set(d);
        return [200, { data: { id: newRef.key, ...d } }];
      }
      case 'delete': {
        if (!doc) return [400, { error: 'doc required' }];
        await ref.child(doc).remove();
        return [200, { success: true }];
      }
      default: return [400, { error: `unknown action: ${action}` }];
    }
  } catch (e) { return [500, { error: e.message }]; }
}

// Firestore-style proxy (backed by RTDB)
app.post('/api/firestore/:action', async (req, res) => {
  const { action } = req.params;
  const { collection, doc, data } = req.body || {};
  const isWrite = ['set', 'update', 'push', 'delete'].includes(action);
  if (isWrite && !req.authUser) return res.status(401).json({ error: 'auth required' });
  const [code, json] = await proxy(action, collection, doc, data);
  res.status(code).json(json);
});

// Rates
const RATES = { USD: 1.0, INR: 83.5, EUR: 0.93, GBP: 0.79, CAD: 1.37, AUD: 1.51, JPY: 157.4 };
app.get('/api/rates', async (req, res) => {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    if (r.ok) { const d = await r.json(); if (d?.rates) return res.json({ success: true, rates: d.rates, source: 'network' }); }
  } catch {}
  res.json({ success: true, rates: RATES, source: 'fallback' });
});

// Inquire
app.post('/api/inquire', async (req, res) => {
  const { name, email, phone, projectType, planTier } = req.body || {};
  if (!name || !email || !phone || !projectType || !planTier) return res.status(400).json({ success: false, message: 'All fields required' });
  const id = `INQ-${Date.now()}`;
  await db.ref('inquiries').child(id).set({ ...req.body, id, createdAt: new Date().toISOString(), status: 'contacted', progress: 'New request' });
  res.status(201).json({ success: true, message: 'Inquiry received!' });
});

// Referral visits
app.post('/api/referral-visits', async (req, res) => {
  const code = String(req.body?.referralCode || '').toUpperCase();
  const refs = await db.ref('referrals').once('value');
  let matched = false;
  refs.forEach(c => { if (String(c.val().code).toUpperCase() === code) matched = true; });
  await db.ref('referralVisits').push({ ...req.body, referralCode: code, matched, visitedAt: new Date().toISOString(), action: 'visited' });
  if (matched) {
    refs.forEach(c => {
      if (String(c.val().code).toUpperCase() === code) c.ref.update({ visited: (c.val().visited || 0) + 1 });
    });
  }
  res.status(201).json({ success: true, data: { referralCode: code, matched } });
});

// Admin data
app.get('/api/admin-data', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const [inq, ref, vis] = await Promise.all([
    db.ref('inquiries').once('value'),
    db.ref('referrals').once('value'),
    db.ref('referralVisits').orderByChild('visitedAt').limitToLast(100).once('value'),
  ]);
  const toArr = s => { const a = []; s.forEach(c => a.push({ id: c.key, ...c.val() })); return a; };
  const inqArr = toArr(inq);
  inqArr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const refArr = toArr(ref);
  refArr.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const visArr = toArr(vis);
  visArr.reverse();
  res.json({ success: true, data: { requests: inqArr, referrals: refArr, visits: visArr } });
});

// Check admin
app.post('/api/check-admin', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  if (email === 'rutujdhodapkar@gmail.com') return res.json({ success: true, isAdmin: true });
  const snap = await db.ref('admins').once('value');
  let isAdmin = false;
  snap.forEach(c => { if (c.val().email?.toLowerCase().trim() === email) isAdmin = true; });
  res.json({ success: true, isAdmin });
});

// Admins
app.get('/api/admins', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const snap = await db.ref('admins').once('value');
  const emails = [];
  snap.forEach(c => emails.push(c.val().email));
  res.json({ success: true, data: emails });
});

app.post('/api/admins', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  const ref = db.ref('admins').push();
  await ref.set({ email, createdAt: new Date().toISOString() });
  res.json({ success: true });
});

app.delete('/api/admins/:email', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const clean = decodeURIComponent(req.params.email).toLowerCase().trim();
  const snap = await db.ref('admins').once('value');
  snap.forEach(c => { if (c.val().email?.toLowerCase().trim() === clean) c.ref.remove(); });
  res.json({ success: true });
});

// Inquiries
app.get('/api/inquiries', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const snap = await db.ref('inquiries').once('value');
  const arr = snapArr(snap);
  arr.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  res.json({ success: true, data: arr });
});

app.delete('/api/inquiries/:id', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  await db.ref('inquiries').child(req.params.id).remove();
  res.json({ success: true });
});

// Referrals
app.post('/api/referrals', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const code = req.body?.code || `REF-${Date.now().toString(36).toUpperCase()}`;
  await db.ref('referrals').child(code).set({ ...req.body, code, visited: 0, contacted: 0, createdAt: new Date().toISOString() });
  res.status(201).json({ success: true, data: { code } });
});

app.delete('/api/referrals/:code', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  await db.ref('referrals').child(req.params.code).remove();
  res.json({ success: true });
});

app.post('/api/referrals/:code/contacted', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const code = String(req.params.code).toUpperCase();
  const snap = await db.ref('referrals').once('value');
  snap.forEach(c => {
    if (c.val().code === code) c.ref.update({ contacted: (c.val().contacted || 0) + 1, lastContactedAt: new Date().toISOString() });
  });
  res.json({ success: true });
});

// AI verify
app.post('/api/ai/verify-task', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const { taskTitle, submissionText } = req.body || {};
  if (!taskTitle || !submissionText) return res.status(400).json({ success: false, message: 'Title and submission required' });
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return res.status(500).json({ success: false, message: 'NVIDIA key not configured' });
  try {
    const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'meta/llama-3.3-70b-instruct', messages: [{ role: 'system', content: 'Evaluate. Respond JSON: {"verified":boolean,"confidence":number,"reason":"...","message":"..."}' }, { role: 'user', content: `Task: ${taskTitle}\nSubmission: ${submissionText}` }], temperature: 0.3, max_tokens: 600 }),
    });
    if (!resp.ok) throw new Error(`NVIDIA error ${resp.status}`);
    const d = await resp.json();
    const c = d.choices?.[0]?.message?.content || '';
    const m = c.match(/\{[\s\S]*\}/);
    res.json({ success: true, data: { ...(m ? JSON.parse(m[0]) : { verified: false }), rawResponse: c } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Serve built client
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
