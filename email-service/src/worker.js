import { CONFIG, STATUS } from './config.js';
import { getPendingJobs, markProcessing, markCompleted, markFailed, archiveOldJobs } from './queueManager.js';
import { renderTemplate } from './templateEngine.js';
import { sendEmail } from './emailProvider.js';
import { logSend, logError, recordAnalytics } from './logger.js';
import { runScheduler } from './scheduler.js';
import { now } from './utils.js';
import { rtdbGet } from './db.js';
import { emit, EVENTS } from './eventBus.js';
import { isEnabled } from './featureFlags.js';
import { evaluateRules } from './rulesEngine.js';
import { processScheduledCampaigns } from './campaignManager.js';
import { waitForSlot, incrementDailyCount } from './rateLimiter.js';
import { logUserActivity } from './auditLogger.js';
import { awardXP } from './referralEngine.js';
import { dispatchWebhooks } from './webhookDispatcher.js';
import { computeAnalytics } from './analytics.js';

export async function runWorker() {
  console.log('[Worker] Starting full automation cycle');
  const startTime = Date.now();

  const flags = await import('./featureFlags.js').then(m => m.getFlags());

  // Phase 1: Rules Engine (evaluates IF/THEN rules)
  if (flags.rulesEngine?.enabled !== false) {
    await evaluateRules();
  }

  // Phase 2: Lifecycle Scheduler (state transitions)
  await runScheduler();

  // Phase 3: Campaign Manager (scheduled campaigns)
  if (flags.campaignScheduling?.enabled !== false) {
    await processScheduledCampaigns();
  }

  // Phase 4: Process email queue
  const results = await processQueue(flags);

  // Phase 5: Compute analytics
  if (flags.aiInsights?.enabled !== false) {
    await computeAnalytics();
  }

  // Phase 6: Archive old jobs
  await archiveOldJobs(30);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Worker] Cycle complete in ${elapsed}s — sent: ${results.sent}, failed: ${results.failed}, skipped: ${results.skipped}`);
  return results;
}

async function processQueue(flags) {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  while (true) {
    const batch = await getPendingJobs(CONFIG.worker.batchSize);
    if (batch.length === 0) break;

    console.log(`[Worker] Processing batch of ${batch.length} jobs`);

    for (const job of batch) {
      try {
        const result = await processJob(job, flags);
        if (result.success) sent++;
        else failed++;
        if (result.skipped) skipped++;
      } catch (err) {
        console.error(`[Worker] Job ${job.notificationId} error:`, err.message);
        await markFailed(job.notificationId, err.message);
        failed++;
      }
    }
  }

  await recordAnalytics('sent', sent);
  await recordAnalytics('failed', failed);

  return { sent, failed, skipped };
}

async function processJob(job, flags) {
  console.log(`[Worker] Processing ${job.notificationId} — ${job.template} → ${job.email}`);

  await markProcessing(job.notificationId);

  // Check subscription preferences in RTDB
  const subKey = job.email.toLowerCase().replace(/[.#$\[\]\/]/g, '_');
  const sub = await rtdbGet(`email_subscriptions/${subKey}`);
  if (sub?.status === 'unsubscribed') {
    await markCompleted(job.notificationId, { skipped: true, reason: 'unsubscribed' });
    return { success: true, skipped: true };
  }
  if (sub?.categories && Object.keys(sub.categories).length > 0 && !sub.categories[job.category] && !sub.categories[job.template]) {
    await markCompleted(job.notificationId, { skipped: true, reason: 'category_opted_out' });
    return { success: true, skipped: true };
  }

  // Rate limit check
  if (flags.rateLimiter?.enabled !== false) {
    await waitForSlot();
  }

  // Render template
  const rendered = await renderTemplate(job.template, {
    ...job.payload,
    fullName: job.fullName,
    email: job.email,
    applicationId: job.applicationId,
    internshipTitle: job.internshipTitle,
    internshipDomain: job.internshipDomain,
    domain: CONFIG.domain,
  });

  if (!rendered) {
    await markFailed(job.notificationId, `Template not found: ${job.template}`);
    return { success: false, error: `Template ${job.template} not found` };
  }

  // Send email
  const startTime = Date.now();
  const result = await sendEmail({
    to: job.email,
    subject: rendered.subject,
    html: rendered.html,
    templateName: job.template,
    category: job.category,
    notificationId: job.notificationId,
  });
  const processingTime = Date.now() - startTime;

  // Log
  const logEntry = {
    notificationId: job.notificationId,
    applicationId: job.applicationId,
    internshipId: job.internshipId,
    userId: job.userId,
    email: job.email,
    template: job.template,
    category: job.category,
    provider: 'brevo',
    status: result.success ? 'sent' : 'failed',
    error: result.error || '',
    retryCount: job.retryCount || 0,
    createdAt: job.createdAt,
    processedAt: now(),
    processingTime,
    providerResponse: result.providerResponse || {},
  };
  await logSend(logEntry);

  if (result.success) {
    await markCompleted(job.notificationId, result);

    // Emit event
    await emit(EVENTS.EMAIL_SENT, {
      email: job.email,
      template: job.template,
      category: job.category,
      notificationId: job.notificationId,
      messageId: result.messageId,
    });

    // Log user activity
    await logUserActivity(job.email, `email:${job.template}`, {
      notificationId: job.notificationId,
      category: job.category,
    });

    // Award XP
    if (job.category === 'certificate_ready') await awardXP(job.email, 'certificate_earned');
    if (job.category === 'internship_completed') await awardXP(job.email, 'internship_completed');

    // Dispatch webhooks
    if (flags.webhookOutgoing?.enabled !== false) {
      await dispatchWebhooks(EVENTS.EMAIL_SENT, logEntry);
    }

    return { success: true, messageId: result.messageId };
  } else {
    await markFailed(job.notificationId, result.error);

    await emit(EVENTS.EMAIL_FAILED, {
      email: job.email,
      template: job.template,
      error: result.error,
      notificationId: job.notificationId,
    });

    return { success: false, error: result.error };
  }
}
