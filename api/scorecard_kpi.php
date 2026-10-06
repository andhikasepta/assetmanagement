<?php
/**
 * Score Card KPI Master Data API
 * Handles fetching, updating, and resetting Score Card Rating and Execution KPI configurations.
 */

require_once __DIR__ . '/../config/database.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    // Ensure database table and columns exist
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
        );
        ALTER TABLE scorecard_kpi_config ADD COLUMN IF NOT EXISTS kpi_type VARCHAR(20) DEFAULT \'rating\';
    ');

    // Seed Rating defaults if missing
    $stmtR = $db->query("SELECT COUNT(*) FROM scorecard_kpi_config WHERE kpi_type = 'rating'");
    if ((int) $stmtR->fetchColumn() === 0) {
        $defaultRatingKpis = [
            ['very_poor', 'Very Poor', 0.00, 34.00, 0.34, '<34', 'Very Poor (Match <34)', '#dc2626', '#fef2f2', 1, 'rating'],
            ['poor', 'Poor', 35.00, 62.00, 0.62, '35<x<62', 'Poor (Match 35 -62)', '#ea580c', '#fff7ed', 2, 'rating'],
            ['moderate', 'Moderate', 63.00, 71.00, 0.71, '63<x<71', 'Moderate (Match 63 - 71)', '#eab308', '#fefce8', 3, 'rating'],
            ['good', 'Good', 72.00, 84.00, 0.84, '72<x<84', 'Good (Match 72 - 84)', '#0284c7', '#f0f9ff', 4, 'rating'],
            ['very_good', 'Very Good', 85.00, 100.00, null, '>84', 'Very Good (Match >84)', '#15803d', '#f0fdf4', 5, 'rating']
        ];
        $ins = $db->prepare('
            INSERT INTO scorecard_kpi_config 
            (rating_key, rating_label, min_pct, max_pct, threshold_decimal, formula_text, match_label, badge_color, badge_bg, sort_order, kpi_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (rating_key) DO UPDATE SET kpi_type = EXCLUDED.kpi_type
        ');
        foreach ($defaultRatingKpis as $kpi) {
            $ins->execute($kpi);
        }
    }

    // Seed Execution defaults if missing
    $stmtE = $db->query("SELECT COUNT(*) FROM scorecard_kpi_config WHERE kpi_type = 'execution'");
    if ((int) $stmtE->fetchColumn() === 0) {
        $defaultExecKpis = [
            ['not_executed', 'Not Execution', 0.00, 25.00, 0.25, 'x< 0,25', 'Not Execution (x < 0.25)', '#dc2626', '#fee2e2', 1, 'execution'],
            ['executed', 'Execution', 25.00, 100.00, null, 'x>=0,25', 'Execution (x >= 0.25)', '#15803d', '#dcfce7', 2, 'execution']
        ];
        $ins = $db->prepare('
            INSERT INTO scorecard_kpi_config 
            (rating_key, rating_label, min_pct, max_pct, threshold_decimal, formula_text, match_label, badge_color, badge_bg, sort_order, kpi_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (rating_key) DO UPDATE SET kpi_type = EXCLUDED.kpi_type
        ');
        foreach ($defaultExecKpis as $kpi) {
            $ins->execute($kpi);
        }
    }

    if ($method === 'GET') {
        $stmt = $db->query('SELECT * FROM scorecard_kpi_config ORDER BY sort_order ASC');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $formatRow = function ($row) {
            return [
                'id' => (int) $row['id'],
                'rating_key' => $row['rating_key'],
                'rating_label' => $row['rating_label'],
                'min_pct' => $row['min_pct'] !== null ? (float) $row['min_pct'] : null,
                'max_pct' => $row['max_pct'] !== null ? (float) $row['max_pct'] : null,
                'threshold_decimal' => $row['threshold_decimal'] !== null ? (float) $row['threshold_decimal'] : null,
                'formula_text' => $row['formula_text'],
                'match_label' => $row['match_label'],
                'badge_color' => $row['badge_color'],
                'badge_bg' => $row['badge_bg'],
                'sort_order' => (int) $row['sort_order'],
                'kpi_type' => $row['kpi_type'] ?? 'rating'
            ];
        };

        $all = array_map($formatRow, $rows);
        $rating = array_values(array_filter($all, fn($item) => ($item['kpi_type'] ?? 'rating') === 'rating'));
        $execution = array_values(array_filter($all, fn($item) => ($item['kpi_type'] ?? '') === 'execution'));

        echo json_encode([
            'success' => true,
            'rating' => $rating,
            'execution' => $execution,
            'data' => $rating
        ]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $action = $input['action'] ?? 'update';

        // ── Reset Actions ──────────────────────────────────────────
        if ($action === 'reset' || $action === 'reset_rating') {
            $db->exec("DELETE FROM scorecard_kpi_config WHERE kpi_type = 'rating'");
            $defaultRatingKpis = [
                ['very_poor', 'Very Poor', 0.00, 34.00, 0.34, '<34', 'Very Poor (Match <34)', '#dc2626', '#fef2f2', 1, 'rating'],
                ['poor', 'Poor', 35.00, 62.00, 0.62, '35<x<62', 'Poor (Match 35 -62)', '#ea580c', '#fff7ed', 2, 'rating'],
                ['moderate', 'Moderate', 63.00, 71.00, 0.71, '63<x<71', 'Moderate (Match 63 - 71)', '#eab308', '#fefce8', 3, 'rating'],
                ['good', 'Good', 72.00, 84.00, 0.84, '72<x<84', 'Good (Match 72 - 84)', '#0284c7', '#f0f9ff', 4, 'rating'],
                ['very_good', 'Very Good', 85.00, 100.00, null, '>84', 'Very Good (Match >84)', '#15803d', '#f0fdf4', 5, 'rating']
            ];
            $ins = $db->prepare('
                INSERT INTO scorecard_kpi_config 
                (rating_key, rating_label, min_pct, max_pct, threshold_decimal, formula_text, match_label, badge_color, badge_bg, sort_order, kpi_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');
            foreach ($defaultRatingKpis as $kpi) {
                $ins->execute($kpi);
            }

            if ($action === 'reset_rating') {
                echo json_encode(['success' => true, 'message' => 'KPI Rating berhasil direset ke nilai default']);
                exit;
            }
        }

        if ($action === 'reset' || $action === 'reset_execution') {
            $db->exec("DELETE FROM scorecard_kpi_config WHERE kpi_type = 'execution'");
            $defaultExecKpis = [
                ['not_executed', 'Not Execution', 0.00, 25.00, 0.25, 'x< 0,25', 'Not Execution (x < 0.25)', '#dc2626', '#fee2e2', 1, 'execution'],
                ['executed', 'Execution', 25.00, 100.00, null, 'x>=0,25', 'Execution (x >= 0.25)', '#15803d', '#dcfce7', 2, 'execution']
            ];
            $ins = $db->prepare('
                INSERT INTO scorecard_kpi_config 
                (rating_key, rating_label, min_pct, max_pct, threshold_decimal, formula_text, match_label, badge_color, badge_bg, sort_order, kpi_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');
            foreach ($defaultExecKpis as $kpi) {
                $ins->execute($kpi);
            }

            echo json_encode(['success' => true, 'message' => 'KPI Execution berhasil direset ke nilai default']);
            exit;
        }

        // ── Update Execution KPI ────────────────────────────────────
        if ($action === 'update_execution') {
            $thresh = isset($input['threshold_decimal']) && $input['threshold_decimal'] !== ''
                ? (float) $input['threshold_decimal']
                : 0.25;

            $threshFormatted = number_format($thresh, 2, ',', '');
            $pctVal = round($thresh * 100, 2);

            $db->beginTransaction();
            // 1. Not Execution
            $stmtNot = $db->prepare('
                UPDATE scorecard_kpi_config
                SET min_pct = 0,
                    max_pct = :max_pct,
                    threshold_decimal = :threshold,
                    formula_text = :formula,
                    match_label = :match,
                    updated_at = CURRENT_TIMESTAMP
                WHERE rating_key = \'not_executed\'
            ');
            $stmtNot->execute([
                ':max_pct' => $pctVal,
                ':threshold' => $thresh,
                ':formula' => "x< {$threshFormatted}",
                ':match' => "Not Execution (x < {$thresh})"
            ]);

            // 2. Execution
            $stmtExec = $db->prepare('
                UPDATE scorecard_kpi_config
                SET min_pct = :min_pct,
                    max_pct = 100,
                    threshold_decimal = NULL,
                    formula_text = :formula,
                    match_label = :match,
                    updated_at = CURRENT_TIMESTAMP
                WHERE rating_key = \'executed\'
            ');
            $stmtExec->execute([
                ':min_pct' => $pctVal,
                ':formula' => "x>={$threshFormatted}",
                ':match' => "Execution (x >= {$thresh})"
            ]);
            $db->commit();

            echo json_encode(['success' => true, 'message' => 'Konfigurasi KPI Execution berhasil disimpan']);
            exit;
        }

        // ── Update Rating KPI ───────────────────────────────────────
        if ($action === 'update' || $action === 'update_rating') {
            $kpis = $input['kpis'] ?? [];
            if (!is_array($kpis) || empty($kpis)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Data KPI tidak valid']);
                exit;
            }

            $updateStmt = $db->prepare('
                UPDATE scorecard_kpi_config
                SET min_pct = :min_pct,
                    max_pct = :max_pct,
                    threshold_decimal = :threshold_decimal,
                    formula_text = :formula_text,
                    match_label = :match_label,
                    updated_at = CURRENT_TIMESTAMP
                WHERE rating_key = :rating_key
            ');

            $db->beginTransaction();
            foreach ($kpis as $item) {
                $ratingKey = trim($item['rating_key'] ?? '');
                if (!$ratingKey)
                    continue;

                $minPct = isset($item['min_pct']) && $item['min_pct'] !== '' ? (float) $item['min_pct'] : null;
                $maxPct = isset($item['max_pct']) && $item['max_pct'] !== '' ? (float) $item['max_pct'] : null;
                $threshold = isset($item['threshold_decimal']) && $item['threshold_decimal'] !== '' ? (float) $item['threshold_decimal'] : null;
                $formula = trim($item['formula_text'] ?? '');
                $matchLabel = trim($item['match_label'] ?? '');

                if (!$formula) {
                    if ($ratingKey === 'very_poor') {
                        $formula = '<' . ($maxPct !== null ? $maxPct : '34');
                    } elseif ($ratingKey === 'very_good') {
                        $prevMax = 84;
                        $formula = '>' . ($minPct !== null ? ($minPct - 1) : $prevMax);
                    } else {
                        $formula = ($minPct !== null ? $minPct : '0') . '<x<' . ($maxPct !== null ? $maxPct : '100');
                    }
                }

                if (!$threshold && $maxPct !== null && $ratingKey !== 'very_good') {
                    $threshold = round($maxPct / 100, 2);
                }

                if (!$matchLabel) {
                    if ($ratingKey === 'very_poor') {
                        $matchLabel = "Very Poor (Match <{$maxPct})";
                    } elseif ($ratingKey === 'poor') {
                        $matchLabel = "Poor (Match {$minPct} -{$maxPct})";
                    } elseif ($ratingKey === 'moderate') {
                        $matchLabel = "Moderate (Match {$minPct} - {$maxPct})";
                    } elseif ($ratingKey === 'good') {
                        $matchLabel = "Good (Match {$minPct} - {$maxPct})";
                    } elseif ($ratingKey === 'very_good') {
                        $thresh = $minPct !== null ? ($minPct - 1) : 84;
                        $matchLabel = "Very Good (Match >{$thresh})";
                    }
                }

                $updateStmt->execute([
                    ':min_pct' => $minPct,
                    ':max_pct' => $maxPct,
                    ':threshold_decimal' => $threshold,
                    ':formula_text' => $formula,
                    ':match_label' => $matchLabel,
                    ':rating_key' => $ratingKey
                ]);
            }
            $db->commit();

            echo json_encode(['success' => true, 'message' => 'Konfigurasi KPI Rating berhasil disimpan']);
            exit;
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Action tidak didukung']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Terjadi kesalahan server: ' . $e->getMessage()
    ]);
}
