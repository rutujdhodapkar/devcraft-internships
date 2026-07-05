import { rtdbPush, rtdbGet, rtdbSet } from './db.js';
import { now } from './utils.js';

const EVENTS = {
  USER_REGISTERED: 'USER_REGISTERED',
  APPLICATION_CREATED: 'APPLICATION_CREATED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_SUBMITTED: 'TASK_SUBMITTED',
  TASK_VERIFIED: 'TASK_VERIFIED',
  CERTIFICATE_READY: 'CERTIFICATE_READY',
  CERTIFICATE_DOWNLOADED: 'CERTIFICATE_DOWNLOADED',
  INTERNSHIP_COMPLETED: 'INTERNSHIP_COMPLETED',
  INTERNSHIP_EXPIRED: 'INTERNSHIP_EXPIRED',
  DEADLINE_APPROACHING: 'DEADLINE_APPROACHING',
  DEADLINE_PASSED: 'DEADLINE_PASSED',
  PROMO_SENT: 'PROMO_SENT',
  EMAIL_SENT: 'EMAIL_SENT',
  EMAIL_FAILED: 'EMAIL_FAILED',
  EMAIL_APPROVED: 'EMAIL_APPROVED',
  EMAIL_REJECTED: 'EMAIL_REJECTED',
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  ADMIN_ACTION: 'ADMIN_ACTION',
  REFERRAL_CREATED: 'REFERRAL_CREATED',
  REFERRAL_COMPLETED: 'REFERRAL_COMPLETED',
  BADGE_EARNED: 'BADGE_EARNED',
  LEVEL_UP: 'LEVEL_UP',
  CAMPAIGN_STARTED: 'CAMPAIGN_STARTED',
  CAMPAIGN_COMPLETED: 'CAMPAIGN_COMPLETED',
  RULE_TRIGGERED: 'RULE_TRIGGERED',
  WEBHOOK_SENT: 'WEBHOOK_SENT',
  DOCUMENT_GENERATED: 'DOCUMENT_GENERATED',
  SYSTEM_UPDATE: 'SYSTEM_UPDATE',
};

const subscribers = {};

export function on(event, handler) {
  if (!subscribers[event]) subscribers[event] = [];
  subscribers[event].push(handler);
  return () => {
    subscribers[event] = subscribers[event].filter(h => h !== handler);
  };
}

export async function emit(event, data = {}) {
  const eventId = `${event}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const payload = { event, data, eventId, timestamp: now() };

  console.log(`[EventBus] ${event} — ${data.email || data.userId || data.applicationId || eventId}`);

  await rtdbPush(`event_log/${event.toLowerCase()}`, payload);

  const handlers = subscribers[event] || [];
  for (const handler of handlers) {
    try {
      await handler(payload);
    } catch (err) {
      console.error(`[EventBus] Handler error for ${event}:`, err.message);
    }
  }

  const wildcardHandlers = subscribers['*'] || [];
  for (const handler of wildcardHandlers) {
    try {
      await handler(payload);
    } catch (err) {
      console.error(`[EventBus] Wildcard handler error:`, err.message);
    }
  }

  return payload;
}

export async function getEventLog(event, limit = 100) {
  const log = await rtdbGet(`event_log/${event.toLowerCase()}`) || {};
  return Object.values(log).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
}

export async function getRecentEvents(limit = 50) {
  const all = await rtdbGet('event_log') || {};
  const flat = [];
  for (const [type, events] of Object.entries(all)) {
    if (events && typeof events === 'object') {
      for (const entry of Object.values(events)) {
        if (entry.event) flat.push(entry);
      }
    }
  }
  return flat.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
}

export { EVENTS };
