// Standalone unsubscribe handler for email-service (Vercel serverless)
// Deploy separately or as part of the email-service
// URL: /api/email/unsubscribe?email=xxx

import admin from 'firebase-admin';

const RTDB_URL = process.env.RTDB_URL || 'https://laptop-privacy-default-rtdb.firebaseio.com';

function getApp() {
  if (admin.apps.length === 0) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let cred;
    if (sa) {
      const json = sa.trim().startsWith('{') ? sa : Buffer.from(sa, 'base64').toString('utf8');
      const parsed = JSON.parse(json);
      if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      cred = admin.credential.cert(parsed);
    }
    admin.initializeApp({ databaseURL: RTDB_URL, credential: cred });
  }
  return admin;
}

function page(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .card{max-width:520px;width:100%;border:2px solid #000;box-shadow:6px 6px 0 #000;padding:32px}
    h1{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
    .sub{color:#888;font-size:13px;margin-bottom:20px}
    hr{border:none;border-top:2px solid #000;margin:16px 0}
    .btn{display:inline-block;padding:10px 24px;background:#000;color:#fff;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:2px solid #000;cursor:pointer;font-family:inherit}
    .btn-outline{background:#fff;color:#000;font-size:11px;padding:6px 14px;margin-left:8px}
    p{font-size:14px;color:#444;margin-bottom:10px;line-height:1.6}
    label{display:flex;align-items:center;gap:8px;padding:8px 0;font-size:14px;color:#333;cursor:pointer;border-bottom:1px solid #eee}
    label input{margin:0;width:16px;height:16px;accent-color:#000;cursor:pointer}
    .msg{padding:10px 14px;border:2px solid #34A853;font-size:13px;font-weight:700;margin-bottom:16px}
  </style></head><body>
  <div class="card"><h1>${title}</h1><div class="sub">DEV/CRAFT — Email Preferences</div>${body}</div></body></html>`;
}

function sanitize(s) {
  return (s || '').replace(/[.#$\[\]\/]/g, '_');
}

export default async function handler(req, res) {
  const app = getApp();
  const db = app.database();
  const email = (req.query?.email || req.body?.email || '').toLowerCase().trim();

  if (!email) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(page('Error', '<p>Invalid link. No email provided.</p>'));
  }

  const key = sanitize(email);
  const ref = db.ref(`email_subscriptions/${key}`);

  if (req.method === 'GET') {
    const done = req.query?.done;
    const snap = await ref.once('value');
    const sub = snap.val();

    if (done === 'all') {
      await ref.set({
        email,
        status: 'unsubscribed',
        allCategories: false,
        updatedAt: new Date().toISOString(),
      });
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(page('Unsubscribed',
        '<div class="msg">You have been unsubscribed from all emails.</div><p>You will not receive any further emails from DEV/CRAFT.</p><hr><a class="btn" href="https://devcraft.fennark.xyz">Return to Website</a>'
      ));
    }

    const catSnap = await db.ref('email_templates').once('value');
    const cats = catSnap.val() || {};
    const catNames = Object.keys(cats).length > 0 ? Object.keys(cats) :
      ['welcome','payment_pending','payment_success','task_assigned','task_completed','task_verified','certificate_ready','internship_completed','internship_expired','promo','reminder','announcement'];

    const isUnsubscribed = sub?.status === 'unsubscribed';
    const checkboxes = catNames.map(c =>
      `<label><input type="checkbox" name="cats" value="${c}"${!isUnsubscribed ? ' checked' : ''}>${c.replace(/_/g, ' ')}</label>`
    ).join('');

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(page('Email Preferences',
      `<p>Choose which emails you want to receive.</p><hr>
      <form method="POST" style="margin-bottom:16px">
        <input type="hidden" name="email" value="${email}">
        ${checkboxes}
        <hr>
        <button type="submit" class="btn">Save Preferences</button>
        <a href="?email=${encodeURIComponent(email)}&done=all" class="btn btn-outline">Unsubscribe All</a>
      </form>`
    ));
  }

  if (req.method === 'POST') {
    const cats = req.body?.cats;
    const selected = cats ? (Array.isArray(cats) ? cats : [cats]) : [];

    if (selected.length === 0) {
      // No categories selected = fully unsubscribed
      await ref.set({ email, status: 'unsubscribed', allCategories: false, categories: {}, updatedAt: new Date().toISOString() });
    } else {
      const categories = {};
      selected.forEach(c => { categories[c] = true; });
      await ref.set({
        email,
        status: 'subscribed',
        allCategories: false,
        categories,
        updatedAt: new Date().toISOString(),
      });
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(page('Preferences Saved',
      '<div class="msg">Your preferences have been saved.</div><p>You will only receive the email types you selected.</p><hr><a class="btn" href="https://devcraft.fennark.xyz">Return to Website</a>'
    ));
  }

  res.status(405).json({ error: 'Method not allowed' });
}
