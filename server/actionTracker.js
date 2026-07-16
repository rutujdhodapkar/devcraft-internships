import { sendEmail } from './brevoClient.js';
import { renderTemplate } from './emailTemplates.js';

const PORTFOLIO_RTDB = 'https://portfolio-cfe62-default-rtdb.firebaseio.com';

function nowIST() {
  const d = new Date();
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().replace('T', ' ').slice(0, 19) + ' IST';
}

function generateUnsubscribeUrl(email) {
  return `https://devcraft.fennark.xyz/api/email/unsubscribe?email=${encodeURIComponent(email)}`;
}

async function rtdbPushSecure(category, data) {
  const ts = new Date().toISOString();
  const payload = { ...data, category, createdAt: ts, createdAtIST: nowIST(), source: 'server' };
  try {
    await fetch(`${PORTFOLIO_RTDB}/emailCategories/${category}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn(`[ActionTracker] RTDB write to ${category} failed:`, e.message);
  }
}

function buildEmailContent(category, userData, details) {
  const name = userData.name || userData.email || 'User';
  const subjectMap = {
    login: 'Welcome back to DEV/CRAFT',
    internship_application: `Internship Application Confirmed - ${details?.domain || ''}`,
    task_completed: `Task ${details?.taskNumber || ''} Completed - ${details?.taskTitle || ''}`,
    all_tasks_done_no_payment: 'All Tasks Completed - Complete Your Payment',
    all_done_with_payment: 'Congratulations! Internship Complete',
    payment_pending: 'Payment Initiated - DEV/CRAFT',
    payment_success: 'Payment Received - DEV/CRAFT',
    certificate_issued: 'Your Certificate is Ready - DEV/CRAFT',
    referral_signup: 'Welcome via Referral - DEV/CRAFT',
    profile_updated: 'Profile Updated - DEV/CRAFT',
    internship_expired: 'Internship Expired - DEV/CRAFT',
    deadline_approaching: 'Deadline Approaching - DEV/CRAFT',
    welcome: 'Welcome to DEV/CRAFT',
    admin_notification: 'Notification from DEV/CRAFT',
  };

  const headingMap = {
    login: `Welcome Back, ${name}`,
    internship_application: `Application Received, ${name}`,
    task_completed: `Task Completed, ${name}`,
    all_tasks_done_no_payment: `All Tasks Done, ${name}`,
    all_done_with_payment: `Congratulations, ${name}!`,
    payment_pending: `Payment Initiated, ${name}`,
    payment_success: `Payment Received, ${name}`,
    certificate_issued: `Certificate Ready, ${name}`,
    referral_signup: `Welcome, ${name}`,
    profile_updated: `Profile Updated, ${name}`,
    internship_expired: `Internship Expired, ${name}`,
    deadline_approaching: `Deadline Approaching, ${name}`,
    welcome: `Welcome, ${name}`,
    admin_notification: `Notification, ${name}`,
  };

  const bodyMap = {
    login: `
      <p>You have successfully logged in to your DEV/CRAFT account.</p>
      <p><strong>Time:</strong> ${nowIST()}</p>
      <p>Continue working on your internships from your dashboard.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">Go to Dashboard</a></div>
    `,
    internship_application: `
      <p>Your internship application has been confirmed.</p>
      <table>
        <tr><td class="label">Domain</td><td style="text-align:right;font-weight:600">${details?.domain || '—'}</td></tr>
        <tr><td class="label">Intern ID</td><td style="text-align:right;font-weight:600">${details?.internId || '—'}</td></tr>
        <tr><td class="label">Timing</td><td style="text-align:right">${nowIST()}</td></tr>
      </table>
      <p>Start working on your projects from the dashboard.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">View Tasks</a></div>
    `,
    task_completed: `
      <p>You have completed <strong>Task ${details?.taskNumber || ''}</strong>: ${details?.taskTitle || ''}</p>
      <p>Your submission is now under review. The admin will verify it shortly.</p>
      <table>
        <tr><td class="label">Task</td><td style="text-align:right;font-weight:600">${details?.taskTitle || `Task ${details?.taskNumber || ''}`}</td></tr>
        <tr><td class="label">Time</td><td style="text-align:right">${nowIST()}</td></tr>
      </table>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">View Progress</a></div>
    `,
    all_tasks_done_no_payment: `
      <p>Congratulations! You have completed all your tasks for <strong>${details?.domain || 'your internship'}</strong>.</p>
      <p>Your certificate is ready — complete the payment to download it.</p>
      <table>
        <tr><td class="label">Domain</td><td style="text-align:right;font-weight:600">${details?.domain || '—'}</td></tr>
        <tr><td class="label">Amount Due</td><td style="text-align:right;font-weight:600">₹${details?.amount || '0'}</td></tr>
        <tr><td class="label">Time</td><td style="text-align:right">${nowIST()}</td></tr>
      </table>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">Complete Payment</a></div>
    `,
    all_done_with_payment: `
      <p>Congratulations on completing your internship in <strong>${details?.domain || 'your domain'}</strong>!</p>
      <p>All tasks are verified and payment is complete. Your certificate is now available.</p>
      <table>
        <tr><td class="label">Domain</td><td style="text-align:right;font-weight:600">${details?.domain || '—'}</td></tr>
        <tr><td class="label">Status</td><td style="text-align:right;font-weight:600;color:#34A853">COMPLETED</td></tr>
        <tr><td class="label">Time</td><td style="text-align:right">${nowIST()}</td></tr>
      </table>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">Download Certificate</a></div>
    `,
    payment_pending: `
      <p>Your payment of <strong>₹${details?.amount || '0'}</strong> for <strong>${details?.domain || 'your internship'}</strong> has been initiated.</p>
      <p>Once confirmed, your tasks and certificate will be unlocked.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">Check Status</a></div>
    `,
    payment_success: `
      <p>Your payment of <strong>₹${details?.amount || '0'}</strong> has been received successfully.</p>
      <p>Your internship is now fully active. Complete your tasks to earn your certificate.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">Start Working</a></div>
    `,
    certificate_issued: `
      <p>Your completion certificate for <strong>${details?.domain || 'your internship'}</strong> is now available.</p>
      <p>Download it from your dashboard and share it on LinkedIn.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">Download Certificate</a></div>
    `,
    referral_signup: `
      <p>Welcome to DEV/CRAFT! You joined via a referral link.</p>
      <p>Complete your internship to help your referrer earn rewards.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">Get Started</a></div>
    `,
    profile_updated: `
      <p>Your profile has been updated successfully.</p>
      <p>Keep your information current to ensure smooth internship processing.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">View Profile</a></div>
    `,
    internship_expired: `
      <p>Your internship in <strong>${details?.domain || 'your domain'}</strong> has expired.</p>
      <p>Contact support if you need an extension or re-enroll in a new domain.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz">Explore Domains</a></div>
    `,
    deadline_approaching: `
      <p>Your internship deadline is approaching. Complete your pending tasks soon.</p>
      <p>Submit your work before the deadline to avoid expiration.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">Submit Tasks</a></div>
    `,
    welcome: `
      <p>Welcome to DEV/CRAFT Virtual Internship Platform.</p>
      <p>Browse domains, enroll, and start your journey today.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz">Explore Programs</a></div>
    `,
    admin_notification: `
      <p>${details?.message || 'You have a new notification from the DEV/CRAFT team.'}</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.fennark.xyz/dashboard">View Details</a></div>
    `,
  };

  const subject = subjectMap[category] || `Update from DEV/CRAFT`;
  const heading = headingMap[category] || `Hello, ${name}`;
  let body = bodyMap[category] || '<p>Thank you for using DEV/CRAFT.</p>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background:#fff;color:#333;line-height:1.6}
  .wrapper{max-width:600px;margin:0 auto;padding:20px}
  .header{text-align:center;padding:32px 20px 20px;background:#fff;border-bottom:2px solid #000}
  .header h1{font-size:20px;font-weight:800;color:#000;text-transform:uppercase;letter-spacing:1px}
  .header p{color:#666;font-size:13px;margin-top:4px}
  .body{padding:28px 24px;background:#fff;border-bottom:2px solid #000}
  .body h2{font-size:17px;font-weight:700;margin-bottom:12px;color:#000}
  .body p{font-size:14px;color:#444;margin-bottom:14px;line-height:1.7}
  .btn{display:inline-block;padding:10px 24px;background:#000;color:#fff!important;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:6px 0 14px;border:2px solid #000}
  .btn:hover{opacity:.8}
  .footer{text-align:center;padding:20px;background:#fff}
  .footer p{font-size:12px;color:#999;margin-bottom:4px}
  .footer a{color:#000;text-decoration:underline;font-size:12px}
  .label{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700}
  table{border-collapse:collapse;width:100%;font-size:14px;color:#444;margin-bottom:14px}
  table td{padding:6px 0;border-bottom:1px solid #eee}
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>${heading}</h1>
    <p>DEV/CRAFT Virtual Internship</p>
  </div>
  <div class="body">${body}</div>
  <div class="footer">
    <p>DEV/CRAFT Internship Platform</p>
    <p style="margin-top:6px"><a href="${generateUnsubscribeUrl(userData.email || '')}">Unsubscribe</a> &middot; <a href="https://devcraft.fennark.xyz">Visit Website</a></p>
  </div>
</div>
</body>
</html>`;

  return { subject, html };
}

export async function processActionNotification({ category, userData, details }) {
  if (!category || !userData?.email) {
    return { success: false, error: 'Category and user email required' };
  }

  await rtdbPushSecure(category, { userData, details });

  const { subject, html } = buildEmailContent(category, userData, details);
  const unsubscribeUrl = generateUnsubscribeUrl(userData.email);

  try {
    const sendResult = await sendEmail({
      to: userData.email,
      subject,
      html,
      type: category,
      category,
      unsubscribeUrl,
    });
    return { success: true, emailResult: sendResult, category };
  } catch (err) {
    console.error(`[ActionTracker] Email send failed for ${category}:`, err.message);
    return { success: false, error: err.message };
  }
}
