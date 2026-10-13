<?php
/**
 * Rekap DB Master Data API
 * Handles CRUD, Pagination, Filtering, Sorting, and Excel/CSV Import for Rekap DB Master Data
 * Columns: SITECODE, REG NO, NAME, SN, NBV
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/security.php';

use PhpOffice\PhpSpreadsheet\IOFactory;

ini_set('display_errors', '0');
error_reporting(E_ALL);
ini_set('memory_limit', '2048M');
set_time_limit(600);

sendSecurityHeaders();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    // Ensure table exists
    $db->exec("
        CREATE TABLE IF NOT EXISTS rekap_db_master (
            id SERIAL PRIMARY KEY,
            sitecode VARCHAR(100) NOT NULL,
            reg_no VARCHAR(100),
            name TEXT,
            sn VARCHAR(150),
            nbv NUMERIC(18, 2) DEFAULT 0,
            period_month INT NOT NULL,
            period_year INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_rekap_db_period ON rekap_db_master (period_year, period_month);
        CREATE INDEX IF NOT EXISTS idx_rekap_db_sitecode ON rekap_db_master (sitecode);
    ");

    // ─────────────────────────────────────────────────────────────
    // GET: List / Search / Filter / Paginate Rekap DB Records
    // ─────────────────────────────────────────────────────────────
    if ($method === 'GET') {
        $month = isset($_GET['month']) && $_GET['month'] !== '' && $_GET['month'] !== 'all' ? (int) $_GET['month'] : null;
        $year = isset($_GET['year']) && $_GET['year'] !== '' && $_GET['year'] !== 'all' ? (int) $_GET['year'] : null;
        $search = trim($_GET['search'] ?? '');
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $limitParam = $_GET['limit'] ?? 10;
        $isAll = (strtolower($limitParam) === 'all' || (int) $limitParam === -1);
        $limit = $isAll ? 100000 : max(1, (int) $limitParam);
        $offset = $isAll ? 0 : ($page - 1) * $limit;

        $allowedSortCols = [
            'id' => 'id',
            'sitecode' => 'sitecode',
            'reg_no' => 'reg_no',
            'name' => 'name',
            'sn' => 'sn',
            'nbv' => 'nbv',
            'period_month' => 'period_month',
            'period_year' => 'period_year',
            'created_at' => 'created_at'
        ];
        $sortColParam = strtolower(trim($_GET['sort_col'] ?? 'id'));
        $sortCol = $allowedSortCols[$sortColParam] ?? 'id';
        $sortDir = strtolower(trim($_GET['sort_dir'] ?? 'asc')) === 'desc' ? 'DESC' : 'ASC';

        $where = [];
        $params = [];

        if ($month !== null) {
            $where[] = 'period_month = :month';
            $params[':month'] = $month;
        }
        if ($year !== null) {
            $where[] = 'period_year = :year';
            $params[':year'] = $year;
        }
        if ($search !== '') {
            $where[] = '(sitecode ILIKE :s OR reg_no ILIKE :s OR name ILIKE :s OR sn ILIKE :s)';
            $params[':s'] = "%{$search}%";
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // Count total
        $countStmt = $db->prepare("SELECT COUNT(*) as total, COALESCE(SUM(nbv), 0) as total_nbv FROM rekap_db_master $whereSql");
        $countStmt->execute($params);
        $countRow = $countStmt->fetch(PDO::FETCH_ASSOC);
        $totalRecords = (int) ($countRow['total'] ?? 0);
        $totalNbv = (float) ($countRow['total_nbv'] ?? 0);

        // Fetch paginated rows
        $sql = "
            SELECT id, sitecode, reg_no, name, sn, nbv, period_month, period_year, created_at, updated_at
            FROM rekap_db_master
            $whereSql
            ORDER BY $sortCol $sortDir
            LIMIT :limit OFFSET :offset
        ";
        $stmt = $db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalPages = $isAll ? 1 : ($totalRecords > 0 ? (int) ceil($totalRecords / $limit) : 1);

        echo json_encode([
            'success' => true,
            'data' => $rows,
            'total' => $totalRecords,
            'total_nbv' => $totalNbv,
            'page' => $page,
            'limit' => $isAll ? 'all' : $limit,
            'total_pages' => $totalPages
        ]);
        exit;
    }

    // ─────────────────────────────────────────────────────────────
    // POST: Import / Delete / Bulk Delete
    // ─────────────────────────────────────────────────────────────
    if ($method === 'POST') {
        $action = trim($_POST['action'] ?? $_GET['action'] ?? '');

        // CSRF and Admin Authentication check
        validateCsrfToken();
        requireAuth();

        // 1. IMPORT DATA
        if ($action === 'import') {
            $month = isset($_POST['month']) ? (int) $_POST['month'] : (int) date('n');
            $year = isset($_POST['year']) ? (int) $_POST['year'] : (int) date('Y');
            $replaceExisting = !empty($_POST['replace_existing']);

            if ($month < 1 || $month > 12 || $year < 2000 || $year > 2100) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Bulan dan tahun periode tidak valid']);
                exit;
            }

            if (!isset($_FILES['excel_file']) || $_FILES['excel_file']['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'File belum diunggah atau terjadi kesalahan upload']);
                exit;
            }

            $file = $_FILES['excel_file'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

            if (!in_array($ext, ['xlsx', 'xls', 'csv'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Hanya file format .xlsx, .xls, dan .csv yang didukung']);
                exit;
            }

            // Load spreadsheet memory-efficiently
            $tmpPath = $file['tmp_name'];
            $reader = IOFactory::createReaderForFile($tmpPath);
            $reader->setReadDataOnly(true);
            $spreadsheet = $reader->load($tmpPath);
            $sheet = $spreadsheet->getActiveSheet();

            // Find header row and map columns across first 15 rows
            $headerRowIdx = -1;
            $headerMap = [];
            $maxRow = $sheet->getHighestRow();

            for ($r = 1; $r <= min(15, $maxRow); $r++) {
                $colTexts = [];
                $highestCol = $sheet->getHighestColumn($r);
                $highestColIdx = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);

                for ($c = 1; $c <= $highestColIdx; $c++) {
                    $val = $sheet->getCell([$c, $r])->getValue();
                    $colTexts[$c] = strtolower(trim((string) $val));
                }

                $hasSite = false;
                $hasReg = false;
                $hasNbv = false;

                foreach ($colTexts as $idx => $t) {
                    if (str_contains($t, 'sitecode') || str_contains($t, 'site code') || str_contains($t, 'kode site') || $t === 'site') {
                        $hasSite = true;
                    }
                    if (str_contains($t, 'reg no') || str_contains($t, 'reg_no') || str_contains($t, 'no reg') || str_contains($t, 'asset no') || str_contains($t, 'no asset') || str_contains($t, 'no aset')) {
                        $hasReg = true;
                    }
                    if (str_contains($t, 'nbv') || str_contains($t, 'nilai buku') || str_contains($t, 'book value')) {
                        $hasNbv = true;
                    }
                }

                if ($hasSite || ($hasReg && $hasNbv)) {
                    $headerRowIdx = $r;
                    foreach ($colTexts as $idx => $t) {
                        if ($t !== '') {
                            $headerMap[$t] = $idx;
                        }
                    }
                    break;
                }
            }

            if ($headerRowIdx === -1) {
                $headerRowIdx = 1;
                $highestCol = $sheet->getHighestColumn(1);
                $highestColIdx = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);
                for ($c = 1; $c <= $highestColIdx; $c++) {
                    $t = strtolower(trim((string) $sheet->getCell([$c, 1])->getValue()));
                    if ($t !== '')
                        $headerMap[$t] = $c;
                }
            }

            // Find 1-based column indexes for our 5 target columns
            $findColIdx = function (array $aliases) use ($headerMap): ?int {
                foreach ($aliases as $a) {
                    if (isset($headerMap[$a])) {
                        return $headerMap[$a];
                    }
                }
                foreach ($headerMap as $h => $idx) {
                    foreach ($aliases as $a) {
                        if (str_contains($h, $a)) {
                            return $idx;
                        }
                    }
                }
                return null;
            };

            $colSitecode = $findColIdx(['sitecode', 'site code', 'kode site', 'kode_site', 'site_code', 'site']);
            $colRegNo = $findColIdx(['reg no', 'reg_no', 'no reg', 'no. reg', 'regno', 'registration no', 'asset no', 'no asset', 'no. asset', 'no aset', 'no. aset', 'nomor asset', 'nomor aset']);
            $colName = $findColIdx(['name', 'asset name', 'nama asset', 'nama aset', 'item name', 'nama barang', 'deskripsi aset', 'description', 'nama']);
            $colSn = $findColIdx(['sn', 'serial number', 'serial no', 'no seri', 'nomor seri', 's/n', 'serial_number', 'serial']);
            $colNbv = $findColIdx(['nbv', 'net book value', 'nilai buku', 'book value', 'nilai_buku', 'book_value']);

            // Parse NBV helper
            $parseNbv = function ($val): float {
                if ($val === null || $val === '')
                    return 0.0;
                if (is_numeric($val))
                    return (float) $val;
                $str = trim((string) $val);
                $isNegative = false;
                if (str_starts_with($str, '(') && str_ends_with($str, ')')) {
                    $isNegative = true;
                    $str = substr($str, 1, -1);
                }
                $cleaned = preg_replace('/[^0-9.,]/', '', $str);
                if (preg_match('/^\d{1,3}(\.\d{3})*(,\d+)?$/', $cleaned)) {
                    $cleaned = str_replace('.', '', $cleaned);
                    $cleaned = str_replace(',', '.', $cleaned);
                } else {
                    $cleaned = str_replace(',', '', $cleaned);
                }
                $num = (float) $cleaned;
                return $isNegative ? -$num : $num;
            };

            if ($replaceExisting) {
                $delStmt = $db->prepare('DELETE FROM rekap_db_master WHERE period_month = :m AND period_year = :y');
                $delStmt->execute([':m' => $month, ':y' => $year]);
            }

            $insertStmt = $db->prepare("
                INSERT INTO rekap_db_master (sitecode, reg_no, name, sn, nbv, period_month, period_year)
                VALUES (:sitecode, :reg_no, :name, :sn, :nbv, :month, :year)
            ");

            $importedCount = 0;
            $batchCount = 0;
            $db->beginTransaction();

            // Iterate rows directly using RowIterator to keep memory low
            $rowIterator = $sheet->getRowIterator($headerRowIdx + 1);
            foreach ($rowIterator as $row) {
                $r = $row->getRowIndex();

                $sitecode = $colSitecode !== null ? trim((string) $sheet->getCell([$colSitecode, $r])->getValue()) : '';
                $regNo = $colRegNo !== null ? trim((string) $sheet->getCell([$colRegNo, $r])->getValue()) : '';
                $name = $colName !== null ? trim((string) $sheet->getCell([$colName, $r])->getValue()) : '';
                $sn = $colSn !== null ? trim((string) $sheet->getCell([$colSn, $r])->getValue()) : '';
                $nbvVal = $colNbv !== null ? $sheet->getCell([$colNbv, $r])->getValue() : 0;
                $nbv = $parseNbv($nbvVal);

                // Skip completely blank rows
                if ($sitecode === '' && $regNo === '' && $name === '' && $sn === '' && $nbv == 0.0) {
                    continue;
                }

                $insertStmt->execute([
                    ':sitecode' => $sitecode,
                    ':reg_no' => $regNo,
                    ':name' => $name,
                    ':sn' => $sn,
                    ':nbv' => $nbv,
                    ':month' => $month,
                    ':year' => $year,
                ]);
                $importedCount++;
                $batchCount++;

                // Commit in chunks to prevent large transaction buffer & free memory
                if ($batchCount >= 1000) {
                    $db->commit();
                    $db->beginTransaction();
                    $batchCount = 0;
                }
            }

            if ($db->inTransaction()) {
                $db->commit();
            }

            // Free spreadsheet memory
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet, $sheet);

            echo json_encode([
                'success' => true,
                'imported_count' => $importedCount,
                'month' => $month,
                'year' => $year,
                'message' => "Berhasil mengimpor {$importedCount} data Rekap DB Master Data untuk periode {$month}/{$year}"
            ]);
            exit;
        }

        // 2. DELETE SINGLE RECORD
        if ($action === 'delete') {
            $id = (int) ($_POST['id'] ?? 0);
            if ($id <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID data tidak valid']);
                exit;
            }
            $delStmt = $db->prepare('DELETE FROM rekap_db_master WHERE id = :id');
            $delStmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Data berhasil dihapus']);
            exit;
        }

        // 3. BULK DELETE BY PERIOD
        if ($action === 'bulk_delete') {
            $month = isset($_POST['month']) && $_POST['month'] !== '' && $_POST['month'] !== 'all' ? (int) $_POST['month'] : null;
            $year = isset($_POST['year']) && $_POST['year'] !== '' && $_POST['year'] !== 'all' ? (int) $_POST['year'] : null;

            if ($month === null && $year === null) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Pilih minimal Bulan atau Tahun untuk menghapus data']);
                exit;
            }

            $where = [];
            $params = [];
            if ($month !== null) {
                $where[] = 'period_month = :m';
                $params[':m'] = $month;
            }
            if ($year !== null) {
                $where[] = 'period_year = :y';
                $params[':y'] = $year;
            }

            $whereSql = implode(' AND ', $where);
            $delStmt = $db->prepare("DELETE FROM rekap_db_master WHERE $whereSql");
            $delStmt->execute($params);
            $deletedCount = $delStmt->rowCount();

            echo json_encode([
                'success' => true,
                'deleted_count' => $deletedCount,
                'message' => "Berhasil menghapus {$deletedCount} data Rekap DB Master Data"
            ]);
            exit;
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Aksi tidak dikenali']);
        exit;
    }

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
    exit;
}
