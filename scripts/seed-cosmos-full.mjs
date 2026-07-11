// Seed full career paths + homepage layout + site config into Cosmos
import { initCosmosDb } from '../server/cosmos.js';

const db = await initCosmosDb();
if (!db) { console.error('Cosmos not available'); process.exit(1); }

console.log('Seeding Cosmos DB...');

// ── Homepage Layout ──
await db.collection('siteConfig').doc('homepageLayout').set({
  value: { showInternships: true, showCourses: true, internshipCount: 3, courseCount: 3 },
  updatedAt: new Date().toISOString()
}, { merge: true });
console.log('✓ homepageLayout');

// ── Career Paths (full with projects) ──
await db.collection('siteConfig').doc('careerPaths').set({
  value: { list: [] },
  updatedAt: new Date().toISOString()
}, { merge: true });
console.log('✓ careerPaths placeholder');

// ── Domain Categories ──
await db.collection('siteConfig').doc('domainCategories').set({
  value: [
    { id: 'cat_dev', name: 'Development', description: 'Software development domains', userTypes: ['intern'], certificateTemplate: '' },
    { id: 'cat_data', name: 'Data & AI', description: 'Data science and AI domains', userTypes: ['intern'], certificateTemplate: '' },
    { id: 'cat_design', name: 'Design', description: 'Design-related domains', userTypes: ['intern'], certificateTemplate: '' },
    { id: 'cat_cloud', name: 'Cloud & DevOps', description: 'Cloud and DevOps domains', userTypes: ['intern'], certificateTemplate: '' },
    { id: 'cat_sec', name: 'Security', description: 'Security domains', userTypes: ['intern'], certificateTemplate: '' },
    { id: 'cat_business', name: 'Business & Marketing', description: 'Business and marketing domains', userTypes: ['intern'], certificateTemplate: '' },
  ],
  updatedAt: new Date().toISOString()
}, { merge: true });
console.log('✓ domainCategories');

// ── Payment Settings ──
await db.collection('siteConfig').doc('paymentSettings').set({
  value: { defaultAmount: 200, defaultAmountReferral: 170, defaultTiming: 'end', domains: [] },
  updatedAt: new Date().toISOString()
}, { merge: true });
console.log('✓ paymentSettings');

// ── Payment Settings with domain overrides ──
const domainOverrides = [
  { domain: 'Web Development', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Python Development', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Java Development', amount: 200, amountReferral: 180, timing: null },
  { domain: 'C / C++ Development', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Data Science', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Data Analysis', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Machine Learning', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Artificial Intelligence', amount: 200, amountReferral: 180, timing: null },
  { domain: 'UI/UX Design', amount: 200, amountReferral: 180, timing: null },
  { domain: 'App Development', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Cloud Computing', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Cybersecurity', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Full Stack Development', amount: 200, amountReferral: 180, timing: null },
  { domain: 'DevOps Engineering', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Database Management', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Blockchain Development', amount: 200, amountReferral: 180, timing: null },
  { domain: 'Digital Marketing', amount: 200, amountReferral: 180, timing: null },
];
await db.collection('siteConfig').doc('paymentSettings').set({
  value: { defaultAmount: 200, defaultAmountReferral: 170, defaultTiming: 'end', domains: domainOverrides },
  updatedAt: new Date().toISOString()
}, { merge: true });
console.log('✓ paymentSettings updated');

// ── Templates ──
await db.collection('siteConfig').doc('templates').set({
  value: {
    offer_letter: '<html><body style="font-family: Arial; padding:40px"><h1 style="text-align:center">INTERNSHIP OFFER LETTER</h1><hr><p><strong>Date:</strong> {{date}}</p><p><strong>Intern ID:</strong> {{internId}}</p><p>Dear <strong>{{name}}</strong>,</p><p>Congratulations! We are pleased to offer you a virtual internship in <strong>{{domain}}</strong> at DEV/CRAFT.</p><p>Sincerely,<br><strong>DEV/CRAFT Team</strong></p></body></html>',
    certificate: '<html><body style="font-family: Arial; text-align:center; padding:60px"><h1 style="font-size:28px">CERTIFICATE OF COMPLETION</h1><hr><p style="font-size:18px">This certifies that</p><h2 style="font-size:32px">{{name}}</h2><p style="font-size:18px">has completed the virtual internship</p><h3 style="font-size:24px">{{domain}}</h3><p>Intern ID: {{internId}} | {{date}}</p><br><p>DEV/CRAFT</p></body></html>',
  },
  updatedAt: new Date().toISOString()
}, { merge: true });
console.log('✓ templates');

// ── About Text ──
await db.collection('siteConfig').doc('aboutText').set({
  value: 'DEV/CRAFT is a 100% free virtual internship platform for college students worldwide.',
  updatedAt: new Date().toISOString()
}, { merge: true });
console.log('✓ aboutText');

console.log('\nAll Cosmos seeding complete!');
process.exit(0);
