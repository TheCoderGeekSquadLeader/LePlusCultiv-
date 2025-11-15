// db.js

import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getPublicScoresCollectionRef } from "./firebase.js"; // à définir dans firebase.js

let offlineDB;
const DB_NAME = "quiz_offline_db";
const DB_VERSION = 1;

// Ouvre ou crée la base locale
export function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("scores")) {
                db.createObjectStore("scores", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("syncQueue")) {
                db.createObjectStore("syncQueue", { keyPath: "queueId", autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            offlineDB = event.target.result;
            resolve();
        };

        request.onerror = () => reject(request.error);
    });
}

// Sauvegarde locale
export function saveLocalScore(scoreObj) {
    return new Promise((resolve, reject) => {
        const tx = offlineDB.transaction(["scores"], "readwrite");
        if (!scoreObj.id) scoreObj.id = crypto.randomUUID();
        tx.objectStore("scores").put(scoreObj);

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

// Ajoute en file d’attente
export function queueSync(scoreObj) {
    return new Promise((resolve, reject) => {
        const tx = offlineDB.transaction(["syncQueue"], "readwrite");
        tx.objectStore("syncQueue").add(scoreObj);

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

// Lecture file d’attente
export function getAllQueuedScores() {
    return new Promise((resolve, reject) => {
        const tx = offlineDB.transaction("syncQueue", "readonly");
        const req = tx.objectStore("syncQueue").getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

// Nettoyage file
export function clearQueueItem(queueId) {
    return new Promise((resolve, reject) => {
        const tx = offlineDB.transaction("syncQueue", "readwrite");
        tx.objectStore("syncQueue").delete(queueId);

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

// Push vers Firestore
export async function addScoreToFirestore(scoreObj) {
    const ref = doc(getPublicScoresCollectionRef(), scoreObj.userId);
    await setDoc(ref, {
        userId: scoreObj.userId,
        name: (scoreObj.name || '(Sans nom)').trim(),
        score: scoreObj.score,
        timestamp: serverTimestamp()
    }, { merge: true });
}

// Sync automatique
export async function syncOfflineScores(gameState) {
    if (!gameState.isAuthReady) return;

    const queued = await getAllQueuedScores();
    if (!queued.length) return;

    for (const item of queued) {
        try {
            await addScoreToFirestore(item);
            await clearQueueItem(item.queueId);
        } catch (e) {
            console.warn("Sync error → on réessaiera plus tard", e);
            break;
        }
    }
}

// Relance toutes les 10s
setInterval(() => {
    // gameState doit être passé depuis quiz.js
}, 10000);
