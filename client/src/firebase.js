import { setAccessToken } from './services/data';

export const isFirebaseConfigured = true;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let currentUser = null;
const listeners = new Set();

export function onAuthStateChanged(callback) {
  listeners.add(callback);
  callback(currentUser);
  return () => listeners.delete(callback);
}

function notifyListeners(user) {
  currentUser = user;
  setAccessToken(user?.accessToken || null);
  listeners.forEach(fn => fn(user));
}

function initGis() {
  if (typeof google === 'undefined' || !google.accounts) {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }
}

export function signInWithGoogle() {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID not configured.'));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error) {
          if (response.error === 'user_cancelled') return;
          reject(new Error(response.error));
          return;
        }
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${response.access_token}` }
        })
          .then(r => r.json())
          .then(info => {
            const user = {
              uid: info.sub,
              email: info.email,
              displayName: info.name,
              photoURL: info.picture,
              emailVerified: info.email_verified,
              accessToken: response.access_token,
              toJSON: () => ({ ...user }),
            };
            notifyListeners(user);
            resolve(user);
          })
          .catch(err => reject(err));
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

export function signOut() {
  if (currentUser?.accessToken && typeof google !== 'undefined' && google.accounts?.oauth2) {
    try { google.accounts.oauth2.revoke(currentUser.accessToken, () => {}); } catch {}
  }
  notifyListeners(null);
}

initGis();
