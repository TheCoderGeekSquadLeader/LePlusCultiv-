// quiz.js

import { saveLocalScore, queueSync, syncOfflineScores } from "./db.js";
import { initFirebase, getUserId, getPublicScoresCollectionRef } from "./firebase.js";
import { renderLeaderboard } from "./leaderboard.js";
import { RAW_QUIZ_DATA } from "./data.js";

// quiz.js — État global
export let gameState = {
  // Vue active de l’application
  view: 'login', // 'login', 'quiz', 'results', 'summary'

  // Identité joueur
  userName: '',
  userFirstName: '',
  userId: null,

  // Score et progression
  currentScore: 0,
  currentQIndex: 0,

  // Minuteur
  timer: 0,            // Temps restant pour la question courante
  initialTimer: 15,    // Temps initial par question (sera recalculé dynamiquement)
  timerInterval: null, // Référence setInterval pour le timer
  isPaused: false,     // État de pause

  // Classement et auth
  leaderboard: [],     // Rempli via Firestore listener
  isAuthReady: false,  // Firebase/Firestore prêt ou non

  // Historique des réponses (pour le récapitulatif)
  // Format: { index, question, correctAnswer, userAnswer, points, pointsAwarded, isCorrect, section }
  userAnswers: []
};

// --- Modales et messages ---
function showModal(title, message, callback, cancelCallback = null) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalButton = document.getElementById('modal-button');
    const modalCancelButton = document.getElementById('modal-cancel-button');

    // Remplir contenu
    modalTitle.textContent = title;
    modalMessage.innerHTML = message;

    // Afficher la modale
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Bouton principal
    modalButton.textContent = cancelCallback ? "Confirmer" : "Continuer";
    modalButton.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (callback) callback();
    };

    // Bouton annuler (si fourni)
    if (cancelCallback) {
        modalCancelButton.classList.remove('hidden');
        modalCancelButton.textContent = "Annuler";
        modalCancelButton.onclick = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            cancelCallback();
        };
    } else {
        modalCancelButton.classList.add('hidden');
    }
}

// --- Outils de comparaison ---

/**
 * Nettoie une chaîne de réponse pour une comparaison de base
 * - minuscule
 * - suppression des accents
 * - suppression de la ponctuation
 */
function cleanAnswer(answer) {
    return answer
        .toLowerCase()
        .normalize('NFD')                // décompose les accents
        .replace(/[\u0300-\u036f]/g, "") // supprime les accents
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // supprime ponctuation
        .trim();
}

/**
 * Calcule la distance de Levenshtein (nombre minimal d'éditions nécessaires)
 * entre deux chaînes (insertions, suppressions, substitutions).
 */
function getEditDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // Initialisation
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Remplissage
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = a[j - 1] === b[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,       // Suppression
                matrix[i][j - 1] + 1,       // Insertion
                matrix[i - 1][j - 1] + cost // Substitution
            );
        }
    }

    return matrix[b.length][a.length];
}

// --- Logique du quiz ---

function startQuiz() {
    const nameInput = document.getElementById('name-input');
    const firstNameInput = document.getElementById('firstname-input');

    if (!nameInput.value.trim() || !firstNameInput.value.trim()) {
        showModal("Attention", "Veuillez entrer votre nom et prénom pour commencer la compétition.");
        return;
    }

    gameState.userName = nameInput.value.trim();
    gameState.userFirstName = firstNameInput.value.trim();

    // Vérification si déjà joué
    const hasExistingScore = gameState.leaderboard.some(item => item.id === gameState.userId);
    if (hasExistingScore) {
        showModal(
            "Partie Déjà Terminée",
            `Un score a déjà été enregistré pour cet identifiant (${gameState.userId}). Vous ne pouvez pas recommencer.`,
            () => {
                gameState.view = 'results';
                renderApp();
            }
        );
        return;
    }

    // Réinitialisation
    gameState.currentScore = 0;
    gameState.currentQIndex = 0;
    gameState.userAnswers = [];
    gameState.view = 'quiz';
    renderApp();
    startQuestion();
}

