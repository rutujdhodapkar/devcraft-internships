const NVDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const LI_AT = process.env.LI_AT;
const JSESSIONID = process.env.JSESSIONID;

const TEMPLATES = [
  "Join DEV/CRAFT and kickstart your career with hands-on virtual internships. Gain real-world skills, work on real projects, and earn verified completion certificates! 🚀\n\n#VirtualInternship #DEVRAFT #CareerGrowth #TechSkills #Internships",
  "Ready to level up? DEV/CRAFT offers free virtual internships with industry-relevant projects and verified completion certificates. No experience required!\n\n#FreeInternship #DEVRAFT #LearnToCode #CareerDevelopment #Tech",
  "Your dream internship is just a click away! Explore DEV/CRAFT's free virtual programs and build skills that matter.\n\n#Internship #DEVRAFT #TechCareers #SkillBuilding #FutureOfWork",
  "No experience? No problem. DEV/CRAFT provides structured virtual internships with mentorship, real-world projects, and verified certificates.\n\n#NoExperience #DEVRAFT #VirtualInternship #TechJobs #CareerGrowth",
  "The future of work is remote. DEV/CRAFT prepares you with virtual internships that mirror real-world workflows. Gain experience from anywhere.\n\n#RemoteWork #DEVRAFT #VirtualInternship #FutureOfWork #TechCareers",
  "Employers don't just want degrees — they want proof of skills. DEV/CRAFT's virtual internships give you portfolio-ready projects and verified certificates.\n\n#DEVRAFT #SkillsOverDegrees #TechCareers #Portfolio #Internships",
  "Transform your career with DEV/CRAFT. Our alumni have gone on to work at top tech companies — all starting with a free virtual internship.\n\n#DEVRAFT #CareerTransformation #TechInternships #SuccessStory #LearnTech",
  "🔥 New month, new opportunities! DEV/CRAFT has fresh internship projects waiting for you. Web dev, AI, data science & more — all free with verified certificates.\n\n#DEVRAFT #NewOpportunities #TechInternships #LearnToCode #CareerGoals",
];

async function generateWithNVIDIA() {
  if (!NVDIA_API_KEY) return null;
  const topics = [
    "Write an inspiring LinkedIn post about DEV/CRAFT virtual internships helping students gain real-world skills. 3-4 sentences. Add 3-5 hashtags.",
    "Write a LinkedIn post about the benefits of project-based learning through DEV/CRAFT internships. 3-4 sentences. Add 3-5 hashtags.",
    "Write a LinkedIn post encouraging students to try free virtual internships at DEV/CRAFT. 3-4 sentences. Add 3-5 hashtags.",
  ];
  const prompt = topics[new Date().getDay() % topics.length];
  try {
    const res = await fetch("https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/df0415a4-069e-4022-a9d3-88a0cf2f0016", {
      method: "POST",
      headers: { Authorization: `Bearer ${NVDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8, max_tokens: 500,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

function getCsrfToken() {
  if (!JSESSIONID) return null;
  const raw = JSESSIONID.replace(/^"|"$/g, '');
  return raw.startsWith('ajax:') ? raw : `ajax:${raw}`;
}

async function postViaInternalApi(text) {
  console.log(`[DailyPost] Posting via internal LinkedIn API...`);
  const csrf = getCsrfToken();
  if (!csrf) throw new Error("JSESSIONID not set");

  const payload = {
    commentary: { text, attributes: [] },
    lifecycleState: "PUBLISHED",
    visibility: { "com.linkedin.quasar.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch("https://www.linkedin.com/voyager/api/feed/updates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `li_at=${LI_AT}; JSESSIONID="${csrf}"`,
      "csrf-token": csrf,
      "x-restli-protocol-version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Internal API error ${res.status}: ${body.substring(0, 200)}`);
  }
  const data = await res.json();
  console.log(`[DailyPost] Posted! Activity URN: ${data.activityUrn || data.id || JSON.stringify(data)}`);
  return data;
}

async function getContent() {
  const ai = await generateWithNVIDIA();
  if (ai) {
    console.log(`[DailyPost] Generated with NVIDIA AI`);
    return ai;
  }
  const idx = new Date().getDate() % TEMPLATES.length;
  console.log(`[DailyPost] Using template #${idx}`);
  return TEMPLATES[idx];
}

async function main() {
  console.log(`[DailyPost] Starting daily LinkedIn post at ${new Date().toISOString()}`);

  if (!LI_AT) throw new Error("LI_AT not set");
  if (!JSESSIONID) throw new Error("JSESSIONID not set");

  const content = await getContent();
  console.log(`[DailyPost] Content:\n${content}\n`);
  await postViaInternalApi(content);
  console.log(`[DailyPost] Done!`);
}

main().catch((err) => {
  console.error(`[DailyPost] FAILED: ${err.message}`);
  process.exit(1);
});
