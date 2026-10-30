<?php
/**
 * Migration: Add can_access_berita_acara column to users table for Berita Acara Page UAC
 */
return [
    'up' => function (PDO $db) {
        $db->exec("
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS can_access_berita_acara BOOLEAN DEFAULT TRUE
        ");

        $db->exec("
            UPDATE users 
            SET can_access_berita_acara = TRUE 
            WHERE can_access_berita_acara IS NULL
        ");
    },

    'down' => function (PDO $db) {
        $db->exec("
            ALTER TABLE users 
            DROP COLUMN IF EXISTS can_access_berita_acara
        ");
    },
];
