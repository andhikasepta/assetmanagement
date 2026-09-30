<?php
/**
 * Periods API Endpoint
 * 
 * Handles CRUD operations for asset period groupings (month/year).
 */

require_once __DIR__ . '/../config/database.php';

// Security headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

session_start();

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    switch ($method) {
        case 'GET':
            handleGetPeriods($db);
            break;

        case 'POST':
            validateCsrf();
            handleCreatePeriod($db);
            break;

        case 'DELETE':
            validateCsrf();
            handleDeletePeriod($db);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    error_log('Periods API error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while processing the request.',
    ]);
}

function validateCsrf(): void
{
    $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($csrfToken) || !hash_equals($_SESSION['csrf_token'] ?? '', $csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
}

/**
 * Get all periods, sorted by year DESC, month DESC.
 */
function handleGetPeriods(PDO $db): void
{
    $stmt = $db->query('
        SELECT ap.*, 
               COUNT(ma.id) as asset_count
        FROM asset_periods ap
        LEFT JOIN master_assets ma ON ap.id = ma.period_id
        GROUP BY ap.id
        ORDER BY ap.year DESC, ap.month DESC
    ');
    $periods = $stmt->fetchAll();

    echo json_encode(['success' => true, 'data' => $periods]);
}

/**
 * Create or find an existing period.
 */
function handleCreatePeriod(PDO $db): void
{
    $input = json_decode(file_get_contents('php://input'), true);

    $month = isset($input['month']) ? (int) $input['month'] : 0;
    $year  = isset($input['year']) ? (int) $input['year'] : 0;

    if ($month < 1 || $month > 12 || $year < 2000 || $year > 2100) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid month or year']);
        return;
    }

    $monthNames = [
        1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
        5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
        9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December',
    ];
    $label = $monthNames[$month] . ' ' . $year;

    // Upsert: insert or return existing
    $stmt = $db->prepare('
        INSERT INTO asset_periods (month, year, label)
        VALUES (:month, :year, :label)
        ON CONFLICT (month, year) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id, month, year, label
    ');
    $stmt->execute(['month' => $month, 'year' => $year, 'label' => $label]);
    $period = $stmt->fetch();

    echo json_encode(['success' => true, 'data' => $period]);
}

/**
 * Delete a period (cascade deletes assets and import logs).
 */
function handleDeletePeriod(PDO $db): void
{
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing period ID']);
        return;
    }

    $stmt = $db->prepare('DELETE FROM asset_periods WHERE id = :id');
    $stmt->execute(['id' => (int) $input['id']]);

    echo json_encode(['success' => true, 'message' => 'Period deleted successfully']);
}
