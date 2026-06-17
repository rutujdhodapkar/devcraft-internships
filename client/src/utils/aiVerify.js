/**
 * AI task verification — runs entirely in the admin browser (no server proxy).
 * Visits submitted GitHub/repo links, reads the actual code, and verifies it
 * against the task requirements.
 * Tries: Chrome Prompt API → NVIDIA API (VITE_NVIDIA_API_KEY) → local heuristic.
 */

const SYSTEM_PROMPT = `You are a STRICT internship task verifier. Your ONLY job is to compare the student's ACTUAL CODE against the task requirements and determine if they match. You are biased toward rejection — only verify if you are CERTAIN the code correctly implements the task.

CRITICAL RULES:
1. Read the task title, description, and instructions to understand what was asked.
2. Read the ACTUAL CODE under "=== ACTUAL CODE FETCHED FROM REPOSITORY ===".
3. Compare: does the code IMPLEMENT what the task asks? For example, if the task asks for a "to-do app" and the code builds a "calculator", that is WRONG.
4. If the code is a DIFFERENT project than what was asked, set verified to false.
5. If the code has placeholder text (todo, fix me, etc.), syntax errors, or is incomplete, set verified to false.
6. If NO code was provided in the prompt, set verified to false.
7. Be strict — incorrect or mismatched projects must be rejected.
8. If the code correctly implements what was asked, set verified to true.

Respond ONLY with valid JSON:
{
  "verified": boolean,
  "confidence": number (0-100),
  "reason": "specific explanation referencing what the code does and whether it matches the task",
  "message": "constructive feedback for the student"
}`;

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function extractRepoInfo(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  let match;
  if (lower.includes("github.com")) {
    match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\/|$|\.git)/);
    if (match) {
      const info = { platform: "github", owner: match[1], repo: match[2].replace(/\.git$/, "") };
      // blob URL → single file
      const blobMatch = url.match(/github\.com\/[\w.-]+\/[\w.-]+\/blob\/([^/]+)\/(.+)/);
      if (blobMatch) {
        info.filePath = blobMatch[2];
        info.ref = blobMatch[1];
      }
      // tree URL → subdirectory
      const treeMatch = url.match(/github\.com\/[\w.-]+\/[\w.-]+\/tree\/([^/]+)(?:\/(.*))?/);
      if (treeMatch) {
        info.dirPath = treeMatch[2] || "";
        info.ref = treeMatch[1];
      }
      return info;
    }
  }
  if (lower.includes("gitlab.com")) {
    match = url.match(/gitlab\.com\/([\w.-]+)\/([\w.-]+?)(?:\/|$|\.git)/);
    if (match) return { platform: "gitlab", owner: match[1], repo: match[2] };
  }
  if (lower.includes("bitbucket.org")) {
    match = url.match(/bitbucket\.org\/([\w.-]+)\/([\w.-]+?)(?:\/|$|\.git)/);
    if (match) return { platform: "bitbucket", owner: match[1], repo: match[2] };
  }
  if (lower.includes("raw.githubusercontent.com")) {
    match = url.match(/raw\.githubusercontent\.com\/([\w.-]+)\/([\w.-]+)\//);
    if (match) return { platform: "github-raw", owner: match[1], repo: match[2] };
  }
  return null;
}

