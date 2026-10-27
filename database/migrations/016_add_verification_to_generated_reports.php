<?php
/**
 * Migration: Add verification and upload columns to generated_reports table
 */
return [
    'up' => function (PDO $db) {
        $db->exec("
            ALTER TABLE generated_reports 
            ADD COLUMN IF NOT EXISTS uploaded_file_path VARCHAR(500),
            ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITHOUT TIME ZONE,
            ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITHOUT TIME ZONE,
            ADD COLUMN IF NOT EXISTS verified_by VARCHAR(150)
        ");
        $db->exec('CREATE INDEX IF NOT EXISTS idx_gen_reports_uploaded_at ON generated_reports(uploaded_at)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_gen_reports_verified_at ON generated_reports(verified_at)');
    },

    'down' => function (PDO $db) {
        $db->exec("
            ALTER TABLE generated_reports 
            DROP COLUMN IF EXISTS uploaded_file_path,
            DROP COLUMN IF EXISTS uploaded_at,
            DROP COLUMN IF EXISTS verified_at,
            DROP COLUMN IF EXISTS verified_by
        ");
    },
];
