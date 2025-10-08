// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC6NFQvNFm7L0QQELeRBAosTghYH4MP-j4",
  authDomain: "managify608.firebaseapp.com",
  projectId: "managify608",
  storageBucket: "managify608.firebasestorage.app",
  messagingSenderId: "1025526399968",
  appId: "1:1025526399968:web:2875d266c2c955cd5be185",
  measurementId: "G-T4KBPT1JLF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const firestore = getFirestore(app);
export { analytics };
export { auth };
export { firestore };
