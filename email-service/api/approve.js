import admin from 'firebase-admin';

const RTDB_URL = process.env.RTDB_URL || 'https://laptop-privacy-default-rtdb.firebaseio.com';

function getApp() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ databaseURL: RTDB_URL });
  }
  return admin;
}

function page(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .card{max-width:520px;width:100%;border:2px solid #000;box-shadow:6px 6px 0 #000;padding:32px;text-align:center}
    h1{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
    .btn{display:inline-block;margin-top:16px;padding:8px 20px;background:#000;color:#fff;text-decoration:none;font-weight:700;font-size:13px;text-transform:uppercase}
    p{font-size:14px;color:#444}
  </style></head><body>
  <div class="card"><h1>${title}</h1>${body}</div></body></html>`;
}

export default async function handler(req, res) {
  const app = getApp();
  const db = app.database();
  const approvalId = req.query?.approvalId || '';

  if (!approvalId) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(page('Error', '<p>No approval ID provided.</p>'));
  }

  const snap = await db.ref(`approvals/${approvalId}`).once('value');
  const approval = snap.val();

  if (!approval) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(404).send(page('Not Found', '<p>Approval request not found or already processed.</p>'));
  }

  if (approval.status !== 'pending') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(page('Already Processed', `<p>This approval was already <strong>${approval.status}</strong> on ${approval.approvedAt || approval.rejectedAt || 'earlier'}.</p>`));
  }

  await db.ref(`approvals/${approvalId}/status`).set('approved');
  await db.ref(`approvals/${approvalId}/approvedAt`).set(new Date().toISOString());

  // Queue a campaign job for the worker to pick up
  const campaignId = approval.campaignId || `camp_${approvalId}`;
  await db.ref(`campaigns/${campaignId}/status`).set('approved');
  await db.ref(`campaigns/${campaignId}/approvedAt`).set(new Date().toISOString());

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(page('Approved',
    `<p>The campaign has been approved and will be sent to <strong>${approval.recipientCount || 0}</strong> recipients.</p>
    <a class="btn" href="https://www.fennark.xyz">Return to Website</a>`
  ));
}
