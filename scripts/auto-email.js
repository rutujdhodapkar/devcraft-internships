import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

const NVDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVDIA_MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b';
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB_ID || 'intern';
const RTDB_URL = process.env.RTDB_URL;
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
  const sa = resolveSA();
  const app = initializeApp({ credential: cert(sa), databaseURL: RTDB_URL });
  globalThis.__db = getFirestore(app, FIRESTORE_DB_ID);
  globalThis.__rtdb = getDatabase(app);
}

function db() { return globalThis.__db; }
function rtdb() { return globalThis.__rtdb; }

function now() { return new Date().toISOString(); }
function daysSince(d) { return d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0; }

async function rtdbGet(path) { const snap = await rtdb().ref(path).once('value'); return snap.val(); }
async function rtdbSet(path, data) { await rtdb().ref(path).set(data); }
async function rtdbUpdate(path, data) { await rtdb().ref(path).update(data); }
async function rtdbDelete(path) { await rtdb().ref(path).remove(); }

async function enqueue(job) {
  const id = `notif_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
  await rtdbSet(`email_queue/${id}`, { ...job, notificationId: id, createdAt: now(), retryCount: 0, status: 'pending' });
  return id;
}

async function getPendingJobs(limit) {
  const queue = await rtdbGet('email_queue') || {};
  const nowDate = new Date();
  return Object.entries(queue)
    .filter(([, j]) => j.status === 'pending' || (j.status === 'scheduled' && j.scheduledAt && new Date(j.scheduledAt) <= nowDate))
    .slice(0, limit || 50)
    .map(([id, j]) => ({ id, ...j }));
}

async function markCompleted(id, result) {
  const job = await rtdbGet(`email_queue/${id}`);
  if (!job) return;
  await rtdbSet(`completed_jobs/${id}`, { ...job, status: 'completed', processedAt: now(), providerResponse: result });
  await rtdbDelete(`email_queue/${id}`);
}

async function markFailed(id, errMsg) {
  const job = await rtdbGet(`email_queue/${id}`);
  if (!job) return;
  const retries = (job.retryCount || 0) + 1;
  if (retries >= 3) {
    await rtdbSet(`failed_jobs/${id}`, { ...job, status: 'failed', retryCount: retries, processedAt: now(), error: errMsg });
    await rtdbDelete(`email_queue/${id}`);
    console.log(`  → moved to failed_jobs`);
  } else {
    await rtdbUpdate(`email_queue/${id}`, { status: 'pending', retryCount: retries, error: errMsg });
    console.log(`  → will retry (${retries}/3)`);
  }
}

// ─── NVIDIA email generation ──────────────────────────────────────────────

async function generateEmailContent(template, vars) {
  const prompt = `You write professional emails for DEV/CRAFT internship platform.
Template type: ${template}
Student: ${vars.fullName || 'Student'}
Domain: ${vars.internshipDomain || ''}
Return ONLY JSON: { "subject": "...", "html": "..." }
HTML: inline styles, black/white theme, professional, under 300 words, include CTA button.`;

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

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendBrevo({ to, subject, html, templateName, category }) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const resp = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }], subject, htmlContent: html, textContent: plain,
      tag: templateName || category || 'general',
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
  return { success: true, messageId: data.messageId };
}

function fallbackTemplate(template, v) {
  const tpls = {
    welcome: ['Welcome to DEV/CRAFT', `Welcome, ${v.fullName || 'Student'}! Your application has been received.`],
    task_assigned: ['New Task Assigned', `A new task has been assigned: ${v.taskName || ''}`],
    task_completed: ['Task Submitted', 'Your task has been submitted for review.'],
    task_verified: ['Task Verified', `Task verified. Progress: ${v.completedTasks || 0}/${v.totalTasks || 0}.`],
    payment_pending: ['Payment Reminder', `Payment of Rs ${v.amount || '200'} is pending.`],
    payment_success: ['Payment Received', `Payment of Rs ${v.amount || '200'} received successfully.`],
    certificate_ready: ['Certificate Ready', `Congratulations ${v.fullName || 'Graduate'}! Your certificate is ready.`],
    internship_completed: ['Internship Completed', `Well done, ${v.fullName || 'Graduate'}! You completed ${v.internshipTitle || 'your internship'}.`],
    internship_expired: ['Internship Period Ended', 'Your internship period has ended.'],
    promo: ['New Opportunities', `Hello ${v.fullName || 'Student'}, explore new domains at DEV/CRAFT.`],
    reminder: ['Reminder', v.message || 'Action may be needed.'],
    announcement: [v.title || 'Announcement', v.message || 'An announcement from DEV/CRAFT.'],
    verification_result: [v.verified ? 'Submission Verified' : 'Submission Update', v.message || ''],
  };
  const tpl = tpls[template];
  if (!tpl) return null;
  const body = `<h2>${tpl[1]}</h2><div style="text-align:center;margin-top:20px"><a href="https://devcraft.rutujdhodapkar.tech/dashboard" style="display:inline-block;padding:10px 24px;background:#000;color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase">View Dashboard</a></div>`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;line-height:1.6}
.wrapper{max-width:600px;margin:0 auto;padding:20px}
.header{text-align:center;padding:32px 20px;border-bottom:2px solid #000}
.header h1{font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:1px}
.body{padding:28px 24px;border-bottom:2px solid #000}
.body h2{font-size:17px;font-weight:700;margin-bottom:12px;color:#000}
.body p{font-size:14px;color:#444;margin-bottom:14px}
.footer{text-align:center;padding:20px;font-size:12px;color:#999}
.footer a{color:#000;text-decoration:underline}
</style></head><body><div class="wrapper">
<div class="header"><h1>${tpl[0]}</h1><p style="color:#666;font-size:13px;margin-top:4px">DEV/CRAFT Internship Platform</p></div>
<div class="body">${body}</div>
<div class="footer"><p>DEV/CRAFT</p><p style="margin-top:6px"><a href="https://devcraft.rutujdhodapkar.tech/api/email/unsubscribe?email=${encodeURIComponent(v.email || '')}">Unsubscribe</a></p></div>
</div></body></html>`;
  return { subject: tpl[0], html };
}

