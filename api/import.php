<?php
/**
 * Excel Import API Endpoint
 * Handles uploading and parsing Excel files (.xlsx, .xls)
 * Supports both Master Assets list and 21-column Reconciliation Summary format.
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';

use PhpOffice\PhpSpreadsheet\IOFactory;

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

// Check ZipArchive before attempting to parse xlsx
if (!class_exists('ZipArchive')) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'PHP zip extension is not enabled in Apache. Please click "Stop" and then "Start All" in Laragon to reload php.ini.',
    ]);
    exit;
}

// Resolve period
$periodId = isset($_POST['period_id']) ? (int) $_POST['period_id'] : 0;
$month = isset($_POST['month']) ? (int) $_POST['month'] : (int) date('n');
$year = isset($_POST['year']) ? (int) $_POST['year'] : (int) date('Y');

try {
    $db = getDbConnection();

    if ($periodId <= 0 && $month >= 1 && $month <= 12 && $year >= 2000 && $year <= 2100) {
        $stmtTmp = $db->prepare('SELECT id FROM asset_periods WHERE month = :m AND year = :y');
        $stmtTmp->execute(['m' => $month, 'y' => $year]);
        $existing = $stmtTmp->fetch();
        if ($existing) {
            $periodId = (int) $existing['id'];
        } else {
            $monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            $label = ($monthNames[$month] ?? 'Period') . ' ' . $year;
            $insStmt = $db->prepare('INSERT INTO asset_periods (month, year, label) VALUES (:m, :y, :l) RETURNING id');
            $insStmt->execute(['m' => $month, 'y' => $year, 'l' => $label]);
            $periodId = (int) $insStmt->fetchColumn();
        }
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
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
    $msg = $errorMessages[$errorCode] ?? 'Upload error';
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $msg]);
    exit;
}

$file = $_FILES['excel_file'];
$originalName = basename($file['name']);
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

if (!in_array($extension, ['xlsx', 'xls'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Only .xlsx and .xls files are allowed']);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0750, true);
}

$storedFilename = bin2hex(random_bytes(16)) . '.' . $extension;
$storedPath = $uploadDir . $storedFilename;

if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file']);
    exit;
}

try {
    $spreadsheet = IOFactory::load($storedPath);
    $worksheet = $spreadsheet->getActiveSheet();
    $rawRows = $worksheet->toArray(null, true, true, true);

    if (count($rawRows) < 2) {
        if (file_exists($storedPath)) unlink($storedPath);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Excel file is empty or has no data rows']);
        exit;
    }

    // Convert rows to 0-indexed arrays
    $rows = [];
    foreach ($rawRows as $r) {
        $rows[] = array_values($r);
    }

    // Detect if this is a Reconciliation Summary spreadsheet (with Profile / Result Match / etc.)
    $isReconciliation = false;
    $reconKeywords = ['profile', 'result match', 'result physic', 'result db', 'physical', 'nbv'];
    
    // Check first 3 rows for keywords
    for ($i = 0; $i < min(4, count($rows)); $i++) {
        $rowText = strtolower(implode(' ', array_map('strval', $rows[$i])));
        foreach ($reconKeywords as $kw) {
            if (str_contains($rowText, $kw)) {
                $isReconciliation = true;
                break 2;
            }
        }
    }

    // ── CASE A: RECONCILIATION SUMMARY SPREADSHEET ─────────────
    if ($isReconciliation) {
        // Find where data rows start (skip header rows that contain 'profile', 'periode', etc.)
        $dataStartIndex = 0;
        for ($i = 0; $i < count($rows); $i++) {
            $col0 = strtolower(trim((string)($rows[$i][0] ?? '')));
            if ($col0 !== '' && !in_array($col0, ['profile', 'profil', 'kategori', 'category', 'no', '#', 'header'])) {
                $dataStartIndex = $i;
                break;
            }
        }

        $insRecon = $db->prepare('
            INSERT INTO asset_reconciliation (
                profile, period_start, period_end,
                match_physic_qty, match_physic_pct, match_nbv_value, match_nbv_pct,
                physic_physic_qty, physic_physic_pct, physic_nbv_value, physic_nbv_pct,
                db_physic_qty, db_physic_pct, db_nbv_value, db_nbv_pct,
                total_physic_actual, total_physic_target, total_physic_pct,
                total_nbv_actual, total_nbv_target, total_nbv_pct
            ) VALUES (
                :profile, :period_start, :period_end,
                :match_physic_qty, :match_physic_pct, :match_nbv_value, :match_nbv_pct,
                :physic_physic_qty, :physic_physic_pct, :physic_nbv_value, :physic_nbv_pct,
                :db_physic_qty, :db_physic_pct, :db_nbv_value, :db_nbv_pct,
                :total_physic_actual, :total_physic_target, :total_physic_pct,
                :total_nbv_actual, :total_nbv_target, :total_nbv_pct
            )
        ');

        $cleanNum = fn($v) => (float) preg_replace('/[^0-9.\-]/', '', (string)$v);
        $cleanInt = fn($v) => (int) preg_replace('/[^0-9\-]/', '', (string)$v);
        $cleanDate = function($v, $default) {
            if ($v === null || trim((string)$v) === '') return $default;
            $v = trim((string)$v);
            if (is_numeric($v) && (float)$v > 20000 && (float)$v < 60000) {
                $excelTime = ((float)$v - 25569) * 86400;
                return date('Y-m-d', (int)$excelTime);
            }
            $ts = strtotime($v);
            return $ts !== false ? date('Y-m-d', $ts) : $default;
        };

        $defaultStart = sprintf('%04d-%02d-01', $year, $month);
        $defaultEnd = date('Y-m-t', strtotime($defaultStart));

        $db->beginTransaction();
        $importedCount = 0;

        for ($i = $dataStartIndex; $i < count($rows); $i++) {
            $r = $rows[$i];
            $profile = trim((string)($r[0] ?? ''));
            if ($profile === '') continue;

            $insRecon->execute([
                ':profile'             => $profile,
                ':period_start'        => $cleanDate($r[1] ?? '', $defaultStart),
                ':period_end'          => $cleanDate($r[2] ?? '', $defaultEnd),
                ':match_physic_qty'    => $cleanInt($r[3] ?? 0),
                ':match_physic_pct'    => $cleanNum($r[4] ?? 0),
                ':match_nbv_value'     => $cleanNum($r[5] ?? 0),
                ':match_nbv_pct'       => $cleanNum($r[6] ?? 0),
                ':physic_physic_qty'   => $cleanInt($r[7] ?? 0),
                ':physic_physic_pct'   => $cleanNum($r[8] ?? 0),
                ':physic_nbv_value'    => $cleanNum($r[9] ?? 0),
                ':physic_nbv_pct'      => $cleanNum($r[10] ?? 0),
                ':db_physic_qty'       => $cleanInt($r[11] ?? 0),
                ':db_physic_pct'       => $cleanNum($r[12] ?? 0),
                ':db_nbv_value'        => $cleanNum($r[13] ?? 0),
                ':db_nbv_pct'          => $cleanNum($r[14] ?? 0),
                ':total_physic_actual' => $cleanInt($r[15] ?? 0),
                ':total_physic_target' => $cleanInt($r[16] ?? 0),
                ':total_physic_pct'    => $cleanNum($r[17] ?? 0),
                ':total_nbv_actual'    => $cleanNum($r[18] ?? 0),
                ':total_nbv_target'    => $cleanNum($r[19] ?? 0),
                ':total_nbv_pct'       => $cleanNum($r[20] ?? 0),
            ]);
            $importedCount++;
        }
        $db->commit();

        echo json_encode([
            'success' => true,
            'target'  => 'summary',
            'imported_rows' => $importedCount,
            'message' => "Successfully imported $importedCount records into Stock Opname Summary!"
        ]);
        exit;
    }

    // ── CASE B: MASTER ASSETS LIST SPREADSHEET ─────────────────
    $headerRow = array_shift($rows);
    $headerMap = [];
    foreach ($headerRow as $idx => $val) {
        if ($val !== null) {
            $headerMap[strtolower(trim((string)$val))] = $idx;
        }
    }

    $colMap = [
        'asset number' => 'asset_number', 'asset_number' => 'asset_number', 'no asset' => 'asset_number',
        'no. asset' => 'asset_number', 'no aset' => 'asset_number', 'no. aset' => 'asset_number',
        'nomor asset' => 'asset_number', 'nomor aset' => 'asset_number', 'kode asset' => 'asset_number',
        'kode aset' => 'asset_number', 'barcode' => 'asset_number', 'tag' => 'asset_number', 'tag number' => 'asset_number',
        'asset id' => 'asset_number', 'id aset' => 'asset_number',

        'asset name' => 'asset_name', 'asset_name' => 'asset_name', 'nama asset' => 'asset_name',
        'nama aset' => 'asset_name', 'nama barang' => 'asset_name', 'item name' => 'asset_name',
        'name' => 'asset_name', 'deskripsi aset' => 'asset_name',

        'category' => 'category', 'kategori' => 'category', 'kelompok aset' => 'category', 'golongan' => 'category',
        'location' => 'location', 'lokasi' => 'location', 'ruang' => 'location', 'ruangan' => 'location',
        'gedung' => 'location', 'departemen' => 'location', 'unit' => 'location',

        'condition' => 'condition', 'kondisi' => 'condition', 'status' => 'condition', 'keadaan' => 'condition',
        'acquisition date' => 'acquisition_date', 'acquisition_date' => 'acquisition_date',
        'tanggal perolehan' => 'acquisition_date', 'tgl perolehan' => 'acquisition_date', 'tgl beli' => 'acquisition_date',
        'acquisition value' => 'acquisition_value', 'acquisition_value' => 'acquisition_value',
        'nilai perolehan' => 'acquisition_value', 'harga perolehan' => 'acquisition_value', 'harga' => 'acquisition_value',
        'book value' => 'book_value', 'book_value' => 'book_value', 'nilai buku' => 'book_value', 'nbv' => 'book_value',
        'useful life' => 'useful_life', 'useful_life' => 'useful_life', 'masa manfaat' => 'useful_life',
        'description' => 'description', 'deskripsi' => 'description', 'keterangan' => 'description', 'catatan' => 'description',
    ];

    $resolved = [];
    foreach ($colMap as $header => $f) {
        if (isset($headerMap[$header]) && !isset($resolved[$f])) {
            $resolved[$f] = $headerMap[$header];
        }
    }

    if (!isset($resolved['asset_number'])) $resolved['asset_number'] = 0;
    if (!isset($resolved['asset_name']))   $resolved['asset_name'] = 1;

    $insAsset = $db->prepare('
        INSERT INTO master_assets 
            (period_id, asset_number, asset_name, category, location, condition, 
             acquisition_date, acquisition_value, book_value, useful_life, description)
        VALUES 
            (:period_id, :asset_number, :asset_name, :category, :location, :condition,
             :acquisition_date, :acquisition_value, :book_value, :useful_life, :description)
    ');

    $db->beginTransaction();
    $importedCount = 0;

    foreach ($rows as $r) {
        $nonEmpty = array_filter($r, fn($v) => $v !== null && trim((string)$v) !== '');
        if (empty($nonEmpty)) continue;

        $assetNo = isset($resolved['asset_number'], $r[$resolved['asset_number']]) ? trim((string)$r[$resolved['asset_number']]) : '';
        $assetName = isset($resolved['asset_name'], $r[$resolved['asset_name']]) ? trim((string)$r[$resolved['asset_name']]) : '';
        if ($assetNo === '' && $assetName === '') continue;

        $acqVal = isset($resolved['acquisition_value'], $r[$resolved['acquisition_value']]) ? (float) preg_replace('/[^0-9.\-]/', '', (string)$r[$resolved['acquisition_value']]) : 0;
        $bookVal = isset($resolved['book_value'], $r[$resolved['book_value']]) ? (float) preg_replace('/[^0-9.\-]/', '', (string)$r[$resolved['book_value']]) : 0;

        $insAsset->execute([
            ':period_id'         => $periodId,
            ':asset_number'      => $assetNo ?: '-',
            ':asset_name'        => $assetName ?: '-',
            ':category'          => isset($resolved['category'], $r[$resolved['category']]) ? trim((string)$r[$resolved['category']]) : '-',
            ':location'          => isset($resolved['location'], $r[$resolved['location']]) ? trim((string)$r[$resolved['location']]) : '-',
            ':condition'         => isset($resolved['condition'], $r[$resolved['condition']]) ? trim((string)$r[$resolved['condition']]) : 'Good',
            ':acquisition_date'  => null,
            ':acquisition_value' => $acqVal,
            ':book_value'        => $bookVal,
            ':useful_life'       => null,
            ':description'       => isset($resolved['description'], $r[$resolved['description']]) ? trim((string)$r[$resolved['description']]) : '',
        ]);
        $importedCount++;
    }
    $db->commit();

    echo json_encode([
        'success' => true,
        'target'  => 'master',
        'imported_rows' => $importedCount,
        'message' => "Successfully imported $importedCount assets into Master Data!"
    ]);

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    if (file_exists($storedPath)) {
        unlink($storedPath);
    }
    http_response_code(500);
    error_log('Excel import error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Import error: ' . $e->getMessage(),
    ]);
}
