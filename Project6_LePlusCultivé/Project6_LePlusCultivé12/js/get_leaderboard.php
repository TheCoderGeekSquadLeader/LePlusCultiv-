<?php
// get_leaderboard.php

header('Content-Type: application/json');
include 'db_connect.php';

try {
    // Sélectionne les 10 meilleurs scores
    $sql = "SELECT name, score, timestamp FROM scores ORDER BY score DESC, timestamp DESC LIMIT 10";
    $stmt = $pdo->query($sql);
    $leaderboard = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'leaderboard' => $leaderboard]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur lors de la récupération du classement.']);
}
?>