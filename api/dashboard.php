<?php
/**
 * Dashboard Summary API
 * 
 * Returns aggregated statistics for the dashboard overview.
 */

require_once __DIR__ . '/../config/database.php';

// Security headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    $db = getDbConnection();

    // Total assets
    $totalAssets = (int) $db->query('SELECT COUNT(*) FROM master_assets')->fetchColumn();

    // Total periods
    $totalPeriods = (int) $db->query('SELECT COUNT(*) FROM asset_periods')->fetchColumn();

    // Total acquisition value
    $totalValue = (float) $db->query(
        'SELECT COALESCE(SUM(acquisition_value), 0) FROM master_assets'
    )->fetchColumn();

    // Total book value
    $totalBookValue = (float) $db->query(
        'SELECT COALESCE(SUM(book_value), 0) FROM master_assets'
    )->fetchColumn();

    // Recent imports
    $stmt = $db->query('
        SELECT il.*, ap.label as period_label
        FROM import_logs il
        JOIN asset_periods ap ON il.period_id = ap.id
        ORDER BY il.imported_at DESC
        LIMIT 5
    ');
    $recentImports = $stmt->fetchAll();

    // Assets by category
    $stmt = $db->query('
        SELECT category, COUNT(*) as count, 
               COALESCE(SUM(acquisition_value), 0) as total_value
        FROM master_assets
        WHERE category IS NOT NULL AND category != \'\'
        GROUP BY category
        ORDER BY count DESC
        LIMIT 10
    ');
    $byCategory = $stmt->fetchAll();

    // Assets by condition
    $stmt = $db->query('
        SELECT condition, COUNT(*) as count
        FROM master_assets
        WHERE condition IS NOT NULL AND condition != \'\'
        GROUP BY condition
        ORDER BY count DESC
    ');
    $byCondition = $stmt->fetchAll();

    // Assets by period (for chart)
    $stmt = $db->query('
        SELECT ap.label, ap.year, ap.month, COUNT(ma.id) as asset_count,
               COALESCE(SUM(ma.acquisition_value), 0) as total_value
        FROM asset_periods ap
        LEFT JOIN master_assets ma ON ap.id = ma.period_id
        GROUP BY ap.id, ap.label, ap.year, ap.month
        ORDER BY ap.year ASC, ap.month ASC
    ');
    $byPeriod = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => [
            'total_assets'     => $totalAssets,
            'total_periods'    => $totalPeriods,
            'total_value'      => $totalValue,
            'total_book_value' => $totalBookValue,
            'recent_imports'   => $recentImports,
            'by_category'      => $byCategory,
            'by_condition'     => $byCondition,
            'by_period'        => $byPeriod,
        ],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('Dashboard API error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load dashboard data.',
    ]);
}
