import { rtdbGet, rtdbSet, rtdbUpdate, getRTDB } from './db.js';
import { STATUS, CONFIG, SEND_ONCE_CATEGORIES } from './config.js';
import { enqueue, cancelPending } from './queueManager.js';
import { now, addDays, daysSince, isBefore } from './utils.js';

export async function runScheduler() {
  console.log('[Scheduler] Starting lifecycle processing');
  const db = getRTDB();
  const appsSnap = await db.ref('email_queue_applications').once('value');
  const apps = appsSnap.val() || {};
  let processedCount = 0;

  for (const [appId, app] of Object.entries(apps)) {
    try {
      const result = await processApplicationLifecycle(app);
      if (result) processedCount++;
    } catch (err) {
      console.error(`[Scheduler] Error ${appId}:`, err.message);
    }
  }

  await db.ref('scheduler/lastRun').set({ timestamp: now(), applicationsProcessed: processedCount });
  console.log(`[Scheduler] Processed ${processedCount} applications`);
  return processedCount;
}

async function processApplicationLifecycle(app) {
  const appId = app.applicationId || app.id;
  if (!appId || !app.email) return false;

  let changed = false;
  const state = app.currentState || 'applied';
  const deadlinePassed = app.internshipEndDate && isBefore(app.internshipEndDate);
  const tasks = Object.values(app.tasks || {});
  const allVerified = tasks.length > 0 && tasks.every(t => t.verified === true);
  const hasPaid = app.paymentStatus === 'success' || app.paymentStatus === 'completed';
  const hasCertificate = app.certificateReady === true || app.certificateGenerated === true;
  const isCompleted = app.completed === true || app.status === 'completed' || app.status === 'graduated';

  let nextState = state;

  if (state === 'applied' || state === 'pending') {
    const queued = await hasQueuedTemplate(appId, 'welcome', app.email);
    if (!queued && !(await wasSent(appId, 'welcome', app.email))) {
      await schedule(app, 'welcome', 'welcome');
    }
    nextState = 'payment_pending';
    changed = true;

  } else if (state === 'payment_pending') {
    if (deadlinePassed) {
      await cancelPending(appId, app.email);
      if (!(await wasSent(appId, 'internship_expired', app.email))) {
        await schedule(app, 'internship_expired', 'internship_expired');
      }
      const promoDate = addDays(app.internshipEndDate, CONFIG.scheduler.promoDelayAfterExpiryDays);
      if (!(await hasQueuedTemplate(appId, 'promo', app.email))) {
        await schedule(app, 'promo', 'promo', { scheduledAt: promoDate, priority: 'low' });
      }
      nextState = 'promo';
      changed = true;

    } else if (allVerified && !hasPaid) {
      const lastSent = await getLastSentDate(appId, 'payment_pending', app.email);
      if (!lastSent || daysSince(lastSent) >= CONFIG.scheduler.paymentReminderIntervalDays) {
        await schedule(app, 'payment_pending', 'payment_pending', {
          payload: { amount: app.paymentAmount || '200', paymentDueDate: app.paymentDueDate || '' },
        });
      }
      changed = true;

    } else if (hasPaid) {
      await cancelPending(appId, app.email);
      if (!(await wasSent(appId, 'payment_success', app.email))) {
        await schedule(app, 'payment_success', 'payment_success');
      }
      nextState = 'task_assigned';
      changed = true;
    }

  } else if (['task_assigned', 'task_completed', 'task_verified'].includes(state)) {
    if (deadlinePassed) {
      await cancelPending(appId, app.email);
      if (!(await wasSent(appId, 'internship_expired', app.email))) {
        await schedule(app, 'internship_expired', 'internship_expired');
      }
      if (!(await hasQueuedTemplate(appId, 'promo', app.email))) {
        await schedule(app, 'promo', 'promo', {
          scheduledAt: addDays(app.internshipEndDate, CONFIG.scheduler.promoDelayAfterExpiryDays),
          priority: 'low',
        });
      }
      nextState = 'promo';
      changed = true;
    } else if (app.lastEvent === 'task_completed' && !(await wasSent(appId, 'task_completed', app.email))) {
      await schedule(app, 'task_completed', 'task_completed');
      changed = true;
    } else if (app.lastEvent === 'task_verified' && !(await wasSent(appId, 'task_verified', app.email))) {
      await schedule(app, 'task_verified', 'task_verified');
      changed = true;
    }

  } else if (state === 'promo') {
    const lastSent = await getLastSentDate(appId, 'promo', app.email);
    if (!lastSent || daysSince(lastSent) >= CONFIG.scheduler.promoIntervalDays) {
      await schedule(app, 'promo', 'promo', { priority: 'low' });
      changed = true;
    }
    if (app.lastEvent === 'announcement') {
      await schedule(app, 'announcement', 'announcement', {
        payload: { title: app.announcementTitle || '', message: app.announcementMessage || '' },
      });
      changed = true;
    }

  } else if (state === 'certificate_pending' || state === 'certificate_ready') {
    if (!(await wasSent(appId, 'certificate_ready', app.email))) {
      await schedule(app, 'certificate_ready', 'certificate_ready');
    }
    nextState = 'internship_completed';
    changed = true;

  } else if (state === 'internship_completed') {
    if (!(await wasSent(appId, 'internship_completed', app.email))) {
      await schedule(app, 'internship_completed', 'internship_completed');
    }
    nextState = 'completed';
    changed = true;

  } else if (state === 'completed') {
    const daysSinceComplete = daysSince(app.completedAt || app.updatedAt || app.createdAt);
    if (daysSinceComplete >= 30) {
      const lastSent = await getLastSentDate(appId, 'promo', app.email);
      if (!lastSent || daysSince(lastSent) >= CONFIG.scheduler.promoIntervalDays) {
        await schedule(app, 'promo', 'promo', { priority: 'low' });
        changed = true;
      }
    }
  }

  if (changed) {
    const db = getRTDB();
    await db.ref(`email_queue_applications/${key(appId)}`).update({
      currentState: nextState,
      lastProcessedAt: now(),
    });
  }

  return changed;
}

