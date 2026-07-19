const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "777c3ev3udb0o2";
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.LINKEDIN_REFRESH_TOKEN;
const PERSON_ID = process.env.LINKEDIN_PERSON_ID;
const NVDIA_API_KEY = process.env.NVIDIA_API_KEY || "";

const TEMPLATES = [
  "Join DEV/CRAFT and kickstart your career with hands-on virtual internships. Gain real-world skills, work on real projects, and earn verified completion certificates! 🚀\n\n#VirtualInternship #DEVRAFT #CareerGrowth #TechSkills #Internships",
  "Ready to level up? DEV/CRAFT offers free virtual internships with industry-relevant projects and verified completion certificates. No experience required!\n\n#FreeInternship #DEVRAFT #LearnToCode #CareerDevelopment #Tech",
  "Your dream internship is just a click away! Explore DEV/CRAFT's free virtual programs and build skills that matter.\n\n#Internship #DEVRAFT #TechCareers #SkillBuilding #FutureOfWork",
  "No experience? No problem. DEV/CRAFT provides structured virtual internships with mentorship, real-world projects, and verified certificates.\n\n#NoExperience #DEVRAFT #VirtualInternship #TechJobs #CareerGrowth",
  "The future of work is remote. DEV/CRAFT prepares you with virtual internships that mirror real-world workflows. Gain experience from anywhere.\n\n#RemoteWork #DEVRAFT #VirtualInternship #FutureOfWork #TechCareers",
  "Employers don't just want degrees — they want proof of skills. DEV/CRAFT's virtual internships give you portfolio-ready projects and verified certificates.\n\n#DEVRAFT #SkillsOverDegrees #TechCareers #Portfolio #Internships",
  "Transform your career with DEV/CRAFT. Our alumni have gone on to work at top tech companies — all starting with a free virtual internship.\n\n#DEVRAFT #CareerTransformation #TechInternships #SuccessStory #LearnTech",
  "New month, new opportunities! DEV/CRAFT has fresh internship projects waiting for you. Web dev, AI, data science & more — all free with verified certificates.\n\n#DEVRAFT #NewOpportunities #TechInternships #LearnToCode #CareerGoals",
];

let accessToken = process.env.LINKEDIN_ACCESS_TOKEN;

async function refreshAccessToken() {
  if (!REFRESH_TOKEN) {
    throw new Error("No LINKEDIN_REFRESH_TOKEN set. Run: node scripts/get-linkedin-token.js");
  }
  console.log("[DailyPost] Refreshing access token...");
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  accessToken = data.access_token;
  const newRefresh = data.refresh_token;
  console.log(`[DailyPost] Token refreshed (new refresh: ${newRefresh ? "yes" : "no"})`);
  if (newRefresh) {
    console.log(`[DailyPost] NOTE: New refresh token received. Update secret:`);
    console.log(`  gh secret set LINKEDIN_REFRESH_TOKEN --body "${newRefresh}"`);
    try {
      const { execSync } = await import("child_process");
      execSync(`gh secret set LINKEDIN_REFRESH_TOKEN --body "${newRefresh}"`, { stdio: "pipe" });
      console.log("[DailyPost] GitHub secret updated automatically.");
    } catch {
      console.log("[DailyPost] Could not auto-update GitHub secret (not running in Actions?). Update manually.");
    }
  }
}

function mapVisibility(v) {
  if (v === "CONNECTIONS") return "CONNECTIONS_ONLY";
  return "PUBLIC";
}

async function getAuthor() {
  if (PERSON_ID) return `urn:li:person:${PERSON_ID}`;
  const me = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meData = await me.json();
  if (!me.ok) throw new Error(`LinkedIn auth: ${meData.message || meData.error_description}`);
  return `urn:li:person:${meData.sub}`;
}

