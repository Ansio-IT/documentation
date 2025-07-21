
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
// import { getAuth, type Auth } from "firebase/auth"; // Uncomment if using Firebase Auth

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Check for essential Firebase configuration variables
if (!apiKey) {
  throw new Error(
    "Firebase API Key is not set. Please check your NEXT_PUBLIC_FIREBASE_API_KEY environment variable in .env.local."
  );
}
if (!databaseURL) {
  throw new Error(
    "Firebase Database URL is not set. Please check your NEXT_PUBLIC_FIREBASE_DATABASE_URL environment variable in .env.local."
  );
}
if (!projectId) {
  throw new Error(
    "Firebase Project ID is not set. Please check your NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable in .env.local."
  );
}

const firebaseConfig = {
  apiKey,
  authDomain,
  databaseURL,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

let app: FirebaseApp;
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} catch (initError) {
  console.error("Firebase initialization error:", initError);
  console.error("Firebase config used for initialization attempt:", firebaseConfig);
  throw new Error(
    `Firebase app initialization failed. This can be due to incorrect or missing Firebase configuration values in your .env.local file. 
    Config used: 
    apiKey: ${firebaseConfig.apiKey ? 'Set' : 'MISSING!'}
    authDomain: ${firebaseConfig.authDomain || 'Not set'}
    databaseURL: ${firebaseConfig.databaseURL || 'MISSING!'}
    projectId: ${firebaseConfig.projectId ? 'Set' : 'MISSING!'}
    storageBucket: ${firebaseConfig.storageBucket || 'Not set'}
    messagingSenderId: ${firebaseConfig.messagingSenderId || 'Not set'}
    appId: ${firebaseConfig.appId || 'Not set'}
    Original error: ${initError instanceof Error ? initError.message : String(initError)}`
  );
}

let db: Database;
try {
  db = getDatabase(app);
} catch (dbError) {
  console.error("Firebase getDatabase error:", dbError);
  const appDatabaseURL = app.options?.databaseURL || "NOT FOUND in initialized app.options";
  const configDatabaseURL = firebaseConfig.databaseURL; // Already checked this is not null/empty
  
  throw new Error(
    `Failed to get Firebase Database instance. This often means the databaseURL is malformed or incorrect.
    URL from initial config (.env.local): '${configDatabaseURL}'
    URL found in initialized app options: '${appDatabaseURL}'
    Please ensure it's a valid Firebase RTDB URL (e.g., https://<project-id>-default-rtdb.firebaseio.com). Verify this value in your Firebase console and in your .env.local file.
    Original error: ${dbError instanceof Error ? dbError.message : String(dbError)}`
  );
}

// const auth: Auth = getAuth(app); // Uncomment if using Firebase Auth

export { app, db /*, auth */ };
