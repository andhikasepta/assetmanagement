<?php
/**
 * Migration: Create scorecard_kpi_config table
 * Stores Score Card KPI Rating configuration rules and percentage ranges
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            CREATE TABLE IF NOT EXISTS scorecard_kpi_config (
                id SERIAL PRIMARY KEY,
                rating_key VARCHAR(50) UNIQUE NOT NULL,
                rating_label VARCHAR(100) NOT NULL,
                min_pct NUMERIC(5,2) DEFAULT NULL,
                max_pct NUMERIC(5,2) DEFAULT NULL,
                threshold_decimal NUMERIC(5,2) DEFAULT NULL,
                formula_text VARCHAR(100) DEFAULT \'\',
                match_label VARCHAR(150) DEFAULT \'\',
                badge_color VARCHAR(30) DEFAULT \'#dc2626\',
                badge_bg VARCHAR(30) DEFAULT \'#fef2f2\',
                sort_order INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');

        // Check if table is empty, seed initial defaults matching KPI spec
        $stmt = $db->query('SELECT COUNT(*) FROM scorecard_kpi_config');
        if ((int)$stmt->fetchColumn() === 0) {
            $defaultKpis = [
                ['very_poor', 'Very Poor', 0.00, 34.00, 0.34, '<34', 'Very Poor (Match <34)', '#dc2626', '#fef2f2', 1],
                ['poor', 'Poor', 35.00, 62.00, 0.62, '35<x<62', 'Poor (Match 35 -62)', '#ea580c', '#fff7ed', 2],
                ['moderate', 'Moderate', 63.00, 71.00, 0.71, '63<x<71', 'Moderate (Match 63 - 71)', '#eab308', '#fefce8', 3],
                ['good', 'Good', 72.00, 84.00, 0.84, '72<x<84', 'Good (Match 72 - 84)', '#0284c7', '#f0f9ff', 4],
                ['very_good', 'Very Good', 85.00, 100.00, null, '>84', 'Very Good (Match >84)', '#15803d', '#f0fdf4', 5]
            ];

            $insert = $db->prepare('
                INSERT INTO scorecard_kpi_config 
                (rating_key, rating_label, min_pct, max_pct, threshold_decimal, formula_text, match_label, badge_color, badge_bg, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');

            foreach ($defaultKpis as $kpi) {
                $insert->execute($kpi);
            }
        }
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS scorecard_kpi_config CASCADE');
    },
];
