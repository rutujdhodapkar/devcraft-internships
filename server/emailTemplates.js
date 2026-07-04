const BASE_WRAPPER = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.6}
  .wrapper{max-width:600px;margin:0 auto;padding:20px}
  .header{text-align:center;padding:32px 20px 24px;background:linear-gradient(135deg,#111 0%,#1a1a2e 100%);border-radius:16px 16px 0 0;border-bottom:2px solid #2a2a3e}
  .header h1{font-size:22px;font-weight:700;background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .header p{color:#888;font-size:13px;margin-top:4px}
  .body{padding:32px 24px;background:#111;border-radius:0 0 16px 16px}
  .body h2{font-size:18px;font-weight:600;margin-bottom:12px;color:#f0f0f0}
  .body p{font-size:14px;color:#aaa;margin-bottom:16px;line-height:1.7}
  .body ul{list-style:none;padding:0;margin:0 0 16px}
  .body ul li{padding:10px 14px;background:#1a1a2e;border-radius:8px;margin-bottom:8px;font-size:13px;color:#ccc;border-left:3px solid #a78bfa}
  .body ul li strong{color:#f0f0f0}
  .btn{display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#a78bfa,#60a5fa);color:#fff!important;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;margin:8px 0 16px}
  .btn:hover{opacity:.9}
  .footer{text-align:center;padding:24px 20px;background:#0a0a0a;border-top:1px solid #1a1a2e;border-radius:0 0 16px 16px}
  .footer p{font-size:12px;color:#555;margin-bottom:4px}
  .footer a{color:#60a5fa;text-decoration:none;font-size:12px}
  .footer a:hover{text-decoration:underline}
  .divider{height:1px;background:#1a1a2e;margin:20px 0}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;background:#1a1a2e;color:#a78bfa}
  .highlight{color:#a78bfa;font-weight:600}
  @media(max-width:480px){
    .wrapper{padding:10px}
    .body{padding:20px 16px}
    .header{padding:24px 16px 20px}
    .header h1{font-size:18px}
  }
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>{{HEADING}}</h1>
    <p>{{SUBHEADING}}</p>
  </div>
  <div class="body">
    {{CONTENT}}
  </div>
  <div class="footer">
    <p>DEV/CRAFT Internship Platform</p>
    <p style="margin-top:8px"><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a> &middot; <a href="https://devcraft.rutujdhodapkar.tech">Visit Website</a></p>
    <p style="margin-top:8px;color:#444;font-size:11px">You received this email because you registered on DEV/CRAFT.</p>
  </div>
</div>
</body>
</html>`;

function fill(template, vars) {
  let html = template;
  for (const [k, v] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\\\{\\\\{${k}\\\\}\\\\}`, 'g'), v ?? '');
  }
  return html;
}

function wrap(content, heading, subheading, extraVars = {}) {
  let html = BASE_WRAPPER
    .replace('{{HEADING}}', heading)
    .replace('{{SUBHEADING}}', subheading)
    .replace('{{CONTENT}}', content);
  for (const [k, v] of Object.entries(extraVars)) {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
  }
  return html;
}

export const TEMPLATES = {
  welcome: {
    subject: 'Welcome to DEV/CRAFT — Your Internship Awaits!',
    defaultCategory: 'welcome',
    build: (vars) => wrap(`
      <h2>Welcome, ${vars.name || 'there'}! 👋</h2>
      <p>Thank you for joining <strong>DEV/CRAFT</strong> — we're excited to have you on board!</p>
      <p>You've taken the first step toward gaining real-world experience. Here's what happens next:</p>
      <ul>
        <li><strong>1. Browse Domains</strong> — Explore our career paths in Web Dev, AI, Python, and more</li>
        <li><strong>2. Enroll Free</strong> — Sign up with Google and enroll in your chosen domain instantly</li>
        <li><strong>3. Complete Projects</strong> — Work through hands-on projects at your own pace</li>
        <li><strong>4. Get Certified</strong> — Receive a verified completion certificate</li>
      </ul>
      <div style="text-align:center"><a class="btn" href="https://devcraft.rutujdhodapkar.tech">Browse Domains</a></div>
    `, 'Welcome to DEV/CRAFT! 🚀', 'Your hands-on internship journey starts here'),
    sendOnce: true
  },

  payment_reminder: {
    subject: 'Payment Reminder — Complete Your Enrollment',
    defaultCategory: 'payment',
    build: (vars) => wrap(`
      <h2>Payment Pending, ${vars.name || 'Student'}</h2>
      <p>Your enrollment in <strong>${vars.domain || 'your chosen domain'}</strong> is almost complete — just the payment step remaining.</p>
      <div class="divider"></div>
      <table style="width:100%;font-size:14px;color:#aaa;margin-bottom:16px">
        <tr><td style="padding:6px 0">Domain</td><td style="text-align:right;color:#f0f0f0">${vars.domain || '—'}</td></tr>
        <tr><td style="padding:6px 0">Amount</td><td style="text-align:right;color:#f0f0f0;font-weight:600">₹${vars.amount || '200'}</td></tr>
        <tr><td style="padding:6px 0">Enrolled Since</td><td style="text-align:right;color:#f0f0f0">${vars.enrolledSince || '—'}</td></tr>
      </table>
      <p>Complete your payment to unlock project submissions and start working toward your certificate.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.rutujdhodapkar.tech/dashboard">Pay Now</a></div>
    `, 'Payment Reminder 💳', `Hi ${vars.name || 'Student'}, your enrollment is waiting`),
    sendOnce: false,
    intervalDays: 3,
    maxDurationDays: 60
  },

  task_reminder: {
    subject: 'Tasks Pending — Deadline Approaching',
    defaultCategory: 'task',
    build: (vars) => wrap(`
      <h2>You Have Pending Tasks, ${vars.name || 'Intern'}!</h2>
      <p>Your <strong>${vars.domain || 'internship'}</strong> has <span class="highlight">${vars.pendingTasks || 'some'}</span> project(s) awaiting submission.</p>
      <div class="badge">Deadline: ${vars.deadline || 'Soon'}</div>
      <p style="margin-top:16px">Don't wait until the last minute — submit your work and get feedback from our team.</p>
      <ul>
        ${(vars.taskList || []).map(t => `<li><strong>${t.title || 'Project'}</strong> — ${t.status || 'Pending'}</li>`).join('')}
      </ul>
      <div style="text-align:center"><a class="btn" href="https://devcraft.rutujdhodapkar.tech/dashboard">View Tasks</a></div>
    `, 'Tasks Reminder ⏰', `${vars.pendingTasks || 0} project(s) pending for ${vars.domain || 'your internship'}`),
    sendOnce: false,
    intervalDays: 2,
    triggerIf: 'deadline_approaching'
  },

  deadline_urgent: {
    subject: '⚠️ Urgent: Deadline TOMORROW',
    defaultCategory: 'task',
    build: (vars) => wrap(`
      <h2>Deadline Alert — Act Now!</h2>
      <p style="color:#f87171;font-weight:600">Your internship deadline is in ${vars.daysUntilDeadline || 'less than 3'} day(s)!</p>
      <p>You still have <span class="highlight">${vars.pendingTasks || 0}</span> unsubmitted project(s). If you miss the deadline, your enrollment may expire.</p>
      <ul>
        ${(vars.taskList || []).map(t => `<li><strong>${t.title || 'Project'}</strong> — ${t.status || 'Pending'}</li>`).join('')}
      </ul>
      <div style="text-align:center"><a class="btn" href="https://devcraft.rutujdhodapkar.tech/dashboard">Submit Now</a></div>
      <p style="font-size:12px;color:#666;margin-top:12px">Need more time? Contact support to discuss an extension.</p>
    `, '⚠️ Urgent Deadline Notice', `Only ${vars.daysUntilDeadline || 'a few'} day(s) left — submit your work!`),
    sendOnce: false,
    intervalDays: 1,
    triggerIf: 'deadline_urgent'
  },

  certificate_ready: {
    subject: '🎉 Your Certificate is Ready!',
    defaultCategory: 'certificate',
    build: (vars) => wrap(`
      <h2>Congratulations, ${vars.name || 'Graduate'}! 🎉</h2>
      <p>We're thrilled to announce that you have successfully completed your <strong>${vars.domain || 'internship'}</strong> at DEV/CRAFT!</p>
      <div style="text-align:center;padding:20px;background:#1a1a2e;border-radius:12px;margin:16px 0">
        <p style="font-size:32px;margin-bottom:8px">🎓</p>
        <p style="font-size:16px;font-weight:600;color:#f0f0f0">${vars.domain || 'Internship'} — Completed</p>
        <p style="font-size:13px;color:#888">${vars.completedAt || ''}</p>
      </div>
      <p>Your verified completion certificate is now available for download from your dashboard.</p>
      <div style="text-align:center"><a class="btn" href="https://devcraft.rutujdhodapkar.tech/dashboard">Download Certificate</a></div>
      <p style="font-size:13px;color:#888;margin-top:16px">Share your achievement on LinkedIn and tag us!</p>
    `, 'Certificate Ready! 🎓', `${vars.name || 'Graduate'}, you did it!`),
    sendOnce: true
  },

  completion: {
    subject: 'You Graduated — What\'s Next?',
    defaultCategory: 'general',
    build: (vars) => wrap(`
      <h2>You're a DEV/CRAFT Graduate, ${vars.name || 'Alum'}! 🎉</h2>
      <p>You've successfully completed your journey through <strong>${vars.domain || 'your program'}</strong>. Here are some things you can do next:</p>
      <ul>
        <li><strong>Add to LinkedIn</strong> — Feature your certificate under "Licenses & Certifications"</li>
        <li><strong>Refer Friends</strong> — Share your referral code and earn rewards</li>
        <li><strong>Explore More</strong> — Check out advanced domains to continue learning</li>
      </ul>
      <div style="text-align:center"><a class="btn" href="https://devcraft.rutujdhodapkar.tech">Explore More</a></div>
    `, 'Congratulations, Graduate! 🎉', 'Your next journey awaits'),
    sendOnce: true
  },

  re_engagement: {
    subject: 'We Miss You — Come Back to DEV/CRAFT!',
    defaultCategory: 'general',
    build: (vars) => wrap(`
      <h2>It's Been A While, ${vars.name || 'there'}! 👋</h2>
      <p>We noticed you haven't been active on DEV/CRAFT recently. Your progress is still saved — come back and pick up where you left off!</p>
      <p>Here's a quick recap of your journey:</p>
      <ul>
        <li><strong>Domain:</strong> ${vars.domain || 'Not enrolled yet'}</li>
        <li><strong>Projects Completed:</strong> ${vars.completedProjects || 0}/${vars.totalProjects || 0}</li>
        <li><strong>Status:</strong> ${vars.status || 'Active'}</li>
      </ul>
      <div style="text-align:center"><a class="btn" href="https://devcraft.rutujdhodapkar.tech/dashboard">Resume Learning</a></div>
    `, 'We Miss You! 👋', 'Come back and continue your internship journey'),
    sendOnce: false,
    intervalDays: 7,
    maxSends: 3
  },

  updates: {
    subject: 'Latest Updates from DEV/CRAFT',
    defaultCategory: 'updates',
    build: (vars) => wrap(`
      <h2>Hey ${vars.name || 'there'}! Here's What's New</h2>
      <p>Stay up-to-date with the latest from DEV/CRAFT. We're constantly adding new domains, features, and opportunities for you.</p>
      <ul>
        ${(vars.updates || ['New domains added!', 'Platform improvements', 'New features on your dashboard']).map(u => `<li>${u}</li>`).join('')}
      </ul>
      <div style="text-align:center"><a class="btn" href="https://devcraft.rutujdhodapkar.tech">See What's New</a></div>
    `, 'Latest Updates 📬', 'New things happening at DEV/CRAFT'),
    sendOnce: false,
    intervalDays: 7,
    isBroadcast: true
  },

  general: {
    subject: 'Announcement from DEV/CRAFT',
    defaultCategory: 'general',
    build: (vars) => wrap(`
      <h2>${vars.title || 'Important Announcement'}</h2>
      ${vars.message ? `<p>${vars.message}</p>` : '<p>We have an important update to share with you.</p>'}
      ${vars.ctaText && vars.ctaUrl ? `<div style="text-align:center"><a class="btn" href="${vars.ctaUrl}">${vars.ctaText}</a></div>` : ''}
    `, vars.title || 'Announcement 📢', vars.subtitle || ''),
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
        name: 'There',
        domain: '',
        UNSUBSCRIBE_URL: vars.unsubscribeUrl || 'https://devcraft.rutujdhodapkar.tech/unsubscribe',
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
