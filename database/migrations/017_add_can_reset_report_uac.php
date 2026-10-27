<?php
/**
 * Migration: Add can_reset_report column to users table for Reset Report UAC
 */
return [
    'up' => function (PDO $db) {
        $db->exec("
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS can_reset_report BOOLEAN DEFAULT FALSE
        ");

        // Superadmin D3utsch always has can_reset_report = true
        $db->exec("
            UPDATE users 
            SET can_reset_report = TRUE 
            WHERE LOWER(username) = 'd3utsch'
        ");
    },

    'down' => function (PDO $db) {
        $db->exec("
            ALTER TABLE users 
            DROP COLUMN IF EXISTS can_reset_report
        ");
    },
];
