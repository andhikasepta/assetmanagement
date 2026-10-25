<?php
/**
 * Migration: Add UAC permission for Reports page and ensure template_reports table
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS can_access_reports BOOLEAN DEFAULT TRUE
        ');

        $db->exec('
            UPDATE users 
            SET can_access_reports = TRUE 
            WHERE can_access_reports IS NULL
        ');

        $db->exec('
            CREATE TABLE IF NOT EXISTS template_reports (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_type VARCHAR(50) NOT NULL DEFAULT \'word\',
                file_ext VARCHAR(20) NOT NULL DEFAULT \'docx\',
                file_size BIGINT NOT NULL DEFAULT 0,
                uploaded_by VARCHAR(150),
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        ');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_template_reports_file_type ON template_reports(file_type)');
    },

    'down' => function (PDO $db) {
        $db->exec('
            ALTER TABLE users 
            DROP COLUMN IF EXISTS can_access_reports
        ');
        $db->exec('DROP TABLE IF EXISTS template_reports');
    },
];
