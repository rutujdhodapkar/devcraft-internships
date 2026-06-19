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

export default async function handler(req, res) {
  const method = req.method;
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const segments = path.split('/');

  const firestore = getDb();

  try {
    // ─── Auth endpoints ─────────────────────────────────────────────
    if (path === 'check-admin' && method === 'POST') {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ success: false, message: 'Email required.' });
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail === 'rutujdhodapkar@gmail.com') return res.json({ success: true, isAdmin: true });
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const snap = await firestore.collection('admins').get();
      const admins = snap.docs.map(d => d.data().email?.toLowerCase().trim());
      return res.json({ success: true, isAdmin: admins.includes(cleanEmail) });
    }

    if (path === 'admins' && method === 'GET') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const snap = await firestore.collection('admins').get();
      const data = snap.docs.map(d => d.data().email);
      return res.json({ success: true, data });
    }

    if (segments[0] === 'admins' && segments[1] && method === 'DELETE') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const cleanEmail = decodeURIComponent(segments[1]).toLowerCase().trim();
      const snap = await firestore.collection('admins').get();
      for (const d of snap.docs) {
        if (d.data().email?.toLowerCase().trim() === cleanEmail) await d.ref.delete();
      }
      const remaining = snap.docs.filter(d => d.data().email?.toLowerCase().trim() !== cleanEmail).map(d => d.data().email);
      return res.json({ success: true, data: remaining });
    }

    // ─── Currency rates ─────────────────────────────────────────────
    if (path === 'rates' && method === 'GET') {
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (response.ok) {
          const data = await response.json();
          if (data?.rates) return res.json({ success: true, rates: data.rates, source: 'network' });
        }
      } catch {}
      return res.json({ success: true, rates: fallbackRates, source: 'fallback' });
    }

    // ─── Admin data ─────────────────────────────────────────────────
    if (path === 'admin-data' && method === 'GET') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const [reqSnap, refSnap, visSnap] = await Promise.all([
        firestore.collection('inquiries').get(),
        firestore.collection('referrals').get(),
        firestore.collection('referralVisits').get(),
      ]);
      const requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const referrals = refSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const visits = visSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 100);
      return res.json({ success: true, data: { requests, referrals, visits } });
    }

    // ─── Inquire ────────────────────────────────────────────────────
    if (path === 'inquire' && method === 'POST') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const { name, email, phone, projectType, planTier } = req.body || {};
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
      await firestore.collection('inquiries').add(newInquiry);
      return res.status(201).json({ success: true, message: 'Inquiry received!', inquiryId: newInquiry.id });
    }

    if (path === 'inquiries' && method === 'GET') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const snap = await firestore.collection('inquiries').get();
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json({ success: true, data });
    }

    if (segments[0] === 'inquiries' && segments[1] && method === 'DELETE') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const snap = await firestore.collection('inquiries').where('id', '==', segments[1]).get();
      for (const d of snap.docs) await d.ref.delete();
      return res.json({ success: true, message: `Inquiry ${segments[1]} deleted.` });
    }

    // ─── AI verify task ─────────────────────────────────────────────
    if (path === 'ai/verify-task' && method === 'POST') {
      const { taskTitle, taskDescription, taskNotices, submissionText, submissionUrl, internName, codeFiles } = req.body || {};
      if (!taskTitle || !submissionText) {
        return res.status(400).json({ success: false, message: 'Task title and submission text are required.' });
      }
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) return res.status(500).json({ success: false, message: 'NVIDIA API key not configured.' });
      try {
        const promptParts = [
          `Task Title: ${taskTitle}`,
          `Task Description: ${taskDescription || 'No description provided'}`,
        ];
        if (taskNotices?.trim()) promptParts.push(`Task Instructions/Notices:\n${taskNotices}`);
        promptParts.push(`Student Name: ${internName || 'Unknown'}`);
        promptParts.push(`Student's Submission Text: ${submissionText}`);
        if (submissionUrl) promptParts.push(`Submission URL: ${submissionUrl}`);
        if (codeFiles?.length) {
          promptParts.push(`\n=== ACTUAL CODE FETCHED FROM REPOSITORY ===`);
          for (const file of codeFiles) {
            promptParts.push(`\n--- File: ${file.path || file.name || 'unknown'} ---\n${file.content}`);
          }
          promptParts.push(`\n=== END OF CODE ===`);
          promptParts.push(`\nCRITICAL: Carefully check if the code above actually implements what was asked. Check for: 1) Does the code solve the problem described? 2) Are there any placeholder/boilerplate/todo comments? 3) Does the code look like it was written specifically for this task? If the code is wrong, incomplete, or doesn't match the task, set verified to false with specific reasons.`);
        } else {
          promptParts.push(`\nIMPORTANT: No actual code could be fetched from the student's submission. The provided link may be invalid, private, or not a code repository. You MUST set verified to false and explain that the code could not be accessed.`);
        }
        promptParts.push('\nEvaluate this submission and respond with JSON only.');
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'meta/llama-3.3-70b-instruct',
            messages: [
              { role: 'system', content: `You are an AI internship task verifier. Evaluate the student's project submission against the task requirements.
Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "verified": boolean,
  "confidence": number (0-100),
  "reason": "brief explanation",
  "message": "constructive feedback for the student"
}` },
              { role: 'user', content: promptParts.join('\n') },
            ],
            temperature: 0.3,
            max_tokens: 600,
          }),
        });
        if (!response.ok) throw new Error(`NVIDIA API error ${response.status}`);
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        let result;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) result = JSON.parse(jsonMatch[0]);
          else throw new Error('No JSON');
        } catch {
          result = { verified: false, confidence: 0, reason: 'AI response could not be parsed', message: 'AI verification failed.' };
        }
        return res.json({ success: true, data: { ...result, rawResponse: content } });
      } catch (error) {
        return res.status(500).json({ success: false, message: 'AI verification failed: ' + error.message });
      }
    }

    // ─── Referrals ──────────────────────────────────────────────────
    if (path === 'referrals' && method === 'POST') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const referral = {
        ...req.body,
        code: req.body.code || `REF-${Date.now().toString(36).toUpperCase()}`,
        visited: req.body.visited || 0,
        contacted: req.body.contacted || 0,
        createdAt: req.body.createdAt || new Date().toISOString(),
      };
      const ref = await firestore.collection('referrals').add(referral);
      return res.status(201).json({ success: true, data: { id: ref.id, ...referral } });
    }

    if (path === 'referral-visits' && method === 'POST') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const { referralCode } = req.body || {};
      const code = String(referralCode || '').toUpperCase();
      const refSnap = await firestore.collection('referrals').get();
      let matchedReferral = null;
      for (const d of refSnap.docs) {
        if (String(d.data().code).toUpperCase() === code) { matchedReferral = d; break; }
      }
      const visit = {
        ...req.body,
        referralCode: code,
        matched: Boolean(matchedReferral),
        visitedAt: req.body.visitedAt || new Date().toISOString(),
        action: 'visited',
      };
      await firestore.collection('referralVisits').add(visit);
      if (matchedReferral) {
        await matchedReferral.ref.update({
          visited: Number(matchedReferral.data().visited || 0) + 1,
          lastVisitedAt: visit.visitedAt,
        });
      }
      return res.status(201).json({ success: true, data: visit });
    }

    if (segments[0] === 'referrals' && segments[1] && method === 'DELETE') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const code = String(segments[1]).toUpperCase();
      const snap = await firestore.collection('referrals').get();
      for (const d of snap.docs) {
        if (String(d.data().code).toUpperCase() === code) await d.ref.delete();
      }
      return res.json({ success: true, message: `Referral ${code} deleted.` });
    }

    if (segments[0] === 'referrals' && segments[2] === 'contacted' && method === 'POST') {
      if (!firestore) return res.status(503).json({ error: 'Firestore not configured' });
      const code = String(segments[1]).toUpperCase();
      const snap = await firestore.collection('referrals').get();
      let matched = null;
      for (const d of snap.docs) {
        if (String(d.data().code).toUpperCase() === code) { matched = d; break; }
      }
      if (matched) {
        await matched.ref.update({
          contacted: Number(matched.data().contacted || 0) + 1,
          lastContactedAt: new Date().toISOString(),
        });
      }
      return res.json({ success: true, data: matched ? { id: matched.id, ...matched.data() } : null });
    }

    return res.status(404).json({ error: `Route /api/${path} not found` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
