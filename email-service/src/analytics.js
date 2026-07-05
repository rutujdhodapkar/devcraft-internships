import { rtdbGet, rtdbSet } from './db.js';
import { daysSince } from './utils.js';
import { getDailySent } from './rateLimiter.js';

export async function computeAnalytics() {
  const apps = await rtdbGet('email_queue_applications') || {};
  const logs = await rtdbGet('email_logs') || {};
  const values = Object.values(apps);

  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  const total = values.length;
  const applied = values.filter(a => a.currentState === 'applied' || a.currentState === 'payment_pending').length;
  const taskAssigned = values.filter(a => ['task_assigned', 'task_completed', 'task_verified'].includes(a.currentState)).length;
  const completed = values.filter(a => a.currentState === 'completed').length;
  const expired = values.filter(a => a.currentState === 'internship_expired' || a.currentState === 'promo').length;
  const paid = values.filter(a => a.paymentStatus === 'success').length;
  const certificateReady = values.filter(a => a.certificateReady).length;
  const withEndDate = values.filter(a => a.internshipEndDate).length;
  const deadlinePassed = values.filter(a => a.internshipEndDate && new Date(a.internshipEndDate).getTime() < now).length;

  const emails = Object.values(logs || {});
  const sent = emails.filter(e => e.status === 'sent').length;
  const failed = emails.filter(e => e.status === 'failed').length;
  const sentToday = await getDailySent();

  const events = await rtdbGet('event_log') || {};
  const openEvents = Object.values(events.email_sent || {}).filter(e => e.data?.openTracked).length;

  const report = {
    date: today,
    total,
    applied,
    taskAssigned,
    completed,
    expired,
    paid,
    certificateReady,
    deadlinePassed,
    sent,
    failed,
    sentToday,
    openRate: sent > 0 ? Math.round((openEvents / sent) * 100) : 0,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    paymentRate: applied > 0 ? Math.round((paid / applied) * 100) : 0,
    dropoffRate: total > 0 ? Math.round((expired / total) * 100) : 0,
    revenue: paid * 200,
    timestamp: new Date().toISOString(),
  };

  await rtdbSet(`analytics/daily/${today}`, report);
  await updateWeeklyMonthly(report);
  return report;
}

async function updateWeeklyMonthly(report) {
  const today = new Date();
  const weekKey = getWeekKey(today);
  const monthKey = getMonthKey(today);

  const weekly = await rtdbGet(`analytics/weekly/${weekKey}`) || { sent: 0, completed: 0, paid: 0, total: 0, expired: 0 };
  weekly.sent = (weekly.sent || 0) + report.sentToday;
  weekly.completed = report.completed;
  weekly.paid = report.paid;
  weekly.total = report.total;
  weekly.expired = report.expired;
  await rtdbSet(`analytics/weekly/${weekKey}`, weekly);

  const monthly = await rtdbGet(`analytics/monthly/${monthKey}`) || { sent: 0, completed: 0, paid: 0, total: 0 };
  monthly.sent = (monthly.sent || 0) + report.sentToday;
  monthly.completed = report.completed;
  monthly.paid = report.paid;
  monthly.total = report.total;
  await rtdbSet(`analytics/monthly/${monthKey}`, monthly);
}

export async function getAnalyticsReport(period = 'daily', days = 30) {
  const path = `analytics/${period}`;
  const data = await rtdbGet(path) || {};
  const entries = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, val]) => ({ date, ...val }));
  return entries;
}

function getWeekKey(d) {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().split('T')[0];
}

function getMonthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