function startTimer() {
    const currentQ = QUIZ_DATA_FINAL[gameState.currentQIndex];
    const charCount = currentQ.question.length;
    const estimatedLines = Math.ceil(charCount / 50);

    if (!gameState.isPaused) {
        gameState.initialTimer = Math.max(15, estimatedLines * 10);
        gameState.timer = gameState.initialTimer;
    }

    clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(() => {
        if (gameState.isPaused) {
            clearInterval(gameState.timerInterval);
            return;
        }

        gameState.timer--;
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) timerDisplay.textContent = gameState.timer;

        const timerRing = document.getElementById('timer-ring');
        if (timerRing) {
            if (gameState.timer <= 5) {
                timerRing.classList.add('timer-ring');
            } else {
                timerRing.classList.remove('timer-ring');
            }
        }

        if (gameState.timer <= 0) {
            clearInterval(gameState.timerInterval);
            processAnswer(document.getElementById('answer-input').value, true);
        }
    }, 1000);
}

function pauseQuiz() {
    if (gameState.isPaused) {
        gameState.isPaused = false;
        startTimer();
        renderApp();
    } else {
        gameState.isPaused = true;
        clearInterval(gameState.timerInterval);
        renderApp();
    }
}

function abandonQuiz() {
    showModal(
        "Pathétique...",
        "Vous allez tout laisser tomber ? Ce moment ne reviendra jamais.",
        async () => {
            clearInterval(gameState.timerInterval);
            clearTimeout(quizTimerTimeout);

            await saveScore();

            gameState.currentQIndex = 0;
            gameState.userAnswers = [];
            gameState.isPaused = false;

            gameState.view = 'login';
            renderApp();
        },
        () => {}
    );
}

function renderApp() {
  const root = document.getElementById("app-container");
  if (!root) return;

  if (gameState.view === 'login') {
    root.innerHTML = `
      <div class="quiz-card p-6 rounded-lg shadow-lg text-center">
        <h2 class="text-2xl font-bold mb-4">Inscription</h2>
        <input id="firstname-input" class="w-full p-2 mb-4 rounded bg-gray-800 text-white" placeholder="Prénom" />
        <input id="name-input" class="w-full p-2 mb-4 rounded bg-gray-800 text-white" placeholder="Nom" />
        <button onclick="startQuiz()" class="px-6 py-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition">Commencer</button>
      </div>
    `;
  }
  // autres vues...
}


