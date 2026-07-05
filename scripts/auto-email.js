import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const NVDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVDIA_MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b';
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB_ID || 'intern';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'support@rutujdhodapkar.tech';
const FROM_NAME = process.env.FROM_NAME || 'DEV/CRAFT';

function resolveSA() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const sa = JSON.parse(json);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}

function initFirebase() {
  if (getApps().length > 0) return;
  initializeApp({ credential: cert(resolveSA()) });
  globalThis.__db = getFirestore(getApps()[0], FIRESTORE_DB_ID);
}
function db() { return globalThis.__db; }

function now() { return new Date().toISOString(); }

// ─── Queue via Firestore (no RTDB dependency) ─────────────────────────────

async function getPendingEmails() {
  const snap = await db().collection('emailQueue')
    .where('status', '==', 'pending')
    .limit(30).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function markEmailSent(id, result) {
  await db().collection('emailQueue').doc(id).update({
    status: 'sent', processedAt: now(), messageId: result.messageId,
  });
}

async function markEmailFailed(id, error) {
  const ref = db().collection('emailQueue').doc(id);
  const doc = await ref.get();
  if (!doc.exists) return;
  const data = doc.data();
  const retries = (data.retryCount || 0) + 1;
  if (retries >= 3) {
    await ref.update({ status: 'failed', retryCount: retries, error, processedAt: now() });
    console.log(`  → moved to failed`);
  } else {
    await ref.update({ status: 'pending', retryCount: retries, error });
    console.log(`  → retry (${retries}/3)`);
  }
}

// ─── Enqueue emails from Firestore submissions ───────────────────────────

async function enqueueVerificationEmails() {
  console.log('[Enqueue] Checking recent verifications...');
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const snap = await db().collection('enrollments').get();

  const byEmail = {};
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.email) continue;
    const subs = d.submissions || {};
    const results = [];
    for (const [idx, sub] of Object.entries(subs)) {
      if (!sub.verified && !sub.rejected) continue;
      if (!sub.aiVerifiedAt || sub.aiVerifiedAt < yesterday) continue;
      results.push({
        projectIndex: parseInt(idx),
        projectTitle: d.projects?.[parseInt(idx)]?.title || `Project ${parseInt(idx) + 1}`,
        verified: !!sub.verified, reason: sub.aiReason || '',
      });
    }
    if (results.length === 0) continue;
    const email = d.email.toLowerCase();
    if (!byEmail[email]) {
      const dedupKey = `summary_${email}_${new Date().toISOString().slice(0, 10)}`;
      const existing = await db().collection('emailQueue')
        .where('dedupKey', '==', dedupKey).limit(1).get();
      if (!existing.empty) continue;
      byEmail[email] = {
        dedupKey, email: d.email, fullName: d.name || d.displayName || '',
        template: 'verification_summary', category: 'task',
        status: 'pending', retryCount: 0,
        payload: { results, domain: d.domain || '', totalProjects: (d.projects || []).length },
        createdAt: now(),
      };
    } else {
      byEmail[email].payload.results.push(...results);
    }
  }

  const entries = Object.values(byEmail);
  for (const entry of entries) {
    await db().collection('emailQueue').add(entry);
  }
  console.log(`[Enqueue] Queued ${entries.length} summary emails (${Object.keys(byEmail).length} users)`);
}

// ─── NVIDIA email generation ──────────────────────────────────────────────

async function generateEmailContent(template, vars) {
  const results = vars.payload?.results || [];
  const verified = results.filter(r => r.verified);
  const rejected = results.filter(r => !r.verified);
  const summary = results.map(r =>
    `- ${r.projectTitle}: ${r.verified ? 'VERIFIED' : 'NEEDS CHANGES'}${r.reason ? ' (' + r.reason + ')' : ''}`
  ).join('\n');
  const prompt = `You write a single summary email for DEV/CRAFT internship platform.
Student: ${vars.fullName || 'Student'}
Domain: ${vars.payload?.domain || ''}
Recent results:\n${summary || 'No recent changes'}
Write ONE email covering ALL results above.
Return ONLY JSON: { "subject": "...", "html": "..." }
HTML: inline styles, professional, black/white, include CTA button to dashboard.`;

  const resp = await fetch(NVDIA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NVDIA_MODEL, messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, max_tokens: 800,
    }),
  });
  if (!resp.ok) throw new Error(`NVIDIA ${resp.status}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  const match = text.match(/\{[\s\S]*"subject"[\s\S]*"html"[\s\S]*\}/);
  if (!match) throw new Error('No JSON in NVIDIA response');
  return JSON.parse(match[0]);
}

// ─── Brevo sending ────────────────────────────────────────────────────────

async function sendBrevo({ to, subject, html, tag }) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }], subject, htmlContent: html, textContent: plain, tag: tag || 'general',
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
  return { success: true, messageId: data.messageId };
}

function fallbackHtml(template, vars) {
  const p = vars.payload || {};
  const results = p.results || [];
  const name = vars.fullName || 'Student';
  const verifiedCount = results.filter(r => r.verified).length;
  const totalCount = results.length;
  const allVerified = verifiedCount === totalCount;
  const title = allVerified ? 'Project Updates — All Verified' : 'Project Updates — Action Needed';
  const items = results.map(r =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${r.projectTitle}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:${r.verified ? '#090' : '#c00'}">${r.verified ? '✓ Verified' : '✗ Needs Changes'}</td></tr>`
  ).join('');
  const body = `<h2>${allVerified ? 'Great work, ' + name + '!' : 'Update for ' + name}</h2>
<p>${verifiedCount} of ${totalCount} recent project submission(s) were verified.</p>
${!allVerified ? '<p style="color:#c00;font-weight:700">Some submissions need revision. Check feedback and resubmit.</p>' : ''}
<table style="width:100%;border-collapse:collapse;margin:16px 0">${items}</table>
<div style="text-align:center;margin-top:20px">
  <a href="https://devcraft.rutujdhodapkar.tech/dashboard" style="display:inline-block;padding:10px 24px;background:#000;color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase">View Dashboard</a>
</div>`;
  return {
    subject: title,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;line-height:1.6}
.wrapper{max-width:600px;margin:0 auto;padding:20px}
.header{text-align:center;padding:32px 20px;border-bottom:2px solid #000}
.header h1{font-size:20px;font-weight:800;text-transform:uppercase}
.body{padding:28px 24px;border-bottom:2px solid #000}
.body h2{font-size:17px;font-weight:700;margin-bottom:12px}
.body p{font-size:14px;color:#444;margin-bottom:14px}
.footer{text-align:center;padding:20px;font-size:12px;color:#999}
</style></head><body><div class="wrapper">
<div class="header"><h1>${title}</h1></div>
<div class="body">${body}</div>
<div class="footer"><p>DEV/CRAFT</p></div>
</div></body></html>`,
  };
}

// ─── Process queue ────────────────────────────────────────────────────────

async function processQueue() {
  const emails = await getPendingEmails();
  if (emails.length === 0) { console.log('[Queue] No pending emails'); return { sent: 0, failed: 0 }; }
  console.log(`[Queue] ${emails.length} to process`);
  let sent = 0, failed = 0;

  for (const email of emails) {
    try {
      let subject, html;
      try {
        if (process.env.NVIDIA_API_KEY) {
          const gen = await generateEmailContent(email.template, email);
          subject = gen.subject; html = gen.html;
        }
      } catch (e) {}
      if (!html) {
        const fb = fallbackHtml(email.template, email);
        subject = fb.subject; html = fb.html;
      }
      const result = await sendBrevo({ to: email.email, subject, html, tag: email.template });
      await markEmailSent(email.id, result);
      console.log(`  ✓ ${email.email} → ${subject}`);
      sent++;
    } catch (err) {
      console.error(`  ✗ ${email.email}: ${err.message}`);
      await markEmailFailed(email.id, err.message);
      failed++;
    }
  }
  return { sent, failed };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(50));
  console.log('[Email Automation] Starting');
  const start = Date.now();
  initFirebase();

  if (!BREVO_API_KEY) console.log('[Email Automation] BREVO_API_KEY not set — dry run');

  await enqueueVerificationEmails();
  const results = await processQueue();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('='.repeat(50));
  console.log(`[Email Automation] Complete in ${elapsed}s`);
  console.log(`  Sent: ${results.sent}, Failed: ${results.failed}`);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });
