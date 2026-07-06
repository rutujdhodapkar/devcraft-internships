import { generatePostContent, generateImagePrompt, generateImage } from './nvidiaService.js';
import { 
  postToLinkedIn, 
  getValidAccessToken, 
  uploadImage,
  getAuthorUrn 
} from './linkedinService.js';
import { getDb } from '../../cosmos.js';

const CONTENT_THEMES = {
  webPromotions: [
    'Web Development Internship Program - DEV/CRAFT',
    'Full Stack Development Training with Real Projects',
    'React, Node.js, TypeScript Hands-on Learning',
    'Freelancing Skills for Web Developers',
    'Portfolio Building with Client Projects',
    'MERN Stack Mastery Program',
    'Frontend Development with Modern Tools',
    'Backend Development with Node.js & Databases',
  ],
};

const POST_TEMPLATES = {
  promotional: `🚀 {headline}

{body}

🎯 What you'll gain:
{benefits}

🔗 Apply now: {ctaUrl}

#WebDevelopment #Internship #FullStack #React #NodeJS #TypeScript #DEVCRAFT #Freelancing #Portfolio #CareerGrowth`,
  
  educational: `💡 {headline}

{body}

Key takeaways:
{lessons}

💬 What's your experience with this? Comment below!

#WebDevelopment #Learning #Coding #DEVCRAFT #DeveloperJourney`,
  
  successStory: `✨ {headline}

{body}

📈 Results achieved:
{results}

Want similar results? {cta}

#SuccessStory #WebDev #Internship #CareerGrowth #DEVCRAFT`,
};

async function selectTheme() {
  const themes = CONTENT_THEMES.webPromotions;
  return themes[Math.floor(Math.random() * themes.length)];
}

async function generatePostVariation(theme, templateType = 'promotional') {
  const prompt = `Create a LinkedIn post for DEV/CRAFT web development internship program.
  
Theme: ${theme}
Template: ${templateType}

Requirements:
- Professional but engaging tone
- Include relevant hashtags
- Clear call-to-action
- 150-300 words
- Target: Students, aspiring developers, career switchers
- Mention: Real projects, mentorship, portfolio building, job-ready skills

Return JSON with: headline, body, benefits/lessons/results (array), cta, ctaUrl`;

  const content = await generatePostContent(prompt);
  
  let postText;
  const template = POST_TEMPLATES[templateType];
  
  if (templateType === 'promotional') {
    postText = template
      .replace('{headline}', content.headline)
      .replace('{body}', content.body)
      .replace('{benefits}', content.benefits?.map(b => `✅ ${b}`).join('\n') || '')
      .replace('{ctaUrl}', content.ctaUrl || 'https://devcraft.rutujdhodapkar.tech');
  } else if (templateType === 'educational') {
    postText = template
      .replace('{headline}', content.headline)
      .replace('{body}', content.body)
      .replace('{lessons}', content.lessons?.map(l => `• ${l}`).join('\n') || '')
      .replace('{cta}', content.cta || 'Join DEV/CRAFT');
  } else {
    postText = template
      .replace('{headline}', content.headline)
      .replace('{body}', content.body)
      .replace('{results}', content.results?.map(r => `📊 ${r}`).join('\n') || '')
      .replace('{cta}', content.cta || 'Apply at devcraft.rutujdhodapkar.tech');
  }

  return {
    text: postText,
    theme,
    templateType,
    metadata: content,
  };
}

async function createAndPostContent(config = {}) {
  const {
    theme = await selectTheme(),
    templateType = 'promotional',
    generateImage = true,
    imagePrompt: customImagePrompt,
    accountId = 'default',
  } = config;

  try {
    const postData = await generatePostVariation(theme, templateType);
    
    let imageUrl = null;
    if (generateImage) {
      const imagePrompt = customImagePrompt || await generateImagePrompt(postData.text, theme);
      imageUrl = await generateImage(imagePrompt);
      
      if (imageUrl) {
        postData.imageUrl = imageUrl;
        postData.imagePrompt = imagePrompt;
      }
    }

    const accessToken = await getValidAccessToken(accountId);
    
    let mediaUrn = null;
    if (imageUrl) {
      mediaUrn = await uploadImage(accessToken, imageUrl);
    }

    const result = await postToLinkedIn(accessToken, postData.text, mediaUrn);

    await savePostRecord({
      ...postData,
      linkedinPostId: result.id,
      accountId,
      status: 'posted',
      postedAt: new Date().toISOString(),
    });

    return { success: true, post: postData, linkedinResult: result };
  } catch (error) {
    console.error('Agent error:', error);
    await savePostRecord({
      theme,
      templateType,
      status: 'failed',
      error: error.message,
      createdAt: new Date().toISOString(),
    });
    return { success: false, error: error.message };
  }
}

async function savePostRecord(postData) {
  try {
    const db = await getDb();
    await db.collection('socialPosts').add({
      ...postData,
      platform: 'linkedin',
      createdAt: postData.createdAt || new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to save post record:', e);
  }
}

async function getPostHistory(limit = 20) {
  const db = await getDb();
  const snapshot = await db.collection('socialPosts')
    .where('platform', '==', 'linkedin')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getAccountStatus(accountId = 'default') {
  try {
    const accessToken = await getValidAccessToken(accountId);
    const profile = await getUserProfile(accessToken);
    return { connected: true, profile };
  } catch (e) {
    return { connected: false, error: e.message };
  }
}

export {
  createAndPostContent,
  generatePostVariation,
  getPostHistory,
  getAccountStatus,
  CONTENT_THEMES,
  POST_TEMPLATES,
};