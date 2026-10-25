<?php
/**
 * Excel Import for SO Profile Weekly
 * Handles uploading and parsing Excel files (.xlsx, .xls) for Weekly Reconciliation
 * Stores into table `asset_reconciliation_weekly` with period_month, period_week, period_year
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/security.php';

use PhpOffice\PhpSpreadsheet\IOFactory;

ini_set('display_errors', '0');
error_reporting(E_ALL);
ini_set('memory_limit', '1024M');
set_time_limit(300);

sendSecurityHeaders();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Validate CSRF token & user permissions
validateCsrfToken();
requireAuth();
requirePermission('can_master_weekly_add_import');

// Check ZipArchive before attempting to parse xlsx
if (!class_exists('ZipArchive')) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'PHP zip extension is not enabled in Apache. Please reload php.ini in Laragon.',
    ]);
    exit;
}

// Resolve upload path
$uploadDir = __DIR__ . '/../uploads/';
$storedPath = null;

if (!empty($_POST['file_token'])) {
    $token = basename($_POST['file_token']);
    if (preg_match('/^[a-f0-9]{32}\.(xlsx|xls)$/i', $token)) {
        $candidate = $uploadDir . $token;
        if (file_exists($candidate) && is_file($candidate)) {
            $storedPath = $candidate;
        }
    }
}

if (!$storedPath) {
    if (!isset($_FILES['excel_file']) || $_FILES['excel_file']['error'] !== UPLOAD_ERR_OK) {
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => 'File exceeds server upload limit',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds form upload limit',
            UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
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
        echo json_encode(['success' => false, 'message' => 'Hanya file .xlsx dan .xls yang diperbolehkan.']);
        exit;
    }

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0750, true);
    }

    $storedFilename = bin2hex(random_bytes(16)) . '.' . $extension;
    $storedPath = $uploadDir . $storedFilename;

    if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal menyimpan file upload.']);
        exit;
    }
}

try {
    $db = getDbConnection();

    $reader = IOFactory::createReaderForFile($storedPath);
    if (method_exists($reader, 'setReadDataOnly')) {
        $reader->setReadDataOnly(true);
    }
    $spreadsheet = $reader->load($storedPath);

    // 1. Intelligent Worksheet Selection:
    // Workbooks may have multiple sheets (e.g. Cover, Sheet1, Reconciliation).
    // Automatically select the sheet containing the full reconciliation columns if present.
    $selectedSheetName = trim($_POST['sheet_name'] ?? '');
    $targetSheet = null;
    $bestReconScore = -1;

    $scoreSheet = function ($sheet) {
        $raw = $sheet->toArray(null, true, true, true);
        $score = 0;
        for ($i = 1; $i <= min(5, count($raw)); $i++) {
            $rowText = strtolower(implode(' ', array_map('strval', $raw[$i] ?? [])));
            if (str_contains($rowText, 'result match'))  $score += 20;
            if (str_contains($rowText, 'result physic')) $score += 20;
            if (str_contains($rowText, 'result db'))     $score += 20;
            if (str_contains($rowText, 'total'))         $score += 5;
            if (str_contains($rowText, 'physical'))      $score += 5;
            if (str_contains($rowText, 'nbv'))           $score += 5;
            if (str_contains($rowText, 'profile') || str_contains($rowText, 'profil')) $score += 2;
        }
        return $score;
    };

    if ($selectedSheetName !== '' && $spreadsheet->sheetNameExists($selectedSheetName)) {
        $candSheet = $spreadsheet->getSheetByName($selectedSheetName);
        $candScore = $scoreSheet($candSheet);
        if ($candScore >= 15) {
            $targetSheet = $candSheet;
            $bestReconScore = $candScore;
        }
    }

    if (!$targetSheet) {
        $allSheets = $spreadsheet->getAllSheets();
        foreach ($allSheets as $sheet) {
            $score = $scoreSheet($sheet);
            if ($score > $bestReconScore) {
                $bestReconScore = $score;
                $targetSheet = $sheet;
            }
        }
    }

    if (!$targetSheet || $bestReconScore < 10) {
        $targetSheet = $spreadsheet->getActiveSheet();
    }

    $rawRows = $targetSheet->toArray(null, true, true, true);
    if (count($rawRows) < 2) {
        if (!empty($storedPath) && file_exists($storedPath)) {
            @unlink($storedPath);
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Lembar kerja Excel kosong atau tidak memiliki baris data.']);
        exit;
    }

    // Convert rows to 0-indexed arrays
    $rows = [];
    foreach ($rawRows as $r) {
        $rows[] = array_values($r);
    }

    // 2. Find where data rows start (skip header rows)
    $dataStartIndex = 0;
    for ($i = 0; $i < count($rows); $i++) {
        $col0 = strtolower(trim((string) ($rows[$i][0] ?? '')));
        if ($col0 !== '' && !in_array($col0, ['profile', 'profil', 'kategori', 'category', 'no', '#', 'header', 'periode', 'total'], true)) {
            $dataStartIndex = $i;
            break;
        }
    }

    // 3. Dynamically build composite headers for each column from rows 0 to $dataStartIndex - 1
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
            $val = trim((string) ($rows[$i][$c] ?? ''));
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

    // 4. Field mapping definitions matching database columns
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
    if (!isset($colMap['period_end']))   $colMap['period_end']   = 2;

    $definitions = [
        'match_physic_qty' => fn($h) => str_contains($h, 'match') && str_contains($h, 'physic') && (str_contains($h, 'qty') || str_contains($h, 'jumlah')),
        'match_physic_pct' => fn($h) => str_contains($h, 'match') && str_contains($h, 'physic') && str_contains($h, '%'),
        'match_nbv_value'  => fn($h) => str_contains($h, 'match') && str_contains($h, 'nbv') && (str_contains($h, 'val') || str_contains($h, 'nilai')),
        'match_nbv_pct'    => fn($h) => str_contains($h, 'match') && str_contains($h, 'nbv') && str_contains($h, '%'),

        'physic_physic_qty' => fn($h) => (str_contains($h, 'result physic') || (str_contains($h, 'physic') && !str_contains($h, 'match') && !str_contains($h, 'db') && !str_contains($h, 'total'))) && str_contains($h, 'physic') && (str_contains($h, 'qty') || str_contains($h, 'jumlah')),
        'physic_physic_pct' => fn($h) => (str_contains($h, 'result physic') || (str_contains($h, 'physic') && !str_contains($h, 'match') && !str_contains($h, 'db') && !str_contains($h, 'total'))) && str_contains($h, 'physic') && str_contains($h, '%'),
        'physic_nbv_value'  => fn($h) => (str_contains($h, 'result physic') || (str_contains($h, 'physic') && !str_contains($h, 'match') && !str_contains($h, 'db') && !str_contains($h, 'total'))) && str_contains($h, 'nbv') && (str_contains($h, 'val') || str_contains($h, 'nilai')),
        'physic_nbv_pct'    => fn($h) => (str_contains($h, 'result physic') || (str_contains($h, 'physic') && !str_contains($h, 'match') && !str_contains($h, 'db') && !str_contains($h, 'total'))) && str_contains($h, 'nbv') && str_contains($h, '%'),

        'db_physic_qty' => fn($h) => str_contains($h, 'db') && str_contains($h, 'physic') && (str_contains($h, 'qty') || str_contains($h, 'jumlah')),
        'db_physic_pct' => fn($h) => str_contains($h, 'db') && str_contains($h, 'physic') && str_contains($h, '%'),
        'db_nbv_value'  => fn($h) => str_contains($h, 'db') && str_contains($h, 'nbv') && (str_contains($h, 'val') || str_contains($h, 'nilai')),
        'db_nbv_pct'    => fn($h) => str_contains($h, 'db') && str_contains($h, 'nbv') && str_contains($h, '%'),

        'total_physic_actual' => fn($h) => str_contains($h, 'total') && str_contains($h, 'physic') && (str_contains($h, 'act') || str_contains($h, 'realisasi')),
        'total_physic_target' => fn($h) => str_contains($h, 'total') && str_contains($h, 'physic') && (str_contains($h, 'target') || str_contains($h, 'tgt')),
        'total_physic_pct'    => fn($h) => str_contains($h, 'total') && str_contains($h, 'physic') && str_contains($h, '%'),

        'total_nbv_actual' => fn($h) => str_contains($h, 'total') && str_contains($h, 'nbv') && (str_contains($h, 'act') || str_contains($h, 'realisasi')),
        'total_nbv_target' => fn($h) => str_contains($h, 'total') && str_contains($h, 'nbv') && (str_contains($h, 'target') || str_contains($h, 'tgt')),
        'total_nbv_pct'    => fn($h) => str_contains($h, 'total') && str_contains($h, 'nbv') && str_contains($h, '%'),
    ];

    foreach ($definitions as $field => $matcher) {
        foreach ($compositeHeaders as $c => $h) {
            if ($matcher($h)) {
                $colMap[$field] = $c;
                break;
            }
        }
    }

    $replaceExisting = !empty($_POST['replace_existing']) && ($_POST['replace_existing'] === '1' || $_POST['replace_existing'] === 'true');

    $cleanNum = fn($v) => (float) preg_replace('/[^0-9.\-]/', '', (string) $v);
    $cleanInt = fn($v) => (int) preg_replace('/[^0-9\-]/', '', (string) $v);
    $cleanDate = function ($v, $default) {
        if ($v === null || trim((string) $v) === '') return $default;
        $v = trim((string) $v);
        if (is_numeric($v) && (float) $v > 20000 && (float) $v < 60000) {
            $excelTime = ((float) $v - 25569) * 86400;
            return date('Y-m-d', (int) $excelTime);
        }
        $vNormalized = str_ireplace(
            ['januari', 'pebruari', 'februari', 'maret', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'nopember', 'november', 'desember', 'ags', 'agu', 'okt', 'nop', 'des'],
            ['january', 'february', 'february', 'march', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'november', 'december', 'aug', 'aug', 'oct', 'nov', 'dec'],
            $v
        );
        $ts = strtotime($vNormalized);
        return $ts !== false ? date('Y-m-d', $ts) : $default;
    };

    $cleanPct = function ($v, $actual = null, $target = null) {
        if ($v !== null && trim((string) $v) !== '') {
            $str = trim((string) $v);
            if (str_contains($str, ',') && !str_contains($str, '.')) {
                $str = str_replace(',', '.', $str);
            }
            $hasPctSign = str_contains($str, '%');
            $num = (float) preg_replace('/[^0-9.\-]/', '', $str);

            if ($hasPctSign) return round($num, 2);
            if ($actual !== null && $target !== null && (float) $target > 0) {
                return round(((float) $actual / (float) $target) * 100, 2);
            }
            if ($num > 0 && $num <= 1.0) {
                return round($num * 100, 2);
            }
            return round($num, 2);
        }
        if ($actual !== null && $target !== null && (float) $target > 0) {
            return round(((float) $actual / (float) $target) * 100, 2);
        }
        return 0.0;
    };

    // Period inputs from user form (if not 'auto')
    $formMonth = (!empty($_POST['month']) && $_POST['month'] !== 'auto' && is_numeric($_POST['month'])) ? (int) $_POST['month'] : 0;
    $formWeek  = (!empty($_POST['week'])  && $_POST['week']  !== 'auto' && is_numeric($_POST['week']))  ? (int) $_POST['week']  : 0;
    $formYear  = (!empty($_POST['year'])  && $_POST['year']  !== 'auto' && is_numeric($_POST['year']))  ? (int) $_POST['year']  : 0;

    $defaultStart = date('Y-m-01');
    $defaultEnd = date('Y-m-d');

    // Parse rows and resolve periods
    $parsedRows = [];
    $distinctPeriods = [];

    for ($i = $dataStartIndex; $i < count($rows); $i++) {
        $r = $rows[$i];
        $profile = isset($colMap['profile'], $r[$colMap['profile']]) ? trim((string) $r[$colMap['profile']]) : '';
        if ($profile === '') continue;

        // Skip any repeated header rows
        $profileLower = strtolower($profile);
        if (in_array($profileLower, ['profile', 'profil', 'kategori', 'category', 'total', 'grand total', 'no', '#', 'header', 'periode'], true)) {
            continue;
        }

        $pStart = isset($colMap['period_start'], $r[$colMap['period_start']]) ? $cleanDate($r[$colMap['period_start']], $defaultStart) : $defaultStart;
        $pEnd   = isset($colMap['period_end'], $r[$colMap['period_end']])     ? $cleanDate($r[$colMap['period_end']], $defaultEnd)     : $defaultEnd;

        // Auto-detect period from dates and profile
        $refDate = (!empty($pEnd) && $pEnd !== $defaultEnd) ? $pEnd : $pStart;
        $dateTs = strtotime($refDate);
        $dateYear  = $dateTs ? (int) date('Y', $dateTs) : (int) date('Y');
        $dateMonth = $dateTs ? (int) date('n', $dateTs) : (int) date('n');
        $dateDay   = $dateTs ? (int) date('j', $dateTs) : 1;
        $dateWeek  = ($dateDay <= 7) ? 1 : (($dateDay <= 14) ? 2 : (($dateDay <= 21) ? 3 : 4));

        $profYear = null;
        $profMonth = null;
        $profWeek = null;

        // Match patterns like "2026-02-04" or "2026-02-W4" or "2026-02-4" in profile
        if (preg_match('/\b(20\d{2})[-_\/.](0?[1-9]|1[0-2])[-_\/.](?:0?([1-4])|W0?([1-4]))\b/i', $profile, $m)) {
            $profYear = (int) $m[1];
            $profMonth = (int) $m[2];
            $profWeek = (int) ($m[3] !== '' ? $m[3] : $m[4]);
        } elseif (preg_match('/\bW(?:eek)?\s*([1-4])\b/i', $profile, $m)) {
            $profWeek = (int) $m[1];
        }

        $rowYear  = ($formYear > 0)  ? $formYear  : ($profYear ?? $dateYear);
        $rowMonth = ($formMonth > 0) ? $formMonth : ($profMonth ?? $dateMonth);
        $rowWeek  = ($formWeek > 0)  ? $formWeek  : ($profWeek ?? $dateWeek);

        if ($rowMonth < 1 || $rowMonth > 12) $rowMonth = (int) date('n');
        if ($rowWeek < 1 || $rowWeek > 4)    $rowWeek = 1;
        if ($rowYear < 2000 || $rowYear > 2100) $rowYear = (int) date('Y');

        $periodKey = "{$rowYear}-{$rowMonth}-{$rowWeek}";
        $distinctPeriods[$periodKey] = [
            'year'  => $rowYear,
            'month' => $rowMonth,
            'week'  => $rowWeek,
        ];

        $mQty = isset($colMap['match_physic_qty'], $r[$colMap['match_physic_qty']]) ? $cleanInt($r[$colMap['match_physic_qty']]) : 0;
        $mVal = isset($colMap['match_nbv_value'], $r[$colMap['match_nbv_value']])   ? $cleanNum($r[$colMap['match_nbv_value']])  : 0.0;

        $pQty = isset($colMap['physic_physic_qty'], $r[$colMap['physic_physic_qty']]) ? $cleanInt($r[$colMap['physic_physic_qty']]) : 0;
        $pVal = isset($colMap['physic_nbv_value'], $r[$colMap['physic_nbv_value']])   ? $cleanNum($r[$colMap['physic_nbv_value']])  : 0.0;

        $dQty = isset($colMap['db_physic_qty'], $r[$colMap['db_physic_qty']]) ? $cleanInt($r[$colMap['db_physic_qty']]) : 0;
        $dVal = isset($colMap['db_nbv_value'], $r[$colMap['db_nbv_value']])   ? $cleanNum($r[$colMap['db_nbv_value']])  : 0.0;

        $totAct = isset($colMap['total_physic_actual'], $r[$colMap['total_physic_actual']]) ? $cleanInt($r[$colMap['total_physic_actual']]) : ($mQty + $pQty);
        $totTgt = isset($colMap['total_physic_target'], $r[$colMap['total_physic_target']]) ? $cleanInt($r[$colMap['total_physic_target']]) : ($mQty + $pQty + $dQty);

        $totNbvAct = isset($colMap['total_nbv_actual'], $r[$colMap['total_nbv_actual']]) ? $cleanNum($r[$colMap['total_nbv_actual']]) : ($mVal + $pVal);
        $totNbvTgt = isset($colMap['total_nbv_target'], $r[$colMap['total_nbv_target']]) ? $cleanNum($r[$colMap['total_nbv_target']]) : ($mVal + $pVal + $dVal);

        $mPct    = isset($colMap['match_physic_pct'], $r[$colMap['match_physic_pct']]) ? $cleanPct($r[$colMap['match_physic_pct']], $mQty, $totTgt) : $cleanPct(null, $mQty, $totTgt);
        $mNbvPct = isset($colMap['match_nbv_pct'], $r[$colMap['match_nbv_pct']])       ? $cleanPct($r[$colMap['match_nbv_pct']], $mVal, $totNbvTgt) : $cleanPct(null, $mVal, $totNbvTgt);

        $pPct    = isset($colMap['physic_physic_pct'], $r[$colMap['physic_physic_pct']]) ? $cleanPct($r[$colMap['physic_physic_pct']], $pQty, $totTgt) : $cleanPct(null, $pQty, $totTgt);
        $pNbvPct = isset($colMap['physic_nbv_pct'], $r[$colMap['physic_nbv_pct']])       ? $cleanPct($r[$colMap['physic_nbv_pct']], $pVal, $totNbvTgt) : $cleanPct(null, $pVal, $totNbvTgt);

        $dPct    = isset($colMap['db_physic_pct'], $r[$colMap['db_physic_pct']]) ? $cleanPct($r[$colMap['db_physic_pct']], $dQty, $totTgt) : $cleanPct(null, $dQty, $totTgt);
        $dNbvPct = isset($colMap['db_nbv_pct'], $r[$colMap['db_nbv_pct']])       ? $cleanPct($r[$colMap['db_nbv_pct']], $dVal, $totNbvTgt) : $cleanPct(null, $dVal, $totNbvTgt);

        $totPct    = isset($colMap['total_physic_pct'], $r[$colMap['total_physic_pct']]) ? $cleanPct($r[$colMap['total_physic_pct']], $totAct, $totTgt) : $cleanPct(null, $totAct, $totTgt);
        $totNbvPct = isset($colMap['total_nbv_pct'], $r[$colMap['total_nbv_pct']])       ? $cleanPct($r[$colMap['total_nbv_pct']], $totNbvAct, $totNbvTgt) : $cleanPct(null, $totNbvAct, $totNbvTgt);

        $parsedRows[] = [
            'profile'             => $profile,
            'period_start'        => $pStart,
            'period_end'          => $pEnd,
            'period_month'        => $rowMonth,
            'period_week'         => $rowWeek,
            'period_year'         => $rowYear,
            'match_physic_qty'    => $mQty,
            'match_physic_pct'    => $mPct,
            'match_nbv_value'     => $mVal,
            'match_nbv_pct'       => $mNbvPct,
            'physic_physic_qty'   => $pQty,
            'physic_physic_pct'   => $pPct,
            'physic_nbv_value'    => $pVal,
            'physic_nbv_pct'      => $pNbvPct,
            'db_physic_qty'       => $dQty,
            'db_physic_pct'       => $dPct,
            'db_nbv_value'        => $dVal,
            'db_nbv_pct'          => $dNbvPct,
            'total_physic_actual' => $totAct,
            'total_physic_target' => $totTgt,
            'total_physic_pct'    => $totPct,
            'total_nbv_actual'    => $totNbvAct,
            'total_nbv_target'    => $totNbvTgt,
            'total_nbv_pct'       => $totNbvPct,
        ];
    }

    if (empty($parsedRows)) {
        if (!empty($storedPath) && file_exists($storedPath)) {
            @unlink($storedPath);
        }
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Tidak ada baris data valid yang ditemukan pada sheet tersebut.']);
        exit;
    }

    $db->beginTransaction();

    // If replaceExisting, delete old records matching the distinct periods present in this import
    if ($replaceExisting) {
        $delStmt = $db->prepare('
            DELETE FROM asset_reconciliation_weekly 
            WHERE period_month = :month AND period_week = :week AND period_year = :year
        ');
        foreach ($distinctPeriods as $dp) {
            $delStmt->execute([
                ':month' => $dp['month'],
                ':week'  => $dp['week'],
                ':year'  => $dp['year'],
            ]);
        }
    }

    $insRecon = $db->prepare('
        INSERT INTO asset_reconciliation_weekly (
            profile, period_start, period_end,
            period_month, period_week, period_year,
            match_physic_qty, match_physic_pct, match_nbv_value, match_nbv_pct,
            physic_physic_qty, physic_physic_pct, physic_nbv_value, physic_nbv_pct,
            db_physic_qty, db_physic_pct, db_nbv_value, db_nbv_pct,
            total_physic_actual, total_physic_target, total_physic_pct,
            total_nbv_actual, total_nbv_target, total_nbv_pct
        ) VALUES (
            :profile, :period_start, :period_end,
            :period_month, :period_week, :period_year,
            :match_physic_qty, :match_physic_pct, :match_nbv_value, :match_nbv_pct,
            :physic_physic_qty, :physic_physic_pct, :physic_nbv_value, :physic_nbv_pct,
            :db_physic_qty, :db_physic_pct, :db_nbv_value, :db_nbv_pct,
            :total_physic_actual, :total_physic_target, :total_physic_pct,
            :total_nbv_actual, :total_nbv_target, :total_nbv_pct
        )
    ');

    $importedCount = 0;
    foreach ($parsedRows as $row) {
        $insRecon->execute([
            ':profile'             => $row['profile'],
            ':period_start'        => $row['period_start'],
            ':period_end'          => $row['period_end'],
            ':period_month'        => $row['period_month'],
            ':period_week'         => $row['period_week'],
            ':period_year'         => $row['period_year'],
            ':match_physic_qty'    => $row['match_physic_qty'],
            ':match_physic_pct'    => $row['match_physic_pct'],
            ':match_nbv_value'     => $row['match_nbv_value'],
            ':match_nbv_pct'       => $row['match_nbv_pct'],
            ':physic_physic_qty'   => $row['physic_physic_qty'],
            ':physic_physic_pct'   => $row['physic_physic_pct'],
            ':physic_nbv_value'    => $row['physic_nbv_value'],
            ':physic_nbv_pct'      => $row['physic_nbv_pct'],
            ':db_physic_qty'       => $row['db_physic_qty'],
            ':db_physic_pct'       => $row['db_physic_pct'],
            ':db_nbv_value'        => $row['db_nbv_value'],
            ':db_nbv_pct'          => $row['db_nbv_pct'],
            ':total_physic_actual' => $row['total_physic_actual'],
            ':total_physic_target' => $row['total_physic_target'],
            ':total_physic_pct'    => $row['total_physic_pct'],
            ':total_nbv_actual'    => $row['total_nbv_actual'],
            ':total_nbv_target'    => $row['total_nbv_target'],
            ':total_nbv_pct'       => $row['total_nbv_pct'],
        ]);
        $importedCount++;
    }

    $db->commit();

    // Clean up temporary upload
    @unlink($storedPath);

    $monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    $primaryPeriod = reset($distinctPeriods) ?: ['month' => (int) date('n'), 'week' => 1, 'year' => (int) date('Y')];
    $periodLabel = ($monthNames[$primaryPeriod['month']] ?? 'Bulan') . " - Week {$primaryPeriod['week']} {$primaryPeriod['year']}";

    echo json_encode([
        'success'         => true,
        'imported_count'  => $importedCount,
        'period_label'    => $periodLabel,
        'detected_period' => $primaryPeriod,
        'all_periods'     => array_values($distinctPeriods),
        'message'         => "Berhasil mengimpor {$importedCount} baris data SO Profile Weekly ({$periodLabel}).",
    ]);

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    if ($storedPath && file_exists($storedPath)) {
        @unlink($storedPath);
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Gagal mengimpor file: ' . $e->getMessage()]);
}
