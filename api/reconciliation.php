<?php
/**
 * Asset Reconciliation API
 * Handles fetching and saving reconciliation summary data
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';
        $month = isset($_GET['month']) && $_GET['month'] !== '' ? (int) $_GET['month'] : null;
        $year = isset($_GET['year']) && $_GET['year'] !== '' ? (int) $_GET['year'] : null;
        $soType = trim($_GET['so_type'] ?? 'monthly');
        $category = trim($_GET['category'] ?? '');
        $srCategories = ($soType === 'quarterly')
            ? "'quarterly', 'quarterly_outlet'"
            : "'monthly_outlet', 'monthly_pmd'";

        // Helper function to get effective group types for a given period
        $getEffectiveTypes = function (PDO $db, ?int $y, ?int $m): array {
            $year = $y ?: (int) date('Y');
            $month = $m ?: (int) date('n');

            $sites = $db->query("SELECT sitecode, dept, COALESCE(NULLIF(group_type, ''), 'monthly') as group_type FROM site_regional")->fetchAll(PDO::FETCH_ASSOC);
            $map = [];
            $pmdSites = [];
            foreach ($sites as $s) {
                $sc = strtoupper(trim($s['sitecode']));
                if (strtoupper(trim($s['dept'])) === 'PMD') {
                    $map[$sc] = 'monthly';
                    $pmdSites[$sc] = true;
                } else {
                    $map[$sc] = $s['group_type'];
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
                if (isset($map[$sc]) && empty($pmdSites[$sc])) {
                    $map[$sc] = $hr['group_type'];
                }
            }

            return $map;
        };

        // Helper function to calculate regional & national achievements
        $getAchievements = function (PDO $db, ?int $m = null, ?int $y = null, string $srCats = "", string $type = 'monthly', string $category = '') use ($getEffectiveTypes) {
            $whereParts = [];
            $params = [];
            if ($y) {
                $whereParts[] = 'period_year = :y';
                $params[':y'] = $y;
            }
            if ($m) {
                $whereParts[] = 'period_month = :m';
                $params[':m'] = $m;
            }
            if ($type === 'quarterly') {
                $whereParts[] = "profile ~* '\\mQ[1-4]\\M'";
            } else {
                $whereParts[] = "profile !~* '\\mQ[1-4]\\M'";
            }
            $whereSql = !empty($whereParts) ? 'WHERE ' . implode(' AND ', $whereParts) : '';

            $stmt = $db->prepare("SELECT id, profile, period_month, period_year, total_physic_pct, db_physic_qty FROM asset_reconciliation $whereSql");
            $stmt->execute($params);
            $recs = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $recByCode = [];
            $recList = [];
            foreach ($recs as $r) {
                $pct = (float) $r['total_physic_pct'];
                $dbQty = (int) ($r['db_physic_qty'] ?? 0);
                $recList[] = [
                    'profile' => $r['profile'],
                    'pct' => $pct,
                    'db_qty' => $dbQty,
                ];
                $parts = explode('-', $r['profile']);
                foreach ($parts as $p) {
                    $token = strtoupper(trim($p));
                    if ($token !== '') {
                        if (!isset($recByCode[$token])) {
                            $recByCode[$token] = [
                                'pct_sum' => $pct,
                                'count' => 1,
                                'pct' => $pct,
                                'db_qty' => $dbQty,
                            ];
                        } else {
                            $recByCode[$token]['pct_sum'] += $pct;
                            $recByCode[$token]['count']++;
                            $recByCode[$token]['pct'] = $recByCode[$token]['pct_sum'] / $recByCode[$token]['count'];
                            $recByCode[$token]['db_qty'] += $dbQty;
                        }
                    }
                }
            }

            // Dynamic site filtering based on effective group type for the period
            $effectiveMap = $getEffectiveTypes($db, $y, $m);
            $allSites = $db->query("SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type, COALESCE(is_active, TRUE) as is_active, COALESCE(is_counted, TRUE) as is_counted FROM site_regional")->fetchAll(PDO::FETCH_ASSOC);

            $sites = [];
            foreach ($allSites as $s) {
                $sc = strtoupper(trim($s['sitecode'] ?? ''));
                $effType = $effectiveMap[$sc] ?? 'monthly';

                // If site is inactive or not counted, do not include in summary calculations
                if ($effType === 'inactive' || empty($s['is_active']) || empty($s['is_counted'])) {
                    continue;
                }

                $isPmd = (strtoupper(trim($s['dept'] ?? '')) === 'PMD');
                $info = trim($s['info'] ?? '');

                if ($type === 'quarterly') {
                    if (!$isPmd && $effType === 'quarterly') {
                        if ($category === 'outlet_subarep') {
                            if (in_array($info, ['Subarep', 'Outlet']) || $info === '') {
                                $sites[] = $s;
                            }
                        } elseif ($category === 'warehouse_hub') {
                            if (in_array($info, ['Under Warehouse', 'HUB'])) {
                                $sites[] = $s;
                            }
                        } else {
                            $sites[] = $s;
                        }
                    }
                } else {
                    if ($isPmd || $effType === 'monthly') {
                        $sites[] = $s;
                    }
                }
            }

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
                'DNO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                'DSO'  => ['sum' => 0.0, 'count' => 0, 'total' => 0],
            ];

            // DB Analysis: Count/sum of Result DB QTY per dept & sub dept
            $deptDbStats = [
                'CRO' => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0],
                'ERO' => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0],
                'WRO' => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0],
                'PMD' => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0],
            ];
            $subDeptDbStats = [
                'CJDO' => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'CRO'],
                'EKO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'CRO'],
                'WJO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'CRO'],
                'WKO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'CRO'],
                'BNO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'ERO'],
                'EJO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'ERO'],
                'MPO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'ERO'],
                'SMO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'ERO'],
                'CSO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'WRO'],
                'NSO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'WRO'],
                'SSO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'WRO'],
                'DNO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'PMD'],
                'DSO'  => ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => 'PMD'],
            ];

            $nationalSum = 0.0;
            $nationalCount = 0;
            $nationalDbQty = 0;
            $totalNationalSites = count($sites);

            foreach ($sites as $s) {
                $sc = strtoupper(trim($s['sitecode'] ?? ''));
                $dept = strtoupper(trim($s['dept'] ?? ''));
                $sub = strtoupper(trim($s['sub_dept'] ?? ''));
                if (isset($deptStats[$dept])) {
                    $deptStats[$dept]['total']++;
                    $deptDbStats[$dept]['total']++;
                }
                if ($sub !== '') {
                    if (!isset($subDeptStats[$sub])) {
                        $subDeptStats[$sub] = ['sum' => 0.0, 'count' => 0, 'total' => 0];
                    }
                    $subDeptStats[$sub]['total']++;
                    if (!isset($subDeptDbStats[$sub])) {
                        $subDeptDbStats[$sub] = ['qty' => 0, 'sites_with_qty' => 0, 'count' => 0, 'total' => 0, 'dept' => $dept];
                    }
                    $subDeptDbStats[$sub]['total']++;
                }

                $match = null;
                if ($sc !== '') {
                    if (isset($recByCode[$sc])) {
                        $match = $recByCode[$sc];
                    } else {
                        $matchedRows = [];
                        foreach ($recList as $item) {
                            if (
                                stripos($item['profile'], " - {$sc} - ") !== false ||
                                stripos($item['profile'], "- {$sc} -") !== false ||
                                stripos($item['profile'], " {$sc} ") !== false ||
                                stripos($item['profile'], $sc) !== false
                            ) {
                                $matchedRows[] = $item;
                            }
                        }
                        if (!empty($matchedRows)) {
                            $sumPct = 0.0;
                            $sumDb = 0;
                            foreach ($matchedRows as $mr) {
                                $sumPct += (float) $mr['pct'];
                                $sumDb += (int) $mr['db_qty'];
                            }
                            $match = [
                                'pct' => $sumPct / count($matchedRows),
                                'db_qty' => $sumDb,
                            ];
                            $recByCode[$sc] = $match;
                        }
                    }
                }

                $pct = $match !== null ? $match['pct'] : null;
                $dbQty = $match !== null ? (int) $match['db_qty'] : null;

                if ($pct !== null) {
                    $nationalSum += $pct;
                    $nationalCount++;
                    if (isset($deptStats[$dept])) {
                        $deptStats[$dept]['sum'] += $pct;
                        $deptStats[$dept]['count']++;
                    }
                    if ($sub !== '' && isset($subDeptStats[$sub])) {
                        $subDeptStats[$sub]['sum'] += $pct;
                        $subDeptStats[$sub]['count']++;
                    }
                }

                if ($dbQty !== null) {
                    $nationalDbQty += $dbQty;
                    if (isset($deptDbStats[$dept])) {
                        $deptDbStats[$dept]['qty'] += $dbQty;
                        $deptDbStats[$dept]['count']++;
                        if ($dbQty > 0) $deptDbStats[$dept]['sites_with_qty']++;
                    }
                    if ($sub !== '' && isset($subDeptDbStats[$sub])) {
                        $subDeptDbStats[$sub]['qty'] += $dbQty;
                        $subDeptDbStats[$sub]['count']++;
                        if ($dbQty > 0) $subDeptDbStats[$sub]['sites_with_qty']++;
                    }
                }
            }

            $outletCount = $deptStats['CRO']['count'] + $deptStats['ERO']['count'] + $deptStats['WRO']['count'];
            $outletSum = $deptStats['CRO']['sum'] + $deptStats['ERO']['sum'] + $deptStats['WRO']['sum'];
            $totalOutletSites = $deptStats['CRO']['total'] + $deptStats['ERO']['total'] + $deptStats['WRO']['total'];

            $outletDbQty = $deptDbStats['CRO']['qty'] + $deptDbStats['ERO']['qty'] + $deptDbStats['WRO']['qty'];
            $outletDbSitesWithQty = $deptDbStats['CRO']['sites_with_qty'] + $deptDbStats['ERO']['sites_with_qty'] + $deptDbStats['WRO']['sites_with_qty'];
            $outletDbCount = $deptDbStats['CRO']['count'] + $deptDbStats['ERO']['count'] + $deptDbStats['WRO']['count'];

            $compiledSubDepts = [];
            foreach ($subDeptStats as $sCode => $sData) {
                $compiledSubDepts[strtolower($sCode)] = [
                    'pct' => $sData['count'] > 0 ? round($sData['sum'] / $sData['count']) : 0,
                    'count' => $sData['count'],
                    'total_sites' => $sData['total'],
                ];
            }

            $compiledSubDeptDb = [];
            foreach ($subDeptDbStats as $sCode => $sData) {
                $compiledSubDeptDb[strtolower($sCode)] = [
                    'qty' => $sData['qty'],
                    'sites_with_qty' => $sData['sites_with_qty'],
                    'count' => $sData['count'],
                    'total_sites' => $sData['total'],
                    'dept' => $sData['dept'],
                ];
            }

            $dbAnalysis = [
                'national' => [
                    'qty' => $nationalDbQty,
                    'count' => $nationalCount,
                    'total_sites' => $totalNationalSites,
                ],
                'outlet_national' => [
                    'qty' => $outletDbQty,
                    'sites_with_qty' => $outletDbSitesWithQty,
                    'count' => $outletDbCount,
                    'total_sites' => $totalOutletSites,
                ],
                'cro' => [
                    'name' => 'CRO',
                    'qty' => $deptDbStats['CRO']['qty'],
                    'sites_with_qty' => $deptDbStats['CRO']['sites_with_qty'],
                    'count' => $deptDbStats['CRO']['count'],
                    'total_sites' => $deptDbStats['CRO']['total'],
                ],
                'ero' => [
                    'name' => 'ERO',
                    'qty' => $deptDbStats['ERO']['qty'],
                    'sites_with_qty' => $deptDbStats['ERO']['sites_with_qty'],
                    'count' => $deptDbStats['ERO']['count'],
                    'total_sites' => $deptDbStats['ERO']['total'],
                ],
                'wro' => [
                    'name' => 'WRO',
                    'qty' => $deptDbStats['WRO']['qty'],
                    'sites_with_qty' => $deptDbStats['WRO']['sites_with_qty'],
                    'count' => $deptDbStats['WRO']['count'],
                    'total_sites' => $deptDbStats['WRO']['total'],
                ],
                'pmd' => [
                    'name' => 'PMD',
                    'qty' => $deptDbStats['PMD']['qty'],
                    'sites_with_qty' => $deptDbStats['PMD']['sites_with_qty'],
                    'count' => $deptDbStats['PMD']['count'],
                    'total_sites' => $deptDbStats['PMD']['total'],
                ],
                'dno' => [
                    'name' => 'DNO',
                    'qty' => $subDeptDbStats['DNO']['qty'],
                    'sites_with_qty' => $subDeptDbStats['DNO']['sites_with_qty'],
                    'count' => $subDeptDbStats['DNO']['count'],
                    'total_sites' => $subDeptDbStats['DNO']['total'],
                ],
                'dso' => [
                    'name' => 'DSO',
                    'qty' => $subDeptDbStats['DSO']['qty'],
                    'sites_with_qty' => $subDeptDbStats['DSO']['sites_with_qty'],
                    'count' => $subDeptDbStats['DSO']['count'],
                    'total_sites' => $subDeptDbStats['DSO']['total'],
                ],
                'sub_depts' => $compiledSubDeptDb,
            ];

            return [
                'national' => [
                    'pct' => $nationalCount > 0 ? round($nationalSum / $nationalCount) : 0,
                    'count' => $nationalCount,
                    'total_sites' => $totalNationalSites,
                ],
                'outlet_national' => [
                    'pct' => $outletCount > 0 ? round($outletSum / $outletCount) : 0,
                    'count' => $outletCount,
                    'total_sites' => $totalOutletSites,
                ],
                'cro' => [
                    'pct' => $deptStats['CRO']['count'] > 0 ? round($deptStats['CRO']['sum'] / $deptStats['CRO']['count']) : 0,
                    'count' => $deptStats['CRO']['count'],
                    'total_sites' => $deptStats['CRO']['total'],
                ],
                'ero' => [
                    'pct' => $deptStats['ERO']['count'] > 0 ? round($deptStats['ERO']['sum'] / $deptStats['ERO']['count']) : 0,
                    'count' => $deptStats['ERO']['count'],
                    'total_sites' => $deptStats['ERO']['total'],
                ],
                'wro' => [
                    'pct' => $deptStats['WRO']['count'] > 0 ? round($deptStats['WRO']['sum'] / $deptStats['WRO']['count']) : 0,
                    'count' => $deptStats['WRO']['count'],
                    'total_sites' => $deptStats['WRO']['total'],
                ],
                'pmd' => [
                    'pct' => $deptStats['PMD']['count'] > 0 ? round($deptStats['PMD']['sum'] / $deptStats['PMD']['count']) : 0,
                    'count' => $deptStats['PMD']['count'],
                    'total_sites' => $deptStats['PMD']['total'],
                ],
                'dno' => [
                    'pct' => $subDeptStats['DNO']['count'] > 0 ? round($subDeptStats['DNO']['sum'] / $subDeptStats['DNO']['count']) : 0,
                    'count' => $subDeptStats['DNO']['count'],
                    'total_sites' => $subDeptStats['DNO']['total'],
                ],
                'dso' => [
                    'pct' => $subDeptStats['DSO']['count'] > 0 ? round($subDeptStats['DSO']['sum'] / $subDeptStats['DSO']['count']) : 0,
                    'count' => $subDeptStats['DSO']['count'],
                    'total_sites' => $subDeptStats['DSO']['total'],
                ],
                'sub_depts' => $compiledSubDepts,
                'db_analysis' => $dbAnalysis,
            ];
        };

        // Filtered totals for summary overview
        $filterWhere = [];
        $filterParams = [];
        if ($month) {
            $filterWhere[] = 'period_month = :fm';
            $filterParams[':fm'] = $month;
        }
        if ($year) {
            $filterWhere[] = 'period_year = :fy';
            $filterParams[':fy'] = $year;
        }
        if ($soType === 'quarterly') {
            $filterWhere[] = "profile ~* '\\mQ[1-4]\\M'";
        } else {
            $filterWhere[] = "profile !~* '\\mQ[1-4]\\M'";
        }
        $filterSql = !empty($filterWhere) ? 'WHERE ' . implode(' AND ', $filterWhere) : '';

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
            FROM asset_reconciliation
            $filterSql
        ");
        $totalsStmt->execute($filterParams);
        $totals = $totalsStmt->fetch(PDO::FETCH_ASSOC);

        $achievements = $getAchievements($db, $month, $year, $srCategories, $soType, $category);

        // Query the latest uploaded period in asset_reconciliation
        $latestWhere = ($soType === 'quarterly')
            ? "AND profile ~* '\\mQ[1-4]\\M'"
            : "AND profile !~* '\\mQ[1-4]\\M'";
        $latestStmt = $db->query("
            SELECT period_month, period_year 
            FROM asset_reconciliation 
            WHERE period_year IS NOT NULL AND period_month IS NOT NULL $latestWhere
            ORDER BY period_year DESC, period_month DESC, id DESC 
            LIMIT 1
        ");
        $latestPeriod = $latestStmt->fetch(PDO::FETCH_ASSOC);

        // Previous period comparison for DB Analysis (Result DB QTY)
        $effY = $year ?: ($latestPeriod['period_year'] ?? (int) date('Y'));

        $prevPeriod = null;
        if ($month) {
            // Specific month selected: compare with previous available month
            $prevStmt = $db->prepare("
                SELECT period_month, period_year 
                FROM asset_reconciliation 
                WHERE (period_year < :y OR (period_year = :y AND period_month < :m))
                  AND period_year IS NOT NULL AND period_month IS NOT NULL $latestWhere
                ORDER BY period_year DESC, period_month DESC, id DESC 
                LIMIT 1
            ");
            $prevStmt->execute([':y' => (int) $effY, ':m' => (int) $month]);
            $prevPeriod = $prevStmt->fetch(PDO::FETCH_ASSOC);
        } else {
            // "Semua Bulan" selected: compare cumulative year against previous year (Tahun Lalu)
            $prevStmt = $db->prepare("
                SELECT DISTINCT period_year, NULL as period_month 
                FROM asset_reconciliation 
                WHERE period_year < :y
                  AND period_year IS NOT NULL $latestWhere
                ORDER BY period_year DESC 
                LIMIT 1
            ");
            $prevStmt->execute([':y' => (int) $effY]);
            $prevPeriod = $prevStmt->fetch(PDO::FETCH_ASSOC);
        }

        if ($prevPeriod) {
            $prevM = !empty($prevPeriod['period_month']) ? (int) $prevPeriod['period_month'] : null;
            $prevY = (int) $prevPeriod['period_year'];
            $prevAchievements = $getAchievements($db, $prevM, $prevY, $srCategories, $soType, $category);
            $prevDbAnalysis = $prevAchievements['db_analysis'] ?? null;

            if ($prevDbAnalysis && isset($achievements['db_analysis'])) {
                $dbA = &$achievements['db_analysis'];
                $dbA['has_previous'] = true;
                $dbA['previous_period'] = [
                    'month' => $prevM,
                    'year' => $prevY,
                ];

                $deptKeys = ['national', 'outlet_national', 'cro', 'ero', 'wro', 'pmd', 'dno', 'dso'];
                foreach ($deptKeys as $dk) {
                    if (isset($dbA[$dk])) {
                        $currQty = (int) ($dbA[$dk]['qty'] ?? 0);
                        $prevQty = (int) ($prevDbAnalysis[$dk]['qty'] ?? 0);
                        $dbA[$dk]['prev_qty'] = $prevQty;
                        $dbA[$dk]['diff_qty'] = $currQty - $prevQty;
                    }
                }

                if (isset($dbA['sub_depts']) && is_array($dbA['sub_depts'])) {
                    foreach ($dbA['sub_depts'] as $sKey => &$sVal) {
                        $currQty = (int) ($sVal['qty'] ?? 0);
                        $prevQty = (int) ($prevDbAnalysis['sub_depts'][$sKey]['qty'] ?? 0);
                        $sVal['prev_qty'] = $prevQty;
                        $sVal['diff_qty'] = $currQty - $prevQty;
                    }
                    unset($sVal);
                }
                unset($dbA);
            }
        } else if (isset($achievements['db_analysis'])) {
            $achievements['db_analysis']['has_previous'] = false;
        }

        // If summary action requested, return without fetching all rows
        if ($action === 'summary') {
            echo json_encode([
                'success' => true,
                'so_type' => $soType,
                'month' => $month,
                'year' => $year,
                'latest_period' => $latestPeriod ?: null,
                'totals' => $totals,
                'achievements' => $achievements,
                'db_analysis' => $achievements['db_analysis'] ?? null,
            ]);
            exit;
        }

        // Sub department results for "Report SO Outlet Regional" table
        if ($action === 'subdept_results') {
            $dept = trim($_GET['dept'] ?? '');
            $subDept = trim($_GET['sub_dept'] ?? '');

            $category = trim($_GET['category'] ?? '');

            // 1. Get sites for this dept and/or sub_dept
            $where = [];
            $params = [];
            if ($category === 'outlet' || $category === 'outlet_regional') {
                $where[] = "dept != 'PMD'";
            } elseif ($category === 'outlet_subarep') {
                $where[] = "dept != 'PMD' AND (info IN ('Subarep', 'Outlet') OR info IS NULL)";
            } elseif ($category === 'warehouse_hub') {
                $where[] = "dept != 'PMD' AND info IN ('Under Warehouse', 'HUB')";
            } elseif ($category === 'pmd') {
                $where[] = "dept = 'PMD'";
            }
            if (!empty($dept) && strtolower($dept) !== 'all') {
                $where[] = "dept = :dept";
                $params[':dept'] = $dept;
            }
            if (!empty($subDept) && strtolower($subDept) !== 'all') {
                $where[] = "sub_dept = :sub_dept";
                $params[':sub_dept'] = $subDept;
            }
            $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

            $siteStmt = $db->prepare("
                SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type,
                       COALESCE(is_active, TRUE) as is_active, COALESCE(is_counted, TRUE) as is_counted
                FROM site_regional
                $whereSql
                ORDER BY dept ASC, sub_dept ASC, sitecode ASC
            ");
            $siteStmt->execute($params);
            $rawSites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

            // Filter sites dynamically by effective group type for the period
            $effectiveMap = $getEffectiveTypes($db, $year, $month);
            $sites = [];
            foreach ($rawSites as $s) {
                $sc = strtoupper(trim($s['sitecode'] ?? ''));
                $eff = $effectiveMap[$sc] ?? 'monthly';

                // Skip inactive or uncounted sites
                if ($eff === 'inactive' || empty($s['is_active']) || empty($s['is_counted'])) {
                    continue;
                }

                $isPmd = (strtoupper(trim($s['dept'] ?? '')) === 'PMD');
                if ($soType === 'quarterly') {
                    if (!$isPmd && $eff === 'quarterly') {
                        $sites[] = $s;
                    }
                } else {
                    if ($isPmd || $eff === 'monthly') {
                        $sites[] = $s;
                    }
                }
            }

            // 2. Get reconciliation records for this month and year
            $recWhere = [];
            $recParams = [];
            if ($year) {
                $recWhere[] = 'period_year = :ry';
                $recParams[':ry'] = $year;
            }
            if ($month) {
                $recWhere[] = 'period_month = :rm';
                $recParams[':rm'] = $month;
            }
            if ($soType === 'quarterly') {
                $recWhere[] = "profile ~* '\\mQ[1-4]\\M'";
            } else {
                $recWhere[] = "profile !~* '\\mQ[1-4]\\M'";
            }
            $recWhereSql = !empty($recWhere) ? 'WHERE ' . implode(' AND ', $recWhere) : '';

            $recStmt = $db->prepare("
                SELECT 
                    id, profile, period_month, period_year,
                    match_physic_qty, physic_physic_qty, db_physic_qty,
                    total_physic_actual, total_physic_target, total_physic_pct
                FROM asset_reconciliation
                $recWhereSql
                ORDER BY id ASC
            ");
            $recStmt->execute($recParams);
            $recRows = $recStmt->fetchAll(PDO::FETCH_ASSOC);

            // Index reconciliation records by token / profile
            $recByCode = [];
            $recList = [];
            foreach ($recRows as $r) {
                $profile = trim($r['profile'] ?? '');
                $recList[] = $r;
                $parts = explode('-', $profile);
                foreach ($parts as $p) {
                    $token = strtoupper(trim($p));
                    if ($token !== '') {
                        $recByCode[$token][] = $r;
                    }
                }
            }

            $results = [];
            $totalPctSum = 0;
            $countWithData = 0;
            $totalMatchQty = 0;
            $totalPhysicQty = 0;
            $totalDbQty = 0;

            foreach ($sites as $s) {
                $sitecode = trim($s['sitecode'] ?? '');
                $upperCode = strtoupper($sitecode);
                $matchedRecs = [];

                if ($sitecode !== '') {
                    if (isset($recByCode[$upperCode])) {
                        $matchedRecs = $recByCode[$upperCode];
                    } else {
                        foreach ($recList as $item) {
                            if (
                                stripos($item['profile'], " - {$sitecode} - ") !== false ||
                                stripos($item['profile'], "- {$sitecode} -") !== false ||
                                stripos($item['profile'], " {$sitecode} ") !== false ||
                                stripos($item['profile'], $sitecode) !== false
                            ) {
                                $matchedRecs[] = $item;
                            }
                        }
                        if (!empty($matchedRecs)) {
                            $recByCode[$upperCode] = $matchedRecs;
                        }
                    }
                }

                $matchQty = 0;
                $physicQty = 0;
                $dbQty = 0;
                $actual = 0;
                $target = 0;
                $pct = null;
                $hasData = !empty($matchedRecs);

                if ($hasData) {
                    if (empty($month)) {
                        // Semua Bulan: akumulasi match, physic, db, actual, target dari seluruh bulan dalam tahun ini
                        foreach ($matchedRecs as $rec) {
                            $matchQty += (int) $rec['match_physic_qty'];
                            $physicQty += (int) $rec['physic_physic_qty'];
                            $dbQty += (int) $rec['db_physic_qty'];
                            $actual += (int) $rec['total_physic_actual'];
                            $target += (int) $rec['total_physic_target'];
                        }
                        if ($target > 0) {
                            $pct = ($actual / $target) * 100.0;
                        } elseif ($actual > 0) {
                            $pct = 100.0;
                        } else {
                            $pct = 0.0;
                        }
                    } else {
                        // Bulan tertentu: ambil record bulan tersebut
                        $rec = $matchedRecs[0];
                        $matchQty = (int) $rec['match_physic_qty'];
                        $physicQty = (int) $rec['physic_physic_qty'];
                        $dbQty = (int) $rec['db_physic_qty'];
                        $actual = (int) $rec['total_physic_actual'];
                        $target = (int) $rec['total_physic_target'];
                        $pct = $rec['total_physic_pct'] !== null ? (float) $rec['total_physic_pct'] : null;
                    }
                }

                if ($hasData && $pct !== null) {
                    $totalPctSum += $pct;
                    $countWithData++;
                }

                $totalMatchQty += $matchQty;
                $totalPhysicQty += $physicQty;
                $totalDbQty += $dbQty;

                // Thresholds:
                // For PMD: >= 98%: Tercapai (green), < 98%: Tidak Tercapai (red)
                // For Others: >= 85%: Tercapai (green), 75%-85%: Tidak Tercapai (orange), < 75%: Tidak Tercapai (red)
                $isPmdItem = (strtoupper($s['dept'] ?? '') === 'PMD' || strtoupper($dept) === 'PMD');
                $statusText = 'Belum Ada Data';
                $statusClass = 'none';
                if ($pct !== null) {
                    $evalPct = (float) round($pct);
                    if ($isPmdItem) {
                        if ($evalPct >= 98.0) {
                            $statusText = 'Tercapai';
                            $statusClass = 'green';
                        } else {
                            $statusText = 'Tidak Tercapai';
                            $statusClass = 'red';
                        }
                    } else {
                        if ($evalPct >= 85.0) {
                            $statusText = 'Tercapai';
                            $statusClass = 'green';
                        } elseif ($evalPct >= 75.0) {
                            $statusText = 'Tidak Tercapai';
                            $statusClass = 'orange';
                        } else {
                            $statusText = 'Tidak Tercapai';
                            $statusClass = 'red';
                        }
                    }
                }

                $results[] = [
                    'sitecode' => $sitecode,
                    'name_site' => $s['name_site'] ?? '',
                    'dept' => $s['dept'] ?? '',
                    'sub_dept' => $s['sub_dept'] ?? '',
                    'match_physic_qty' => $matchQty,
                    'physic_physic_qty' => $physicQty,
                    'db_physic_qty' => $dbQty,
                    'total_physic_actual' => $actual,
                    'total_physic_target' => $target,
                    'total_physic_pct' => $pct !== null ? round($pct) : null,
                    'status' => $statusText,
                    'status_class' => $statusClass,
                    'has_data' => $hasData,
                ];
            }

            $avgPct = $countWithData > 0 ? round($totalPctSum / $countWithData) : 0;
            $overallStatus = 'none';
            $overallStatusText = 'Belum Ada Data';
            $isPmdOverall = (strtoupper($dept) === 'PMD');
            if ($countWithData > 0) {
                if ($isPmdOverall) {
                    if ($avgPct >= 98.0) {
                        $overallStatus = 'green';
                        $overallStatusText = 'Tercapai';
                    } else {
                        $overallStatus = 'red';
                        $overallStatusText = 'Tidak Tercapai';
                    }
                } else {
                    if ($avgPct >= 85.0) {
                        $overallStatus = 'green';
                        $overallStatusText = 'Tercapai';
                    } elseif ($avgPct >= 75.0) {
                        $overallStatus = 'orange';
                        $overallStatusText = 'Tidak Tercapai';
                    } else {
                        $overallStatus = 'red';
                        $overallStatusText = 'Tidak Tercapai';
                    }
                }
            }

            echo json_encode([
                'success' => true,
                'dept' => $dept,
                'sub_dept' => $subDept,
                'month' => $month,
                'year' => $year,
                'total_sites' => count($results),
                'count_with_data' => $countWithData,
                'total_match_qty' => $totalMatchQty,
                'total_physic_qty' => $totalPhysicQty,
                'total_db_qty' => $totalDbQty,
                'avg_pct' => $avgPct,
                'overall_status' => $overallStatus,
                'overall_status_text' => $overallStatusText,
                'data' => $results,
            ]);
            exit;
        }

        // Full fetch for Master Data page
        $stmt = $db->query('
            SELECT 
                id,
                profile,
                TO_CHAR(period_start, \'YYYY-MM-DD\') as period_start,
                TO_CHAR(period_end, \'YYYY-MM-DD\') as period_end,
                COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) as period_month,
                COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) as period_year,
                period_id,
                match_physic_qty, match_physic_pct, match_nbv_value, match_nbv_pct,
                physic_physic_qty, physic_physic_pct, physic_nbv_value, physic_nbv_pct,
                db_physic_qty, db_physic_pct, db_nbv_value, db_nbv_pct,
                total_physic_actual, total_physic_target, total_physic_pct,
                total_nbv_actual, total_nbv_target, total_nbv_pct
            FROM asset_reconciliation
            ORDER BY period_start DESC, id ASC
        ');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Parse Site Code and Name Site from profile string
        foreach ($rows as &$row) {
            $profile = trim($row['profile'] ?? '');
            $parts = explode(' - ', $profile);
            $siteCode = '';
            $siteName = '';

            if (count($parts) >= 2) {
                $siteCode = trim($parts[1]);
                if (count($parts) >= 4 && stripos($parts[2], 'LINTASARTA') !== false) {
                    $siteName = trim(implode(' - ', array_slice($parts, 3)));
                } elseif (count($parts) >= 3) {
                    $siteName = trim(implode(' - ', array_slice($parts, 2)));
                } else {
                    $siteName = $siteCode;
                }
            } else {
                $siteCode = $profile;
                $siteName = $profile;
            }

            $row['site_code'] = $siteCode;
            $row['site_name'] = $siteName;
        }
        unset($row);

        echo json_encode([
            'success' => true,
            'data' => $rows,
            'totals' => $totals,
            'achievements' => $achievements,
            'total' => count($rows),
        ]);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        if (!$payload || empty($payload['profile']) || empty($payload['period_start']) || empty($payload['period_end'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Profile, period_start, and period_end are required']);
            exit;
        }

        $stmt = $db->prepare('
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
            ) RETURNING id
        ');

        $stmt->execute([
            ':profile' => $payload['profile'],
            ':period_start' => $payload['period_start'],
            ':period_end' => $payload['period_end'],
            ':match_physic_qty' => $payload['match_physic_qty'] ?? 0,
            ':match_physic_pct' => $payload['match_physic_pct'] ?? 0,
            ':match_nbv_value' => $payload['match_nbv_value'] ?? 0,
            ':match_nbv_pct' => $payload['match_nbv_pct'] ?? 0,
            ':physic_physic_qty' => $payload['physic_physic_qty'] ?? 0,
            ':physic_physic_pct' => $payload['physic_physic_pct'] ?? 0,
            ':physic_nbv_value' => $payload['physic_nbv_value'] ?? 0,
            ':physic_nbv_pct' => $payload['physic_nbv_pct'] ?? 0,
            ':db_physic_qty' => $payload['db_physic_qty'] ?? 0,
            ':db_physic_pct' => $payload['db_physic_pct'] ?? 0,
            ':db_nbv_value' => $payload['db_nbv_value'] ?? 0,
            ':db_nbv_pct' => $payload['db_nbv_pct'] ?? 0,
            ':total_physic_actual' => $payload['total_physic_actual'] ?? 0,
            ':total_physic_target' => $payload['total_physic_target'] ?? 0,
            ':total_physic_pct' => $payload['total_physic_pct'] ?? 0,
            ':total_nbv_actual' => $payload['total_nbv_actual'] ?? 0,
            ':total_nbv_target' => $payload['total_nbv_target'] ?? 0,
            ':total_nbv_pct' => $payload['total_nbv_pct'] ?? 0,
        ]);

        $newId = $stmt->fetchColumn();

        echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Record created successfully']);
        exit;
    }

    if ($method === 'DELETE') {
        // CSRF check
        session_start();
        $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (empty($csrfHeader) || !hash_equals($_SESSION['csrf_token'] ?? '', $csrfHeader)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
            exit;
        }

        $id = $_GET['id'] ?? null;
        $action = $_GET['action'] ?? '';

        if ($action === 'clear_all' || $id === 'all') {
            $db->exec('TRUNCATE TABLE asset_reconciliation RESTART IDENTITY');
            echo json_encode(['success' => true, 'message' => 'All reconciliation records cleared successfully']);
            exit;
        }

        if ($action === 'bulk_delete') {
            $month = isset($_GET['month']) && is_numeric($_GET['month']) ? (int) $_GET['month'] : 0;
            $year = isset($_GET['year']) && is_numeric($_GET['year']) ? (int) $_GET['year'] : 0;

            if ($month <= 0 && $year <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Please select a valid Month or Year to delete']);
                exit;
            }

            $conditions = [];
            $params = [];

            if ($month >= 1 && $month <= 12 && $year >= 2000 && $year <= 2100) {
                $conditions[] = '((period_month = :m AND period_year = :y) OR (period_month IS NULL AND EXTRACT(MONTH FROM period_end) = :m AND EXTRACT(YEAR FROM period_end) = :y))';
                $params[':m'] = $month;
                $params[':y'] = $year;
            } elseif ($year >= 2000 && $year <= 2100) {
                $conditions[] = '(period_year = :y OR (period_year IS NULL AND EXTRACT(YEAR FROM period_end) = :y))';
                $params[':y'] = $year;
            } elseif ($month >= 1 && $month <= 12) {
                $conditions[] = '(period_month = :m OR (period_month IS NULL AND EXTRACT(MONTH FROM period_end) = :m))';
                $params[':m'] = $month;
            }

            $sql = 'DELETE FROM asset_reconciliation WHERE ' . implode(' AND ', $conditions);
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $deletedCount = $stmt->rowCount();

            echo json_encode([
                'success' => true,
                'deleted_count' => $deletedCount,
                'message' => "Successfully deleted {$deletedCount} records for the selected period."
            ]);
            exit;
        }

        if (!$id || !ctype_digit((string) $id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid record ID is required']);
            exit;
        }

        $stmt = $db->prepare('DELETE FROM asset_reconciliation WHERE id = :id');
        $stmt->execute([':id' => (int) $id]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Record deleted successfully']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Record not found']);
        }
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
