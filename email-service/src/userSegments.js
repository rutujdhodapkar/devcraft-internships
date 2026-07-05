import { rtdbGet } from './db.js';
import { daysSince } from './utils.js';

const BUILTIN_SEGMENTS = {
  all: { label: 'All Users', filter: () => true },
  active: { label: 'Active Internships', filter: (u) => ['applied', 'payment_pending', 'task_assigned'].includes(u.currentState) },
  completed: { label: 'Completed', filter: (u) => u.currentState === 'completed' },
  expired: { label: 'Expired', filter: (u) => u.currentState === 'internship_expired' || u.currentState === 'promo' },
  payment_pending: { label: 'Payment Pending', filter: (u) => u.currentState === 'payment_pending' },
  paid: { label: 'Paid Users', filter: (u) => u.paymentStatus === 'success' },
  not_paid: { label: 'Not Paid', filter: (u) => u.paymentStatus !== 'success' },
  engaged_7d: { label: 'Engaged Last 7 Days', filter: (u) => u.lastEvent && daysSince(u.lastEvent) <= 7 },
  inactive_30d: { label: 'Inactive 30+ Days', filter: (u) => !u.lastEvent || daysSince(u.lastEvent) > 30 },
  top_referrers: { label: 'Top Referrers', filter: async (u) => { const ref = await getReferralCount(u.email); return ref >= 3; } },
  certificate_ready: { label: 'Certificate Ready', filter: (u) => u.certificateReady },
  deadline_approaching: { label: 'Deadline Approaching', filter: (u) => u.internshipEndDate && daysSince(u.internshipEndDate) >= -7 && daysSince(u.internshipEndDate) < 0 },
  deadline_passed: { label: 'Deadline Passed', filter: (u) => u.internshipEndDate && new Date(u.internshipEndDate).getTime() < Date.now() },
};

export async function getSegmentUsers(segmentId) {
  const segmentDef = BUILTIN_SEGMENTS[segmentId];
  if (!segmentDef) return [];

  const apps = await rtdbGet('email_queue_applications') || {};
  const users = Object.values(apps);

  const results = [];
  for (const user of users) {
    try {
      const result = segmentDef.filter(user);
      if (result instanceof Promise ? await result : result) {
        results.push(user);
      }
    } catch {}
  }
  return results;
}

export async function getSegmentCount(segmentId) {
  const users = await getSegmentUsers(segmentId);
  return users.length;
}

export async function getAllSegments() {
  const segments = Object.entries(BUILTIN_SEGMENTS).map(([id, def]) => ({
    id,
    label: def.label,
  }));
  return segments;
}

async function getReferralCount(email) {
  const referrals = await (await import('./db.js')).rtdbGet('referrals') || {};
  return Object.values(referrals).filter(r => r.referrer === email && r.status === 'completed').length;
}
