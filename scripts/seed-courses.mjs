// Seed 3 courses into Firestore.
// Run: FIREBASE_SERVICE_ACCOUNT='{...json...}' node scripts/seed-courses.mjs

const COURSES = [
  {
    id: "python-basics",
    title: "Python Programming Basics",
    description: "Learn Python from scratch — variables, loops, functions, and file handling. Perfect for beginners who want to start coding.",
    price: 0,
    duration: "4 Weeks",
    icon: "https://img.icons8.com/pulsar-color/96w/python.png",
    level: "Beginner",
    category: "Programming",
    features: ["4 Modules", "14 Lessons", "3 Quizzes", "Certificate on Completion", "Hands-on Exercises"],
    skills: ["Python", "Variables", "Functions", "File I/O", "Data Structures"],
    learningObjectives: ["Write Python programs", "Understand data types and control flow", "Build mini-projects"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "web-dev-fundamentals",
    title: "Web Development Fundamentals",
    description: "Master HTML, CSS, and JavaScript to build modern responsive websites. Includes real-world projects and quizzes.",
    price: 199,
    duration: "6 Weeks",
    icon: "https://img.icons8.com/pulsar-color/96w/development.png",
    level: "Beginner",
    category: "Web Development",
    features: ["6 Modules", "18 Lessons", "4 Quizzes", "Certificate on Completion", "Real Projects"],
    skills: ["HTML5", "CSS3", "JavaScript", "Responsive Design", "DOM Manipulation"],
    learningObjectives: ["Build responsive websites", "Style with CSS", "Add interactivity with JavaScript"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "react-modern-apps",
    title: "React & Modern Web Apps",
    description: "Build modern single-page applications with React, hooks, state management, and API integration. Includes a capstone project.",
    price: 199,
    duration: "8 Weeks",
    icon: "https://img.icons8.com/pulsar-color/96w/react-native.png",
    level: "Intermediate",
    category: "Web Development",
    features: ["8 Modules", "24 Lessons", "5 Quizzes", "Certificate on Completion", "Capstone Project"],
    skills: ["React", "Hooks", "State Management", "REST APIs", "React Router"],
    learningObjectives: ["Build SPAs with React", "Manage state effectively", "Integrate third-party APIs"],
    createdAt: new Date().toISOString(),
  },
];

const COURSE_CONTENT = {
  "python-basics": {
    modules: [
      {
        title: "Getting Started with Python",
        lessons: [
          { title: "What is Python?", type: "text", content: "<h3>Welcome to Python!</h3><p>Python is a high-level, interpreted programming language known for its readability and simplicity. Created by Guido van Rossum in 1991, Python is widely used for web development, data science, AI, and automation.</p><p>In this course, you'll learn the fundamentals of Python programming from scratch. No prior experience is needed.</p>", duration: "10 min" },
          { title: "Installing Python", type: "text", content: "<h3>Setting Up Python</h3><p>Download Python from <a href='https://python.org' target='_blank'>python.org</a>. Install the latest version for your operating system. Verify installation by running <code>python --version</code> in your terminal.</p><p>We recommend using VS Code as your code editor with the Python extension installed.</p>", duration: "15 min" },
          { title: "Your First Program", type: "text", content: "<h3>Hello, World!</h3><p>Open a new file called <code>hello.py</code> and type: <pre style='background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:4px;'>print('Hello, World!')</pre></p><p>Run it with: <code>python hello.py</code></p><p>Congratulations — you've written your first Python program!</p>", duration: "10 min" },
        ],
        quiz: {
          title: "Python Basics Quiz",
          passingScore: 70,
          questions: [
            { question: "Who created Python?", options: ["Guido van Rossum", "Dennis Ritchie", "James Gosling", "Brendan Eich"], correctIndex: 0 },
            { question: "Which function prints to the console?", options: ["log()", "print()", "echo()", "write()"], correctIndex: 1 },
            { question: "Python is a ______ language.", options: ["Compiled", "Interpreted", "Markup", "Query"], correctIndex: 1 },
          ],
        },
      },
      {
        title: "Variables and Data Types",
        lessons: [
          { title: "Variables in Python", type: "text", content: "<h3>Variables</h3><p>Variables store data in memory. In Python, you don't need to declare a type: <pre style='background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:4px;'>name = 'Alice'\nage = 25\nheight = 5.6\nis_student = True</pre></p>", duration: "15 min" },
          { title: "Data Types Overview", type: "text", content: "<h3>Common Data Types</h3><ul><li><strong>str</strong> — text: 'Hello'</li><li><strong>int</strong> — whole numbers: 42</li><li><strong>float</strong> — decimals: 3.14</li><li><strong>bool</strong> — True/False</li><li><strong>list</strong> — [1, 2, 3]</li><li><strong>dict</strong> — {'key': 'value'}</li></ul>", duration: "12 min" },
        ],
        quiz: {
          title: "Variables Quiz",
          passingScore: 70,
          questions: [
            { question: "What type is `x = 3.14`?", options: ["int", "float", "str", "bool"], correctIndex: 1 },
            { question: "Which is a valid variable name?", options: ["2name", "my-name", "my_name", "my name"], correctIndex: 2 },
          ],
        },
      },
    ],
  },
  "web-dev-fundamentals": {
    modules: [
      {
        title: "HTML Foundations",
        lessons: [
          { title: "What is HTML?", type: "text", content: "<h3>HTML — The Structure of the Web</h3><p>HTML (HyperText Markup Language) is the standard language for creating web pages. It uses tags to structure content: headings, paragraphs, links, images, and more.</p><p>Every website you visit is built with HTML at its core.</p>", duration: "10 min" },
          { title: "Basic HTML Tags", type: "text", content: "<h3>Essential Tags</h3><pre style='background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:4px;'>&lt;h1&gt;Heading&lt;/h1&gt;\n&lt;p&gt;Paragraph&lt;/p&gt;\n&lt;a href='url'&gt;Link&lt;/a&gt;\n&lt;img src='image.jpg' alt='text'&gt;\n&lt;ul&gt;&lt;li&gt;Item&lt;/li&gt;&lt;/ul&gt;</pre>", duration: "15 min" },
        ],
        quiz: {
          title: "HTML Quiz",
          passingScore: 70,
          questions: [
            { question: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyper Transfer Markup Language"], correctIndex: 0 },
            { question: "Which tag is used for a paragraph?", options: ["&lt;paragraph&gt;", "&lt;p&gt;", "&lt;text&gt;", "&lt;para&gt;"], correctIndex: 1 },
          ],
        },
      },
      {
        title: "CSS Styling",
        lessons: [
          { title: "Introduction to CSS", type: "text", content: "<h3>CSS — Making Things Beautiful</h3><p>CSS (Cascading Style Sheets) controls the appearance of your HTML elements — colors, fonts, spacing, layout, and animations.</p>", duration: "10 min" },
        ],
        quiz: {
          title: "CSS Quiz",
          passingScore: 70,
          questions: [
            { question: "Which property changes text color?", options: ["font-color", "text-color", "color", "foreground"], correctIndex: 2 },
          ],
        },
      },
    ],
  },
  "react-modern-apps": {
    modules: [
      {
        title: "React Fundamentals",
        lessons: [
          { title: "What is React?", type: "text", content: "<h3>React — Building User Interfaces</h3><p>React is a JavaScript library for building user interfaces. Created by Meta (Facebook), it uses a component-based architecture where UI is broken into reusable pieces.</p><p>Key concepts: Components, Props, State, and the Virtual DOM.</p>", duration: "12 min" },
          { title: "Setting Up a React Project", type: "text", content: "<h3>Create a React App</h3><pre style='background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:4px;'>npx create-react-app my-app\ncd my-app\nnpm start</pre><p>This sets up a modern React development environment with hot reloading.</p>", duration: "15 min" },
        ],
        quiz: {
          title: "React Basics",
          passingScore: 70,
          questions: [
            { question: "React is a ______ for building UI.", options: ["Framework", "Library", "Language", "Database"], correctIndex: 1 },
            { question: "What is used to pass data to components?", options: ["State", "Props", "Variables", "Functions"], correctIndex: 1 },
          ],
        },
      },
    ],
  },
};

async function seed() {
  const { initFirestore } = await import('../server/firestore.js');
  const fs = await initFirestore();
  if (!fs) { console.error('Firestore not available. Set FIREBASE_SERVICE_ACCOUNT env var.'); process.exit(1); }

  console.log('Seeding courses...');
  await fs.collection('courses').doc('_all').set({ list: COURSES, updatedAt: new Date().toISOString() }, { merge: true });
  console.log(`✓ ${COURSES.length} courses saved`);

  for (const [courseId, content] of Object.entries(COURSE_CONTENT)) {
    await fs.collection('courseContent').doc(courseId).set(content, { merge: true });
    console.log(`✓ Content for "${courseId}" saved`);
  }

  console.log('Done! All courses seeded.');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
