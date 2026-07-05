const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const RTDB_URL = functions.config().rtdb?.url || 'https://laptop-privacy-default-rtdb.firebaseio.com';
const rtdb = admin.database(RTDB_URL);

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

function detectEvent(app, before) {
  if (app.status === 'applied' || app.status === 'enrolled') return 'applied';
  if (app.paymentStatus === 'success' && before?.paymentStatus !== 'success') return 'payment_success';
  if (app.paymentStatus === 'failed' && before?.paymentStatus !== 'failed') return 'payment_failed';
  if (app.certificateReady && !before?.certificateReady) return 'certificate_ready';
  if ((app.completed || app.status === 'completed') && !before?.completed && before?.status !== 'completed') return 'internship_completed';
  if ((app.expired || app.status === 'expired') && !before?.expired) return 'internship_expired';

  const newTasks = app.projects || app.tasks || {};
  const oldTasks = before?.projects || before?.tasks || {};
  for (const [k, v] of Object.entries(newTasks)) {
    if (v.verified && !oldTasks[k]?.verified) return 'task_verified';
    if (v.submittedAt && !oldTasks[k]?.submittedAt) return 'task_completed';
    if (v.assignedAt && !oldTasks[k]?.assignedAt) return 'task_assigned';
  }
  return null;
}

exports.syncApplication = functions.firestore
  .document('applications/{appId}')
  .onWrite(async (change, context) => {
    const app = change.after?.data() || null;
    const before = change.before?.data() || null;
    const appId = context.params.appId;

    if (!app) {
      // Deleted — remove from RTDB
      const key = sanitize(appId);
      await rtdb.ref(`email_queue_applications/${key}`).remove();
      console.log(`[Sync] Removed ${appId} from RTDB`);
      return;
    }

    const email = app.email || app.userEmail || '';
    if (!email) {
      console.log(`[Sync] Skipped ${appId} — no email`);
      return;
    }

    const eventType = detectEvent(app, before);
    const key = sanitize(appId);

    const entry = {
      applicationId: appId,
      internshipId: app.internshipId || app.domainId || '',
      userId: app.userId || app.user_id || '',
      email: email.toLowerCase(),
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
      certificateReady: app.certificateReady === true || app.certificateGenerated === true || false,
      completed: app.completed === true || app.status === 'completed' || app.status === 'graduated' || false,
      expired: app.expired === true || app.status === 'expired' || false,
      tasks: app.projects || app.tasks || {},
      lastEvent: eventType || '',
      lastUpdated: new Date().toISOString(),
    };

    await rtdb.ref(`email_queue_applications/${key}`).update(entry);
    console.log(`[Sync] Updated ${appId} → ${eventType || 'no event'} (${email})`);
  });
