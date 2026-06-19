import admin from 'firebase-admin';
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!admin.apps.length) {
  let cred;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      cred = admin.credential.cert(typeof raw === 'string' && raw.trim().startsWith('{') ? JSON.parse(raw) : raw);
    } else {
      const p = join(__dirname, '../server/firebase-service-account.json');
      if (existsSync(p)) cred = admin.credential.cert(JSON.parse(readFileSync(p, 'utf8')));
    }
  } catch (e) {
    console.error('Admin init error:', e.message);
  }
  admin.initializeApp({ credential: cred, databaseURL: 'https://login-data-680b9-default-rtdb.firebaseio.com' });
}

const db = admin.database();

const PUBLIC = ['careerPaths', 'faqs', 'services', 'siteContent', 'siteNotices', 'courses', 'testimonials'];

async function getUser(req) {
  const t = req.headers.authorization?.replace('Bearer ', '');
  if (!t) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(t);
    return { uid: decoded.uid, email: decoded.email || '' };
  } catch { return null; }
}

function route(req) {
  const u = new URL(req.url, 'http://localhost');
  return (u.searchParams.get('path') || u.pathname.replace(/^\/api\/?/, '')).replace(/\/$/, '').split('/');
}

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
      default:
        return [400, { error: `unknown action: ${action}` }];
    }
  } catch (e) { return [500, { error: e.message }]; }
}

