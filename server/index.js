import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const sql = neon(process.env.DATABASE_URL);

sql`
  CREATE TABLE IF NOT EXISTS docs (
    collection TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (collection, doc_id)
  )
`.catch(() => {});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { req.authUser = null; return next(); }
  try {
    const resp = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    if (resp.ok) {
      const info = await resp.json();
      req.authUser = { uid: info.sub, email: info.email };
    } else { req.authUser = null; }
  } catch { req.authUser = null; }
  next();
}
app.use(verifyToken);

const PUBLIC = ['careerPaths', 'faqs', 'services', 'siteContent', 'siteNotices', 'courses', 'testimonials'];

async function proxy(action, coll, doc, data) {
  if (!coll) return [400, { error: 'collection required' }];
  try {
    switch (action) {
      case 'get': {
        if (doc) {
          const r = await sql`SELECT data FROM docs WHERE collection=${coll} AND doc_id=${doc}`;
          return [200, { data: r.length ? { id: doc, ...r[0].data } : null }];
        }
        const r = await sql`SELECT doc_id, data FROM docs WHERE collection=${coll} ORDER BY created_at`;
        return [200, { data: r.map(x => ({ id: x.doc_id, ...x.data })) }];
      }
      case 'set': {
        const d = data || {};
        await sql`INSERT INTO docs (collection, doc_id, data) VALUES (${coll}, ${doc || crypto.randomUUID()}, ${JSON.stringify(d)}) ON CONFLICT (collection, doc_id) DO UPDATE SET data=${JSON.stringify(d)}, updated_at=NOW()`;
        return [200, { data: { id: doc, ...d } }];
      }
      case 'update': {
        if (!data) return [400, { error: 'data required' }];
        const existing = doc ? (await sql`SELECT data FROM docs WHERE collection=${coll} AND doc_id=${doc}`)[0] : null;
        const merged = existing ? { ...existing.data, ...data } : data;
        await sql`INSERT INTO docs (collection, doc_id, data) VALUES (${coll}, ${doc}, ${JSON.stringify(merged)}) ON CONFLICT (collection, doc_id) DO UPDATE SET data=${JSON.stringify(merged)}, updated_at=NOW()`;
        return [200, { success: true }];
      }
      case 'push': {
        const d = data || {};
        const id = d.id || crypto.randomUUID();
        await sql`INSERT INTO docs (collection, doc_id, data) VALUES (${coll}, ${id}, ${JSON.stringify(d)}) ON CONFLICT (collection, doc_id) DO UPDATE SET data=${JSON.stringify(d)}, updated_at=NOW()`;
        return [200, { data: { id, ...d } }];
      }
      case 'delete': {
        if (!doc) return [400, { error: 'doc required' }];
        await sql`DELETE FROM docs WHERE collection=${coll} AND doc_id=${doc}`;
        return [200, { success: true }];
      }
      default: return [400, { error: `unknown action: ${action}` }];
    }
  } catch (e) { return [500, { error: e.message }]; }
}

// Firestore-style proxy
app.post('/api/firestore/:action', async (req, res) => {
  const { action } = req.params;
  const { collection, doc, data, authRequired } = req.body || {};
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
  await sql`INSERT INTO docs (collection, doc_id, data) VALUES ('inquiries', ${`INQ-${Date.now()}`}, ${JSON.stringify({ ...req.body, id: `INQ-${Date.now()}`, createdAt: new Date().toISOString(), status: 'contacted', progress: 'New request' })})`;
  res.status(201).json({ success: true, message: 'Inquiry received!' });
});

