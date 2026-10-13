<?php
/**
 * Migration API Endpoint
 * 
 * Provides HTTP interface for running migrations from the dashboard.
 * POST /api/migrate.php with action parameter.
 * 
 * TODO(security): In production, protect this endpoint with authentication
 * and restrict access to admin users only.
 */

require_once __DIR__ . '/../database/Migrator.php';
require_once __DIR__ . '/../includes/security.php';

sendSecurityHeaders();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// CSRF & Admin Authentication check
validateCsrfToken();
requireAuth();

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

$allowedActions = ['migrate', 'rollback', 'status', 'refresh'];
if (!in_array($action, $allowedActions, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
    exit;
}

try {
    $migrator = new Migrator();

    switch ($action) {
        case 'migrate':
            $result = $migrator->migrate();
            echo json_encode([
                'success' => true,
                'applied' => $result['applied'],
                'errors'  => $result['errors'],
            ]);
            break;

        case 'rollback':
            $result = $migrator->rollback();
            echo json_encode([
                'success' => true,
                'rolledBack' => $result['rolledBack'],
                'errors'     => $result['errors'],
            ]);
            break;

        case 'status':
            $status = $migrator->status();
            echo json_encode([
                'success' => true,
                'migrations' => $status,
            ]);
            break;

        case 'refresh':
            $maxAttempts = 20;
            $attempt = 0;
            do {
                $rbResult = $migrator->rollback();
                $attempt++;
            } while (!empty($rbResult['rolledBack']) && $attempt < $maxAttempts);

            $result = $migrator->migrate();
            echo json_encode([
                'success' => true,
                'applied' => $result['applied'],
                'errors'  => $result['errors'],
            ]);
            break;
    }
} catch (Throwable $e) {
    http_response_code(500);
    error_log('Migration API error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Migration operation failed. Check server logs.',
    ]);
}
