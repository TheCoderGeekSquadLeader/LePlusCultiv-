async function saveLocalPlayerScore(prenom, nom, score) {
  const entry = {
    id: crypto.randomUUID(),
    prenom,
    nom,
    score,
    timestamp: Date.now()
  };
  await idbPut("players", entry); // fonction de idb.js
}

async function getLocalLeaderboard(limitCount = 10) {
  const players = await idbGetAll("players");
  return players.sort((a,b) => b.score - a.score).slice(0, limitCount);
}
