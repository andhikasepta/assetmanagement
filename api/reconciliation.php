<?php
/**
 * Asset Reconciliation API
 * Handles fetching and saving reconciliation summary data
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    if ($method === 'GET') {
        $stmt = $db->query('
            SELECT 
                id,
                profile,
                TO_CHAR(period_start, \'YYYY-MM-DD\') as period_start,
                TO_CHAR(period_end, \'YYYY-MM-DD\') as period_end,
                match_physic_qty, match_physic_pct, match_nbv_value, match_nbv_pct,
                physic_physic_qty, physic_physic_pct, physic_nbv_value, physic_nbv_pct,
                db_physic_qty, db_physic_pct, db_nbv_value, db_nbv_pct,
                total_physic_actual, total_physic_target, total_physic_pct,
                total_nbv_actual, total_nbv_target, total_nbv_pct
            FROM asset_reconciliation
            ORDER BY period_start DESC, id ASC
        ');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Parse Site Code and Name Site from profile string
        foreach ($rows as &$row) {
            $profile = trim($row['profile'] ?? '');
            $parts = explode(' - ', $profile);
            $siteCode = '';
            $siteName = '';

            if (count($parts) >= 2) {
                $siteCode = trim($parts[1]);
                if (count($parts) >= 4 && stripos($parts[2], 'LINTASARTA') !== false) {
                    $siteName = trim(implode(' - ', array_slice($parts, 3)));
                } elseif (count($parts) >= 3) {
                    $siteName = trim(implode(' - ', array_slice($parts, 2)));
                } else {
                    $siteName = $siteCode;
                }
            } else {
                $siteCode = $profile;
                $siteName = $profile;
            }

            $row['site_code'] = $siteCode;
            $row['site_name'] = $siteName;
        }
        unset($row);

        $totalsStmt = $db->query('
            SELECT 
                COUNT(*) as total_profiles,
                COALESCE(SUM(match_physic_qty), 0) as total_match_qty,
                COALESCE(SUM(match_nbv_value), 0) as total_match_nbv,
                COALESCE(SUM(physic_physic_qty), 0) as total_physic_qty,
                COALESCE(SUM(physic_nbv_value), 0) as total_physic_nbv,
                COALESCE(SUM(db_physic_qty), 0) as total_db_qty,
                COALESCE(SUM(db_nbv_value), 0) as total_db_nbv,
                COALESCE(SUM(total_physic_actual), 0) as total_physic_actual,
                COALESCE(SUM(total_physic_target), 0) as total_physic_target,
                COALESCE(SUM(total_nbv_actual), 0) as total_nbv_actual,
                COALESCE(SUM(total_nbv_target), 0) as total_nbv_target
            FROM asset_reconciliation
        ');
        $totals = $totalsStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data'    => $rows,
            'totals'  => $totals,
            'total'   => count($rows),
        ]);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        if (!$payload || empty($payload['profile']) || empty($payload['period_start']) || empty($payload['period_end'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Profile, period_start, and period_end are required']);
            exit;
        }

        $stmt = $db->prepare('
            INSERT INTO asset_reconciliation (
                profile, period_start, period_end,
                match_physic_qty, match_physic_pct, match_nbv_value, match_nbv_pct,
                physic_physic_qty, physic_physic_pct, physic_nbv_value, physic_nbv_pct,
                db_physic_qty, db_physic_pct, db_nbv_value, db_nbv_pct,
                total_physic_actual, total_physic_target, total_physic_pct,
                total_nbv_actual, total_nbv_target, total_nbv_pct
            ) VALUES (
                :profile, :period_start, :period_end,
                :match_physic_qty, :match_physic_pct, :match_nbv_value, :match_nbv_pct,
                :physic_physic_qty, :physic_physic_pct, :physic_nbv_value, :physic_nbv_pct,
                :db_physic_qty, :db_physic_pct, :db_nbv_value, :db_nbv_pct,
                :total_physic_actual, :total_physic_target, :total_physic_pct,
                :total_nbv_actual, :total_nbv_target, :total_nbv_pct
            ) RETURNING id
        ');

        $stmt->execute([
            ':profile'             => $payload['profile'],
            ':period_start'        => $payload['period_start'],
            ':period_end'          => $payload['period_end'],
            ':match_physic_qty'    => $payload['match_physic_qty'] ?? 0,
            ':match_physic_pct'    => $payload['match_physic_pct'] ?? 0,
            ':match_nbv_value'     => $payload['match_nbv_value'] ?? 0,
            ':match_nbv_pct'       => $payload['match_nbv_pct'] ?? 0,
            ':physic_physic_qty'   => $payload['physic_physic_qty'] ?? 0,
            ':physic_physic_pct'   => $payload['physic_physic_pct'] ?? 0,
            ':physic_nbv_value'    => $payload['physic_nbv_value'] ?? 0,
            ':physic_nbv_pct'      => $payload['physic_nbv_pct'] ?? 0,
            ':db_physic_qty'       => $payload['db_physic_qty'] ?? 0,
            ':db_physic_pct'       => $payload['db_physic_pct'] ?? 0,
            ':db_nbv_value'        => $payload['db_nbv_value'] ?? 0,
            ':db_nbv_pct'          => $payload['db_nbv_pct'] ?? 0,
            ':total_physic_actual' => $payload['total_physic_actual'] ?? 0,
            ':total_physic_target' => $payload['total_physic_target'] ?? 0,
            ':total_physic_pct'    => $payload['total_physic_pct'] ?? 0,
            ':total_nbv_actual'    => $payload['total_nbv_actual'] ?? 0,
            ':total_nbv_target'    => $payload['total_nbv_target'] ?? 0,
            ':total_nbv_pct'       => $payload['total_nbv_pct'] ?? 0,
        ]);

        $newId = $stmt->fetchColumn();

        echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Record created successfully']);
        exit;
    }

    if ($method === 'DELETE') {
        // CSRF check
        session_start();
        $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (empty($csrfHeader) || !hash_equals($_SESSION['csrf_token'] ?? '', $csrfHeader)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
            exit;
        }

        $id = $_GET['id'] ?? null;
        $action = $_GET['action'] ?? '';

        if ($action === 'clear_all' || $id === 'all') {
            $db->exec('TRUNCATE TABLE asset_reconciliation RESTART IDENTITY');
            echo json_encode(['success' => true, 'message' => 'All reconciliation records cleared successfully']);
            exit;
        }

        if ($action === 'bulk_delete') {
            $month = isset($_GET['month']) && is_numeric($_GET['month']) ? (int) $_GET['month'] : 0;
            $year = isset($_GET['year']) && is_numeric($_GET['year']) ? (int) $_GET['year'] : 0;

            if ($month <= 0 && $year <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Please select a valid Month or Year to delete']);
                exit;
            }

            $conditions = [];
            $params = [];

            if ($month >= 1 && $month <= 12 && $year >= 2000 && $year <= 2100) {
                $conditions[] = '((EXTRACT(MONTH FROM period_start) = :m AND EXTRACT(YEAR FROM period_start) = :y) OR (EXTRACT(MONTH FROM period_end) = :m AND EXTRACT(YEAR FROM period_end) = :y))';
                $params[':m'] = $month;
                $params[':y'] = $year;
            } elseif ($year >= 2000 && $year <= 2100) {
                $conditions[] = '(EXTRACT(YEAR FROM period_start) = :y OR EXTRACT(YEAR FROM period_end) = :y)';
                $params[':y'] = $year;
            } elseif ($month >= 1 && $month <= 12) {
                $conditions[] = '(EXTRACT(MONTH FROM period_start) = :m OR EXTRACT(MONTH FROM period_end) = :m)';
                $params[':m'] = $month;
            }

            $sql = 'DELETE FROM asset_reconciliation WHERE ' . implode(' AND ', $conditions);
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $deletedCount = $stmt->rowCount();

            echo json_encode([
                'success' => true,
                'deleted_count' => $deletedCount,
                'message' => "Successfully deleted {$deletedCount} records for the selected period."
            ]);
            exit;
        }

        if (!$id || !ctype_digit((string) $id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid record ID is required']);
            exit;
        }

        $stmt = $db->prepare('DELETE FROM asset_reconciliation WHERE id = :id');
        $stmt->execute([':id' => (int) $id]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Record deleted successfully']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Record not found']);
        }
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
