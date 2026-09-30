<?php
/**
 * Migration: Create import_logs table
 * Tracks all Excel import operations for audit trail.
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            CREATE TABLE IF NOT EXISTS import_logs (
                id SERIAL PRIMARY KEY,
                period_id INTEGER NOT NULL REFERENCES asset_periods(id) ON DELETE CASCADE,
                original_filename VARCHAR(255) NOT NULL,
                stored_filename VARCHAR(255) NOT NULL,
                rows_imported INTEGER DEFAULT 0,
                rows_failed INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT \'completed\',
                error_details TEXT,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_import_logs_period 
            ON import_logs (period_id)
        ');
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS import_logs CASCADE');
    },
];
