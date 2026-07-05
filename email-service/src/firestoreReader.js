import { getFirestore } from './db.js';
import { CONFIG } from './config.js';

let lastPollTime = null;

export async function getManualUpdates() {
  const db = getFirestore();
  const events = [];

  try {
    const appsRef = db.collection('applications').orderBy('updatedAt', 'desc').limit(200);
    const snap = await appsRef.get();

    for (const doc of snap.docs) {
      const app = { id: doc.id, ...doc.data() };

      if (lastPollTime && app.updatedAt && new Date(app.updatedAt) <= new Date(lastPollTime)) continue;

      const userId = app.userId || app.user_id || '';
      const email = app.email || app.userEmail || '';
      const fullName = app.fullName || app.name || app.userName || 'Student';

      const internshipId = app.internshipId || app.domainId || '';
      const internshipTitle = app.internshipTitle || app.title || app.domain || app.internshipDomain || '';
      const internshipDomain = app.domain || app.internshipDomain || internshipTitle;

      let eventType = null;
      const category = getCategoryForApp(app);

      if (app.status === 'applied' || app.status === 'pending' || app.status === 'enrolled') eventType = 'applied';
      else if (app.paymentStatus === 'success' || app.paymentStatus === 'completed') eventType = 'payment_success';
      else if (app.paymentStatus === 'failed') eventType = 'payment_failed';
      else if (app.tasksVerified === true || (app.verifiedTasks && app.verifiedTasks > 0)) eventType = 'task_verified';
      else if (app.certificateReady === true || app.certificateGenerated === true) eventType = 'certificate_ready';
      else if (app.completed === true || app.status === 'completed' || app.status === 'graduated') eventType = 'internship_completed';
      else if (app.expired === true || app.status === 'expired') eventType = 'internship_expired';

      if (eventType) {
        events.push({
          applicationId: app.id,
          internshipId,
          userId,
          email,
          fullName,
          internshipDomain,
          internshipTitle,
          eventType,
          category,
          currentState: app.status || 'pending',
          payload: {
            amount: app.paymentAmount || app.amount || '200',
            paymentDueDate: app.paymentDueDate || app.paymentDue || '',
            taskName: app.lastTaskName || '',
            taskDeadline: app.taskDeadline || '',
            completedTasks: app.completedTasks || app.verifiedTasks || 0,
            totalTasks: app.totalTasks || app.projects?.length || 0,
            completionDate: app.completedAt || app.completionDate || '',
            message: app.message || app.adminMessage || '',
          },
        });
      }
    }

    lastPollTime = new Date().toISOString();
  } catch (err) {
    console.error('[FirestoreReader] Error:', err.message);
  }

  return events;
}

export function resetLastPollTime() {
  lastPollTime = null;
}

function getCategoryForApp(app) {
  if (app.paymentStatus === 'success' || app.paymentStatus === 'completed') return 'payment_success';
  if (app.paymentStatus === 'failed' || app.paymentStatus === 'pending') return 'payment_pending';
  if (app.status === 'applied' || app.status === 'enrolled') return 'welcome';
  if (app.certificateReady || app.certificateGenerated) return 'certificate_ready';
  if (app.status === 'completed' || app.status === 'graduated') return 'internship_completed';
  if (app.expired || app.status === 'expired') return 'internship_expired';
  if (app.status === 'active') return 'task_assigned';
  return 'custom';
}
