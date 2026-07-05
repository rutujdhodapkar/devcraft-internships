import { rtdbGet, rtdbSet } from './db.js';

const DAILY_LIMIT = parseInt(process.env.BREVO_DAILY_LIMIT || '300', 10);
const PER_MINUTE_LIMIT = parseInt(process.env.BREVO_PER_MINUTE_LIMIT || '20', 10);
const TOKEN_REFRESH_INTERVAL = 60000;

let tokens = PER_MINUTE_LIMIT;
let lastRefill = Date.now();

export function getDailyLimit() {
  return DAILY_LIMIT;
}

export function getRemainingDaily() {
  return DAILY_LIMIT;
}

function refillTokens() {
  const now = Date.now();
  const elapsed = now - lastRefill;
  if (elapsed >= TOKEN_REFRESH_INTERVAL) {
    tokens = PER_MINUTE_LIMIT;
    lastRefill = now;
  }
}

export async function checkDailyQuota() {
  const today = new Date().toISOString().split('T')[0];
  const quota = await rtdbGet(`rate_limits/daily/${today}`) || { sent: 0 };
  if (quota.sent >= DAILY_LIMIT) {
    console.warn(`[RateLimiter] Daily limit ${DAILY_LIMIT} reached`);
    return false;
  }
  return true;
}

export async function incrementDailyCount(count = 1) {
  const today = new Date().toISOString().split('T')[0];
  const quota = await rtdbGet(`rate_limits/daily/${today}`) || { sent: 0 };
  quota.sent = (quota.sent || 0) + count;
  await rtdbSet(`rate_limits/daily/${today}`, quota);
  return quota.sent;
}

export async function getDailySent() {
  const today = new Date().toISOString().split('T')[0];
  const quota = await rtdbGet(`rate_limits/daily/${today}`) || { sent: 0 };
  return quota.sent || 0;
}

export async function acquireToken() {
  refillTokens();
  if (tokens <= 0) {
    const waitMs = TOKEN_REFRESH_INTERVAL - (Date.now() - lastRefill);
    console.log(`[RateLimiter] Token exhausted, waiting ${Math.ceil(waitMs / 1000)}s`);
    await new Promise(r => setTimeout(r, Math.min(waitMs, TOKEN_REFRESH_INTERVAL)));
    refillTokens();
  }
  tokens--;
  return true;
}

export async function canSend() {
  const quotaOk = await checkDailyQuota();
  if (!quotaOk) return false;
  refillTokens();
  return tokens > 0;
}

export async function waitForSlot() {
  while (!(await canSend())) {
    console.log('[RateLimiter] Waiting for slot...');
    await new Promise(r => setTimeout(r, 30000));
  }
  tokens--;
  await incrementDailyCount(1);
  return true;
}
