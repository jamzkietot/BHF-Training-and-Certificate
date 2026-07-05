// Firebase initialization — Auth + Firestore
// This file is imported by script.js (import { auth, db } from "./firebase-init.js")
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxE70xqGTnc-x_RkiKsO45nJaB0vH6mBU",
  authDomain: "bhf-training-and-certificate.firebaseapp.com",
  projectId: "bhf-training-and-certificate",
  storageBucket: "bhf-training-and-certificate.firebasestorage.app",
  messagingSenderId: "89264993031",
  appId: "1:89264993031:web:ac8b00e52be68d61dccba2",
  measurementId: "G-01JJF242FH"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics only works in supported browser contexts; guard it so it never
// throws or blocks the rest of the app from loading.
isSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch(() => {});
