import { rtdbGet, rtdbSet } from './db.js';
import { emit, EVENTS } from './eventBus.js';
import { now } from './utils.js';

export async function registerWebhook(event, url, secret = '') {
  const webhooks = await rtdbGet('webhooks') || {};
  const id = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  webhooks[id] = { id, event, url, secret, active: true, createdAt: now(), lastTriggered: null, failureCount: 0 };
  await rtdbSet('webhooks', webhooks);
  return id;
}

export async function dispatchWebhooks(event, payload) {
  const webhooks = await rtdbGet('webhooks') || {};
  const matching = Object.values(webhooks).filter(w => w.active && (w.event === '*' || w.event === event));

  for (const wh of matching) {
    try {
      const body = { event, timestamp: now(), data: payload };
      const headers = { 'Content-Type': 'application/json' };
      if (wh.secret) headers['X-Webhook-Secret'] = wh.secret;

      const response = await fetch(wh.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        wh.lastTriggered = now();
        wh.failureCount = 0;
      } else {
        wh.failureCount = (wh.failureCount || 0) + 1;
        wh.lastError = `HTTP ${response.status}`;
      }

      await rtdbSet(`webhooks/${wh.id}`, wh);
      await emit(EVENTS.WEBHOOK_SENT, { webhookId: wh.id, event, url: wh.url, status: response.ok ? 'success' : 'failed' });
    } catch (err) {
      wh.failureCount = (wh.failureCount || 0) + 1;
      wh.lastError = err.message;
      await rtdbSet(`webhooks/${wh.id}`, wh);
    }
  }
}
