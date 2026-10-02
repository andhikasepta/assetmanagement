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
        $srCategories = ($soType === 'quarterly')
            ? "'quarterly', 'quarterly_outlet', 'quarterly_pmd'"
            : "'monthly_outlet', 'monthly_pmd'";

        // Helper function to calculate regional & national achievements
        $getAchievements = function (PDO $db, ?int $m = null, ?int $y = null, string $srCats = "'monthly_outlet', 'monthly_pmd'") {
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
            $whereSql = !empty($whereParts) ? 'WHERE ' . implode(' AND ', $whereParts) : '';

            $stmt = $db->prepare("SELECT id, profile, period_month, period_year, total_physic_pct FROM asset_reconciliation $whereSql");
            $stmt->execute($params);
            $recs = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $recByCode = [];
            $recList = [];
            foreach ($recs as $r) {
                $pct = (float) $r['total_physic_pct'];
                $recList[] = [
                    'profile' => $r['profile'],
                    'pct' => $pct,
                ];
                $parts = explode('-', $r['profile']);
                foreach ($parts as $p) {
                    $token = strtoupper(trim($p));
                    if ($token !== '' && !isset($recByCode[$token])) {
                        $recByCode[$token] = $pct;
                    }
                }
            }

            $sites = $db->query("SELECT id, category, regional, dept, sub_dept, sitecode, name_site FROM site_regional WHERE category IN ($srCats)")->fetchAll(PDO::FETCH_ASSOC);

            $deptStats = [
                'CRO' => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                'ERO' => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                'WRO' => ['sum' => 0.0, 'count' => 0, 'total' => 0],
                'PMD' => ['sum' => 0.0, 'count' => 0, 'total' => 0],
            ];
            $nationalSum = 0.0;
            $nationalCount = 0;
            $totalNationalSites = count($sites);

            foreach ($sites as $s) {
                $sc = strtoupper(trim($s['sitecode'] ?? ''));
                $dept = strtoupper(trim($s['dept'] ?? ''));
                if (isset($deptStats[$dept])) {
                    $deptStats[$dept]['total']++;
                }

                $pct = null;
                if ($sc !== '') {
                    if (isset($recByCode[$sc])) {
                        $pct = $recByCode[$sc];
                    } else {
                        foreach ($recList as $item) {
                            if (
                                stripos($item['profile'], " - {$sc} - ") !== false ||
                                stripos($item['profile'], "- {$sc} -") !== false ||
                                stripos($item['profile'], " {$sc} ") !== false ||
                                stripos($item['profile'], $sc) !== false
                            ) {
                                $pct = $item['pct'];
                                $recByCode[$sc] = $pct;
                                break;
                            }
                        }
                    }
                }

                if ($pct !== null) {
                    $nationalSum += $pct;
                    $nationalCount++;
                    if (isset($deptStats[$dept])) {
                        $deptStats[$dept]['sum'] += $pct;
                        $deptStats[$dept]['count']++;
                    }
                }
            }

            return [
                'national' => [
                    'pct' => $nationalCount > 0 ? round($nationalSum / $nationalCount, 2) : 0.0,
                    'count' => $nationalCount,
                    'total_sites' => $totalNationalSites,
                ],
                'cro' => [
                    'pct' => $deptStats['CRO']['count'] > 0 ? round($deptStats['CRO']['sum'] / $deptStats['CRO']['count'], 2) : 0.0,
                    'count' => $deptStats['CRO']['count'],
                    'total_sites' => $deptStats['CRO']['total'],
                ],
                'ero' => [
                    'pct' => $deptStats['ERO']['count'] > 0 ? round($deptStats['ERO']['sum'] / $deptStats['ERO']['count'], 2) : 0.0,
                    'count' => $deptStats['ERO']['count'],
                    'total_sites' => $deptStats['ERO']['total'],
                ],
                'wro' => [
                    'pct' => $deptStats['WRO']['count'] > 0 ? round($deptStats['WRO']['sum'] / $deptStats['WRO']['count'], 2) : 0.0,
                    'count' => $deptStats['WRO']['count'],
                    'total_sites' => $deptStats['WRO']['total'],
                ],
                'pmd' => [
                    'pct' => $deptStats['PMD']['count'] > 0 ? round($deptStats['PMD']['sum'] / $deptStats['PMD']['count'], 2) : 0.0,
                    'count' => $deptStats['PMD']['count'],
                    'total_sites' => $deptStats['PMD']['total'],
                ],
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

        $achievements = $getAchievements($db, $month, $year, $srCategories);

        // If summary action requested, return without fetching all rows
        if ($action === 'summary') {
            echo json_encode([
                'success' => true,
                'so_type' => $soType,
                'month' => $month,
                'year' => $year,
                'totals' => $totals,
                'achievements' => $achievements,
            ]);
            exit;
        }

        // Sub department results for "Chart Hasil SO Outlet Regional" table
        if ($action === 'subdept_results') {
            $dept = trim($_GET['dept'] ?? '');
            $subDept = trim($_GET['sub_dept'] ?? '');

            // 1. Get sites for this dept and/or sub_dept
            $where = ["category IN ($srCategories)"];
            $params = [];
            if (!empty($dept) && strtolower($dept) !== 'all') {
                $where[] = "dept = :dept";
                $params[':dept'] = $dept;
            }
            if (!empty($subDept) && strtolower($subDept) !== 'all') {
                $where[] = "sub_dept = :sub_dept";
                $params[':sub_dept'] = $subDept;
            }
            $whereSql = 'WHERE ' . implode(' AND ', $where);

            $siteStmt = $db->prepare("
                SELECT id, category, regional, dept, sub_dept, sitecode, name_site
                FROM site_regional
                $whereSql
                ORDER BY dept ASC, sub_dept ASC, sitecode ASC
            ");
            $siteStmt->execute($params);
            $sites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

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
                    if ($token !== '' && !isset($recByCode[$token])) {
                        $recByCode[$token] = $r;
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
                $matchedRec = null;

                if ($sitecode !== '') {
                    if (isset($recByCode[$upperCode])) {
                        $matchedRec = $recByCode[$upperCode];
                    } else {
                        foreach ($recList as $item) {
                            if (
                                stripos($item['profile'], " - {$sitecode} - ") !== false ||
                                stripos($item['profile'], "- {$sitecode} -") !== false ||
                                stripos($item['profile'], " {$sitecode} ") !== false ||
                                stripos($item['profile'], $sitecode) !== false
                            ) {
                                $matchedRec = $item;
                                $recByCode[$upperCode] = $item;
                                break;
                            }
                        }
                    }
                }

                $matchQty = $matchedRec ? (int)$matchedRec['match_physic_qty'] : 0;
                $physicQty = $matchedRec ? (int)$matchedRec['physic_physic_qty'] : 0;
                $dbQty = $matchedRec ? (int)$matchedRec['db_physic_qty'] : 0;
                $actual = $matchedRec ? (int)$matchedRec['total_physic_actual'] : 0;
                $target = $matchedRec ? (int)$matchedRec['total_physic_target'] : 0;
                $pct = $matchedRec ? (float)$matchedRec['total_physic_pct'] : null;

                $hasData = ($matchedRec !== null);
                if ($hasData && $pct !== null) {
                    $totalPctSum += $pct;
                    $countWithData++;
                }

                $totalMatchQty += $matchQty;
                $totalPhysicQty += $physicQty;
                $totalDbQty += $dbQty;

                // Thresholds:
                // >= 85%: Tercapai (green)
                // 75% <= pct < 85%: Belum Tercapai (orange progress)
                // < 75%: Belum Tercapai (red progress)
                $statusText = 'Belum Ada Data';
                $statusClass = 'none';
                if ($pct !== null) {
                    if ($pct >= 85.0) {
                        $statusText = 'Tercapai';
                        $statusClass = 'green';
                    } elseif ($pct >= 75.0) {
                        $statusText = 'Belum Tercapai';
                        $statusClass = 'orange';
                    } else {
                        $statusText = 'Belum Tercapai';
                        $statusClass = 'red';
                    }
                }

                $results[] = [
                    'sitecode'            => $sitecode,
                    'name_site'           => $s['name_site'] ?? '',
                    'dept'                => $s['dept'] ?? '',
                    'sub_dept'            => $s['sub_dept'] ?? '',
                    'match_physic_qty'    => $matchQty,
                    'physic_physic_qty'   => $physicQty,
                    'db_physic_qty'       => $dbQty,
                    'total_physic_actual' => $actual,
                    'total_physic_target' => $target,
                    'total_physic_pct'    => $pct,
                    'status'              => $statusText,
                    'status_class'        => $statusClass,
                    'has_data'            => $hasData,
                ];
            }

            $avgPct = $countWithData > 0 ? round($totalPctSum / $countWithData, 2) : 0.0;
            $overallStatus = 'none';
            $overallStatusText = 'Belum Ada Data';
            if ($countWithData > 0) {
                if ($avgPct >= 85.0) {
                    $overallStatus = 'green';
                    $overallStatusText = 'Tercapai';
                } elseif ($avgPct >= 75.0) {
                    $overallStatus = 'orange';
                    $overallStatusText = 'Belum Tercapai';
                } else {
                    $overallStatus = 'red';
                    $overallStatusText = 'Belum Tercapai';
                }
            }

            echo json_encode([
                'success'             => true,
                'dept'                => $dept,
                'sub_dept'            => $subDept,
                'month'               => $month,
                'year'                => $year,
                'total_sites'         => count($results),
                'count_with_data'     => $countWithData,
                'total_match_qty'     => $totalMatchQty,
                'total_physic_qty'    => $totalPhysicQty,
                'total_db_qty'        => $totalDbQty,
                'avg_pct'             => $avgPct,
                'overall_status'      => $overallStatus,
                'overall_status_text' => $overallStatusText,
                'data'                => $results,
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
