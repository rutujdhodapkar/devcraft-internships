import { setAccessToken } from './services/data';

let currentUser = null;
const listeners = new Set();

export function onAuthStateChanged(callback) {
  listeners.add(callback);
  callback(currentUser);
  return () => listeners.delete(callback);
}

function notify(user) {
  currentUser = user;
  setAccessToken(user?.accessToken || null);
  listeners.forEach(fn => fn(user));
}

// Watch Clerk auth state via polling (window.Clerk is set by ClerkProvider)
let clerkCheck = null;
function startClerkWatch() {
  if (clerkCheck) return;
  clerkCheck = setInterval(async () => {
    const c = window.Clerk;
    if (!c || !c.client) return;
    if (!c.user) { if (currentUser) notify(null); return; }
    const session = c.session;
    if (!session) { if (currentUser) notify(null); return; }
    try {
      const token = await session.getToken();
      const user = {
        uid: c.user.id,
        email: c.user.primaryEmailAddress?.emailAddress || '',
        displayName: c.user.fullName || c.user.id,
        photoURL: c.user.imageUrl || '',
        accessToken: token,
        toJSON: () => ({ ...c.user }),
      };
      if (!currentUser || currentUser.uid !== user.uid) notify(user);
    } catch { if (currentUser) notify(null); }
  }, 500);
}

export async function getToken() {
  try {
    if (window.Clerk?.session) return await window.Clerk.session.getToken();
  } catch {}
  return null;
}

export function signOut() {
  window.Clerk?.signOut();
  notify(null);
}

startClerkWatch();
