<?php
/**
 * Migration: Add reports_depts column to users table for department-level UAC
 */
return [
    'up' => function (PDO $db) {
        $db->exec("
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS reports_depts VARCHAR(255) DEFAULT 'ALL'
        ");

        $db->exec("
            UPDATE users 
            SET reports_depts = 'ALL' 
            WHERE reports_depts IS NULL OR reports_depts = ''
        ");
    },

    'down' => function (PDO $db) {
        $db->exec("
            ALTER TABLE users 
            DROP COLUMN IF EXISTS reports_depts
        ");
    },
];
