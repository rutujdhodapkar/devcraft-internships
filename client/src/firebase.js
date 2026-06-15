import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://login-data-680b9-default-rtdb.firebaseio.com',
};

export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.databaseURL);

let rtdb = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  rtdb = getDatabase(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

// Keep db as alias for backward compat with AuthPage (it uses db for Firestore setDoc)
// We'll handle Firestore separately in AuthPage — for everything else use rtdb
export { rtdb, auth, googleProvider };

// Legacy export so AuthPage still compiles — we'll migrate it to RTDB too
export const db = null;
