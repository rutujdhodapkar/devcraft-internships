const NVDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID;

const TEMPLATES = [
  "Join DEV/CRAFT and kickstart your career with hands-on virtual internships. Gain real-world skills, work on real projects, and earn verified completion certificates! 🚀\n\n#VirtualInternship #DEVRAFT #CareerGrowth #TechSkills #Internships",

  "Ready to level up? DEV/CRAFT offers free virtual internships with industry-relevant projects and verified completion certificates. No experience required — just your drive to learn!\n\n#FreeInternship #DEVRAFT #LearnToCode #CareerDevelopment #Tech",

  "Your dream internship is just a click away! Explore DEV/CRAFT's free virtual programs and build skills that matter. Work on real projects, get mentorship, and stand out to employers.\n\n#Internship #DEVRAFT #TechCareers #SkillBuilding #FutureOfWork",

  "No experience? No problem. DEV/CRAFT provides structured virtual internships with mentorship, real-world projects, and verified certificates. Start your journey today!\n\n#NoExperience #DEVRAFT #VirtualInternship #TechJobs #CareerGrowth",

  "💡 Did you know? 80% of employers value project-based learning over degrees. DEV/CRAFT gives you exactly that — hands-on projects, mentorship, and certificates that prove your skills.\n\n#DEVRAFT #ProjectBasedLearning #TechSkills #CareerAdvice #Internships",

  "The future of work is remote. DEV/CRAFT prepares you for it with virtual internships that mirror real-world workflows. Gain experience from anywhere, at your own pace.\n\n#RemoteWork #DEVRAFT #VirtualInternship #FutureOfWork #TechCareers",

  "Transform your career with DEV/CRAFT. Our alumni have gone on to work at top tech companies — all starting with a free virtual internship. Your journey starts here.\n\n#DEVRAFT #CareerTransformation #TechInternships #SuccessStory #LearnTech",

  "🔥 New month, new opportunities! DEV/CRAFT has fresh internship projects waiting for you. Web dev, AI, data science & more — all free with verified certificates.\n\n#DEVRAFT #NewOpportunities #TechInternships #LearnToCode #CareerGoals",

  "What makes DEV/CRAFT different? Real projects. Real skills. Real certificates. Not just theory — you build, deploy, and showcase. Free for everyone.\n\n#DEVRAFT #LearnByDoing #TechSkills #Internships #CareerGrowth",

  "Employers don't just want degrees — they want proof of skills. DEV/CRAFT's virtual internships give you portfolio-ready projects and verified certificates. Start proving your skills today!\n\n#DEVRAFT #SkillsOverDegrees #TechCareers #Portfolio #Internships",
];

async function generateWithNVIDIA() {
  if (!NVDIA_API_KEY) return null;
  const topics = [
    "Write an inspiring LinkedIn post about DEV/CRAFT virtual internships helping students gain real-world skills. 3-4 sentences. Add 3-5 hashtags.",
    "Write a LinkedIn post about the benefits of project-based learning through DEV/CRAFT internships. 3-4 sentences. Add 3-5 hashtags.",
    "Write a LinkedIn post encouraging students to try free virtual internships at DEV/CRAFT. Highlight real projects and certificates. 3-4 sentences. Add 3-5 hashtags.",
  ];
  const prompt = topics[new Date().getDay() % topics.length];

  try {
    const res = await fetch("https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/df0415a4-069e-4022-a9d3-88a0cf2f0016", {
      method: "POST",
      headers: { Authorization: `Bearer ${NVDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

async function postToLinkedIn(text) {
  console.log(`[DailyPost] Posting to LinkedIn...`);

  let author;
  if (LINKEDIN_PERSON_ID) {
    author = `urn:li:person:${LINKEDIN_PERSON_ID}`;
  } else {
    const me = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${LINKEDIN_TOKEN}` },
    });
    const meData = await me.json();
    if (!me.ok) throw new Error(`LinkedIn auth: ${meData.message || meData.error_description}`);
    author = `urn:li:person:${meData.sub}`;
  }

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINKEDIN_TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn API error: ${data.message || JSON.stringify(data)}`);
  console.log(`[DailyPost] Posted! ID: ${data.id}`);
  return data;
}

async function main() {
  console.log(`[DailyPost] Starting daily LinkedIn post at ${new Date().toISOString()}`);

  if (!LINKEDIN_TOKEN) throw new Error("LINKEDIN_ACCESS_TOKEN not set");

  let content = await generateWithNVIDIA();
  if (content) {
    console.log(`[DailyPost] Generated with NVIDIA AI`);
  } else {
    const idx = new Date().getDate() % TEMPLATES.length;
    content = TEMPLATES[idx];
    console.log(`[DailyPost] Using template #${idx}`);
  }

  console.log(`[DailyPost] Content:\n${content}\n`);
  const result = await postToLinkedIn(content);
  console.log(`[DailyPost] Done! ${result.id}`);
}

main().catch((err) => {
  console.error(`[DailyPost] FAILED: ${err.message}`);
  process.exit(1);
});
