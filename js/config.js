// I-paste dito ang Firebase web config mo:
// Firebase Console → Project settings → Your apps → Web app → "SDK setup and configuration".
// Hindi ito sikreto. Ang firestore.rules ang nagbabantay ng data.
export const firebaseConfig = {
  apiKey: 'PASTE_API_KEY',
  authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
  projectId: 'PASTE_PROJECT_ID',
  storageBucket: 'PASTE_PROJECT_ID.appspot.com',
  messagingSenderId: 'PASTE_SENDER_ID',
  appId: 'PASTE_APP_ID',
};

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
