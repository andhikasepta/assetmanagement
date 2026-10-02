<?php
/**
 * Excel Sheet Inspector API Endpoint
 * Reads worksheet names from an uploaded Excel file.
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';

use PhpOffice\PhpSpreadsheet\IOFactory;

ini_set('display_errors', '0');
error_reporting(E_ALL);
ini_set('memory_limit', '1024M');
set_time_limit(120);

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

// CSRF check
$csrfToken = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (empty($csrfToken) || !hash_equals($_SESSION['csrf_token'] ?? '', $csrfToken)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
    exit;
}

if (!isset($_FILES['excel_file']) || $_FILES['excel_file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No valid Excel file was uploaded']);
    exit;
}

$file = $_FILES['excel_file'];
$extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($extension, ['xlsx', 'xls'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Only .xlsx and .xls files are allowed']);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0750, true);
}

// Unique token for this file
$fileToken = bin2hex(random_bytes(16)) . '.' . $extension;
$destPath = $uploadDir . $fileToken;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file']);
    exit;
}

try {
    $reader = IOFactory::createReaderForFile($destPath);
    $sheets = $reader->listWorksheetNames($destPath);

    if (empty($sheets)) {
        $sheets = ['Sheet1'];
    }

    echo json_encode([
        'success'    => true,
        'sheets'     => array_values($sheets),
        'file_token' => $fileToken,
        'filename'   => $file['name'],
        'size'       => $file['size']
    ]);
    exit;

} catch (Throwable $e) {
    if (file_exists($destPath)) {
        unlink($destPath);
    }
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Could not read sheets from Excel file: ' . $e->getMessage()
    ]);
    exit;
}
