import { rtdbPush, rtdbSet, rtdbGet } from './db.js';
import { now, generateId } from './utils.js';

export async function logSend(entry) {
  const logId = `${entry.notificationId}_${Date.now()}`;
  const log = {
    ...entry,
    logId,
    timestamp: now(),
  };
  await rtdbSet(`email_logs/${logId}`, log);
  return log;
}

export async function logError(entry) {
  const logId = `err_${generateId()}`;
  await rtdbSet(`email_logs/${logId}`, {
    ...entry,
    logId,
    timestamp: now(),
    level: 'error',
  });
}

export async function getAnalytics() {
  const logs = await rtdbGet('email_logs');
  if (!logs) return { totalSent: 0, totalFailed: 0, byCategory: {} };
  const analytics = { totalSent: 0, totalFailed: 0, byCategory: {} };
  for (const log of Object.values(logs)) {
    if (log.status === 'sent') analytics.totalSent++;
    if (log.status === 'failed') analytics.totalFailed++;
    const cat = log.category || 'unknown';
    if (!analytics.byCategory[cat]) analytics.byCategory[cat] = { sent: 0, failed: 0 };
    if (log.status === 'sent') analytics.byCategory[cat].sent++;
    if (log.status === 'failed') analytics.byCategory[cat].failed++;
  }
  return analytics;
}

export async function recordAnalytics(type, count) {
  const today = new Date().toISOString().split('T')[0];
  const path = `analytics/daily/${today}`;
  const existing = await rtdbGet(path) || {};
  existing[type] = (existing[type] || 0) + count;
  await rtdbSet(path, existing);
}
