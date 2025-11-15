// leaderboard.js

import { getAllQueuedScores } from "./db.js"; // si besoin
import { syncOfflineScores } from "./db.js"; // pour relancer la sync

/**
 * Récupère le top 10 des scores (local + Firestore si dispo)
 */
export async function getTop10Scores(gameState, offlineDB) {
  const tx = offlineDB.transaction("scores", "readonly");
  const req = tx.objectStore("scores").getAll();

  const local = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  let allScores = [...local];

  if (gameState.isAuthReady && Array.isArray(gameState.leaderboard)) {
    const online = gameState.leaderboard.map(x => ({
      userId: x.userId || x.id,
      name: x.name,
      score: x.score,
      timestamp: (x.timestamp?.seconds ? x.timestamp.seconds * 1000 : Date.now())
    }));
    allScores = [...allScores, ...online];
  }

  const bestByUser = new Map();
  for (const s of allScores) {
    if (!s.userId) continue;
    const prev = bestByUser.get(s.userId);
    if (!prev || s.score > prev.score) {
      bestByUser.set(s.userId, s);
    }
  }

  return Array.from(bestByUser.values())
    .sort((a, b) => b.score - a.score || (b.timestamp - a.timestamp))
    .slice(0, 10);
}

/**
 * Rend le classement dans le DOM
 */
export async function renderLeaderboard(gameState, offlineDB) {
  const topScores = await getTop10Scores(gameState, offlineDB);

  const container = document.getElementById("leaderboard");
  if (!container) return;

  container.innerHTML = `
    <h2>🏆 Classement</h2>
    <ol>
      ${topScores.map(s => `
        <li>${s.name} — ${s.score} pts</li>
      `).join("")}
    </ol>
  `;
}
