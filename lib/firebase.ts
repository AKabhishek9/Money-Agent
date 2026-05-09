import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  type Firestore, 
  memoryLocalCache, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';

const requiredEnvVars = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Fail loudly in development if any env var is missing
if (process.env.NODE_ENV !== 'production') {
  Object.entries(requiredEnvVars).forEach(([key, value]) => {
    if (!value) {
      throw new Error(
        `Missing Firebase environment variable: NEXT_PUBLIC_FIREBASE_${key.toUpperCase()}. ` +
        `Check your .env.local file.`
      );
    }
  });
}

const firebaseConfig = requiredEnvVars;

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);

// Use initializeFirestore with explicit cache settings
// We use memoryLocalCache for development to avoid persistence issues and "offline" hangs
if (process.env.NODE_ENV !== 'production') {
  console.log('Initializing Firebase for project:', firebaseConfig.projectId);
}

const db: Firestore = initializeFirestore(app, {
  localCache: memoryLocalCache(), 
  // Standard settings are usually faster if network allows
});

if (process.env.NODE_ENV !== 'production') {
  console.log('Firestore initialized with memory cache.');
}

export { auth, db };
export default app;
