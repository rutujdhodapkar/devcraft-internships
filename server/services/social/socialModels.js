import { getDb } from '../../cosmos.js';

const COLLECTIONS = {
  SOCIAL_ACCOUNTS: 'socialAccounts',
  SOCIAL_POSTS: 'socialPosts',
  CONTENT_SOURCES: 'contentSources',
  AGENT_CONFIG: 'agentConfig',
};

async function createSocialAccount(accountData) {
  const db = await getDb();
  const id = accountData.id || `linkedin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const account = {
    id,
    platform: 'linkedin',
    accountName: accountData.accountName || 'Default LinkedIn',
    userId: accountData.userId || 'default',
    accessToken: accountData.accessToken,
    refreshToken: accountData.refreshToken,
    tokenExpiresAt: accountData.tokenExpiresAt,
    authorUrn: accountData.authorUrn,
    profileData: accountData.profileData || {},
    isActive: true,
    postingSchedule: accountData.postingSchedule || {
      enabled: true,
      timezone: 'UTC',
      schedule: [
        { day: 1, time: '09:00' },
        { day: 3, time: '14:00' },
        { day: 5, time: '10:00' },
      ],
    },
    contentConfig: accountData.contentConfig || {
      themes: ['webPromotions'],
      templateTypes: ['promotional', 'educational', 'successStory'],
      generateImages: true,
      imageStyle: 'professional tech',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.SOCIAL_ACCOUNTS).doc(id).set(account);
  return account;
}

async function getSocialAccount(accountId) {
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.SOCIAL_ACCOUNTS).doc(accountId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getActiveSocialAccounts() {
  const db = await getDb();
  const snapshot = await db.collection(COLLECTIONS.SOCIAL_ACCOUNTS)
    .where('platform', '==', 'linkedin')
    .where('isActive', '==', true)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function updateSocialAccount(accountId, updates) {
  const db = await getDb();
  await db.collection(COLLECTIONS.SOCIAL_ACCOUNTS).doc(accountId).set({
    ...updates,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return getSocialAccount(accountId);
}

async function updateAccountTokens(accountId, tokens) {
  return updateSocialAccount(accountId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: tokens.expires_at ? new Date(tokens.expires_at).toISOString() : null,
  });
}

async function saveSocialPost(postData) {
  const db = await getDb();
  const id = postData.id || `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const post = {
    id,
    platform: 'linkedin',
    accountId: postData.accountId || 'default',
    text: postData.text,
    imageUrl: postData.imageUrl || null,
    imagePrompt: postData.imagePrompt || null,
    theme: postData.theme,
    templateType: postData.templateType,
    linkedinPostId: postData.linkedinPostId || null,
    status: postData.status || 'draft',
    error: postData.error || null,
    scheduledAt: postData.scheduledAt || null,
    postedAt: postData.postedAt || null,
    createdAt: postData.createdAt || new Date().toISOString(),
    metadata: postData.metadata || {},
  };

  await db.collection(COLLECTIONS.SOCIAL_POSTS).doc(id).set(post);
  return { id, ...post };
}

async function getSocialPosts(filters = {}) {
  const db = await getDb();
  let query = db.collection(COLLECTIONS.SOCIAL_POSTS).where('platform', '==', 'linkedin');
  
  if (filters.accountId) {
    query = query.where('accountId', '==', filters.accountId);
  }
  if (filters.status) {
    query = query.where('status', '==', filters.status);
  }
  
  query = query.orderBy('createdAt', 'desc');
  
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function updatePostStatus(postId, status, updates = {}) {
  const db = await getDb();
  await db.collection(COLLECTIONS.SOCIAL_POSTS).doc(postId).set({
    status,
    ...updates,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return getSocialPost(postId);
}

async function getSocialPost(postId) {
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.SOCIAL_POSTS).doc(postId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function createContentSource(sourceData) {
  const db = await getDb();
  const id = sourceData.id || `source_${Date.now()}`;
  
  const source = {
    id,
    name: sourceData.name,
    type: sourceData.type,
    config: sourceData.config || {},
    isActive: sourceData.isActive !== false,
    lastFetched: source: sourceData.lastFetched || null,
    createdAt: new Date().toISOString(),
  };
  
  await db.collection(COLLECTIONS.CONTENT_SOURCES).doc(id).set(source);
  return source;
}

async function getContentSources() {
  const db = await getDb();
  const snapshot = await db.collection(COLLECTIONS.CONTENT_SOURCES)
    .where('isActive', '==', true)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getAgentConfig() {
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.AGENT_CONFIG).doc('linkedin').get();
  return doc.exists ? doc.data() : getDefaultConfig();
}

async function updateAgentConfig(config) {
  const db = await getDb();
  await db.collection(COLLECTIONS.AGENT_CONFIG).doc('linkedin').set({
    ...config,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return getAgentConfig();
}

function getDefaultConfig() {
  return {
    enabled: true,
    defaultAccountId: 'default',
    postingSchedule: {
      enabled: true,
      timezone: 'UTC',
      schedule: [
        { day: 1, time: '09:00' },
        { day: 3, time: '14:00' },
        { day: 5, time: '10:00' },
      ],
    },
    contentConfig: {
      themes: ['webPromotions'],
      templateTypes: ['promotional', 'educational', 'successStory'],
      weights: { promotional: 0.5, educational: 0.3, successStory: 0.2 },
      generateImages: true,
      imageStyle: 'professional tech illustration',
    },
    safety: {
      maxPostsPerDay: 3,
      minHoursBetweenPosts: 4,
      contentReview: false,
    },
  };
}

export {
  createSocialAccount,
  getSocialAccount,
  getActiveSocialAccounts,
  updateSocialAccount,
  updateAccountTokens,
  saveSocialPost,
  getSocialPosts,
  getSocialPost,
  updatePostStatus,
  createContentSource,
  getContentSources,
  getAgentConfig,
  updateAgentConfig,
  getDefaultConfig,
  COLLECTIONS,
};