import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Firebase
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// PWA
import { registerSW } from "virtual:pwa-register";

/* ================= FIREBASE CONFIG ================= */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

/* ================= INITIALIZE FIREBASE ================= */

const app = initializeApp(firebaseConfig);

/* ================= APP CHECK ================= */

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6Lfd5FwsAAAAAAWNCknSN3cQFHxJg20ElgVTY978"),
  isTokenAutoRefreshEnabled: true,
});

/* ================= REGISTER PWA ================= */

registerSW({ immediate: true });

/* ================= RENDER APP ================= */

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
