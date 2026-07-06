const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/api/social/linkedin/callback';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';

async function getAuthUrl(state = 'linkedin_auth') {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: LINKEDIN_REDIRECT_URI,
    state,
    scope: 'w_member_social r_liteprofile r_emailaddress openid profile',
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
    redirect_uri: LINKEDIN_REDIRECT_URI,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${error}`);
  }

  return response.json();
}

async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  return response.json();
}

async function getUserProfile(accessToken) {
  const response = await fetch(`${LINKEDIN_API_URL}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Profile fetch failed: ${response.status} - ${error}`);
  }

  return response.json();
}

async function postToLinkedIn(accessToken, postData) {
  const { text, imageUrl, articleUrl } = postData;

  const authorUrn = await getAuthorUrn(accessToken);
  
  const postBody = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: imageUrl ? 'IMAGE' : articleUrl ? 'ARTICLE' : 'NONE',
        media: imageUrl ? [{
          status: 'READY',
          description: { text: '' },
          media: imageUrl,
          title: { text: 'DEV/CRAFT Internship Program' },
        }] : articleUrl ? [{
          status: 'READY',
          originalUrl: articleUrl,
          title: { text: 'DEV/CRAFT - Web Development Internships' },
          description: { text: 'Join our hands-on web development internship program' },
        }] : [],
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const response = await fetch(`${LINKEDIN_API_URL}/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(postBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn post failed: ${response.status} - ${error}`);
  }

  return response.json();
}

async function getAuthorUrn(accessToken) {
  const response = await fetch(`${LINKEDIN_API_URL}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    const profileResp = await fetch(`${LINKEDIN_API_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileResp.json();
    return `urn:li:person:${profile.id}`;
  }
  
  const userinfo = await response.json();
  return `urn:li:person:${userinfo.sub}`;
}

async function uploadImage(accessToken, imageUrl) {
  const registerResponse = await fetch(`${LINKEDIN_API_URL}/assets?action=registerUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: await getAuthorUrn(accessToken),
        serviceRelationships: [{
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent',
        }],
      },
    }),
  });

  if (!registerResponse.ok) {
    throw new Error('Image upload registration failed');
  }

  const { value: uploadData } = await registerResponse.json();
  const uploadUrl = uploadData.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const assetUrn = uploadData.asset;

  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  });

  if (!uploadResponse.ok) {
    throw new Error('Image upload to LinkedIn failed');
  }

  return assetUrn;
}

export {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserProfile,
  postToLinkedIn,
  uploadImage,
  getAuthorUrn,
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI,
};