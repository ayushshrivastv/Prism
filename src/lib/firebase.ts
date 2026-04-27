"use client";

import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBnLuUtdlzHppwjE_zywPGEiR6TIFTyRww",
  authDomain: "prism-e363a.firebaseapp.com",
  projectId: "prism-e363a",
  storageBucket: "prism-e363a.firebasestorage.app",
  messagingSenderId: "1001469744389",
  appId: "1:1001469744389:web:8ce4acf8ab65a8dd5a536c",
  measurementId: "G-TFCNJJHGEZ",
};

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleAuthProvider = new GoogleAuthProvider();

googleAuthProvider.setCustomParameters({
  prompt: "select_account",
});

let analyticsPromise: Promise<Analytics | null> | null = null;

export function loadFirebaseAnalytics() {
  if (typeof window === "undefined") {
    return Promise.resolve<Analytics | null>(null);
  }

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
    .catch(() => null);

  return analyticsPromise;
}
