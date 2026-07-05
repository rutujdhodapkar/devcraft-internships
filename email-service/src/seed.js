import { getFirestore, getRTDB } from './db.js';

export async function seedFromFirestore() {
  console.log('[Seed] Starting — pulling applications from Firestore');

  const fs = getFirestore();
  const rtdb = getRTDB();

  try {
    const snap = await fs.collection('applications').limit(5000).get();
    let count = 0;

    for (const doc of snap.docs) {
      const app = { id: doc.id, ...doc.data() };
      const email = app.email || app.userEmail || '';
      if (!email) continue;

      const entry = {
        applicationId: app.id,
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
        createdAt: app.createdAt || app.created_at || '',
        completedAt: app.completedAt || app.completionDate || '',
        certificateReady: app.certificateReady === true || app.certificateGenerated === true || false,
        completed: app.completed === true || app.status === 'completed' || app.status === 'graduated' || false,
        expired: app.expired === true || app.status === 'expired' || false,
        tasks: app.projects || app.tasks || {},
        lastEvent: '',
        lastProcessedAt: '',
      };

      const key = sanitize(app.id);
      await rtdb.ref(`email_queue_applications/${key}`).set(entry);
      count++;
    }

    console.log(`[Seed] Seeded ${count} applications into RTDB`);
    return count;
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    throw err;
  }
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

function sanitize(s) {
  return (s || '').replace(/[.#$\[\]\/]/g, '_');
}

// Run directly: node src/seed.js
if (process.argv[1]?.endsWith('seed.js')) {
  import('./db.js').then(() => {
    seedFromFirestore()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}
