import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initCosmosDb } from './cosmos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    const content = await fs.readFile(envPath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) {
        const cleaned = value.replace(/^["']|["']$/g, '');
        process.env[key] = cleaned;
      }
    });
    console.log('[Migrate] Loaded .env');
  } catch { console.warn('[Migrate] No .env file found'); }
}

const PORTFOLIO_RTDB = 'https://portfolio-cfe62-default-rtdb.firebaseio.com';

function sanitizeEmail(email) {
  return (email || '').toLowerCase().replace(/\./g, ',').replace(/[^a-z0-9,]/g, '_');
}

function nowIST() {
  const d = new Date();
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().replace('T', ' ').slice(0, 19) + ' IST';
}

async function rtdbPut(category, email, data) {
  const key = sanitizeEmail(email);
  const ts = new Date().toISOString();
  const payload = { ...data, category, key, migratedAt: ts, migratedAtIST: nowIST() };
  try {
    const res = await fetch(`${PORTFOLIO_RTDB}/emailCategories/${category}/${key}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return true;
    console.warn(`  [FAIL] ${category} / ${email} — HTTP ${res.status}`);
  } catch (e) {
    console.warn(`  [FAIL] ${category} / ${email} — ${e.message}`);
  }
  return false;
}

function mapLogTypeToCategory(log) {
  const type = (log.type || log.category || '').toLowerCase();
  const map = {
    welcome: 'welcome',
    payment_reminder: 'payment_pending',
    payment_success: 'payment_success',
    payment_failed: 'payment_pending',
    task_reminder: 'task_completed',
    task_completed: 'task_completed',
    task_verified: 'task_completed',
    certificate_ready: 'certificate_issued',
    completion: 'all_done_with_payment',
    internship_completed: 'all_done_with_payment',
    internship_expired: 'internship_expired',
    deadline_approach: 'deadline_approaching',
    deadline_passed: 'internship_expired',
    re_engagement: 'login',
    reminder: 'login',
    promo: 'welcome',
    admin_alert: 'admin_notification',
  };
  return map[type] || 'general';
}

function mapEnrollmentToCategory(enr) {
  const status = (enr.status || '').toLowerCase();
  const payment = (enr.paymentStatus || '').toLowerCase();
  const paymentStage = (enr.paymentStage || '').toLowerCase();
  const subs = enr.submissions || {};
  const projects = enr.projects || [];
  const allVerified = projects.length > 0 && projects.every((_, i) => subs[i]?.verified);
  const allSubmitted = projects.length > 0 && projects.every((_, i) => subs[i]?.submittedAt);
  const isPaid = payment === 'paid' || paymentStage === 'fully_paid';

  if (status === 'expired') return 'internship_expired';
  if (status === 'completed' && isPaid && allVerified) return 'all_done_with_payment';
  if (allVerified && !isPaid) return 'all_tasks_done_no_payment';
  if (status === 'completed' && !isPaid) return 'all_tasks_done_no_payment';
  if (allSubmitted && !isPaid) return 'all_tasks_done_no_payment';
  if (isPaid) return 'payment_success';
  if (payment === 'pending' || payment === 'failed') return 'payment_pending';
  if (enr.createdAt) return 'internship_application';
  return null;
}

async function migrateEmailLogs(db) {
  console.log('\n=== Migrating emailLogs ===');
  let count = 0;
  try {
    const snap = await db.collection('emailLogs').get();
    const grouped = {};
    snap.docs.forEach(doc => {
      const d = doc.data();
      const email = (d.email || '').toLowerCase().trim();
      if (!email) return;
      const cat = mapLogTypeToCategory(d);
      if (!grouped[cat]) grouped[cat] = {};
      if (!grouped[cat][email] || new Date(d.sentAt || 0) > new Date(grouped[cat][email].sentAt || 0)) {
        grouped[cat][email] = {
          email, name: d.name || email, type: d.type, category: cat,
          subject: d.subject || '', status: d.status || 'sent',
          sentAt: d.sentAt || d.createdAt || new Date().toISOString(),
          templateId: d.templateId || '',
        };
      }
    });
    for (const [cat, users] of Object.entries(grouped)) {
      for (const [email, data] of Object.entries(users)) {
        const ok = await rtdbPut(cat, email, data);
        if (ok) count++;
      }
    }
    console.log(`  Migrated ${count} emailLog records (1 per user per category)`);
  } catch (e) { console.error('  Error:', e.message); }
  return count;
}

async function migrateEnrollments(db) {
  console.log('\n=== Migrating enrollments ===');
  let count = 0;
  try {
    const snap = await db.collection('enrollments').get();
    for (const doc of snap.docs) {
      const enr = doc.data();
      const email = (enr.email || '').toLowerCase().trim();
      if (!email) continue;
      const cat = mapEnrollmentToCategory(enr);
      if (!cat) continue;
      const ok = await rtdbPut(cat, email, {
        email, name: enr.name || email, uid: enr.uid || '',
        domain: enr.domain || '', domainId: enr.domainId || '',
        internId: enr.internId || enr.id || doc.id,
        status: enr.status || '', paymentStatus: enr.paymentStatus || 'none',
        paymentAmount: enr.paymentAmount || 0, deadline: enr.deadline || '',
        referralCode: enr.referralCode || '',
        enrolledAt: enr.createdAt || enr.enrolledAt || '',
        completedAt: enr.completedAt || '',
        createdAt: new Date().toISOString(),
      });
      if (ok) count++;
    }
    console.log(`  Migrated ${count} enrollment records`);
  } catch (e) { console.error('  Error:', e.message); }
  return count;
}

async function migrateAutomationLogs(db) {
  console.log('\n=== Migrating emailAutomationLog ===');
  let count = 0;
  try {
    const snap = await db.collection('emailAutomationLog').get();
    const grouped = {};
    snap.docs.forEach(doc => {
      const d = doc.data();
      const email = (d.email || '').toLowerCase().trim();
      if (!email) return;
      const fromStage = (d.fromStage || '').toLowerCase();
      const toStage = (d.toStage || '').toLowerCase();
      let cat = 'general';
      if (toStage === 'graduated' || toStage === 'completed') cat = 'all_done_with_payment';
      else if (toStage === 'payment_pending') cat = 'payment_pending';
      else if (toStage === 'expired') cat = 'internship_expired';
      else if (toStage === 'active') cat = 'internship_application';
      else if (toStage === 'at_risk') cat = 'deadline_approaching';
      else if (toStage === 'inactive') cat = 'login';
      if (!grouped[cat]) grouped[cat] = {};
      if (!grouped[cat][email] || new Date(d.triggeredAt || 0) > new Date(grouped[cat][email].triggeredAt || 0)) {
        grouped[cat][email] = {
          email, name: email, fromStage: d.fromStage, toStage: d.toStage,
          reason: d.reason || '', triggeredAt: d.triggeredAt || '',
          createdAt: new Date().toISOString(),
        };
      }
    });
    for (const [cat, users] of Object.entries(grouped)) {
      for (const [email, data] of Object.entries(users)) {
        const ok = await rtdbPut(cat, email, data);
        if (ok) count++;
      }
    }
    console.log(`  Migrated ${count} automation log records (1 per user per category)`);
  } catch (e) { console.error('  Error:', e.message); }
  return count;
}

async function migrateEmailSubscriptions(db) {
  console.log('\n=== Migrating emailSubscriptions ===');
  let count = 0;
  try {
    const snap = await db.collection('emailSubscriptions').get();
    for (const doc of snap.docs) {
      const sub = doc.data();
      const email = (sub.email || '').toLowerCase().trim();
      if (!email) continue;
      const status = (sub.status || '').toLowerCase();
      let cat = 'welcome';
      if (status === 'unsubscribed') cat = 'login';
      const ok = await rtdbPut(cat, email, {
        email, name: sub.name || email,
        status: sub.status, categories: sub.categories || {},
        subscribedAt: sub.subscribedAt || '', unsubscribedAt: sub.unsubscribedAt || '',
        lastUpdated: sub.lastUpdated || '',
        createdAt: new Date().toISOString(),
      });
      if (ok) count++;
    }
    console.log(`  Migrated ${count} subscription records`);
  } catch (e) { console.error('  Error:', e.message); }
  return count;
}

async function main() {
  await loadEnv();
  console.log('Starting Cosmos DB → Firebase RTDB email migration...');
  console.log(`Target: ${PORTFOLIO_RTDB}/emailCategories/`);

  const db = await initCosmosDb();
  if (!db) {
    console.error('Could not connect to Cosmos DB. Check COSMOS_DB_CONNECTION_STRING.');
    process.exit(1);
  }

  let total = 0;
  total += await migrateEmailLogs(db);
  total += await migrateEnrollments(db);
  total += await migrateAutomationLogs(db);
  total += await migrateEmailSubscriptions(db);

  console.log(`\n=== Migration complete: ${total} records written to Firebase RTDB ===`);
  console.log('Categories used: login, internship_application, task_completed,');
  console.log('  all_tasks_done_no_payment, all_done_with_payment, payment_pending,');
  console.log('  payment_success, certificate_issued, referral_signup, profile_updated,');
  console.log('  internship_expired, deadline_approaching, welcome, admin_notification');
  process.exit(0);
}

main();
