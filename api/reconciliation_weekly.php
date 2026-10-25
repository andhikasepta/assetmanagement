<?php
/**
 * Reconciliation Weekly API Endpoint
 * Handles:
 * 1. Master Data List & Bulk Delete for `asset_reconciliation_weekly` (SO Profile Weekly)
 * 2. Weekly Summary Analytics (Achievements Cards, Score Card Summary, Report SO)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/security.php';

sendSecurityHeaders();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

try {
    $db = getDbConnection();

    // ── GET REQUESTS ────────────────────────────────────────────────
    if ($method === 'GET') {
        // ── 1. ACTION = SUMMARY (Weekly Summary Page) ───────────────
        if ($action === 'summary') {
            $month = isset($_GET['month']) && is_numeric($_GET['month']) ? (int) $_GET['month'] : 0;
            $week  = isset($_GET['week']) && is_numeric($_GET['week'])   ? (int) $_GET['week']  : 0;
            $year  = isset($_GET['year']) && is_numeric($_GET['year'])   ? (int) $_GET['year']  : (int) date('Y');
            $category = trim($_GET['category'] ?? 'pmd'); // 'pmd' or 'outlet'

            // If month or week not specified, find latest available period in asset_reconciliation_weekly
            if ($month > 0 && $week <= 0) {
                $latestWeekStmt = $db->prepare("
                    SELECT 
                        COALESCE(period_week, CASE WHEN EXTRACT(DAY FROM period_end) <= 7 THEN 1 WHEN EXTRACT(DAY FROM period_end) <= 14 THEN 2 WHEN EXTRACT(DAY FROM period_end) <= 21 THEN 3 ELSE 4 END) as period_week, 
                        COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) as period_year 
                    FROM asset_reconciliation_weekly 
                    WHERE profile NOT ILIKE 'profile%'
                      AND COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) = :month
                      AND (:year <= 0 OR COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) = :year)
                    ORDER BY period_year DESC, period_week DESC, id DESC 
                    LIMIT 1
                ");
                $latestWeekStmt->execute([':month' => $month, ':year' => $year]);
                $latestW = $latestWeekStmt->fetch(PDO::FETCH_ASSOC);
                if ($latestW) {
                    $week = (int) $latestW['period_week'];
                    if ($year <= 0) {
                        $year = (int) $latestW['period_year'];
                    }
                } else {
                    $week = 1;
                    if ($year <= 0) $year = (int) date('Y');
                }
            } elseif ($month <= 0 || $week <= 0) {
                $latestStmt = $db->query("
                    SELECT 
                        COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) as period_month, 
                        COALESCE(period_week, CASE WHEN EXTRACT(DAY FROM period_end) <= 7 THEN 1 WHEN EXTRACT(DAY FROM period_end) <= 14 THEN 2 WHEN EXTRACT(DAY FROM period_end) <= 21 THEN 3 ELSE 4 END) as period_week, 
                        COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) as period_year 
                    FROM asset_reconciliation_weekly 
                    WHERE profile NOT ILIKE 'profile%'
                    ORDER BY period_year DESC, period_month DESC, period_week DESC, id DESC 
                    LIMIT 1
                ");
                $latest = $latestStmt->fetch(PDO::FETCH_ASSOC);
                if ($latest) {
                    $month = (int) $latest['period_month'];
                    $week  = (int) $latest['period_week'];
                    $year  = (int) $latest['period_year'];
                } else {
                    $month = (int) date('n');
                    $week = 1;
                    $year = (int) date('Y');
                }
            }

            // Target percentage based on category
            $targetPct = ($category === 'pmd') ? 98.0 : 85.0;

            // Fetch Score Card KPI Configurations (Rating & SO Execution) from Master Data
            $kpiStmt = $db->query("
                SELECT rating_key, rating_label, min_pct, max_pct, threshold_decimal, kpi_type 
                FROM scorecard_kpi_config 
                ORDER BY sort_order ASC
            ");
            $kpiRows = $kpiStmt ? $kpiStmt->fetchAll(PDO::FETCH_ASSOC) : [];

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

            // SO Execution threshold (from SO Execution KPI Master Data, default 25%)
            $execThreshDec = 0.25;
            if (isset($execKpis['not_executed']['threshold_decimal']) && $execKpis['not_executed']['threshold_decimal'] !== null) {
                $execThreshDec = (float) $execKpis['not_executed']['threshold_decimal'];
            } elseif (isset($execKpis['not_executed']['max_pct']) && $execKpis['not_executed']['max_pct'] !== null) {
                $execThreshDec = (float) $execKpis['not_executed']['max_pct'] / 100.0;
            }
            $execThreshPct = $execThreshDec * 100.0;

            // Rating thresholds (from Rating KPI Master Data)
            $vpMax = isset($ratingKpis['very_poor']['max_pct']) && $ratingKpis['very_poor']['max_pct'] !== null ? (float) $ratingKpis['very_poor']['max_pct'] : 34.0;
            $pMax  = isset($ratingKpis['poor']['max_pct']) && $ratingKpis['poor']['max_pct'] !== null ? (float) $ratingKpis['poor']['max_pct'] : 62.0;
            $mMax  = isset($ratingKpis['moderate']['max_pct']) && $ratingKpis['moderate']['max_pct'] !== null ? (float) $ratingKpis['moderate']['max_pct'] : 71.0;
            $gMax  = isset($ratingKpis['good']['max_pct']) && $ratingKpis['good']['max_pct'] !== null ? (float) $ratingKpis['good']['max_pct'] : 84.0;

            // Helper to evaluate Rating from Rating KPI Master Data
            $evalRating = function (?float $pct) use ($vpMax, $pMax, $mMax, $gMax): array {
                if ($pct === null || $pct === false) {
                    return ['rating' => 'Very Poor', 'rating_code' => 'very_poor'];
                }
                $p = (int) round($pct);
                if ($p <= $vpMax) return ['rating' => 'Very Poor', 'rating_code' => 'very_poor'];
                if ($p <= $pMax)  return ['rating' => 'Poor', 'rating_code' => 'poor'];
                if ($p <= $mMax)  return ['rating' => 'Moderate', 'rating_code' => 'moderate'];
                if ($p <= $gMax)  return ['rating' => 'Good', 'rating_code' => 'good'];
                return ['rating' => 'Very Good', 'rating_code' => 'very_good'];
            };

            // Helper to evaluate SO Execution from SO Execution KPI Master Data
            $evalExec = function (?float $pct) use ($execThreshPct): array {
                if ($pct === null || $pct === false) {
                    return ['status' => 'Not Executed', 'code' => 'not_executed', 'executed' => false];
                }
                $p = (int) round($pct);
                $isExec = ($p >= $execThreshPct);
                return [
                    'status'   => $isExec ? 'Executed' : 'Not Executed',
                    'code'     => $isExec ? 'executed' : 'not_executed',
                    'executed' => $isExec,
                ];
            };

            // Helper function to get effective group types and counting status for a given period
            $getEffectiveTypes = function (PDO $db, ?int $y, ?int $m): array {
                $year = $y ?: (int) date('Y');
                $month = $m ?: 12;

                $sites = $db->query("
                    SELECT sitecode, dept, 
                           COALESCE(NULLIF(group_type, ''), 'monthly') as group_type, 
                           COALESCE(is_active, TRUE) as is_active, 
                           COALESCE(is_counted, TRUE) as is_counted,
                           COALESCE(is_counted_weekly, TRUE) as is_counted_weekly 
                    FROM site_regional
                ")->fetchAll(PDO::FETCH_ASSOC);

                $map = [];
                $pmdSites = [];
                foreach ($sites as $s) {
                    $sc = strtoupper(trim($s['sitecode'] ?? ''));
                    $isActive = filter_var($s['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);
                    $isCounted = filter_var($s['is_counted'] ?? true, FILTER_VALIDATE_BOOLEAN);
                    $isCountedWeekly = filter_var($s['is_counted_weekly'] ?? true, FILTER_VALIDATE_BOOLEAN);

                    if (!$isActive) {
                        $map[$sc] = 'inactive';
                    } elseif (!$isCounted) {
                        $map[$sc] = 'uncounted';
                    } elseif (!$isCountedWeekly) {
                        $map[$sc] = 'uncounted_weekly';
                    } elseif (strtoupper(trim($s['dept'] ?? '')) === 'PMD') {
                        $map[$sc] = 'monthly';
                        $pmdSites[$sc] = true;
                    } else {
                        $map[$sc] = $s['group_type'] ?? 'monthly';
                    }
                }

                $stmt = $db->prepare("
                    SELECT DISTINCT ON (sitecode) sitecode, group_type
                    FROM site_group_history
                    WHERE effective_year < :y OR (effective_year = :y AND effective_month <= :m)
                    ORDER BY sitecode, effective_year DESC, effective_month DESC
                ");
                $stmt->execute([':y' => $year, ':m' => $month]);
                $historyRules = $stmt->fetchAll(PDO::FETCH_ASSOC);

                foreach ($historyRules as $hr) {
                    $sc = strtoupper(trim($hr['sitecode']));
                    if (isset($map[$sc]) && empty($pmdSites[$sc]) && $map[$sc] !== 'inactive' && $map[$sc] !== 'uncounted' && $map[$sc] !== 'uncounted_weekly') {
                        $map[$sc] = $hr['group_type'];
                    }
                }

                return $map;
            };

            // Helper to get achievements for a given period
            $calcPeriodStats = function (int $m, int $w, int $y, string $cat) use ($db, $targetPct, $getEffectiveTypes, $evalRating, $evalExec) {
                // Fetch weekly records for period
                $stmt = $db->prepare("
                    SELECT id, profile, 
                           TO_CHAR(period_start, 'YYYY-MM-DD') as period_start, 
                           TO_CHAR(period_end, 'YYYY-MM-DD') as period_end,
                           COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) as period_month,
                           COALESCE(period_week, CASE WHEN EXTRACT(DAY FROM period_end) <= 7 THEN 1 WHEN EXTRACT(DAY FROM period_end) <= 14 THEN 2 WHEN EXTRACT(DAY FROM period_end) <= 21 THEN 3 ELSE 4 END) as period_week,
                           COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) as period_year,
                           match_physic_qty, match_nbv_value,
                           physic_physic_qty, physic_nbv_value,
                           db_physic_qty, db_nbv_value,
                           total_physic_actual, total_physic_target, total_physic_pct
                    FROM asset_reconciliation_weekly
                    WHERE COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) = :m 
                      AND COALESCE(period_week, CASE WHEN EXTRACT(DAY FROM period_end) <= 7 THEN 1 WHEN EXTRACT(DAY FROM period_end) <= 14 THEN 2 WHEN EXTRACT(DAY FROM period_end) <= 21 THEN 3 ELSE 4 END) = :w 
                      AND COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) = :y
                      AND profile NOT ILIKE 'profile%'
                ");
                $stmt->execute([':m' => $m, ':w' => $w, ':y' => $y]);
                $recs = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $recByCode = [];
                $recList = [];
                foreach ($recs as $r) {
                    $recList[] = $r;
                    $parts = explode('-', $r['profile'] ?? '');
                    foreach ($parts as $p) {
                        $token = strtoupper(trim($p));
                        if ($token !== '') {
                            $recByCode[$token][] = $r;
                        }
                    }
                }

                // Fetch sites
                $sitesStmt = $db->query("
                    SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type, 
                           COALESCE(is_active, TRUE) as is_active, 
                           COALESCE(is_counted, TRUE) as is_counted,
                           COALESCE(is_counted_weekly, TRUE) as is_counted_weekly 
                    FROM site_regional
                    ORDER BY dept ASC, sub_dept ASC, sitecode ASC
                ");
                $allSites = $sitesStmt->fetchAll(PDO::FETCH_ASSOC);

                $matchedSites = [];
                $deptStats = [
                    'CRO' => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'ERO' => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'WRO' => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'PMD' => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                ];
                $subDeptStats = [
                    'CJDO' => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'EKO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'WJO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'WKO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'BNO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'EJO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'MPO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'SMO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'CSO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'NSO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'SSO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'CCO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'WCO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'ECO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'EEO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'NEO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'SEO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'DNO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                    'DSO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                ];

                $catSum = 0.0;
                $catCount = 0;
                $catTotalSites = 0;

                $effectiveMap = $getEffectiveTypes($db, $y, $m);

                foreach ($allSites as $s) {
                    $sc = strtoupper(trim($s['sitecode'] ?? ''));
                    $effType = $effectiveMap[$sc] ?? 'monthly';
                    $isPmd = (strtoupper(trim($s['dept'] ?? '')) === 'PMD');
                    $isActive = filter_var($s['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);
                    $isCounted = filter_var($s['is_counted'] ?? true, FILTER_VALIDATE_BOOLEAN);
                    $isCountedWeekly = filter_var($s['is_counted_weekly'] ?? true, FILTER_VALIDATE_BOOLEAN);

                    // Strictly skip inactive and uncounted sites so they never appear in DEPT achievements or weekly summary
                    if (!$isActive || !$isCounted || !$isCountedWeekly || $effType === 'inactive' || $effType === 'uncounted' || $effType === 'uncounted_weekly') {
                        continue;
                    }

                    // Filter based on selected category (PMD or Outlet Regional)
                    if ($cat === 'pmd') {
                        if (!$isPmd) continue;
                    } else {
                        // Outlet Regional: non-PMD, non-warehouse/HUB, strictly group_type = 'monthly'
                        $info = trim($s['info'] ?? '');
                        $isTekno = (stripos($s['name_site'] ?? '', 'TEKNO') !== false);
                        if ($isPmd || $isTekno || $effType !== 'monthly' || in_array($info, ['HUB Monthly', 'HUB Quarterly', 'IT Coorporate', 'IT Corporate', 'Under Warehouse', 'HUB'])) {
                            continue;
                        }
                    }

                    $catTotalSites++;
                    $sc = strtoupper(trim($s['sitecode'] ?? ''));
                    $dept = strtoupper(trim($s['dept'] ?? ''));
                    $subDept = strtoupper(trim($s['sub_dept'] ?? ''));

                    if (isset($deptStats[$dept])) $deptStats[$dept]['total']++;
                    if (isset($subDeptStats[$subDept])) $subDeptStats[$subDept]['total']++;

                    $matchedRecs = [];
                    if ($sc !== '') {
                        if (isset($recByCode[$sc])) {
                            $matchedRecs = $recByCode[$sc];
                        } else {
                            foreach ($recList as $item) {
                                $prof = $item['profile'] ?? '';
                                if (
                                    stripos($prof, " - {$sc} - ") !== false ||
                                    stripos($prof, "- {$sc} -") !== false ||
                                    stripos($prof, " {$sc} ") !== false ||
                                    stripos($prof, $sc) !== false
                                ) {
                                    $matchedRecs[] = $item;
                                }
                            }
                            if (!empty($matchedRecs)) {
                                $recByCode[$sc] = $matchedRecs;
                            }
                        }
                    }

                    $hasData = !empty($matchedRecs);
                    $matchQty = 0;
                    $physicQty = 0;
                    $dbQty = 0;
                    $actualQty = 0;
                    $targetQty = 0;
                    $pct = null;

                    if ($hasData) {
                        if (count($matchedRecs) === 1) {
                            $recRow = $matchedRecs[0];
                            $matchQty = (int) ($recRow['match_physic_qty'] ?? 0);
                            $physicQty = (int) ($recRow['physic_physic_qty'] ?? 0);
                            $dbQty = (int) ($recRow['db_physic_qty'] ?? 0);
                            $actualQty = (int) ($recRow['total_physic_actual'] ?? 0);
                            $targetQty = (int) ($recRow['total_physic_target'] ?? 0);
                            $pct = ($recRow['total_physic_pct'] !== null && $recRow['total_physic_pct'] !== '') ? (float) $recRow['total_physic_pct'] : null;
                        } else {
                            foreach ($matchedRecs as $recRow) {
                                $matchQty += (int) ($recRow['match_physic_qty'] ?? 0);
                                $physicQty += (int) ($recRow['physic_physic_qty'] ?? 0);
                                $dbQty += (int) ($recRow['db_physic_qty'] ?? 0);
                                $actualQty += (int) ($recRow['total_physic_actual'] ?? 0);
                                $targetQty += (int) ($recRow['total_physic_target'] ?? 0);
                            }
                            if ($targetQty > 0) {
                                $pct = round(($actualQty / $targetQty) * 100.0, 2);
                            } elseif ($actualQty > 0) {
                                $pct = 100.0;
                            } else {
                                $pct = 0.0;
                            }
                        }
                    }

                    if ($hasData && $pct !== null) {
                        $catSum += $pct;
                        $catCount++;

                        if (isset($deptStats[$dept])) {
                            $deptStats[$dept]['sum'] += $pct;
                            $deptStats[$dept]['count']++;
                        }
                        if (isset($subDeptStats[$subDept])) {
                            $subDeptStats[$subDept]['sum'] += $pct;
                            $subDeptStats[$subDept]['count']++;
                        }
                        $roundedSitePct = (int) round($pct);
                        $status = ($roundedSitePct >= $targetPct) ? 'Tercapai' : 'Tidak Tercapai';
                        $execInfo = $evalExec($pct);
                        $ratingInfo = $evalRating($pct);
                        $executed = $execInfo['executed'];
                        $executionStatus = $execInfo['status'];
                        $rating = $ratingInfo['rating'];
                        $ratingCode = $ratingInfo['rating_code'];
                    } else {
                        $status = 'Belum Ada Data';
                        $executed = false;
                        $executionStatus = 'Not Executed';
                        $rating = 'Very Poor';
                        $ratingCode = 'very_poor';
                    }

                    $matchedSites[$sc] = [
                        'sitecode'         => $sc,
                        'name_site'        => $s['name_site'] ?? '',
                        'dept'             => $dept,
                        'sub_dept'         => $subDept,
                        'regional'         => $s['regional'] ?? '',
                        'pct'              => ($pct !== null ? round($pct, 2) : null),
                        'match_qty'        => $matchQty,
                        'physic_qty'       => $physicQty,
                        'db_qty'           => $dbQty,
                        'actual_qty'       => $actualQty,
                        'target_qty'       => $targetQty,
                        'status'           => $status,
                        'has_data'         => $hasData,
                        'executed'         => $executed,
                        'execution_status' => $executionStatus,
                        'rating'           => $rating,
                        'rating_code'      => $ratingCode,
                    ];
                }

                $mainPct = ($catCount > 0) ? round($catSum / $catCount, 2) : 0.0;
                $mainRounded = (int) round($mainPct);

                $formatKpi = function ($sum, $count, $total) use ($targetPct) {
                    $pct = ($count > 0) ? round($sum / $count, 2) : 0.0;
                    $roundedPct = (int) round($pct);
                    return [
                        'pct'           => $pct,
                        'sites_counted' => $count,
                        'total_sites'   => $total,
                        'status'        => ($total === 0 || $count === 0) ? 'Belum Ada Data' : (($roundedPct >= $targetPct) ? 'Tercapai' : 'Tidak Tercapai'),
                    ];
                };

                $deptsFormatted = [];
                foreach ($deptStats as $k => $v) {
                    $kpi = $formatKpi($v['sum'], $v['count'], $v['total']);
                    $deptsFormatted[strtolower($k)] = $kpi;
                    $deptsFormatted[strtoupper($k)] = $kpi;
                }

                $subDeptsFormatted = [];
                foreach ($subDeptStats as $k => $v) {
                    $kpi = $formatKpi($v['sum'], $v['count'], $v['total']);
                    $subDeptsFormatted[strtolower($k)] = $kpi;
                    $subDeptsFormatted[strtoupper($k)] = $kpi;
                }

                return [
                    'main'             => [
                        'pct'           => $mainPct,
                        'sites_counted' => $catCount,
                        'total_sites'   => $catTotalSites,
                        'status'        => ($catTotalSites === 0 || $catCount === 0) ? 'Belum Ada Data' : (($mainRounded >= $targetPct) ? 'Tercapai' : 'Tidak Tercapai'),
                    ],
                    'depts'            => $deptsFormatted,
                    'sub_depts'        => $subDeptsFormatted,
                    'sites'            => $matchedSites,
                    'raw_count'        => count($recs),
                ];
            };

            // Calculate current period
            $currData = $calcPeriodStats($month, $week, $year, $category);

            // Determine previous week
            $prevWeek = $week - 1;
            $prevMonth = $month;
            $prevYear = $year;
            if ($prevWeek < 1) {
                $prevWeek = 4;
                $prevMonth = $month - 1;
                if ($prevMonth < 1) {
                    $prevMonth = 12;
                    $prevYear = $year - 1;
                }
            }

            // Check if previous week data exists in DB
            $prevCheck = $db->prepare("
                SELECT COUNT(*) FROM asset_reconciliation_weekly 
                WHERE COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) = :m 
                  AND COALESCE(period_week, CASE WHEN EXTRACT(DAY FROM period_end) <= 7 THEN 1 WHEN EXTRACT(DAY FROM period_end) <= 14 THEN 2 WHEN EXTRACT(DAY FROM period_end) <= 21 THEN 3 ELSE 4 END) = :w 
                  AND COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) = :y
                  AND profile NOT ILIKE 'profile%'
            ");
            $prevCheck->execute([':m' => $prevMonth, ':w' => $prevWeek, ':y' => $prevYear]);
            $hasPrevious = ((int) $prevCheck->fetchColumn() > 0);

            $prevData = $hasPrevious ? $calcPeriodStats($prevMonth, $prevWeek, $prevYear, $category) : null;

            // Trend calculation helper (diff_pct)
            $calcDiff = function ($currPct, $prevPct) use ($hasPrevious, $currData) {
                if (!$hasPrevious || $currData['raw_count'] <= 0 || $currPct === null || $prevPct === null) {
                    return null;
                }
                return round((float) $currPct - (float) $prevPct, 2);
            };

            // Build Achievements Payload
            $achievements = [
                'has_previous'    => $hasPrevious,
                'target_pct'      => $targetPct,
                'previous_period' => $hasPrevious ? ['month' => $prevMonth, 'week' => $prevWeek, 'year' => $prevYear] : null,
                'main'            => [
                    'pct'           => $currData['main']['pct'],
                    'prev_pct'      => $hasPrevious ? $prevData['main']['pct'] : null,
                    'diff_pct'      => $calcDiff($currData['main']['pct'], $hasPrevious ? $prevData['main']['pct'] : null),
                    'sites_counted' => $currData['main']['sites_counted'],
                    'total_sites'   => $currData['main']['total_sites'],
                    'status'        => $currData['main']['status'],
                ],
                'depts'           => [],
                'sub_depts'       => [],
            ];

            foreach ($currData['depts'] as $dKey => $dVal) {
                $prevPct = $hasPrevious ? ($prevData['depts'][$dKey]['pct'] ?? null) : null;
                $kpiObj = [
                    'pct'           => $dVal['pct'],
                    'prev_pct'      => $prevPct,
                    'diff_pct'      => $calcDiff($dVal['pct'], $prevPct),
                    'sites_counted' => $dVal['sites_counted'],
                    'total_sites'   => $dVal['total_sites'],
                    'status'        => $dVal['status'],
                ];
                $achievements['depts'][strtolower($dKey)] = $kpiObj;
                $achievements['depts'][strtoupper($dKey)] = $kpiObj;
            }

            foreach ($currData['sub_depts'] as $sKey => $sVal) {
                $prevPct = $hasPrevious ? ($prevData['sub_depts'][$sKey]['pct'] ?? null) : null;
                $kpiObj = [
                    'pct'           => $sVal['pct'],
                    'prev_pct'      => $prevPct,
                    'diff_pct'      => $calcDiff($sVal['pct'], $prevPct),
                    'sites_counted' => $sVal['sites_counted'],
                    'total_sites'   => $sVal['total_sites'],
                    'status'        => $sVal['status'],
                ];
                $achievements['sub_depts'][strtolower($sKey)] = $kpiObj;
                $achievements['sub_depts'][strtoupper($sKey)] = $kpiObj;
            }

            // Build Score Card Summary (Rating & Execution)
            // Rule: Always display full words: Very Good, Good, Moderate, Poor, Very Poor
            $ratingCounts = [
                'very_good' => 0,
                'good'      => 0,
                'moderate'  => 0,
                'poor'      => 0,
                'very_poor' => 0,
            ];

            $executionCounts = [
                'executed'     => 0,
                'not_executed' => 0,
            ];

            $siteRows = array_values($currData['sites']);
            foreach ($siteRows as &$sr) {
                $rCode = $sr['rating_code'] ?? 'very_poor';
                if (isset($ratingCounts[$rCode])) {
                    $ratingCounts[$rCode]++;
                }

                if (!empty($sr['executed'])) {
                    $executionCounts['executed']++;
                } else {
                    $executionCounts['not_executed']++;
                }
            }
            unset($sr);

            $totalSitesForScorecard = count($siteRows);

            $scorecard = [
                'rating'    => [
                    'total'     => $totalSitesForScorecard,
                    'very_good' => $ratingCounts['very_good'],
                    'good'      => $ratingCounts['good'],
                    'moderate'  => $ratingCounts['moderate'],
                    'poor'      => $ratingCounts['poor'],
                    'very_poor' => $ratingCounts['very_poor'],
                    'pct_vg'    => ($totalSitesForScorecard > 0) ? round(($ratingCounts['very_good'] / $totalSitesForScorecard) * 100, 1) : 0,
                    'pct_g'     => ($totalSitesForScorecard > 0) ? round(($ratingCounts['good'] / $totalSitesForScorecard) * 100, 1) : 0,
                    'pct_m'     => ($totalSitesForScorecard > 0) ? round(($ratingCounts['moderate'] / $totalSitesForScorecard) * 100, 1) : 0,
                    'pct_p'     => ($totalSitesForScorecard > 0) ? round(($ratingCounts['poor'] / $totalSitesForScorecard) * 100, 1) : 0,
                    'pct_vp'    => ($totalSitesForScorecard > 0) ? round(($ratingCounts['very_poor'] / $totalSitesForScorecard) * 100, 1) : 0,
                ],
                'execution' => [
                    'total'        => $totalSitesForScorecard,
                    'executed'     => $executionCounts['executed'],
                    'not_executed' => $executionCounts['not_executed'],
                    'pct_exec'     => ($totalSitesForScorecard > 0) ? round(($executionCounts['executed'] / $totalSitesForScorecard) * 100, 1) : 0,
                    'pct_not_exec' => ($totalSitesForScorecard > 0) ? round(($executionCounts['not_executed'] / $totalSitesForScorecard) * 100, 1) : 0,
                ],
                'sites'     => $siteRows,
            ];

            $periodsStmt = $db->query("
                SELECT DISTINCT 
                    COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) as period_year, 
                    COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) as period_month, 
                    COALESCE(period_week, CASE WHEN EXTRACT(DAY FROM period_end) <= 7 THEN 1 WHEN EXTRACT(DAY FROM period_end) <= 14 THEN 2 WHEN EXTRACT(DAY FROM period_end) <= 21 THEN 3 ELSE 4 END) as period_week
                FROM asset_reconciliation_weekly 
                WHERE profile NOT ILIKE 'profile%'
                ORDER BY period_year DESC, period_month DESC, period_week DESC
            ");
            $availablePeriods = $periodsStmt ? $periodsStmt->fetchAll(PDO::FETCH_ASSOC) : [];

            echo json_encode([
                'success'           => true,
                'period'            => [
                    'month' => $month,
                    'week'  => $week,
                    'year'  => $year,
                ],
                'latest_period'     => !empty($availablePeriods) ? [
                    'month' => (int) $availablePeriods[0]['period_month'],
                    'week'  => (int) $availablePeriods[0]['period_week'],
                    'year'  => (int) $availablePeriods[0]['period_year'],
                ] : [
                    'month' => (int) date('n'),
                    'week'  => 1,
                    'year'  => (int) date('Y'),
                ],
                'available_periods' => array_map(function($p) {
                    return [
                        'year'  => (int) $p['period_year'],
                        'month' => (int) $p['period_month'],
                        'week'  => (int) $p['period_week'],
                    ];
                }, $availablePeriods),
                'category'          => $category,
                'achievements'      => $achievements,
                'scorecard'         => $scorecard,
                'report_so'         => $siteRows,
            ]);
            exit;
        }

        // ── 2. ACTION = LIST (SO Profile Weekly Master Data Table) ───
        $month = isset($_GET['month']) && is_numeric($_GET['month']) ? (int) $_GET['month'] : 0;
        $week  = isset($_GET['week']) && is_numeric($_GET['week'])   ? (int) $_GET['week']  : 0;
        $year  = isset($_GET['year']) && is_numeric($_GET['year'])   ? (int) $_GET['year']  : 0;
        $search = trim($_GET['search'] ?? '');
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $pageSize = $_GET['page_size'] ?? '10';
        $limit = ($pageSize === 'all') ? 10000 : max(1, (int) $pageSize);
        $offset = ($page - 1) * $limit;

        $sortCol = trim($_GET['sort_col'] ?? 'id');
        $sortDir = strtolower(trim($_GET['sort_dir'] ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';

        $allowedSort = [
            'id', 'profile', 'period_start', 'period_end', 'period_month', 'period_week', 'period_year',
            'match_physic_qty', 'match_physic_pct', 'match_nbv_value', 'match_nbv_pct',
            'physic_physic_qty', 'physic_physic_pct', 'physic_nbv_value', 'physic_nbv_pct',
            'db_physic_qty', 'db_physic_pct', 'db_nbv_value', 'db_nbv_pct',
            'total_physic_actual', 'total_physic_target', 'total_physic_pct',
            'total_nbv_actual', 'total_nbv_target', 'total_nbv_pct'
        ];
        if (!in_array($sortCol, $allowedSort, true)) {
            $sortCol = 'id';
        }

        $where = ["profile NOT ILIKE 'profile%'"];
        $params = [];

        if ($month > 0 && $month <= 12) {
            $where[] = 'COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) = :month';
            $params[':month'] = $month;
        }
        if ($week > 0 && $week <= 4) {
            $where[] = 'COALESCE(period_week, CASE WHEN EXTRACT(DAY FROM period_end) <= 7 THEN 1 WHEN EXTRACT(DAY FROM period_end) <= 14 THEN 2 WHEN EXTRACT(DAY FROM period_end) <= 21 THEN 3 ELSE 4 END) = :week';
            $params[':week'] = $week;
        }
        if ($year >= 2000 && $year <= 2100) {
            $where[] = 'COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) = :year';
            $params[':year'] = $year;
        }
        if ($search !== '') {
            $where[] = '(profile ILIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // Count total
        $countStmt = $db->prepare("SELECT COUNT(*) FROM asset_reconciliation_weekly $whereSql");
        $countStmt->execute($params);
        $totalRecords = (int) $countStmt->fetchColumn();

        // Totals aggregate
        $totalsStmt = $db->prepare("
            SELECT 
                COUNT(*) as total_profiles,
                COALESCE(SUM(match_physic_qty), 0) as total_match_qty,
                COALESCE(SUM(match_nbv_value), 0) as total_match_nbv,
                COALESCE(SUM(physic_physic_qty), 0) as total_physic_qty,
                COALESCE(SUM(physic_nbv_value), 0) as total_physic_nbv,
                COALESCE(SUM(db_physic_qty), 0) as total_db_qty,
                COALESCE(SUM(db_nbv_value), 0) as total_db_nbv,
                COALESCE(SUM(total_physic_actual), 0) as total_physic_actual,
                COALESCE(SUM(total_physic_target), 0) as total_physic_target,
                COALESCE(SUM(total_nbv_actual), 0) as total_nbv_actual,
                COALESCE(SUM(total_nbv_target), 0) as total_nbv_target
            FROM asset_reconciliation_weekly
            $whereSql
        ");
        $totalsStmt->execute($params);
        $totals = $totalsStmt->fetch(PDO::FETCH_ASSOC);

        // Fetch rows
        $dataStmt = $db->prepare("
            SELECT 
                id,
                profile,
                TO_CHAR(period_start, 'YYYY-MM-DD') as period_start,
                TO_CHAR(period_end, 'YYYY-MM-DD') as period_end,
                COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) as period_month,
                COALESCE(period_week, CASE WHEN EXTRACT(DAY FROM period_end) <= 7 THEN 1 WHEN EXTRACT(DAY FROM period_end) <= 14 THEN 2 WHEN EXTRACT(DAY FROM period_end) <= 21 THEN 3 ELSE 4 END) as period_week,
                COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) as period_year,
                match_physic_qty, match_physic_pct, match_nbv_value, match_nbv_pct,
                physic_physic_qty, physic_physic_pct, physic_nbv_value, physic_nbv_pct,
                db_physic_qty, db_physic_pct, db_nbv_value, db_nbv_pct,
                total_physic_actual, total_physic_target, total_physic_pct,
                total_nbv_actual, total_nbv_target, total_nbv_pct
            FROM asset_reconciliation_weekly
            $whereSql
            ORDER BY $sortCol $sortDir
            LIMIT :limit OFFSET :offset
        ");
        foreach ($params as $k => $v) {
            $dataStmt->bindValue($k, $v);
        }
        $dataStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $dataStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $dataStmt->execute();
        $rows = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success'   => true,
            'data'      => $rows,
            'totals'    => $totals,
            'total'     => $totalRecords,
            'page'      => $page,
            'page_size' => $pageSize,
        ]);
        exit;
    }

    // ── DELETE / BULK DELETE ─────────────────────────────────────────
    if ($method === 'DELETE' || ($method === 'POST' && $action === 'bulk_delete')) {
        validateCsrfToken();
        requireAuth();
        requirePermission('can_master_weekly_delete');

        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = $input['id'] ?? ($_GET['id'] ?? null);
        $isBulk = ($action === 'bulk_delete') || ($id === 'all') || (!empty($input['bulk']));

        if ($isBulk) {
            $month = isset($input['month']) ? (int) $input['month'] : (int) ($_GET['month'] ?? 0);
            $week  = isset($input['week'])  ? (int) $input['week']  : (int) ($_GET['week'] ?? 0);
            $year  = isset($input['year'])  ? (int) $input['year']  : (int) ($_GET['year'] ?? 0);

            if ($id === 'all' || ($month <= 0 && $week <= 0 && $year <= 0)) {
                $db->exec('TRUNCATE TABLE asset_reconciliation_weekly RESTART IDENTITY');
                echo json_encode(['success' => true, 'message' => 'Semua data SO Profile Weekly berhasil dihapus.']);
                exit;
            }

            $conditions = [];
            $delParams = [];
            if ($month > 0 && $month <= 12) {
                $conditions[] = 'period_month = :m';
                $delParams[':m'] = $month;
            }
            if ($week > 0 && $week <= 4) {
                $conditions[] = 'period_week = :w';
                $delParams[':w'] = $week;
            }
            if ($year >= 2000 && $year <= 2100) {
                $conditions[] = 'period_year = :y';
                $delParams[':y'] = $year;
            }

            $sql = 'DELETE FROM asset_reconciliation_weekly WHERE ' . implode(' AND ', $conditions);
            $stmt = $db->prepare($sql);
            $stmt->execute($delParams);
            $count = $stmt->rowCount();

            echo json_encode([
                'success'       => true,
                'deleted_count' => $count,
                'message'       => "Berhasil menghapus {$count} baris data SO Profile Weekly."
            ]);
            exit;
        }

        if (!$id || !ctype_digit((string) $id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID data tidak valid.']);
            exit;
        }

        $stmt = $db->prepare('DELETE FROM asset_reconciliation_weekly WHERE id = :id');
        $stmt->execute([':id' => (int) $id]);

        echo json_encode([
            'success' => true,
            'message' => 'Data SO Profile Weekly berhasil dihapus.'
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
