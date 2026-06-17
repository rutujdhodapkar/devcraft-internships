const SYSTEM_PROMPT = `You are a strict quiz answer grader. Determine if the student's answer correctly answers the question. Be fair but accurate. Respond ONLY with valid JSON: {"correct": boolean, "reason": "brief explanation"}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question, answer } = req.body || {};
  if (!question || !answer) {
    return res.status(400).json({ error: "Missing question or answer" });
  }

  const trimmed = String(answer).trim();
  if (!trimmed) {
    return res.status(400).json({ correct: false, reason: "Empty answer" });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI grading not configured" });
  }

  try {
    const prompt = `Question: ${question}\nStudent's Answer: ${trimmed}\n\nIs this answer correct? Respond with JSON only.`;

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `AI service error: ${response.status}`, detail: errText.slice(0, 200) });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(502).json({ error: "Invalid AI response format", raw: content.slice(0, 200) });
    }

    const result = JSON.parse(match[0]);
    if (typeof result.correct !== "boolean") {
      return res.status(502).json({ error: "AI response missing correct field", raw: result });
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
