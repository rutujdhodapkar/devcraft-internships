import { rtdbGet, rtdbSet, rtdbPush } from './db.js';
import { emit, EVENTS } from './eventBus.js';
import { now, addDays, daysSince } from './utils.js';
import { renderTemplate } from './templateEngine.js';
import { sendEmail } from './emailProvider.js';
import { CONFIG } from './config.js';

const APPROVER_EMAIL = process.env.APPROVER_EMAIL || 'rutujdhodapkar@gmail.com';

export async function requestApproval(template, payload, campaignId) {
  const approvalId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const rendered = await renderTemplate(template, {
    ...payload,
    fullName: 'Admin',
    email: APPROVER_EMAIL,
    domain: CONFIG.domain,
  });

  if (!rendered) {
    console.error(`[AIAgent] Cannot render template ${template} for approval`);
    return null;
  }

  const approval = {
    approvalId,
    template,
    campaignId: campaignId || '',
    subject: rendered.subject,
    html: rendered.html,
    recipientCount: payload.recipientCount || 0,
    segment: payload.segment || '',
    status: 'pending',
    createdAt: now(),
    expiresAt: addDays(now(), 2),
    requestedBy: 'system',
  };

  await rtdbSet(`approvals/${approvalId}`, approval);

  const approveUrl = `${CONFIG.domain}/api/email/approve?approvalId=${approvalId}`;
  const rejectUrl = `${CONFIG.domain}/api/email/reject?approvalId=${approvalId}`;

  const emailBody = `
    <h2>Email Approval Required</h2>
    <p>A campaign requires your approval before sending.</p>
    <div style="border:2px solid #000;padding:16px;margin:16px 0;background:#fafafa">
      <p><strong>Template:</strong> ${template}</p>
      <p><strong>Subject:</strong> ${rendered.subject}</p>
      <p><strong>Recipients:</strong> ${payload.recipientCount}</p>
      <p><strong>Segment:</strong> ${payload.segment || 'All'}</p>
    </div>
    <hr>
    <div style="text-align:center;margin:16px 0">
      <a href="${approveUrl}" style="display:inline-block;padding:10px 24px;background:#000;color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase;margin:0 8px">Approve</a>
      <a href="${rejectUrl}" style="display:inline-block;padding:10px 24px;background:#fff;color:#000;text-decoration:none;font-weight:700;text-transform:uppercase;border:2px solid #000;margin:0 8px">Reject</a>
    </div>
    <hr>
    <p style="font-size:12px;color:#888">Preview of the email that will be sent:</p>
    <div style="border:1px solid #ddd;padding:12px;margin-top:8px;font-size:12px">${rendered.html.substring(0, 2000)}...</div>
  `;

  const result = await sendEmail({
    to: APPROVER_EMAIL,
    subject: `[APPROVAL] ${rendered.subject}`,
    html: emailBody,
    templateName: 'approval_request',
    category: 'system',
    notificationId: approvalId,
  });

  if (result.success) {
    await rtdbSet(`approvals/${approvalId}/sentAt`, now());
    console.log(`[AIAgent] Approval email sent to ${APPROVER_EMAIL} for ${template}`);
  }

  return approvalId;
}

export async function checkApprovalStatus(approvalId) {
  const approval = await rtdbGet(`approvals/${approvalId}`);
  if (!approval) return null;
  return approval.status;
}

export async function approveCampaign(approvalId) {
  const approval = await rtdbGet(`approvals/${approvalId}`);
  if (!approval) return { success: false, error: 'Approval not found' };

  await rtdbSet(`approvals/${approvalId}/status`, 'approved');
  await rtdbSet(`approvals/${approvalId}/approvedAt`, now());

  await emit(EVENTS.EMAIL_APPROVED, { approvalId, template: approval.template, campaignId: approval.campaignId });

  console.log(`[AIAgent] Campaign ${approval.campaignId || approvalId} approved`);
  return { success: true, approval };
}

export async function rejectCampaign(approvalId) {
  const approval = await rtdbGet(`approvals/${approvalId}`);
  if (!approval) return { success: false, error: 'Approval not found' };

  await rtdbSet(`approvals/${approvalId}/status`, 'rejected');
  await rtdbSet(`approvals/${approvalId}/rejectedAt`, now());

  await emit(EVENTS.EMAIL_REJECTED, { approvalId, template: approval.template });

  console.log(`[AIAgent] Campaign ${approvalId} rejected`);
  return { success: true, approval };
}

