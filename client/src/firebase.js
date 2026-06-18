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

export function signInWithGoogle(redirectTo = "/") {
  window.location.href = `${API_BASE}/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`;
}

export async function signOutUser() {
  await apiFetch("/api/auth/logout", { method: "POST" });
}

export default { fetchCurrentUser, signInWithGoogle, signOutUser, isFirebaseConfigured };