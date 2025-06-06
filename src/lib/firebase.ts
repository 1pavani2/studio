
// ================================================================================================
// !! CRITICAL !! YOU MUST CONFIGURE FIREBASE HERE !! CRITICAL !!
//
// Replace the placeholder values below with your actual Firebase project's configuration.
// You can find these details in your Firebase project settings:
// 1. Go to https://console.firebase.google.com/
// 2. Select your project (or create one).
// 3. Go to Project settings (click the gear icon next to Project Overview).
// 4. In the "General" tab, under "Your apps", find your web app (or add one if you haven't).
// 5. Firebase will provide you with a `firebaseConfig` object. Use those values here.
//
// THE ERROR "Cannot parse Firebase url" MEANS THE `databaseURL` BELOW IS WRONG.
// ================================================================================================

import { initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

// IMPORTANT: Replace these with your actual Firebase project configuration!
// You can find these details in your Firebase project settings.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_MUST_BE_REPLACED", // Found in Project settings > General
  authDomain: "YOUR_AUTH_DOMAIN_MUST_BE_REPLACED", // Found in Project settings > General
  // CRITICAL: Replace "MUST_REPLACE_WITH_YOUR_REAL_FIREBASE_DATABASE_URL" with your actual Firebase Realtime Database URL.
  // It usually looks like: https://<YOUR-PROJECT-ID>.firebaseio.com or https://<YOUR-PROJECT-ID>-default-rtdb.<REGION>.firebasedatabase.app
  // The error "Cannot parse Firebase url" specifically means this value is incorrect or missing.
  // Double-check this value in your Firebase project console (Realtime Database section).
  databaseURL: "MUST_REPLACE_WITH_YOUR_REAL_FIREBASE_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID_MUST_BE_REPLACED", // Found in Project settings > General
  storageBucket: "YOUR_STORAGE_BUCKET_MUST_BE_REPLACED", // Found in Project settings > General
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_MUST_BE_REPLACED", // Found in Project settings > Cloud Messaging
  appId: "YOUR_APP_ID_MUST_BE_REPLACED" // Found in Project settings > General
};

// CRITICAL CHECK FOR PLACEHOLDER VALUES:
if (
  firebaseConfig.apiKey === "YOUR_API_KEY_MUST_BE_REPLACED" ||
  firebaseConfig.authDomain === "YOUR_AUTH_DOMAIN_MUST_BE_REPLACED" ||
  firebaseConfig.databaseURL === "MUST_REPLACE_WITH_YOUR_REAL_FIREBASE_DATABASE_URL" ||
  firebaseConfig.projectId === "YOUR_PROJECT_ID_MUST_BE_REPLACED" ||
  firebaseConfig.storageBucket === "YOUR_STORAGE_BUCKET_MUST_BE_REPLACED" ||
  firebaseConfig.messagingSenderId === "YOUR_MESSAGING_SENDER_ID_MUST_BE_REPLACED" ||
  firebaseConfig.appId === "YOUR_APP_ID_MUST_BE_REPLACED"
) {
  const errorMessage = `
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
CRITICAL FIREBASE CONFIGURATION ERROR IN: src/lib/firebase.ts

You MUST replace the placeholder values (e.g., "YOUR_API_KEY_MUST_BE_REPLACED", 
"MUST_REPLACE_WITH_YOUR_REAL_FIREBASE_DATABASE_URL") in the 'firebaseConfig' 
object with your actual Firebase project configuration.

Current values being used:
  - apiKey: "${firebaseConfig.apiKey}"
  - authDomain: "${firebaseConfig.authDomain}"
  - databaseURL: "${firebaseConfig.databaseURL}" <--- THIS IS VERY LIKELY THE CAUSE OF THE "Cannot parse Firebase url" ERROR.
  - projectId: "${firebaseConfig.projectId}"
  - storageBucket: "${firebaseConfig.storageBucket}"
  - messagingSenderId: "${firebaseConfig.messagingSenderId}"
  - appId: "${firebaseConfig.appId}"

Please:
1. Go to your Firebase project console: https://console.firebase.google.com/
2. Select your project.
3. Go to Project Settings (gear icon).
4. Under the "General" tab, find your web app (or add one).
5. Copy the configuration values and paste them into the 'firebaseConfig' object in src/lib/firebase.ts.
   Ensure the 'databaseURL' is the correct URL for your Realtime Database.

The application will NOT work until these are correctly set.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`;
  console.error(errorMessage);
  // This error will stop the app from trying to initialize Firebase with incorrect details.
  throw new Error("Firebase configuration is incomplete. Please check console for details and update src/lib/firebase.ts");
}


let app: FirebaseApp;
let db: Database;

try {
  // Attempt to get the already initialized app, if it exists (e.g., during HMR)
  app = getApp();
} catch (e) {
  // Initialize Firebase if it hasn't been initialized yet
  // This will fail if firebaseConfig is not correctly populated.
  app = initializeApp(firebaseConfig);
}

// Get a reference to the database service
// This line will specifically fail and cause the "Cannot parse Firebase url" error
// if 'databaseURL' in firebaseConfig is incorrect or still a placeholder,
// even if it somehow bypassed the explicit check above (e.g., if only part of the placeholder was present).
db = getDatabase(app);

export { db, app };

