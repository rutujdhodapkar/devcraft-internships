import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    const content = await fs.readFile(envPath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch {
    // .env is optional in local development
  }
}

await loadEnvFile();
const INQUIRIES_FILE = path.join(__dirname, 'inquiries.json');
const REFERRALS_FILE = path.join(__dirname, 'referrals.json');
const VISITS_FILE = path.join(__dirname, 'referral-visits.json');
const ADMINS_FILE = path.join(__dirname, 'admins.json');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

async function readJson(filePath, fallback = []) {
  try {
    const fileData = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileData);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// In-memory caching for currency exchange rates
let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Helper to get fallback rates in case API is down
const fallbackRates = {
  USD: 1.0,
  INR: 83.5,
  EUR: 0.93,
  GBP: 0.79,
  CAD: 1.37,
  AUD: 1.51,
  JPY: 157.4
};

// Route: Get live currency conversion rates proxy
app.get('/api/rates', async (req, res) => {
  const now = Date.now();
  if (cachedRates && (now - lastFetchTime < CACHE_DURATION)) {
    return res.json({ success: true, rates: cachedRates, source: 'cache' });
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('Failed to fetch from exchange API');
    const data = await response.json();
    
    if (data && data.rates) {
      cachedRates = data.rates;
      lastFetchTime = now;
      return res.json({ success: true, rates: cachedRates, source: 'network' });
    }
  } catch (error) {
    console.error('Error fetching currency rates, using fallback:', error.message);
  }

  // Fallback if network fails
  return res.json({ success: true, rates: fallbackRates, source: 'fallback' });
});

// Route: Save design/development inquiry
app.post('/api/inquire', async (req, res) => {
  const {
    name,
    email,
    phone,
    projectType,
    planTier,
    customSpecs,
    estimatedPrice,
    currency,
    requirements,
    message,
    referralCode,
  } = req.body;

  if (!name || !email || !phone || !projectType || !planTier) {
    return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
  }

  const newInquiry = {
    id: `INQ-${Date.now()}`,
    createdAt: new Date().toISOString(),
    name,
    email,
    phone,
    ...req.body,
    projectType, // 'software' or 'documentation'
    planTier, // 'basic', 'advance', 'pro'
    customSpecs: customSpecs || [],
    estimatedPrice,
    currency: currency || 'USD',
    message: requirements || message || '',
    referralCode: referralCode || '',
    status: req.body.status || 'contacted',
    progress: req.body.progress || 'New request',
  };

  try {
    const inquiries = await readJson(INQUIRIES_FILE);

    inquiries.push(newInquiry);
    await writeJson(INQUIRIES_FILE, inquiries);

    console.log('\n--- NEW INQUIRY RECEIVED ---');
    console.log(`ID: ${newInquiry.id}`);
    console.log(`Client: ${newInquiry.name} (${newInquiry.email})`);
    console.log(`Service: ${newInquiry.projectType.toUpperCase()} - ${newInquiry.planTier.toUpperCase()}`);
    console.log(`Price Est: ${newInquiry.estimatedPrice} ${newInquiry.currency}`);
    console.log(`Phone: ${newInquiry.phone}`);
    console.log(`Specs: ${(newInquiry.customSpecs || []).join(', ') || 'None'}`);
    console.log(`Message: ${newInquiry.message}`);
    console.log('-----------------------------\n');

    return res.status(201).json({ 
      success: true, 
      message: 'Inquiry received successfully! We will contact you soon.',
      inquiryId: newInquiry.id
    });
  } catch (error) {
    console.error('Error saving inquiry:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while saving project inquiry.' });
  }
});

// Get all inquiries (simple dashboard read)
app.get('/api/inquiries', async (req, res) => {
  const inquiries = await readJson(INQUIRIES_FILE);
  res.json({ success: true, data: inquiries });
});

app.get('/api/admin-data', async (req, res) => {
  const [requests, referrals, visits] = await Promise.all([
    readJson(INQUIRIES_FILE),
    readJson(REFERRALS_FILE),
    readJson(VISITS_FILE),
  ]);

  // Sort requests descending by date
  const sortedRequests = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // Sort visits descending by date and limit to 100
  const sortedVisits = [...visits].sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 100);

  res.json({ success: true, data: { requests: sortedRequests, referrals, visits: sortedVisits } });
});

app.post('/api/referrals', async (req, res) => {
  const referrals = await readJson(REFERRALS_FILE);
  const referral = {
    id: req.body.code,
    ...req.body,
    code: req.body.code || `REF-${Date.now().toString(36).toUpperCase()}`,
    visited: req.body.visited || 0,
    contacted: req.body.contacted || 0,
    createdAt: req.body.createdAt || new Date().toISOString(),
  };

  referrals.push(referral);
  await writeJson(REFERRALS_FILE, referrals);
  res.status(201).json({ success: true, data: referral });
});

