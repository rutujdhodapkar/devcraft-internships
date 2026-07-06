import express from 'express';
import { 
  getAuthUrl, 
  exchangeCodeForTokens, 
  refreshAccessToken,
  getUserProfile,
  getAuthorUrn 
} from '../../services/social/linkedinService.js';
import { 
  createSocialAccount, 
  getSocialAccount, 
  getActiveSocialAccounts,
  updateSocialAccount,
  updateAccountTokens,
  getAgentConfig,
  updateAgentConfig,
} from '../../services/social/socialModels.js';
import { 
  createAndPostContent, 
  getPostHistory, 
  getAccountStatus 
} from '../../services/social/linkedinAgent.js';

const router = express.Router();

router.get('/linkedin/auth', async (req, res) => {
  try {
    const state = req.query.state || `auth_${Date.now()}`;
    const authUrl = await getAuthUrl(state);
    res.json({ success: true, authUrl, state });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?linkedin_error=${error}`);
    }
    
    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?linkedin_error=no_code`);
    }

    const tokens = await exchangeCodeForTokens(code);
    const profile = await getUserProfile(tokens.access_token);
    const authorUrn = await getAuthorUrn(tokens.access_token);

    const expiresAt = tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const account = await createSocialAccount({
      accountName: `${profile.name || 'LinkedIn'} Account`,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
      authorUrn,
      profileData: profile,
    });

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?linkedin_connected=1&accountId=${account.id}`);
  } catch (error) {
    console.error('LinkedIn callback error:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?linkedin_error=callback_failed`);
  }
});

router.post('/linkedin/refresh', async (req, res) => {
  try {
    const { accountId } = req.body;
    const account = await getSocialAccount(accountId);
    
    if (!account || !account.refreshToken) {
      return res.status(400).json({ success: false, message: 'Account not found or no refresh token' });
    }

    const tokens = await refreshAccessToken(account.refreshToken);
    const expiresAt = tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await updateAccountTokens(accountId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || account.refreshToken,
      expires_at: expiresAt,
    });

    res.json({ success: true, message: 'Token refreshed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/accounts', async (req, res) => {
  try {
    const accounts = await getActiveSocialAccounts();
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/accounts/:accountId', async (req, res) => {
  try {
    const account = await getSocialAccount(req.params.accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/accounts/:accountId', async (req, res) => {
  try {
    const { postingSchedule, contentConfig, isActive } = req.body;
    const account = await updateSocialAccount(req.params.accountId, {
      postingSchedule,
      contentConfig,
      isActive,
    });
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/accounts/:accountId', async (req, res) => {
  try {
    await updateSocialAccount(req.params.accountId, { isActive: false });
    res.json({ success: true, message: 'Account deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/post', async (req, res) => {
  try {
    const { 
      accountId = 'default', 
      theme, 
      templateType, 
      generateImage = true,
      customText,
      customImagePrompt,
    } = req.body;

    const result = await createAndPostContent({
      accountId,
      theme,
      templateType,
      generateImage,
      customText,
      customImagePrompt,
    });

    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ success: false, message: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/post/preview', async (req, res) => {
  try {
    const { theme, templateType, generateImage = false } = req.body;
    
    const { generatePostVariation, generateImagePrompt } = await import('../../services/social/linkedinAgent.js');
    
    const postData = await generatePostVariation(theme || 'Web Development Internship Program', templateType || 'promotional');
    
    let imageUrl = null;
    let imagePrompt = null;
    
    if (generateImage) {
      imagePrompt = await generateImagePrompt(postData.text, theme);
      const { generateImage: genImage } = await import('../../services/social/nvidiaService.js');
      imageUrl = await genImage(imagePrompt);
    }

    res.json({ 
      success: true, 
      data: { 
        text: postData.text, 
        imageUrl, 
        imagePrompt,
        theme: postData.theme,
        templateType: postData.templateType,
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/posts', async (req, res) => {
  try {
    const { accountId, status, limit = 20 } = req.query;
    const posts = await getPostHistory(parseInt(limit));
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/posts/:postId', async (req, res) => {
  try {
    const { getSocialPost } = await import('../../services/social/socialModels.js');
    const post = await getSocialPost(req.params.postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/status/:accountId?', async (req, res) => {
  try {
    const accountId = req.params.accountId || 'default';
    const status = await getAccountStatus(accountId);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/config', async (req, res) => {
  try {
    const config = await getAgentConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/config', async (req, res) => {
  try {
    const config = await updateAgentConfig(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/run-agent', async (req, res) => {
  try {
    const { accountId, theme, templateType } = req.body;
    
    const config = await getAgentConfig();
    if (!config.enabled) {
      return res.status(400).json({ success: false, message: 'Agent is disabled' });
    }

    const accounts = accountId 
      ? [await getSocialAccount(accountId)].filter(Boolean)
      : await getActiveSocialAccounts();

    const results = [];
    for (const account of accounts) {
      const result = await createAndPostContent({
        accountId: account.id,
        theme: theme || config.contentConfig.themes[0],
        templateType: templateType || config.contentConfig.templateTypes[0],
      });
      results.push({ accountId: account.id, ...result });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;