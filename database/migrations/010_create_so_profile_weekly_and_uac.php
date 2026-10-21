<?php
/**
 * Migration: Create asset_reconciliation_weekly table and add UAC permissions to users table
 */
return [
    'up' => function (PDO $db) {
        // 1. Create SO Profile Weekly table
        $db->exec('
            CREATE TABLE IF NOT EXISTS asset_reconciliation_weekly (
                id SERIAL PRIMARY KEY,
                profile VARCHAR(150) NOT NULL,
                period_start DATE,
                period_end DATE,

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

                period_month INTEGER,
                period_week INTEGER DEFAULT 1,
                period_year INTEGER,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_reconciliation_weekly_profile 
            ON asset_reconciliation_weekly (profile)
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_reconciliation_weekly_period_myw 
            ON asset_reconciliation_weekly (period_year, period_month, period_week)
        ');

        // 2. Add UAC permission columns to users table
        $db->exec('
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS can_access_all_summary BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS can_access_weekly_summary BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS can_master_add_import BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS can_master_edit BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS can_master_delete BOOLEAN DEFAULT TRUE
        ');

        // Ensure default admin user has all permissions
        $db->exec('
            UPDATE users 
            SET 
                can_access_all_summary = TRUE,
                can_access_weekly_summary = TRUE,
                can_master_add_import = TRUE,
                can_master_edit = TRUE,
                can_master_delete = TRUE
            WHERE can_access_all_summary IS NULL
        ');
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS asset_reconciliation_weekly CASCADE');
        $db->exec('
            ALTER TABLE users 
            DROP COLUMN IF EXISTS can_access_all_summary,
            DROP COLUMN IF EXISTS can_access_weekly_summary,
            DROP COLUMN IF EXISTS can_master_add_import,
            DROP COLUMN IF EXISTS can_master_edit,
            DROP COLUMN IF EXISTS can_master_delete
        ');
    },
];