function processAnswer(userAnswer, isTimedOut = false) {
    clearInterval(gameState.timerInterval);
    clearTimeout(quizTimerTimeout);

    const currentQ = QUIZ_DATA_FINAL[gameState.currentQIndex];
    const cleanUserAnswer = cleanAnswer(userAnswer);
    const cleanCorrectAnswer = cleanAnswer(currentQ.answer);

    const maxEditDistance = Math.max(1, Math.min(2, Math.ceil(cleanCorrectAnswer.length * 0.2)));
    const distance = getEditDistance(cleanUserAnswer, cleanCorrectAnswer);

    const isCorrect = distance <= maxEditDistance;
    let pointsAwarded = 0;
    let feedbackTitle = "";
    let feedbackClass = "";
    let feedbackMessage = "";

    // Logique spéciale pour Cascades
    if (currentQ.section === "Cascades (A-Z)") {
        const requiredLetter = currentQ.requiredLetter.toUpperCase();
        const userFirstLetter = cleanUserAnswer.charAt(0).toUpperCase();
        const startsWithCorrectLetter = userFirstLetter === requiredLetter;

        if (isCorrect && startsWithCorrectLetter) {
            pointsAwarded = currentQ.points;
            feedbackTitle = "CASCADE RÉUSSIE !";
            feedbackClass = "correct-feedback";
            feedbackMessage = `Excellent ! La réponse <strong>${currentQ.answer}</strong> commence bien par ${requiredLetter}. Vous gagnez ${pointsAwarded} points.`;
        } else {
            pointsAwarded = -10;
            feedbackTitle = "PÉNALITÉ (-10 PTS)";
            feedbackClass = "incorrect-feedback";
            feedbackMessage = `Réponse incorrecte. La bonne réponse était : <strong>${currentQ.answer}</strong>.`;
        }
    } else {
        if (isCorrect) {
            pointsAwarded = currentQ.points;
            feedbackTitle = "CORRECT !";
            feedbackClass = "correct-feedback";
            feedbackMessage = `${isTimedOut ? "Temps écoulé. " : ""} Vous gagnez ${pointsAwarded} points.<br>La bonne réponse était : <strong>${currentQ.answer}</strong>.`;
        } else {
            pointsAwarded = 0;
            feedbackTitle = "INCORRECT !";
            feedbackClass = "incorrect-feedback";
            feedbackMessage = `${isTimedOut ? "Temps écoulé. " : ""} Pas de point.<br>La bonne réponse était : <strong>${currentQ.answer}</strong>.`;
        }
    }

    gameState.currentScore += pointsAwarded;

    gameState.userAnswers.push({
        index: gameState.currentQIndex + 1,
        question: currentQ.question,
        correctAnswer: currentQ.answer,
        userAnswer: userAnswer.trim() || 'N/A (Temps écoulé)',
        points: currentQ.points,
        pointsAwarded,
        isCorrect,
        section: currentQ.section
    });

    gameState.currentQIndex++;
    if (gameState.currentQIndex < QUIZ_DATA_FINAL.length) {
        startQuestion();
    } else {
        endQuiz();
    }
}

async function endQuiz() {
    try {
        await saveScore();
    } catch (e) {
        console.error('Erreur sauvegarde score:', e);
    }

    gameState.view = 'results';
    renderApp();
}

// --- Rendu ---

function renderApp() {
    const root = document.getElementById("app-container");
    if (!root) return;

    if (gameState.view === 'login') {
        root.innerHTML = `
            <h2>Connexion</h2>
            <input id="firstname-input" placeholder="Prénom" />
            <input id="name-input" placeholder="Nom" />
            <button onclick="startQuiz()">Commencer</button>
        `;
    }
    else if (gameState.view === 'quiz') {
        const currentQ = QUIZ_DATA_FINAL[gameState.currentQIndex];
        root.innerHTML = `
            <h2>Question ${gameState.currentQIndex + 1}</h2>
            <p><strong>${currentQ.section}</strong></p>
            <p>${currentQ.question}</p>
            <input id="answer-input" placeholder="Votre réponse" />
            <div id="timer-display">${gameState.timer}</div>
            <div id="timer-ring"></div>
            <button onclick="processAnswer(document.getElementById('answer-input').value)">Valider</button>
            <button onclick="pauseQuiz()">${gameState.isPaused ? "Reprendre" : "Pause"}</button>
            <button onclick="abandonQuiz()">Abandonner</button>
        `;
    }
    else if (gameState.view === 'results') {
        root.innerHTML = `
            <h2>Résultats</h2>
            <p>Score final : ${gameState.currentScore}</p>
            <button onclick="renderSummary()">Voir le récapitulatif</button>
        `;
        renderLeaderboard(gameState, offlineDB);
    }
    else if (gameState.view === 'summary') {
        root.innerHTML = `
            <h2>Résumé de vos réponses</h2>
            <ul>
                ${gameState.userAnswers.map(ans => `
                    <li>
                        Q${ans.index} (${ans.section}) : ${ans.question}<br>
                        Votre réponse : ${ans.userAnswer}<br>
                        Bonne réponse : ${ans.correctAnswer}<br>
                        Points obtenus : ${ans.pointsAwarded}
                    </li>
                `).join("")}
            </ul>
            <button onclick="gameState.view='login'; renderApp()">Retour à l'accueil</button>
        `;
    }
}

function startQuestion() {
    renderApp();
    startTimer();
}

document.addEventListener("DOMContentLoaded", () => {
  renderApp();
});


