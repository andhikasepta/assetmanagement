<?php
/**
 * Export Rekapitulasi Status Penyelesaian DB to Excel (.xlsx)
 * Provides professional executive export for Rekapitulasi Status Penyelesaian DB
 * (Solved DB, Unsolved DB, New DB)
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Cell\DataType;

ini_set('display_errors', '0');
error_reporting(E_ALL);
ini_set('memory_limit', '1024M');
set_time_limit(180);
date_default_timezone_set('Asia/Jakarta');

// Determine input method (POST JSON or GET)
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$payload = [];
if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $payload = json_decode($rawInput, true) ?: [];
    }
}

try {
    $db = getDbConnection();

    $currMonth = (int) ($payload['month'] ?? $_GET['month'] ?? 2);
    $currYear = (int) ($payload['year'] ?? $_GET['year'] ?? 2026);
    if ($currYear < 2000 || $currYear > 2100)
        $currYear = 2026;
    if ($currMonth < 1 || $currMonth > 12)
        $currMonth = 2;

    if (isset($payload['compare_month']) && $payload['compare_month'] !== '') {
        $prevMonth = (int) $payload['compare_month'];
        $prevYear = (int) ($payload['compare_year'] ?? $currYear);
    } elseif (isset($_GET['compare_month']) && $_GET['compare_month'] !== '') {
        $prevMonth = (int) $_GET['compare_month'];
        $prevYear = (int) ($_GET['compare_year'] ?? $currYear);
    } else {
        if ($currMonth === 1) {
            $prevMonth = 12;
            $prevYear = $currYear - 1;
        } else {
            $prevMonth = $currMonth - 1;
            $prevYear = $currYear;
        }
    }

    $category = trim($payload['category'] ?? $_GET['category'] ?? 'pmd');
    $catLabel = trim($payload['category_label'] ?? $_GET['category_label'] ?? '');
    if (empty($catLabel)) {
        if (stripos($category, 'pmd') !== false) {
            $catLabel = 'PMD';
        } elseif (stripos($category, 'warehouse') !== false) {
            $catLabel = 'Warehouse & HUB';
        } else {
            $catLabel = 'Outlet Regional';
        }
    }

    $soType         = strtolower(trim($payload['so_type'] ?? $_GET['so_type'] ?? 'monthly'));
    $deptFilter     = trim($payload['dept'] ?? $_GET['dept'] ?? 'all');
    $subDeptFilter  = trim($payload['sub_dept'] ?? $_GET['sub_dept'] ?? 'all');
    $sitecodeFilter = trim($payload['sitecode'] ?? $_GET['sitecode'] ?? 'all');
    $statusFilter   = strtolower(trim($payload['status'] ?? $_GET['status'] ?? 'all'));
    $search         = trim($payload['search'] ?? $_GET['search'] ?? '');
    $sortCol        = trim($payload['sort_col'] ?? $_GET['sort_col'] ?? '');
    $sortDir        = strtolower(trim($payload['sort_dir'] ?? $_GET['sort_dir'] ?? 'asc')) === 'desc' ? 'DESC' : 'ASC';

    $monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    $currMonthLabel = ($monthNames[$currMonth] ?? '') . " " . $currYear;
    $prevMonthLabel = ($monthNames[$prevMonth] ?? '') . " " . $prevYear;

    // 1. Resolve valid sites for Category & SO Type from Site Master Data (site_regional)
    $isQuarterly = ($soType === 'quarterly' || in_array($category, [
        'quarterly_outlet',
        'quarterly_subarep',
        'quarterly_warehouse',
        'quarterly_warehouse_hub'
    ], true));

    $whereCatParts = [
        "(
            (COALESCE(sr.is_active, TRUE) = TRUE AND COALESCE(sr.is_counted, TRUE) = TRUE)
            OR EXISTS (
                SELECT 1 FROM rekap_db_master rdm
                WHERE (rdm.period_year = {$currYear} OR rdm.period_year = {$prevYear})
                  AND UPPER(rdm.sitecode) = UPPER(sr.sitecode)
            )
            OR EXISTS (
                SELECT 1 FROM site_group_history sgh 
                WHERE UPPER(sgh.sitecode) = UPPER(sr.sitecode)
                  AND (sgh.effective_year = {$currYear} OR sgh.effective_year = {$prevYear})
            )
        )"
    ];

    if ($category === 'pmd' || $category === 'monthly_pmd') {
        $whereCatParts[] = "sr.dept = 'PMD'";
    } else {
        $whereCatParts[] = "sr.dept != 'PMD'";
    }

    $whereCatSql = "WHERE " . implode(' AND ', $whereCatParts);
    $siteStmt = $db->query("
        SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type,
               COALESCE(is_active, TRUE) as is_active, COALESCE(is_counted, TRUE) as is_counted
        FROM site_regional sr
        $whereCatSql
        ORDER BY regional ASC, dept ASC, sub_dept ASC, sitecode ASC
    ");
    $rawCatSites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

    $histStmt = $db->prepare("
        SELECT DISTINCT ON (sitecode) sitecode, group_type
        FROM site_group_history
        WHERE effective_year < :y OR (effective_year = :y AND effective_month <= :m)
        ORDER BY sitecode, effective_year DESC, effective_month DESC
    ");
    $histStmt->execute([':y' => $currYear, ':m' => $currMonth]);
    $historyOverrides = [];
    foreach ($histStmt->fetchAll(PDO::FETCH_ASSOC) as $h) {
        $historyOverrides[strtoupper(trim($h['sitecode']))] = strtolower(trim($h['group_type']));
    }

    $categoryMasterSites = [];
    $validSitecodes = [];
    foreach ($rawCatSites as $s) {
        $sc = strtoupper(trim($s['sitecode'] ?? ''));
        $isPmd = (strtoupper(trim($s['dept'] ?? '')) === 'PMD');

        if ($isPmd) {
            $effGroup = 'monthly';
        } elseif (isset($historyOverrides[$sc])) {
            $effGroup = $historyOverrides[$sc];
        } else {
            if (empty($s['is_active'])) {
                $effGroup = 'inactive';
            } elseif (empty($s['is_counted'])) {
                $effGroup = 'uncounted';
            } else {
                $effGroup = strtolower(trim($s['group_type'] ?? 'monthly')) ?: 'monthly';
            }
        }

        if ($effGroup === 'inactive' || $effGroup === 'uncounted') {
            continue;
        }

        if ($isQuarterly) {
            if ($isPmd || $effGroup !== 'quarterly') {
                continue;
            }

            $info = trim($s['info'] ?? '');
            if ($category === 'warehouse_hub' || $category === 'quarterly_warehouse' || $category === 'quarterly_warehouse_hub') {
                if (!in_array($info, ['Under Warehouse', 'HUB'], true)) {
                    continue;
                }
            } else {
                if (!in_array($info, ['Subarep', 'Outlet', ''], true) && !empty($info)) {
                    continue;
                }
            }
        } else {
            if ($category === 'pmd' || $category === 'monthly_pmd') {
                if (!$isPmd)
                    continue;
            } else {
                if ($isPmd || $effGroup !== 'monthly') {
                    continue;
                }
            }
        }

        $s['effective_group_type'] = $effGroup;
        $categoryMasterSites[$sc] = $s;
        $validSitecodes[] = $sc;
    }

    $escapedSitecodes = array_map(function ($sc) use ($db) {
        return $db->quote($sc);
    }, $validSitecodes);
    $inValidSitesSql = !empty($escapedSitecodes) ? implode(',', $escapedSitecodes) : "''";

    // 2. CTE Query strictly joining with site_regional within the valid category sitecodes
    $sqlBase = "
        WITH prev AS (
            SELECT DISTINCT ON (TRIM(r.reg_no)) 
                r.sitecode, TRIM(r.reg_no) as reg_no, r.name, r.sn, r.nbv
            FROM rekap_db_master r
            INNER JOIN site_regional sr ON sr.sitecode = r.sitecode AND sr.sitecode IN ($inValidSitesSql)
            WHERE r.period_month = :prev_m AND r.period_year = :prev_y AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
            ORDER BY TRIM(r.reg_no), r.id
        ),
        curr AS (
            SELECT DISTINCT ON (TRIM(r.reg_no)) 
                r.sitecode, TRIM(r.reg_no) as reg_no, r.name, r.sn, r.nbv
            FROM rekap_db_master r
            INNER JOIN site_regional sr ON sr.sitecode = r.sitecode AND sr.sitecode IN ($inValidSitesSql)
            WHERE r.period_month = :curr_m AND r.period_year = :curr_y AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
            ORDER BY TRIM(r.reg_no), r.id
        ),
        combined AS (
            SELECT 
                COALESCE(c.sitecode, p.sitecode) as sitecode,
                COALESCE(c.reg_no, p.reg_no) as reg_no,
                COALESCE(c.name, p.name) as name,
                COALESCE(c.sn, p.sn) as sn,
                COALESCE(c.nbv, p.nbv, 0) as nbv,
                CASE 
                    WHEN p.reg_no IS NOT NULL AND c.reg_no IS NULL THEN 'solved'
                    WHEN p.reg_no IS NOT NULL AND c.reg_no IS NOT NULL THEN 'unsolved'
                    ELSE 'new_db'
                END as status,
                CASE WHEN p.reg_no IS NOT NULL THEN 1 ELSE 0 END as in_prev,
                CASE WHEN c.reg_no IS NOT NULL THEN 1 ELSE 0 END as in_curr
            FROM prev p
            FULL OUTER JOIN curr c ON p.reg_no = c.reg_no
        )
    ";

    $baseParams = [
        ':prev_m' => $prevMonth,
        ':prev_y' => $prevYear,
        ':curr_m' => $currMonth,
        ':curr_y' => $currYear
    ];

    // Compute Summary Stats following the selected DEPT, SUB DEPT, and SITECODE filters
    $statsWhere = [];
    $statsParams = $baseParams;
    if ($deptFilter !== 'all' && $deptFilter !== '') {
        $statsWhere[] = "sr.dept = :dept";
        $statsParams[':dept'] = $deptFilter;
    }
    if ($subDeptFilter !== 'all' && $subDeptFilter !== '') {
        $statsWhere[] = "sr.sub_dept = :sub_dept";
        $statsParams[':sub_dept'] = $subDeptFilter;
    }
    if ($sitecodeFilter !== 'all' && $sitecodeFilter !== '') {
        $statsWhere[] = "sr.sitecode = :sitecode";
        $statsParams[':sitecode'] = $sitecodeFilter;
    }
    $statsWhereSql = !empty($statsWhere) ? " WHERE " . implode(" AND ", $statsWhere) : "";

    $sqlStats = $sqlBase . "
        SELECT 
            COUNT(DISTINCT cb.sitecode) as total_sites,
            COUNT(*) as total_items,
            COUNT(*) FILTER (WHERE cb.status = 'solved') as solved_count,
            COUNT(*) FILTER (WHERE cb.status = 'unsolved') as unsolved_count,
            COUNT(*) FILTER (WHERE cb.status = 'new_db') as new_db_count,
            COALESCE(SUM(cb.nbv), 0) as total_nbv,
            COALESCE(SUM(CASE WHEN cb.status = 'solved' THEN cb.nbv ELSE 0 END), 0) as solved_nbv,
            COALESCE(SUM(CASE WHEN cb.status = 'unsolved' THEN cb.nbv ELSE 0 END), 0) as unsolved_nbv,
            COALESCE(SUM(CASE WHEN cb.status = 'new_db' THEN cb.nbv ELSE 0 END), 0) as new_db_nbv
        FROM combined cb
        INNER JOIN site_regional sr ON sr.sitecode = cb.sitecode
        $statsWhereSql
    ";

    $statsStmt = $db->prepare($sqlStats);
    $statsStmt->execute($statsParams);
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    // Filter master sites count
    $filteredMasterSites = array_filter($categoryMasterSites, function ($s) use ($deptFilter, $subDeptFilter, $sitecodeFilter) {
        if ($deptFilter !== 'all' && $deptFilter !== '' && $s['dept'] !== $deptFilter)
            return false;
        if ($subDeptFilter !== 'all' && $subDeptFilter !== '' && $s['sub_dept'] !== $subDeptFilter)
            return false;
        if ($sitecodeFilter !== 'all' && $sitecodeFilter !== '' && $s['sitecode'] !== $sitecodeFilter)
            return false;
        return true;
    });
    $totalMasterSites = count($filteredMasterSites);

    // Build WHERE clauses for item query (with DEPT, SUB DEPT, SITECODE, STATUS, SEARCH)
    $params = $baseParams;
    $whereConditions = [];
    if ($deptFilter !== 'all' && $deptFilter !== '') {
        $whereConditions[] = "sr.dept = :dept";
        $params[':dept'] = $deptFilter;
    }
    if ($subDeptFilter !== 'all' && $subDeptFilter !== '') {
        $whereConditions[] = "sr.sub_dept = :sub_dept";
        $params[':sub_dept'] = $subDeptFilter;
    }
    if ($sitecodeFilter !== 'all' && $sitecodeFilter !== '') {
        $whereConditions[] = "sr.sitecode = :sitecode";
        $params[':sitecode'] = $sitecodeFilter;
    }
    if ($statusFilter !== 'all' && in_array($statusFilter, ['solved', 'unsolved', 'new_db'], true)) {
        $whereConditions[] = "cb.status = :status";
        $params[':status'] = $statusFilter;
    }
    if ($search !== '') {
        $whereConditions[] = "(
            cb.sitecode ILIKE :search OR 
            sr.name_site ILIKE :search OR 
            cb.reg_no ILIKE :search OR 
            cb.name ILIKE :search OR 
            cb.sn ILIKE :search
        )";
        $params[':search'] = '%' . $search . '%';
    }

    $whereSql = !empty($whereConditions) ? " WHERE " . implode(" AND ", $whereConditions) : "";

    $allowedSortCols = [
        'dept' => 'sr.dept',
        'sub_dept' => 'sr.sub_dept',
        'sitecode' => 'cb.sitecode',
        'name_site' => 'sr.name_site',
        'reg_no' => 'cb.reg_no',
        'name' => 'cb.name',
        'sn' => 'cb.sn',
        'nbv' => 'cb.nbv',
        'status' => 'cb.status',
    ];

    $orderBySql = "ORDER BY sr.dept ASC, sr.sub_dept ASC, cb.sitecode ASC, cb.reg_no ASC";
    if (isset($allowedSortCols[$sortCol])) {
        $dbCol = $allowedSortCols[$sortCol];
        $orderBySql = "ORDER BY {$dbCol} {$sortDir}, cb.reg_no ASC";
    }

    $dataSql = $sqlBase . "
        SELECT 
            cb.sitecode,
            sr.name_site,
            sr.regional,
            sr.dept,
            sr.sub_dept,
            cb.reg_no,
            cb.name,
            cb.sn,
            cb.nbv,
            cb.status,
            cb.in_prev,
            cb.in_curr
        FROM combined cb
        INNER JOIN site_regional sr ON sr.sitecode = cb.sitecode
        $whereSql
        $orderBySql
    ";

    $dataStmt = $db->prepare($dataSql);
    foreach ($params as $k => $v) {
        $dataStmt->bindValue($k, $v);
    }
    $dataStmt->execute();
    $items = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Initialize PhpSpreadsheet
    $ss = new Spreadsheet();
    $ss->getProperties()
        ->setCreator('Asset Management System')
        ->setTitle("Rekapitulasi Status DB {$currMonthLabel}")
        ->setSubject("Rekapitulasi Status Penyelesaian DB {$currMonthLabel}");

    $sheet = $ss->getActiveSheet();
    $sheetTitle = substr("Status DB {$currMonthLabel}", 0, 31);
    $sheet->setTitle($sheetTitle);
    $sheet->setShowGridLines(true);

    // Document Header Title Block
    $sheet->setCellValue('A1', 'REKAPITULASI STATUS PENYELESAIAN DB');
    $sheet->getStyle('A1')->applyFromArray([
        'font' => [
            'name' => 'Calibri',
            'bold' => true,
            'size' => 15,
            'color' => ['rgb' => '0F172A'],
        ],
    ]);
    $sheet->getRowDimension(1)->setRowHeight(22);

    // Row 2: Periode : Bulan Tahun
    $sheet->setCellValue('A2', "Periode : {$currMonthLabel}");
    $sheet->getStyle('A2')->applyFromArray([
        'font' => [
            'name' => 'Calibri',
            'bold' => true,
            'size' => 10,
            'color' => ['rgb' => '1E40AF'],
        ],
    ]);
    $sheet->getRowDimension(2)->setRowHeight(18);

    // Row 3: Export: dd/mm/YYYY HH:ii WIB | Total Site: X Data
    $nowFormatted = date('d/m/Y H:i');
    $totalSitesCount = (int) ($stats['total_sites'] ?? 0);
    $exportMeta = "Export: {$nowFormatted} WIB | Total Site: {$totalSitesCount} Data";
    $sheet->setCellValue('A3', $exportMeta);
    $sheet->getStyle('A3')->applyFromArray([
        'font' => [
            'name' => 'Calibri',
            'size' => 9.5,
            'italic' => true,
            'color' => ['rgb' => '64748B'],
        ],
    ]);
    $sheet->getRowDimension(3)->setRowHeight(18);
    $sheet->getRowDimension(4)->setRowHeight(12);

    // KPI Summary Block (Rows 5 to 10)
    $totalDbCount = (int) ($stats['total_items'] ?? 0);
    $solvedCount = (int) ($stats['solved_count'] ?? 0);
    $unsolvedCount = (int) ($stats['unsolved_count'] ?? 0);
    $newDbCount = (int) ($stats['new_db_count'] ?? 0);

    $solvedPct = $totalDbCount > 0 ? ($solvedCount / $totalDbCount) : 0;
    $unsolvedPct = $totalDbCount > 0 ? ($unsolvedCount / $totalDbCount) : 0;
    $newDbPct = $totalDbCount > 0 ? ($newDbCount / $totalDbCount) : 0;

    $totalNbv = (float) ($stats['total_nbv'] ?? 0);
    $solvedNbv = (float) ($stats['solved_nbv'] ?? 0);
    $unsolvedNbv = (float) ($stats['unsolved_nbv'] ?? 0);
    $newDbNbv = (float) ($stats['new_db_nbv'] ?? 0);

    // Summary Strip Header (Row 5)
    $sheet->setCellValue('A5', 'RINGKASAN STATUS DB');
    $sheet->mergeCells('A5:E5');
    $sheet->getStyle('A5:E5')->applyFromArray([
        'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => 'FFFFFF']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E293B']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER, 'indent' => 1],
    ]);
    $sheet->getRowDimension(5)->setRowHeight(20);

    // KPI Table Headers (Row 6)
    $sheet->setCellValue('A6', 'STATUS');
    $sheet->setCellValue('B6', 'JUMLAH DB');
    $sheet->setCellValue('C6', 'PERSENTASE');
    $sheet->setCellValue('D6', 'TOTAL NBV');
    $sheet->setCellValue('E6', 'SITES TERKAIT');
    $sheet->getStyle('A6:E6')->applyFromArray([
        'font' => ['bold' => true, 'size' => 9.5, 'color' => ['rgb' => '0F172A']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F1F5F9']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']]],
    ]);
    $sheet->getRowDimension(6)->setRowHeight(19);

    // KPI Row 7: SOLVED DB
    $sheet->setCellValue('A7', 'SOLVED DB');
    $sheet->setCellValue('B7', $solvedCount);
    $sheet->setCellValue('C7', $solvedPct);
    $sheet->setCellValue('D7', $solvedNbv);
    $sheet->setCellValue('E7', "Ada di {$prevMonthLabel}, DB solved di {$currMonthLabel}");
    $sheet->getStyle('A7')->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => '15803D']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'DCFCE7']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
    ]);
    $sheet->getStyle('B7')->getNumberFormat()->setFormatCode('#,##0');
    $sheet->getStyle('C7')->getNumberFormat()->setFormatCode('0.0%');
    $sheet->getStyle('D7')->getNumberFormat()->setFormatCode('"Rp "#,##0.00');
    $sheet->getStyle('B7:D7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    $sheet->getStyle('A7:E7')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('CBD5E1'));

    // KPI Row 8: UNSOLVED DB
    $sheet->setCellValue('A8', 'UNSOLVED DB');
    $sheet->setCellValue('B8', $unsolvedCount);
    $sheet->setCellValue('C8', $unsolvedPct);
    $sheet->setCellValue('D8', $unsolvedNbv);
    $sheet->setCellValue('E8', "Belum solved (masih tercatat di {$currMonthLabel})");
    $sheet->getStyle('A8')->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => 'B91C1C']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEE2E2']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
    ]);
    $sheet->getStyle('B8')->getNumberFormat()->setFormatCode('#,##0');
    $sheet->getStyle('C8')->getNumberFormat()->setFormatCode('0.0%');
    $sheet->getStyle('D8')->getNumberFormat()->setFormatCode('"Rp "#,##0.00');
    $sheet->getStyle('B8:D8')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    $sheet->getStyle('A8:E8')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('CBD5E1'));

    // KPI Row 9: NEW DB
    $sheet->setCellValue('A9', 'NEW DB');
    $sheet->setCellValue('B9', $newDbCount);
    $sheet->setCellValue('C9', $newDbPct);
    $sheet->setCellValue('D9', $newDbNbv);
    $sheet->setCellValue('E9', "Temuan DB baru di {$currMonthLabel}");
    $sheet->getStyle('A9')->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => '1D4ED8']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'DBEAFE']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
    ]);
    $sheet->getStyle('B9')->getNumberFormat()->setFormatCode('#,##0');
    $sheet->getStyle('C9')->getNumberFormat()->setFormatCode('0.0%');
    $sheet->getStyle('D9')->getNumberFormat()->setFormatCode('"Rp "#,##0.00');
    $sheet->getStyle('B9:D9')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    $sheet->getStyle('A9:E9')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('CBD5E1'));

    // KPI Row 10: TOTAL DB
    $sheet->setCellValue('A10', 'TOTAL DB');
    $sheet->setCellValue('B10', $totalDbCount);
    $sheet->setCellValue('C10', 1.0);
    $sheet->setCellValue('D10', $totalNbv);
    $sheet->setCellValue('E10', "{$totalSitesCount}/{$totalMasterSites} Sites");
    $sheet->getStyle('A10:E10')->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => '0F172A']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '94A3B8']]],
    ]);
    $sheet->getStyle('A10')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle('B10')->getNumberFormat()->setFormatCode('#,##0');
    $sheet->getStyle('C10')->getNumberFormat()->setFormatCode('0.0%');
    $sheet->getStyle('D10')->getNumberFormat()->setFormatCode('"Rp "#,##0.00');
    $sheet->getStyle('B10:D10')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    $sheet->getRowDimension(10)->setRowHeight(19);

    // Table Column Headers (Row 13)
    $headerRow = 13;
    $headers = [
        'A' => 'NO',
        'B' => 'DEPT',
        'C' => 'SUB DEPT',
        'D' => 'SITECODE',
        'E' => 'NAMA SITE',
        'F' => 'REG NO',
        'G' => 'NAME',
        'H' => 'SN',
        'I' => 'NBV',
        'J' => 'STATUS',
        'K' => 'KETERANGAN',
    ];

    foreach ($headers as $colLetter => $colName) {
        $sheet->setCellValue("{$colLetter}{$headerRow}", $colName);
    }

    $headerRange = "A{$headerRow}:K{$headerRow}";
    $sheet->getStyle($headerRange)->applyFromArray([
        'font' => [
            'name' => 'Calibri',
            'bold' => true,
            'color' => ['rgb' => 'FFFFFF'],
            'size' => 10,
        ],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => '0F172A'], // Dark Navy Header
        ],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_CENTER,
            'vertical' => Alignment::VERTICAL_CENTER,
            'wrapText' => false,
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => '334155'],
            ],
        ],
    ]);
    $sheet->getRowDimension($headerRow)->setRowHeight(24);

    // Data Rows (Row 14 onwards)
    $startDataRow = 14;
    $currentRow = $startDataRow;
    $itemCount = count($items);

    for ($i = 0; $i < $itemCount; $i++) {
        $row = $items[$i];
        $st = strtolower(trim($row['status'] ?? ''));

        $sheet->setCellValue("A{$currentRow}", $i + 1);
        $sheet->setCellValue("B{$currentRow}", $row['dept'] ?? '');
        $sheet->setCellValue("C{$currentRow}", $row['sub_dept'] ?? '');
        $sheet->setCellValueExplicit("D{$currentRow}", (string) ($row['sitecode'] ?? ''), DataType::TYPE_STRING);
        $sheet->setCellValue("E{$currentRow}", $row['name_site'] ?? '');
        $sheet->setCellValueExplicit("F{$currentRow}", (string) ($row['reg_no'] ?? ''), DataType::TYPE_STRING);
        $sheet->setCellValue("G{$currentRow}", $row['name'] ?? '');
        $sheet->setCellValueExplicit("H{$currentRow}", (string) ($row['sn'] ?? ''), DataType::TYPE_STRING);

        $nbvVal = (float) ($row['nbv'] ?? 0);
        $sheet->setCellValue("I{$currentRow}", $nbvVal);
        $sheet->getStyle("I{$currentRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0.00');

        $statusLabel = 'NEW DB';
        $keterangan = "Temuan DB baru di {$currMonthLabel}";
        $badgeBg = 'DBEAFE';
        $badgeFg = '1D4ED8';

        if ($st === 'solved') {
            $statusLabel = 'SOLVED';
            $keterangan = "Ada di {$prevMonthLabel}, DB solved di {$currMonthLabel}";
            $badgeBg = 'DCFCE7';
            $badgeFg = '15803D';
        } elseif ($st === 'unsolved') {
            $statusLabel = 'UNSOLVED';
            $keterangan = "Belum solved (masih tercatat di {$currMonthLabel})";
            $badgeBg = 'FEE2E2';
            $badgeFg = 'B91C1C';
        }

        $sheet->setCellValue("J{$currentRow}", $statusLabel);
        $sheet->getStyle("J{$currentRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 9.5, 'color' => ['rgb' => $badgeFg]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $badgeBg]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);

        $sheet->setCellValue("K{$currentRow}", $keterangan);

        // Center alignments for specific columns
        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("B{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("F{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("H{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("I{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

        $sheet->getRowDimension($currentRow)->setRowHeight(20);
        $currentRow++;
    }

    // Apply borders across all data rows
    if ($itemCount > 0) {
        $lastDataRow = $currentRow - 1;
        $sheet->getStyle("A{$startDataRow}:K{$lastDataRow}")->applyFromArray([
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'E2E8F0'],
                ],
            ],
            'alignment' => [
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);

        // Table Summary / Total Row
        $sheet->setCellValue("A{$currentRow}", 'TOTAL');
        $sheet->mergeCells("A{$currentRow}:H{$currentRow}");
        $sheet->setCellValue("I{$currentRow}", "=SUM(I{$startDataRow}:I{$lastDataRow})");
        $sheet->getStyle("I{$currentRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0.00');
        $sheet->setCellValue("J{$currentRow}", "{$itemCount} DB");
        $sheet->setCellValue("K{$currentRow}", "");

        $sheet->getStyle("A{$currentRow}:K{$currentRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => '0F172A']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F1F5F9']],
            'borders' => [
                'top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '94A3B8']],
                'bottom' => ['borderStyle' => Border::BORDER_DOUBLE, 'color' => ['rgb' => '0F172A']],
                'left' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']],
                'right' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']],
            ],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle("I{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle("J{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getRowDimension($currentRow)->setRowHeight(22);
    } else {
        // No data placeholder row
        $sheet->setCellValue("A{$startDataRow}", "Tidak ada data status DB yang memenuhi kriteria filter.");
        $sheet->mergeCells("A{$startDataRow}:K{$startDataRow}");
        $sheet->getStyle("A{$startDataRow}:K{$startDataRow}")->applyFromArray([
            'font' => ['italic' => true, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E2E8F0']]],
        ]);
        $sheet->getRowDimension($startDataRow)->setRowHeight(26);
    }

    // Set Column Dimensions with comfortable padding
    $sheet->getColumnDimension('A')->setWidth(7);
    $sheet->getColumnDimension('B')->setWidth(13);
    $sheet->getColumnDimension('C')->setWidth(14);
    $sheet->getColumnDimension('D')->setWidth(16);
    $sheet->getColumnDimension('E')->setWidth(28);
    $sheet->getColumnDimension('F')->setWidth(24);
    $sheet->getColumnDimension('G')->setWidth(34);
    $sheet->getColumnDimension('H')->setWidth(22);
    $sheet->getColumnDimension('I')->setWidth(20);
    $sheet->getColumnDimension('J')->setWidth(15);
    $sheet->getColumnDimension('K')->setWidth(44);

    // Freeze panes at startDataRow so table header remains visible when scrolling
    $sheet->freezePane("A{$startDataRow}");

    // Clean filename
    $safeCat = preg_replace('/[^A-Za-z0-9_-]/', '_', $catLabel);
    $safeMonth = preg_replace('/[^A-Za-z0-9_-]/', '_', $monthNames[$currMonth] ?? "M{$currMonth}");
    $filename = "Rekapitulasi_Status_DB_{$safeCat}_{$safeMonth}_{$currYear}.xlsx";

    // Send download headers
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0, no-cache, no-store, must-revalidate');
    header('Pragma: public');

    $writer = new Xlsx($ss);
    $writer->save('php://output');
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Terjadi kesalahan sistem saat mengekspor Excel: ' . $e->getMessage()
    ]);
    exit;
}
