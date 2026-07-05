import { runWorker } from './worker.js';
import { getAnalytics } from './logger.js';
import { countQueued } from './queueManager.js';
import { isConfigured } from './emailProvider.js';

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const startTime = Date.now();
  console.log('='.repeat(50));
  console.log('[Email Service] Starting daily automation cycle');
  console.log(`[Email Service] Brevo configured: ${isConfigured()}`);
  console.log(`[Email Service] Dry run: ${DRY_RUN}`);
  console.log('='.repeat(50));

  try {
    if (!DRY_RUN) {
      const results = await runWorker();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const queued = await countQueued();
      const analytics = await getAnalytics();

      console.log('='.repeat(50));
      console.log(`[Email Service] Cycle completed in ${elapsed}s`);
      console.log(`[Email Service] Sent: ${results.sent}`);
      console.log(`[Email Service] Failed: ${results.failed}`);
      console.log(`[Email Service] Skipped: ${results.skipped}`);
      console.log(`[Email Service] Queued remaining: ${queued}`);
      console.log(`[Email Service] Total all-time sent: ${analytics.totalSent}`);
      console.log(`[Email Service] Total all-time failed: ${analytics.totalFailed}`);
      console.log('='.repeat(50));
    } else {
      const queued = await countQueued();
      console.log(`[Dry Run] ${queued} jobs would be processed`);
    }

    process.exit(0);
  } catch (err) {
    console.error('[Email Service] Fatal error:', err);
    process.exit(1);
  }
}

main();
