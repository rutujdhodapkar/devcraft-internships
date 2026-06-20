import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH, "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://login-data-680b9-default-rtdb.firebaseio.com",
});
const db = admin.database();

const CAREER_PATHS = [
  {
    id: "path_web", title: "Web Development", duration: "4 Weeks",
    description: "Build responsive frontend projects with HTML, CSS, JavaScript, and React.",
    features: ["HTML/CSS layouts", "JavaScript fundamentals", "React components", "Final project"],
    projects: [
      { title: "Responsive Portfolio", description: "Build a responsive personal portfolio website.", type: "text", links: [], quizQuestions: [], passingGrade: 100 },
      { title: "Web Development Quiz", description: "Test your understanding of web basics.", type: "quiz", links: [], passingGrade: 60, quizQuestions: [
        { question: "Which HTML tag links an external CSS file?", type: "option", options: ["<style>", "<script>", "<link>", "<meta>"], answer: "<link>" },
        { question: "Which JavaScript method adds an item to an array?", type: "option", options: ["push()", "pop()", "shift()", "slice()"], answer: "push()" },
      ] },
    ],
  },
  {
    id: "path_python", title: "Python Development", duration: "4 Weeks",
    description: "Practice Python scripting, data structures, and backend fundamentals.",
    features: ["Python syntax", "OOP", "Flask basics", "Capstone project"],
    projects: [
      { title: "Weather Web App", description: "Create a weather app using Python and a public API.", type: "text", links: [], quizQuestions: [], passingGrade: 100 },
    ],
  },
  {
    id: "path_java", title: "Java Development", duration: "4 Weeks",
    description: "Master Java programming with object-oriented concepts and real-world projects.",
    features: ["Java syntax & OOP", "Data structures", "File I/O", "Capstone project"],
    projects: [
      { title: "Student Management System", description: "Build a console-based student management system in Java.", type: "text", links: [], quizQuestions: [], passingGrade: 100 },
    ],
  },
];

const HOW_IT_WORKS = [
  { id: "step_1", step: 1, title: "Select Domain", description: "Choose your internship domain from available career paths." },
  { id: "step_2", step: 2, title: "Generate Offer", description: "Sign in with Google and complete your profile to receive an instant offer letter." },
  { id: "step_3", step: 3, title: "Complete Projects", description: "Submit your assigned project work through the student dashboard." },
  { id: "step_4", step: 4, title: "Get Certified", description: "Receive your verified completion certificate after admin review." },
];

const FAQS = [
  { id: "faq_1", question: "Are the internships really free?", answer: "Yes, all virtual internships on DEV/CRAFT are 100% free. No hidden charges." },
  { id: "faq_2", question: "Who can apply?", answer: "College students, recent graduates, and self-taught learners from any background can apply." },
  { id: "faq_3", question: "How is progress verified?", answer: "Submitted projects are reviewed from the admin dashboard. Our team verifies each submission." },
  { id: "faq_4", question: "Will I get a certificate?", answer: "Yes, after completing all projects and admin verification, you receive a verified completion certificate." },
  { id: "faq_5", question: "How long does the internship last?", answer: "Each domain is designed for 4 weeks, but you can work at your own pace." },
];

const TEMPLATES = {
  offer_letter: `<html><body style="font-family: Arial, sans-serif; padding: 40px;">
<h1 style="text-align: center;">INTERNSHIP OFFER LETTER</h1>
<hr>
<p><strong>Date:</strong> {{date}}</p>
<p><strong>Intern ID:</strong> {{internId}}</p>
<p>Dear <strong>{{name}}</strong>,</p>
<p>Congratulations! We are pleased to offer you a virtual internship position in <strong>{{domain}}</strong> at DEV/CRAFT.</p>
<p>This internship is 100% free and designed to help you gain practical experience through real-world projects. Upon successful completion, you will receive a verified certificate.</p>
<p>We look forward to seeing your progress!</p>
<br>
<p>Sincerely,<br><strong>DEV/CRAFT Team</strong></p>
</body></html>`,
  certificate: `<html><body style="font-family: Arial, sans-serif; text-align: center; padding: 60px;">
<h1 style="font-size: 28px;">CERTIFICATE OF COMPLETION</h1>
<hr>
<p style="font-size: 18px;">This is to certify that</p>
<h2 style="font-size: 32px;">{{name}}</h2>
<p style="font-size: 18px;">has successfully completed the virtual internship program</p>
<h3 style="font-size: 24px;">{{domain}}</h3>
<p style="font-size: 16px;">Intern ID: {{internId}} | Date: {{date}}</p>
<br><br>
<p>DEV/CRAFT — Virtual Internship Program</p>
</body></html>`,
};

const ABOUT_TEXT = "DEV/CRAFT is a 100% free virtual internship platform for college students and aspiring developers. We provide hands-on project-based learning across multiple domains including Web Development, Python, Java, and more. Our mission is to bridge the gap between academic learning and industry-ready skills.";

async function seed() {
  console.log("Seeding Realtime Database...");

  // Career Paths
  await db.ref("careerPaths").remove();
  const pathsUpdates = {};
  CAREER_PATHS.forEach((path, idx) => {
    const id = path.id || `path_${idx + 1}`;
    pathsUpdates[`careerPaths/${id}`] = { ...path, id, updatedAt: new Date().toISOString() };
  });
  await db.ref().update(pathsUpdates);
  console.log(`  ✓ Career paths (${CAREER_PATHS.length})`);

  // How It Works
  await db.ref("howItWorks").remove();
  const worksUpdates = {};
  HOW_IT_WORKS.forEach((step) => {
    worksUpdates[`howItWorks/${step.id}`] = { ...step, updatedAt: new Date().toISOString() };
  });
  await db.ref().update(worksUpdates);
  console.log(`  ✓ How it works (${HOW_IT_WORKS.length})`);

  // FAQs
  await db.ref("faqs").remove();
  const faqUpdates = {};
  FAQS.forEach((faq) => {
    faqUpdates[`faqs/${faq.id}`] = { ...faq, updatedAt: new Date().toISOString() };
  });
  await db.ref().update(faqUpdates);
  console.log(`  ✓ FAQs (${FAQS.length})`);

  // Templates (config node)
  await db.ref("config/templates").set({ value: TEMPLATES, updatedAt: new Date().toISOString() });
  console.log("  ✓ Templates");

  // About Text (config node)
  await db.ref("config/aboutText").set({ value: ABOUT_TEXT, updatedAt: new Date().toISOString() });
  console.log("  ✓ About text");

  console.log("\nSeeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
