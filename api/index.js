import admin from 'firebase-admin';

let db = null;

function getDb() {
  if (db) return db;
  if (admin.apps.length) { db = admin.firestore(); return db; }
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) return null;
  try {
    const sa = JSON.parse(Buffer.from(saJson, 'base64').toString());
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    db = admin.firestore();
    return db;
  } catch { return null; }
}

async function verifyToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const resp = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    if (!resp.ok) return null;
    const info = await resp.json();
    return { uid: info.sub, email: info.email };
  } catch { return null; }
}

const fallbackRates = { USD: 1.0, INR: 83.5, EUR: 0.93, GBP: 0.79, CAD: 1.37, AUD: 1.51, JPY: 157.4 };
const PUBLIC_COLLECTIONS = new Set(['careerPaths', 'faqs', 'services', 'siteContent', 'siteNotices', 'courses', 'testimonials']);

function getPath(req) {
  if (req.query?.path) return String(req.query.path).replace(/^\/|\/$/g, '');
  const u = new URL(req.url, 'http://localhost');
  return u.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
}

async function handleFirestore(firestore, user, body) {
  if (!firestore) return { status: 503, json: { error: 'Firestore not configured' } };
  const { action, collection, doc, data, queries } = body;
  if (!collection) return { status: 400, json: { error: 'collection required' } };
  const isWrite = ['set', 'update', 'push', 'delete'].includes(action);
  if (isWrite && !user) return { status: 401, json: { error: 'auth required for write operations' } };
  if (action === 'get' && !user && !PUBLIC_COLLECTIONS.has(collection)) {
    return { status: 401, json: { error: 'auth required to read this collection' } };
  }
  try {
    switch (action) {
      case 'get':
        if (doc) {
          const snap = await firestore.collection(collection).doc(doc).get();
          return { json: { data: snap.exists ? { id: snap.id, ...snap.data() } : null } };
        }
        const snap = await firestore.collection(collection).get();
        return { json: { data: snap.docs.map(d => ({ id: d.id, ...d.data() })) } };
      case 'set':
        if (!data) return { status: 400, json: { error: 'data required' } };
        { const ref = doc ? firestore.collection(collection).doc(doc) : firestore.collection(collection).doc(); await ref.set(data); return { json: { data: { id: ref.id, ...data } } }; }
      case 'update':
        if (!doc || !data) return { status: 400, json: { error: 'doc and data required' } };
        await firestore.collection(collection).doc(doc).set(data, { merge: true });
        return { json: { success: true } };
      case 'push':
        if (!data) return { status: 400, json: { error: 'data required' } };
        { const ref = await firestore.collection(collection).add(data); return { json: { data: { id: ref.id, ...data } } }; }
      case 'delete':
        if (!doc) return { status: 400, json: { error: 'doc required' } };
        await firestore.collection(collection).doc(doc).delete();
        return { json: { success: true } };
      default:
        return { status: 400, json: { error: `Unknown action: ${action}` } };
    }
  } catch (e) { return { status: 500, json: { error: e.message } }; }
}

