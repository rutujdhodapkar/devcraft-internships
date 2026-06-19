import admin from 'firebase-admin';

let db = null;

function getDb() {
  if (db) return db;
  if (admin.apps.length) { db = admin.firestore(); return db; }
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) return null;
  try {
    const sa = JSON.parse(Buffer.from(saJson, 'base64').toString());
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    db = admin.firestore();
    return db;
  } catch { return null; }
}

async function verifyToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const resp = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    if (!resp.ok) return null;
    const info = await resp.json();
    return { uid: info.sub, email: info.email };
  } catch { return null; }
}

export default async function handler(req, res) {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Firestore not configured' });

  const user = await verifyToken(req);
  const body = req.body || {};
  const { action, collection, doc, data, queries } = body;
  if (!collection) return res.status(400).json({ error: 'collection required' });

  if (body.authRequired && !user) return res.status(401).json({ error: 'auth required' });

  try {
    switch (action) {
      case 'get': {
        if (doc) {
          const snap = await db.collection(collection).doc(doc).get();
          return res.json({ data: snap.exists ? { id: snap.id, ...snap.data() } : null });
        }
        const snap = await db.collection(collection).get();
        return res.json({ data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
      case 'set': {
        if (!data) return res.status(400).json({ error: 'data required' });
        const ref = doc ? db.collection(collection).doc(doc) : db.collection(collection).doc();
        await ref.set(data);
        return res.json({ data: { id: ref.id, ...data } });
      }
      case 'update': {
        if (!doc || !data) return res.status(400).json({ error: 'doc and data required' });
        await db.collection(collection).doc(doc).set(data, { merge: true });
        return res.json({ success: true });
      }
      case 'push': {
        if (!data) return res.status(400).json({ error: 'data required' });
        const pushRef = await db.collection(collection).add(data);
        return res.json({ data: { id: pushRef.id, ...data } });
      }
      case 'delete': {
        if (!doc) return res.status(400).json({ error: 'doc required' });
        await db.collection(collection).doc(doc).delete();
        return res.json({ success: true });
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
