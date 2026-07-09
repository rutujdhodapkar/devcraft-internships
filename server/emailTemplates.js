const BASE_WRAPPER = `<!DOCTYPE html>
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
  .btn:hover{opacity:.8}
  .footer{text-align:center;padding:20px;background:#fff}
  .footer p{font-size:12px;color:#999;margin-bottom:4px}
  .footer a{color:#000;text-decoration:underline;font-size:12px}
  .divider{height:2px;background:#000;margin:18px 0}
  .badge{display:inline-block;padding:3px 10px;font-size:11px;font-weight:700;background:#000;color:#fff;text-transform:uppercase;letter-spacing:0.5px}
  .highlight{font-weight:700;color:#000}
  table{border-collapse:collapse;width:100%;font-size:14px;color:#444;margin-bottom:14px}
  table td{padding:6px 0;border-bottom:1px solid #eee}
  .label{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700}
  @media(max-width:480px){
    .wrapper{padding:10px}.body{padding:20px 16px}.header{padding:24px 16px 18px}.header h1{font-size:17px}
  }
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>{{HEADING}}</h1>
    <p>{{SUBHEADING}}</p>
  </div>
  <div class="body">{{CONTENT}}</div>
  <div class="footer">
    <p>DEV/CRAFT Internship Platform</p>
    <p style="margin-top:6px"><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a> &middot; <a href="https://www.fennark.xyz">Visit Website</a></p>
    <p style="margin-top:6px;color:#bbb;font-size:11px">You received this email because you are registered on DEV/CRAFT.</p>
  </div>
</div>
</body>
</html>`;

function wrap(content, heading, subheading) {
  return BASE_WRAPPER
    .replace('{{HEADING}}', heading)
    .replace('{{SUBHEADING}}', subheading)
    .replace('{{CONTENT}}', content);
}

