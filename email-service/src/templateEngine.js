import { rtdbGet, rtdbSet } from './db.js';

const WRAPPER = `<!DOCTYPE html>
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
  .body ul{list-style:none;padding:0;margin:0 0 14px}
  .body ul li{padding:8px 12px;background:#f5f5f5;margin-bottom:6px;font-size:13px;color:#333;border-left:3px solid #000}
  .body ul li strong{color:#000}
  .btn{display:inline-block;padding:10px 24px;background:#000;color:#fff!important;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:6px 0 14px;border:2px solid #000}
  .footer{text-align:center;padding:20px;background:#fff}
  .footer p{font-size:12px;color:#999;margin-bottom:4px}
  .footer a{color:#000;text-decoration:underline;font-size:12px}
  .divider{height:2px;background:#000;margin:18px 0}
  @media(max-width:480px){
    .wrapper{padding:10px}.body{padding:20px 16px}.header{padding:24px 16px 18px}.header h1{font-size:17px}
  }
</style></head>
<body>
<div class="wrapper">
  <div class="header"><h1>{{HEADING}}</h1><p>{{SUBHEADING}}</p></div>
  <div class="body">{{CONTENT}}</div>
  <div class="footer">
    <p>DEV/CRAFT Internship Platform</p>
    <p style="margin-top:6px"><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`;

function wrap(body, heading, subheading) {
  return WRAPPER
    .replace('{{HEADING}}', heading)
    .replace('{{SUBHEADING}}', subheading)
    .replace('{{CONTENT}}', body);
}

