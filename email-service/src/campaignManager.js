import { rtdbGet, rtdbSet } from './db.js';
import { emit, EVENTS } from './eventBus.js';
import { enqueue } from './queueManager.js';
import { requestApproval } from './aiAgent.js';
import { now, isBefore, daysSince } from './utils.js';
import { STATUS, CONFIG } from './config.js';

export async function processScheduledCampaigns() {
  const campaigns = await rtdbGet('campaigns') || {};
  let processed = 0;

  for (const [campaignId, campaign] of Object.entries(campaigns)) {
    try {
      if (campaign.status === 'completed' || campaign.status === 'cancelled') continue;
      if (campaign.scheduledAt && !isBefore(campaign.scheduledAt)) continue;

      const result = await processCampaign(campaignId, campaign);
      if (result) processed++;
    } catch (err) {
      console.error(`[Campaign] Error ${campaignId}:`, err.message);
    }
  }

  return processed;
}

async function processCampaign(campaignId, campaign) {
  if (campaign.status === 'pending_approval') {
    return false;
  }

  if (campaign.status === 'approved' || campaign.status === 'scheduled') {
    await executeCampaign(campaignId, campaign);
    return true;
  }

  if (!campaign.requiresApproval) {
    if (campaign.template === 'promo' || campaign.category === 'promo') {
      const approvalId = await requestApproval(campaign.template, {
        recipientCount: campaign.estimatedRecipients || 0,
        segment: campaign.segment || 'all',
        campaignId,
      }, campaignId);
      if (approvalId) {
        await rtdbSet(`campaigns/${campaignId}/status`, 'pending_approval');
        await rtdbSet(`campaigns/${campaignId}/approvalId`, approvalId);
      }
      return false;
    }

    await executeCampaign(campaignId, campaign);
    return true;
  }

  return false;
}

async function executeCampaign(campaignId, campaign) {
  const recipients = await getRecipients(campaign);

  if (recipients.length === 0) {
    console.log(`[Campaign] ${campaignId} — no recipients`);
    await rtdbSet(`campaigns/${campaignId}/status`, 'completed');
    await rtdbSet(`campaigns/${campaignId}/completedAt`, now());
    await rtdbSet(`campaigns/${campaignId}/recipientCount`, 0);
    return;
  }

  let enqueued = 0;
  for (const user of recipients) {
    await enqueue({
      applicationId: user.applicationId || user.id || campaignId,
      internshipId: user.internshipId || '',
      userId: user.userId || '',
      email: user.email,
      fullName: user.fullName || 'Student',
      internshipDomain: user.internshipDomain || '',
      internshipTitle: user.internshipTitle || '',
      eventType: campaign.template || 'campaign',
      template: campaign.template || 'promo',
      priority: campaign.priority || 'normal',
      category: campaign.category || 'promo',
      currentState: user.currentState || 'active',
      status: STATUS.PENDING,
      payload: campaign.payload || {},
    });
    enqueued++;
  }

  await rtdbSet(`campaigns/${campaignId}/status`, 'completed');
  await rtdbSet(`campaigns/${campaignId}/completedAt`, now());
  await rtdbSet(`campaigns/${campaignId}/recipientCount`, enqueued);
  await rtdbSet(`campaigns/${campaignId}/lastRunAt`, now());

  await emit(EVENTS.CAMPAIGN_COMPLETED, { campaignId, recipients: enqueued });
  console.log(`[Campaign] ${campaignId} — ${enqueued} emails enqueued`);
}

async function getRecipients(campaign) {
  const segment = campaign.segment || 'all';
  const apps = await rtdbGet('email_queue_applications') || {};
  let users = Object.values(apps);

  if (!campaign.includeCompleted) users = users.filter(u => u.currentState !== 'completed');
  if (segment === 'active') users = users.filter(u => ['applied', 'payment_pending', 'task_assigned'].includes(u.currentState));
  if (segment === 'expired') users = users.filter(u => u.currentState === 'internship_expired' || u.currentState === 'promo');
  if (segment === 'completed') users = users.filter(u => u.currentState === 'completed');
  if (segment === 'payment_pending') users = users.filter(u => u.currentState === 'payment_pending');
  if (segment === 'not_paid') users = users.filter(u => u.paymentStatus !== 'success');
  if (segment === 'paid') users = users.filter(u => u.paymentStatus === 'success');
  if (segment === 'engaged_last_7d') users = users.filter(u => u.lastEvent && daysSince(u.lastEvent) <= 7);
  if (segment === 'engaged_last_30d') users = users.filter(u => u.lastEvent && daysSince(u.lastEvent) <= 30);
  if (segment === 'inactive_30d') users = users.filter(u => !u.lastEvent || daysSince(u.lastEvent) > 30);

  if (campaign.domainFilter) {
    users = users.filter(u =>
      (u.internshipDomain || '').toLowerCase().includes(campaign.domainFilter.toLowerCase())
    );
  }

  if (campaign.maxRecipients && users.length > campaign.maxRecipients) {
    users = users.slice(0, campaign.maxRecipients);
  }

  return users;
}

export async function createCampaign(campaign) {
  const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const full = {
    ...campaign,
    campaignId,
    createdAt: now(),
    status: campaign.scheduledAt ? 'scheduled' : 'pending',
    requiresApproval: campaign.requiresApproval !== false,
  };
  await rtdbSet(`campaigns/${campaignId}`, full);
  return campaignId;
}
