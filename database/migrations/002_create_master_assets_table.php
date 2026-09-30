<?php
/**
 * Migration: Create master_assets table
 * Stores the imported asset data linked to a specific period.
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            CREATE TABLE IF NOT EXISTS master_assets (
                id SERIAL PRIMARY KEY,
                period_id INTEGER NOT NULL REFERENCES asset_periods(id) ON DELETE CASCADE,
                asset_number VARCHAR(100),
                asset_name VARCHAR(255),
                category VARCHAR(100),
                location VARCHAR(255),
                condition VARCHAR(50),
                acquisition_date DATE,
                acquisition_value NUMERIC(18, 2) DEFAULT 0,
                book_value NUMERIC(18, 2) DEFAULT 0,
                useful_life INTEGER,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_master_assets_period 
            ON master_assets (period_id)
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_master_assets_category 
            ON master_assets (category)
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_master_assets_number 
            ON master_assets (asset_number)
        ');
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS master_assets CASCADE');
    },
];
