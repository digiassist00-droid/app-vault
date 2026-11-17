// Isang lugar lang ang version ng Firebase SDK. Palitan ang numero dito kung gusto mong mag-upgrade.
import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendEmailVerification, sendPasswordResetEmail, updateProfile,
  getMultiFactorResolver, multiFactor, TotpMultiFactorGenerator,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc,
  getDoc, writeBatch, serverTimestamp, query, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, getMultiFactorResolver,
  multiFactor, TotpMultiFactorGenerator,
  collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, getDoc, writeBatch,
  serverTimestamp, query, orderBy, limit,
};