export const TEMPLATES = {
  welcome: {
    subject: 'Welcome to DEV/CRAFT — Your Internship Awaits',
    defaultCategory: 'welcome',
    build: (vars) => wrap(`
      <h2>Welcome, ${vars.name || 'Student'}</h2>
      <p>Thank you for joining <strong>DEV/CRAFT</strong>. You have taken the first step toward gaining hands-on industry experience.</p>
      <p>Here is how the program works:</p>
      <ul>
        <li><strong>1. Select a Domain</strong> — Choose from Web Development, AI, Python, and more</li>
        <li><strong>2. Enroll</strong> — Sign in with Google and enroll in your chosen domain</li>
        <li><strong>3. Complete Projects</strong> — Work through practical projects at your own pace</li>
        <li><strong>4. Receive Certificate</strong> — Get a verified completion certificate after review</li>
      </ul>
      <div style="text-align:center"><a class="btn" href="https://www.fennark.xyz">Browse Domains</a></div>
    `, 'Welcome to DEV/CRAFT', 'Your internship journey starts here'),
    sendOnce: true
  },

  payment_reminder: {
    subject: 'Payment Reminder — Complete Your Enrollment',
    defaultCategory: 'payment',
    build: (vars) => wrap(`
      <h2>Payment Pending, ${vars.name || 'Student'}</h2>
      <p>Your enrollment in <strong>${vars.domain || 'your chosen domain'}</strong> is awaiting payment to proceed with verification and certification.</p>
      <div class="divider"></div>
      <table>
        <tr><td class="label">Domain</td><td style="text-align:right;font-weight:600;color:#000">${vars.domain || '—'}</td></tr>
        <tr><td class="label">Amount</td><td style="text-align:right;font-weight:600;color:#000">Rs ${vars.amount || '200'}</td></tr>
        <tr><td class="label">Enrolled Since</td><td style="text-align:right;color:#333">${vars.enrolledSince || '—'}</td></tr>
      </table>
      <p>Complete your payment to unlock project submissions and work toward your certificate.</p>
      <div style="text-align:center"><a class="btn" href="https://www.fennark.xyz/dashboard">Complete Payment</a></div>
    `, 'Payment Reminder', 'Complete your enrollment'),
    sendOnce: false,
    intervalDays: 3,
    maxDurationDays: 60
  },

  task_reminder: {
    subject: 'Pending Tasks — Deadline Approaching',
    defaultCategory: 'task',
    build: (vars) => wrap(`
      <h2>Pending Tasks, ${vars.name || 'Intern'}</h2>
      <p>Your <strong>${vars.domain || 'internship'}</strong> has <span class="highlight">${vars.pendingTasks || 'some'}</span> project(s) awaiting submission.</p>
      <div class="badge">Deadline: ${vars.deadline || 'Set'}</div>
      <p style="margin-top:14px">Submit your completed work to receive feedback from the review team.</p>
      <ul>
        ${(vars.taskList || []).map(t => `<li><strong>${t.title || 'Project'}</strong> — ${t.status || 'Pending'}</li>`).join('')}
      </ul>
      <div style="text-align:center"><a class="btn" href="https://www.fennark.xyz/dashboard">View Tasks</a></div>
    `, 'Task Reminder', `${vars.pendingTasks || 0} project(s) remaining for ${vars.domain || 'your domain'}`),
    sendOnce: false,
    intervalDays: 2,
    triggerIf: 'deadline_approaching'
  },

  deadline_urgent: {
    subject: 'Urgent: Deadline Approaching',
    defaultCategory: 'task',
    build: (vars) => wrap(`
      <h2>Deadline Alert, ${vars.name || 'Intern'}</h2>
      <p style="font-weight:700">Your internship deadline is in ${vars.daysUntilDeadline || 'less than 3'} day(s).</p>
      <p>You have <span class="highlight">${vars.pendingTasks || 0}</span> unsubmitted project(s). Submissions received after the deadline may not be accepted.</p>
      <ul>
        ${(vars.taskList || []).map(t => `<li><strong>${t.title || 'Project'}</strong> — ${t.status || 'Pending'}</li>`).join('')}
      </ul>
      <div style="text-align:center"><a class="btn" href="https://www.fennark.xyz/dashboard">Submit Work</a></div>
      <p style="font-size:12px;color:#999;margin-top:12px">Need more time? Contact support to request an extension.</p>
    `, 'Urgent Deadline Notice', 'Act now to complete your projects'),
    sendOnce: false,
    intervalDays: 1,
    triggerIf: 'deadline_urgent'
  },

  certificate_ready: {
    subject: 'Your Certificate is Ready for Download',
    defaultCategory: 'certificate',
    build: (vars) => wrap(`
      <h2>Congratulations, ${vars.name || 'Graduate'}</h2>
      <p>You have successfully completed your <strong>${vars.domain || 'internship'}</strong> at DEV/CRAFT. Your verified completion certificate is now available.</p>
      <div style="text-align:center;padding:20px;background:#f5f5f5;border:2px solid #000;margin:16px 0">
        <p style="font-size:15px;font-weight:700;color:#000;margin:0 0 4px">${vars.domain || 'Internship'} — Completed</p>
        <p style="font-size:12px;color:#888;margin:0">${vars.completedAt || ''}</p>
      </div>
      <div style="text-align:center"><a class="btn" href="https://www.fennark.xyz/dashboard">Download Certificate</a></div>
      <p style="font-size:13px;color:#888;margin-top:14px">You can also share your achievement on LinkedIn.</p>
    `, 'Certificate Ready', 'Your certificate is available for download'),
    sendOnce: true
  },

  completion: {
    subject: 'Program Completed — Next Steps with DEV/CRAFT',
    defaultCategory: 'general',
    build: (vars) => wrap(`
      <h2>Well Done, ${vars.name || 'Graduate'}</h2>
      <p>You have successfully completed your <strong>${vars.domain || 'program'}</strong> at DEV/CRAFT. Here are some suggested next steps:</p>
      <ul>
        <li><strong>Add to LinkedIn</strong> — Feature your certificate under Licenses and Certifications</li>
        <li><strong>Refer Others</strong> — Share your referral code with friends</li>
        <li><strong>Explore Advanced Domains</strong> — Continue learning with new career paths</li>
      </ul>
      <div style="text-align:center"><a class="btn" href="https://www.fennark.xyz">Explore More</a></div>
    `, 'Program Completed', 'Your next journey awaits'),
    sendOnce: true
  },

  re_engagement: {
    subject: 'Continue Your DEV/CRAFT Internship',
    defaultCategory: 'general',
    build: (vars) => wrap(`
      <h2>Welcome Back, ${vars.name || 'Student'}</h2>
      <p>We noticed your DEV/CRAFT account has been inactive. Your progress is still saved and you can resume where you left off.</p>
      <p>Current progress:</p>
      <ul>
        <li><strong>Domain:</strong> ${vars.domain || 'Not enrolled'}</li>
        <li><strong>Projects Completed:</strong> ${vars.completedProjects || 0} of ${vars.totalProjects || 0}</li>
        <li><strong>Status:</strong> ${vars.status || 'Active'}</li>
      </ul>
      <div style="text-align:center"><a class="btn" href="https://www.fennark.xyz/dashboard">Resume Learning</a></div>
    `, 'Resume Your Internship', 'Continue where you left off'),
    sendOnce: false,
    intervalDays: 7,
    maxSends: 3
  },

  updates: {
    subject: 'Latest Updates from DEV/CRAFT',
    defaultCategory: 'updates',
    build: (vars) => wrap(`
      <h2>Updates, ${vars.name || 'Student'}</h2>
      <p>Stay informed about the latest developments at DEV/CRAFT. New domains and platform improvements are added regularly.</p>
      <ul>
        ${(vars.updates || ['New domains have been added', 'Platform features have been improved', 'New tools are available on your dashboard']).map(u => `<li>${u}</li>`).join('')}
      </ul>
      <div style="text-align:center"><a class="btn" href="https://www.fennark.xyz">View Updates</a></div>
    `, 'Latest Updates', 'Check out what is new at DEV/CRAFT'),
    sendOnce: false,
    intervalDays: 7,
    isBroadcast: true
  },

  general: {
    subject: 'Announcement from DEV/CRAFT',
    defaultCategory: 'general',
    build: (vars) => wrap(`
      <h2>${vars.title || 'Announcement'}</h2>
      ${vars.message ? `<p>${vars.message}</p>` : '<p>An important update regarding DEV/CRAFT.</p>'}
      ${vars.ctaText && vars.ctaUrl ? `<div style="text-align:center"><a class="btn" href="${vars.ctaUrl}">${vars.ctaText}</a></div>` : ''}
    `, vars.title || 'Announcement', vars.subtitle || ''),
    sendOnce: false,
    intervalDays: 0,
    isBroadcast: true
  }
};

export function getTemplate(type) {
  const tpl = TEMPLATES[type];
  if (!tpl) return null;
  return {
    subject: tpl.subject,
    defaultCategory: tpl.defaultCategory || 'general',
    html: (vars) => {
      const allVars = {
        name: vars.name || 'Student',
        domain: vars.domain || '',
        UNSUBSCRIBE_URL: vars.unsubscribeUrl || 'https://www.fennark.xyz/unsubscribe',
        ...vars,
      };
      let html = tpl.build(allVars);
      for (const [k, v] of Object.entries(allVars)) {
        html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
      }
      return html;
    },
    sendOnce: tpl.sendOnce || false,
    intervalDays: tpl.intervalDays || 0,
    maxDurationDays: tpl.maxDurationDays || 0,
    maxSends: tpl.maxSends || 0,
    triggerIf: tpl.triggerIf || null,
    isBroadcast: tpl.isBroadcast || false
  };
}

export function renderTemplate(type, vars) {
  const tpl = getTemplate(type);
  if (!tpl) return null;
  return {
    subject: tpl.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || ''),
    html: tpl.html(vars)
  };
}