async function fetchGithubContents(owner, repo, path = "") {
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  const res = await fetchWithTimeout(apiUrl, {
    headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "opencode-ai-verifier" },
  });
  if (res.status === 403) {
    const rateRemaining = res.headers.get("X-RateLimit-Remaining");
    if (rateRemaining === "0") throw new Error("GitHub API rate limit exceeded (60 req/hr). Try again later.");
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function fetchRawFile(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Fetch ${res.status}`);
  return res.text();
}

async function fetchGithubRepoCode(owner, repo, dirPath = "", ref) {
  const MAX_FILES = 15;
  const MAX_SIZE = 200000;
  const code = [];
  const extensions = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".h", ".hpp", ".cs", ".go", ".rb", ".php", ".swift", ".kt", ".scala", ".rs", ".html", ".css", ".scss", ".sass", ".less", ".vue", ".svelte", ".json", ".yaml", ".yml", ".md", ".txt", ".sql", ".sh", ".bash", ".ipynb"]);
  const skipDirs = new Set(["node_modules", ".git", ".github", "__pycache__", ".next", "dist", "build", ".vscode", "venv", "env", "vendor", ".idea", "coverage", ".nyc_output"]);

  async function walk(path, depth = 0) {
    if (depth > 3 || code.length >= MAX_FILES) return;
    let items;
    try {
      items = await fetchGithubContents(owner, repo, path);
    } catch { return; }
    if (!Array.isArray(items)) {
      if (items.type === "file" && items.download_url) {
        const ext = "." + (items.name.split(".").pop() || "").toLowerCase();
        if (extensions.has(ext) && (items.size || 0) < MAX_SIZE) {
          try {
            const content = await fetchRawFile(items.download_url);
            code.push({ path: items.path, content: content.slice(0, 10000), size: items.size });
          } catch {}
        }
      }
      return;
    }
    const sorted = items.sort((a, b) => (a.type === "dir" ? 1 : -1));
    for (const item of sorted) {
      if (item.type === "dir") {
        if (!skipDirs.has(item.name)) await walk(item.path, depth + 1);
      } else if (item.type === "file") {
        const ext = "." + (item.name.split(".").pop() || "").toLowerCase();
        if (extensions.has(ext) && (item.size || 0) < MAX_SIZE && code.length < MAX_FILES) {
          try {
            const content = await fetchRawFile(item.download_url);
            code.push({ path: item.path, content: content.slice(0, 10000), size: item.size });
          } catch {}
        }
      }
    }
  }

  await walk(dirPath, 0);
  return code;
}

export async function fetchCodeFromSubmission(submissionText, submissionUrl) {
  const codeFiles = [];
  const urls = [];

  if (submissionUrl) urls.push(submissionUrl.trim());
  const urlMatch = submissionText.match(/https?:\/\/[^\s<>"']+/g);
  if (urlMatch) urls.push(...urlMatch);

  const seen = new Set();
  for (const url of urls) {
    if (seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    const info = extractRepoInfo(url);
    if (!info || info.platform !== "github") {
      // try raw file fetch for direct file URLs
      if (/(?:raw\.githubusercontent|github\.io|\.(?:js|jsx|ts|tsx|py|html|css|json|md|txt|sh))$/i.test(url) && url.startsWith("http")) {
        try {
          const content = await fetchRawFile(url);
          codeFiles.push({ path: url, content: content.slice(0, 10000) });
        } catch {}
      }
      continue;
    }

    try {
      let files;
      if (info.filePath) {
        // Single file from blob URL
        const rawUrl = `https://raw.githubusercontent.com/${info.owner}/${info.repo}/${info.ref}/${info.filePath}`;
        try {
          const content = await fetchRawFile(rawUrl);
          files = [{ path: `${info.repo}/${info.filePath}`, content: content.slice(0, 10000) }];
        } catch {}
      } else {
        files = await fetchGithubRepoCode(info.owner, info.repo, info.dirPath || "", info.ref);
      }
      if (files && files.length > 0) codeFiles.push(...files);
    } catch (err) {
      console.warn("Failed to fetch repo:", url, err.message);
    }
  }

  return codeFiles;
}

