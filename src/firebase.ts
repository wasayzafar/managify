import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC6NFQvNFm7L0QQELeRBAosTghYH4MP-j4",
  authDomain: "managify608.firebaseapp.com",
  projectId: "managify608",
  storageBucket: "managify608.firebasestorage.app",
  messagingSenderId: "1025526399968",
  appId: "1:1025526399968:web:2875d266c2c955cd5be185",
  measurementId: "G-T4KBPT1JLF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Analytics is non-critical and sends its own network requests, so it starts
// after the first paint instead of blocking it.
export function initAnalyticsWhenIdle() {
  const start = () => import("firebase/analytics").then(({ getAnalytics }) => getAnalytics(app));
  if ("requestIdleCallback" in window) window.requestIdleCallback(() => { start() });
  else setTimeout(start, 2000);
}

export { auth };
