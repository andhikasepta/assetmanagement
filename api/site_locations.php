<?php
/**
 * Site Locations API Endpoint
 * Handles CRUD operations for Site Locations
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    // Auto-create table if not exists
    $db->exec('
        CREATE TABLE IF NOT EXISTS site_locations (
            id SERIAL PRIMARY KEY,
            site_id VARCHAR(50) NOT NULL,
            category VARCHAR(100) DEFAULT \'\',
            name_intan VARCHAR(255) DEFAULT \'\',
            name_eproc VARCHAR(255) DEFAULT \'\',
            name_ims VARCHAR(255) DEFAULT \'\',
            organizations VARCHAR(255) DEFAULT \'\',
            manager VARCHAR(150) DEFAULT \'\',
            region VARCHAR(150) DEFAULT \'\',
            area VARCHAR(100) DEFAULT \'\',
            cluster VARCHAR(100) DEFAULT \'\',
            addr TEXT DEFAULT \'\',
            province VARCHAR(100) DEFAULT \'\',
            city VARCHAR(100) DEFAULT \'\',
            sub_dis VARCHAR(100) DEFAULT \'\',
            village VARCHAR(100) DEFAULT \'\',
            postal VARCHAR(30) DEFAULT \'\',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_site_locations_site_id ON site_locations (site_id);
    ');

    // Table schema check
    // (Sample seeding was previously executed here, removed to prevent deleted records from auto-respawning)

    if ($method === 'GET') {
        $search = trim($_GET['search'] ?? '');
        $sortCol = $_GET['sort'] ?? 'site_id';
        $sortDir = strtolower($_GET['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

        $allowedSorts = [
            'id', 'site_id', 'category', 'name_intan', 'name_eproc', 'name_ims',
            'organizations', 'manager', 'region', 'area', 'cluster',
            'addr', 'province', 'city', 'sub_dis', 'village', 'postal'
        ];
        if (!in_array($sortCol, $allowedSorts, true)) {
            $sortCol = 'site_id';
        }

        $params = [];
        $whereSql = '';
        if ($search !== '') {
            $whereSql = '
                WHERE site_id ILIKE :s
                   OR category ILIKE :s
                   OR name_intan ILIKE :s
                   OR name_eproc ILIKE :s
                   OR organizations ILIKE :s
                   OR region ILIKE :s
                   OR area ILIKE :s
                   OR cluster ILIKE :s
                   OR province ILIKE :s
                   OR city ILIKE :s
                   OR addr ILIKE :s
            ';
            $params[':s'] = '%' . $search . '%';
        }

        $stmt = $db->prepare("
            SELECT id, site_id, category, name_intan, name_eproc, name_ims,
                   organizations, manager, region, area, cluster,
                   addr, province, city, sub_dis, village, postal
            FROM site_locations
            $whereSql
            ORDER BY $sortCol $sortDir, id ASC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'data'    => $rows,
            'total'   => count($rows)
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
        $action = $_GET['action'] ?? $_POST['action'] ?? '';

        // ── Handle Excel Import ─────────────────────────────────────
        if ($action === 'import' || isset($_FILES['excel_file'])) {
            require_once __DIR__ . '/../vendor/autoload.php';

            if (!class_exists('ZipArchive')) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'PHP zip extension is not enabled in Apache. Please reload php.ini.',
                ]);
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

            $tempPath = $uploadDir . bin2hex(random_bytes(16)) . '.' . $extension;
            if (!move_uploaded_file($file['tmp_name'], $tempPath)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file']);
                exit;
            }

            try {
                $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($tempPath);
                $sheet = $spreadsheet->getActiveSheet();
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

                // 1. Identify header rows (support 1 or 2 rows of headers)
                $dataStartIndex = 1;
                $maxCols = 0;
                for ($i = 0; $i < min(6, count($rows)); $i++) {
                    $maxCols = max($maxCols, count($rows[$i] ?? []));
                    $rowStr = strtolower(implode(' ', array_map('strval', $rows[$i])));
                    // Check if this row is still part of the header
                    if (str_contains($rowStr, 'site id') || str_contains($rowStr, 'category') || str_contains($rowStr, 'regional') || str_contains($rowStr, 'location')) {
                        $dataStartIndex = $i + 1;
                    } elseif ($i > 0 && (str_contains($rowStr, 'intan') || str_contains($rowStr, 'eproc') || str_contains($rowStr, 'region') || str_contains($rowStr, 'cluster') || str_contains($rowStr, 'addr'))) {
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
                    if (str_contains($h, 'site id') || (str_contains($h, 'site') && str_contains($h, 'id')) || ($h === 'id' && !isset($map['site_id']))) {
                        $map['site_id'] = $c;
                    } elseif (str_contains($h, 'category') || str_contains($h, 'kategori')) {
                        $map['category'] = $c;
                    } elseif (str_contains($h, 'intan')) {
                        $map['name_intan'] = $c;
                    } elseif (str_contains($h, 'eproc')) {
                        $map['name_eproc'] = $c;
                    } elseif (str_contains($h, 'ims')) {
                        $map['name_ims'] = $c;
                    } elseif (str_contains($h, 'organization') || str_contains($h, 'organisasi')) {
                        $map['organizations'] = $c;
                    } elseif (str_contains($h, 'manager') || str_contains($h, 'pic') || str_contains($h, 'pengelola')) {
                        $map['manager'] = $c;
                    } elseif (str_contains($h, 'region') && !str_contains($h, 'regional')) {
                        $map['region'] = $c;
                    } elseif (str_contains($h, 'area')) {
                        $map['area'] = $c;
                    } elseif (str_contains($h, 'cluster')) {
                        $map['cluster'] = $c;
                    } elseif (str_contains($h, 'addr') || str_contains($h, 'alamat')) {
                        $map['addr'] = $c;
                    } elseif (str_contains($h, 'province') || str_contains($h, 'provinsi')) {
                        $map['province'] = $c;
                    } elseif (str_contains($h, 'city') || str_contains($h, 'kota') || str_contains($h, 'kabupaten')) {
                        $map['city'] = $c;
                    } elseif (str_contains($h, 'sub dis') || str_contains($h, 'sub_dis') || str_contains($h, 'kecamatan')) {
                        $map['sub_dis'] = $c;
                    } elseif (str_contains($h, 'village') || str_contains($h, 'kelurahan') || str_contains($h, 'desa')) {
                        $map['village'] = $c;
                    } elseif (str_contains($h, 'postal') || str_contains($h, 'pos') || str_contains($h, 'zip')) {
                        $map['postal'] = $c;
                    }
                }

                // Fallback positional mapping if headers were generic/missing
                if (!isset($map['site_id'])) $map['site_id'] = 0;
                if (!isset($map['category'])) $map['category'] = 1;
                if (!isset($map['name_intan'])) $map['name_intan'] = 2;
                if (!isset($map['name_eproc'])) $map['name_eproc'] = 3;
                if (!isset($map['name_ims'])) $map['name_ims'] = 4;
                if (!isset($map['organizations'])) $map['organizations'] = 5;
                if (!isset($map['manager'])) $map['manager'] = 6;
                if (!isset($map['region'])) $map['region'] = 7;
                if (!isset($map['area'])) $map['area'] = 8;
                if (!isset($map['cluster'])) $map['cluster'] = 9;
                if (!isset($map['addr'])) $map['addr'] = 10;
                if (!isset($map['province'])) $map['province'] = 11;
                if (!isset($map['city'])) $map['city'] = 12;
                if (!isset($map['sub_dis'])) $map['sub_dis'] = 13;
                if (!isset($map['village'])) $map['village'] = 14;
                if (!isset($map['postal'])) $map['postal'] = 15;

                // Handle replace existing checkbox
                $replaceExisting = isset($_POST['replace_existing']) && $_POST['replace_existing'] === '1';

                $db->beginTransaction();

                if ($replaceExisting) {
                    $db->exec('TRUNCATE TABLE site_locations RESTART IDENTITY');
                }

                $stmt = $db->prepare('
                    INSERT INTO site_locations (
                        site_id, category, name_intan, name_eproc, name_ims, organizations, manager,
                        region, area, cluster, addr, province, city, sub_dis, village, postal
                    ) VALUES (
                        :site_id, :category, :name_intan, :name_eproc, :name_ims, :organizations, :manager,
                        :region, :area, :cluster, :addr, :province, :city, :sub_dis, :village, :postal
                    )
                ');

                $importedCount = 0;
                for ($i = $dataStartIndex; $i < count($rows); $i++) {
                    $row = $rows[$i];
                    $siteId = trim((string)($row[$map['site_id']] ?? ''));
                    // Skip empty rows
                    if ($siteId === '' || strtolower($siteId) === 'total') {
                        continue;
                    }

                    $stmt->execute([
                        ':site_id'       => $siteId,
                        ':category'      => trim((string)($row[$map['category']] ?? '')),
                        ':name_intan'    => trim((string)($row[$map['name_intan']] ?? '')),
                        ':name_eproc'    => trim((string)($row[$map['name_eproc']] ?? '')),
                        ':name_ims'      => trim((string)($row[$map['name_ims']] ?? '')),
                        ':organizations' => trim((string)($row[$map['organizations']] ?? '')),
                        ':manager'       => trim((string)($row[$map['manager']] ?? '')),
                        ':region'        => trim((string)($row[$map['region']] ?? '')),
                        ':area'          => trim((string)($row[$map['area']] ?? '')),
                        ':cluster'       => trim((string)($row[$map['cluster']] ?? '')),
                        ':addr'          => trim((string)($row[$map['addr']] ?? '')),
                        ':province'      => trim((string)($row[$map['province']] ?? '')),
                        ':city'          => trim((string)($row[$map['city']] ?? '')),
                        ':sub_dis'       => trim((string)($row[$map['sub_dis']] ?? '')),
                        ':village'       => trim((string)($row[$map['village']] ?? '')),
                        ':postal'        => trim((string)($row[$map['postal']] ?? '')),
                    ]);
                    $importedCount++;
                }

                $db->commit();

                if (file_exists($tempPath)) {
                    unlink($tempPath);
                }

                echo json_encode([
                    'success'        => true,
                    'imported_count' => $importedCount,
                    'message'        => "Successfully imported {$importedCount} site location records from Excel"
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

        // ── Handle Manual Site Entry ────────────────────────────────
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true) ?? $_POST;

        $siteId = trim((string)($payload['site_id'] ?? ''));
        if ($siteId === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Site ID is required']);
            exit;
        }

        $stmt = $db->prepare('
            INSERT INTO site_locations (
                site_id, category, name_intan, name_eproc, name_ims, organizations, manager,
                region, area, cluster, addr, province, city, sub_dis, village, postal
            ) VALUES (
                :site_id, :category, :name_intan, :name_eproc, :name_ims, :organizations, :manager,
                :region, :area, :cluster, :addr, :province, :city, :sub_dis, :village, :postal
            ) RETURNING id
        ');

        $stmt->execute([
            ':site_id'       => $siteId,
            ':category'      => trim((string)($payload['category'] ?? '')),
            ':name_intan'    => trim((string)($payload['name_intan'] ?? '')),
            ':name_eproc'    => trim((string)($payload['name_eproc'] ?? '')),
            ':name_ims'      => trim((string)($payload['name_ims'] ?? '')),
            ':organizations' => trim((string)($payload['organizations'] ?? '')),
            ':manager'       => trim((string)($payload['manager'] ?? '')),
            ':region'        => trim((string)($payload['region'] ?? '')),
            ':area'          => trim((string)($payload['area'] ?? '')),
            ':cluster'       => trim((string)($payload['cluster'] ?? '')),
            ':addr'          => trim((string)($payload['addr'] ?? '')),
            ':province'      => trim((string)($payload['province'] ?? '')),
            ':city'          => trim((string)($payload['city'] ?? '')),
            ':sub_dis'       => trim((string)($payload['sub_dis'] ?? '')),
            ':village'       => trim((string)($payload['village'] ?? '')),
            ':postal'        => trim((string)($payload['postal'] ?? '')),
        ]);

        $newId = $stmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'id'      => $newId,
            'message' => 'Site location created successfully'
        ]);
        exit;
    }

    if ($method === 'DELETE') {
        $action = $_GET['action'] ?? '';

        // Bulk delete multiple sites by IDs
        if ($action === 'bulk_delete') {
            $raw = file_get_contents('php://input');
            $payload = json_decode($raw, true) ?? [];
            $ids = $payload['ids'] ?? [];

            // Alternatively support comma-separated ids in query param if needed
            if (empty($ids) && !empty($_GET['ids'])) {
                $ids = explode(',', $_GET['ids']);
            }

            // Filter valid integer IDs
            $validIds = array_values(array_filter(array_map(function($v) {
                return (is_numeric($v) && (int)$v > 0) ? (int)$v : null;
            }, (array)$ids)));

            if (empty($validIds)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No valid record IDs provided for deletion']);
                exit;
            }

            // PostgreSQL parameterized IN clause
            $placeholders = implode(',', array_fill(0, count($validIds), '?'));
            $stmt = $db->prepare("DELETE FROM site_locations WHERE id IN ($placeholders)");
            $stmt->execute($validIds);

            $deletedCount = $stmt->rowCount();

            echo json_encode([
                'success' => true,
                'message' => "Successfully deleted {$deletedCount} site location record(s)",
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

        $stmt = $db->prepare('DELETE FROM site_locations WHERE id = :id');
        $stmt->execute([':id' => (int)$id]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Site location deleted successfully']);
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
    error_log('Site Locations API error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
