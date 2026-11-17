// I-paste dito ang Firebase web config mo:
// Firebase Console → Project settings → Your apps → Web app → "SDK setup and configuration".
// Hindi ito sikreto. Ang firestore.rules ang nagbabantay ng data.
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8bsM5viVneVb5YkcXY0zG5J25WJrWpjQ",
  authDomain: "app-vault-f8624.firebaseapp.com",
  databaseURL: "https://app-vault-f8624-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "app-vault-f8624",
  storageBucket: "app-vault-f8624.firebasestorage.app",
  messagingSenderId: "880830010053",
  appId: "1:880830010053:web:8f312e7128e509130b96ac"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const VERSION = '1.2.1';

export const OPTIONS = {
  // Dapat naka-ON ito kung naka-ON din ang 2FA check sa firestore.rules (tingnan ang README).
  require2FA: true,
  issuer: 'App Vault',
  // Kinakalimutan ng app ang team passphrase pagkatapos ng ilang minutong walang galaw.
  idleKeyLockMinutes: 10,
  // Sine-sign out ka pagkatapos ng ilang minutong walang galaw. 0 = huwag.
  idleSignOutMinutes: 30,
  // Binubura sa clipboard ang kinopyang password pagkatapos ng ilang segundo.
  clipboardClearSeconds: 30,
  // Pinakamalaking file na pwedeng i-upload (KB). Naka-save sa Firestore, hindi sa Storage.
  maxFileKB: 600,
};

export const isConfigured = () =>
  !/PASTE/.test(firebaseConfig.apiKey) && !/PASTE/.test(firebaseConfig.projectId);
