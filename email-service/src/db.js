import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { CONFIG } from './config.js';

let rtdbApp = null;
let fsApp = null;

function getServiceAccount() {
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
  if (rtdbApp) return getDatabase(rtdbApp);
  rtdbApp = initializeApp({ databaseURL: CONFIG.rtdb.url }, 'email-rtdb');
  return getDatabase(rtdbApp);
}

export function getFirestoreDB() {
  if (fsApp) return getFirestore(fsApp);
  const sa = getServiceAccount();
  if (!sa) throw new Error('No service account available for Firestore');
  fsApp = initializeApp(
    { projectId: CONFIG.firestore.projectId, credential: cert(sa) },
    'email-fs'
  );
  return getFirestore(fsApp);
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
