<?php
/**
 * Master Assets API Endpoint
 * 
 * Handles CRUD operations and DataTables server-side processing for master_assets.
 * 
 * GET  - Server-side processing for DataTables (with search, sort, pagination)
 * POST - Create a new asset record
 * PUT  - Update an existing asset record
 * DELETE - Delete an asset record
 */

require_once __DIR__ . '/../config/database.php';

// Security headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

session_start();

/**
 * Validate CSRF token for state-changing requests
 */
function validateCsrf(): void
{
    $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($csrfToken) || !hash_equals($_SESSION['csrf_token'] ?? '', $csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    switch ($method) {
        case 'GET':
            handleDataTablesRequest($db);
            break;

        case 'POST':
            validateCsrf();
            handleCreate($db);
            break;

        case 'PUT':
            validateCsrf();
            handleUpdate($db);
            break;

        case 'DELETE':
            validateCsrf();
            handleDelete($db);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    error_log('Assets API error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while processing the request.',
    ]);
}

/**
 * Handle DataTables server-side processing request.
 */
function handleDataTablesRequest(PDO $db): void
{
    $draw   = (int) ($_GET['draw'] ?? 1);
    $start  = (int) ($_GET['start'] ?? 0);
    $length = (int) ($_GET['length'] ?? 25);
    $search = $_GET['search']['value'] ?? '';
    $periodId = isset($_GET['period_id']) ? (int) $_GET['period_id'] : null;

    // Validate pagination bounds
    $start  = max(0, $start);
    $length = min(max(1, $length), 100);

    // Build column mapping for sorting
    $columns = [
        0 => 'ma.id',
        1 => 'ma.asset_number',
        2 => 'ma.asset_name',
        3 => 'ma.category',
        4 => 'ma.location',
        5 => 'ma.condition',
        6 => 'ma.acquisition_date',
        7 => 'ma.acquisition_value',
        8 => 'ma.book_value',
        9 => 'ap.label',
    ];

    // Get sort parameters
    $orderCol = (int) ($_GET['order'][0]['column'] ?? 0);
    $orderDir = strtolower($_GET['order'][0]['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';
    $orderColumn = $columns[$orderCol] ?? 'ma.id';

    // Base query
    $baseQuery = 'FROM master_assets ma JOIN asset_periods ap ON ma.period_id = ap.id';
    $conditions = [];
    $params = [];

    // Period filter
    if ($periodId !== null && $periodId > 0) {
        $conditions[] = 'ma.period_id = :period_id';
        $params['period_id'] = $periodId;
    }

    // Search filter using parameterized query
    if ($search !== '') {
        $conditions[] = '(ma.asset_number ILIKE :search OR ma.asset_name ILIKE :search 
                         OR ma.category ILIKE :search OR ma.location ILIKE :search 
                         OR ma.condition ILIKE :search)';
        $params['search'] = '%' . $search . '%';
    }

    $whereClause = '';
    if (!empty($conditions)) {
        $whereClause = ' WHERE ' . implode(' AND ', $conditions);
    }

    // Total records (unfiltered)
    $totalQuery = 'SELECT COUNT(*) FROM master_assets';
    $stmt = $db->query($totalQuery);
    $totalRecords = (int) $stmt->fetchColumn();

    // Filtered records count
    $filteredQuery = "SELECT COUNT(*) $baseQuery $whereClause";
    $stmt = $db->prepare($filteredQuery);
    $stmt->execute($params);
    $filteredRecords = (int) $stmt->fetchColumn();

    // Data query with pagination
    $dataQuery = "SELECT ma.*, ap.label as period_label $baseQuery $whereClause 
                  ORDER BY $orderColumn $orderDir LIMIT :limit OFFSET :offset";
    $stmt = $db->prepare($dataQuery);
    foreach ($params as $key => $value) {
        $stmt->bindValue(":$key", $value);
    }
    $stmt->bindValue(':limit', $length, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $start, PDO::PARAM_INT);
    $stmt->execute();
    $data = $stmt->fetchAll();

    echo json_encode([
        'draw'            => $draw,
        'recordsTotal'    => $totalRecords,
        'recordsFiltered' => $filteredRecords,
        'data'            => $data,
    ]);
}

/**
 * Handle creating a new asset record.
 */
function handleCreate(PDO $db): void
{
    $input = json_decode(file_get_contents('php://input'), true);

    $required = ['period_id', 'asset_number', 'asset_name'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            return;
        }
    }

    $stmt = $db->prepare('
        INSERT INTO master_assets 
            (period_id, asset_number, asset_name, category, location, condition, 
             acquisition_date, acquisition_value, book_value, useful_life, description)
        VALUES 
            (:period_id, :asset_number, :asset_name, :category, :location, :condition,
             :acquisition_date, :acquisition_value, :book_value, :useful_life, :description)
        RETURNING id
    ');

    $stmt->execute([
        'period_id'         => (int) $input['period_id'],
        'asset_number'      => trim($input['asset_number']),
        'asset_name'        => trim($input['asset_name']),
        'category'          => trim($input['category'] ?? ''),
        'location'          => trim($input['location'] ?? ''),
        'condition'         => trim($input['condition'] ?? ''),
        'acquisition_date'  => $input['acquisition_date'] ?? null,
        'acquisition_value' => (float) ($input['acquisition_value'] ?? 0),
        'book_value'        => (float) ($input['book_value'] ?? 0),
        'useful_life'       => isset($input['useful_life']) ? (int) $input['useful_life'] : null,
        'description'       => trim($input['description'] ?? ''),
    ]);

    $id = $stmt->fetchColumn();
    echo json_encode(['success' => true, 'id' => $id, 'message' => 'Asset created successfully']);
}

/**
 * Handle updating an existing asset record.
 */
function handleUpdate(PDO $db): void
{
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing asset ID']);
        return;
    }

    $stmt = $db->prepare('
        UPDATE master_assets SET
            asset_number = :asset_number,
            asset_name = :asset_name,
            category = :category,
            location = :location,
            condition = :condition,
            acquisition_date = :acquisition_date,
            acquisition_value = :acquisition_value,
            book_value = :book_value,
            useful_life = :useful_life,
            description = :description,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :id
    ');

    $stmt->execute([
        'id'                => (int) $input['id'],
        'asset_number'      => trim($input['asset_number'] ?? ''),
        'asset_name'        => trim($input['asset_name'] ?? ''),
        'category'          => trim($input['category'] ?? ''),
        'location'          => trim($input['location'] ?? ''),
        'condition'         => trim($input['condition'] ?? ''),
        'acquisition_date'  => $input['acquisition_date'] ?? null,
        'acquisition_value' => (float) ($input['acquisition_value'] ?? 0),
        'book_value'        => (float) ($input['book_value'] ?? 0),
        'useful_life'       => isset($input['useful_life']) ? (int) $input['useful_life'] : null,
        'description'       => trim($input['description'] ?? ''),
    ]);

    echo json_encode(['success' => true, 'message' => 'Asset updated successfully']);
}

/**
 * Handle deleting an asset record.
 */
function handleDelete(PDO $db): void
{
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing asset ID']);
        return;
    }

    $stmt = $db->prepare('DELETE FROM master_assets WHERE id = :id');
    $stmt->execute(['id' => (int) $input['id']]);

    echo json_encode(['success' => true, 'message' => 'Asset deleted successfully']);
}
