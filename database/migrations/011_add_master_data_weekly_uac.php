<?php
/**
 * Migration: Add UAC permissions for Master Data and Master Data Weekly pages
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS can_access_master_data BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS can_access_master_data_weekly BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS can_master_weekly_add_import BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS can_master_weekly_delete BOOLEAN DEFAULT TRUE
        ');

        $db->exec('
            UPDATE users 
            SET 
                can_access_master_data = TRUE,
                can_access_master_data_weekly = TRUE,
                can_master_weekly_add_import = TRUE,
                can_master_weekly_delete = TRUE
            WHERE can_access_master_data IS NULL
        ');
    },

    'down' => function (PDO $db) {
        $db->exec('
            ALTER TABLE users 
            DROP COLUMN IF EXISTS can_access_master_data,
            DROP COLUMN IF EXISTS can_access_master_data_weekly,
            DROP COLUMN IF EXISTS can_master_weekly_add_import,
            DROP COLUMN IF EXISTS can_master_weekly_delete
        ');
    },
];
