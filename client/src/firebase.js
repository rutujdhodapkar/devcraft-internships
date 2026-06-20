import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCn_dJ21ga0CuErOdvnYxO7mwIm9elFie8",
  authDomain: "login-data-680b9.firebaseapp.com",
  databaseURL: "https://login-data-680b9-default-rtdb.firebaseio.com",
  projectId: "login-data-680b9",
  storageBucket: "login-data-680b9.firebasestorage.app",
  messagingSenderId: "153701949407",
  appId: "1:153701949407:web:166741a11eb5c58385ae6a",
  measurementId: "G-01L51YR23L"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const googleClientId = "455530891300-dshhdihvkt21jacnh596j8hn6talsg29.apps.googleusercontent.com";
export const isFirebaseConfigured = true;

const AUTH_STORAGE_KEY = "devcraft_google_user";

function mapFirebaseUser(firebaseUser) {
  return {
    uid: firebaseUser.uid,
    id: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName: firebaseUser.displayName || firebaseUser.email || "Google User",
    photoURL: firebaseUser.photoURL || "",
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

function clearStoredGoogleUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function openGoogleLogin() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = mapFirebaseUser(result.user);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent("devcraft-auth", { detail: user }));
  return user;
}

export function onGoogleAuthStateChanged(callback) {
  callback(getStoredGoogleUser());
  const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      const user = mapFirebaseUser(firebaseUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      callback(user);
    } else {
      clearStoredGoogleUser();
      callback(null);
    }
  });
  const handler = (event) => callback(event.detail);
  window.addEventListener("devcraft-auth", handler);
  return () => {
    unsubAuth();
    window.removeEventListener("devcraft-auth", handler);
  };
}

export function signOutGoogle() {
  signOut(auth);
  clearStoredGoogleUser();
  window.dispatchEvent(new CustomEvent("devcraft-auth", { detail: null }));
}

export async function signInWithGoogleCredential(credential) {
  const { GoogleAuthProvider, signInWithCredential } = await import("firebase/auth");
  const cred = GoogleAuthProvider.credential(credential);
  const result = await signInWithCredential(auth, cred);
  const user = mapFirebaseUser(result.user);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent("devcraft-auth", { detail: user }));
  return user;
}
