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

            $tmpPath = $file['tmp_name'];

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

            // Detect headers and column mapping helper
            $detectColumns = function (array $sampleRows): array {
                $headerRowIdx = -1;
                $headerMap = [];

                foreach ($sampleRows as $r => $colTexts) {
                    $normalized = [];
                    foreach ($colTexts as $c => $val) {
                        $normalized[$c] = strtolower(trim((string) $val));
                    }

                    $hasSite = false;
                    $hasReg = false;
                    $hasNbv = false;

                    foreach ($normalized as $t) {
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
                        foreach ($normalized as $c => $t) {
                            if ($t !== '') {
                                $headerMap[$t] = $c;
                            }
                        }
                        break;
                    }
                }

                if ($headerRowIdx === -1 && !empty($sampleRows)) {
                    $firstKey = array_key_first($sampleRows);
                    $headerRowIdx = $firstKey;
                    foreach ($sampleRows[$firstKey] as $c => $val) {
                        $t = strtolower(trim((string) $val));
                        if ($t !== '') {
                            $headerMap[$t] = $c;
                        }
                    }
                }

                $findColIdx = function (array $aliases) use ($headerMap) {
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

                return [
                    'header_row' => $headerRowIdx,
                    'sitecode' => $findColIdx(['sitecode', 'site code', 'kode site', 'kode_site', 'site_code', 'site']),
                    'reg_no' => $findColIdx(['reg no', 'reg_no', 'no reg', 'no. reg', 'regno', 'registration no', 'asset no', 'no asset', 'no. asset', 'no aset', 'no. aset', 'nomor asset', 'nomor aset']),
                    'name' => $findColIdx(['name', 'asset name', 'nama asset', 'nama aset', 'item name', 'nama barang', 'deskripsi aset', 'description', 'nama']),
                    'sn' => $findColIdx(['sn', 'serial number', 'serial no', 'no seri', 'nomor seri', 's/n', 'serial_number', 'serial']),
                    'nbv' => $findColIdx(['nbv', 'net book value', 'nilai buku', 'book value', 'nilai_buku', 'book_value']),
                ];
            };

            // High-performance batch multi-row insert helper
            $flushBatch = function (PDO $db, array &$batch): int {
                if (empty($batch)) return 0;
                $count = count($batch);
                $rowPlaceholder = '(?, ?, ?, ?, ?, ?, ?)';
                $placeholders = implode(', ', array_fill(0, $count, $rowPlaceholder));
                $sql = "INSERT INTO rekap_db_master (sitecode, reg_no, name, sn, nbv, period_month, period_year) VALUES " . $placeholders;
                $params = [];
                foreach ($batch as $r) {
                    $params[] = $r['sitecode'];
                    $params[] = $r['reg_no'];
                    $params[] = $r['name'];
                    $params[] = $r['sn'];
                    $params[] = $r['nbv'];
                    $params[] = $r['month'];
                    $params[] = $r['year'];
                }
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
                $batch = [];
                return $count;
            };

            if ($replaceExisting) {
                $delStmt = $db->prepare('DELETE FROM rekap_db_master WHERE period_month = :m AND period_year = :y');
                $delStmt->execute([':m' => $month, ':y' => $year]);
            }

            $importedCount = 0;
            $batch = [];
            $BATCH_SIZE = 500;

            $db->beginTransaction();

            try {
                // PARSER SELECTION:
                // 1) CSV: Stream line-by-line using fgetcsv (Ultra fast, <2MB RAM)
                if ($ext === 'csv') {
                    $handle = fopen($tmpPath, 'r');
                    if (!$handle) {
                        throw new Exception("Gagal membuka file CSV");
                    }

                    // Check BOM
                    $bom = fread($handle, 3);
                    if ($bom !== "\xEF\xBB\xBF") {
                        rewind($handle);
                    }

                    // Detect separator (, or ; or \t)
                    $firstLine = fgets($handle);
                    rewind($handle);
                    if ($bom === "\xEF\xBB\xBF") {
                        fread($handle, 3);
                    }
                    $delimiter = ',';
                    if (substr_count($firstLine, ';') > substr_count($firstLine, ',')) {
                        $delimiter = ';';
                    } elseif (substr_count($firstLine, "\t") > substr_count($firstLine, ',')) {
                        $delimiter = "\t";
                    }

                    // Read first 15 lines to sample headers
                    $sampleRows = [];
                    $lineNo = 1;
                    while (($row = fgetcsv($handle, 0, $delimiter)) !== false && $lineNo <= 15) {
                        $colData = [];
                        foreach ($row as $ci => $cv) {
                            $colData[$ci + 1] = $cv;
                        }
                        $sampleRows[$lineNo] = $colData;
                        $lineNo++;
                    }

                    $cols = $detectColumns($sampleRows);
                    $headerRow = $cols['header_row'];

                    // Rewind and process data
                    rewind($handle);
                    if ($bom === "\xEF\xBB\xBF") {
                        fread($handle, 3);
                    }

                    $currentLine = 0;
                    while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
                        $currentLine++;
                        if ($currentLine <= $headerRow) {
                            continue;
                        }

                        $colData = [];
                        foreach ($row as $ci => $cv) {
                            $colData[$ci + 1] = $cv;
                        }

                        $sitecode = $cols['sitecode'] !== null ? trim((string)($colData[$cols['sitecode']] ?? '')) : '';
                        $regNo    = $cols['reg_no'] !== null ? trim((string)($colData[$cols['reg_no']] ?? '')) : '';
                        $name     = $cols['name'] !== null ? trim((string)($colData[$cols['name']] ?? '')) : '';
                        $sn       = $cols['sn'] !== null ? trim((string)($colData[$cols['sn']] ?? '')) : '';
                        $nbvVal   = $cols['nbv'] !== null ? ($colData[$cols['nbv']] ?? 0) : 0;
                        $nbv      = $parseNbv($nbvVal);

                        if ($sitecode === '' && $regNo === '' && $name === '' && $sn === '' && $nbv == 0.0) {
                            continue;
                        }

                        $batch[] = [
                            'sitecode' => $sitecode,
                            'reg_no' => $regNo,
                            'name' => $name,
                            'sn' => $sn,
                            'nbv' => $nbv,
                            'month' => $month,
                            'year' => $year
                        ];
                        $importedCount++;

                        if (count($batch) >= $BATCH_SIZE) {
                            $flushBatch($db, $batch);
                        }
                    }
                    fclose($handle);

                // 2) XLSX: Fast XMLReader streaming (ZipArchive + XMLReader, low RAM, <5 seconds)
                } elseif ($ext === 'xlsx' && class_exists('ZipArchive') && class_exists('XMLReader')) {
                    $usedStreaming = false;
                    $tempSheet = null;
                    try {
                        $zip = new ZipArchive();
                        if ($zip->open($tmpPath) !== true) {
                            throw new Exception("Cannot open XLSX archive");
                        }

                        // Shared strings
                        $sharedStrings = [];
                        $ssStream = $zip->getStream('xl/sharedStrings.xml');
                        if ($ssStream) {
                            $tempSs = tempnam(sys_get_temp_dir(), 'ss_');
                            $fp = fopen($tempSs, 'w');
                            stream_copy_to_stream($ssStream, $fp);
                            fclose($fp);
                            fclose($ssStream);

                            $xmlSs = new XMLReader();
                            $xmlSs->open($tempSs);
                            $currentStr = '';
                            $inT = false;
                            while ($xmlSs->read()) {
                                if ($xmlSs->nodeType === XMLReader::ELEMENT) {
                                    if ($xmlSs->name === 'si') {
                                        $currentStr = '';
                                    } elseif ($xmlSs->name === 't') {
                                        $inT = true;
                                    }
                                } elseif ($xmlSs->nodeType === XMLReader::TEXT || $xmlSs->nodeType === XMLReader::CDATA) {
                                    if ($inT) {
                                        $currentStr .= $xmlSs->value;
                                    }
                                } elseif ($xmlSs->nodeType === XMLReader::END_ELEMENT) {
                                    if ($xmlSs->name === 't') {
                                        $inT = false;
                                    } elseif ($xmlSs->name === 'si') {
                                        $sharedStrings[] = $currentStr;
                                    }
                                }
                            }
                            $xmlSs->close();
                            @unlink($tempSs);
                        }

                        // Find worksheet XML
                        $sheetName = 'xl/worksheets/sheet1.xml';
                        $sheetStream = $zip->getStream($sheetName);
                        if (!$sheetStream) {
                            for ($i = 0; $i < $zip->numFiles; $i++) {
                                $snCandidate = $zip->statIndex($i)['name'];
                                if (preg_match('#^xl/worksheets/sheet\d+\.xml$#i', $snCandidate)) {
                                    $sheetName = $snCandidate;
                                    $sheetStream = $zip->getStream($sheetName);
                                    break;
                                }
                            }
                        }

                        if (!$sheetStream) {
                            throw new Exception("Worksheet XML not found in XLSX");
                        }

                        $tempSheet = tempnam(sys_get_temp_dir(), 'sh_');
                        $fp = fopen($tempSheet, 'w');
                        stream_copy_to_stream($sheetStream, $fp);
                        fclose($fp);
                        fclose($sheetStream);
                        $zip->close();

                        // Col index conversion helper
                        $colLetterToIdx = function (string $col): int {
                            $len = strlen($col);
                            $idx = 0;
                            for ($i = 0; $i < $len; $i++) {
                                $idx = $idx * 26 + (ord(strtoupper($col[$i])) - ord('A') + 1);
                            }
                            return $idx;
                        };

                        // First pass: sample up to 15 rows for column detection
                        $reader = new XMLReader();
                        $reader->open($tempSheet);

                        $sampleRows = [];
                        $currentRow = [];
                        $currentCellCol = null;
                        $currentCellType = null;
                        $currentCellValue = '';
                        $inValue = false;
                        $rowIndex = 1;

                        while ($reader->read()) {
                            if ($reader->nodeType === XMLReader::ELEMENT) {
                                if ($reader->name === 'row') {
                                    $currentRow = [];
                                    $rAttr = $reader->getAttribute('r');
                                    if ($rAttr !== null) {
                                        $rowIndex = (int)$rAttr;
                                    }
                                } elseif ($reader->name === 'c') {
                                    $currentCellType = $reader->getAttribute('t');
                                    $r = $reader->getAttribute('r');
                                    if ($r !== null && preg_match('/^([A-Z]+)(\d+)/', $r, $m)) {
                                        $currentCellCol = $colLetterToIdx($m[1]);
                                    } else {
                                        $currentCellCol = empty($currentRow) ? 1 : (max(array_keys($currentRow)) + 1);
                                    }
                                    $currentCellValue = '';
                                } elseif ($reader->name === 'v' || $reader->name === 't') {
                                    $inValue = true;
                                }
                            } elseif ($reader->nodeType === XMLReader::TEXT || $reader->nodeType === XMLReader::CDATA) {
                                if ($inValue) {
                                    $currentCellValue .= $reader->value;
                                }
                            } elseif ($reader->nodeType === XMLReader::END_ELEMENT) {
                                if ($reader->name === 'v' || $reader->name === 't') {
                                    $inValue = false;
                                } elseif ($reader->name === 'c') {
                                    $finalValue = $currentCellValue;
                                    if ($currentCellType === 's') {
                                        $ssIdx = (int)$currentCellValue;
                                        $finalValue = $sharedStrings[$ssIdx] ?? '';
                                    } elseif ($currentCellType === 'b') {
                                        $finalValue = ($currentCellValue === '1') ? '1' : '0';
                                    }
                                    if ($currentCellCol !== null) {
                                        $currentRow[$currentCellCol] = $finalValue;
                                    }
                                    $currentCellCol = null;
                                    $currentCellType = null;
                                    $currentCellValue = '';
                                } elseif ($reader->name === 'row') {
                                    if (!empty($currentRow)) {
                                        $sampleRows[$rowIndex] = $currentRow;
                                        if (count($sampleRows) >= 15) {
                                            break;
                                        }
                                    }
                                    $rowIndex++;
                                }
                            }
                        }
                        $reader->close();

                        $cols = $detectColumns($sampleRows);
                        $headerRow = $cols['header_row'];

                        // Second pass: stream and batch insert all data rows
                        $reader->open($tempSheet);
                        $currentRow = [];
                        $currentCellCol = null;
                        $currentCellType = null;
                        $currentCellValue = '';
                        $inValue = false;
                        $rowIndex = 1;

                        while ($reader->read()) {
                            if ($reader->nodeType === XMLReader::ELEMENT) {
                                if ($reader->name === 'row') {
                                    $currentRow = [];
                                    $rAttr = $reader->getAttribute('r');
                                    if ($rAttr !== null) {
                                        $rowIndex = (int)$rAttr;
                                    }
                                } elseif ($reader->name === 'c') {
                                    $currentCellType = $reader->getAttribute('t');
                                    $r = $reader->getAttribute('r');
                                    if ($r !== null && preg_match('/^([A-Z]+)(\d+)/', $r, $m)) {
                                        $currentCellCol = $colLetterToIdx($m[1]);
                                    } else {
                                        $currentCellCol = empty($currentRow) ? 1 : (max(array_keys($currentRow)) + 1);
                                    }
                                    $currentCellValue = '';
                                } elseif ($reader->name === 'v' || $reader->name === 't') {
                                    $inValue = true;
                                }
                            } elseif ($reader->nodeType === XMLReader::TEXT || $reader->nodeType === XMLReader::CDATA) {
                                if ($inValue) {
                                    $currentCellValue .= $reader->value;
                                }
                            } elseif ($reader->nodeType === XMLReader::END_ELEMENT) {
                                if ($reader->name === 'v' || $reader->name === 't') {
                                    $inValue = false;
                                } elseif ($reader->name === 'c') {
                                    $finalValue = $currentCellValue;
                                    if ($currentCellType === 's') {
                                        $ssIdx = (int)$currentCellValue;
                                        $finalValue = $sharedStrings[$ssIdx] ?? '';
                                    } elseif ($currentCellType === 'b') {
                                        $finalValue = ($currentCellValue === '1') ? '1' : '0';
                                    }
                                    if ($currentCellCol !== null) {
                                        $currentRow[$currentCellCol] = $finalValue;
                                    }
                                    $currentCellCol = null;
                                    $currentCellType = null;
                                    $currentCellValue = '';
                                } elseif ($reader->name === 'row') {
                                    if ($rowIndex > $headerRow && !empty($currentRow)) {
                                        $sitecode = $cols['sitecode'] !== null ? trim((string)($currentRow[$cols['sitecode']] ?? '')) : '';
                                        $regNo    = $cols['reg_no'] !== null ? trim((string)($currentRow[$cols['reg_no']] ?? '')) : '';
                                        $name     = $cols['name'] !== null ? trim((string)($currentRow[$cols['name']] ?? '')) : '';
                                        $sn       = $cols['sn'] !== null ? trim((string)($currentRow[$cols['sn']] ?? '')) : '';
                                        $nbvVal   = $cols['nbv'] !== null ? ($currentRow[$cols['nbv']] ?? 0) : 0;
                                        $nbv      = $parseNbv($nbvVal);

                                        if (!($sitecode === '' && $regNo === '' && $name === '' && $sn === '' && $nbv == 0.0)) {
                                            $batch[] = [
                                                'sitecode' => $sitecode,
                                                'reg_no' => $regNo,
                                                'name' => $name,
                                                'sn' => $sn,
                                                'nbv' => $nbv,
                                                'month' => $month,
                                                'year' => $year
                                            ];
                                            $importedCount++;

                                            if (count($batch) >= $BATCH_SIZE) {
                                                $flushBatch($db, $batch);
                                            }
                                        }
                                    }
                                    $rowIndex++;
                                }
                            }
                        }
                        $reader->close();
                        @unlink($tempSheet);
                        $usedStreaming = true;
                    } catch (Throwable $streamEx) {
                        error_log('XLSX streaming fallback: ' . $streamEx->getMessage());
                        $usedStreaming = false;
                        if (!empty($tempSheet) && file_exists($tempSheet)) {
                            @unlink($tempSheet);
                        }
                    }

                    // Fallback to PhpSpreadsheet if streaming failed
                    if (!$usedStreaming) {
                        $reader = IOFactory::createReaderForFile($tmpPath);
                        $reader->setReadDataOnly(true);
                        $reader->setReadEmptyCells(false);
                        $spreadsheet = $reader->load($tmpPath);
                        $sheet = $spreadsheet->getActiveSheet();
                        $rows = $sheet->toArray(null, true, false, false);

                        $sampleRows = [];
                        for ($i = 0; $i < min(15, count($rows)); $i++) {
                            $colData = [];
                            foreach ($rows[$i] as $ci => $cv) {
                                $colData[$ci + 1] = $cv;
                            }
                            $sampleRows[$i + 1] = $colData;
                        }
                        $cols = $detectColumns($sampleRows);
                        $headerRow = $cols['header_row'];

                        for ($i = $headerRow; $i < count($rows); $i++) {
                            $row = $rows[$i];
                            $colData = [];
                            foreach ($row as $ci => $cv) {
                                $colData[$ci + 1] = $cv;
                            }

                            $sitecode = $cols['sitecode'] !== null ? trim((string)($colData[$cols['sitecode']] ?? '')) : '';
                            $regNo    = $cols['reg_no'] !== null ? trim((string)($colData[$cols['reg_no']] ?? '')) : '';
                            $name     = $cols['name'] !== null ? trim((string)($colData[$cols['name']] ?? '')) : '';
                            $sn       = $cols['sn'] !== null ? trim((string)($colData[$cols['sn']] ?? '')) : '';
                            $nbvVal   = $cols['nbv'] !== null ? ($colData[$cols['nbv']] ?? 0) : 0;
                            $nbv      = $parseNbv($nbvVal);

                            if ($sitecode === '' && $regNo === '' && $name === '' && $sn === '' && $nbv == 0.0) {
                                continue;
                            }

                            $batch[] = [
                                'sitecode' => $sitecode,
                                'reg_no' => $regNo,
                                'name' => $name,
                                'sn' => $sn,
                                'nbv' => $nbv,
                                'month' => $month,
                                'year' => $year
                            ];
                            $importedCount++;

                            if (count($batch) >= $BATCH_SIZE) {
                                $flushBatch($db, $batch);
                            }
                        }
                        $spreadsheet->disconnectWorksheets();
                        unset($spreadsheet, $sheet, $rows);
                    }

                // 3) XLS / Other formats via PhpSpreadsheet
                } else {
                    $reader = IOFactory::createReaderForFile($tmpPath);
                    $reader->setReadDataOnly(true);
                    $reader->setReadEmptyCells(false);
                    $spreadsheet = $reader->load($tmpPath);
                    $sheet = $spreadsheet->getActiveSheet();
                    $rows = $sheet->toArray(null, true, false, false);

                    $sampleRows = [];
                    for ($i = 0; $i < min(15, count($rows)); $i++) {
                        $colData = [];
                        foreach ($rows[$i] as $ci => $cv) {
                            $colData[$ci + 1] = $cv;
                        }
                        $sampleRows[$i + 1] = $colData;
                    }
                    $cols = $detectColumns($sampleRows);
                    $headerRow = $cols['header_row'];

                    for ($i = $headerRow; $i < count($rows); $i++) {
                        $row = $rows[$i];
                        $colData = [];
                        foreach ($row as $ci => $cv) {
                            $colData[$ci + 1] = $cv;
                        }

                        $sitecode = $cols['sitecode'] !== null ? trim((string)($colData[$cols['sitecode']] ?? '')) : '';
                        $regNo    = $cols['reg_no'] !== null ? trim((string)($colData[$cols['reg_no']] ?? '')) : '';
                        $name     = $cols['name'] !== null ? trim((string)($colData[$cols['name']] ?? '')) : '';
                        $sn       = $cols['sn'] !== null ? trim((string)($colData[$cols['sn']] ?? '')) : '';
                        $nbvVal   = $cols['nbv'] !== null ? ($colData[$cols['nbv']] ?? 0) : 0;
                        $nbv      = $parseNbv($nbvVal);

                        if ($sitecode === '' && $regNo === '' && $name === '' && $sn === '' && $nbv == 0.0) {
                            continue;
                        }

                        $batch[] = [
                            'sitecode' => $sitecode,
                            'reg_no' => $regNo,
                            'name' => $name,
                            'sn' => $sn,
                            'nbv' => $nbv,
                            'month' => $month,
                            'year' => $year
                        ];
                        $importedCount++;

                        if (count($batch) >= $BATCH_SIZE) {
                            $flushBatch($db, $batch);
                        }
                    }
                    $spreadsheet->disconnectWorksheets();
                    unset($spreadsheet, $sheet, $rows);
                }

                // Flush remaining rows
                if (!empty($batch)) {
                    $flushBatch($db, $batch);
                }

                $db->commit();

                echo json_encode([
                    'success' => true,
                    'imported_count' => $importedCount,
                    'month' => $month,
                    'year' => $year,
                    'message' => "Berhasil mengimpor {$importedCount} data Rekap DB Master Data untuk periode {$month}/{$year}"
                ]);
                exit;

            } catch (Throwable $e) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Gagal mengimpor file: ' . $e->getMessage()
                ]);
                exit;
            }
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
