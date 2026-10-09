<?php
/**
 * Migration: Create users table and seed default admin account
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT \'admin\',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        // Check if strict admin exists
        $stmt = $db->prepare('SELECT id FROM users WHERE username = :username');
        $stmt->execute(['username' => 'D3utsch']);
        if (!$stmt->fetch()) {
            $hashedPassword = password_hash('S3pt4@##!@#', PASSWORD_DEFAULT);
            $insert = $db->prepare('
                INSERT INTO users (username, name, password, role)
                VALUES (:username, :name, :password, :role)
            ');
            $insert->execute([
                'username' => 'D3utsch',
                'name'     => 'Asset Management Administrator',
                'password' => $hashedPassword,
                'role'     => 'admin',
            ]);
        }
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS users CASCADE');
    },
];