export default async function handler(req, res) {
  const path = getPath(req);
  const segments = path.split('/');
  const method = req.method;
  const firestore = getDb();
  const user = await verifyToken(req);

  // ─── Firestore proxy ─────────────────────────────────────────────
  if (segments[0] === 'firestore' && segments[1] && method === 'POST') {
    const body = req.body || {};
    body.action = segments[1];
    const result = await handleFirestore(firestore, user, body);
    return res.status(result.status || 200).json(result.json);
  }

  // ─── Quiz grading ─────────────────────────────────────────────────
  if (path === 'grade-quiz-text' && method === 'POST') {
    const { question, answer } = req.body || {};
    if (!question || !answer) return res.status(400).json({ error: 'Missing question or answer' });
    const trimmed = String(answer).trim();
    if (!trimmed) return res.status(400).json({ correct: false, reason: 'Empty answer' });
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI grading not configured' });
    try {
      const prompt = `Question: ${question}\nStudent's Answer: ${trimmed}\n\nIs this answer correct? Respond with JSON only.`;
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'meta/llama-3.3-70b-instruct', messages: [{ role: 'system', content: 'You are a strict quiz answer grader. Determine if the student\'s answer correctly answers the question. Be fair but accurate. Respond ONLY with valid JSON: {"correct": boolean, "reason": "brief explanation"}' }, { role: 'user', content: prompt }], temperature: 0.2, max_tokens: 500 }),
      });
      if (!response.ok) { const t = await response.text(); return res.status(502).json({ error: `AI service error: ${response.status}`, detail: t.slice(0, 200) }); }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return res.status(502).json({ error: 'Invalid AI response format', raw: content.slice(0, 200) });
      const result = JSON.parse(match[0]);
      if (typeof result.correct !== 'boolean') return res.status(502).json({ error: 'AI response missing correct field', raw: result });
      return res.status(200).json(result);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  // ─── Public routes ────────────────────────────────────────────────
  if (path === 'rates' && method === 'GET') {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (response.ok) { const d = await response.json(); if (d?.rates) return res.json({ success: true, rates: d.rates, source: 'network' }); }
    } catch {}
    return res.json({ success: true, rates: fallbackRates, source: 'fallback' });
  }

  if (path === 'inquire' && method === 'POST') {
    if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
    const { name, email, phone, projectType, planTier } = req.body || {};
    if (!name || !email || !phone || !projectType || !planTier) return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    const newInquiry = { id: `INQ-${Date.now()}`, createdAt: new Date().toISOString(), ...req.body, status: req.body.status || 'contacted', progress: req.body.progress || 'New request' };
    await firestore.collection('inquiries').add(newInquiry);
    return res.status(201).json({ success: true, message: 'Inquiry received!', inquiryId: newInquiry.id });
  }

  if (path === 'referral-visits' && method === 'POST') {
    if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
    const code = String(req.body?.referralCode || '').toUpperCase();
    const refSnap = await firestore.collection('referrals').get();
    let matched = null;
    for (const d of refSnap.docs) { if (String(d.data().code).toUpperCase() === code) { matched = d; break; } }
    const visit = { ...req.body, referralCode: code, matched: Boolean(matched), visitedAt: req.body?.visitedAt || new Date().toISOString(), action: 'visited' };
    await firestore.collection('referralVisits').add(visit);
    if (matched) await matched.ref.update({ visited: Number(matched.data().visited || 0) + 1, lastVisitedAt: visit.visitedAt });
    return res.status(201).json({ success: true, data: visit });
  }

  // ─── Auth-required routes ──────────────────────────────────────────
  if (!user) return res.status(401).json({ error: 'auth required' });

  try {
    if (path === 'check-admin' && method === 'POST') {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ success: false, message: 'Email required.' });
      const clean = email.toLowerCase().trim();
      if (clean === 'rutujdhodapkar@gmail.com') return res.json({ success: true, isAdmin: true });
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const snap = await firestore.collection('admins').get();
      return res.json({ success: true, isAdmin: snap.docs.some(d => d.data().email?.toLowerCase().trim() === clean) });
    }

    if (path === 'admins' && method === 'GET') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const snap = await firestore.collection('admins').get();
      return res.json({ success: true, data: snap.docs.map(d => d.data().email) });
    }

    if (segments[0] === 'admins' && segments[1] && method === 'DELETE') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const clean = decodeURIComponent(segments[1]).toLowerCase().trim();
      const snap = await firestore.collection('admins').get();
      const remaining = [];
      for (const d of snap.docs) {
        if (d.data().email?.toLowerCase().trim() === clean) await d.ref.delete();
        else remaining.push(d.data().email);
      }
      return res.json({ success: true, data: remaining });
    }

    if (path === 'admin-data' && method === 'GET') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const [r, ref, v] = await Promise.all([
        firestore.collection('inquiries').get(),
        firestore.collection('referrals').get(),
        firestore.collection('referralVisits').get(),
      ]);
      return res.json({ success: true, data: {
        requests: r.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        referrals: ref.docs.map(d => ({ id: d.id, ...d.data() })),
        visits: v.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 100),
      } });
    }

    if (path === 'inquiries' && method === 'GET') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      return res.json({ success: true, data: (await firestore.collection('inquiries').get()).docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    if (segments[0] === 'inquiries' && segments[1] && method === 'DELETE') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const snap = await firestore.collection('inquiries').where('id', '==', segments[1]).get();
      for (const d of snap.docs) await d.ref.delete();
      return res.json({ success: true, message: `Inquiry ${segments[1]} deleted.` });
    }

    if (path === 'ai/verify-task' && method === 'POST') {
      const { taskTitle, submissionText, taskDescription, taskNotices, submissionUrl, internName, codeFiles } = req.body || {};
      if (!taskTitle || !submissionText) return res.status(400).json({ success: false, message: 'Task title and submission text are required.' });
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) return res.status(500).json({ success: false, message: 'NVIDIA API key not configured.' });
      try {
        const parts = [`Task Title: ${taskTitle}`, `Task Description: ${taskDescription || 'No description provided'}`];
        if (taskNotices?.trim()) parts.push(`Task Instructions/Notices:\n${taskNotices}`);
        parts.push(`Student Name: ${internName || 'Unknown'}`, `Student's Submission Text: ${submissionText}`);
        if (submissionUrl) parts.push(`Submission URL: ${submissionUrl}`);
        if (codeFiles?.length) {
          parts.push(`\n=== ACTUAL CODE FETCHED FROM REPOSITORY ===`);
          for (const f of codeFiles) parts.push(`\n--- File: ${f.path || f.name || 'unknown'} ---\n${f.content}`);
          parts.push(`\n=== END OF CODE ===\nCRITICAL: Carefully check if the code above actually implements what was asked. Check for: 1) Does the code solve the problem described? 2) Are there any placeholder/boilerplate/todo comments? 3) Does the code look like it was written specifically for this task? If the code is wrong, incomplete, or doesn't match the task, set verified to false with specific reasons.`);
        } else {
          parts.push(`\nIMPORTANT: No actual code could be fetched from the student's submission. The provided link may be invalid, private, or not a code repository. You MUST set verified to false and explain that the code could not be accessed.`);
        }
        parts.push('\nEvaluate this submission and respond with JSON only.');
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'meta/llama-3.3-70b-instruct', messages: [{ role: 'system', content: 'You are an AI internship task verifier. Evaluate the student\'s project submission against the task requirements.\nRespond ONLY with a valid JSON object (no markdown, no extra text):\n{ "verified": boolean, "confidence": number (0-100), "reason": "brief explanation", "message": "constructive feedback for the student" }' }, { role: 'user', content: parts.join('\n') }], temperature: 0.3, max_tokens: 600 }),
        });
        if (!response.ok) throw new Error(`NVIDIA API error ${response.status}`);
        const d = await response.json();
        const c = d.choices?.[0]?.message?.content || '';
        let result;
        try { const m = c.match(/\{[\s\S]*\}/); if (m) result = JSON.parse(m[0]); else throw new Error(); } catch { result = { verified: false, confidence: 0, reason: 'AI response could not be parsed', message: 'AI verification failed.' }; }
        return res.json({ success: true, data: { ...result, rawResponse: c } });
      } catch (e) { return res.status(500).json({ success: false, message: 'AI verification failed: ' + e.message }); }
    }

    if (path === 'referrals' && method === 'POST') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const referral = { ...req.body, code: req.body.code || `REF-${Date.now().toString(36).toUpperCase()}`, visited: req.body.visited || 0, contacted: req.body.contacted || 0, createdAt: req.body.createdAt || new Date().toISOString() };
      const ref = await firestore.collection('referrals').add(referral);
      return res.status(201).json({ success: true, data: { id: ref.id, ...referral } });
    }

    if (segments[0] === 'referrals' && segments[1] && method === 'DELETE') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const code = String(segments[1]).toUpperCase();
      const snap = await firestore.collection('referrals').get();
      for (const d of snap.docs) { if (String(d.data().code).toUpperCase() === code) await d.ref.delete(); }
      return res.json({ success: true, message: `Referral ${code} deleted.` });
    }

    if (segments[0] === 'referrals' && segments[2] === 'contacted' && method === 'POST') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const code = String(segments[1]).toUpperCase();
      const snap = await firestore.collection('referrals').get();
      let matched = null;
      for (const d of snap.docs) { if (String(d.data().code).toUpperCase() === code) { matched = d; break; } }
      if (matched) await matched.ref.update({ contacted: Number(matched.data().contacted || 0) + 1, lastContactedAt: new Date().toISOString() });
      return res.json({ success: true, data: matched ? { id: matched.id, ...matched.data() } : null });
    }

    return res.status(404).json({ error: `Route /api/${path} not found` });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
