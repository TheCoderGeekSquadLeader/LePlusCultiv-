// Nom et version de la base
const IDB_NAME = 'MatchGenieDB';
const IDB_VERSION = 1;

// Ouvrir la base
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Store des scores
      if (!db.objectStoreNames.contains('scores')) {
        db.createObjectStore('scores', { keyPath: 'id' });
      }
      // File d’attente pour synchro
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Ajouter ou mettre à jour une entrée
function idbPut(storeName, value) {
  return openIDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.put(value);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

// Récupérer une entrée par clé
function idbGet(storeName, key) {
  return openIDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

// Supprimer une entrée
function idbDelete(storeName, key) {
  return openIDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  }));
}

// Récupérer toutes les entrées
function idbGetAll(storeName) {
  return openIDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

// Classement local (top N)
async function getLocalLeaderboard(limit = 10) {
  const scores = await idbGetAll('scores');
  const bestByUser = new Map();
  for (const s of scores) {
    const prev = bestByUser.get(s.userId);
    if (!prev || s.score > prev.score) bestByUser.set(s.userId, s);
  }
  return Array.from(bestByUser.values())
    .sort((a,b) => b.score - a.score || (b.timestamp - a.timestamp))
    .slice(0, limit);
}
