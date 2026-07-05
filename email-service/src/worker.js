import { CONFIG, STATUS } from './config.js';
import { getPendingJobs, markProcessing, markCompleted, markFailed, archiveOldJobs } from './queueManager.js';
import { renderTemplate } from './templateEngine.js';
import { sendEmail } from './emailProvider.js';
import { logSend, logError, recordAnalytics } from './logger.js';
import { runScheduler } from './scheduler.js';
import { now } from './utils.js';
import { rtdbGet } from './db.js';

export async function runWorker() {
  console.log('[Worker] Starting email processing cycle');

  // Phase 1: Run lifecycle scheduler (reads/writes only RTDB)
  await runScheduler();

  // Phase 2: Process pending email queue
  const results = await processQueue();

  // Phase 3: Archive old jobs
  await archiveOldJobs(30);

  console.log(`[Worker] Cycle complete — sent: ${results.sent}, failed: ${results.failed}, skipped: ${results.skipped}`);
  return results;
}

async function processQueue() {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  while (true) {
    const batch = await getPendingJobs(CONFIG.worker.batchSize);
    if (batch.length === 0) break;

    console.log(`[Worker] Processing batch of ${batch.length} jobs`);

    for (const job of batch) {
      try {
        const result = await processJob(job);
        if (result.success) sent++;
        else failed++;
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

async function processJob(job) {
  console.log(`[Worker] Processing ${job.notificationId} — ${job.template} → ${job.email}`);

  await markProcessing(job.notificationId);

  // Check subscription preferences in RTDB
  const subKey = job.email.toLowerCase().replace(/[.#$\[\]\/]/g, '_');
  const sub = await rtdbGet(`email_subscriptions/${subKey}`);
  if (sub?.status === 'unsubscribed') {
    console.log(`[Worker] Skipped ${job.notificationId} — user unsubscribed`);
    await markCompleted(job.notificationId, { skipped: true, reason: 'unsubscribed' });
    return { success: true, skipped: true };
  }
  if (sub?.categories && Object.keys(sub.categories).length > 0 && !sub.categories[job.category] && !sub.categories[job.template]) {
    console.log(`[Worker] Skipped ${job.notificationId} — category ${job.category} not opted in`);
    await markCompleted(job.notificationId, { skipped: true, reason: 'category_opted_out' });
    return { success: true, skipped: true };
  }

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
    const err = `Template not found: ${job.template}`;
    console.error(`[Worker] ${err}`);
    await markFailed(job.notificationId, err);
    return { success: false, error: err };
  }

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
    return { success: true, messageId: result.messageId };
  } else {
    await markFailed(job.notificationId, result.error);
    return { success: false, error: result.error };
  }
}
