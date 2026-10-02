<?php
/**
 * Rekapitulasi API Endpoint
 * Provides pivot summary data of Site Regional mapped to Stock Opname Master Data
 * for January - December (or Quarters) of a selected year.
 */

require_once __DIR__ . '/../config/database.php';

ini_set('memory_limit', '512M');
set_time_limit(120);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    $db = getDbConnection();

    $action = trim($_GET['action'] ?? '');
    $year = (int)($_GET['year'] ?? 2026);
    if ($year < 2000 || $year > 2100) {
        $year = 2026;
    }

    if ($action === 'trends') {
        $soType = trim($_GET['so_type'] ?? 'monthly');
        $srCategories = ($soType === 'quarterly')
            ? "'quarterly', 'quarterly_outlet', 'quarterly_pmd'"
            : "'monthly_outlet', 'monthly_pmd'";

        // Fetch all sites for the selected SO type
        $siteStmt = $db->prepare("
            SELECT id, category, regional, dept, sub_dept, sitecode, name_site
            FROM site_regional
            WHERE category IN ($srCategories)
            ORDER BY category ASC, dept ASC, sub_dept ASC, sitecode ASC
        ");
        $siteStmt->execute();
        $sites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch reconciliation records for this year
        $recStmt = $db->prepare('
            SELECT id, profile, period_month, period_year, total_physic_pct
            FROM asset_reconciliation
            WHERE period_year = :year
            ORDER BY period_month ASC, id ASC
        ');
        $recStmt->execute([':year' => $year]);
        $recRows = $recStmt->fetchAll(PDO::FETCH_ASSOC);

        $recByCodeAndMonth = [];
        $recByMonthList = [];
        foreach ($recRows as $r) {
            $m = (int)$r['period_month'];
            $profile = trim($r['profile'] ?? '');
            $pct = (float)$r['total_physic_pct'];

            $recByMonthList[$m][] = [
                'profile' => $profile,
                'pct'     => $pct,
            ];

            $parts = explode('-', $profile);
            foreach ($parts as $p) {
                $token = strtoupper(trim($p));
                if ($token !== '' && !isset($recByCodeAndMonth[$token][$m])) {
                    $recByCodeAndMonth[$token][$m] = $pct;
                }
            }
        }

        $deptBuckets = [
            'CRO' => array_fill(1, 12, ['sum' => 0.0, 'count' => 0]),
            'ERO' => array_fill(1, 12, ['sum' => 0.0, 'count' => 0]),
            'WRO' => array_fill(1, 12, ['sum' => 0.0, 'count' => 0]),
            'PMD' => array_fill(1, 12, ['sum' => 0.0, 'count' => 0]),
        ];
        $nationalBuckets = array_fill(1, 12, ['sum' => 0.0, 'count' => 0]);
        $subDeptBuckets = [];
        $pmdSubDeptBuckets = [];

        foreach ($sites as $s) {
            $sitecode = trim($s['sitecode'] ?? '');
            $upperCode = strtoupper($sitecode);
            $dept = trim($s['dept'] ?? '');
            $subDept = trim($s['sub_dept'] ?? '');
            $cat = trim($s['category'] ?? '');

            if ($subDept !== '') {
                if ($dept === 'PMD' || $cat === 'monthly_pmd') {
                    if (!isset($pmdSubDeptBuckets[$subDept])) {
                        $pmdSubDeptBuckets[$subDept] = array_fill(1, 12, ['sum' => 0.0, 'count' => 0]);
                    }
                } else {
                    if (!isset($subDeptBuckets[$subDept])) {
                        $subDeptBuckets[$subDept] = [
                            'dept'   => $dept,
                            'months' => array_fill(1, 12, ['sum' => 0.0, 'count' => 0]),
                        ];
                    }
                }
            }

            for ($m = 1; $m <= 12; $m++) {
                $val = null;
                if ($sitecode !== '') {
                    if (isset($recByCodeAndMonth[$upperCode][$m])) {
                        $val = $recByCodeAndMonth[$upperCode][$m];
                    } elseif (!empty($recByMonthList[$m])) {
                        foreach ($recByMonthList[$m] as $item) {
                            if (
                                stripos($item['profile'], " - {$sitecode} - ") !== false ||
                                stripos($item['profile'], "- {$sitecode} -") !== false ||
                                stripos($item['profile'], " {$sitecode} ") !== false ||
                                stripos($item['profile'], $sitecode) !== false
                            ) {
                                $val = $item['pct'];
                                $recByCodeAndMonth[$upperCode][$m] = $val;
                                break;
                            }
                        }
                    }
                }

                if ($val !== null) {
                    if (isset($deptBuckets[$dept])) {
                        $deptBuckets[$dept][$m]['sum'] += $val;
                        $deptBuckets[$dept][$m]['count']++;
                    }
                    $nationalBuckets[$m]['sum'] += $val;
                    $nationalBuckets[$m]['count']++;

                    if ($dept === 'PMD' || $cat === 'monthly_pmd') {
                        if (isset($pmdSubDeptBuckets[$subDept])) {
                            $pmdSubDeptBuckets[$subDept][$m]['sum'] += $val;
                            $pmdSubDeptBuckets[$subDept][$m]['count']++;
                        }
                    } else {
                        if (isset($subDeptBuckets[$subDept])) {
                            $subDeptBuckets[$subDept]['months'][$m]['sum'] += $val;
                            $subDeptBuckets[$subDept]['months'][$m]['count']++;
                        }
                    }
                }
            }
        }

        $toSeries = function($buckets) {
            $res = [];
            for ($m = 1; $m <= 12; $m++) {
                $res[] = $buckets[$m]['count'] > 0 ? round($buckets[$m]['sum'] / $buckets[$m]['count'], 2) : null;
            }
            return $res;
        };

        // 1. DEPT series
        $deptSeries = [];
        foreach ($deptBuckets as $deptKey => $b) {
            $deptSeries[$deptKey] = $toSeries($b);
        }
        $nationalSeries = $toSeries($nationalBuckets);

        // 2. Sub DEPT series (Regional)
        ksort($subDeptBuckets);
        $subDeptSeries = [];
        foreach ($subDeptBuckets as $subKey => $data) {
            $subDeptSeries[$subKey] = [
                'dept'   => $data['dept'],
                'values' => $toSeries($data['months']),
            ];
        }

        // 3. PMD Sub DEPT series
        ksort($pmdSubDeptBuckets);
        $pmdSubDeptSeries = [];
        foreach ($pmdSubDeptBuckets as $subKey => $b) {
            $pmdSubDeptSeries[$subKey] = $toSeries($b);
        }

        echo json_encode([
            'success'            => true,
            'year'               => $year,
            'so_type'            => $soType,
            'months'             => ($soType === 'quarterly') ? ['Q1', 'Q2', 'Q3', 'Q4'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            'dept_trends'        => $deptSeries,
            'national_trend'     => $nationalSeries,
            'subdept_trends'     => $subDeptSeries,
            'pmd_subdept_trends' => $pmdSubDeptSeries,
        ]);
        exit;
    }

    $category = trim($_GET['category'] ?? 'monthly_outlet');

    // 1. Fetch Site Regional records for this category
    $siteStmt = $db->prepare('
        SELECT id, category, regional, dept, sub_dept, sitecode, name_site
        FROM site_regional
        WHERE category = :category
        ORDER BY regional ASC, dept ASC, sub_dept ASC, sitecode ASC, id ASC
    ');
    $siteStmt->execute([':category' => $category]);
    $sites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Fetch Reconciliation records for this year
    // Extracts profile, period_month, period_year, total_physic_pct
    $recStmt = $db->prepare('
        SELECT 
            id,
            profile,
            period_month,
            period_year,
            total_physic_actual,
            total_physic_target,
            total_physic_pct
        FROM asset_reconciliation
        WHERE period_year = :year
        ORDER BY period_month ASC, id ASC
    ');
    $recStmt->execute([':year' => $year]);
    $recRows = $recStmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Build index of reconciliation data by sitecode and month
    // We parse sitecode candidates from profile (typically formatted as "SO ... - SITECODE - NAME ...")
    // and also store full profile strings for regex/substring fallback.
    $recByCodeAndMonth = [];
    $recByMonthList = [];

    foreach ($recRows as $r) {
        $m = (int)$r['period_month'];
        $profile = trim($r['profile'] ?? '');
        $pct = (float)$r['total_physic_pct'];

        $recByMonthList[$m][] = [
            'profile' => $profile,
            'pct'     => $pct,
            'actual'  => (int)$r['total_physic_actual'],
            'target'  => (int)$r['total_physic_target'],
        ];

        // Extract hyphen-separated tokens
        $parts = explode('-', $profile);
        foreach ($parts as $p) {
            $token = strtoupper(trim($p));
            if ($token !== '' && !isset($recByCodeAndMonth[$token][$m])) {
                $recByCodeAndMonth[$token][$m] = $pct;
            }
        }
    }

    // 4. Map each site to monthly % values
    $rekapData = [];
    $monthTotals = array_fill(1, 12, ['sum' => 0.0, 'count' => 0]);

    foreach ($sites as $s) {
        $sitecode = trim($s['sitecode'] ?? '');
        $upperCode = strtoupper($sitecode);

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $val = null;

            if ($sitecode !== '') {
                // Fast direct token match
                if (isset($recByCodeAndMonth[$upperCode][$m])) {
                    $val = $recByCodeAndMonth[$upperCode][$m];
                } elseif (!empty($recByMonthList[$m])) {
                    // Substring match in profile (e.g. " - 0ABDKLA001 - ")
                    foreach ($recByMonthList[$m] as $item) {
                        if (
                            stripos($item['profile'], " - {$sitecode} - ") !== false ||
                            stripos($item['profile'], "- {$sitecode} -") !== false ||
                            stripos($item['profile'], " {$sitecode} ") !== false ||
                            stripos($item['profile'], $sitecode) !== false
                        ) {
                            $val = $item['pct'];
                            // Cache for next time
                            $recByCodeAndMonth[$upperCode][$m] = $val;
                            break;
                        }
                    }
                }
            }

            $months[$m] = $val;

            if ($val !== null) {
                $monthTotals[$m]['sum'] += $val;
                $monthTotals[$m]['count']++;
            }
        }

        $rekapData[] = [
            'id'        => (int)$s['id'],
            'regional'  => $s['regional'] ?? '',
            'dept'      => $s['dept'] ?? '',
            'sub_dept'  => $s['sub_dept'] ?? '',
            'sitecode'  => $sitecode,
            'name_site' => $s['name_site'] ?? '',
            'months'    => $months,
        ];
    }

    // 5. Calculate monthly averages for summary row
    $monthAverages = [];
    for ($m = 1; $m <= 12; $m++) {
        $cnt = $monthTotals[$m]['count'];
        $monthAverages[$m] = $cnt > 0 ? round($monthTotals[$m]['sum'] / $cnt, 2) : null;
    }

    echo json_encode([
        'success'        => true,
        'year'           => $year,
        'category'       => $category,
        'total_sites'    => count($rekapData),
        'month_averages' => $monthAverages,
        'data'           => $rekapData,
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('Rekapitulasi API error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