async function schedule(app, template, category, opts = {}) {
  return enqueue({
    applicationId: app.applicationId || app.id,
    internshipId: app.internshipId || '',
    userId: app.userId || '',
    email: app.email,
    fullName: app.fullName || app.name || 'Student',
    internshipDomain: app.internshipDomain || app.domain || '',
    internshipTitle: app.internshipTitle || app.title || '',
    eventType: template,
    template,
    priority: opts.priority || (SEND_ONCE_CATEGORIES.includes(template) ? 'high' : 'normal'),
    category: opts.category || category,
    currentState: app.currentState || 'applied',
    status: opts.scheduledAt ? STATUS.SCHEDULED : STATUS.PENDING,
    payload: opts.payload || {},
    scheduledAt: opts.scheduledAt || now(),
  });
}

async function wasSent(applicationId, template, email) {
  for (const col of ['completed_jobs', 'failed_jobs']) {
    const data = await rtdbGet(col) || {};
    if (Object.values(data).some(j => j.applicationId === applicationId && j.template === template && j.email === email)) {
      return true;
    }
  }
  return false;
}

async function hasQueuedTemplate(applicationId, template, email) {
  const queue = await rtdbGet('email_queue') || {};
  return Object.values(queue).some(
    j => j.applicationId === applicationId && j.template === template && j.email === email && j.status !== STATUS.CANCELLED
  );
}

async function getLastSentDate(applicationId, template, email) {
  let latest = null;
  for (const col of ['completed_jobs', 'failed_jobs']) {
    const data = await rtdbGet(col) || {};
    for (const job of Object.values(data)) {
      if (job.applicationId === applicationId && job.template === template && job.email === email && job.processedAt) {
        if (!latest || job.processedAt > latest) latest = job.processedAt;
      }
    }
  }
  return latest;
}

function key(s) {
  return (s || '').replace(/[.#$\[\]\/]/g, '_');
}