export default async function handler(req, res) {
  try {
    const segments = route(req);
    const path = segments.join('/');
    const user = await getUser(req);
    const method = req.method;

    // Firestore-style proxy (backed by RTDB now)
    if (segments[0] === 'firestore' && segments[1] && method === 'POST') {
      const { collection, doc, data } = req.body || {};
      const isWrite = ['set', 'update', 'push', 'delete'].includes(segments[1]);
      if (isWrite && !user) return res.status(401).json({ error: 'auth required' });
      const [code, json] = await proxy(segments[1], collection, doc, data);
      return res.status(code).json(json);
    }

    // Quiz grading
    if (path === 'grade-quiz-text' && method === 'POST') {
      const { question, answer } = req.body || {};
      if (!question || !answer) return res.status(400).json({ error: 'Missing question or answer' });
      const key = process.env.NVIDIA_API_KEY;
      if (!key) return res.status(503).json({ error: 'AI grading not configured' });
      const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'meta/llama-3.3-70b-instruct', messages: [{ role: 'system', content: 'Respond JSON only: {"correct":boolean,"reason":"..."}' }, { role: 'user', content: `Question: ${question}\nAnswer: ${answer}\nCorrect?` }], temperature: 0.2, max_tokens: 500 }),
      });
      if (!resp.ok) return res.status(502).json({ error: 'AI grading failed' });
      const d = await resp.json();
      const c = d.choices?.[0]?.message?.content || '';
      const m = c.match(/\{[\s\S]*\}/);
      return m ? res.json(JSON.parse(m[0])) : res.status(502).json({ error: 'Invalid AI response' });
    }

    // Public: rates
    if (path === 'rates' && method === 'GET') {
      try { const r = await fetch('https://open.er-api.com/v6/latest/USD'); if (r.ok) { const d = await r.json(); if (d?.rates) return res.json({ success: true, rates: d.rates, source: 'network' }); } } catch {}
      return res.json({ success: true, rates: { USD: 1.0, INR: 83.5, EUR: 0.93, GBP: 0.79, CAD: 1.37, AUD: 1.51, JPY: 157.4 }, source: 'fallback' });
    }

    // Public: inquire
    if (path === 'inquire' && method === 'POST') {
      const { name, email, phone, projectType, planTier } = req.body || {};
      if (!name || !email || !phone || !projectType || !planTier) return res.status(400).json({ success: false, message: 'All fields required' });
      const id = `INQ-${Date.now()}`;
      await db.ref('inquiries').child(id).set({ ...req.body, id, createdAt: new Date().toISOString(), status: 'contacted', progress: 'New request' });
      return res.status(201).json({ success: true, message: 'Inquiry received!' });
    }

    // Public: referral-visits
    if (path === 'referral-visits' && method === 'POST') {
      const code = String(req.body?.referralCode || '').toUpperCase();
      const refs = await db.ref('referrals').once('value');
      let matched = false;
      refs.forEach(c => { if (String(c.val().code).toUpperCase() === code) matched = true; });
      await db.ref('referralVisits').push({ ...req.body, referralCode: code, matched, visitedAt: new Date().toISOString(), action: 'visited' });
      if (matched) {
        refs.forEach(c => {
          if (String(c.val().code).toUpperCase() === code) {
            c.ref.update({ visited: (c.val().visited || 0) + 1 });
          }
        });
      }
      return res.status(201).json({ success: true, data: { referralCode: code, matched } });
    }

    // Auth required below
    if (!user) return res.status(401).json({ error: 'auth required' });

    // check-admin
    if (path === 'check-admin' && method === 'POST') {
      const email = (req.body?.email || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ success: false, message: 'Email required' });
      if (email === 'rutujdhodapkar@gmail.com') return res.json({ success: true, isAdmin: true });
      const snap = await db.ref('admins').once('value');
      let isAdmin = false;
      snap.forEach(c => { if (c.val().email?.toLowerCase().trim() === email) isAdmin = true; });
      return res.json({ success: true, isAdmin });
    }

    // admins GET
    if (path === 'admins' && method === 'GET') {
      const snap = await db.ref('admins').once('value');
      const emails = [];
      snap.forEach(c => emails.push(c.val().email));
      return res.json({ success: true, data: emails });
    }

    // admins DELETE
    if (segments[0] === 'admins' && segments[1] && method === 'DELETE') {
      const clean = decodeURIComponent(segments[1]).toLowerCase().trim();
      const snap = await db.ref('admins').once('value');
      snap.forEach(c => { if (c.val().email?.toLowerCase().trim() === clean) c.ref.remove(); });
      return res.json({ success: true });
    }

    // admin-data
    if (path === 'admin-data' && method === 'GET') {
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
      return res.json({ success: true, data: { requests: inqArr, referrals: refArr, visits: visArr } });
    }

    // inquiries GET
    if (path === 'inquiries' && method === 'GET') {
      const snap = await db.ref('inquiries').once('value');
      const arr = snapArr(snap);
      arr.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      return res.json({ success: true, data: arr });
    }

    // inquiries DELETE
    if (segments[0] === 'inquiries' && segments[1] && method === 'DELETE') {
      await db.ref('inquiries').child(segments[1]).remove();
      return res.json({ success: true });
    }

    // ai/verify-task
    if (path === 'ai/verify-task' && method === 'POST') {
      const { taskTitle, submissionText } = req.body || {};
      if (!taskTitle || !submissionText) return res.status(400).json({ success: false, message: 'Title and submission required' });
      const key = process.env.NVIDIA_API_KEY;
      if (!key) return res.status(500).json({ success: false, message: 'NVIDIA key not configured' });
      const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'meta/llama-3.3-70b-instruct', messages: [{ role: 'system', content: 'Evaluate. Respond JSON: {"verified":boolean,"confidence":number,"reason":"...","message":"..."}' }, { role: 'user', content: `Task: ${taskTitle}\nSubmission: ${submissionText}` }], temperature: 0.3, max_tokens: 600 }),
      });
      if (!resp.ok) throw new Error(`NVIDIA error ${resp.status}`);
      const d = await resp.json();
      const c = d.choices?.[0]?.message?.content || '';
      const m = c.match(/\{[\s\S]*\}/);
      return res.json({ success: true, data: { ...(m ? JSON.parse(m[0]) : { verified: false }), rawResponse: c } });
    }

    // referrals POST
    if (path === 'referrals' && method === 'POST') {
      const code = req.body?.code || `REF-${Date.now().toString(36).toUpperCase()}`;
      await db.ref('referrals').child(code).set({ ...req.body, code, visited: 0, contacted: 0, createdAt: new Date().toISOString() });
      return res.status(201).json({ success: true, data: { code } });
    }

    // referrals DELETE
    if (segments[0] === 'referrals' && segments[1] && method === 'DELETE') {
      await db.ref('referrals').child(segments[1]).remove();
      return res.json({ success: true });
    }

    // referrals/:code/contacted
    if (segments[0] === 'referrals' && segments[2] === 'contacted' && method === 'POST') {
      const code = String(segments[1]).toUpperCase();
      const snap = await db.ref('referrals').once('value');
      snap.forEach(c => {
        if (c.val().code === code) {
          c.ref.update({ contacted: (c.val().contacted || 0) + 1, lastContactedAt: new Date().toISOString() });
        }
      });
      return res.json({ success: true });
    }

    return res.status(404).json({ error: `Not found: ${path}` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