export async function getPendingApprovals() {
  const approvals = await rtdbGet('approvals') || {};
  return Object.values(approvals)
    .filter(a => a.status === 'pending')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getInsights() {
  const apps = await rtdbGet('email_queue_applications') || {};
  const logs = await rtdbGet('email_logs') || {};
  const analytics = await rtdbGet('analytics') || {};

  const values = Object.values(apps);
  const total = values.length;
  const applied = values.filter(a => a.currentState === 'applied' || a.currentState === 'payment_pending').length;
  const completed = values.filter(a => a.currentState === 'completed').length;
  const expired = values.filter(a => a.currentState === 'internship_expired' || a.currentState === 'promo').length;
  const withPayment = values.filter(a => a.paymentStatus === 'success').length;
  const emails = Object.values(logs || {});
  const sent = emails.filter(e => e.status === 'sent').length;
  const failed = emails.filter(e => e.status === 'failed').length;
  const rate = sent + failed > 0 ? ((sent / (sent + failed)) * 100).toFixed(1) : 0;

  const insights = [];

  const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
  const dropoffRate = total > 0 ? ((expired / total) * 100).toFixed(1) : 0;
  const paymentConversion = applied > 0 ? ((withPayment / applied) * 100).toFixed(1) : 0;

  insights.push({ type: 'completion', message: `Completion rate is ${completionRate}% (${completed}/${total})`, severity: completionRate > 50 ? 'good' : 'warning' });
  insights.push({ type: 'dropoff', message: `Drop-off rate is ${dropoffRate}% (${expired} expired)`, severity: dropoffRate > 30 ? 'warning' : 'good' });
  insights.push({ type: 'payment', message: `Payment conversion: ${paymentConversion}% of active users paid`, severity: paymentConversion > 50 ? 'good' : 'warning' });
  insights.push({ type: 'email', message: `Email deliverability: ${rate}% (${sent} sent, ${failed} failed)`, severity: rate > 90 ? 'good' : 'critical' });

  if (completed > 0 && total > 0) {
    const lastWeekCompleted = values.filter(a => a.completedAt && daysSince(a.completedAt) <= 7).length;
    const prevWeekCompleted = values.filter(a => a.completedAt && daysSince(a.completedAt) > 7 && daysSince(a.completedAt) <= 14).length;
    if (prevWeekCompleted > 0) {
      const change = ((lastWeekCompleted - prevWeekCompleted) / prevWeekCompleted * 100).toFixed(0);
      insights.push({ type: 'trend', message: `Completions ${change.startsWith('-') ? 'dropped' : 'increased'} ${Math.abs(change)}% this week`, severity: parseInt(change) >= 0 ? 'good' : 'warning' });
    }
  }

  return insights;
}

export async function getRecommendations(userData) {
  const domain = userData.internshipDomain || userData.domain || '';
  const interests = [];

  if (domain.toLowerCase().includes('python') || domain.toLowerCase().includes('ml') || domain.toLowerCase().includes('ai')) {
    interests.push('Machine Learning', 'Deep Learning', 'Data Science', 'AI Engineering');
  }
  if (domain.toLowerCase().includes('web') || domain.toLowerCase().includes('react') || domain.toLowerCase().includes('frontend')) {
    interests.push('Full Stack Development', 'React Advanced', 'Backend Engineering');
  }
  if (domain.toLowerCase().includes('java')) {
    interests.push('Spring Boot', 'Microservices', 'Android Development');
  }
  if (domain.toLowerCase().includes('data') || domain.toLowerCase().includes('analytics')) {
    interests.push('Data Engineering', 'Business Intelligence', 'Data Science');
  }

  if (interests.length === 0) {
    interests.push('Web Development', 'Python', 'Data Science');
  }

  return {
    basedOn: domain || 'your interests',
    recommendations: interests.map(name => ({
      name,
      reason: `Based on your ${domain || 'profile'}, we recommend ${name}`,
      matchScore: Math.floor(70 + Math.random() * 30),
    })),
  };
}
