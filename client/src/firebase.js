import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged as firebaseOnAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { setAccessToken } from './services/data';

const firebaseConfig = {
  apiKey: "AIzaSyCn_dJ21ga0CuErOdvnYxO7mwIm9elFie8",
  authDomain: "login-data-680b9.firebaseapp.com",
  projectId: "login-data-680b9",
  storageBucket: "login-data-680b9.firebasestorage.app",
  messagingSenderId: "153701949407",
  appId: "1:153701949407:web:166741a11eb5c58385ae6a",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let currentUser = null;
const listeners = new Set();

function notify(user) {
  currentUser = user;
  setAccessToken(user?.accessToken || null);
  listeners.forEach(fn => { try { fn(user); } catch {} });
}

export function onAuthStateChanged(callback) {
  listeners.add(callback);
  const unsub = firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        notify({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.uid,
          photoURL: firebaseUser.photoURL || '',
          accessToken: token,
        });
      } catch { notify(null); }
    } else {
      notify(null);
    }
  });
  return () => { listeners.delete(callback); unsub(); };
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const token = await result.user.getIdToken();
  setAccessToken(token);
  return result.user;
}

export async function getToken() {
  if (!auth.currentUser) return null;
  try { return await auth.currentUser.getIdToken(); } catch { return null; }
}

export function signOut() {
  firebaseSignOut(auth);
  setAccessToken(null);
}

export const isFirebaseConfigured = true;
