<?php
/**
 * Migration: Add UAC permission for User Management page
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS can_access_user_management BOOLEAN DEFAULT TRUE
        ');

        $db->exec('
            UPDATE users 
            SET can_access_user_management = TRUE 
            WHERE can_access_user_management IS NULL
        ');
    },

    'down' => function (PDO $db) {
        $db->exec('
            ALTER TABLE users 
            DROP COLUMN IF EXISTS can_access_user_management
        ');
    },
];
