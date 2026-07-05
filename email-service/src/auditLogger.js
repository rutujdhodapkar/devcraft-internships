import { rtdbPush, rtdbGet } from './db.js';
import { now } from './utils.js';
import { emit, EVENTS } from './eventBus.js';

export async function logAudit(action, details = {}) {
  const entry = {
    action,
    ...details,
    timestamp: now(),
    auditId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
  };

  await rtdbPush('audit_logs', entry);
  console.log(`[Audit] ${action}${details.email ? ' — ' + details.email : ''}`);
  return entry;
}

export async function logAdminAction(adminEmail, action, details = {}) {
  await logAudit(`admin:${action}`, { actor: adminEmail, actorType: 'admin', ...details });

  await rtdbPush(`admin_timeline/${sanitize(adminEmail)}`, {
    action,
    timestamp: now(),
    details,
  });

  await emit(EVENTS.ADMIN_ACTION, { adminEmail, action, ...details });
}

export async function logUserActivity(userEmail, eventType, details = {}) {
  const key = sanitize(userEmail);
  const entry = { eventType, timestamp: now(), ...details };

  await rtdbPush(`activity_timeline/${key}`, entry);

  const appKey = details.applicationId ? sanitize(details.applicationId) : key;
  await rtdbPush(`application_timeline/${appKey}`, {
    event: eventType,
    timestamp: now(),
    data: details,
  });

  return entry;
}

export async function getAuditLogs(limit = 200) {
  const logs = await rtdbGet('audit_logs') || {};
  return Object.values(logs)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

export async function getAdminTimeline(adminEmail, limit = 100) {
  const timeline = await rtdbGet(`admin_timeline/${sanitize(adminEmail)}`) || {};
  return Object.values(timeline)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

export async function getUserTimeline(email, limit = 100) {
  const timeline = await rtdbGet(`activity_timeline/${sanitize(email)}`) || {};
  return Object.values(timeline)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

export async function getApplicationTimeline(applicationId, limit = 100) {
  const timeline = await rtdbGet(`application_timeline/${sanitize(applicationId)}`) || {};
  return Object.values(timeline)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

function sanitize(s) {
  return (s || '').replace(/[.#$\[\]\/]/g, '_');
}
