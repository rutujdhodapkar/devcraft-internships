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

// ── Courses (3 seeded) ──
const courses = [
  { id: 'python-basics', title: 'Python Programming Basics', description: 'Learn Python from scratch — variables, loops, functions, and file handling.', price: 0, duration: '4 Weeks', icon: '🐍', level: 'Beginner', category: 'Programming', features: ['4 Modules','14 Lessons','3 Quizzes','Certificate on Completion'], skills: ['Python','Functions'], learningObjectives: ['Write Python programs'], createdAt: new Date().toISOString() },
  { id: 'web-dev-fundamentals', title: 'Web Development Fundamentals', description: 'Master HTML, CSS, and JavaScript to build modern responsive websites.', price: 199, duration: '6 Weeks', icon: '🌐', level: 'Beginner', category: 'Web Development', features: ['6 Modules','18 Lessons','4 Quizzes','Certificate on Completion'], skills: ['HTML5','CSS3','JavaScript'], learningObjectives: ['Build responsive websites'], createdAt: new Date().toISOString() },
  { id: 'react-modern-apps', title: 'React & Modern Web Apps', description: 'Build modern single-page applications with React, hooks, state management.', price: 199, duration: '8 Weeks', icon: '⚛️', level: 'Intermediate', category: 'Web Development', features: ['8 Modules','24 Lessons','5 Quizzes','Certificate on Completion'], skills: ['React','Hooks'], learningObjectives: ['Build SPAs with React'], createdAt: new Date().toISOString() },
];
await db.collection('siteConfig').doc('courses').set({ value: { list: courses }, updatedAt: new Date().toISOString() }, { merge: true });
console.log(`✓ ${courses.length} courses`);

// ── Course Content ──
const courseContents = {
  'python-basics': { modules: [{ title: 'Getting Started with Python', lessons: [{ title: 'What is Python?', type: 'text', content: '<h3>Welcome to Python!</h3><p>Python is a high-level, interpreted programming language.</p>', duration: '10 min' }, { title: 'Installing Python', type: 'text', content: '<h3>Setting Up</h3><p>Download from python.org</p>', duration: '15 min' }, { title: 'Your First Program', type: 'text', content: '<h3>Hello, World!</h3><pre>print(\'Hello, World!\')</pre>', duration: '10 min' }], quiz: { title: 'Python Basics Quiz', passingScore: 70, questions: [{ question: 'Who created Python?', options: ['Guido van Rossum','Dennis Ritchie','James Gosling','Brendan Eich'], correctIndex: 0 }, { question: 'Which function prints to console?', options: ['log()','print()','echo()','write()'], correctIndex: 1 }, { question: 'Python is a ______ language.', options: ['Compiled','Interpreted','Markup','Query'], correctIndex: 1 }] } }] },
  'web-dev-fundamentals': { modules: [{ title: 'HTML Foundations', lessons: [{ title: 'What is HTML?', type: 'text', content: '<h3>HTML</h3><p>HyperText Markup Language</p>', duration: '10 min' }, { title: 'Basic HTML Tags', type: 'text', content: '<h3>Tags</h3><p>&lt;h1&gt;, &lt;p&gt;</p>', duration: '15 min' }], quiz: { title: 'HTML Quiz', passingScore: 70, questions: [{ question: 'What does HTML stand for?', options: ['Hyper Text Markup Language','High Tech','Home Tool','Hyper Transfer'], correctIndex: 0 }, { question: 'Which tag is for a paragraph?', options: ['<paragraph>','<p>','<text>','<para>'], correctIndex: 1 }] } }, { title: 'CSS Styling', lessons: [{ title: 'Intro to CSS', type: 'text', content: '<h3>CSS</h3><p>Cascading Style Sheets</p>', duration: '10 min' }], quiz: { title: 'CSS Quiz', passingScore: 70, questions: [{ question: 'Which property changes text color?', options: ['font-color','text-color','color','foreground'], correctIndex: 2 }] } }] },
  'react-modern-apps': { modules: [{ title: 'React Fundamentals', lessons: [{ title: 'What is React?', type: 'text', content: '<h3>React</h3><p>A JS library for building UIs</p>', duration: '12 min' }, { title: 'Setting Up a React Project', type: 'text', content: '<h3>Setup</h3><pre>npx create-react-app my-app</pre>', duration: '15 min' }], quiz: { title: 'React Basics', passingScore: 70, questions: [{ question: 'React is a ______ for building UI.', options: ['Framework','Library','Language','Database'], correctIndex: 1 }, { question: 'What passes data to components?', options: ['State','Props','Variables','Functions'], correctIndex: 1 }] } }] },
};
for (const [id, content] of Object.entries(courseContents)) {
  await db.collection('siteConfig').doc(`courseContent_${id}`).set({ value: content, updatedAt: new Date().toISOString() }, { merge: true });
}
console.log(`✓ ${Object.keys(courseContents).length} course contents`);

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
