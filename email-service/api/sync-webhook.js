// Vercel serverless webhook: receives app updates from Project 1, writes to RTDB
// Project 1 calls: POST /api/sync-webhook with application data
// No auth needed if RTDB is open. Add secret check for production.

const RTDB_URL = process.env.RTDB_URL || 'https://laptop-privacy-default-rtdb.firebaseio.com';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  // Optional auth check
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const body = req.body || {};
  const app = body.application || body;
  const appId = app.id || app.applicationId;

  if (!appId || !app.email) {
    return res.status(400).json({ error: 'Missing application id or email' });
  }

  const key = sanitize(appId);
  const entry = {
    applicationId: appId,
    internshipId: app.internshipId || app.domainId || '',
    userId: app.userId || app.user_id || '',
    email: (app.email || app.userEmail || '').toLowerCase(),
    fullName: app.fullName || app.name || app.userName || 'Student',
    internshipDomain: app.domain || app.internshipDomain || '',
    internshipTitle: app.title || app.internshipTitle || app.domain || '',
    currentState: mapState(app),
    paymentStatus: app.paymentStatus || app.payment || '',
    paymentAmount: app.paymentAmount || app.amount || '200',
    paymentDueDate: app.paymentDueDate || app.paymentDue || '',
    internshipEndDate: app.internshipEndDate || app.deadline || app.endDate || '',
    createdAt: app.createdAt || app.created_at || app.applicationDate || '',
    completedAt: app.completedAt || app.completionDate || '',
    lastEvent: app.lastEvent || detectEvent(app),
    lastUpdated: new Date().toISOString(),
  };

  try {
    const url = `${RTDB_URL}/email_queue_applications/${key}.json`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `RTDB write failed: ${errText}` });
    }

    console.log(`[Webhook] Synced ${appId} → ${entry.currentState} (${entry.email})`);
    res.json({ success: true, appId, state: entry.currentState });
  } catch (err) {
    console.error('[Webhook] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

function sanitize(s) {
  return (s || '').replace(/[.#$\[\]\/]/g, '_');
}

function mapState(app) {
  if (app.completed || app.status === 'completed' || app.status === 'graduated') return 'completed';
  if (app.expired || app.status === 'expired') return 'internship_expired';
  if (app.certificateReady || app.certificateGenerated) return 'certificate_pending';
  if (app.paymentStatus === 'success' || app.paymentStatus === 'completed') return 'payment_success';
  if (app.status === 'applied' || app.status === 'pending' || app.status === 'enrolled') return 'applied';
  if (app.status === 'active') return 'task_assigned';
  return 'applied';
}

function detectEvent(app) {
  if (app.status === 'applied' || app.status === 'enrolled') return 'applied';
  if (app.paymentStatus === 'success') return 'payment_success';
  if (app.paymentStatus === 'failed') return 'payment_failed';
  if (app.certificateReady) return 'certificate_ready';
  if (app.completed || app.status === 'completed') return 'internship_completed';
  if (app.expired || app.status === 'expired') return 'internship_expired';
  return 'update';
}