// ─── Sync enrollments → RTDB (for lifecycle tracking) ────────────────────

async function syncEnrollments() {
  console.log('[Sync] Reading enrollments...');
  const snap = await db().collection('enrollments').get();
  const existingApps = (await rtdbGet('email_queue_applications')) || {};
  let synced = 0;
  const updates = {};
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.email) continue;
    const appId = (d.email || doc.id).toLowerCase().replace(/[.#$\[\]\/]/g, '_');
    if (existingApps[appId]) continue;
    updates[`email_queue_applications/${appId}`] = {
      applicationId: doc.id, email: d.email,
      fullName: d.name || d.displayName || '',
      internshipDomain: d.domain || '',
      internshipTitle: d.domain || '',
      paymentStatus: d.paymentStatus || d.paymentStage || 'none',
      currentState: 'synced', lastSyncedAt: now(),
    };
    synced++;
  }
  if (synced > 0) {
    await rtdb().ref().update(updates);
    console.log(`[Sync] Synced ${synced} new (${snap.docs.length} total)`);
  } else {
    console.log(`[Sync] All ${snap.docs.length} already synced`);
  }
}

// ─── Process queue ────────────────────────────────────────────────────────

async function processQueue() {
  const jobs = await getPendingJobs(30);
  if (jobs.length === 0) { console.log('[Queue] No pending jobs'); return { sent: 0, failed: 0 }; }
  console.log(`[Queue] ${jobs.length} jobs to process`);
  let sent = 0, failed = 0;

  for (const job of jobs) {
    try {
      await rtdbUpdate(`email_queue/${job.id}`, { status: 'processing' });

      const subKey = (job.email || '').toLowerCase().replace(/[.#$\[\]\/]/g, '_');
      const sub = await rtdbGet(`email_subscriptions/${subKey}`);
      if (sub?.status === 'unsubscribed') {
        await markCompleted(job.id, { skipped: true, reason: 'unsubscribed' });
        console.log(`  · ${job.email} unsubscribed, skipped`); continue;
      }

      let subject = job.subject, html = job.html;
      if (!html) {
        try {
          if (process.env.NVIDIA_API_KEY) {
            const gen = await generateEmailContent(job.template, { ...job, ...job.payload });
            subject = gen.subject; html = gen.html;
          }
        } catch (e) {
          const fb = fallbackTemplate(job.template, { ...job, ...job.payload });
          if (fb) { subject = fb.subject; html = fb.html; }
        }
        if (!html) { const fb = fallbackTemplate(job.template, { ...job, ...job.payload }); if (fb) { subject = fb.subject; html = fb.html; } }
      }
      if (!html) { await markFailed(job.id, 'No content'); failed++; continue; }

      const result = await sendBrevo({ to: job.email, subject, html, templateName: job.template, category: job.category });
      await markCompleted(job.id, result);
      console.log(`  ✓ ${job.email} → ${subject}`);
      sent++;
    } catch (err) {
      console.error(`  ✗ ${job.email}: ${err.message}`);
      await markFailed(job.id, err.message);
      failed++;
    }
  }
  return { sent, failed };
}

// ─── Archive old ──────────────────────────────────────────────────────────

async function archiveJobs(daysOld) {
  for (const col of ['completed_jobs', 'failed_jobs']) {
    const data = await rtdbGet(col) || {};
    let archived = 0;
    for (const [id, job] of Object.entries(data)) {
      if (job.processedAt && daysSince(job.processedAt) >= daysOld) {
        await rtdbDelete(`${col}/${id}`); archived++;
      }
    }
    if (archived > 0) console.log(`[Archive] Archived ${archived} from ${col}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(50));
  console.log('[Email Automation] Starting');
  const start = Date.now();
  initFirebase();

  if (!BREVO_API_KEY) console.log('[Email Automation] BREVO_API_KEY not set — queue only, no sending');

  await syncEnrollments();
  const results = await processQueue();
  await archiveJobs(30);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('='.repeat(50));
  console.log(`[Email Automation] Complete in ${elapsed}s`);
  console.log(`  Sent: ${results.sent}, Failed: ${results.failed}`);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });
