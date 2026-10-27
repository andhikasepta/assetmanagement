<?php
/**
 * Export Rekapitulasi to Excel (.xlsx)
 * Provides professional executive export for Rekapitulasi Stock Opname
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

ini_set('memory_limit', '512M');
set_time_limit(180);
date_default_timezone_set('Asia/Jakarta');

// Determine input method (POST JSON or GET)
$method = $_SERVER['REQUEST_METHOD'];
$payload = [];

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $payload = json_decode($rawInput, true) ?: [];
    }
}

$year = (int) ($payload['year'] ?? $_GET['year'] ?? 2026);
if ($year < 2000 || $year > 2100) {
    $year = 2026;
}

$category = trim($payload['category'] ?? $_GET['category'] ?? 'pmd');
$catLabel = trim($payload['category_label'] ?? $_GET['category_label'] ?? '');
if (empty($catLabel)) {
    if ($category === 'all' || $category === 'all_monthly' || $category === 'all_quarterly') {
        $catLabel = 'All Sites';
    } elseif (stripos($category, 'pmd') !== false) {
        $catLabel = 'PMD';
    } elseif (stripos($category, 'warehouse') !== false) {
        $catLabel = 'Warehouse & HUB';
    } else {
        $catLabel = 'Outlet Regional';
    }
}

$soType = strtolower(trim($payload['so_type'] ?? $_GET['so_type'] ?? 'monthly'));
$isQuarterly = ($soType === 'quarterly');

$deptFilter = trim($payload['dept_filter'] ?? $_GET['dept'] ?? 'all');
$subDeptFilter = trim($payload['subdept_filter'] ?? $_GET['sub_dept'] ?? 'all');
$searchQuery = strtolower(trim($payload['search_query'] ?? $_GET['search'] ?? ''));

$rows = $payload['rows'] ?? null;

// If rows are not passed in POST payload, fetch and filter from database
if (!is_array($rows)) {
    try {
        $db = getDbConnection();

        $whereParts = [];
        if ($category === 'all' || $category === 'all_monthly' || $category === 'all_quarterly') {
            if ($isQuarterly || $soType === 'quarterly') {
                $whereParts[] = "(group_type = 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type = 'quarterly'))";
            } else {
                $whereParts[] = "(group_type != 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type != 'quarterly'))";
            }
        } elseif ($category === 'pmd' || $category === 'monthly_pmd') {
            $whereParts[] = "(dept IN ('PMD', 'DNO', 'DSO') OR COALESCE(divisi, '') = 'PMD')";
        } elseif ($category === 'quarterly_tekno' || $category === 'quarterly_warehouse_tekno' || ($category === 'warehouse_tekno' && ($isQuarterly || $soType === 'quarterly'))) {
            $whereParts[] = "COALESCE(dept, '') NOT IN ('PMD', 'DNO', 'DSO') AND COALESCE(divisi, '') != 'PMD' AND name_site ILIKE '%TEKNO%' AND (group_type = 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type = 'quarterly'))";
        } elseif ($category === 'monthly_tekno' || $category === 'monthly_warehouse_tekno' || $category === 'warehouse_tekno') {
            $whereParts[] = "COALESCE(dept, '') NOT IN ('PMD', 'DNO', 'DSO') AND COALESCE(divisi, '') != 'PMD' AND name_site ILIKE '%TEKNO%' AND (group_type != 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type != 'quarterly'))";
        } elseif ($category === 'quarterly_subarep') {
            $whereParts[] = "dept NOT IN ('PMD', 'DNO', 'DSO') AND COALESCE(divisi, '') != 'PMD' AND name_site NOT ILIKE '%TEKNO%' AND (info IN ('Subarep', 'Outlet') OR info IS NULL OR info = '') AND (group_type = 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type = 'quarterly'))";
        } elseif ($category === 'quarterly_warehouse' || $category === 'quarterly_warehouse_hub') {
            $whereParts[] = "dept NOT IN ('PMD', 'DNO', 'DSO') AND COALESCE(divisi, '') != 'PMD' AND name_site NOT ILIKE '%TEKNO%' AND (info = 'HUB Quarterly' OR (info = 'HUB' AND (group_type = 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type = 'quarterly'))))";
        } elseif ($category === 'monthly_warehouse' || $category === 'monthly_warehouse_hub') {
            $whereParts[] = "dept NOT IN ('PMD', 'DNO', 'DSO') AND COALESCE(divisi, '') != 'PMD' AND name_site NOT ILIKE '%TEKNO%' AND (info = 'HUB Monthly' OR (info = 'HUB' AND group_type != 'quarterly'))";
        } elseif ($category === 'monthly_it_coorporate' || $category === 'it_coorporate' || $category === 'monthly_it_corporate' || $category === 'it_corporate') {
            $whereParts[] = "dept NOT IN ('PMD', 'DNO', 'DSO') AND COALESCE(divisi, '') != 'PMD' AND info IN ('IT Coorporate', 'IT Corporate')";
        } elseif ($category === 'quarterly' || $category === 'quarterly_outlet') {
            $whereParts[] = "dept NOT IN ('PMD', 'DNO', 'DSO') AND COALESCE(divisi, '') != 'PMD' AND name_site NOT ILIKE '%TEKNO%' AND (group_type = 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type = 'quarterly'))";
        } else {
            $whereParts[] = "dept NOT IN ('PMD', 'DNO', 'DSO') AND COALESCE(divisi, '') != 'PMD' AND name_site NOT ILIKE '%TEKNO%' AND (info NOT IN ('HUB Monthly', 'HUB Quarterly', 'IT Coorporate', 'IT Corporate', 'Under Warehouse', 'HUB') OR info IS NULL) AND (
                EXISTS (
                    SELECT 1 FROM asset_reconciliation ar 
                    WHERE ar.period_year = {$year}
                      AND (
                          ar.profile ILIKE '% - ' || site_regional.sitecode || ' - %'
                          OR ar.profile ILIKE '%-' || site_regional.sitecode || '-%'
                          OR ar.profile ILIKE '% ' || site_regional.sitecode || ' %'
                          OR ar.profile ILIKE '%' || site_regional.sitecode || '%'
                      )
                      AND ar.profile !~* '\\mQ[1-4]\\M'
                )
                OR (
                    group_type != 'quarterly'
                    AND NOT EXISTS (
                        SELECT 1 FROM asset_reconciliation ar_q 
                        WHERE ar_q.period_year = {$year}
                          AND (
                              ar_q.profile ILIKE '% - ' || site_regional.sitecode || ' - %'
                              OR ar_q.profile ILIKE '%-' || site_regional.sitecode || '-%'
                              OR ar_q.profile ILIKE '% ' || site_regional.sitecode || ' %'
                              OR ar_q.profile ILIKE '%' || site_regional.sitecode || '%'
                          )
                          AND ar_q.profile ~* '\\mQ[1-4]\\M'
                    )
                )
            )";
        }

        $whereParts[] = "(
            (COALESCE(site_regional.is_active, TRUE) = TRUE AND COALESCE(site_regional.is_counted, TRUE) = TRUE)
            OR EXISTS (
                SELECT 1 FROM asset_reconciliation ar 
                WHERE ar.period_year = {$year}
                  AND (
                      ar.profile ILIKE '% - ' || site_regional.sitecode || ' - %'
                      OR ar.profile ILIKE '%-' || site_regional.sitecode || '-%'
                      OR ar.profile ILIKE '% ' || site_regional.sitecode || ' %'
                      OR ar.profile ILIKE '%' || site_regional.sitecode || '%'
                  )
            )
            OR EXISTS (
                SELECT 1 FROM site_group_history sgh 
                WHERE UPPER(sgh.sitecode) = UPPER(site_regional.sitecode)
                  AND sgh.effective_year = {$year}
            )
        )";
        $whereSql = "WHERE " . implode(' AND ', $whereParts);

        $siteStmt = $db->query("
            SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type,
                   COALESCE(divisi, '') as divisi,
                   COALESCE(is_active, TRUE) as is_active, COALESCE(is_counted, TRUE) as is_counted
            FROM site_regional
            $whereSql
            ORDER BY regional ASC, dept ASC, sub_dept ASC, sitecode ASC, id ASC
        ");
        $sites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

        $baseTypes = [];
        foreach ($sites as $s) {
            $sc = strtoupper(trim($s['sitecode'] ?? ''));
            if (strtoupper(trim($s['divisi'] ?? '')) === 'PMD' || in_array(strtoupper(trim($s['dept'] ?? '')), ['PMD', 'DNO', 'DSO'])) {
                $baseTypes[$sc] = 'monthly';
            } elseif (empty($s['is_active'])) {
                $baseTypes[$sc] = 'inactive';
            } elseif (empty($s['is_counted'])) {
                $baseTypes[$sc] = 'uncounted';
            } else {
                $baseTypes[$sc] = $s['group_type'] ?: 'monthly';
            }
        }

        $histStmt = $db->prepare("
            SELECT DISTINCT ON (sitecode) sitecode, group_type
            FROM site_group_history
            WHERE effective_year < :y OR (effective_year = :y AND effective_month <= :m)
            ORDER BY sitecode, effective_year DESC, effective_month DESC
        ");

        $monthlyEffMap = [];
        for ($m = 1; $m <= 12; $m++) {
            $monthlyEffMap[$m] = $baseTypes;
            $histStmt->execute([':y' => $year, ':m' => $m]);
            foreach ($histStmt->fetchAll(PDO::FETCH_ASSOC) as $hr) {
                $sc = strtoupper(trim($hr['sitecode']));
                if (isset($monthlyEffMap[$m][$sc])) {
                    $monthlyEffMap[$m][$sc] = $hr['group_type'];
                }
            }
        }

        $isQuarterlyCat = in_array($category, ['quarterly', 'quarterly_outlet', 'quarterly_subarep', 'quarterly_warehouse', 'quarterly_warehouse_hub', 'quarterly_tekno', 'quarterly_warehouse_tekno'], true) || $isQuarterly;
        $recStmt = $db->prepare("
            SELECT id, profile, period_month, period_year, total_physic_actual, total_physic_target, total_physic_pct
            FROM asset_reconciliation
            WHERE period_year = :year
            ORDER BY period_month ASC, id ASC
        ");
        $recStmt->execute([':year' => $year]);
        $recRows = $recStmt->fetchAll(PDO::FETCH_ASSOC);

        $recByCodeAndMonth = [];
        $recByMonthList = [];

        foreach ($recRows as $r) {
            $m = (int) $r['period_month'];
            $profile = trim($r['profile'] ?? '');
            $pct = (float) $r['total_physic_pct'];
            $isQ = (bool) preg_match('/\bQ[1-4]\b/i', $profile);

            $recByMonthList[$m][] = [
                'profile' => $profile,
                'pct' => $pct,
                'is_q' => $isQ,
            ];

            $parts = explode('-', $profile);
            foreach ($parts as $p) {
                $token = strtoupper(trim($p));
                if ($token !== '') {
                    if ($isQ && !isset($recByCodeAndMonth[$token][$m]['q'])) {
                        $recByCodeAndMonth[$token][$m]['q'] = $pct;
                    }
                    if (!$isQ && !isset($recByCodeAndMonth[$token][$m]['m'])) {
                        $recByCodeAndMonth[$token][$m]['m'] = $pct;
                    }
                    if (!isset($recByCodeAndMonth[$token][$m]['any'])) {
                        $recByCodeAndMonth[$token][$m]['any'] = $pct;
                    }
                }
            }
        }

        $rows = [];
        foreach ($sites as $s) {
            $sitecode = trim($s['sitecode'] ?? '');
            $upperCode = strtoupper($sitecode);

            $months = [];
            for ($m = 1; $m <= 12; $m++) {
                $val = null;
                $eff = $monthlyEffMap[$m][$upperCode] ?? 'monthly';

                $canShow = ($eff !== 'inactive' && $eff !== 'uncounted');
                if ($canShow && $isQuarterlyCat) {
                    $canShow = in_array($m, [3, 6, 9, 12], true) && $eff === 'quarterly';
                } elseif ($canShow && !$isQuarterlyCat) {
                    $canShow = ($eff !== 'quarterly');
                }

                if ($canShow && $sitecode !== '') {
                    if (isset($recByCodeAndMonth[$upperCode][$m])) {
                        $entry = $recByCodeAndMonth[$upperCode][$m];
                        $val = $isQuarterlyCat ? ($entry['q'] ?? $entry['any'] ?? null) : ($entry['m'] ?? null);
                    } elseif (!empty($recByMonthList[$m])) {
                        $matchedItem = null;
                        foreach ($recByMonthList[$m] as $item) {
                            if (stripos($item['profile'], $sitecode) !== false) {
                                if ($isQuarterlyCat && !empty($item['is_q'])) {
                                    $matchedItem = $item;
                                    break;
                                } elseif (!$isQuarterlyCat && empty($item['is_q'])) {
                                    $matchedItem = $item;
                                    break;
                                } elseif ($matchedItem === null) {
                                    $matchedItem = $item;
                                }
                            }
                        }
                        if ($matchedItem !== null) {
                            $val = $matchedItem['pct'];
                        }
                    }
                }

                $months[$m] = $val;
            }

            if (!$isQuarterlyCat) {
                $hasAnyMonthly = false;
                foreach ($months as $mVal) {
                    if ($mVal !== null) {
                        $hasAnyMonthly = true;
                        break;
                    }
                }
                if (!$hasAnyMonthly) {
                    $hasQuarterlyOnly = false;
                    if (!empty($recByCodeAndMonth[$upperCode])) {
                        $hasQuarterlyOnly = true;
                        foreach ($recByCodeAndMonth[$upperCode] as $mEntry) {
                            if (isset($mEntry['m'])) {
                                $hasQuarterlyOnly = false;
                                break;
                            }
                        }
                    }
                    if ($hasQuarterlyOnly || ($s['group_type'] ?? '') === 'quarterly') {
                        continue;
                    }
                }
            }

            $rows[] = [
                'regional' => $s['regional'] ?? '',
                'divisi' => $s['divisi'] ?? '',
                'dept' => $s['dept'] ?? '',
                'sub_dept' => $s['sub_dept'] ?? '',
                'sitecode' => $sitecode,
                'name_site' => $s['name_site'] ?? '',
                'months' => $months,
            ];
        }

        // Apply filters if passed via GET
        if ($deptFilter && $deptFilter !== 'all') {
            $rows = array_values(array_filter($rows, function ($r) use ($deptFilter) {
                return strcasecmp(trim($r['dept'] ?? ''), $deptFilter) === 0;
            }));
        }

        if ($subDeptFilter && $subDeptFilter !== 'all') {
            $rows = array_values(array_filter($rows, function ($r) use ($subDeptFilter) {
                return strcasecmp(trim($r['sub_dept'] ?? ''), $subDeptFilter) === 0;
            }));
        }

        if ($searchQuery) {
            $rows = array_values(array_filter($rows, function ($r) use ($searchQuery) {
                $haystack = strtolower(($r['regional'] ?? '') . ' ' . ($r['dept'] ?? '') . ' ' . ($r['sub_dept'] ?? '') . ' ' . ($r['sitecode'] ?? '') . ' ' . ($r['name_site'] ?? ''));
                return strpos($haystack, $searchQuery) !== false;
            }));
        }

    } catch (Throwable $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Gagal mengambil data untuk export: ' . $e->getMessage()]);
        exit;
    }
}

// Prepare Visible Month Columns
if ($isQuarterly) {
    $monthCols = [
        3 => 'Q1 (MAR)',
        6 => 'Q2 (JUN)',
        9 => 'Q3 (SEP)',
        12 => 'Q4 (DEC)',
    ];
} else {
    $monthCols = [
        1 => 'JANUARY',
        2 => 'FEBRUARY',
        3 => 'MARCH',
        4 => 'APRIL',
        5 => 'MAY',
        6 => 'JUNE',
        7 => 'JULY',
        8 => 'AUGUST',
        9 => 'SEPTEMBER',
        10 => 'OCTOBER',
        11 => 'NOVEMBER',
        12 => 'DECEMBER',
    ];
}

// Initialize Spreadsheet
$ss = new Spreadsheet();
$ss->getProperties()
    ->setCreator('Asset Management System')
    ->setTitle("Rekapitulasi Stock Opname {$catLabel} {$year}")
    ->setSubject("Rekapitulasi {$catLabel} {$year}");

$sheet = $ss->getActiveSheet();
$sheet->setTitle(substr("Rekap {$catLabel} {$year}", 0, 31));
$sheet->setShowGridLines(true);

// Row 1: Simple Generated Timestamp
$monthNamesIndo = [
    1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
    7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
];
$mNum = (int) date('n');
$currentMonthName = $monthNamesIndo[$mNum] ?? date('F');
$generatedText = "Generated : " . $currentMonthName . " " . date('Y') . " " . date('H:i');
$sheet->setCellValue('A1', $generatedText);
$sheet->getStyle('A1')->applyFromArray([
    'font' => [
        'size' => 9.5,
        'italic' => true,
        'color' => ['rgb' => '64748B'],
    ],
]);
$sheet->getRowDimension(1)->setRowHeight(18);

// Row 2: Table Column Headers (Basic Excel Grey Style)
$headerRow = 2;
$isPmdCategory = ($category === 'pmd' || $category === 'monthly_pmd');

if ($isPmdCategory) {
    $headers = [
        'NO',
        'DIVISI',
        'DEPT',
        'SUB DEPT',
        'SITECODE',
        'NAME SITE',
    ];
} else {
    $headers = [
        'NO',
        'DEPT',
        'SUB DEPT',
        'SITECODE',
        'NAME SITE',
    ];
}
foreach ($monthCols as $mNum => $mName) {
    $headers[] = $mName;
}

$colIndex = 1;
foreach ($headers as $hText) {
    $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex);
    $cellCoord = "{$colLetter}{$headerRow}";
    $sheet->setCellValue($cellCoord, $hText);
    $colIndex++;
}

$lastColIndex = count($headers);
$lastColLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($lastColIndex);
$headerRange = "A{$headerRow}:{$lastColLetter}{$headerRow}";

$sheet->getStyle($headerRange)->applyFromArray([
    'font' => [
        'bold' => true,
        'color' => ['rgb' => '000000'], // Black text for basic Excel format
        'size' => 10,
    ],
    'fill' => [
        'fillType' => Fill::FILL_SOLID,
        'startColor' => ['rgb' => 'E2E8F0'], // Basic Excel light grey
    ],
    'alignment' => [
        'horizontal' => Alignment::HORIZONTAL_CENTER,
        'vertical' => Alignment::VERTICAL_CENTER,
        'wrapText' => false,
    ],
    'borders' => [
        'allBorders' => [
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['rgb' => '94A3B8'],
        ],
    ],
]);
$sheet->getRowDimension($headerRow)->setRowHeight(24);

// Color thresholds helper
$isPmd = (stripos($catLabel, 'PMD') !== false || stripos($category, 'pmd') !== false);

function getCellColorStyles(float $val, bool $isPmd): array {
    $num = round($val);
    if ($isPmd) {
        if ($num >= 98) {
            return ['bg' => 'DCFCE7', 'fg' => '15803D']; // Green
        } else {
            return ['bg' => 'FEE2E2', 'fg' => 'DC2626']; // Red
        }
    } else {
        if ($num >= 85) {
            return ['bg' => 'DCFCE7', 'fg' => '15803D']; // Green
        } elseif ($num >= 75) {
            return ['bg' => 'FFEDD5', 'fg' => 'C2410C']; // Orange
        } else {
            return ['bg' => 'FEE2E2', 'fg' => 'DC2626']; // Red
        }
    }
}

// Data Rows (Row 3 onwards)
$currentRow = 3;
$monthTotals = [];
foreach (array_keys($monthCols) as $m) {
    $monthTotals[$m] = ['sum' => 0.0, 'count' => 0];
}

$rowCount = count($rows);
for ($i = 0; $i < $rowCount; $i++) {
    $r = $rows[$i];
    $sheet->setCellValue("A{$currentRow}", $i + 1);
    if ($isPmdCategory) {
        $sheet->setCellValue("B{$currentRow}", $r['divisi'] ?: 'PMD');
        $sheet->setCellValue("C{$currentRow}", $r['dept'] ?? '');
        $sheet->setCellValue("D{$currentRow}", $r['sub_dept'] ?? '');
        $sheet->setCellValue("E{$currentRow}", $r['sitecode'] ?? '');
        $sheet->setCellValue("F{$currentRow}", $r['name_site'] ?? '');

        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("B{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("E{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("F{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        $col = 7;
    } else {
        $sheet->setCellValue("B{$currentRow}", $r['dept'] ?? '');
        $sheet->setCellValue("C{$currentRow}", $r['sub_dept'] ?? '');
        $sheet->setCellValue("D{$currentRow}", $r['sitecode'] ?? '');
        $sheet->setCellValue("E{$currentRow}", $r['name_site'] ?? '');

        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("B{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("E{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        $col = 6;
    }

    // Month cells
    $rowMonths = $r['months'] ?? [];
    $rowDivisi = strtoupper(trim($r['divisi'] ?? ''));
    $rowDept = strtoupper(trim($r['dept'] ?? ''));
    $rowIsPmd = ($rowDivisi === 'PMD') || in_array($rowDept, ['PMD', 'DNO', 'DSO']) || $isPmd;
    foreach (array_keys($monthCols) as $m) {
        $cLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col);
        $coord = "{$cLetter}{$currentRow}";
        $rawVal = $rowMonths[$m] ?? null;

        if ($rawVal !== null && $rawVal !== '' && is_numeric($rawVal)) {
            $valFloat = (float) $rawVal;
            $sheet->setCellValue($coord, $valFloat / 100);
            $sheet->getStyle($coord)->getNumberFormat()->setFormatCode('0%');

            $colors = getCellColorStyles($valFloat, $rowIsPmd);
            $sheet->getStyle($coord)->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => $colors['bg']],
                ],
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => $colors['fg']],
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER,
                ],
            ]);

            $monthTotals[$m]['sum'] += $valFloat;
            $monthTotals[$m]['count']++;
        } else {
            $sheet->setCellValue($coord, '-');
            $sheet->getStyle($coord)->applyFromArray([
                'font' => [
                    'color' => ['rgb' => '94A3B8'],
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER,
                ],
            ]);
        }
        $col++;
    }

    $sheet->getRowDimension($currentRow)->setRowHeight(20);
    $currentRow++;
}

// Summary Row: Average Total Physical %
$summaryRow = $currentRow;
$mergeEndCol = $isPmdCategory ? 'F' : 'E';
$sheet->mergeCells("A{$summaryRow}:{$mergeEndCol}{$summaryRow}");
$sheet->setCellValue("A{$summaryRow}", "AVERAGE TOTAL PHYSICAL % (" . $rowCount . " SITES)");

$sheet->getStyle("A{$summaryRow}")->applyFromArray([
    'font' => [
        'bold' => true,
        'color' => ['rgb' => '0F172A'],
        'size' => 10,
    ],
    'alignment' => [
        'horizontal' => Alignment::HORIZONTAL_LEFT,
        'vertical' => Alignment::VERTICAL_CENTER,
        'indent' => 1,
    ],
]);

$col = $isPmdCategory ? 7 : 6;
foreach (array_keys($monthCols) as $m) {
    $cLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col);
    $coord = "{$cLetter}{$summaryRow}";
    $cnt = $monthTotals[$m]['count'];

    if ($cnt > 0) {
        $avgVal = round($monthTotals[$m]['sum'] / $cnt);
        $sheet->setCellValue($coord, $avgVal / 100);
        $sheet->getStyle($coord)->getNumberFormat()->setFormatCode('0%');

        $colors = getCellColorStyles($avgVal, $isPmd);
        $sheet->getStyle($coord)->applyFromArray([
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => $colors['bg']],
            ],
            'font' => [
                'bold' => true,
                'color' => ['rgb' => $colors['fg']],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
    } else {
        $sheet->setCellValue($coord, '-');
        $sheet->getStyle($coord)->applyFromArray([
            'font' => [
                'color' => ['rgb' => '94A3B8'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
    }
    $col++;
}

// Style Summary Row container
$summaryRange = "A{$summaryRow}:{$lastColLetter}{$summaryRow}";
$sheet->getStyle($summaryRange)->applyFromArray([
    'fill' => [
        'fillType' => Fill::FILL_SOLID,
        'startColor' => ['rgb' => 'F1F5F9'],
    ],
    'borders' => [
        'top' => [
            'borderStyle' => Border::BORDER_MEDIUM,
            'color' => ['rgb' => '94A3B8'],
        ],
        'bottom' => [
            'borderStyle' => Border::BORDER_DOUBLE,
            'color' => ['rgb' => '475569'],
        ],
        'allBorders' => [
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['rgb' => 'CBD5E1'],
        ],
    ],
]);
$sheet->getRowDimension($summaryRow)->setRowHeight(24);

// Apply thin borders to all data rows
if ($rowCount > 0) {
    $dataRange = "A3:{$lastColLetter}" . ($summaryRow - 1);
    $sheet->getStyle($dataRange)->applyFromArray([
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => 'E2E8F0'],
            ],
        ],
    ]);
}

// Auto-size columns with safety padding
for ($c = 1; $c <= $lastColIndex; $c++) {
    $cLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($c);
    $sheet->getColumnDimension($cLetter)->setAutoSize(true);
}
// Ensure specific minimum column widths
$sheet->getColumnDimension('A')->setAutoSize(false)->setWidth(7);
$sheet->getColumnDimension('B')->setWidth(12);
$sheet->getColumnDimension('C')->setWidth(14);
$sheet->getColumnDimension('D')->setWidth(14);
$sheet->getColumnDimension('E')->setWidth(30);

// Freeze header & identity panes (freeze row 2 and columns A-E)
$sheet->freezePane('F3');

// Clean filename: rekap_[category]_[dmYHi].xlsx
$catSlug = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $catLabel ?: $category));
if (in_array($category, ['all', 'all_monthly', 'all_quarterly'], true) || $catSlug === 'allsummary' || $catSlug === 'allsites') {
    $catSlug = 'allsites';
} elseif ($catSlug === 'outlet' || $catSlug === 'monthlyoutlet') {
    $catSlug = 'outletregional';
}
$timeStr = date('dmYHi');
$filename = "rekap_{$catSlug}_{$timeStr}.xlsx";

// Send download headers
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: max-age=0, no-cache, no-store, must-revalidate');
header('Pragma: public');

$writer = new Xlsx($ss);
$writer->save('php://output');
exit;
