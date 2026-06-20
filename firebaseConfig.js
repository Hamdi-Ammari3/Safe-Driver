// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: 'AIzaSyAk59700xi8LMAkmkypAD59veIpBNEThhU',
  authDomain: 'sayartech-871ac.firebaseapp.com',
  projectId: 'sayartech-871ac',
  storageBucket: 'sayartech-871ac.appspot.com',
  messagingSenderId: '765625725930',
  appId: '1:1:765625725930:web:cc1f85af0bcbf2e6c83893',
};

// Initialize once
const app = initializeApp(firebaseConfig);

// Export instances
export const DB = getFirestore(app);
export const AUTH = getAuth(app);