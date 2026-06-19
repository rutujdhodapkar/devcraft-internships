import { neon } from '@neondatabase/serverless';

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

const PUBLIC = ['careerPaths', 'faqs', 'services', 'siteContent', 'siteNotices', 'courses', 'testimonials'];

function getUser(req) {
  const t = req.headers.authorization?.replace('Bearer ', '');
  if (!t) return null;
  return fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${t}`)
    .then(r => r.ok ? r.json() : null)
    .then(i => i ? { uid: i.sub, email: i.email } : null)
    .catch(() => null);
}

function route(req) {
  const u = new URL(req.url, 'http://localhost');
  return (u.searchParams.get('path') || u.pathname.replace(/^\/api\/?/, '')).replace(/\/$/, '').split('/');
}

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

    // Firestore-style proxy
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
      await sql`INSERT INTO docs (collection, doc_id, data) VALUES ('inquiries', ${`INQ-${Date.now()}`}, ${JSON.stringify({ ...req.body, id: `INQ-${Date.now()}`, createdAt: new Date().toISOString(), status: 'contacted', progress: 'New request' })})`;
      return res.status(201).json({ success: true, message: 'Inquiry received!' });
    }

    // Public: referral-visits
    if (path === 'referral-visits' && method === 'POST') {
      const code = String(req.body?.referralCode || '').toUpperCase();
      const refs = await sql`SELECT doc_id, data FROM docs WHERE collection='referrals'`;
      const matched = refs.find(r => String(r.data?.code).toUpperCase() === code);
      await sql`INSERT INTO docs (collection, doc_id, data) VALUES ('referralVisits', ${`VIS-${Date.now()}`}, ${JSON.stringify({ ...req.body, referralCode: code, matched: !!matched, visitedAt: new Date().toISOString(), action: 'visited' })})`;
      if (matched) await sql`UPDATE docs SET data=jsonb_set(data, '{visited}', (COALESCE(data->>'visited','0')::int+1)::text::jsonb), updated_at=NOW() WHERE collection='referrals' AND doc_id=${matched.doc_id}`;
      return res.status(201).json({ success: true, data: { referralCode: code, matched: !!matched } });
    }

    // Auth required below
    if (!user) return res.status(401).json({ error: 'auth required' });

    // check-admin
    if (path === 'check-admin' && method === 'POST') {
      const email = (req.body?.email || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ success: false, message: 'Email required' });
      if (email === 'rutujdhodapkar@gmail.com') return res.json({ success: true, isAdmin: true });
      const admins = await sql`SELECT data FROM docs WHERE collection='admins'`;
      return res.json({ success: true, isAdmin: admins.some(a => a.data?.email?.toLowerCase().trim() === email) });
    }

    // admins GET
    if (path === 'admins' && method === 'GET') {
      const r = await sql`SELECT data FROM docs WHERE collection='admins' ORDER BY created_at`;
      return res.json({ success: true, data: r.map(x => x.data?.email) });
    }

    // admins DELETE
    if (segments[0] === 'admins' && segments[1] && method === 'DELETE') {
      const clean = decodeURIComponent(segments[1]).toLowerCase().trim();
      await sql`DELETE FROM docs WHERE collection='admins' AND LOWER(data->>'email')=${clean}`;
      return res.json({ success: true });
    }

    // admin-data
    if (path === 'admin-data' && method === 'GET') {
      const [inq, ref, vis] = await Promise.all([
        sql`SELECT doc_id, data FROM docs WHERE collection='inquiries' ORDER BY (data->>'createdAt') DESC`,
        sql`SELECT doc_id, data FROM docs WHERE collection='referrals' ORDER BY created_at`,
        sql`SELECT doc_id, data FROM docs WHERE collection='referralVisits' ORDER BY (data->>'visitedAt') DESC LIMIT 100`,
      ]);
      return res.json({ success: true, data: { requests: inq.map(x => ({ id: x.doc_id, ...x.data })), referrals: ref.map(x => ({ id: x.doc_id, ...x.data })), visits: vis.map(x => ({ id: x.doc_id, ...x.data })) } });
    }

    // inquiries GET
    if (path === 'inquiries' && method === 'GET') {
      const r = await sql`SELECT doc_id, data FROM docs WHERE collection='inquiries' ORDER BY created_at`;
      return res.json({ success: true, data: r.map(x => ({ id: x.doc_id, ...x.data })) });
    }

    // inquiries DELETE
    if (segments[0] === 'inquiries' && segments[1] && method === 'DELETE') {
      await sql`DELETE FROM docs WHERE collection='inquiries' AND doc_id=${segments[1]}`;
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
      await sql`INSERT INTO docs (collection, doc_id, data) VALUES ('referrals', ${code}, ${JSON.stringify({ ...req.body, code, visited: 0, contacted: 0, createdAt: new Date().toISOString() })})`;
      return res.status(201).json({ success: true, data: { code } });
    }

    // referrals DELETE
    if (segments[0] === 'referrals' && segments[1] && method === 'DELETE') {
      const code = String(segments[1]).toUpperCase();
      await sql`DELETE FROM docs WHERE collection='referrals' AND doc_id=${code}`;
      return res.json({ success: true });
    }

    // referrals/:code/contacted
    if (segments[0] === 'referrals' && segments[2] === 'contacted' && method === 'POST') {
      const code = String(segments[1]).toUpperCase();
      await sql`UPDATE docs SET data=jsonb_set(jsonb_set(data, '{contacted}', (COALESCE(data->>'contacted','0')::int+1)::text::jsonb), '{lastContactedAt}', ${JSON.stringify(new Date().toISOString())}::jsonb), updated_at=NOW() WHERE collection='referrals' AND doc_id=${code}`;
      return res.json({ success: true });
    }

    return res.status(404).json({ error: `Not found: ${path}` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