const BUILTIN_TEMPLATES = {
  welcome: {
    subject: 'Welcome to DEV/CRAFT',
    build: (v) => wrap(`
      <h2>Welcome, ${v.fullName || 'Student'}</h2>
      <p>Thank you for applying to <strong>${v.internshipTitle || 'Internship'}</strong> at DEV/CRAFT.</p>
      <p>Your application has been received and is being reviewed. You will receive updates as your application progresses.</p>
      <ul>
        <li><strong>Domain:</strong> ${v.internshipDomain || '—'}</li>
        <li><strong>Application ID:</strong> ${v.applicationId || '—'}</li>
      </ul>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">View Dashboard</a></div>
    `, 'Welcome to DEV/CRAFT', 'Your application has been received'),
  },
  task_assigned: {
    subject: 'New Task Assigned',
    build: (v) => wrap(`
      <h2>Task Assigned, ${v.fullName || 'Intern'}</h2>
      <p>A new task has been assigned for <strong>${v.internshipTitle || 'your internship'}</strong>.</p>
      <div class="divider"></div>
      <p><strong>Task:</strong> ${v.taskName || 'New task'}</p>
      <p><strong>Deadline:</strong> ${v.taskDeadline || '—'}</p>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">View Task</a></div>
    `, 'New Task Assigned', 'Review and complete your task'),
  },
  task_completed: {
    subject: 'Task Submitted for Review',
    build: (v) => wrap(`
      <h2>Task Submitted, ${v.fullName || 'Intern'}</h2>
      <p>Your task <strong>${v.taskName || ''}</strong> has been submitted and is pending review.</p>
      <p>The review team will verify your submission and update you once it is reviewed.</p>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">Track Progress</a></div>
    `, 'Task Submitted', 'Waiting for review'),
  },
  task_verified: {
    subject: 'Task Verified Successfully',
    build: (v) => wrap(`
      <h2>Task Verified, ${v.fullName || 'Intern'}</h2>
      <p>Your task <strong>${v.taskName || ''}</strong> has been verified successfully.</p>
      <p>You have completed ${v.completedTasks || 0} of ${v.totalTasks || 0} tasks for <strong>${v.internshipTitle || 'your internship'}</strong>.</p>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">Continue</a></div>
    `, 'Task Verified', 'Keep up the good work'),
  },
  payment_pending: {
    subject: 'Payment Reminder',
    build: (v) => wrap(`
      <h2>Payment Pending, ${v.fullName || 'Student'}</h2>
      <p>Your tasks for <strong>${v.internshipTitle || 'your internship'}</strong> have been verified. Please complete the payment to proceed with certification.</p>
      <div class="divider"></div>
      <p><strong>Amount:</strong> Rs ${v.amount || '200'}</p>
      <p><strong>Due:</strong> ${v.paymentDueDate || '—'}</p>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">Complete Payment</a></div>
    `, 'Payment Reminder', 'Complete your payment to proceed'),
  },
  payment_success: {
    subject: 'Payment Received Successfully',
    build: (v) => wrap(`
      <h2>Payment Received, ${v.fullName || 'Student'}</h2>
      <p>Your payment of <strong>Rs ${v.amount || '200'}</strong> for <strong>${v.internshipTitle || 'your internship'}</strong> has been received.</p>
      <p>Your certificate will be generated and shared with you shortly.</p>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">View Dashboard</a></div>
    `, 'Payment Received', 'Proceeding with certification'),
  },
  payment_failed: {
    subject: 'Payment Failed — Action Required',
    build: (v) => wrap(`
      <h2>Payment Failed, ${v.fullName || 'Student'}</h2>
      <p>Your payment of <strong>Rs ${v.amount || '200'}</strong> for <strong>${v.internshipTitle || 'your internship'}</strong> could not be processed.</p>
      <p>Please check your payment details and try again.</p>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">Retry Payment</a></div>
    `, 'Payment Failed', 'Please try again'),
  },
  certificate_ready: {
    subject: 'Your Certificate is Ready',
    build: (v) => wrap(`
      <h2>Congratulations, ${v.fullName || 'Graduate'}</h2>
      <p>Your certificate for <strong>${v.internshipTitle || 'your internship'}</strong> is now available for download.</p>
      <div style="text-align:center;padding:20px;background:#f5f5f5;border:2px solid #000;margin:16px 0">
        <p style="font-size:15px;font-weight:700;color:#000;margin:0">${v.internshipTitle || 'Internship'} — Completed</p>
        <p style="font-size:12px;color:#888;margin-top:4px">${v.completionDate || ''}</p>
      </div>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">Download Certificate</a></div>
    `, 'Certificate Ready', 'Download your certificate'),
  },
  internship_completed: {
    subject: 'Internship Completed',
    build: (v) => wrap(`
      <h2>Well Done, ${v.fullName || 'Graduate'}</h2>
      <p>You have successfully completed <strong>${v.internshipTitle || 'your internship'}</strong> at DEV/CRAFT.</p>
      <ul>
        <li><strong>Next Step:</strong> Add your certificate to LinkedIn</li>
        <li><strong>Explore More:</strong> Check out other domains and internships</li>
      </ul>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}">Explore More</a></div>
    `, 'Internship Completed', 'Your next journey awaits'),
  },
  internship_expired: {
    subject: 'Internship Period Ended',
    build: (v) => wrap(`
      <h2>Internship Period Ended, ${v.fullName || 'Student'}</h2>
      <p>The internship period for <strong>${v.internshipTitle || 'your internship'}</strong> has ended.</p>
      <p>If you completed all tasks and made the payment, your certificate is still available. If not, you may re-apply for a new internship.</p>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">View Options</a></div>
    `, 'Internship Period Ended', 'Check your options'),
  },
  promo: {
    subject: 'Special Opportunities at DEV/CRAFT',
    build: (v) => wrap(`
      <h2>Hello ${v.fullName || 'Student'}</h2>
      <p>We have new opportunities and domains available at DEV/CRAFT. Explore what is new and find your next learning experience.</p>
      <ul>
        ${(v.domains || ['Web Development', 'AI', 'Python', 'Data Science']).map(d => `<li><strong>${d}</strong></li>`).join('')}
      </ul>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/domains">Browse Domains</a></div>
      <p style="font-size:12px;color:#888;margin-top:12px">You are receiving this as a past intern of DEV/CRAFT.</p>
    `, 'New Opportunities', 'Explore new domains at DEV/CRAFT'),
  },
  reminder: {
    subject: 'Reminder from DEV/CRAFT',
    build: (v) => wrap(`
      <h2>Reminder, ${v.fullName || 'Student'}</h2>
      <p>${v.message || 'This is a reminder regarding your DEV/CRAFT internship.'}</p>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">View Details</a></div>
    `, 'Reminder', 'Action may be needed'),
  },
  announcement: {
    subject: 'Announcement from DEV/CRAFT',
    build: (v) => wrap(`
      <h2>${v.title || 'Announcement'}</h2>
      <p>${v.message || 'An important update from DEV/CRAFT.'}</p>
      ${v.ctaText && v.ctaUrl ? `<div style="text-align:center"><a class="btn" href="${v.ctaUrl}">${v.ctaText}</a></div>` : ''}
    `, v.title || 'Announcement', ''),
  },
  system_update: {
    subject: 'System Update',
    build: (v) => wrap(`
      <h2>System Update, ${v.fullName || 'Student'}</h2>
      <p>${v.message || 'Your DEV/CRAFT account has been updated.'}</p>
      <div style="text-align:center"><a class="btn" href="${v.domain || 'https://devcraft.fennark.xyz'}/dashboard">View Changes</a></div>
    `, 'System Update', 'Your account has been updated'),
  },
};

export async function getCustomTemplate(templateName) {
  try {
    const tpl = await rtdbGet(`email_templates/${templateName}`);
    return tpl || null;
  } catch {
    return null;
  }
}

export async function renderTemplate(templateName, payload) {
  const custom = await getCustomTemplate(templateName);
  const tpl = custom || BUILTIN_TEMPLATES[templateName];
  if (!tpl) return null;

  const vars = {
    ...payload,
    UNSUBSCRIBE_URL: `${payload.domain || 'https://devcraft.fennark.xyz'}/api/email/unsubscribe?email=${encodeURIComponent(payload.email || '')}`,
    UNSUBSCRIBE_LINK: `${payload.domain || 'https://devcraft.fennark.xyz'}/api/email/unsubscribe?email=${encodeURIComponent(payload.email || '')}`,
  };

  let subject = tpl.subject;
  let html = typeof tpl.build === 'function' ? tpl.build(vars) : tpl.html;

  if (!custom) {
    for (const [k, v] of Object.entries(vars)) {
      if (typeof v === 'string') {
        subject = subject.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
        html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      }
    }
  }

  return { subject, html };
}

export async function saveTemplate(templateName, data) {
  await rtdbSet(`email_templates/${templateName}`, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export function getBuiltinTemplates() {
  return Object.keys(BUILTIN_TEMPLATES);
}
