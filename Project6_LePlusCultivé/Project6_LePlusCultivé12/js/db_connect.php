<?php
// db_connect.php

$host = 'localhost'; // Ex: 'localhost'
$dbname = 'SCORE_BD';
$user = 'IS';
$password = 'IS';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // En cas d'échec de connexion, on arrête tout
    http_response_code(500);
    echo json_encode(['error' => 'Erreur de connexion à la base de données.']);
    exit();
}
?>