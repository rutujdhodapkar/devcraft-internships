import { rtdbGet, rtdbSet } from './db.js';
import { emit, EVENTS } from './eventBus.js';
import { now, addDays } from './utils.js';
import { enqueue } from './queueManager.js';
import { STATUS } from './config.js';
import { CONFIG } from './config.js';

const XP_RULES = {
  signup: 10,
  referral_created: 20,
  referral_completed: 100,
  task_submitted: 15,
  task_verified: 30,
  payment_done: 50,
  certificate_earned: 100,
  internship_completed: 200,
};

const LEVELS = [
  { level: 1, name: 'Newcomer', xpRequired: 0, badge: 'seed' },
  { level: 2, name: 'Learner', xpRequired: 100, badge: 'sprout' },
  { level: 3, name: 'Contributor', xpRequired: 300, badge: 'leaf' },
  { level: 4, name: 'Achiever', xpRequired: 600, badge: 'star' },
  { level: 5, name: 'Expert', xpRequired: 1000, badge: 'crown' },
  { level: 6, name: 'Master', xpRequired: 2000, badge: 'diamond' },
  { level: 7, name: 'Legend', xpRequired: 5000, badge: 'legend' },
];

export async function awardXP(email, eventType) {
  const xpAmount = XP_RULES[eventType] || 5;
  const key = sanitize(email);
  const profile = await rtdbGet(`referral_profiles/${key}`) || {
    email,
    xp: 0,
    level: 1,
    referrals: 0,
    completedReferrals: 0,
    badges: ['seed'],
    createdAt: now(),
  };

  profile.xp = (profile.xp || 0) + xpAmount;
  profile.lastActivity = now();

  const newLevel = getLevel(profile.xp);
  if (newLevel.level > profile.level) {
    profile.level = newLevel.level;
    if (newLevel.badge && !profile.badges.includes(newLevel.badge)) {
      profile.badges.push(newLevel.badge);
      await emit(EVENTS.BADGE_EARNED, { email, badge: newLevel.badge, level: newLevel.level });
      await enqueue({
        email,
        fullName: email.split('@')[0],
        eventType: 'badge_earned',
        template: 'badge_earned',
        category: 'badge',
        priority: 'high',
        status: STATUS.PENDING,
        payload: { badgeName: newLevel.name, level: newLevel.level },
      });
    }
    await emit(EVENTS.LEVEL_UP, { email, level: newLevel.level, name: newLevel.name });
  }

  await rtdbSet(`referral_profiles/${key}`, profile);
  return { xp: profile.xp, level: profile.level, badges: profile.badges };
}

export async function createReferral(referrerEmail, referredEmail) {
  const refKey = sanitize(referrerEmail);
  const profile = await rtdbGet(`referral_profiles/${refKey}`) || {
    email: referrerEmail, xp: 0, level: 1, referrals: 0, completedReferrals: 0, badges: ['seed'], createdAt: now(),
  };

  const referral = {
    referrer: referrerEmail,
    referred: referredEmail,
    status: 'pending',
    createdAt: now(),
    referralCode: generateCode(),
  };

  profile.referrals = (profile.referrals || 0) + 1;
  await rtdbSet(`referral_profiles/${refKey}`, profile);
  await rtdbPush('referrals', referral);
  await awardXP(referrerEmail, 'referral_created');
  await emit(EVENTS.REFERRAL_CREATED, { referrer: referrerEmail, referred: referredEmail });

  return referral;
}

export async function completeReferral(referredEmail) {
  const referrals = await rtdbGet('referrals') || {};
  for (const [id, ref] of Object.entries(referrals)) {
    if (ref.referred === referredEmail && ref.status === 'pending') {
      await rtdbSet(`referrals/${id}/status`, 'completed');
      await rtdbSet(`referrals/${id}/completedAt`, now());
      await awardXP(ref.referrer, 'referral_completed');

      const profile = await rtdbGet(`referral_profiles/${sanitize(ref.referrer)}`) || {};
      profile.completedReferrals = (profile.completedReferrals || 0) + 1;
      await rtdbSet(`referral_profiles/${sanitize(ref.referrer)}`, profile);

      await emit(EVENTS.REFERRAL_COMPLETED, { referrer: ref.referrer, referred: referredEmail });
    }
  }
}

export async function getLeaderboard(limit = 50) {
  const profiles = await rtdbGet('referral_profiles') || {};
  return Object.values(profiles)
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
    .slice(0, limit)
    .map((p, i) => ({ rank: i + 1, ...p }));
}

export async function getProfile(email) {
  const profile = await rtdbGet(`referral_profiles/${sanitize(email)}`);
  if (!profile) return { email, xp: 0, level: 1, referrals: 0, completedReferrals: 0, badges: ['seed'] };
  return profile;
}

function getLevel(xp) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpRequired) current = lvl;
  }
  return current;
}

function generateCode() {
  return 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function sanitize(s) {
  return (s || '').replace(/[.#$\[\]\/]/g, '_');
}
