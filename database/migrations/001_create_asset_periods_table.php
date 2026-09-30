<?php
/**
 * Migration: Create asset_periods table
 * Stores the period groupings (month/year) for imported data.
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            CREATE TABLE IF NOT EXISTS asset_periods (
                id SERIAL PRIMARY KEY,
                month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
                year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
                label VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (month, year)
            )
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_asset_periods_year_month 
            ON asset_periods (year, month)
        ');
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS asset_periods CASCADE');
    },
];
