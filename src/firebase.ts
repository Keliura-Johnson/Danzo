import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyA58HMW_lNdfK6CSLiJxzQJ3ndii7NY6yk',
  authDomain: 'danzo-23b81.firebaseapp.com',
  projectId: 'danzo-23b81',
  storageBucket: 'danzo-23b81.firebasestorage.app',
  messagingSenderId: '76059606619',
  appId: '1:76059606619:web:c8cfee3033c45fa5ed097e',
});

export const firebaseAuth = getAuth(firebaseApp);