// Referral visits
app.post('/api/referral-visits', async (req, res) => {
  const code = String(req.body?.referralCode || '').toUpperCase();
  const refs = await sql`SELECT doc_id, data FROM docs WHERE collection='referrals'`;
  const matched = refs.find(r => String(r.data?.code).toUpperCase() === code);
  await sql`INSERT INTO docs (collection, doc_id, data) VALUES ('referralVisits', ${`VIS-${Date.now()}`}, ${JSON.stringify({ ...req.body, referralCode: code, matched: !!matched, visitedAt: new Date().toISOString(), action: 'visited' })})`;
  if (matched) await sql`UPDATE docs SET data=jsonb_set(data, '{visited}', (COALESCE(data->>'visited','0')::int+1)::text::jsonb), updated_at=NOW() WHERE collection='referrals' AND doc_id=${matched.doc_id}`;
  res.status(201).json({ success: true, data: { referralCode: code, matched: !!matched } });
});

// Admin data
app.get('/api/admin-data', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const [inq, ref, vis] = await Promise.all([
    sql`SELECT doc_id, data FROM docs WHERE collection='inquiries' ORDER BY (data->>'createdAt') DESC`,
    sql`SELECT doc_id, data FROM docs WHERE collection='referrals' ORDER BY created_at`,
    sql`SELECT doc_id, data FROM docs WHERE collection='referralVisits' ORDER BY (data->>'visitedAt') DESC LIMIT 100`,
  ]);
  res.json({ success: true, data: { requests: inq.map(x => ({ id: x.doc_id, ...x.data })), referrals: ref.map(x => ({ id: x.doc_id, ...x.data })), visits: vis.map(x => ({ id: x.doc_id, ...x.data })) } });
});

// Check admin
app.post('/api/check-admin', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  if (email === 'rutujdhodapkar@gmail.com') return res.json({ success: true, isAdmin: true });
  const admins = await sql`SELECT data FROM docs WHERE collection='admins'`;
  res.json({ success: true, isAdmin: admins.some(a => a.data?.email?.toLowerCase().trim() === email) });
});

// Admins
app.get('/api/admins', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const r = await sql`SELECT data FROM docs WHERE collection='admins' ORDER BY created_at`;
  res.json({ success: true, data: r.map(x => x.data?.email) });
});

app.post('/api/admins', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  await sql`INSERT INTO docs (collection, doc_id, data) VALUES ('admins', ${crypto.randomUUID()}, ${JSON.stringify({ email })}) ON CONFLICT (collection, doc_id) DO NOTHING`;
  res.json({ success: true });
});

app.delete('/api/admins/:email', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const clean = decodeURIComponent(req.params.email).toLowerCase().trim();
  await sql`DELETE FROM docs WHERE collection='admins' AND LOWER(data->>'email')=${clean}`;
  res.json({ success: true });
});

// Inquiries
app.get('/api/inquiries', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const r = await sql`SELECT doc_id, data FROM docs WHERE collection='inquiries' ORDER BY created_at`;
  res.json({ success: true, data: r.map(x => ({ id: x.doc_id, ...x.data })) });
});

app.delete('/api/inquiries/:id', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  await sql`DELETE FROM docs WHERE collection='inquiries' AND doc_id=${req.params.id}`;
  res.json({ success: true });
});

// Referrals
app.post('/api/referrals', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const code = req.body?.code || `REF-${Date.now().toString(36).toUpperCase()}`;
  await sql`INSERT INTO docs (collection, doc_id, data) VALUES ('referrals', ${code}, ${JSON.stringify({ ...req.body, code, visited: 0, contacted: 0, createdAt: new Date().toISOString() })})`;
  res.status(201).json({ success: true, data: { code } });
});

app.delete('/api/referrals/:code', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const code = String(req.params.code).toUpperCase();
  await sql`DELETE FROM docs WHERE collection='referrals' AND doc_id=${code}`;
  res.json({ success: true });
});

app.post('/api/referrals/:code/contacted', async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'auth required' });
  const code = String(req.params.code).toUpperCase();
  await sql`UPDATE docs SET data=jsonb_set(jsonb_set(data, '{contacted}', (COALESCE(data->>'contacted','0')::int+1)::text::jsonb), '{lastContactedAt}', ${JSON.stringify(new Date().toISOString())}::jsonb), updated_at=NOW() WHERE collection='referrals' AND doc_id=${code}`;
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

app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
