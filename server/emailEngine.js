import { sendEmail } from './brevoClient.js';
import { renderTemplate } from './emailTemplates.js';

const FIRESTORE_DB_ID = 'intern';

function daysBetween(a, b = new Date()) {
  return Math.floor((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

function emailDocId(email) {
  return email.toLowerCase().replace(/\./g, ',');
}

function now() {
  return new Date().toISOString();
}

function getFirestore(db) {
  return db;
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return daysBetween(dateStr, new Date());
}

function daysUntil(dateStr) {
  if (!dateStr) return 999;
  return daysBetween(new Date(), dateStr);
}

function isExpired(deadline) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export const STAGES = {
  LEAD: 'lead',
  ENROLLED: 'enrolled',
  PAYMENT_PENDING: 'payment_pending',
  ACTIVE: 'active',
  AT_RISK: 'at_risk',
  COMPLETED: 'completed',
  GRADUATED: 'graduated',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
  UNSUBSCRIBED: 'unsubscribed',
};

export const EMAIL_TYPES = [
  { id: 'welcome', label: 'Welcome', defaultInterval: 0, defaultMaxSends: 1 },
  { id: 'payment_reminder', label: 'Payment Reminder', defaultInterval: 3, defaultMaxSends: 20 },
  { id: 'task_reminder', label: 'Task Reminder', defaultInterval: 2, defaultMaxSends: 10 },
  { id: 'deadline_urgent', label: 'Deadline Urgent', defaultInterval: 1, defaultMaxSends: 5 },
  { id: 'certificate_ready', label: 'Certificate Ready', defaultInterval: 0, defaultMaxSends: 1 },
  { id: 'completion', label: 'Completion Follow-up', defaultInterval: 0, defaultMaxSends: 1 },
  { id: 're_engagement', label: 'Re-engagement', defaultInterval: 7, defaultMaxSends: 3 },
  { id: 'updates', label: 'Updates', defaultInterval: 7, defaultMaxSends: 0 },
  { id: 'general', label: 'General Announcement', defaultInterval: 0, defaultMaxSends: 0 },
];

export const EMAIL_CATEGORIES = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'payment', label: 'Payment' },
  { id: 'task', label: 'Tasks' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'updates', label: 'Updates' },
  { id: 'general', label: 'General' },
];

async function getEmailConfig(db) {
  try {
    const snap = await db.collection('siteConfig').doc('emailConfig').get();
    return snap.exists ? snap.data().value || {} : {};
  } catch (e) {
    return {};
  }
}

async function saveEmailConfig(db, config) {
  try {
    await db.collection('siteConfig').doc('emailConfig').set({ value: config, updatedAt: now() }, { merge: true });
  } catch (e) {
    console.error('[EmailEngine] Failed to save config:', e.message);
  }
}

async function getEmailTemplate(db, type) {
  try {
    const snap = await db.collection('emailTemplates').doc(type).get();
    if (snap.exists) return snap.data();
  } catch (e) {}
  return null;
}

async function getSubscription(db, email) {
  if (!email) return null;
  try {
    const snap = await db.collection('emailSubscriptions').doc(emailDocId(email)).get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

async function getLastSent(db, email, type) {
  try {
    const snap = await db.collection('emailLogs')
      .where('email', '==', email.toLowerCase())
      .where('type', '==', type)
      .orderBy('sentAt', 'desc')
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data();
  } catch (e) {}
  return null;
}

async function countSentByType(db, email, type) {
  try {
    const snap = await db.collection('emailLogs')
      .where('email', '==', email.toLowerCase())
      .where('type', '==', type)
      .get();
    return snap.size;
  } catch (e) {
    return 0;
  }
}

async function logEmailSend(db, { email, type, category, templateId, status, error, subject }) {
  try {
    await db.collection('emailLogs').add({
      email: email.toLowerCase(),
      type,
      category: category || type,
      templateId: templateId || type,
      status,
      error: error || null,
      subject: subject || '',
      sentAt: now(),
    });
  } catch (e) {
    console.error('[EmailEngine] Failed to log email:', e.message);
  }
}

async function logTransition(db, { email, fromStage, toStage, reason }) {
  try {
    await db.collection('emailAutomationLog').add({
      email: email.toLowerCase(),
      action: 'stage_transition',
      fromStage,
      toStage,
      reason: reason || '',
      triggeredAt: now(),
    });
  } catch (e) {}
}

function determineStage(enrollment, user) {
  if (!enrollment) return STAGES.LEAD;

  const { status, paymentStatus, paymentStage, submissions, projects, deadline, expiredAt } = enrollment;

  if (status === 'Expired' || expiredAt) return STAGES.EXPIRED;

  const allProjects = projects || [];
  const subs = submissions || {};
  const allSubmitted = allProjects.length > 0 && allProjects.every((_, i) => subs[i]?.submittedAt);
  const allVerified = allProjects.length > 0 && allProjects.every((_, i) => subs[i]?.verified);
  const isPaid = paymentStatus === 'paid' || paymentStage === 'fully_paid';
  const allowedCert = enrollment.allowedCertificate === 'yes';

  if (allowedCert && status === 'Completed') return STAGES.GRADUATED;
  if (allVerified && isPaid) return STAGES.COMPLETED;

  if (status === 'Completed' && !allowedCert) return STAGES.COMPLETED;

  if (isPaid && allProjects.length > 0) {
    if (deadline && daysUntil(deadline) <= 3 && !allSubmitted) return STAGES.AT_RISK;
    if (deadline && daysUntil(deadline) <= 7 && !allSubmitted) return STAGES.AT_RISK;
    return STAGES.ACTIVE;
  }

  if (isPaid) return STAGES.ACTIVE;

  if (paymentStatus === 'none' || paymentStatus === 'pending' || paymentStatus === 'failed') {
    const daysSinceEnroll = daysSince(enrollment.createdAt);
    if (daysSinceEnroll > 1) return STAGES.PAYMENT_PENDING;
    return STAGES.ENROLLED;
  }

  return STAGES.ENROLLED;
}

function shouldSendEmail(type, stage) {
  const rules = {
    welcome: [STAGES.ENROLLED, STAGES.LEAD],
    payment_reminder: [STAGES.PAYMENT_PENDING],
    task_reminder: [STAGES.ACTIVE, STAGES.AT_RISK],
    deadline_urgent: [STAGES.AT_RISK],
    certificate_ready: [STAGES.COMPLETED],
    completion: [STAGES.GRADUATED],
    re_engagement: [STAGES.INACTIVE, STAGES.LEAD],
    updates: ['*'],
    general: ['*'],
  };
  const allowed = rules[type];
  if (!allowed) return false;
  if (allowed.includes('*')) return stage !== STAGES.UNSUBSCRIBED;
  return allowed.includes(stage);
}

export async function determineLifecycleStages(db) {
  const stages = {};

  try {
    const [enrollmentsSnap, usersSnap] = await Promise.all([
      db.collection('enrollments').get(),
      db.collection('users').get(),
    ]);

    const enrollments = {};
    enrollmentsSnap.docs.forEach(doc => {
      const d = doc.data();
      const key = d.email?.toLowerCase() || d.uid;
      if (key) enrollments[key] = { id: doc.id, ...d };
    });

    usersSnap.docs.forEach(doc => {
      const d = doc.data();
      const email = d.email?.toLowerCase();
      if (!email) return;
      const enrollment = enrollments[email] || enrollments[d.uid];
      const stage = determineStage(enrollment, d);
      stages[email] = {
        email,
        name: d.name || d.displayName || enrollment?.name || 'User',
        uid: d.uid || enrollment?.uid,
        stage,
        enrollment,
        user: d,
        lastActivity: d.lastActivityAt || d.updatedAt || enrollment?.updatedAt || enrollment?.createdAt,
      };
    });

    // Also include users from enrollments who may not be in users collection
    enrollmentsSnap.docs.forEach(doc => {
      const d = doc.data();
      const email = d.email?.toLowerCase();
      if (!email || stages[email]) return;
      stages[email] = {
        email,
        name: d.name || 'Student',
        uid: d.uid,
        stage: determineStage(d, null),
        enrollment: d,
        user: null,
        lastActivity: d.updatedAt || d.createdAt,
      };
    });
  } catch (e) {
    console.error('[EmailEngine] Failed to determine stages:', e.message);
  }

  return Object.values(stages);
}

export async function processEmailCampaign(db, config, dryRun = false, onlyType = null) {
  if (!config || Object.keys(config).length === 0) {
    config = await getEmailConfig(db);
  }

  const results = { processed: 0, sent: 0, skipped: 0, errors: 0, details: [] };
  const stages = await determineLifecycleStages(db);

  const emailTypesToProcess = onlyType
    ? EMAIL_TYPES.filter(t => t.id === onlyType)
    : EMAIL_TYPES;

  if (onlyType && emailTypesToProcess.length === 0) {
    results.errors++;
    return results;
  }

  for (const user of stages) {
    if (user.stage === STAGES.UNSUBSCRIBED) {
      results.skipped++;
      continue;
    }

    // Check subscription
    const sub = await getSubscription(db, user.email);
    if (sub?.status === 'unsubscribed') {
      results.skipped++;
      continue;
    }

    // Determine which email types to send for this user
    for (const emailType of emailTypesToProcess) {
      const typeConfig = config[emailType.id];
      if (typeConfig && typeConfig.active === false) continue;

      // Stage check
      if (!shouldSendEmail(emailType.id, user.stage)) continue;

      // Payment reminder: send if ALL tasks verified, OR if no tasks submitted in 5+ days
      if (emailType.id === 'payment_reminder') {
        const enr = user.enrollment || {};
        const subs = enr.submissions || {};
        const allProjects = enr.projects || [];
        const allVerified = allProjects.length > 0 && allProjects.every((_, i) => subs[i]?.verified === true);
        const anySubmitted = Object.values(subs).some(s => s?.submittedAt);
        const daysSinceEnroll = daysSince(enr.createdAt);
        const noSubmissionIn5Days = !anySubmitted && daysSinceEnroll >= 5;
        if (!allVerified && !noSubmissionIn5Days) {
          results.skipped++;
          continue;
        }
      }

      // Category check - skip if user has opted out of this category
      const templateMeta = (await import('./emailTemplates.js')).TEMPLATES[emailType.id];
      const category = templateMeta?.defaultCategory || emailType.id;
      if (sub?.categories && Object.keys(sub.categories).length > 0 && sub.categories[category] !== true) {
        results.skipped++;
        continue;
      }

      // Interval check
      const interval = typeConfig?.intervalDays ?? emailType.defaultInterval;
      if (interval > 0) {
        const last = await getLastSent(db, user.email, emailType.id);
        if (last && daysSince(last.sentAt) < interval) {
          results.skipped++;
          continue;
        }
      }

      // Max sends check
      const maxSends = typeConfig?.maxSends ?? emailType.defaultMaxSends;
      if (maxSends > 0) {
        const sentCount = await countSentByType(db, user.email, emailType.id);
        if (sentCount >= maxSends) {
          results.skipped++;
          continue;
        }
      }

      // Max duration check (for payment reminders etc.)
      const maxDays = typeConfig?.maxDurationDays ?? 0;
      if (maxDays > 0 && user.enrollment?.createdAt) {
        if (daysSince(user.enrollment.createdAt) > maxDays) {
          results.skipped++;
          continue;
        }
      }

      // Build template variables
      const enr = user.enrollment || {};
      const tasksPending = (enr.projects || []).filter((_, i) => !enr.submissions?.[i]?.submittedAt);
      const taskList = tasksPending.map((p, i) => ({
        title: p.title || `Project ${i + 1}`,
        status: enr.submissions?.[enr.projects.indexOf(p)]?.submittedAt ? 'Submitted' : 'Pending',
      }));

      const vars = {
        name: user.name,
        email: user.email,
        domain: enr.domain || '',
        amount: enr.paymentAmount || '',
        enrolledSince: enr.createdAt ? daysSince(enr.createdAt) + ' days ago' : '',
        deadline: enr.deadline ? new Date(enr.deadline).toLocaleDateString() : '',
        daysUntilDeadline: enr.deadline ? Math.max(0, daysUntil(enr.deadline)) : '',
        pendingTasks: tasksPending.length,
        taskList,
        completedProjects: (enr.projects || []).length - tasksPending.length,
        totalProjects: (enr.projects || []).length,
        status: user.stage,
        completedAt: enr.completedAt ? new Date(enr.completedAt).toLocaleDateString() : '',
        unsubscribeUrl: `https://devcraft.fennark.xyz/api/email/unsubscribe?email=${encodeURIComponent(user.email)}&cat=${encodeURIComponent(category)}`,
      };

      // Check for custom template in Firestore
      const customTpl = await getEmailTemplate(db, emailType.id);
      let rendered;
      if (customTpl?.html && customTpl?.subject) {
        let html = customTpl.html;
        let subject = customTpl.subject;
        for (const [k, v] of Object.entries(vars)) {
          html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
          subject = subject.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
        }
        rendered = { html, subject };
      } else {
        rendered = renderTemplate(emailType.id, vars);
      }

      if (!rendered) continue;

      if (dryRun) {
        results.details.push({ email: user.email, type: emailType.id, stage: user.stage, wouldSend: true });
        results.processed++;
        continue;
      }

      // Send
      try {
        const sendResult = await sendEmail({
          to: user.email,
          subject: rendered.subject,
          html: rendered.html,
          type: emailType.id,
          category,
          unsubscribeUrl: vars.unsubscribeUrl,
        });

        if (sendResult.success) {
          await logEmailSend(db, {
            email: user.email,
            type: emailType.id,
            category,
            templateId: emailType.id,
            status: 'sent',
            subject: rendered.subject,
          });
          results.sent++;
        } else {
          await logEmailSend(db, {
            email: user.email,
            type: emailType.id,
            category,
            templateId: emailType.id,
            status: 'failed',
            error: sendResult.error,
            subject: rendered.subject,
          });
          results.errors++;
        }
      } catch (err) {
        results.errors++;
      }

      results.processed++;
    }
  }

  return results;
}

export async function processLifecycleTransitions(db) {
  const transitions = { applied: 0, logged: [] };
  const stages = await determineLifecycleStages(db);

  for (const user of stages) {
    if (!user.enrollment) continue;

    const enr = user.enrollment;
    const currentStage = user.stage;
    let newStage = currentStage;
    let reason = '';

    // Check for inactivity
    if (![STAGES.COMPLETED, STAGES.GRADUATED, STAGES.EXPIRED, STAGES.UNSUBSCRIBED].includes(currentStage)) {
      if (daysSince(user.lastActivity) > 30) {
        newStage = STAGES.INACTIVE;
        reason = 'No activity for 30+ days';
      }
    }

    // Check expired
    if (enr.deadline && isExpired(enr.deadline) && currentStage === STAGES.ACTIVE) {
      newStage = STAGES.EXPIRED;
      reason = 'Deadline passed';
      try {
        await db.collection('enrollments').doc(enr.id || user.enrollment.id).update({
          status: 'Expired',
          expiredAt: now(),
          updatedAt: now(),
        });
      } catch (e) {}
    }

    // Check completed -> graduated
    if (currentStage === STAGES.COMPLETED && enr.allowedCertificate === 'yes') {
      newStage = STAGES.GRADUATED;
      reason = 'Certificate issued';
    }

    if (newStage !== currentStage) {
      transitions.applied++;
      transitions.logged.push({ email: user.email, from: currentStage, to: newStage, reason });
      await logTransition(db, { email: user.email, fromStage: currentStage, toStage: newStage, reason });
    }
  }

  return transitions;
}

export async function triggerManualType(db, type, emailFilter = null, dryRun = false) {
  console.log(`[EmailEngine] Manual trigger: ${type}${dryRun ? ' (dry run)' : ''}`);
  const config = await getEmailConfig(db);
  const results = await processEmailCampaign(db, config, dryRun, type);
  return {
    success: true,
    type,
    emailFilter,
    dryRun,
    ...results,
  };
}

export async function runDailyCron(db) {
  console.log('[EmailEngine] Starting daily cron...');
  const startTime = Date.now();

  const config = await getEmailConfig(db);
  if (!config.enabled) {
    console.log('[EmailEngine] Email automation is disabled in config. Skipping.');
    return { success: false, message: 'Email automation is disabled' };
  }

  // 1. Process lifecycle transitions
  console.log('[EmailEngine] Processing lifecycle transitions...');
  const transitions = await processLifecycleTransitions(db);
  console.log(`[EmailEngine] Transitions applied: ${transitions.applied}`);

  // 2. Process and send emails
  console.log('[EmailEngine] Processing email campaigns...');
  const emailResults = await processEmailCampaign(db, config);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[EmailEngine] Cron complete in ${duration}s. Sent: ${emailResults.sent}, Skipped: ${emailResults.skipped}, Errors: ${emailResults.errors}`);

  return {
    success: true,
    duration: `${duration}s`,
    transitions: transitions.applied,
    emailResults,
  };
}

export async function getEmailStats(db) {
  try {
    const [logSnap, subSnap, configSnap] = await Promise.all([
      db.collection('emailLogs').get(),
      db.collection('emailSubscriptions').get(),
      db.collection('siteConfig').doc('emailConfig').get(),
    ]);

    const logs = logSnap.docs.map(d => d.data());
    const totalSent = logs.filter(l => l.status === 'sent').length;
    const totalFailed = logs.filter(l => l.status === 'failed').length;
    const totalSubscribed = subSnap.docs.filter(d => d.data().status !== 'unsubscribed').length;
    const totalUnsubscribed = subSnap.docs.filter(d => d.data().status === 'unsubscribed').length;
    const config = configSnap.exists ? configSnap.data().value || {} : {};
    const today = new Date().toISOString().slice(0, 10);
    const sentToday = logs.filter(l => l.status === 'sent' && l.sentAt?.startsWith(today)).length;

    const byType = {};
    logs.filter(l => l.status === 'sent').forEach(l => {
      byType[l.type] = (byType[l.type] || 0) + 1;
    });

    return {
      totalSent,
      totalFailed,
      totalSubscribed,
      totalUnsubscribed,
      sentToday,
      byType,
      config,
      lastRun: config.lastRun || null,
      enabled: config.enabled || false,
    };
  } catch (e) {
    return { error: e.message };
  }
}
