CREATE TABLE scores (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    score INT(11) NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour accélérer la recherche des meilleurs scores
CREATE INDEX idx_score ON scores (score DESC);