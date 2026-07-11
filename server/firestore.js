// Firebase Firestore initialization and CRUD.
// Uses FIREBASE_SERVICE_ACCOUNT env (JSON string) or falls back to Cosmos.
// Non-sensitive site config data lives here; user data stays in Cosmos.

let _firestore = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function initFirestore() {
  if (_firestore) return _firestore;
  const sa = getServiceAccount();
  if (!sa) { console.warn('[Firestore] FIREBASE_SERVICE_ACCOUNT not configured'); return null; }
  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(sa) });
    _firestore = getFirestore('intern');
    console.log('[Firestore] Connected');
    return _firestore;
  } catch (e) {
    console.error('[Firestore] Init failed:', e.message);
    return null;
  }
}

export async function firestoreGetDoc(collection, docId) {
  const fs = await initFirestore();
  if (!fs) return null;
  try {
    const snap = await fs.collection(collection).doc(docId).get();
    return snap.exists ? snap.data() : null;
  } catch { return null; }
}

export async function firestoreSetDoc(collection, docId, data) {
  const fs = await initFirestore();
  if (!fs) return null;
  try {
    await fs.collection(collection).doc(docId).set(data, { merge: true });
    return data;
  } catch { return null; }
}
