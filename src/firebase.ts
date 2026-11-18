import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDlDQ1soF-0Fx9ENPWFR3DdQVJatStlm0Q',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'danzo-23b81.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'danzo-23b81',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'danzo-23b81.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '76059606619',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:76059606619:web:c8cfee3033c45fa5ed097e',
};

const firebaseApp = initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
