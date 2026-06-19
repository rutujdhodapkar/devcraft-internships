export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const isFirebaseConfigured = true;

const AUTH_STORAGE_KEY = "devcraft_google_user";

function decodeJwtPayload(token) {
  const [, payload] = String(token || "").split(".");
  if (!payload) throw new Error("Invalid Google credential.");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(normalized));
}

function mapGooglePayload(payload, credential) {
  return {
    uid: payload.sub,
    id: payload.sub,
    email: payload.email || "",
    displayName: payload.name || payload.email || "Google User",
    photoURL: payload.picture || "",
    credential,
  };
}

export function getStoredGoogleUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStoredGoogleUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function signInWithGoogleCredential(credential) {
  const payload = decodeJwtPayload(credential);
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Google login could not be verified.");
  }
  const user = mapGooglePayload(data.user || payload, credential);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent("devcraft-auth", { detail: user }));
  return user;
}

export function onGoogleAuthStateChanged(callback) {
  callback(getStoredGoogleUser());
  const handler = (event) => callback(event.detail || getStoredGoogleUser());
  window.addEventListener("devcraft-auth", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("devcraft-auth", handler);
    window.removeEventListener("storage", handler);
  };
}

export function signOutGoogle() {
  clearStoredGoogleUser();
  window.dispatchEvent(new CustomEvent("devcraft-auth", { detail: null }));
}

export async function openGoogleLogin() {
  if (!googleClientId) {
    throw new Error("Google login is not configured.");
  }
  if (!window.google?.accounts?.id) {
    await new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-google-identity]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load Google login."));
      document.head.appendChild(script);
    });
  }
  return new Promise((resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        try {
          resolve(await signInWithGoogleCredential(response.credential));
        } catch (err) {
          reject(err);
        }
      },
    });
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        reject(new Error("Google login prompt was closed or blocked."));
      }
    });
  });
}

export const auth = null;
export const googleProvider = null;
