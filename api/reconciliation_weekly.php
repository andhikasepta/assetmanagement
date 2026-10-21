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

            // If not specified, find latest available period in asset_reconciliation_weekly
            if ($month <= 0 || $week <= 0) {
                $latestStmt = $db->query('
                    SELECT period_month, period_week, period_year 
                    FROM asset_reconciliation_weekly 
                    WHERE period_year IS NOT NULL AND period_month IS NOT NULL AND period_week IS NOT NULL
                    ORDER BY period_year DESC, period_month DESC, period_week DESC, id DESC 
                    LIMIT 1
                ');
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

            // Helper to get achievements for a given period
            $calcPeriodStats = function (int $m, int $w, int $y, string $cat) use ($db, $targetPct) {
                // Fetch weekly records for period
                $stmt = $db->prepare('
                    SELECT id, profile, period_start, period_end,
                           match_physic_qty, match_nbv_value,
                           physic_physic_qty, physic_nbv_value,
                           db_physic_qty, db_nbv_value,
                           total_physic_actual, total_physic_target, total_physic_pct
                    FROM asset_reconciliation_weekly
                    WHERE period_month = :m AND period_week = :w AND period_year = :y
                ');
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
                           COALESCE(is_counted, TRUE) as is_counted 
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

                foreach ($allSites as $s) {
                    $isPmd = (strtoupper(trim($s['dept'] ?? '')) === 'PMD');
                    $isActive = filter_var($s['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);
                    $isCounted = filter_var($s['is_counted'] ?? true, FILTER_VALIDATE_BOOLEAN);

                    if (!$isActive || !$isCounted) continue;

                    // Filter based on selected category (PMD or Outlet Regional)
                    if ($cat === 'pmd') {
                        if (!$isPmd) continue;
                    } else {
                        // Outlet Regional: non-PMD, non-warehouse/HUB
                        $info = trim($s['info'] ?? '');
                        $isTekno = (stripos($s['name_site'] ?? '', 'TEKNO') !== false);
                        if ($isPmd || $isTekno || in_array($info, ['HUB Monthly', 'HUB Quarterly', 'IT Coorporate', 'IT Corporate', 'Under Warehouse', 'HUB'])) {
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
                        $status = ($pct >= $targetPct) ? 'Tercapai' : 'Tidak Tercapai';
                        $executed = ($actualQty > 0);
                    } else {
                        $status = 'Belum Ada Data';
                        $executed = false;
                    }

                    $matchedSites[$sc] = [
                        'sitecode'   => $sc,
                        'name_site'  => $s['name_site'] ?? '',
                        'dept'       => $dept,
                        'sub_dept'   => $subDept,
                        'regional'   => $s['regional'] ?? '',
                        'pct'        => ($pct !== null ? round($pct, 2) : null),
                        'match_qty'  => $matchQty,
                        'physic_qty' => $physicQty,
                        'db_qty'     => $dbQty,
                        'actual_qty' => $actualQty,
                        'target_qty' => $targetQty,
                        'status'     => $status,
                        'has_data'   => $hasData,
                        'executed'   => $executed,
                    ];
                }

                $mainPct = ($catCount > 0) ? round($catSum / $catCount, 2) : 0.0;

                $formatKpi = function ($sum, $count, $total) use ($targetPct) {
                    $pct = ($count > 0) ? round($sum / $count, 2) : 0.0;
                    return [
                        'pct'           => $pct,
                        'sites_counted' => $count,
                        'total_sites'   => $total,
                        'status'        => ($total === 0 || $count === 0) ? 'Belum Ada Data' : (($pct >= $targetPct) ? 'Tercapai' : 'Tidak Tercapai'),
                    ];
                };

                $deptsFormatted = [];
                foreach ($deptStats as $k => $v) {
                    $deptsFormatted[strtolower($k)] = $formatKpi($v['sum'], $v['count'], $v['total']);
                }

                $subDeptsFormatted = [];
                foreach ($subDeptStats as $k => $v) {
                    $subDeptsFormatted[strtolower($k)] = $formatKpi($v['sum'], $v['count'], $v['total']);
                }

                return [
                    'main'             => [
                        'pct'           => $mainPct,
                        'sites_counted' => $catCount,
                        'total_sites'   => $catTotalSites,
                        'status'        => ($catTotalSites === 0 || $catCount === 0) ? 'Belum Ada Data' : (($mainPct >= $targetPct) ? 'Tercapai' : 'Tidak Tercapai'),
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
            $prevCheck = $db->prepare('
                SELECT COUNT(*) FROM asset_reconciliation_weekly 
                WHERE period_month = :m AND period_week = :w AND period_year = :y
            ');
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
                $achievements['depts'][$dKey] = [
                    'pct'           => $dVal['pct'],
                    'prev_pct'      => $prevPct,
                    'diff_pct'      => $calcDiff($dVal['pct'], $prevPct),
                    'sites_counted' => $dVal['sites_counted'],
                    'total_sites'   => $dVal['total_sites'],
                    'status'        => $dVal['status'],
                ];
            }

            foreach ($currData['sub_depts'] as $sKey => $sVal) {
                $prevPct = $hasPrevious ? ($prevData['sub_depts'][$sKey]['pct'] ?? null) : null;
                $achievements['sub_depts'][$sKey] = [
                    'pct'           => $sVal['pct'],
                    'prev_pct'      => $prevPct,
                    'diff_pct'      => $calcDiff($sVal['pct'], $prevPct),
                    'sites_counted' => $sVal['sites_counted'],
                    'total_sites'   => $sVal['total_sites'],
                    'status'        => $sVal['status'],
                ];
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
                $p = $sr['pct'];
                if ($p >= 98.0) {
                    $sr['rating'] = 'Very Good';
                    $sr['rating_code'] = 'very_good';
                    $ratingCounts['very_good']++;
                } elseif ($p >= 90.0) {
                    $sr['rating'] = 'Good';
                    $sr['rating_code'] = 'good';
                    $ratingCounts['good']++;
                } elseif ($p >= 85.0) {
                    $sr['rating'] = 'Moderate';
                    $sr['rating_code'] = 'moderate';
                    $ratingCounts['moderate']++;
                } elseif ($p >= 80.0) {
                    $sr['rating'] = 'Poor';
                    $sr['rating_code'] = 'poor';
                    $ratingCounts['poor']++;
                } else {
                    $sr['rating'] = 'Very Poor';
                    $sr['rating_code'] = 'very_poor';
                    $ratingCounts['very_poor']++;
                }

                if ($sr['executed']) {
                    $sr['execution_status'] = 'Executed';
                    $executionCounts['executed']++;
                } else {
                    $sr['execution_status'] = 'Not Executed';
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

            echo json_encode([
                'success'      => true,
                'period'       => [
                    'month' => $month,
                    'week'  => $week,
                    'year'  => $year,
                ],
                'category'     => $category,
                'achievements' => $achievements,
                'scorecard'    => $scorecard,
                'report_so'    => $siteRows,
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

        $where = [];
        $params = [];

        if ($month > 0 && $month <= 12) {
            $where[] = 'period_month = :month';
            $params[':month'] = $month;
        }
        if ($week > 0 && $week <= 4) {
            $where[] = 'period_week = :week';
            $params[':week'] = $week;
        }
        if ($year >= 2000 && $year <= 2100) {
            $where[] = 'period_year = :year';
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
            SELECT * FROM asset_reconciliation_weekly
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
