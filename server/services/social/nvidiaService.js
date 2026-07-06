const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

const TEXT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
const IMAGE_MODEL = 'qwen-image-edit-nvpcb-ovsl2sl';

async function generateText(prompt, options = {}) {
  const {
    temperature = 0.7,
    maxTokens = 1500,
    systemPrompt = 'You are an expert social media content creator for a web development internship platform.'
  } = options;

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA Text API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function generateImage(prompt, options = {}) {
  const {
    width = 1024,
    height = 1024,
    steps = 30,
    guidanceScale = 7.5,
    seed = -1,
  } = options;

  const response = await fetch(`${NVIDIA_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      width,
      height,
      steps,
      guidance_scale: guidanceScale,
      seed,
      n: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA Image API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data?.[0]?.url || data.images?.[0]?.url || null;
}

async function generateLinkedInPost(websiteData, customPrompt = '') {
  const systemPrompt = `You are an expert LinkedIn content creator for DEV/CRAFT - a web development internship platform.
  
Platform details:
- Website: ${websiteData.url}
- Focus: ${websiteData.focus}
- Target audience: ${websiteData.audience}
- Key offerings: ${websiteData.offerings.join(', ')}
- Unique value: ${websiteData.uniqueValue}

Create engaging, professional LinkedIn posts that:
1. Promote internship opportunities
2. Highlight student success stories
3. Showcase learning outcomes
4. Drive traffic to the website
5. Use relevant hashtags (3-5)
6. Include a clear call-to-action
7. Are 150-300 words
8. Professional but approachable tone`;

  const prompt = customPrompt || `Create a LinkedIn post promoting our web development internship program. 
Focus on: ${websiteData.currentFocus || 'new cohort starting soon'}
Key message: ${websiteData.keyMessage || 'Hands-on real projects, mentorship, career growth'}

Include:
- Hook in first line
- Value proposition
- Social proof element
- Clear CTA with website link
- 3-5 relevant hashtags`;

  return generateText(prompt, { systemPrompt, temperature: 0.8, maxTokens: 1000 });
}

async function generateImagePrompt(postContent, style = 'professional tech') {
  const prompt = `Create a professional LinkedIn post image for a web development internship platform.
Style: ${style}
Content theme: ${postContent.substring(0, 200)}
Requirements:
- Modern, clean design
- Tech/development aesthetic
- Include subtle branding elements
- Professional color scheme (blues, purples, whites)
- Text-safe areas for overlay
- 1024x1024 aspect ratio`;
  
  return prompt;
}

export {
  generateText,
  generateImage,
  generateLinkedInPost,
  generateImagePrompt,
  NVIDIA_API_KEY,
  TEXT_MODEL,
  IMAGE_MODEL,
};