// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Config Firebase (injectée ou en dur)
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, db, auth;

/**
 * Initialise Firebase et l’authentification
 */
export async function initFirebase(gameState) {
  try {
    if (firebaseConfig) {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);

      if (initialAuthToken) {
        await signInWithCustomToken(auth, initialAuthToken);
      } else {
        await signInAnonymously(auth);
      }

      gameState.userId = getUserId();
      gameState.isAuthReady = true;
      console.log("Firebase prêt. User ID:", gameState.userId);
    } else {
      console.warn("Firebase config manquante. Mode local uniquement.");
      gameState.isAuthReady = false;
    }
  } catch (error) {
    console.error("Erreur Firebase:", error);
    gameState.isAuthReady = false;
  }
}

/**
 * Retourne l’ID utilisateur
 */
export function getUserId() {
  return auth?.currentUser?.uid || (typeof crypto !== 'undefined' ? crypto.randomUUID() : 'anonymous-' + Math.random().toString(36).substring(2, 9));
}

/**
 * Référence à la collection publique des scores
 */
export function getPublicScoresCollectionRef() {
  return collection(db, 'scores');
}
