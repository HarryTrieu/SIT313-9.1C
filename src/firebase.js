// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDC467rbs1K1dImuNtfwDnXZL-iHbi64G4",
  authDomain: "findquestionpage-b2e64.firebaseapp.com",
  projectId: "findquestionpage-b2e64",
  storageBucket: "findquestionpage-b2e64.appspot.com", // fixed: was missing ".com"
  messagingSenderId: "483072813109",
  appId: "1:483072813109:web:d5b48ca864ebe95044297c",
  measurementId: "G-B500WM9RNP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firestore & Storage
export const db = getFirestore(app);
export const storage = getStorage(app);
