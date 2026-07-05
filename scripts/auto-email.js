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
  globalThis.__db = getFirestore(app);
  globalThis.__rtdb = getDatabase(app);
}

function db() { return globalThis.__db; }
function rtdb() { return globalThis.__rtdb; }

function now() { return new Date().toISOString(); }
function daysSince(d) { return d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sanitize(s) { return (s || '').replace(/[.#$\[\]\/]/g, '_'); }

async function rtdbGet(path) { const snap = await rtdb().ref(path).once('value'); return snap.val(); }
async function rtdbSet(path, data) { await rtdb().ref(path).set(data); }
async function rtdbUpdate(path, data) { await rtdb().ref(path).update(data); }
async function rtdbDelete(path) { await rtdb().ref(path).remove(); }
async function rtdbPush(path, data) { const r = rtdb().ref(path).push(); await r.set(data); return r.key; }

// ─── NVIDIA email content generation ──────────────────────────────────────

async function generateEmailContent(template, vars) {
  const prompt = `You are an email writer for DEV/CRAFT internship platform. Generate a professional email.
Template: ${template}
Recipient: ${vars.fullName || 'Student'}
Context: ${JSON.stringify(vars)}
Rules:
- Return ONLY a JSON object: { "subject": "...", "html": "..." }
- HTML must use inline styles, no external CSS
- Keep subject under 60 chars
- Keep HTML concise, professional, black/white theme
- Include a clear call-to-action button
- Sign off as "DEV/CRAFT Team"`;

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

// ─── Brevo email sending ──────────────────────────────────────────────────

async function sendBrevo({ to, subject, html, templateName, category }) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject, htmlContent: html, textContent: plain,
      tag: templateName || category || 'general',
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
  return { success: true, messageId: data.messageId };
}

// ─── Queue management (RTDB) ──────────────────────────────────────────────

async function enqueue(job) {
  const id = `notif_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
  await rtdbSet(`email_queue/${id}`, { ...job, notificationId: id, createdAt: now(), retryCount: 0, status: 'pending' });
  return id;
}

async function getPendingJobs(limit) {
  const queue = await rtdbGet('email_queue') || {};
  return Object.entries(queue)
    .filter(([, j]) => j.status === 'pending' || (j.status === 'scheduled' && new Date(j.scheduledAt) <= new Date()))
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
    console.log(`  → Moved to failed_jobs (retries exhausted)`);
  } else {
    await rtdbUpdate(`email_queue/${id}`, { status: 'pending', retryCount: retries, error: errMsg });
    console.log(`  → Will retry (${retries}/3)`);
  }
}

async function processQueue() {
  const jobs = await getPendingJobs(30);
  if (jobs.length === 0) { console.log('[Queue] No pending jobs'); return { sent: 0, failed: 0 }; }
  console.log(`[Queue] Processing ${jobs.length} jobs...`);
  let sent = 0, failed = 0;
  for (const job of jobs) {
    try {
      await rtdbUpdate(`email_queue/${job.id}`, { status: 'processing' });

      const subKey = sanitize(job.email);
      const sub = await rtdbGet(`email_subscriptions/${subKey}`);
      if (sub?.status === 'unsubscribed') {
        await markCompleted(job.id, { skipped: true, reason: 'unsubscribed' });
        console.log(`  ✉ ${job.email} — ${job.template} (unsubscribed, skipped)`);
        continue;
      }

      let subject = job.subject, html = job.html;
      if (!html) {
        try {
          if (process.env.NVIDIA_API_KEY) {
            const gen = await generateEmailContent(job.template, { ...job, ...job.payload });
            subject = gen.subject; html = gen.html;
          } else {
            const rendered = renderBuiltinTemplate(job.template, { ...job, ...job.payload });
            if (rendered) { subject = rendered.subject; html = rendered.html; }
          }
        } catch (e) {
          const rendered = renderBuiltinTemplate(job.template, { ...job, ...job.payload });
          if (rendered) { subject = rendered.subject; html = rendered.html; }
        }
      }
      if (!html) {
        await markFailed(job.id, 'No template/content');
        continue;
      }

      const result = await sendBrevo({ to: job.email, subject, html, templateName: job.template, category: job.category });
      await markCompleted(job.id, result);
      console.log(`  ✓ ${job.email} — ${subject}`);
      sent++;
    } catch (err) {
      console.error(`  ✗ ${job.email}: ${err.message}`);
      await markFailed(job.id, err.message);
      failed++;
    }
  }
  return { sent, failed };
}

// ─── Built-in templates (fallback) ────────────────────────────────────────

function wrapHTML(body, heading, sub) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;line-height:1.6}
.wrapper{max-width:600px;margin:0 auto;padding:20px}
.header{text-align:center;padding:32px 20px;border-bottom:2px solid #000}
.header h1{font-size:20px;font-weight:800;text-transform:uppercase}
.body{padding:28px 24px;border-bottom:2px solid #000}
.body h2{font-size:17px;font-weight:700;margin-bottom:12px}
.body p{font-size:14px;color:#444;margin-bottom:14px}
.btn{display:inline-block;padding:10px 24px;background:#000;color:#fff!important;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;margin:6px 0}
.footer{text-align:center;padding:20px;font-size:12px;color:#999}
</style></head><body><div class="wrapper">
<div class="header"><h1>${heading}</h1><p style="color:#666;font-size:13px;margin-top:4px">${sub || ''}</p></div>
<div class="body">${body}</div>
<div class="footer"><p>DEV/CRAFT Internship Platform</p>
<p style="margin-top:6px"><a href="${'https://devcraft.rutujdhodapkar.tech'}/api/email/unsubscribe?email=${'[EMAIL]'}">Unsubscribe</a></p>
</div></div></body></html>`;
}

function renderBuiltinTemplate(template, v) {
  const tpls = {
    welcome: { subject: 'Welcome to DEV/CRAFT', build: () => wrapHTML(`<h2>Welcome, ${v.fullName || 'Student'}</h2><p>Your application for <strong>${v.internshipTitle || 'Internship'}</strong> has been received.</p>`, 'Welcome to DEV/CRAFT', 'Your application has been received') },
    task_assigned: { subject: 'New Task Assigned', build: () => wrapHTML(`<h2>Task Assigned</h2><p><strong>${v.taskName || 'New task'}</strong></p><p>Deadline: ${v.taskDeadline || '—'}</p>`, 'New Task', `${v.internshipTitle || ''}`) },
    task_completed: { subject: 'Task Submitted for Review', build: () => wrapHTML(`<h2>Task Submitted</h2><p>Your task is pending review.</p>`, 'Task Submitted', '') },
    task_verified: { subject: 'Task Verified', build: () => wrapHTML(`<h2>Task Verified</h2><p>Task verified. ${v.completedTasks || 0}/${v.totalTasks || 0} completed.</p>`, 'Task Verified', '') },
    payment_pending: { subject: 'Payment Reminder', build: () => wrapHTML(`<h2>Payment Pending</h2><p>Amount: Rs ${v.amount || '200'}</p>`, 'Payment Reminder', '') },
    payment_success: { subject: 'Payment Received', build: () => wrapHTML(`<h2>Payment Received</h2><p>Rs ${v.amount || '200'} received.</p>`, 'Payment Received', '') },
    certificate_ready: { subject: 'Certificate Ready', build: () => wrapHTML(`<h2>Congratulations, ${v.fullName || 'Graduate'}</h2><p>Your certificate is ready for download.</p>`, 'Certificate Ready', v.internshipTitle || '') },
    internship_completed: { subject: 'Internship Completed', build: () => wrapHTML(`<h2>Well Done</h2><p>You completed <strong>${v.internshipTitle || 'your internship'}</strong>.</p>`, 'Program Completed', '') },
    internship_expired: { subject: 'Internship Period Ended', build: () => wrapHTML(`<h2>Period Ended</h2><p>Your internship period has ended.</p>`, 'Period Ended', '') },
    promo: { subject: 'New Opportunities at DEV/CRAFT', build: () => wrapHTML(`<h2>Hello ${v.fullName || 'Student'}</h2><p>New domains and opportunities available.</p>`, 'New Opportunities', '') },
    reminder: { subject: 'Reminder from DEV/CRAFT', build: () => wrapHTML(`<h2>Reminder</h2><p>${v.message || 'Action may be needed.'}</p>`, 'Reminder', '') },
    announcement: { subject: v.title || 'Announcement', build: () => wrapHTML(`<h2>${v.title || 'Announcement'}</h2><p>${v.message || ''}</p>`, v.title || 'Announcement', '') },
    verification_result: { subject: v.verified ? 'Submission Verified' : 'Submission Update', build: () => wrapHTML(`<h2>${v.verified ? 'Verified!' : 'Submission Update'}</h2><p>${v.message || ''}</p>`, 'Submission Update', '') },
  };
  const tpl = tpls[template];
  if (!tpl) return null;
  const html = tpl.build().replace('[EMAIL]', encodeURIComponent(v.email || ''));
  return { subject: tpl.subject, html };
}

// ─── Lifecycle transitions ─────────────────────────────────────────────────

async function processLifecycle() {
  console.log('[Lifecycle] Processing...');
  const appsSnap = await rtdb().ref('email_queue_applications').once('value');
  const apps = appsSnap.val() || {};
  let changed = 0;

  for (const [appId, app] of Object.entries(apps)) {
    try {
      const changed = await processApplication(app);
      if (changed) changed++;
    } catch (err) {
      console.error(`  Error ${appId}: ${err.message}`);
    }
  }

  await rtdb().ref('scheduler/lastRun').set({ timestamp: now(), applicationsProcessed: changed });
  console.log(`[Lifecycle] Processed ${changed} applications`);
}

async function processApplication(app) {
  if (!app.email) return false;
  let ch = false;
  const state = app.currentState || 'applied';
  const deadlinePassed = app.internshipEndDate && new Date(app.internshipEndDate) < new Date();
  const allVerified = app.allVerified === true;
  const hasPaid = app.paymentStatus === 'success' || app.paymentStatus === 'completed';

  if (state === 'applied') {
    const sent = await wasSent(app, 'welcome');
    if (!sent) { await queueEmail(app, 'welcome', { fullName: app.fullName, internshipTitle: app.internshipTitle }); }
    await setState(app, 'payment_pending'); ch = true;

  } else if (state === 'payment_pending') {
    if (deadlinePassed) {
      if (!await wasSent(app, 'internship_expired')) await queueEmail(app, 'internship_expired');
      await setState(app, 'promo'); ch = true;
    } else if (hasPaid) {
      if (!await wasSent(app, 'payment_success')) await queueEmail(app, 'payment_success');
      await setState(app, 'task_assigned'); ch = true;
    }

  } else if (state === 'task_assigned' || state === 'task_completed') {
    if (deadlinePassed) {
      if (!await wasSent(app, 'internship_expired')) await queueEmail(app, 'internship_expired');
      await setState(app, 'promo'); ch = true;
    }

  } else if (state === 'certificate_ready' || state === 'internship_completed') {
    if (!await wasSent(app, 'certificate_ready')) await queueEmail(app, 'certificate_ready', { fullName: app.fullName, internshipTitle: app.internshipTitle });
    await setState(app, 'completed'); ch = true;

  } else if (state === 'promo') {
    const last = await getLastSent(app, 'promo');
    if (!last || daysSince(last) >= 3) await queueEmail(app, 'promo', { fullName: app.fullName }, 'low');
  }

  if (allVerified && hasPaid && !await wasSent(app, 'certificate_ready')) {
    await queueEmail(app, 'certificate_ready', { fullName: app.fullName, internshipTitle: app.internshipTitle });
  }

  return ch;
}

async function setState(app, state) {
  await rtdbUpdate(`email_queue_applications/${sanitize(app.applicationId || app.id)}`, {
    currentState: state, lastProcessedAt: now(),
  });
}

async function queueEmail(app, template, extra, priority) {
  const id = await enqueue({
    applicationId: app.applicationId || app.id,
    email: app.email, fullName: app.fullName || 'Student',
    internshipTitle: app.internshipTitle, internshipDomain: app.internshipDomain,
    template, category: template, priority: priority || 'normal',
    payload: extra || {},
  });
  console.log(`  → Queued ${template} for ${app.email} (${id})`);
  return id;
}

async function wasSent(app, template) {
  for (const col of ['completed_jobs', 'failed_jobs']) {
    const data = await rtdbGet(col) || {};
    if (Object.values(data).some(j => j.applicationId === (app.applicationId || app.id) && j.template === template)) return true;
  }
  return false;
}

async function getLastSent(app, template) {
  let latest = null;
  for (const col of ['completed_jobs', 'failed_jobs']) {
    const data = await rtdbGet(col) || {};
    for (const job of Object.values(data)) {
      if (job.applicationId === (app.applicationId || app.id) && job.template === template && job.processedAt) {
        if (!latest || job.processedAt > latest) latest = job.processedAt;
      }
    }
  }
  return latest;
}

// ─── Sync Firestore enrollments → RTDB applications ───────────────────────

async function syncEnrollments() {
  console.log('[Sync] Syncing Firestore enrollments → RTDB...');
  const snap = await db().collection('enrollments').get();
  let synced = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.email) continue;
    const appId = sanitize(doc.id);
    const existing = await rtdbGet(`email_queue_applications/${appId}`);

    const tasks = d.projects || [];
    const subs = d.submissions || {};
    const allVerified = tasks.length > 0 && tasks.every((_, i) => subs[i]?.verified === true);
    const allSubmitted = tasks.length > 0 && tasks.every((_, i) => subs[i]?.submittedAt);

    const app = {
      applicationId: doc.id,
      email: d.email,
      fullName: d.name || d.displayName || '',
      internshipDomain: d.domain || '',
      internshipTitle: d.domain || '',
      paymentStatus: d.paymentStatus || d.paymentStage || 'none',
      internshipEndDate: d.deadline || '',
      allVerified,
      allSubmitted,
      status: d.status || 'active',
      lastEvent: existing?.lastEvent || '',
      currentState: existing?.currentState || determineInitialState(d),
      lastSyncedAt: now(),
    };

    await rtdbSet(`email_queue_applications/${appId}`, app);
    synced++;
  }

  console.log(`[Sync] Synced ${synced} enrollments`);
}

function determineInitialState(enr) {
  if (enr.status === 'Expired' || enr.expiredAt) return 'promo';
  if (enr.allowedCertificate === 'yes' && enr.status === 'Completed') return 'internship_completed';
  if (enr.paymentStatus === 'paid' || enr.paymentStage === 'fully_paid') {
    if (enr.submissions && Object.keys(enr.submissions).length > 0 && Object.values(enr.submissions).every(s => s?.verified)) return 'completed';
    return 'task_assigned';
  }
  if (enr.paymentStatus === 'none' || enr.paymentStatus === 'pending' || enr.paymentStatus === 'failed') {
    return enr.createdAt && daysSince(enr.createdAt) > 1 ? 'payment_pending' : 'applied';
  }
  return 'applied';
}

// ─── Archive old jobs ─────────────────────────────────────────────────────

async function archiveJobs(daysOld) {
  const cutoff = daysOld || 30;
  for (const col of ['completed_jobs', 'failed_jobs']) {
    const data = await rtdbGet(col) || {};
    let archived = 0;
    for (const [id, job] of Object.entries(data)) {
      if (job.processedAt && daysSince(job.processedAt) >= cutoff) {
        await rtdbDelete(`${col}/${id}`);
        archived++;
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

  if (!BREVO_API_KEY) {
    console.log('[Email Automation] BREVO_API_KEY not set — dry run only');
  }

  // 1. Sync enrollments from Firestore to RTDB
  await syncEnrollments();

  // 2. Process lifecycle transitions
  await processLifecycle();

  // 3. Process email queue (send via Brevo)
  const results = await processQueue();

  // 4. Archive old jobs
  await archiveJobs(30);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('='.repeat(50));
  console.log(`[Email Automation] Complete in ${elapsed}s`);
  console.log(`  Sent:   ${results.sent}`);
  console.log(`  Failed: ${results.failed}`);
  console.log('='.repeat(50));
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });
