// Seed courses to Cosmos DB (as career paths with type "course")
// Run: node scripts/seed-courses-cosmos.mjs
import { initCosmosDb } from '../server/cosmos.js';

const COURSES = [
  {
    id: "python-basics",
    title: "Python Programming Basics",
    description: "Learn Python from scratch — variables, loops, functions, and file handling. Perfect for beginners who want to start coding.",
    price: 0,
    duration: "4 Weeks",
    icon: "🐍",
    level: "Beginner",
    category: "Programming",
    type: "course",
    features: ["4 Modules", "14 Lessons", "3 Quizzes", "Certificate on Completion", "Hands-on Exercises"],
    skills: ["Python", "Variables", "Functions", "File I/O", "Data Structures"],
    learningObjectives: ["Write Python programs", "Understand data types and control flow", "Build mini-projects"],
  },
  {
    id: "web-dev-fundamentals",
    title: "Web Development Fundamentals",
    description: "Master HTML, CSS, and JavaScript to build modern responsive websites. Includes real-world projects and quizzes.",
    price: 0,
    duration: "6 Weeks",
    icon: "🌐",
    level: "Beginner",
    category: "Web Development",
    type: "course",
    features: ["6 Modules", "18 Lessons", "4 Quizzes", "Certificate on Completion", "Real Projects"],
    skills: ["HTML5", "CSS3", "JavaScript", "Responsive Design", "DOM Manipulation"],
    learningObjectives: ["Build responsive websites", "Style with CSS", "Add interactivity with JavaScript"],
  },
  {
    id: "react-modern-apps",
    title: "React & Modern Web Apps",
    description: "Build modern single-page applications with React, hooks, state management, and API integration. Includes a capstone project.",
    price: 0,
    duration: "8 Weeks",
    icon: "⚛️",
    level: "Intermediate",
    category: "Web Development",
    type: "course",
    features: ["8 Modules", "24 Lessons", "5 Quizzes", "Certificate on Completion", "Capstone Project"],
    skills: ["React", "Hooks", "State Management", "REST APIs", "React Router"],
    learningObjectives: ["Build SPAs with React", "Manage state effectively", "Integrate third-party APIs"],
  },
];

async function seed() {
  const db = await initCosmosDb();
  if (!db) { console.error('Cosmos DB not available'); process.exit(1); }

  // Read existing career paths
  const cd = await db.collection('siteConfig').doc('careerPaths').get();
  let existing = cd.exists ? (cd.data().value?.list || cd.data().value || []) : [];
  console.log(`Found ${existing.length} existing career paths`);

  // Remove old course entries
  existing = existing.filter(p => p.type !== 'course');
  console.log(`After removing old courses: ${existing.length} paths`);

  // Add new courses
  existing.push(...COURSES);
  console.log(`After adding ${COURSES.length} courses: ${existing.length} total paths`);

  // Save back
  await db.collection('siteConfig').doc('careerPaths').set({
    value: { list: existing },
    updatedAt: new Date().toISOString()
  }, { merge: true });

  // Also save to the courses-specific location for the separate courses API
  await db.collection('siteConfig').doc('courses').set({
    value: { list: COURSES },
    updatedAt: new Date().toISOString()
  }, { merge: true });

  console.log('✓ Courses seeded successfully!');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
