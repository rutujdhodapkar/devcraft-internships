import { rtdbGet, rtdbSet } from './db.js';
import { emit, EVENTS } from './eventBus.js';
import { now } from './utils.js';
import { renderTemplate } from './templateEngine.js';
import { rtdbPush } from './db.js';

export async function generateDocument(type, userData) {
  const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const template = await getDocumentTemplate(type);
  if (!template) return null;

  const content = template
    .replace(/{{fullName}}/g, userData.fullName || 'Student')
    .replace(/{{internshipTitle}}/g, userData.internshipTitle || 'Internship')
    .replace(/{{internshipDomain}}/g, userData.internshipDomain || '')
    .replace(/{{applicationId}}/g, userData.applicationId || '')
    .replace(/{{date}}/g, new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }))
    .replace(/{{completionDate}}/g, userData.completedAt ? new Date(userData.completedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }));

  const doc = {
    docId,
    type,
    userId: userData.userId || '',
    email: userData.email || '',
    applicationId: userData.applicationId || '',
    content,
    generatedAt: now(),
    status: 'ready',
  };

  await rtdbSet(`documents/${docId}`, doc);
  await emit(EVENTS.DOCUMENT_GENERATED, { docId, type, email: userData.email });

  console.log(`[DocumentPipeline] Generated ${type} for ${userData.email} (${docId})`);
  return doc;
}

export async function generateCertificate(userData) {
  return generateDocument('certificate', userData);
}

export async function generateOfferLetter(userData) {
  return generateDocument('offer_letter', userData);
}

export async function generateCompletionLetter(userData) {
  return generateDocument('completion_letter', userData);
}

async function getDocumentTemplate(type) {
  const templates = {
    certificate: `<!DOCTYPE html><html><head><style>
      body{font-family:serif;text-align:center;padding:60px 40px;color:#333}
      .border{border:3px solid #000;padding:40px}
      h1{font-size:28px;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px}
      .sub{font-size:14px;color:#888;margin-bottom:30px}
      .name{font-size:36px;font-weight:700;margin:20px 0;text-transform:uppercase}
      .body{font-size:16px;line-height:1.8;margin:20px 0;color:#555}
      .footer{margin-top:40px;font-size:13px;color:#888}
    </style></head><body>
    <div class="border">
      <h1>Certificate of Completion</h1>
      <div class="sub">DEV/CRAFT Internship Platform</div>
      <div class="name">{{fullName}}</div>
      <div class="body">
        Has successfully completed the <strong>{{internshipTitle}}</strong> program<br>
        in <strong>{{internshipDomain}}</strong><br>
        on {{completionDate}}
      </div>
      <div class="footer">
        Certificate ID: {{applicationId}}<br>
        DEV/CRAFT Internship Platform
      </div>
    </div>
    </body></html>`,

    offer_letter: `<!DOCTYPE html><html><head><style>
      body{font-family:sans-serif;padding:40px;color:#333;max-width:700px;margin:0 auto}
      h1{font-size:22px;margin-bottom:20px}
      .date{color:#888;font-size:13px;margin-bottom:30px}
      p{font-size:14px;line-height:1.7;margin-bottom:12px;color:#444}
      .signature{margin-top:50px;border-top:2px solid #000;padding-top:16px;font-size:13px;color:#888}
    </style></head><body>
    <h1>Offer Letter</h1>
    <div class="date">{{date}}</div>
    <p>Dear <strong>{{fullName}}</strong>,</p>
    <p>We are pleased to offer you an internship position in <strong>{{internshipTitle}}</strong> ({{internshipDomain}}) at DEV/CRAFT.</p>
    <p>Your application (ID: {{applicationId}}) has been reviewed and accepted. Please proceed with the next steps from your dashboard.</p>
    <p>We look forward to having you on board.</p>
    <div class="signature">
      DEV/CRAFT Internship Platform<br>
      support@rutujdhodapkar.tech
    </div>
    </body></html>`,

    completion_letter: `<!DOCTYPE html><html><head><style>
      body{font-family:sans-serif;padding:40px;color:#333;max-width:700px;margin:0 auto}
      h1{font-size:22px;margin-bottom:20px}
      .date{color:#888;font-size:13px;margin-bottom:30px}
      p{font-size:14px;line-height:1.7;margin-bottom:12px;color:#444}
      .signature{margin-top:50px;border-top:2px solid #000;padding-top:16px;font-size:13px;color:#888}
    </style></head><body>
    <h1>Completion Letter</h1>
    <div class="date">{{date}}</div>
    <p>To Whom It May Concern,</p>
    <p>This is to certify that <strong>{{fullName}}</strong> has successfully completed the <strong>{{internshipTitle}}</strong> program at DEV/CRAFT.</p>
    <p>During this internship, they demonstrated strong skills in {{internshipDomain}} and completed all assigned projects successfully.</p>
    <p>We wish them the best in their future endeavors.</p>
    <div class="signature">
      DEV/CRAFT Internship Platform<br>
      support@rutujdhodapkar.tech
    </div>
    </body></html>`,
  };

  return templates[type] || null;
}
