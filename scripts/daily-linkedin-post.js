const NVDIA_API_KEY = process.env.NVIDIA_API_KEY;
const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID;

const TOPICS = [
  "internships",
  "success-stories",
  "tips",
  "industry-news",
  "internships",
  "tips",
  "success-stories",
];

const PROMPTS = {
  "internships": "Write an inspiring LinkedIn post about how virtual internships help students gain real-world skills. Mention DEV/CRAFT. 3-4 sentences. Add 3-5 hashtags like #VirtualInternship #DEVRAFT #CareerGrowth",
  "success-stories": "Write a LinkedIn post about a student who transformed their career through DEV/CRAFT virtual internships. Focus on impact of hands-on experience. 3-4 sentences. Add 3-5 relevant hashtags.",
  "tips": "Write a LinkedIn post with practical tips for breaking into tech. Include value of virtual internships via DEV/CRAFT. 3-4 sentences. Add 3-5 hashtags.",
  "industry-news": "Write a LinkedIn post about the future of remote work and how platforms like DEV/CRAFT are leading virtual internship space. 3-4 sentences. Add 3-5 hashtags.",
};

async function generateContent(dayOfWeek) {
  const topic = TOPICS[dayOfWeek % TOPICS.length];
  const prompt = PROMPTS[topic];

  console.log(`[DailyPost] Generating content for topic: ${topic}`);

  const res = await fetch("https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/baek0be0-04b9-4c0a-b748-0a23a482b475", {
    method: "POST",
    headers: { Authorization: `Bearer ${NVDIA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content generated");
  return content;
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

  if (!NVDIA_API_KEY) throw new Error("NVIDIA_API_KEY not set");
  if (!LINKEDIN_TOKEN) throw new Error("LINKEDIN_ACCESS_TOKEN not set");

  const dayOfWeek = new Date().getDay();
  const content = await generateContent(dayOfWeek);
  console.log(`[DailyPost] Generated:\n${content}\n`);

  const result = await postToLinkedIn(content);
  console.log(`[DailyPost] Done! ${result.id}`);
}

main().catch((err) => {
  console.error(`[DailyPost] FAILED: ${err.message}`);
  process.exit(1);
});
