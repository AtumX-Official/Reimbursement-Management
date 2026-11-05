import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBUGDXWBa8d2oW4BoPBSthtaAI6aer7dIM',
  authDomain: 'reimbursement-77ee0.firebaseapp.com',
  projectId: 'reimbursement-77ee0',
  storageBucket: 'reimbursement-77ee0.firebasestorage.app',
  messagingSenderId: '711224054632',
  appId: '1:711224054632:web:813f4dfac33aa272dd7cdd',
  measurementId: 'G-61N3LSSPC0',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Analytics is unavailable in some browsers/environments, so only start it when supported.
isSupported().then((ok) => {
  if (ok) getAnalytics(app);
});
