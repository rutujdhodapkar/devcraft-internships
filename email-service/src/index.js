import { runWorker } from './worker.js';
import { getAnalytics } from './logger.js';
import { countQueued } from './queueManager.js';
import { isConfigured } from './emailProvider.js';
import { getInsights } from './aiAgent.js';
import { computeAnalytics } from './analytics.js';
import { getDeadLetterStats } from './deadLetterQueue.js';

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const startTime = Date.now();
  console.log('='.repeat(50));
  console.log('[Email Service] Starting full automation cycle');
  console.log(`[Email Service] Brevo configured: ${isConfigured()}`);
  console.log(`[Email Service] Dry run: ${DRY_RUN}`);
  console.log('='.repeat(50));

  try {
    if (!DRY_RUN) {
      // Run the full worker (rules → scheduler → campaigns → queue → analytics → archive)
      const results = await runWorker();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const queued = await countQueued();
      const analytics = await getAnalytics();
      const insights = await getInsights();
      const dlStats = await getDeadLetterStats();

      console.log('='.repeat(50));
      console.log(`[Email Service] Cycle completed in ${elapsed}s`);
      console.log(`[Email Service] Sent: ${results.sent}`);
      console.log(`[Email Service] Failed: ${results.failed}`);
      console.log(`[Email Service] Skipped: ${results.skipped}`);
      console.log(`[Email Service] Queued remaining: ${queued}`);
      console.log(`[Email Service] Total all-time sent: ${analytics.totalSent}`);
      console.log(`[Email Service] Total all-time failed: ${analytics.totalFailed}`);
      console.log(`[Email Service] Dead letters: ${dlStats.total}`);
      console.log('--- AI Insights ---');
      for (const ins of insights) {
        console.log(`  [${ins.severity.toUpperCase()}] ${ins.message}`);
      }
      console.log('='.repeat(50));
    } else {
      const queued = await countQueued();
      const insights = await getInsights();
      console.log(`[Dry Run] ${queued} jobs would be processed`);
      console.log('--- AI Insights ---');
      for (const ins of insights) {
        console.log(`  [${ins.severity.toUpperCase()}] ${ins.message}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('[Email Service] Fatal error:', err);
    process.exit(1);
  }
}

// Export for Vercel serverless usage
export async function handler(req, res) {
  if (req) {
    // HTTP request handler (for Vercel)
    const url = req.url || '';
    if (url.includes('/api/email/approve')) {
      const { approveCampaign } = await import('./aiAgent.js');
      const approvalId = req.query?.approvalId || req.body?.approvalId;
      const result = await approveCampaign(approvalId);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(
        `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff">
        <div style="text-align:center;border:2px solid #000;padding:32px;box-shadow:6px 6px 0 #000;max-width:400px">
          <h1 style="font-size:20px;text-transform:uppercase;margin-bottom:8px">Approved</h1>
          <p style="color:#444">${result.success ? 'Campaign approved and queued for sending.' : 'Error: ' + (result.error || 'Unknown')}</p>
          <a href="https://devcraft.rutujdhodapkar.tech" style="display:inline-block;margin-top:16px;padding:8px 20px;background:#000;color:#fff;text-decoration:none;font-weight:700">Return to Website</a>
        </div></body></html>`
      );
    }
    if (url.includes('/api/email/reject')) {
      const { rejectCampaign } = await import('./aiAgent.js');
      const approvalId = req.query?.approvalId || req.body?.approvalId;
      const result = await rejectCampaign(approvalId);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(
        `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff">
        <div style="text-align:center;border:2px solid #000;padding:32px;box-shadow:6px 6px 0 #000;max-width:400px">
          <h1 style="font-size:20px;text-transform:uppercase;margin-bottom:8px">Rejected</h1>
          <p style="color:#444">Campaign has been rejected and will not be sent.</p>
          <a href="https://devcraft.rutujdhodapkar.tech" style="display:inline-block;margin-top:16px;padding:8px 20px;background:#000;color:#fff;text-decoration:none;font-weight:700">Return to Website</a>
        </div></body></html>`
      );
    }
    return res.status(404).json({ error: 'Not found' });
  }
  await main();
}

main();
