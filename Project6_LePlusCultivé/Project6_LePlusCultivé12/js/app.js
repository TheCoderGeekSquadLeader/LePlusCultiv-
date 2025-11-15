import { getLeaderboard } from './firebase.js';

async function renderHomePage() {
  const leaderboard = await getLeaderboard();
  const container = document.getElementById("app-container");

  container.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Classement des joueurs</h2>
    <ul>
      ${leaderboard.map(p => `
        <li>${p.prenom} ${p.nom} — ${p.score} points</li>
      `).join('')}
    </ul>
  `;
}