async function callLinkedInApi(url, body, headers, retries = 1) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (res.status === 401 && retries > 0) {
    console.log("[DailyPost] Token expired, refreshing and retrying...");
    await refreshAccessToken();
    return callLinkedInApi(url, body, headers, 0);
  }
  const data = res.ok ? await res.json().catch(() => {
    const id = res.headers.get("x-restli-id") || res.headers.get("id") || "";
    return id ? { id } : {};
  }) : await res.json().catch(() => null);
  if (!res.ok) throw new Error(`LinkedIn API error: ${data?.message || data?.error_description || JSON.stringify(data) || `HTTP ${res.status}`}`);
  return data;
}

async function postWithNewApi(author, text, visibility) {
  console.log("[DailyPost] Trying new Posts API (/rest/posts)...");
  return callLinkedInApi("https://api.linkedin.com/rest/posts", {
    author,
    lifecycleState: "PUBLISHED",
    visibility: mapVisibility(visibility),
    commentary: text,
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: []
    },
    isReshareDisabledByAuthor: false,
  }, { "LinkedIn-Version": "202401" });
}

async function postWithOldApi(author, text, visibility) {
  console.log("[DailyPost] Falling back to legacy API (/v2/ugcPosts)...");
  return callLinkedInApi("https://api.linkedin.com/v2/ugcPosts", {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility === "CONNECTIONS" ? "CONNECTIONS_ONLY" : "PUBLIC",
    },
  }, { "X-Restli-Protocol-Version": "2.0.0" });
}

async function postToLinkedIn(text) {
  console.log("[DailyPost] Posting to LinkedIn...");
  const author = await getAuthor();

  try {
    const data = await postWithNewApi(author, text, "PUBLIC");
    console.log(`[DailyPost] Posted! ID: ${data.id || "ok"}`);
    return data;
  } catch (err) {
    console.log(`[DailyPost] New API failed: ${err.message}`);
    console.log("[DailyPost] Falling back to legacy API...");
    const data = await postWithOldApi(author, text, "PUBLIC");
    console.log(`[DailyPost] Posted via legacy API! ID: ${data.id}`);
    return data;
  }
}

async function generateWithNVIDIA() {
  if (!NVDIA_API_KEY) return null;
  const topics = [
    "Write an inspiring LinkedIn post about DEV/CRAFT virtual internships helping students gain real-world skills. 3-4 sentences. Add 3-5 hashtags.",
    "Write a LinkedIn post about the benefits of project-based learning through DEV/CRAFT internships. 3-4 sentences. Add 3-5 hashtags.",
    "Write a LinkedIn post encouraging students to try free virtual internships at DEV/CRAFT. 3-4 sentences. Add 3-5 hashtags.",
  ];
  const prompt = topics[new Date().getDay() % topics.length];
  // Try OpenAI-compatible endpoint first (NVIDIA API), fall back to NVCF
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${NVDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8, max_tokens: 500,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content;
      if (text) return text;
    }
  } catch {}
  // Fall back to NVCF
  try {
    const res = await fetch("https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/df0415a4-069e-4022-a9d3-88a0cf2f0016", {
      method: "POST",
      headers: { Authorization: `Bearer ${NVDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8, max_tokens: 500,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || json.response || json.text || json.content;
      if (text) return text;
    }
  } catch {}
  return null;
}

async function getContent() {
  const ai = await generateWithNVIDIA();
  if (ai) { console.log("[DailyPost] Generated with NVIDIA AI"); return ai; }
  const idx = new Date().getDate() % TEMPLATES.length;
  console.log(`[DailyPost] Using template #${idx}`);
  return TEMPLATES[idx];
}

async function main() {
  console.log(`[DailyPost] Starting daily LinkedIn post at ${new Date().toISOString()}`);
  if (!CLIENT_SECRET) throw new Error("LINKEDIN_CLIENT_SECRET not set");
  if (!accessToken && !REFRESH_TOKEN) throw new Error("Neither LINKEDIN_ACCESS_TOKEN nor LINKEDIN_REFRESH_TOKEN set");

  if (!accessToken) await refreshAccessToken();
  const content = await getContent();
  console.log(`[DailyPost] Content:\n${content}\n`);
  await postToLinkedIn(content);
  console.log("[DailyPost] Done!");
}

main().catch((err) => {
  console.error(`[DailyPost] FAILED: ${err.message}`);
  process.exit(1);
});
