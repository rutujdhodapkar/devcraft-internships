import admin from 'firebase-admin';

let firestore = null;

function initFirestore() {
  if (firestore) return firestore;
  if (admin.apps.length) return admin.firestore();

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    const sa = JSON.parse(Buffer.from(saJson, 'base64').toString());
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    firestore = admin.firestore();
    return firestore;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = initFirestore();
  if (!db) {
    return res.status(503).json({ error: 'Firestore not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON env var.' });
  }

  const { action, collection, doc, data, queries } = req.body || {};
  if (!collection) return res.status(400).json({ error: 'collection required' });

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
        await db.collection(collection).doc(doc).update(data);
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
