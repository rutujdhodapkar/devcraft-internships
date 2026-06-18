import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "login-data-680b9.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "login-data-680b9",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const API_BASE = import.meta.env.VITE_SERVER_URL || "";

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  if (!text || !text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export const isFirebaseConfigured = true;

export async function fetchCurrentUser() {
  const data = await apiFetch("/api/auth/me");
  return data?.user || null;
}

export async function signInWithGoogle(redirectTo = "/") {
  try {
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    const data = await apiFetch("/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    if (data?.success) {
      if (redirectTo && redirectTo !== "/") {
        window.location.href = redirectTo;
      } else {
        window.location.reload();
      }
    }
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      console.error("Sign-in error:", err.message);
    }
  }
}

export async function signOutUser() {
  await auth.signOut();
  await apiFetch("/api/auth/logout", { method: "POST" });
}

export default { fetchCurrentUser, signInWithGoogle, signOutUser, isFirebaseConfigured };