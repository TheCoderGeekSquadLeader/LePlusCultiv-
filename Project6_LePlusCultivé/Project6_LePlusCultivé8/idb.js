// --- IndexedDB helper simple (promise-based) ---
const IDB_NAME = 'MatchGenieDB';
const IDB_VERSION = 1;
const IDB_STORES = ['users', 'scores', 'syncQueue'];

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('users')) {
                db.createObjectStore('users', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('scores')) {
                db.createObjectStore('scores', { keyPath: 'id' }); // id = uuid
                db.transaction.objectStore('scores').createIndex('userId', 'userId', { unique: false });
                db.transaction.objectStore('scores').createIndex('timestamp', 'timestamp', { unique: false });
            }
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id' });
                db.transaction.objectStore('syncQueue').createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbPut(storeName, value) {
    return openIDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const r = store.put(value);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    }));
}

function idbGet(storeName, key) {
    return openIDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const r = store.get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    }));
}

function idbDelete(storeName, key) {
    return openIDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const r = store.delete(key);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
    }));
}

function idbGetAll(storeName, indexName = null, query = null) {
    return openIDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const source = indexName ? store.index(indexName) : store;
        const r = source.getAll(query);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    }));
}

window.addEventListener('online', async () => {
    console.info('Back online — starting sync');
    // réinit firebase si nécessaire
    if (firebaseConfig && !gameState.isAuthReady) {
        await initFirebase(); // ton initFirebase doit être idempotent
    }
    await startAutoSync();
    // Mettre à jour UI: recharger leaderboard depuis Firestore
    if (gameState.view !== 'login') renderApp();
});

window.addEventListener('offline', () => {
    console.info('Offline mode active');
    // mettre un drapeau visuel, par ex. une petite icône
});

// Récupérer classement local
async function getLocalLeaderboard(limit = 10) {
    const scores = await idbGetAll('scores');
    // Aggreger par userId : garder le meilleur score par user si tu veux
    const map = new Map();
    for (const s of scores) {
        const prev = map.get(s.userId);
        if (!prev || s.score > prev.score) map.set(s.userId, s);
    }
    const arr = Array.from(map.values()).sort((a,b) => b.score - a.score);
    return arr.slice(0, limit);
}

// Récupérer classement Firestore (si en ligne)
async function getRemoteLeaderboard(limit = 10) {
    if (!gameState.isAuthReady) return [];
    const q = query(getPublicScoresCollectionRef(), orderBy('score', 'desc'), limit(limit));
    const snap = await getDocs(q);
    const arr = [];
    snap.forEach(doc => arr.push(doc.data()));
    return arr;
}

// Fusion / afficher
async function getCombinedLeaderboard(limit = 10) {
    const local = await getLocalLeaderboard(limit);
    if (navigator.onLine && gameState.isAuthReady) {
        const remote = await getRemoteLeaderboard(limit);
        // Option : remote authoritative, else merge unique by userId with highest score
        const map = new Map();
        for (const r of remote) map.set(r.id, r);
        for (const l of local) {
            const existing = map.get(l.userId);
            if (!existing || l.score > existing.score) {
                map.set(l.userId, { id: l.userId, name: '(Local)', score: l.score, timestamp: l.timestamp });
            }
        }
        return Array.from(map.values()).sort((a,b) => b.score - a.score).slice(0, limit);
    } else {
        // offline fallback
        return local.map(s => ({ id: s.userId, name: '(Local)', score: s.score, timestamp: s.timestamp }));
    }
}
