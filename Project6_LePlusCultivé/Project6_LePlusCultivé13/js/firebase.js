import { doc, setDoc, getDocs, collection, orderBy, query, limit } 
  from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const db = getFirestore(app);

// Sauvegarder un joueur
export async function savePlayerScore(userId, prenom, nom, score) {
  const playerRef = doc(db, "players", userId);
  await setDoc(playerRef, {
    id: userId,
    prenom,
    nom,
    score,
    timestamp: new Date()
  }, { merge: true });
}

// Récupérer le classement
export async function getLeaderboard() {
  const q = query(collection(db, "players"), orderBy("score", "desc"), limit(10));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}
