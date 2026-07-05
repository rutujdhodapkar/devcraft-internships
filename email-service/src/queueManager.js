import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbDelete } from './db.js';
import { STATUS } from './config.js';
import { now, generateId, dedupKey, addDays, daysSince } from './utils.js';

function sanitize(key) {
  return key.replace(/[.#$\[\]\/]/g, '_');
}

export async function enqueue(data) {
  const dk = dedupKey(data.applicationId, data.eventType, data.template, data.email);

  const existing = await rtdbGet('email_queue');
  if (existing) {
    for (const [id, job] of Object.entries(existing)) {
      if (
        job._dedupKey === dk &&
        (job.status === STATUS.PENDING || job.status === STATUS.SCHEDULED || job.status === STATUS.PROCESSING)
      ) {
        console.log(`[Queue] Duplicate skipped: ${dk}`);
        return id;
      }
    }
  }

  const notificationId = `notif_${generateId()}`;
  const job = {
    notificationId,
    applicationId: data.applicationId || '',
    internshipId: data.internshipId || '',
    userId: data.userId || '',
    email: data.email || '',
    fullName: data.fullName || 'Student',
    internshipDomain: data.internshipDomain || '',
    internshipTitle: data.internshipTitle || '',
    eventType: data.eventType || '',
    template: data.template || '',
    priority: data.priority || 'normal',
    category: data.category || '',
    currentState: data.currentState || '',
    status: data.status || STATUS.PENDING,
    payload: data.payload || {},
    retryCount: 0,
    createdAt: now(),
    scheduledAt: data.scheduledAt || now(),
    processedAt: null,
    _dedupKey: dk,
  };

  await rtdbSet(`email_queue/${notificationId}`, job);
  console.log(`[Queue] Enqueued: ${notificationId} — ${data.template} → ${data.email}`);
  return notificationId;
}

export async function cancelPending(applicationId, email) {
  const queue = await rtdbGet('email_queue');
  if (!queue) return 0;
  let cancelled = 0;
  for (const [id, job] of Object.entries(queue)) {
    if (
      job.applicationId === applicationId &&
      job.email === email &&
      (job.status === STATUS.PENDING || job.status === STATUS.SCHEDULED)
    ) {
      await rtdbUpdate(`email_queue/${id}`, {
        status: STATUS.CANCELLED,
        processedAt: now(),
      });
      cancelled++;
    }
  }
  if (cancelled > 0) console.log(`[Queue] Cancelled ${cancelled} pending jobs for ${applicationId}`);
  return cancelled;
}

export async function markProcessing(notificationId) {
  await rtdbUpdate(`email_queue/${notificationId}`, {
    status: STATUS.PROCESSING,
    processedAt: now(),
  });
}

export async function markCompleted(notificationId, result) {
  const job = await rtdbGet(`email_queue/${notificationId}`);
  if (!job) return;
  await rtdbSet(`completed_jobs/${notificationId}`, {
    ...job,
    status: STATUS.COMPLETED,
    processedAt: now(),
    providerResponse: result,
  });
  await rtdbDelete(`email_queue/${notificationId}`);
}

export async function markFailed(notificationId, error) {
  const job = await rtdbGet(`email_queue/${notificationId}`);
  if (!job) return;
  const retryCount = (job.retryCount || 0) + 1;
  const maxRetries = parseInt(process.env.WORKER_MAX_RETRIES || '3', 10);

  if (retryCount >= maxRetries) {
    await rtdbSet(`failed_jobs/${notificationId}`, {
      ...job,
      status: STATUS.FAILED,
      retryCount,
      processedAt: now(),
      error,
    });
    await rtdbDelete(`email_queue/${notificationId}`);
    console.log(`[Queue] Moved to failed_jobs: ${notificationId} (retries exhausted)`);
  } else {
    await rtdbUpdate(`email_queue/${notificationId}`, {
      status: STATUS.PENDING,
      retryCount,
      error,
      processedAt: null,
    });
    console.log(`[Queue] Retry scheduled: ${notificationId} (attempt ${retryCount}/${maxRetries})`);
  }
}

export async function getPendingJobs(batchSize = 50) {
  const queue = await rtdbGet('email_queue');
  if (!queue) return [];
  const pending = [];
  for (const [id, job] of Object.entries(queue)) {
    if (job.status === STATUS.PENDING || job.status === STATUS.SCHEDULED) {
      if (job.status === STATUS.SCHEDULED && job.scheduledAt && new Date(job.scheduledAt) > new Date()) {
        continue;
      }
      pending.push({ id, ...job });
      if (pending.length >= batchSize) break;
    }
  }
  return pending.sort((a, b) => {
    const priority = { high: 0, normal: 1, low: 2 };
    return (priority[a.priority] || 1) - (priority[b.priority] || 1);
  });
}

export async function getJobsByApplication(applicationId) {
  const queue = await rtdbGet('email_queue');
  if (!queue) return [];
  return Object.entries(queue)
    .filter(([, j]) => j.applicationId === applicationId)
    .map(([id, j]) => ({ id, ...j }));
}

export async function countQueued() {
  const queue = await rtdbGet('email_queue');
  if (!queue) return 0;
  return Object.values(queue).filter(j => j.status === STATUS.PENDING || j.status === STATUS.SCHEDULED).length;
}

export async function archiveOldJobs(daysOld = 30) {
  const collections = ['completed_jobs', 'failed_jobs'];
  for (const col of collections) {
    const data = await rtdbGet(col);
    if (!data) continue;
    for (const [id, job] of Object.entries(data)) {
      if (job.processedAt && daysSince(job.processedAt) >= daysOld) {
        await rtdbDelete(`${col}/${id}`);
        console.log(`[Queue] Archived: ${col}/${id}`);
      }
    }
  }
}