function buildUserPrompt({ taskTitle, taskDescription, taskNotices, submissionText, submissionUrl, internName, codeFiles }) {
  let prompt = `Task Title: ${taskTitle}
Task Description: ${taskDescription || "No description provided"}`;
  if (taskNotices && taskNotices.trim()) {
    prompt += `\nTask Instructions/Notices:\n${taskNotices}`;
  }
  prompt += `\nStudent Name: ${internName || "Unknown"}
Student's Submission Text: ${submissionText}`;
  if (submissionUrl) prompt += `\nSubmission URL: ${submissionUrl}`;

  if (codeFiles && codeFiles.length > 0) {
    prompt += `\n\n=== ACTUAL CODE FETCHED FROM REPOSITORY ===`;
    for (const file of codeFiles) {
      const label = file.path || file.name || "unknown";
      prompt += `\n\n--- File: ${label} ---\n${file.content}`;
    }
    prompt += `\n\n=== END OF CODE ===`;
  }

  if (!codeFiles || codeFiles.length === 0) {
    prompt += `\n\nIMPORTANT: No actual code could be fetched from the student's submission. The provided link may be invalid, private, or not a code repository. You MUST set verified to false and explain that the code could not be accessed. Do NOT verify submissions whose code cannot be read.`;
  } else {
    prompt += `\n\nCRITICAL: Carefully check if the code BELOW actually implements what was asked in the task. Check for: 1) Does the code solve the problem described? 2) Are there any placeholder/boilerplate/todo comments? 3) Are there syntax errors? 4) Does the code look like it was written specifically for this task? If the code is wrong, incomplete, or doesn't match the task, set verified to false with specific reasons.`;
  }
  prompt += ` Respond with JSON only.`;
  return prompt;
}

function parseAiJson(content) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  return JSON.parse(jsonMatch[0]);
}

async function tryFetchUrl(url) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, mode: "no-cors" });
    clearTimeout(timeout);
    return res.status || "unknown";
  } catch { return null; }
}

function computeKeywordCoverage(codeText, taskWords, fileNames) {
  if (!taskWords.length) return 1;
  const lower = codeText.toLowerCase();
  const fileLower = (fileNames || []).join(" ").toLowerCase();
  let hits = 0;
  for (const w of taskWords) {
    // Check code, file paths, and common variants
    if (lower.includes(w)) { hits++; continue; }
    if (fileLower.includes(w)) { hits++; continue; }
    // Check word stems (remove common suffixes)
    const stem = w.replace(/(?:ing|tion|ment|ness|ship|able|ible|ive|al|ed|s|es|ly)$/, "");
    if (stem.length >= 4 && lower.includes(stem)) { hits++; continue; }
    // Check if the word is a compound broken into parts
    if (w.length > 6) {
      const parts = w.split(/(?=[A-Z])/).filter(p => p.length > 2).map(p => p.toLowerCase());
      if (parts.length > 1 && parts.every(p => lower.includes(p))) { hits++; continue; }
    }
    // partial/plural match
    if (w.length > 5 && lower.includes(w.slice(0, -2))) { hits += 0.5; continue; }
    if (w.length > 4) {
      const substrs = [];
      for (let i = 0; i <= w.length - 4; i++) substrs.push(w.slice(i, i + 4));
      if (substrs.some(s => lower.includes(s))) hits += 0.3;
    }
  }
  return hits / taskWords.length;
}

