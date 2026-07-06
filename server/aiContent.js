const NVDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVDIA_BASE = "https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions";

export async function generateText(prompt) {
  if (!NVDIA_API_KEY) return fallbackText();
  try {
    const res = await fetch(`${NVDIA_BASE}/baek0be0-04b9-4c0a-b748-0a23a482b475`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${NVDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 500,
      }),
    });
    if (!res.ok) { const t = await res.text(); console.error("[NVIDIA]", t); return fallbackText(); }
    const json = await res.json();
    return json.choices?.[0]?.message?.content || fallbackText();
  } catch (e) {
    console.error("[NVIDIA]", e.message);
    return fallbackText();
  }
}

function fallbackText() {
  const templates = [
    "Join DEV/CRAFT and kickstart your career with hands-on virtual internships. Gain real-world skills, work on projects, and earn verified certificates!",
    "Ready to level up? DEV/CRAFT offers free virtual internships with industry-relevant projects and verified completion certificates.",
    "Your dream internship is just a click away! Explore DEV/CRAFT's free virtual programs and build skills that matter.",
    "No experience? No problem. DEV/CRAFT provides structured virtual internships with mentorship, projects, and certificates.",
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

export async function generateImage(theme) {
  const prompt = encodeURIComponent(`Professional promotional banner for ${theme || "DEV/CRAFT virtual internship program"}, modern design, clean, tech-themed, social media post, 1200x630`);
  try {
    const res = await fetch(`https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&nologo=true`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch {
    return null;
  }
}

export function buildPromoPrompt(enrollmentCount, recentActivity) {
  return `Write a short LinkedIn promotional post (2-3 sentences) for DEV/CRAFT virtual internships. Include: ${enrollmentCount} active interns, ${recentActivity || "new projects completed this week"}. Use an inspiring, professional tone. Add 3-5 relevant hashtags.`;
}
