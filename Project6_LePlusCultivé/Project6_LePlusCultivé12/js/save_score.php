<?php
// save_score.php

header('Content-Type: application/json');
include 'db_connect.php'; // Inclut la connexion à la base

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée. Utilisez POST.']);
    exit();
}

// Récupération des données JSON envoyées par le JavaScript
$data = json_decode(file_get_contents("php://input"), true);

$userId = $data['userId'] ?? null;
$name = $data['name'] ?? null;
$score = $data['score'] ?? null;

if (!$userId || !$name || !is_numeric($score)) {
    http_response_code(400);
    echo json_encode(['error' => 'Données de score manquantes ou invalides.']);
    exit();
}

try {
    $sql = "INSERT INTO scores (user_id, name, score) VALUES (:userId, :name, :score)";
    $stmt = $pdo->prepare($sql);
    
    $stmt->bindParam(':userId', $userId);
    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':score', $score, PDO::PARAM_INT);
    
    $stmt->execute();
    
    echo json_encode(['success' => true, 'message' => 'Score enregistré avec succès.']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur lors de l\'enregistrement du score.']);
}
?>