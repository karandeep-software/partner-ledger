// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDnZJH_5SHKH8BfBddebSbAfGreH4IfY1o",
  authDomain: "partner-expense-tracker-b625c.firebaseapp.com",
  projectId: "partner-expense-tracker-b625c",
  storageBucket: "partner-expense-tracker-b625c.appspot.com",
  messagingSenderId: "146838171648",
  appId: "1:146838171648:web:6cdf614666fc2cedd9e8e5"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Export services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;

