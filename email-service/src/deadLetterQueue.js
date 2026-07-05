import { rtdbGet, rtdbSet, rtdbDelete } from './db.js';
import { enqueue } from './queueManager.js';
import { STATUS } from './config.js';
import { now } from './utils.js';

export async function getDeadLetters(limit = 100) {
  const failed = await rtdbGet('failed_jobs') || {};
  return Object.entries(failed)
    .sort(([, a], [, b]) => new Date(b.processedAt || 0) - new Date(a.processedAt || 0))
    .slice(0, limit)
    .map(([id, job]) => ({ id, ...job }));
}

export async function retryDeadLetter(notificationId) {
  const failed = await rtdbGet(`failed_jobs/${notificationId}`);
  if (!failed) return { success: false, error: 'Not found' };

  await enqueue({
    applicationId: failed.applicationId,
    internshipId: failed.internshipId,
    userId: failed.userId,
    email: failed.email,
    fullName: failed.fullName,
    internshipDomain: failed.internshipDomain,
    internshipTitle: failed.internshipTitle,
    eventType: failed.eventType,
    template: failed.template,
    priority: 'high',
    category: failed.category,
    currentState: failed.currentState,
    status: STATUS.PENDING,
    payload: failed.payload || {},
  });

  await rtdbSet(`failed_jobs/${notificationId}/retriedAt`, now());
  await rtdbSet(`failed_jobs/${notificationId}/retryCount`, (failed.retryCount || 0) + 1);

  return { success: true };
}

export async function retryAllDeadLetters() {
  const failed = await rtdbGet('failed_jobs') || {};
  let count = 0;
  for (const [id, job] of Object.entries(failed)) {
    if (!job.retriedAt) {
      await retryDeadLetter(id);
      count++;
    }
  }
  return count;
}

export async function purgeDeadLetter(notificationId) {
  await rtdbDelete(`failed_jobs/${notificationId}`);
}

export async function getDeadLetterStats() {
  const failed = await rtdbGet('failed_jobs') || {};
  const values = Object.values(failed);
  return {
    total: values.length,
    byTemplate: values.reduce((acc, j) => { acc[j.template] = (acc[j.template] || 0) + 1; return acc; }, {}),
    byCategory: values.reduce((acc, j) => { acc[j.category] = (acc[j.category] || 0) + 1; return acc; }, {}),
    oldestFailure: values.length > 0 ? values.sort((a, b) => new Date(a.processedAt || 0) - new Date(b.processedAt || 0))[0]?.processedAt : null,
  };
}
