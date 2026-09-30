<?php
/**
 * Migration: Create asset_reconciliation table
 * Stores reconciliation summary data matching the 21-column multi-level report header:
 * Profile | Periode (Start, End) | RESULT MATCH | RESULT PHYSIC | RESULT DB | TOTAL
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            CREATE TABLE IF NOT EXISTS asset_reconciliation (
                id SERIAL PRIMARY KEY,
                profile VARCHAR(150) NOT NULL,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,

                -- RESULT MATCH
                match_physic_qty INTEGER DEFAULT 0,
                match_physic_pct NUMERIC(18, 2) DEFAULT 0,
                match_nbv_value NUMERIC(18, 2) DEFAULT 0,
                match_nbv_pct NUMERIC(18, 2) DEFAULT 0,

                -- RESULT PHYSIC
                physic_physic_qty INTEGER DEFAULT 0,
                physic_physic_pct NUMERIC(18, 2) DEFAULT 0,
                physic_nbv_value NUMERIC(18, 2) DEFAULT 0,
                physic_nbv_pct NUMERIC(18, 2) DEFAULT 0,

                -- RESULT DB
                db_physic_qty INTEGER DEFAULT 0,
                db_physic_pct NUMERIC(18, 2) DEFAULT 0,
                db_nbv_value NUMERIC(18, 2) DEFAULT 0,
                db_nbv_pct NUMERIC(18, 2) DEFAULT 0,

                -- TOTAL (PHYSICAL: ACTUAL, TARGET, % | NBV: ACTUAL, TARGET, %)
                total_physic_actual INTEGER DEFAULT 0,
                total_physic_target INTEGER DEFAULT 0,
                total_physic_pct NUMERIC(18, 2) DEFAULT 0,
                total_nbv_actual NUMERIC(18, 2) DEFAULT 0,
                total_nbv_target NUMERIC(18, 2) DEFAULT 0,
                total_nbv_pct NUMERIC(18, 2) DEFAULT 0,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_asset_reconciliation_profile 
            ON asset_reconciliation (profile)
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_asset_reconciliation_periods 
            ON asset_reconciliation (period_start, period_end)
        ');
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS asset_reconciliation CASCADE');
    },
];
