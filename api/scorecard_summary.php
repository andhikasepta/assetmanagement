<?php
/**
 * Score Card Summary API Endpoint
 * Computes 3-month rolling comparison and evaluations for:
 * 1. Rating Summary (based on Rating KPI Master Data)
 * 2. SO Execution Summary (based on SO Execution KPI Master Data)
 * Evaluated on the latest period (e.g. September 2026).
 */

require_once __DIR__ . '/../config/database.php';

ini_set('memory_limit', '512M');
set_time_limit(60);

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

    // 1. Inputs
    $year = (int)($_GET['year'] ?? 2026);
    if ($year < 2000 || $year > 2100) $year = 2026;

    $month = (int)($_GET['month'] ?? 9);
    if ($month < 1 || $month > 12) $month = 9;

    $category = trim($_GET['category'] ?? 'pmd');
    $soType = trim($_GET['so_type'] ?? 'monthly');

    // 2. Determine whether this request is for Quarterly or Monthly
    $isQuarterly = ($soType === 'quarterly' || in_array($category, [
        'quarterly', 'quarterly_outlet', 'quarterly_subarep', 'quarterly_warehouse', 'quarterly_warehouse_hub', 'outlet_subarep', 'warehouse_hub'
    ], true));

    // Compute 3 rolling periods back
    $threeMonths = [];
    if ($isQuarterly) {
        $curQ = (int)ceil($month / 3);
        if ($curQ < 1) $curQ = 1;
        if ($curQ > 4) $curQ = 4;

        for ($i = 2; $i >= 0; $i--) {
            $tq = $curQ - $i;
            $ty = $year;
            while ($tq <= 0) {
                $tq += 4;
                $ty -= 1;
            }
            $targetMonth = $tq * 3;
            $threeMonths[] = [
                'month'   => $targetMonth,
                'year'    => $ty,
                'quarter' => $tq,
                'label'   => "Q{$tq}"
            ];
        }
    } else {
        $shortNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        for ($i = 2; $i >= 0; $i--) {
            $tm = $month - $i;
            $ty = $year;
            while ($tm <= 0) {
                $tm += 12;
                $ty -= 1;
            }
            $threeMonths[] = [
                'month' => $tm,
                'year'  => $ty,
                'label' => strtoupper($shortNames[$tm])
            ];
        }
    }

    // 3. Fetch KPI Configurations from scorecard_kpi_config
    $kpiStmt = $db->query('SELECT rating_key, rating_label, min_pct, max_pct, threshold_decimal, kpi_type FROM scorecard_kpi_config ORDER BY sort_order ASC');
    $kpiRows = $kpiStmt->fetchAll(PDO::FETCH_ASSOC);

    $ratingKpis = [];
    $execKpis = [];
    foreach ($kpiRows as $k) {
        $type = $k['kpi_type'] ?? 'rating';
        if ($type === 'execution') {
            $execKpis[$k['rating_key']] = $k;
        } else {
            $ratingKpis[$k['rating_key']] = $k;
        }
    }

    // Default Execution threshold (0.25 / 25%)
    $execThreshDec = 0.25;
    if (isset($execKpis['not_executed']['threshold_decimal']) && $execKpis['not_executed']['threshold_decimal'] !== null) {
        $execThreshDec = (float)$execKpis['not_executed']['threshold_decimal'];
    } elseif (isset($execKpis['not_executed']['max_pct']) && $execKpis['not_executed']['max_pct'] !== null) {
        $execThreshDec = (float)$execKpis['not_executed']['max_pct'] / 100.0;
    }
    $execThreshPct = $execThreshDec * 100.0;

    // Rating thresholds
    $vpMax = isset($ratingKpis['very_poor']['max_pct']) && $ratingKpis['very_poor']['max_pct'] !== null ? (float)$ratingKpis['very_poor']['max_pct'] : 34.0;
    $pMax = isset($ratingKpis['poor']['max_pct']) && $ratingKpis['poor']['max_pct'] !== null ? (float)$ratingKpis['poor']['max_pct'] : 62.0;
    $mMax = isset($ratingKpis['moderate']['max_pct']) && $ratingKpis['moderate']['max_pct'] !== null ? (float)$ratingKpis['moderate']['max_pct'] : 71.0;
    $gMax = isset($ratingKpis['good']['max_pct']) && $ratingKpis['good']['max_pct'] !== null ? (float)$ratingKpis['good']['max_pct'] : 84.0;

    // Helper to evaluate Rating
    $evalRating = function (?float $pct) use ($vpMax, $pMax, $mMax, $gMax): string {
        if ($pct === null || $pct === false) return 'Very Poor';
        if ($pct <= $vpMax) return 'Very Poor';
        if ($pct <= $pMax) return 'Poor';
        if ($pct <= $mMax) return 'Moderate';
        if ($pct <= $gMax) return 'Good';
        return 'Very Good';
    };

    // Helper to evaluate Execution
    $evalExec = function (?float $pct) use ($execThreshPct): string {
        if ($pct === null || $pct === false) return 'Not Executed';
        return ($pct >= $execThreshPct) ? 'Executed' : 'Not Executed';
    };

    // 4. Fetch Sites based on Category & Effective Group Type as of ($year, $month)
    $whereParts = [
        "COALESCE(is_active, TRUE) = TRUE",
        "COALESCE(is_counted, TRUE) = TRUE"
    ];

    if ($category === 'pmd' || $category === 'monthly_pmd') {
        $whereParts[] = "dept = 'PMD'";
    } else {
        $whereParts[] = "dept != 'PMD'";
    }

    $whereSql = "WHERE " . implode(' AND ', $whereParts);
    $siteStmt = $db->query("
        SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type
        FROM site_regional
        $whereSql
        ORDER BY regional ASC, dept ASC, sub_dept ASC, sitecode ASC
    ");
    $rawSites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

    // Resolve effective group_type from site_group_history for target period ($year, $month)
    $histStmt = $db->prepare("
        SELECT DISTINCT ON (sitecode) sitecode, group_type
        FROM site_group_history
        WHERE effective_year < :y OR (effective_year = :y AND effective_month <= :m)
        ORDER BY sitecode, effective_year DESC, effective_month DESC
    ");
    $histStmt->execute([':y' => $year, ':m' => $month]);
    $historyOverrides = [];
    foreach ($histStmt->fetchAll(PDO::FETCH_ASSOC) as $h) {
        $historyOverrides[strtoupper(trim($h['sitecode']))] = strtolower(trim($h['group_type']));
    }

    $sites = [];
    foreach ($rawSites as $s) {
        $sc = strtoupper(trim($s['sitecode'] ?? ''));
        $isPmd = (strtoupper(trim($s['dept'] ?? '')) === 'PMD');

        if ($isPmd) {
            $effGroup = 'monthly';
        } elseif (isset($historyOverrides[$sc])) {
            $effGroup = $historyOverrides[$sc];
        } else {
            $effGroup = strtolower(trim($s['group_type'] ?? 'monthly')) ?: 'monthly';
        }

        // Exclude inactive periods
        if ($effGroup === 'inactive') {
            continue;
        }

        if ($isQuarterly) {
            // Must be effectively quarterly
            if ($isPmd || $effGroup !== 'quarterly') {
                continue;
            }

            $info = trim($s['info'] ?? '');
            if ($category === 'warehouse_hub' || $category === 'quarterly_warehouse' || $category === 'quarterly_warehouse_hub') {
                if (!in_array($info, ['Under Warehouse', 'HUB'], true)) {
                    continue;
                }
            } else {
                // outlet_subarep / quarterly_subarep / quarterly_outlet / default quarterly
                if (!in_array($info, ['Subarep', 'Outlet', ''], true) && !empty($info)) {
                    continue;
                }
            }
        } else {
            // Monthly view
            if ($category === 'pmd' || $category === 'monthly_pmd') {
                if (!$isPmd) continue;
            } else {
                // Non-PMD Outlet Monthly: effective group_type MUST be 'monthly'
                if ($isPmd || $effGroup !== 'monthly') {
                    continue;
                }
            }
        }

        $s['effective_group_type'] = $effGroup;
        $sites[] = $s;
    }

    // 5. Fetch Reconciliation records for the 3 target periods
    $mConditions = [];
    $recParams = [];
    foreach ($threeMonths as $idx => $tm) {
        $mConditions[] = "(period_year = :y{$idx} AND period_month = :m{$idx})";
        $recParams[":y{$idx}"] = $tm['year'];
        $recParams[":m{$idx}"] = $tm['month'];
    }

    $recWhere = implode(' OR ', $mConditions);
    if ($isQuarterly) {
        $recWhere = "({$recWhere}) AND profile ~* '\\mQ[1-4]\\M'";
    } else {
        $recWhere = "({$recWhere}) AND profile !~* '\\mQ[1-4]\\M'";
    }

    $recStmt = $db->prepare("
        SELECT id, profile, period_month, period_year, total_physic_pct
        FROM asset_reconciliation
        WHERE {$recWhere}
        ORDER BY period_year ASC, period_month ASC
    ");
    $recStmt->execute($recParams);
    $recRows = $recStmt->fetchAll(PDO::FETCH_ASSOC);

    // Index reconciliation records by "YEAR_MONTH" and sitecode
    $recIndex = [];
    $recListByYM = [];
    foreach ($recRows as $r) {
        $ymKey = "{$r['period_year']}_{$r['period_month']}";
        $profile = trim($r['profile'] ?? '');
        $pct = (float)$r['total_physic_pct'];

        $recListByYM[$ymKey][] = [
            'profile' => $profile,
            'pct' => $pct
        ];

        $tokens = explode('-', $profile);
        foreach ($tokens as $t) {
            $code = strtoupper(trim($t));
            if ($code !== '' && !isset($recIndex[$ymKey][$code])) {
                $recIndex[$ymKey][$code] = $pct;
            }
        }
    }

    // Helper to find percentage for a sitecode in a given year/month
    $getSitePct = function (string $sitecode, int $y, int $m) use (&$recIndex, &$recListByYM): ?float {
        $ymKey = "{$y}_{$m}";
        $upper = strtoupper(trim($sitecode));
        if ($upper === '') return null;

        if (isset($recIndex[$ymKey][$upper])) {
            return $recIndex[$ymKey][$upper];
        }

        if (!empty($recListByYM[$ymKey])) {
            foreach ($recListByYM[$ymKey] as $item) {
                if (
                    stripos($item['profile'], " - {$upper} - ") !== false ||
                    stripos($item['profile'], "- {$upper} -") !== false ||
                    stripos($item['profile'], " {$upper} ") !== false ||
                    stripos($item['profile'], $upper) !== false
                ) {
                    $recIndex[$ymKey][$upper] = $item['pct'];
                    return $item['pct'];
                }
            }
        }

        return null;
    };

    // 6. Build Rating and Execution items for each site
    $ratingList = [];
    $execList = [];

    $ratingCounts = [
        'very_good' => 0,
        'good' => 0,
        'moderate' => 0,
        'poor' => 0,
        'very_poor' => 0
    ];

    $execCounts = [
        'executed' => 0,
        'not_executed' => 0
    ];

    $m1Info = $threeMonths[0];
    $m2Info = $threeMonths[1];
    $m3Info = $threeMonths[2]; // Latest month

    foreach ($sites as $s) {
        $sc = trim($s['sitecode'] ?? '');
        $name = trim($s['name_site'] ?? '-');
        $subDept = trim($s['sub_dept'] ?? '-');

        $p1 = $getSitePct($sc, $m1Info['year'], $m1Info['month']);
        $p2 = $getSitePct($sc, $m2Info['year'], $m2Info['month']);
        $p3 = $getSitePct($sc, $m3Info['year'], $m3Info['month']); // Latest

        // Evaluate Rating using latest month (m3)
        $rating = $evalRating($p3);
        $ratingKey = strtolower(str_replace(' ', '_', $rating));
        if (isset($ratingCounts[$ratingKey])) {
            $ratingCounts[$ratingKey]++;
        }

        $ratingList[] = [
            'sitecode'  => $sc,
            'name_site' => $name,
            'sub_dept'  => $subDept,
            'pct'       => $p3 !== null ? round($p3, 2) : null,
            'rating'    => $rating,
            'm1_pct'    => $p1 !== null ? round($p1, 2) : null,
            'm1_rating' => $evalRating($p1),
            'm2_pct'    => $p2 !== null ? round($p2, 2) : null,
            'm2_rating' => $evalRating($p2),
            'm3_pct'    => $p3 !== null ? round($p3, 2) : null,
            'm3_rating' => $rating,
        ];

        // Evaluate Execution using latest month (m3)
        $execStatus = $evalExec($p3);
        $execKey = ($execStatus === 'Executed') ? 'executed' : 'not_executed';
        if (isset($execCounts[$execKey])) {
            $execCounts[$execKey]++;
        }

        $execList[] = [
            'sitecode'         => $sc,
            'name_site'        => $name,
            'sub_dept'         => $subDept,
            'pct'              => $p3 !== null ? round($p3, 2) : null,
            'execution_status' => $execStatus,
            'm1_pct'           => $p1 !== null ? round($p1, 2) : null,
            'm2_pct'           => $p2 !== null ? round($p2, 2) : null,
            'm3_pct'           => $p3 !== null ? round($p3, 2) : null,
            'm1_status'        => $evalExec($p1),
            'm2_status'        => $evalExec($p2),
            'm3_status'        => $evalExec($p3),
        ];
    }

    echo json_encode([
        'success'          => true,
        'year'             => $year,
        'month'            => $month,
        'period'           => [
            'm1' => $m1Info,
            'm2' => $m2Info,
            'm3' => $m3Info
        ],
        'rating'           => $ratingList,
        'execution'        => $execList,
        'rating_counts'    => $ratingCounts,
        'execution_counts' => $execCounts,
        'total_sites'      => count($sites)
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Terjadi kesalahan server: ' . $e->getMessage()
    ]);
}
