import { rtdbGet, rtdbSet } from './db.js';
import { now } from './utils.js';

const DEFAULT_FLAGS = {
  aiRecommendations: { enabled: true, description: 'AI-powered course recommendations' },
  referralProgram: { enabled: true, description: 'Referral engine with XP and badges' },
  emailApprovalFlow: { enabled: true, description: 'Require admin approval for promo emails' },
  campaignScheduling: { enabled: true, description: 'Scheduled email campaigns' },
  rulesEngine: { enabled: true, description: 'IF/THEN automation rules' },
  webhookOutgoing: { enabled: true, description: 'Outgoing webhooks on events' },
  documentPipeline: { enabled: true, description: 'Auto-generate certificates and letters' },
  aiInsights: { enabled: true, description: 'AI-powered analytics insights' },
  userSegments: { enabled: true, description: 'Dynamic user segmentation' },
  rateLimiter: { enabled: true, description: 'Rate limit email sending' },
  auditLogging: { enabled: true, description: 'Full audit trail' },
  activityTimeline: { enabled: true, description: 'User activity timeline' },
};

export async function getFlags() {
  const stored = await rtdbGet('feature_flags') || {};
  return { ...DEFAULT_FLAGS, ...stored };
}

export async function isEnabled(flag) {
  const flags = await getFlags();
  return flags[flag]?.enabled !== false;
}

export async function setFlag(flag, value) {
  const flags = await rtdbGet('feature_flags') || {};
  flags[flag] = { ...(flags[flag] || {}), ...value, updatedAt: now() };
  await rtdbSet('feature_flags', flags);
  return flags[flag];
}

export async function toggleFlag(flag) {
  const flags = await getFlags();
  const current = flags[flag]?.enabled !== false;
  return setFlag(flag, { enabled: !current });
}
