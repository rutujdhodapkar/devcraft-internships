import admin from 'firebase-admin';
import { CONFIG } from './config.js';

let rtdbApp = null;
let fsApp = null;

function getServiceAccount() {
  const raw = CONFIG.rtdb.serviceAccount || CONFIG.firestore.privateKey
    ? JSON.stringify({
        type: 'service_account',
        project_id: CONFIG.firestore.projectId,
        private_key_id: 'auto',
        private_key: CONFIG.firestore.privateKey,
        client_email: CONFIG.firestore.clientEmail,
        client_id: 'auto',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(CONFIG.firestore.clientEmail)}`,
      })
    : null;
  if (raw) return JSON.parse(raw);
  const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (envKey) {
    const json = envKey.trim().startsWith('{') ? envKey : Buffer.from(envKey, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    return parsed;
  }
  return null;
}

export function getRTDB() {
  if (rtdbApp) return admin.database(rtdbApp);
  const sa = getServiceAccount();
  if (!sa && !process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    throw new Error('No service account available for RTDB');
  }
  rtdbApp = admin.initializeApp(
    { databaseURL: CONFIG.rtdb.url, credential: sa ? admin.credential.cert(sa) : undefined },
    'email-rtdb'
  );
  return admin.database(rtdbApp);
}

export function getFirestore() {
  if (fsApp) return admin.firestore(fsApp);
  const sa = getServiceAccount();
  if (!sa) throw new Error('No service account available for Firestore');
  fsApp = admin.initializeApp(
    { projectId: CONFIG.firestore.projectId, credential: admin.credential.cert(sa) },
    'email-fs'
  );
  return admin.firestore(fsApp);
}

export async function rtdbGet(path) {
  const db = getRTDB();
  const snap = await db.ref(path).once('value');
  return snap.val();
}

export async function rtdbSet(path, data) {
  const db = getRTDB();
  await db.ref(path).set(data);
}

export async function rtdbUpdate(path, data) {
  const db = getRTDB();
  await db.ref(path).update(data);
}

export async function rtdbPush(path, data) {
  const db = getRTDB();
  const ref = db.ref(path).push();
  await ref.set(data);
  return ref.key;
}

export async function rtdbDelete(path) {
  const db = getRTDB();
  await db.ref(path).remove();
}

export async function rtdbQuery(path, orderBy, equalTo) {
  const db = getRTDB();
  let ref = db.ref(path);
  if (orderBy) ref = ref.orderByChild(orderBy);
  if (equalTo !== undefined) ref = ref.equalTo(equalTo);
  const snap = await ref.once('value');
  return snap.val();
}
