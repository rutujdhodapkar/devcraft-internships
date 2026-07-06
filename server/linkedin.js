const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";

export function getAuthUrl() {
  const redirectUri = `${process.env.BASE_URL || ""}/api/linkedin/callback`;
  return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=w_member_social%20r_liteprofile`;
}

let _tokenStore = {};

export function setStoredToken(tokenData) {
  _tokenStore = tokenData;
}

export function getStoredToken() {
  return _tokenStore;
}

export async function handleCallback(code) {
  const redirectUri = `${process.env.BASE_URL || ""}/api/linkedin/callback`;
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || "LinkedIn auth failed");
  _tokenStore = { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + (json.expires_in || 86400) * 1000 };
  return _tokenStore;
}

async function getAccessToken() {
  if (!_tokenStore.accessToken) return null;
  if (Date.now() < _tokenStore.expiresAt) return _tokenStore.accessToken;
  if (_tokenStore.refreshToken) {
    const redirectUri = `${process.env.BASE_URL || ""}/api/linkedin/callback`;
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: _tokenStore.refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      _tokenStore = { accessToken: json.access_token, refreshToken: json.refresh_token || _tokenStore.refreshToken, expiresAt: Date.now() + (json.expires_in || 86400) * 1000 };
      return _tokenStore.accessToken;
    }
  }
  return null;
}

export async function postToLinkedIn(text, imageBase64) {
  const token = await getAccessToken();
  if (!token) throw new Error("LinkedIn not authenticated. Set up LinkedIn app first.");

  let mediaUrn = null;
  if (imageBase64) {
    const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: "urn:li:person:current_user",
          serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
        },
      }),
    });
    if (registerRes.ok) {
      const regJson = await registerRes.json();
      const uploadUrl = regJson.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
      const asset = regJson.value?.asset;
      if (uploadUrl && asset) {
        const imgBuffer = Buffer.from(imageBase64, "base64");
        await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: imgBuffer });
        mediaUrn = asset;
      }
    }
  }

  const postBody = {
    author: "urn:li:person:current_user",
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: mediaUrn ? "IMAGE" : "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  if (mediaUrn) {
    postBody.specificContent["com.linkedin.ugc.ShareContent"].media = [{ status: "READY", media: mediaUrn }];
  }

  const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
    body: JSON.stringify(postBody),
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    throw new Error(`LinkedIn post failed: ${err}`);
  }

  return await postRes.json();
}
