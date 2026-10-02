<?php
/**
 * Site Regional API Endpoint
 * Handles CRUD operations for Site Regional master data
 * Supports categories: monthly_outlet, monthly_pmd, quarterly_outlet, quarterly_pmd
 */

require_once __DIR__ . '/../config/database.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);
ini_set('memory_limit', '1024M');
set_time_limit(300);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    // Auto-create table if not exists
    $db->exec('
        CREATE TABLE IF NOT EXISTS site_regional (
            id SERIAL PRIMARY KEY,
            category VARCHAR(30) NOT NULL DEFAULT \'monthly_outlet\',
            regional VARCHAR(200) DEFAULT \'\',
            dept VARCHAR(200) DEFAULT \'\',
            sub_dept VARCHAR(200) DEFAULT \'\',
            sitecode VARCHAR(100) DEFAULT \'\',
            name_site VARCHAR(255) DEFAULT \'\',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_site_regional_category ON site_regional (category);
        CREATE INDEX IF NOT EXISTS idx_site_regional_sitecode ON site_regional (sitecode);
    ');

    if ($method === 'GET') {
        $category = trim($_GET['category'] ?? 'monthly_outlet');
        $search   = trim($_GET['search'] ?? '');
        $sortCol  = $_GET['sort'] ?? 'sitecode';
        $sortDir  = strtolower($_GET['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

        $allowedCategories = ['monthly_outlet', 'monthly_pmd', 'quarterly', 'quarterly_outlet', 'quarterly_pmd'];
        if (!in_array($category, $allowedCategories, true)) {
            $category = 'monthly_outlet';
        }

        $allowedSorts = ['id', 'regional', 'dept', 'sub_dept', 'sitecode', 'name_site'];
        if (!in_array($sortCol, $allowedSorts, true)) {
            $sortCol = 'sitecode';
        }

        $params = [':category' => $category];
        $whereSql = 'WHERE category = :category';

        if ($search !== '') {
            $whereSql .= '
                AND (regional ILIKE :s
                  OR dept ILIKE :s
                  OR sub_dept ILIKE :s
                  OR sitecode ILIKE :s
                  OR name_site ILIKE :s)
            ';
            $params[':s'] = '%' . $search . '%';
        }

        $stmt = $db->prepare("
            SELECT id, category, regional, dept, sub_dept, sitecode, name_site
            FROM site_regional
            $whereSql
            ORDER BY $sortCol $sortDir, id ASC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        echo json_encode([
            'success'  => true,
            'data'     => $rows,
            'total'    => count($rows),
            'category' => $category
        ]);
        exit;
    }

    // CSRF check for state-changing requests
    session_start();
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
    if (empty($csrfHeader) || !hash_equals($_SESSION['csrf_token'] ?? '', $csrfHeader)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }

    if ($method === 'POST') {
        $action   = $_GET['action'] ?? $_POST['action'] ?? '';
        $category = $_POST['category'] ?? $_GET['category'] ?? 'monthly_outlet';

        $allowedCategories = ['monthly_outlet', 'monthly_pmd', 'quarterly', 'quarterly_outlet', 'quarterly_pmd'];
        if (!in_array($category, $allowedCategories, true)) {
            $category = 'monthly_outlet';
        }

        // ── Handle Excel Import ─────────────────────────────────────
        if ($action === 'import' || isset($_FILES['excel_file'])) {
            require_once __DIR__ . '/../vendor/autoload.php';

            if (!class_exists('ZipArchive')) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'PHP zip extension is not enabled. Please reload php.ini.',
                ]);
                exit;
            }

            $uploadDir = __DIR__ . '/../uploads/';
            $tempPath = null;

            if (!empty($_POST['file_token'])) {
                $token = basename($_POST['file_token']);
                $candidate = $uploadDir . $token;
                if (file_exists($candidate) && is_file($candidate)) {
                    $tempPath = $candidate;
                }
            }

            if (!$tempPath) {
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

                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0750, true);
                }

                $tempPath = $uploadDir . bin2hex(random_bytes(16)) . '.' . $extension;
                if (!move_uploaded_file($file['tmp_name'], $tempPath)) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file']);
                    exit;
                }
            }

            try {
                $selectedSheetName = trim($_POST['sheet_name'] ?? '');

                $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($tempPath);
                $reader->setReadDataOnly(true);
                if ($selectedSheetName !== '') {
                    $reader->setLoadSheetsOnly($selectedSheetName);
                }
                $spreadsheet = $reader->load($tempPath);

                if ($selectedSheetName !== '' && $spreadsheet->sheetNameExists($selectedSheetName)) {
                    $sheet = $spreadsheet->getSheetByName($selectedSheetName);
                } else {
                    $sheet = $spreadsheet->getActiveSheet();
                }
                $rawRows = $sheet->toArray(null, true, true, true);

                if (count($rawRows) < 2) {
                    if (file_exists($tempPath)) unlink($tempPath);
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Excel file is empty or missing data rows']);
                    exit;
                }

                // Convert to indexed array
                $rows = [];
                foreach ($rawRows as $r) {
                    $rows[] = array_values($r);
                }

                // Identify header rows
                $dataStartIndex = 1;
                $maxCols = 0;
                for ($i = 0; $i < min(6, count($rows)); $i++) {
                    $maxCols = max($maxCols, count($rows[$i] ?? []));
                    $rowStr = strtolower(implode(' ', array_map('strval', $rows[$i])));
                    if (str_contains($rowStr, 'regional') || str_contains($rowStr, 'dept') || str_contains($rowStr, 'sitecode') || str_contains($rowStr, 'name site') || str_contains($rowStr, 'sub dept')) {
                        $dataStartIndex = $i + 1;
                    }
                }

                // Composite header detection
                $compositeHeaders = [];
                for ($c = 0; $c < $maxCols; $c++) {
                    $parts = [];
                    $lastVal = '';
                    for ($i = 0; $i < $dataStartIndex; $i++) {
                        $val = trim((string)($rows[$i][$c] ?? ''));
                        if ($val !== '') {
                            $lastVal = $val;
                        }
                        if ($lastVal !== '') {
                            $parts[] = $lastVal;
                        }
                    }
                    $compositeHeaders[$c] = strtolower(implode(' ', $parts));
                }

                // Map database columns to excel column index
                $map = [];
                foreach ($compositeHeaders as $c => $h) {
                    if (str_contains($h, 'regional') && !isset($map['regional'])) {
                        $map['regional'] = $c;
                    } elseif ((str_contains($h, 'sub dept') || str_contains($h, 'sub_dept') || str_contains($h, 'subdept')) && !isset($map['sub_dept'])) {
                        $map['sub_dept'] = $c;
                    } elseif (str_contains($h, 'dept') && !str_contains($h, 'sub') && !isset($map['dept'])) {
                        $map['dept'] = $c;
                    } elseif ((str_contains($h, 'sitecode') || str_contains($h, 'site code') || str_contains($h, 'site_code')) && !isset($map['sitecode'])) {
                        $map['sitecode'] = $c;
                    } elseif ((str_contains($h, 'name site') || str_contains($h, 'name_site') || str_contains($h, 'namesite')) && !isset($map['name_site'])) {
                        $map['name_site'] = $c;
                    }
                }

                // Fallback positional mapping
                if (!isset($map['regional']))  $map['regional']  = 0;
                if (!isset($map['dept']))      $map['dept']      = 1;
                if (!isset($map['sub_dept']))   $map['sub_dept']   = 2;
                if (!isset($map['sitecode']))  $map['sitecode']  = 3;
                if (!isset($map['name_site'])) $map['name_site'] = 4;

                // Handle replace existing checkbox
                $replaceExisting = isset($_POST['replace_existing']) && $_POST['replace_existing'] === '1';

                $db->beginTransaction();

                if ($replaceExisting) {
                    // Only delete entries for this specific category
                    $delStmt = $db->prepare('DELETE FROM site_regional WHERE category = :cat');
                    $delStmt->execute([':cat' => $category]);
                }

                $stmt = $db->prepare('
                    INSERT INTO site_regional (category, regional, dept, sub_dept, sitecode, name_site)
                    VALUES (:category, :regional, :dept, :sub_dept, :sitecode, :name_site)
                ');

                $importedCount = 0;
                for ($i = $dataStartIndex; $i < count($rows); $i++) {
                    $row = $rows[$i];
                    // Try to detect the sitecode or first non-empty field
                    $sitecode = trim((string)($row[$map['sitecode']] ?? ''));
                    $regional = trim((string)($row[$map['regional']] ?? ''));
                    // Skip completely empty rows or total rows
                    if ($sitecode === '' && $regional === '') {
                        continue;
                    }
                    if (strtolower($sitecode) === 'total' || strtolower($regional) === 'total') {
                        continue;
                    }

                    $stmt->execute([
                        ':category'  => $category,
                        ':regional'  => $regional,
                        ':dept'      => trim((string)($row[$map['dept']] ?? '')),
                        ':sub_dept'  => trim((string)($row[$map['sub_dept']] ?? '')),
                        ':sitecode'  => $sitecode,
                        ':name_site' => trim((string)($row[$map['name_site']] ?? '')),
                    ]);
                    $importedCount++;
                }

                $db->commit();

                if (file_exists($tempPath)) {
                    unlink($tempPath);
                }

                $categoryLabels = [
                    'monthly_outlet'   => 'Monthly - Outlet Regional',
                    'monthly_pmd'      => 'Monthly - PMD',
                    'quarterly'        => 'Quarterly',
                    'quarterly_outlet' => 'Quarterly - Outlet Regional',
                    'quarterly_pmd'    => 'Quarterly - PMD',
                ];
                $catLabel = $categoryLabels[$category] ?? $category;

                echo json_encode([
                    'success'        => true,
                    'imported_count' => $importedCount,
                    'message'        => "Successfully imported {$importedCount} records into {$catLabel}"
                ]);
                exit;

            } catch (Throwable $e) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                if (file_exists($tempPath)) {
                    unlink($tempPath);
                }
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Excel processing error: ' . $e->getMessage()]);
                exit;
            }
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Unknown POST action']);
        exit;
    }

    if ($method === 'DELETE') {
        $action = $_GET['action'] ?? '';

        // Bulk delete multiple records by IDs
        if ($action === 'bulk_delete') {
            $raw = file_get_contents('php://input');
            $payload = json_decode($raw, true) ?? [];
            $ids = $payload['ids'] ?? [];

            if (empty($ids) && !empty($_GET['ids'])) {
                $ids = explode(',', $_GET['ids']);
            }

            $validIds = array_values(array_filter(array_map(function($v) {
                return (is_numeric($v) && (int)$v > 0) ? (int)$v : null;
            }, (array)$ids)));

            if (empty($validIds)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No valid record IDs provided for deletion']);
                exit;
            }

            $placeholders = implode(',', array_fill(0, count($validIds), '?'));
            $stmt = $db->prepare("DELETE FROM site_regional WHERE id IN ($placeholders)");
            $stmt->execute($validIds);

            $deletedCount = $stmt->rowCount();

            echo json_encode([
                'success'       => true,
                'message'       => "Successfully deleted {$deletedCount} record(s)",
                'deleted_count' => $deletedCount
            ]);
            exit;
        }

        // Delete all records in a specific category
        if ($action === 'clear_category') {
            $category = $_GET['category'] ?? '';
            $allowedCategories = ['monthly_outlet', 'monthly_pmd', 'quarterly', 'quarterly_outlet', 'quarterly_pmd'];
            if (!in_array($category, $allowedCategories, true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid category']);
                exit;
            }

            $stmt = $db->prepare('DELETE FROM site_regional WHERE category = :cat');
            $stmt->execute([':cat' => $category]);
            $deletedCount = $stmt->rowCount();

            echo json_encode([
                'success'       => true,
                'message'       => "Cleared {$deletedCount} records from category",
                'deleted_count' => $deletedCount
            ]);
            exit;
        }

        // Single delete by ID
        $id = $_GET['id'] ?? null;
        if (!$id || !ctype_digit((string)$id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid record ID is required']);
            exit;
        }

        $stmt = $db->prepare('DELETE FROM site_regional WHERE id = :id');
        $stmt->execute([':id' => (int)$id]);

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
    error_log('Site Regional API error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
