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

    // 1. Intelligent Worksheet Selection:
    // Workbooks may have multiple sheets (e.g. Sheet, Sheet1).
    // Automatically select the sheet containing the full reconciliation columns if present.
    $targetSheet = null;
    $bestReconScore = -1;
    $allSheets = $spreadsheet->getAllSheets();

    foreach ($allSheets as $sheet) {
        $raw = $sheet->toArray(null, true, true, true);
        $score = 0;
        for ($i = 1; $i <= min(5, count($raw)); $i++) {
            $rowText = strtolower(implode(' ', array_map('strval', $raw[$i] ?? [])));
            if (str_contains($rowText, 'result match')) $score += 20;
            if (str_contains($rowText, 'result physic')) $score += 20;
            if (str_contains($rowText, 'result db')) $score += 20;
            if (str_contains($rowText, 'total')) $score += 5;
            if (str_contains($rowText, 'physical')) $score += 5;
            if (str_contains($rowText, 'nbv')) $score += 5;
            if (str_contains($rowText, 'profile') || str_contains($rowText, 'profil')) $score += 2;
        }
        if ($score > $bestReconScore) {
            $bestReconScore = $score;
            $targetSheet = $sheet;
        }
    }

    if (!$targetSheet || $bestReconScore < 10) {
        $targetSheet = $spreadsheet->getActiveSheet();
    }

    $rawRows = $targetSheet->toArray(null, true, true, true);

    if (count($rawRows) < 2) {
        if (file_exists($storedPath)) unlink($storedPath);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Excel sheet is empty or has no data rows']);
        exit;
    }

    // Convert rows to 0-indexed arrays
    $rows = [];
    foreach ($rawRows as $r) {
        $rows[] = array_values($r);
    }

    // Detect if this is a Reconciliation Summary spreadsheet
    $isReconciliation = ($bestReconScore >= 20);
    if (!$isReconciliation) {
        $reconKeywords = ['result match', 'result physic', 'result db', 'match_physic'];
        for ($i = 0; $i < min(4, count($rows)); $i++) {
            $rowText = strtolower(implode(' ', array_map('strval', $rows[$i])));
            foreach ($reconKeywords as $kw) {
                if (str_contains($rowText, $kw)) {
                    $isReconciliation = true;
                    break 2;
                }
            }
        }
    }

    // ── CASE A: RECONCILIATION SUMMARY SPREADSHEET ─────────────
    if ($isReconciliation) {
        // Find where data rows start (skip header rows that contain 'profile', 'periode', 'header', etc.)
        $dataStartIndex = 0;
        for ($i = 0; $i < count($rows); $i++) {
            $col0 = strtolower(trim((string)($rows[$i][0] ?? '')));
            if ($col0 !== '' && !in_array($col0, ['profile', 'profil', 'kategori', 'category', 'no', '#', 'header', 'periode', 'total'], true)) {
                $dataStartIndex = $i;
                break;
            }
        }

        // Dynamically build composite headers for each column from rows 0 to $dataStartIndex - 1
        // Handles merged cells by carrying forward labels horizontally and stacking rows vertically
        $maxCols = 0;
        for ($i = 0; $i < $dataStartIndex; $i++) {
            $maxCols = max($maxCols, count($rows[$i] ?? []));
        }

        $headerParts = [];
        for ($c = 0; $c < $maxCols; $c++) {
            $headerParts[$c] = [];
        }

        for ($i = 0; $i < $dataStartIndex; $i++) {
            $currentMergedVal = '';
            for ($c = 0; $c < $maxCols; $c++) {
                $val = trim((string)($rows[$i][$c] ?? ''));
                if ($val !== '') {
                    $currentMergedVal = $val;
                }
                if ($currentMergedVal !== '') {
                    $headerParts[$c][] = $currentMergedVal;
                }
            }
        }

        $compositeHeaders = [];
        for ($c = 0; $c < $maxCols; $c++) {
            $compositeHeaders[$c] = strtolower(implode(' ', $headerParts[$c]));
        }

        // Field mapping definitions matching database columns
        $colMap = [];

        // Profile
        foreach ($compositeHeaders as $c => $h) {
            if (str_contains($h, 'profile') || str_contains($h, 'profil')) {
                $colMap['profile'] = $c;
                break;
            }
        }
        if (!isset($colMap['profile'])) $colMap['profile'] = 0;

        // Period Start & End
        foreach ($compositeHeaders as $c => $h) {
            if ((str_contains($h, 'start') || str_contains($h, 'mulai')) && !isset($colMap['period_start'])) {
                $colMap['period_start'] = $c;
            } elseif ((str_contains($h, 'end') || str_contains($h, 'akhir') || str_contains($h, 'selesai')) && !isset($colMap['period_end'])) {
                $colMap['period_end'] = $c;
            }
        }
        if (!isset($colMap['period_start'])) $colMap['period_start'] = 1;
        if (!isset($colMap['period_end'])) $colMap['period_end'] = 2;

        // Metric fields
        $definitions = [
            'match_physic_qty'    => fn($h) => str_contains($h, 'match') && str_contains($h, 'physic') && (str_contains($h, 'qty') || str_contains($h, 'jumlah')),
            'match_physic_pct'    => fn($h) => str_contains($h, 'match') && str_contains($h, 'physic') && str_contains($h, '%'),
            'match_nbv_value'     => fn($h) => str_contains($h, 'match') && str_contains($h, 'nbv') && (str_contains($h, 'val') || str_contains($h, 'nilai')),
            'match_nbv_pct'       => fn($h) => str_contains($h, 'match') && str_contains($h, 'nbv') && str_contains($h, '%'),

            'physic_physic_qty'   => fn($h) => (str_contains($h, 'result physic') || (str_contains($h, 'physic') && !str_contains($h, 'match') && !str_contains($h, 'db') && !str_contains($h, 'total'))) && str_contains($h, 'physic') && (str_contains($h, 'qty') || str_contains($h, 'jumlah')),
            'physic_physic_pct'   => fn($h) => (str_contains($h, 'result physic') || (str_contains($h, 'physic') && !str_contains($h, 'match') && !str_contains($h, 'db') && !str_contains($h, 'total'))) && str_contains($h, 'physic') && str_contains($h, '%'),
            'physic_nbv_value'    => fn($h) => (str_contains($h, 'result physic') || (str_contains($h, 'physic') && !str_contains($h, 'match') && !str_contains($h, 'db') && !str_contains($h, 'total'))) && str_contains($h, 'nbv') && (str_contains($h, 'val') || str_contains($h, 'nilai')),
            'physic_nbv_pct'      => fn($h) => (str_contains($h, 'result physic') || (str_contains($h, 'physic') && !str_contains($h, 'match') && !str_contains($h, 'db') && !str_contains($h, 'total'))) && str_contains($h, 'nbv') && str_contains($h, '%'),

            'db_physic_qty'       => fn($h) => str_contains($h, 'db') && str_contains($h, 'physic') && (str_contains($h, 'qty') || str_contains($h, 'jumlah')),
            'db_physic_pct'       => fn($h) => str_contains($h, 'db') && str_contains($h, 'physic') && str_contains($h, '%'),
            'db_nbv_value'        => fn($h) => str_contains($h, 'db') && str_contains($h, 'nbv') && (str_contains($h, 'val') || str_contains($h, 'nilai')),
            'db_nbv_pct'          => fn($h) => str_contains($h, 'db') && str_contains($h, 'nbv') && str_contains($h, '%'),

            'total_physic_actual' => fn($h) => str_contains($h, 'total') && str_contains($h, 'physic') && (str_contains($h, 'act') || str_contains($h, 'realisasi')),
            'total_physic_target' => fn($h) => str_contains($h, 'total') && str_contains($h, 'physic') && (str_contains($h, 'target') || str_contains($h, 'tgt')),
            'total_physic_pct'    => fn($h) => str_contains($h, 'total') && str_contains($h, 'physic') && str_contains($h, '%'),

            'total_nbv_actual'    => fn($h) => str_contains($h, 'total') && str_contains($h, 'nbv') && (str_contains($h, 'act') || str_contains($h, 'realisasi')),
            'total_nbv_target'    => fn($h) => str_contains($h, 'total') && str_contains($h, 'nbv') && (str_contains($h, 'target') || str_contains($h, 'tgt')),
            'total_nbv_pct'       => fn($h) => str_contains($h, 'total') && str_contains($h, 'nbv') && str_contains($h, '%'),
        ];

        foreach ($definitions as $field => $matcher) {
            foreach ($compositeHeaders as $c => $h) {
                if ($matcher($h)) {
                    $colMap[$field] = $c;
                    break;
                }
            }
        }

        // If replace_existing is selected, clear existing reconciliation records
        $replaceExisting = !empty($_POST['replace_existing']) && ($_POST['replace_existing'] === '1' || $_POST['replace_existing'] === 'true');
        if ($replaceExisting) {
            $db->exec('TRUNCATE TABLE asset_reconciliation RESTART IDENTITY');
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
            // Normalize Indonesian month names if present
            $vNormalized = str_ireplace(
                ['januari', 'pebruari', 'februari', 'maret', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'nopember', 'november', 'desember', 'ags', 'agu', 'okt', 'nop', 'des'],
                ['january', 'february', 'february', 'march', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'november', 'december', 'aug', 'aug', 'oct', 'nov', 'dec'],
                $v
            );
            $ts = strtotime($vNormalized);
            return $ts !== false ? date('Y-m-d', $ts) : $default;
        };

        $defaultStart = sprintf('%04d-%02d-01', $year, $month);
        $defaultEnd = date('Y-m-t', strtotime($defaultStart));

        $db->beginTransaction();
        $importedCount = 0;

        for ($i = $dataStartIndex; $i < count($rows); $i++) {
            $r = $rows[$i];
            $profile = isset($colMap['profile'], $r[$colMap['profile']]) ? trim((string)$r[$colMap['profile']]) : '';
            if ($profile === '') continue;

            $insRecon->execute([
                ':profile'             => $profile,
                ':period_start'        => $cleanDate(isset($colMap['period_start']) ? ($r[$colMap['period_start']] ?? '') : '', $defaultStart),
                ':period_end'          => $cleanDate(isset($colMap['period_end']) ? ($r[$colMap['period_end']] ?? '') : '', $defaultEnd),
                ':match_physic_qty'    => isset($colMap['match_physic_qty']) ? $cleanInt($r[$colMap['match_physic_qty']] ?? 0) : 0,
                ':match_physic_pct'    => isset($colMap['match_physic_pct']) ? $cleanNum($r[$colMap['match_physic_pct']] ?? 0) : 0,
                ':match_nbv_value'     => isset($colMap['match_nbv_value']) ? $cleanNum($r[$colMap['match_nbv_value']] ?? 0) : 0,
                ':match_nbv_pct'       => isset($colMap['match_nbv_pct']) ? $cleanNum($r[$colMap['match_nbv_pct']] ?? 0) : 0,
                ':physic_physic_qty'   => isset($colMap['physic_physic_qty']) ? $cleanInt($r[$colMap['physic_physic_qty']] ?? 0) : 0,
                ':physic_physic_pct'   => isset($colMap['physic_physic_pct']) ? $cleanNum($r[$colMap['physic_physic_pct']] ?? 0) : 0,
                ':physic_nbv_value'    => isset($colMap['physic_nbv_value']) ? $cleanNum($r[$colMap['physic_nbv_value']] ?? 0) : 0,
                ':physic_nbv_pct'      => isset($colMap['physic_nbv_pct']) ? $cleanNum($r[$colMap['physic_nbv_pct']] ?? 0) : 0,
                ':db_physic_qty'       => isset($colMap['db_physic_qty']) ? $cleanInt($r[$colMap['db_physic_qty']] ?? 0) : 0,
                ':db_physic_pct'       => isset($colMap['db_physic_pct']) ? $cleanNum($r[$colMap['db_physic_pct']] ?? 0) : 0,
                ':db_nbv_value'        => isset($colMap['db_nbv_value']) ? $cleanNum($r[$colMap['db_nbv_value']] ?? 0) : 0,
                ':db_nbv_pct'          => isset($colMap['db_nbv_pct']) ? $cleanNum($r[$colMap['db_nbv_pct']] ?? 0) : 0,
                ':total_physic_actual' => isset($colMap['total_physic_actual']) ? $cleanInt($r[$colMap['total_physic_actual']] ?? 0) : 0,
                ':total_physic_target' => isset($colMap['total_physic_target']) ? $cleanInt($r[$colMap['total_physic_target']] ?? 0) : 0,
                ':total_physic_pct'    => isset($colMap['total_physic_pct']) ? $cleanNum($r[$colMap['total_physic_pct']] ?? 0) : 0,
                ':total_nbv_actual'    => isset($colMap['total_nbv_actual']) ? $cleanNum($r[$colMap['total_nbv_actual']] ?? 0) : 0,
                ':total_nbv_target'    => isset($colMap['total_nbv_target']) ? $cleanNum($r[$colMap['total_nbv_target']] ?? 0) : 0,
                ':total_nbv_pct'       => isset($colMap['total_nbv_pct']) ? $cleanNum($r[$colMap['total_nbv_pct']] ?? 0) : 0,
            ]);
            $importedCount++;
        }
        $db->commit();

        if (file_exists($storedPath)) {
            unlink($storedPath);
        }

        echo json_encode([
            'success' => true,
            'target'  => 'summary',
            'imported_rows' => $importedCount,
            'message' => "Successfully imported $importedCount records into Stock Opname Data with all columns mapped correctly!"
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
