const ENV = process.env;

export const CONFIG = {
  brevo: {
    apiKey: ENV.BREVO_API_KEY || '',
    apiUrl: 'https://api.brevo.com/v3',
    fromEmail: ENV.FROM_EMAIL || 'support@rutujdhodapkar.tech',
    fromName: ENV.FROM_NAME || 'DEV/CRAFT',
  },

  rtdb: {
    url: ENV.RTDB_URL || 'https://laptop-privacy-default-rtdb.firebaseio.com',
    serviceAccount: ENV.FIREBASE_SERVICE_ACCOUNT_KEY || '',
  },

  firestore: {
    projectId: ENV.FIREBASE_PROJECT_ID || 'laptop-privacy',
    clientEmail: ENV.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (ENV.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    databaseId: ENV.FIRESTORE_DB_ID || 'intern',
  },

  worker: {
    batchSize: parseInt(ENV.WORKER_BATCH_SIZE || '50', 10),
    maxRetries: parseInt(ENV.WORKER_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(ENV.WORKER_RETRY_DELAY_MS || '60000', 10),
    pollIntervalMs: parseInt(ENV.WORKER_POLL_INTERVAL_MS || '5000', 10),
  },

  scheduler: {
    promoIntervalDays: parseInt(ENV.PROMO_INTERVAL_DAYS || '3', 10),
    paymentReminderIntervalDays: parseInt(ENV.PAYMENT_REMINDER_INTERVAL_DAYS || '2', 10),
    expiryGraceDays: parseInt(ENV.EXPIRY_GRACE_DAYS || '0', 10),
    promoDelayAfterExpiryDays: parseInt(ENV.PROMO_DELAY_AFTER_EXPIRY_DAYS || '3', 10),
  },

  domain: ENV.DOMAIN || 'https://devcraft.rutujdhodapkar.tech',
};

export const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  SCHEDULED: 'scheduled',
};

export const CATEGORIES = [
  'welcome', 'payment_pending', 'payment_success', 'payment_failed',
  'task_assigned', 'task_completed', 'task_verified',
  'certificate_ready', 'internship_completed', 'internship_expired',
  'promo', 'reminder', 'announcement', 'system_update', 'custom',
];

export const SEND_ONCE_CATEGORIES = ['welcome', 'certificate_ready', 'internship_completed'];

export const CATEGORY_TRANSITIONS = {
  applied: { next: 'welcome', onComplete: 'payment_pending' },
  payment_pending: {
    allowed: ['payment_pending'],
    onTaskVerified: 'payment_pending',
    onDeadlinePassed: 'internship_expired',
    onPaymentSuccess: 'payment_success',
  },
  payment_success: { onComplete: 'task_assigned' },
  task_assigned: { allowed: ['task_assigned'], onComplete: 'task_completed' },
  task_completed: { allowed: ['task_completed'], onComplete: 'task_verified' },
  task_verified: { allowed: ['task_verified'], next: 'certificate_ready' },
  certificate_ready: { onComplete: 'internship_completed' },
  internship_completed: { onComplete: 'completed' },
  internship_expired: { next: 'promo', onComplete: 'promo' },
  promo: { allowed: ['promo', 'announcement', 'reminder'], repeat: true },
};