app.post('/api/referral-visits', async (req, res) => {
  const [referrals, visits] = await Promise.all([
    readJson(REFERRALS_FILE),
    readJson(VISITS_FILE),
  ]);

  const code = String(req.body.referralCode || '').toUpperCase();
  const matchedReferral = referrals.find((item) => String(item.code).toUpperCase() === code);
  const visit = {
    id: `VIS-${Date.now()}`,
    ...req.body,
    referralCode: code,
    matched: Boolean(matchedReferral),
    visitedAt: req.body.visitedAt || new Date().toISOString(),
    action: 'visited',
  };

  visits.push(visit);
  if (matchedReferral) {
    matchedReferral.visited = Number(matchedReferral.visited || 0) + 1;
    matchedReferral.lastVisitedAt = visit.visitedAt;
  }

  await Promise.all([writeJson(VISITS_FILE, visits), writeJson(REFERRALS_FILE, referrals)]);
  res.status(201).json({ success: true, data: visit });
});

app.delete('/api/referrals/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const referrals = await readJson(REFERRALS_FILE);
  const filtered = referrals.filter((item) => String(item.code).toUpperCase() !== code);
  await writeJson(REFERRALS_FILE, filtered);
  res.json({ success: true, message: `Referral ${code} deleted.` });
});

app.delete('/api/inquiries/:id', async (req, res) => {
  const { id } = req.params;
  const inquiries = await readJson(INQUIRIES_FILE);
  const filtered = inquiries.filter((item) => item.id !== id);
  await writeJson(INQUIRIES_FILE, filtered);
  res.json({ success: true, message: `Inquiry ${id} deleted.` });
});

app.post('/api/referrals/:code/contacted', async (req, res) => {
  const referrals = await readJson(REFERRALS_FILE);
  const code = String(req.params.code || '').toUpperCase();
  const matchedReferral = referrals.find((item) => String(item.code).toUpperCase() === code);

  if (matchedReferral) {
    matchedReferral.contacted = Number(matchedReferral.contacted || 0) + 1;
    matchedReferral.lastContactedAt = new Date().toISOString();
    await writeJson(REFERRALS_FILE, referrals);
  }

  res.json({ success: true, data: matchedReferral || null });
});

// Admin management APIs
app.post('/api/check-admin', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email required.' });
  }
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === 'rutujdhodapkar@gmail.com') {
    return res.json({ success: true, isAdmin: true });
  }
  const admins = await readJson(ADMINS_FILE);
  const isAdmin = admins.some(adminEmail => adminEmail.toLowerCase().trim() === cleanEmail);
  return res.json({ success: true, isAdmin });
});

app.get('/api/admins', async (req, res) => {
  const admins = await readJson(ADMINS_FILE);
  return res.json({ success: true, data: admins });
});

app.post('/api/admins', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email required.' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const admins = await readJson(ADMINS_FILE);
  if (!admins.includes(cleanEmail)) {
    admins.push(cleanEmail);
    await writeJson(ADMINS_FILE, admins);
  }
  return res.json({ success: true, data: admins });
});

app.delete('/api/admins/:email', async (req, res) => {
  const { email } = req.params;
  const cleanEmail = email.toLowerCase().trim();
  const admins = await readJson(ADMINS_FILE);
  const updated = admins.filter(adminEmail => adminEmail.toLowerCase().trim() !== cleanEmail);
  await writeJson(ADMINS_FILE, updated);
  return res.json({ success: true, data: updated });
});

// ─── AI Task Verification (NVIDIA API) ─────────────────────────────────────────
app.post('/api/ai/verify-task', async (req, res) => {
  const { taskTitle, taskDescription, submissionText, submissionUrl, internName } = req.body;

  if (!taskTitle || !submissionText) {
    return res.status(400).json({ success: false, message: 'Task title and submission text are required.' });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: 'NVIDIA API key not configured on server.' });
  }

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.3-70b-instruct',
        messages: [
          {
            role: 'system',
            content: `You are an AI internship task verifier. Evaluate the student's project submission against the task requirements.

Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "verified": boolean,
  "confidence": number (0-100),
  "reason": "brief explanation of your decision",
  "message": "constructive feedback for the student; if rejected explain what is missing or wrong, if verified give positive confirmation"
}`
          },
          {
            role: 'user',
            content: `Task Title: ${taskTitle}
Task Description: ${taskDescription || 'No description provided'}
Student Name: ${internName || 'Unknown'}
Student's Submission: ${submissionText}
${submissionUrl ? `Submission URL: ${submissionUrl}` : ''}

Evaluate this submission and respond with JSON only.`
          }
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON in response');
      }
    } catch (parseErr) {
      result = {
        verified: false,
        confidence: 0,
        reason: 'AI response could not be parsed',
        message: 'AI verification failed to produce a clear result. Please review manually.',
      };
    }

    return res.json({ success: true, data: { ...result, rawResponse: content } });
  } catch (error) {
    console.error('AI verification error:', error.message);
    return res.status(500).json({ success: false, message: 'AI verification failed: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
