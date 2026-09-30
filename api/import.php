<?php
/**
 * Excel Import API Endpoint
 * 
 * Handles uploading and parsing Excel files (.xlsx, .xls),
 * mapping them to a selected period (month/year).
 *
 * Security measures:
 * - File type validation (extension + magic bytes via PhpSpreadsheet)
 * - File size limit (10MB default)
 * - Unique filename generation (UUID-based)
 * - Files stored outside web root (in uploads/ with .htaccess deny)
 * - CSRF token validation
 * - Parameterized SQL queries
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';

use PhpOffice\PhpSpreadsheet\IOFactory;

// Security headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Validate CSRF token
$csrfToken = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (empty($csrfToken) || !hash_equals($_SESSION['csrf_token'] ?? '', $csrfToken)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
    exit;
}

// Validate period selection
$periodId = isset($_POST['period_id']) ? (int) $_POST['period_id'] : 0;
if ($periodId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please select a valid period']);
    exit;
}

// Validate file upload
if (!isset($_FILES['excel_file']) || $_FILES['excel_file']['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Server missing temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
    ];
    $errorCode = $_FILES['excel_file']['error'] ?? UPLOAD_ERR_NO_FILE;
    $msg = $errorMessages[$errorCode] ?? 'Unknown upload error';
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $msg]);
    exit;
}

$file = $_FILES['excel_file'];

// Validate file size (10MB max)
$maxSize = (int) getDbConfig('UPLOAD_MAX_SIZE', '10485760');
if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'File size exceeds 10MB limit']);
    exit;
}

// Validate file extension (allow-list)
$originalName = basename($file['name']);
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowedExtensions = ['xlsx', 'xls'];
if (!in_array($extension, $allowedExtensions, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Only .xlsx and .xls files are allowed']);
    exit;
}

// Generate unique filename
$storedFilename = bin2hex(random_bytes(16)) . '.' . $extension;
$uploadDir = __DIR__ . '/../uploads/';

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0750, true);
}

// Create .htaccess to deny direct access to uploads
$htaccess = $uploadDir . '.htaccess';
if (!file_exists($htaccess)) {
    file_put_contents($htaccess, "Deny from all\n");
}

$storedPath = $uploadDir . $storedFilename;

if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file']);
    exit;
}

try {
    $db = getDbConnection();

    // Verify period exists
    $stmt = $db->prepare('SELECT id FROM asset_periods WHERE id = :id');
    $stmt->execute(['id' => $periodId]);
    if (!$stmt->fetch()) {
        // Clean up uploaded file
        if (file_exists($storedPath)) {
            unlink($storedPath);
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Selected period does not exist']);
        exit;
    }

    // Parse Excel file using PhpSpreadsheet (validates file structure/magic bytes)
    $spreadsheet = IOFactory::load($storedPath);
    $worksheet = $spreadsheet->getActiveSheet();
    $rows = $worksheet->toArray(null, true, true, true);

    if (count($rows) < 2) {
        if (file_exists($storedPath)) {
            unlink($storedPath);
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Excel file is empty or has no data rows']);
        exit;
    }

    // Extract headers from first row (case-insensitive mapping)
    $headerRow = array_shift($rows);
    $headerMap = [];
    foreach ($headerRow as $col => $value) {
        if ($value !== null) {
            $headerMap[strtolower(trim((string) $value))] = $col;
        }
    }

    // Column mapping: expected header => database field
    $columnMapping = [
        'asset number'      => 'asset_number',
        'asset_number'      => 'asset_number',
        'no asset'          => 'asset_number',
        'nomor asset'       => 'asset_number',
        'asset name'        => 'asset_name',
        'asset_name'        => 'asset_name',
        'nama asset'        => 'asset_name',
        'name'              => 'asset_name',
        'category'          => 'category',
        'kategori'          => 'category',
        'location'          => 'location',
        'lokasi'            => 'location',
        'condition'         => 'condition',
        'kondisi'           => 'condition',
        'acquisition date'  => 'acquisition_date',
        'acquisition_date'  => 'acquisition_date',
        'tanggal perolehan' => 'acquisition_date',
        'purchase date'     => 'acquisition_date',
        'acquisition value' => 'acquisition_value',
        'acquisition_value' => 'acquisition_value',
        'nilai perolehan'   => 'acquisition_value',
        'harga perolehan'   => 'acquisition_value',
        'book value'        => 'book_value',
        'book_value'        => 'book_value',
        'nilai buku'        => 'book_value',
        'useful life'       => 'useful_life',
        'useful_life'       => 'useful_life',
        'masa manfaat'      => 'useful_life',
        'umur manfaat'      => 'useful_life',
        'description'       => 'description',
        'deskripsi'         => 'description',
        'keterangan'        => 'description',
    ];

    // Resolve which Excel columns map to which DB fields
    $resolvedMap = [];
    foreach ($columnMapping as $header => $field) {
        if (isset($headerMap[$header])) {
            $resolvedMap[$field] = $headerMap[$header];
        }
    }

    // Must have at minimum asset_number or asset_name
    if (!isset($resolvedMap['asset_number']) && !isset($resolvedMap['asset_name'])) {
        if (file_exists($storedPath)) {
            unlink($storedPath);
        }
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Could not find required columns. Please ensure the Excel file has headers like "Asset Number" or "Asset Name".',
            'detected_headers' => array_values(array_filter(array_map('trim', array_map('strval', $headerRow)))),
        ]);
        exit;
    }

    // Insert data rows
    $insertStmt = $db->prepare('
        INSERT INTO master_assets 
            (period_id, asset_number, asset_name, category, location, condition, 
             acquisition_date, acquisition_value, book_value, useful_life, description)
        VALUES 
            (:period_id, :asset_number, :asset_name, :category, :location, :condition,
             :acquisition_date, :acquisition_value, :book_value, :useful_life, :description)
    ');

    $rowsImported = 0;
    $rowsFailed = 0;
    $errorDetails = [];

    $db->beginTransaction();

    foreach ($rows as $rowIndex => $row) {
        // Skip completely empty rows
        $rowValues = array_filter($row, fn($v) => $v !== null && trim((string)$v) !== '');
        if (empty($rowValues)) {
            continue;
        }

        try {
            $data = [
                'period_id'         => $periodId,
                'asset_number'      => '',
                'asset_name'        => '',
                'category'          => '',
                'location'          => '',
                'condition'         => '',
                'acquisition_date'  => null,
                'acquisition_value' => 0,
                'book_value'        => 0,
                'useful_life'       => null,
                'description'       => '',
            ];

            foreach ($resolvedMap as $field => $col) {
                $val = isset($row[$col]) ? trim((string) $row[$col]) : '';

                if ($val === '') {
                    continue;
                }

                switch ($field) {
                    case 'acquisition_value':
                    case 'book_value':
                        // Remove currency formatting
                        $data[$field] = (float) preg_replace('/[^0-9.\-]/', '', $val);
                        break;
                    case 'useful_life':
                        $data[$field] = (int) preg_replace('/[^0-9]/', '', $val);
                        break;
                    case 'acquisition_date':
                        // Try to parse various date formats
                        $timestamp = strtotime($val);
                        if ($timestamp !== false) {
                            $data[$field] = date('Y-m-d', $timestamp);
                        }
                        break;
                    default:
                        $data[$field] = $val;
                }
            }

            $insertStmt->execute($data);
            $rowsImported++;
        } catch (Throwable $e) {
            $rowsFailed++;
            $errorDetails[] = "Row $rowIndex: " . $e->getMessage();
            if (count($errorDetails) > 50) {
                $errorDetails[] = '... (truncated, too many errors)';
                break;
            }
        }
    }

    $db->commit();

    // Log the import
    $logStmt = $db->prepare('
        INSERT INTO import_logs 
            (period_id, original_filename, stored_filename, rows_imported, rows_failed, status, error_details)
        VALUES 
            (:period_id, :original_filename, :stored_filename, :rows_imported, :rows_failed, :status, :error_details)
    ');
    $logStmt->execute([
        'period_id'         => $periodId,
        'original_filename' => $originalName,
        'stored_filename'   => $storedFilename,
        'rows_imported'     => $rowsImported,
        'rows_failed'       => $rowsFailed,
        'status'            => $rowsFailed > 0 ? 'partial' : 'completed',
        'error_details'     => !empty($errorDetails) ? implode("\n", $errorDetails) : null,
    ]);

    echo json_encode([
        'success'       => true,
        'rows_imported' => $rowsImported,
        'rows_failed'   => $rowsFailed,
        'message'       => "$rowsImported rows imported successfully" .
                          ($rowsFailed > 0 ? ", $rowsFailed rows failed" : ''),
    ]);

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    // Clean up uploaded file on error
    if (file_exists($storedPath)) {
        unlink($storedPath);
    }
    http_response_code(500);
    error_log('Excel import error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Failed to process Excel file. Please check the file format.',
    ]);
}
