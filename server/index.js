import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();
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

async function proxy(action, coll, doc, data) {
  if (!coll) return [400, { error: 'collection required' }];
  try {
    const ref = doc ? db.collection(coll).doc(doc) : null;
    switch (action) {
      case 'get': {
        if (doc) {
          const snap = await ref.get();
          return [200, { data: snap.exists ? { id: doc, ...snap.data() } : null }];
        }
        const snap = await db.collection(coll).orderBy('createdAt', 'asc').get();
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        return [200, { data: arr }];
      }
      case 'set': {
        await ref.set(data || {}, { merge: false });
        return [200, { data: { id: doc, ...data } }];
      }
      case 'update': {
        if (!data) return [400, { error: 'data required' }];
        await ref.set(data, { merge: true });
        return [200, { success: true }];
      }
      case 'push': {
        const d = data || {};
        if (doc) {
          await ref.set(d, { merge: false });
          return [200, { data: { id: doc, ...d } }];
        }
        const r = await db.collection(coll).add(d);
        return [200, { data: { id: r.id, ...d } }];
      }
      case 'delete': {
        if (!doc) return [400, { error: 'doc required' }];
        await ref.delete();
        return [200, { success: true }];
      }
      default: return [400, { error: `unknown action: ${action}` }];
    }
  } catch (e) { return [500, { error: e.message }]; }
}

app.post('/api/firestore/:action', async (req, res) => {
  const { action } = req.params;
  const { collection, doc, data } = req.body || {};
  const isWrite = ['set', 'update', 'push', 'delete'].includes(action);
  if (isWrite && !req.authUser) return res.status(401).json({ error: 'auth required' });
  const [code, json] = await proxy(action, collection, doc, data);
  res.status(code).json(json);
});

const RATES = { USD: 1.0, INR: 83.5, EUR: 0.93, GBP: 0.79, CAD: 1.37, AUD: 1.51, JPY: 157.4 };
app.get('/api/rates', async (req, res) => {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    if (r.ok) { const d = await r.json(); if (d?.rates) return res.json({ success: true, rates: d.rates, source: 'network' }); }
  } catch {}
  res.json({ success: true, rates: RATES, source: 'fallback' });
});

app.post('/api/inquire', async (req, res) => {
  const { name, email, phone, projectType, planTier } = req.body || {};
  if (!name || !email || !phone || !projectType || !planTier) return res.status(400).json({ success: false, message: 'All fields required' });
  const id = `INQ-${Date.now()}`;
  await db.collection('inquiries').doc(id).set({ ...req.body, id, createdAt: new Date().toISOString(), status: 'contacted', progress: 'New request' });
  res.status(201).json({ success: true, message: 'Inquiry received!' });
});

app.post('/api/referral-visits', async (req, res) => {
  const code = String(req.body?.referralCode || '').toUpperCase();
  const refs = await db.collection('referrals').get();
  let matched = false;
  refs.forEach(d => { if (String(d.data().code).toUpperCase() === code) matched = true; });
  await db.collection('referralVisits').add({ ...req.body, referralCode: code, matched, visitedAt: new Date().toISOString(), action: 'visited' });
  if (matched) {
    refs.forEach(d => {
      if (String(d.data().code).toUpperCase() === code) d.ref.update({ visited: (d.data().visited || 0) + 1 });
    });
  }
  res.status(201).json({ success: true, data: { referralCode: code, matched } });
});

app.get('/api/admin-data', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const [inq, ref, vis] = await Promise.all([
    db.collection('inquiries').orderBy('createdAt', 'desc').get(),
    db.collection('referrals').orderBy('createdAt', 'asc').get(),
    db.collection('referralVisits').orderBy('visitedAt', 'desc').limit(100).get(),
  ]);
  const toArr = s => { const a = []; s.forEach(d => a.push({ id: d.id, ...d.data() })); return a; };
  res.json({ success: true, data: { requests: toArr(inq), referrals: toArr(ref), visits: toArr(vis) } });
});

app.post('/api/check-admin', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  if (email === 'rutujdhodapkar@gmail.com') return res.json({ success: true, isAdmin: true });
  const snap = await db.collection('admins').where('email', '==', email).get();
  res.json({ success: true, isAdmin: !snap.empty });
});

app.get('/api/admins', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const snap = await db.collection('admins').orderBy('createdAt', 'asc').get();
  const emails = [];
  snap.forEach(d => emails.push(d.data().email));
  res.json({ success: true, data: emails });
});

app.post('/api/admins', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  await db.collection('admins').add({ email, createdAt: new Date().toISOString() });
  res.json({ success: true });
});

app.delete('/api/admins/:email', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const clean = decodeURIComponent(req.params.email).toLowerCase().trim();
  const snap = await db.collection('admins').where('email', '==', clean).get();
  snap.forEach(d => d.ref.delete());
  res.json({ success: true });
});

app.get('/api/inquiries', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const snap = await db.collection('inquiries').orderBy('createdAt', 'asc').get();
  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
  res.json({ success: true, data: arr });
});

app.delete('/api/inquiries/:id', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  await db.collection('inquiries').doc(req.params.id).delete();
  res.json({ success: true });
});

app.post('/api/referrals', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const code = req.body?.code || `REF-${Date.now().toString(36).toUpperCase()}`;
  await db.collection('referrals').doc(code).set({ ...req.body, code, visited: 0, contacted: 0, createdAt: new Date().toISOString() });
  res.status(201).json({ success: true, data: { code } });
});

app.delete('/api/referrals/:code', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  await db.collection('referrals').doc(req.params.code).delete();
  res.json({ success: true });
});

app.post('/api/referrals/:code/contacted', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const code = String(req.params.code).toUpperCase();
  const snap = await db.collection('referrals').where('code', '==', code).get();
  snap.forEach(d => d.ref.update({ contacted: (d.data().contacted || 0) + 1, lastContactedAt: new Date().toISOString() }));
  res.json({ success: true });
});

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

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
