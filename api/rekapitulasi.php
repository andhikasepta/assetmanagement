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

        // Fetch all sites
        $siteStmt = $db->query("
            SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type,
                   COALESCE(is_active, TRUE) as is_active, COALESCE(is_counted, TRUE) as is_counted
            FROM site_regional
            ORDER BY dept ASC, sub_dept ASC, sitecode ASC
        ");
        $sites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

        // Preload monthly effective types
        $baseTypes = [];
        $pmdSites = [];
        foreach ($sites as $s) {
            $sc = strtoupper(trim($s['sitecode'] ?? ''));
            if (strtoupper(trim($s['dept'] ?? '')) === 'PMD') {
                $baseTypes[$sc] = 'monthly';
                $pmdSites[$sc] = true;
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
                if (isset($monthlyEffMap[$m][$sc]) && empty($pmdSites[$sc])) {
                    $monthlyEffMap[$m][$sc] = $hr['group_type'];
                }
            }
        }

        // Fetch reconciliation records for this year (fetch all so quarterly and monthly profiles are available)
        $recStmt = $db->prepare("
            SELECT id, profile, period_month, period_year, total_physic_pct
            FROM asset_reconciliation
            WHERE period_year = :year
            ORDER BY period_month ASC, id ASC
        ");
        $recStmt->execute([':year' => $year]);
        $recRows = $recStmt->fetchAll(PDO::FETCH_ASSOC);

        $recByCodeAndMonth = [];
        $recByMonthList = [];
        foreach ($recRows as $r) {
            $m = (int)$r['period_month'];
            $profile = trim($r['profile'] ?? '');
            $pct = (float)$r['total_physic_pct'];
            $isQ = (bool)preg_match('/\bQ[1-4]\b/i', $profile);

            $recByMonthList[$m][] = [
                'profile' => $profile,
                'pct'     => $pct,
                'is_q'    => $isQ,
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
                $eff = $monthlyEffMap[$m][$upperCode] ?? 'monthly';
                if ($eff === 'inactive' || empty($s['is_active']) || empty($s['is_counted'])) continue;
                $isPmd = ($dept === 'PMD' || $cat === 'monthly_pmd');
                if ($soType === 'quarterly') {
                    if ($isPmd || $eff !== 'quarterly') continue;
                } else {
                    if (!$isPmd && $eff !== 'monthly') continue;
                }

                $val = null;
                if ($sitecode !== '') {
                    if (isset($recByCodeAndMonth[$upperCode][$m])) {
                        $entry = $recByCodeAndMonth[$upperCode][$m];
                        if ($soType === 'quarterly') {
                            $val = $entry['q'] ?? $entry['any'] ?? null;
                        } else {
                            $val = $entry['m'] ?? null;
                        }
                    } elseif (!empty($recByMonthList[$m])) {
                        $matchedItem = null;
                        foreach ($recByMonthList[$m] as $item) {
                            if (
                                stripos($item['profile'], " - {$sitecode} - ") !== false ||
                                stripos($item['profile'], "- {$sitecode} -") !== false ||
                                stripos($item['profile'], " {$sitecode} ") !== false ||
                                stripos($item['profile'], $sitecode) !== false
                            ) {
                                if ($soType === 'quarterly' && !empty($item['is_q'])) {
                                    $matchedItem = $item;
                                    break;
                                } elseif ($soType !== 'quarterly' && empty($item['is_q'])) {
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

        $toSeries = function($buckets) use ($soType) {
            $res = [];
            if ($soType === 'quarterly') {
                $quarters = [3, 6, 9, 12];
                foreach ($quarters as $m) {
                    $res[] = $buckets[$m]['count'] > 0 ? round($buckets[$m]['sum'] / $buckets[$m]['count']) : null;
                }
            } else {
                for ($m = 1; $m <= 12; $m++) {
                    $res[] = $buckets[$m]['count'] > 0 ? round($buckets[$m]['sum'] / $buckets[$m]['count']) : null;
                }
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

        // For quarterly summary, remove all CRO trends (CRO has no quarterly sites)
        if ($soType === 'quarterly') {
            unset($deptSeries['CRO']);
            foreach ($subDeptSeries as $subKey => $data) {
                if (($data['dept'] ?? '') === 'CRO') {
                    unset($subDeptSeries[$subKey]);
                }
            }
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

    $category = trim($_GET['category'] ?? 'pmd');

    // 1. Fetch Site Regional records for this category
    $whereParts = [];
    if ($category === 'pmd' || $category === 'monthly_pmd') {
        $whereParts[] = "dept = 'PMD'";
    } elseif ($category === 'quarterly_subarep') {
        $whereParts[] = "dept != 'PMD' AND (info IN ('Subarep', 'Outlet') OR info IS NULL) AND (group_type = 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type = 'quarterly'))";
    } elseif ($category === 'quarterly_warehouse' || $category === 'quarterly_warehouse_hub') {
        $whereParts[] = "dept != 'PMD' AND info IN ('Under Warehouse', 'HUB') AND (group_type = 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type = 'quarterly'))";
    } elseif ($category === 'quarterly' || $category === 'quarterly_outlet') {
        $whereParts[] = "dept != 'PMD' AND (group_type = 'quarterly' OR EXISTS (SELECT 1 FROM site_group_history sgh WHERE sgh.sitecode = site_regional.sitecode AND sgh.group_type = 'quarterly'))";
    } else {
        $whereParts[] = "dept != 'PMD'";
    }

    $whereParts[] = "COALESCE(is_active, TRUE) = TRUE";
    $whereParts[] = "COALESCE(is_counted, TRUE) = TRUE";
    $whereSql = "WHERE " . implode(' AND ', $whereParts);

    $siteStmt = $db->query("
        SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type,
               COALESCE(is_active, TRUE) as is_active, COALESCE(is_counted, TRUE) as is_counted
        FROM site_regional
        $whereSql
        ORDER BY regional ASC, dept ASC, sub_dept ASC, sitecode ASC, id ASC
    ");
    $sites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

    // Preload monthly effective types from site_group_history for each site across 12 months
    $baseTypes = [];
    foreach ($sites as $s) {
        $sc = strtoupper(trim($s['sitecode'] ?? ''));
        $baseTypes[$sc] = $s['group_type'] ?: 'monthly';
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

    // 2. Fetch ALL Reconciliation records for this year
    // Do not restrict by profile regex so historical Jan-Mar monthly records remain preserved
    $isQuarterlyCat = in_array($category, ['quarterly', 'quarterly_outlet', 'quarterly_subarep', 'quarterly_warehouse', 'quarterly_warehouse_hub'], true);
    $recStmt = $db->prepare("
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
    ");
    $recStmt->execute([':year' => $year]);
    $recRows = $recStmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Build index of reconciliation data by sitecode and month
    $recByCodeAndMonth = [];
    $recByMonthList = [];

    foreach ($recRows as $r) {
        $m = (int)$r['period_month'];
        $profile = trim($r['profile'] ?? '');
        $pct = (float)$r['total_physic_pct'];
        $isQ = (bool)preg_match('/\bQ[1-4]\b/i', $profile);

        $recByMonthList[$m][] = [
            'profile' => $profile,
            'pct'     => $pct,
            'is_q'    => $isQ,
            'actual'  => (int)$r['total_physic_actual'],
            'target'  => (int)$r['total_physic_target'],
        ];

        // Extract hyphen-separated tokens
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

    // 4. Map each site to monthly % values
    $rekapData = [];
    $monthTotals = array_fill(1, 12, ['sum' => 0.0, 'count' => 0]);

    foreach ($sites as $s) {
        $sitecode = trim($s['sitecode'] ?? '');
        $upperCode = strtoupper($sitecode);

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $val = null;
            $eff = $monthlyEffMap[$m][$upperCode] ?? 'monthly';

            // Determine if this month should be displayed (based on effective type of that period):
            // - 'inactive' period: never looked up, shown as -
            // - Quarterly view: ONLY quarter-end months (Mar/Q1, Jun/Q2, Sep/Q3, Dec/Q4),
            //   and only if the site is effectively quarterly in that period. Periods when the
            //   site was monthly stay on the Monthly rekap and are '-' here.
            // - Monthly view: only periods where the site is effectively monthly. Periods after
            //   the site switched to quarterly are '-' here and appear on the Quarterly rekap.
            $canShow = ($eff !== 'inactive');
            if ($canShow && $isQuarterlyCat) {
                $canShow = in_array($m, [3, 6, 9, 12], true) && $eff === 'quarterly';
            } elseif ($canShow && !$isQuarterlyCat) {
                if ($eff === 'quarterly') {
                    $canShow = false;
                } else {
                    $canShow = true;
                }
            }

            if ($canShow && $sitecode !== '') {
                // Direct token match
                if (isset($recByCodeAndMonth[$upperCode][$m])) {
                    $entry = $recByCodeAndMonth[$upperCode][$m];
                    if ($isQuarterlyCat) {
                        $val = $entry['q'] ?? $entry['any'] ?? null;
                    } else {
                        // On monthly view, ONLY use monthly record ('m')! Do NOT pick up quarterly profiles!
                        $val = $entry['m'] ?? null;
                    }
                } elseif (!empty($recByMonthList[$m])) {
                    // Substring match in profile (e.g. " - 0BANKLA001 - ")
                    $matchedItem = null;
                    foreach ($recByMonthList[$m] as $item) {
                        if (
                            stripos($item['profile'], " - {$sitecode} - ") !== false ||
                            stripos($item['profile'], "- {$sitecode} -") !== false ||
                            stripos($item['profile'], " {$sitecode} ") !== false ||
                            stripos($item['profile'], $sitecode) !== false
                        ) {
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
        $monthAverages[$m] = $cnt > 0 ? round($monthTotals[$m]['sum'] / $cnt) : null;
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
