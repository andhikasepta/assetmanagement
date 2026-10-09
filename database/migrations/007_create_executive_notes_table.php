<?php
/**
 * Migration: Create executive_notes table
 * Stores notes/catatan per period (month, year) for Executive Summary
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            CREATE TABLE IF NOT EXISTS executive_notes (
                id SERIAL PRIMARY KEY,
                year INT NOT NULL,
                month INT NOT NULL,
                region VARCHAR(100) DEFAULT \'\',
                dept VARCHAR(100) DEFAULT \'\',
                sub_dept VARCHAR(100) DEFAULT \'\',
                keterangan TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_exec_notes_period ON executive_notes (year, month);
        ');
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS executive_notes CASCADE');
    },
];