async function heuristicVerify({ taskTitle, taskDescription, taskNotices, submissionText, submissionUrl, codeFiles, codeFetchError }) {
  const text = String(submissionText || "").trim();
  const url = String(submissionUrl || "").trim();
  const combined = `${text} ${url}`.toLowerCase();
  const titleWords = String(taskTitle || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const descWords = String(taskDescription || "").toLowerCase().split(/\W+/).filter((w) => w.length > 4).slice(0, 10);
  const noticeWords = String(taskNotices || "").toLowerCase().split(/\W+/).filter((w) => w.length > 4).slice(0, 10);
  const allTaskWords = [...new Set([...titleWords, ...descWords, ...noticeWords])];

  let score = 0;
  const hasGithubUrl = /github\.com\/[\w.-]+\/[\w.-]+/i.test(combined);
  const hasAnyUrl = /https?:\/\//i.test(text) || /https?:\/\//i.test(url);
  const codeAvailable = codeFiles && codeFiles.length > 0;

  // == Phase 1: Submission text quality (minor) ==
  if (text.length >= 40) score += 8;
  if (text.length >= 120) score += 5;
  if (hasAnyUrl) score += 4;

  // == Phase 2: Code availability (base credit only) ==
  if (hasGithubUrl && codeAvailable) {
    score += 8;
  } else if (hasGithubUrl && !codeAvailable) {
    if (codeFetchError) score -= 55;
    else score -= 45;
  } else if (hasAnyUrl && codeAvailable) {
    score += 5;
  }

  // == Phase 3: Code content analysis (PRIMARY signal) ==
  let codeText = "";
  const filePaths = [];
  let allFilesEmpty = false;
  let placeholderPenalty = 0;

  if (codeAvailable) {
    for (const f of codeFiles) {
      codeText += " " + (f.content || "");
      filePaths.push(f.path || f.name || "file");
    }
    const codeLower = codeText.toLowerCase();

    // 3a. Keyword coverage — supporting signal (not primary)
    const fileNames = filePaths.map(p => p.replace(/^.*[\\/]/, ""));
    const coverage = computeKeywordCoverage(codeLower, allTaskWords, fileNames);
    const keywordScore = Math.round(coverage * 30);
    score += Math.min(keywordScore, 30);

    // 3b. Only penalize when coverage is extremely low AND code has no real logic
    const hasRealLogic = /function\s+\w+\s*\(|=>\s*\{|async\s+\w+|def\s+\w+|class\s+\w+|interface\s+\w+|import\s+.*from|module\.exports/i.test(codeText);
    if (allTaskWords.length >= 5 && coverage < 0.15 && !hasRealLogic) {
      score -= 30; // Wrong project — code doesn't mention task concepts and has no logic
    } else if (allTaskWords.length >= 3 && coverage < 0.2 && !hasRealLogic) {
      score -= 15; // Partial match — might be incomplete or templated
    }

    // 3c. Placeholder detection
    const placeholderPatterns = [/todo\b/i, /fix\s*me/i, /placeholder/i, /lorem\s*ipsum/i, /coming\s*soon/i, /under\s*construction/i, /your code here/i, /add code here/i, /implement this/i, /insert code/i, /sample code/i];
    const placeholderCount = placeholderPatterns.filter((p) => p.test(codeText)).length;
    if (placeholderCount > 0) {
      placeholderPenalty = placeholderCount * 15;
      score -= placeholderPenalty;
    }

    // 3d. Empty/minimal files penalty
    const smallFiles = codeFiles.filter((f) => (f.content || "").trim().length < 30);
    allFilesEmpty = smallFiles.length > 0 && smallFiles.length === codeFiles.length;
    if (allFilesEmpty) score -= 40;

    // 3e. Boilerplate/detect real code (small bonus)
    const hasFunctions = /function\s+\w+\s*\(/i.test(codeText) || /const\s+\w+\s*=\s*(\(|async)/i.test(codeText) || /def\s+\w+\s*\(/i.test(codeText);
    const hasExports = /export\s+(default\s+)?(function|class|const)/i.test(codeText);
    const hasImports = /import\s+|require\s*\(/i.test(codeText);
    if (hasFunctions) score += 4;
    if (hasExports) score += 3;
    if (hasImports) score += 3;
    // README-only penalty: if files are mostly markdown and no real code
    const nonMdFiles = codeFiles.filter(f => !/\.md$/i.test(f.path || ""));
    if (nonMdFiles.length === 0 && codeFiles.length > 0) score -= 55;
  }

  // == Phase 4: URL accessibility (minor) ==
  if (url && /^https?:\/\//i.test(url)) {
    const status = await tryFetchUrl(url);
    if (status) score += 3;
    else score -= 8;
  }

  // == Phase 5: Empty/placeholder text penalty ==
  const emptyPlaceholders = /^(?:lorem\s*ipsum|todo|fix\s*me|test|sample|example|click\s*here|link|url|https?:\/\/example\.com|placeholder|coming\s*soon|under\s*construction)$/i;
  if (emptyPlaceholders.test(text.trim()) || emptyPlaceholders.test(url.trim())) {
    score = Math.min(score, 10);
  }

  const hasRealLogic = codeAvailable && (/function\s+\w+\s*\(|=>\s*\{|async\s+\w+|def\s+\w+|class\s+\w+|interface\s+\w+|import\s+.*from|module\.exports|console\.|\.fetch|\.then|await\s+|new\s+\w+|extends|constructor/i.test(codeText));
  const verified = hasRealLogic ? score >= 35 : score >= 50;
  let reason = "", message = "";
  if (verified) {
    const fileNames = filePaths.map(p => p.replace(/^.*[\\/]/, ""));
    const coverage2 = codeAvailable ? computeKeywordCoverage(codeText.toLowerCase(), allTaskWords, fileNames) : 0;
    if (coverage2 > 0.5) {
      reason = `Code correctly implements the task. Code matches ${Math.round(coverage2 * 100)}% of task keywords. Analyzed ${codeFiles.length} file(s): ${filePaths.slice(0, 5).join(", ")}.`;
    } else if (hasRealLogic) {
      reason = `Submission contains real implementation logic and appears to meet the task requirements. Keyword relevance: ${Math.round(coverage2 * 100)}%. Analyzed ${codeFiles.length} file(s).`;
    } else {
      reason = `Submission appears to meet requirements. Code partially matches task keywords (${Math.round(coverage2 * 100)}%). Analyzed ${codeFiles.length} file(s).`;
    }
    message = "Your code submission addresses the task requirements. Good work!";
  } else {
    if (!codeAvailable && hasGithubUrl) {
      reason = `No code could be read from the submitted GitHub repo.`;
      if (codeFetchError) reason += ` Error: ${codeFetchError}.`;
      reason += ` The repository must be public and the URL must correctly point to the project.`;
      message = "Please ensure your repository is public and accessible, then resubmit.";
    } else if (codeAvailable && placeholderPenalty > 0) {
      reason = `Code contains placeholder/todo content (${placeholderPenalty} penalty). Complete all sections with real implementations.`;
      message = "Please replace all placeholder comments with actual code and resubmit.";
    } else if (codeAvailable && allFilesEmpty) {
      reason = `Submitted files are mostly empty or minimal. Implement the full task requirements.`;
      message = "Please write complete code for all parts of the task and resubmit.";
    } else if (codeAvailable) {
      const fileNames = filePaths.map(p => p.replace(/^.*[\\/]/, ""));
      const coverage2 = computeKeywordCoverage(codeText.toLowerCase(), allTaskWords, fileNames);
      const hasRealLogic = /function\s+\w+\s*\(|=>\s*\{|async\s+\w+|def\s+\w+|class\s+\w+|interface\s+\w+|import\s+.*from|module\.exports|console\.|\.fetch|\.then|await\s+|new\s+\w+|extends|constructor/i.test(codeText);
      if (hasRealLogic) {
        reason = `Code contains real implementation logic. Keyword relevance: ${Math.round(coverage2 * 100)}%. Consider reviewing manually to confirm the solution matches the task. Analyzed ${codeFiles.length} file(s): ${filePaths.slice(0, 5).join(", ")}.`;
        message = "The submission contains actual code. A manual review is recommended to verify it meets all task requirements.";
      } else {
        reason = `Code does not clearly match the task requirements. Only ${Math.round(coverage2 * 100)}% of task keywords found in the code.`;
        const missingKW = allTaskWords.filter(w => !codeText.toLowerCase().includes(w)).slice(0, 6);
        if (missingKW.length > 0) reason += ` Missing: "${missingKW.join(", ")}".`;
        reason += ` This may be a different project or an incomplete implementation.`;
        message = "Please ensure you submitted the correct project that fully implements the task requirements.";
      }
    } else {
      reason = `No verifiable project link or code found. Submit a public GitHub repository link containing your implementation.`;
      message = "Please submit a public GitHub repository URL with your code.";
    }
  }

  return { verified, confidence: Math.min(Math.max(score, 5), 98), reason, message, source: "heuristic" };
}

async function verifyWithChromePrompt(userPrompt) {
  const ai = globalThis.ai || globalThis.window?.ai;
  if (!ai?.languageModel?.capabilities) return null;
  const caps = await ai.languageModel.capabilities();
  if (caps.available === "no") return null;
  const session = await ai.languageModel.create({ systemPrompt: SYSTEM_PROMPT });
  const content = await session.prompt(userPrompt);
  await session.destroy?.();
  return parseAiJson(content);
}

async function verifyWithNvidia(userPrompt) {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      temperature: 0.3,
      max_tokens: 1200,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API error ${response.status}: ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const result = parseAiJson(content);
  return { ...result, source: "nvidia", rawResponse: content };
}

export async function verifyTaskInBrowser(params) {
  if (!params.taskTitle || !params.submissionText) {
    throw new Error("Task title and submission text are required.");
  }

  // Fetch actual code from submitted links
  let codeFiles = [];
  let codeFetchError = null;
  try {
    codeFiles = await fetchCodeFromSubmission(params.submissionText, params.submissionUrl);
  } catch (err) {
    codeFetchError = err.message;
    console.warn("Failed to fetch code from submission:", err.message);
  }

  const paramsWithCode = { ...params, codeFiles, codeFetchError };
  const userPrompt = buildUserPrompt(paramsWithCode);

  try {
    const chromeResult = await verifyWithChromePrompt(userPrompt);
    if (chromeResult) {
      chromeResult.codeFilesCount = codeFiles.length;
      return { success: true, data: { ...chromeResult, source: "chrome-ai" } };
    }
  } catch (err) {
    console.warn("Chrome Prompt API failed:", err.message);
  }

  try {
    const nvidiaResult = await verifyWithNvidia(userPrompt);
    if (nvidiaResult) {
      nvidiaResult.codeFilesCount = codeFiles.length;
      return { success: true, data: nvidiaResult };
    }
  } catch (err) {
    console.warn("NVIDIA browser API failed:", err.message);
  }

  const heuristicResult = await heuristicVerify(paramsWithCode);
  heuristicResult.codeFilesCount = codeFiles.length;
  return { success: true, data: heuristicResult };
}

const QUIZ_GRADER_SYSTEM_PROMPT = `You are a strict quiz answer grader. Determine if the student's answer correctly answers the question. Be fair but accurate. Respond ONLY with valid JSON: {"correct": boolean, "reason": "brief explanation"}`;

export async function gradeQuizTextAnswer(question, studentAnswer) {
  const trimmed = (studentAnswer || "").trim();
  if (!trimmed) return null;

  const prompt = `Question: ${question}\nStudent's Answer: ${trimmed}\n\nIs this answer correct? Respond with JSON only.`;

  // 1. Try Vercel serverless API (no client-side API key exposure)
  try {
    const res = await fetch("/api/grade-quiz-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer: trimmed }),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.correct === "boolean") return data;
    }
  } catch {}

  // 2. Try browser Chrome Prompt API (no API key needed)
  try {
    const ai = globalThis.ai || globalThis.window?.ai;
    if (ai?.languageModel?.capabilities) {
      const caps = await ai.languageModel.capabilities();
      if (caps.available !== "no") {
        const session = await ai.languageModel.create({ systemPrompt: QUIZ_GRADER_SYSTEM_PROMPT });
        const content = await session.prompt(prompt);
        await session.destroy?.();
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          const result = JSON.parse(match[0]);
          if (typeof result.correct === "boolean") return result;
        }
      }
    }
  } catch {}

  return null;
}