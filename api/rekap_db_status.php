<?php
/**
 * Rekapitulasi Status Penyelesaian DB API
 * Compares current month vs previous month from rekap_db_master:
 * - SOLVED: Present in previous month, NULL (absent) in current month
 * - UNSOLVED: Present in both previous month and current month
 * - NEW DB: Present in current month, absent in previous month
 * 
 * CRITICAL RULE:
 * Only sitecodes that exist EXACTLY on Site Master Data (site_regional) are looked up.
 * If a sitecode is not in site_regional, it is completely ignored/excluded.
 */

require_once __DIR__ . '/../config/database.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);
ini_set('memory_limit', '1024M');
set_time_limit(180);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

try {
    $db = getDbConnection();

    $currMonth = isset($_GET['month']) && $_GET['month'] !== '' && $_GET['month'] !== 'all' ? (int)$_GET['month'] : 2;
    $currYear  = isset($_GET['year']) && $_GET['year'] !== '' && $_GET['year'] !== 'all' ? (int)$_GET['year'] : 2026;

    // Previous month calculation
    if (isset($_GET['compare_month']) && $_GET['compare_month'] !== '') {
        $prevMonth = (int)$_GET['compare_month'];
        $prevYear  = isset($_GET['compare_year']) && $_GET['compare_year'] !== '' ? (int)$_GET['compare_year'] : $currYear;
    } else {
        if ($currMonth === 1) {
            $prevMonth = 12;
            $prevYear = $currYear - 1;
        } else {
            $prevMonth = $currMonth - 1;
            $prevYear = $currYear;
        }
    }

    $category       = trim($_GET['category'] ?? 'pmd');
    $soType         = trim($_GET['so_type'] ?? 'monthly');
    $deptFilter     = trim($_GET['dept'] ?? 'all');
    $subDeptFilter  = trim($_GET['sub_dept'] ?? 'all');
    $sitecodeFilter = trim($_GET['sitecode'] ?? 'all');
    $statusFilter   = strtolower(trim($_GET['status'] ?? 'all'));
    $search         = trim($_GET['search'] ?? '');
    $viewMode       = strtolower(trim($_GET['view'] ?? 'flat')); // 'flat' (table view) or 'grouped'
    $sortCol        = trim($_GET['sort_col'] ?? '');
    $sortDir        = strtolower(trim($_GET['sort_dir'] ?? 'asc')) === 'desc' ? 'DESC' : 'ASC';

    $page       = max(1, (int)($_GET['page'] ?? 1));
    $limitParam = $_GET['limit'] ?? 10;
    $isAll      = (strtolower($limitParam) === 'all' || (int)$limitParam === -1);
    $limit      = $isAll ? 50000 : max(1, (int)$limitParam);
    $offset     = $isAll ? 0 : ($page - 1) * $limit;

    // 1. Resolve valid sites for the selected Category & SO Type from Site Master Data (site_regional)
    $isQuarterly = ($soType === 'quarterly' || in_array($category, [
        'quarterly_outlet', 'quarterly_subarep', 'quarterly_warehouse', 'quarterly_warehouse_hub'
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
                if (!$isPmd) continue;
            } else {
                // Non-PMD Outlet Regional Monthly: PMD not counted and quarterly sites not included
                if ($isPmd || $effGroup !== 'monthly') {
                    continue;
                }
            }
        }

        $s['effective_group_type'] = $effGroup;
        $categoryMasterSites[$sc] = $s;
        $validSitecodes[] = $sc;
    }

    $escapedSitecodes = array_map(function($sc) use ($db) { return $db->quote($sc); }, $validSitecodes);
    $inValidSitesSql = !empty($escapedSitecodes) ? implode(',', $escapedSitecodes) : "''";

    // Build filter options (DEPT, SUB DEPT, and SITES) strictly for this Category's Master Sites
    $availableDeptsMap = [];
    $deptSubDeptMap = [];
    $availableSitesList = [];
    foreach ($categoryMasterSites as $s) {
        $d = trim($s['dept'] ?? '');
        $sd = trim($s['sub_dept'] ?? '');
        $sc = trim($s['sitecode'] ?? '');
        $ns = trim($s['name_site'] ?? '');
        if ($d !== '') {
            $availableDeptsMap[$d] = true;
            if (!isset($deptSubDeptMap[$d])) {
                $deptSubDeptMap[$d] = [];
            }
            if ($sd !== '' && !in_array($sd, $deptSubDeptMap[$d], true)) {
                $deptSubDeptMap[$d][] = $sd;
            }
        }
        if ($sc !== '') {
            $availableSitesList[] = [
                'sitecode' => $sc,
                'name_site' => $ns,
                'dept' => $d,
                'sub_dept' => $sd,
            ];
        }
    }
    $availableDepts = array_keys($availableDeptsMap);
    sort($availableDepts);
    foreach ($deptSubDeptMap as $d => $arr) {
        sort($deptSubDeptMap[$d]);
    }
    usort($availableSitesList, function($a, $b) {
        return strcmp($a['sitecode'], $b['sitecode']);
    });

    // CTE Query strictly joining with site_regional within the valid category sitecodes
    // Any sitecode outside this category/SO type is completely filtered out!
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
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);

    // Compute total master sites in this Category for the current DEPT/SUB DEPT/SITECODE filter
    $filteredMasterSites = array_filter($categoryMasterSites, function($s) use ($deptFilter, $subDeptFilter, $sitecodeFilter) {
        if ($deptFilter !== 'all' && $deptFilter !== '' && $s['dept'] !== $deptFilter) return false;
        if ($subDeptFilter !== 'all' && $subDeptFilter !== '' && $s['sub_dept'] !== $subDeptFilter) return false;
        if ($sitecodeFilter !== 'all' && $sitecodeFilter !== '' && $s['sitecode'] !== $sitecodeFilter) return false;
        return true;
    });
    $totalMasterSites = count($filteredMasterSites);

    $stats['total_master_sites'] = $totalMasterSites;
    $stats['sites_display'] = "{$stats['total_sites']}/{$totalMasterSites} Sites";

    // Build WHERE clauses for list items (includes DEPT, SUB DEPT, SITECODE, STATUS, and SEARCH)
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

    $monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    if ($viewMode === 'grouped') {
        // 1. Count filtered distinct sites
        $countSitesSql = $sqlBase . "
            SELECT COUNT(DISTINCT cb.sitecode)
            FROM combined cb
            INNER JOIN site_regional sr ON sr.sitecode = cb.sitecode
            $whereSql
        ";
        $countSitesStmt = $db->prepare($countSitesSql);
        $countSitesStmt->execute($params);
        $filteredSiteCount = (int)$countSitesStmt->fetchColumn();

        // 2. Query paginated list of sites with aggregated status counts
        $sitesSql = $sqlBase . "
            SELECT 
                cb.sitecode,
                sr.name_site,
                sr.regional,
                sr.dept,
                sr.sub_dept,
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
            $whereSql
            GROUP BY cb.sitecode, sr.name_site, sr.regional, sr.dept, sr.sub_dept
            ORDER BY total_items DESC, cb.sitecode ASC
            LIMIT :limit OFFSET :offset
        ";

        $sitesStmt = $db->prepare($sitesSql);
        foreach ($params as $k => $v) {
            $sitesStmt->bindValue($k, $v);
        }
        $sitesStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $sitesStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $sitesStmt->execute();
        $sites = $sitesStmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch items for the sites on current page
        if (!empty($sites)) {
            $sitecodesOnPage = array_column($sites, 'sitecode');
            $inPlaceholders = implode(',', array_fill(0, count($sitecodesOnPage), '?'));

            $itemsQuery = "
                WITH prev AS (
                    SELECT DISTINCT ON (TRIM(r.reg_no)) 
                        r.sitecode, TRIM(r.reg_no) as reg_no, r.name, r.sn, r.nbv
                    FROM rekap_db_master r
                    INNER JOIN site_regional sr ON sr.sitecode = r.sitecode
                    WHERE r.period_month = ? AND r.period_year = ? AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
                    ORDER BY TRIM(r.reg_no), r.id
                ),
                curr AS (
                    SELECT DISTINCT ON (TRIM(r.reg_no)) 
                        r.sitecode, TRIM(r.reg_no) as reg_no, r.name, r.sn, r.nbv
                    FROM rekap_db_master r
                    INNER JOIN site_regional sr ON sr.sitecode = r.sitecode
                    WHERE r.period_month = ? AND r.period_year = ? AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
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
                SELECT 
                    cb.sitecode,
                    cb.reg_no,
                    cb.name,
                    cb.sn,
                    cb.nbv,
                    cb.status,
                    cb.in_prev,
                    cb.in_curr
                FROM combined cb
                WHERE cb.sitecode IN ($inPlaceholders)
            ";

            $itemParams = [$prevMonth, $prevYear, $currMonth, $currYear];
            foreach ($sitecodesOnPage as $sc) {
                $itemParams[] = $sc;
            }

            if ($statusFilter !== 'all' && in_array($statusFilter, ['solved', 'unsolved', 'new_db'], true)) {
                $itemsQuery .= " AND cb.status = ?";
                $itemParams[] = $statusFilter;
            }
            if ($search !== '') {
                $itemsQuery .= " AND (cb.reg_no ILIKE ? OR cb.name ILIKE ? OR cb.sn ILIKE ?)";
                $itemParams[] = '%' . $search . '%';
                $itemParams[] = '%' . $search . '%';
                $itemParams[] = '%' . $search . '%';
            }

            $itemsQuery .= " ORDER BY cb.sitecode ASC, cb.status ASC, cb.reg_no ASC";

            $itemStmt = $db->prepare($itemsQuery);
            $itemStmt->execute($itemParams);
            $allItems = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

            $itemsBySite = [];
            foreach ($allItems as $it) {
                $sc = $it['sitecode'];
                if (!isset($itemsBySite[$sc])) {
                    $itemsBySite[$sc] = [];
                }
                $itemsBySite[$sc][] = $it;
            }

            foreach ($sites as &$s) {
                $sc = $s['sitecode'];
                $s['items'] = $itemsBySite[$sc] ?? [];
            }
            unset($s);
        }

        echo json_encode([
            'success' => true,
            'view' => 'grouped',
            'period' => [
                'current_month' => $currMonth,
                'current_year' => $currYear,
                'current_label' => ($monthNames[$currMonth] ?? '') . " " . $currYear,
                'previous_month' => $prevMonth,
                'previous_year' => $prevYear,
                'previous_label' => ($monthNames[$prevMonth] ?? '') . " " . $prevYear,
            ],
            'stats' => $stats,
            'filter_options' => [
                'depts' => $availableDepts,
                'dept_subdept_map' => $deptSubDeptMap,
                'sites' => $availableSitesList
            ],
            'data' => $sites,
            'total_sites' => $filteredSiteCount,
            'page' => $page,
            'limit' => $limitParam,
            'total_pages' => $limit > 0 ? ceil($filteredSiteCount / $limit) : 1
        ], JSON_UNESCAPED_SLASHES);
        exit;
    }

    // Default & User Primary View: 'flat' (Table with pagination)
    $countSql = $sqlBase . "
        SELECT COUNT(*) 
        FROM combined cb
        INNER JOIN site_regional sr ON sr.sitecode = cb.sitecode
        $whereSql
    ";
    $countStmt = $db->prepare($countSql);
    $countStmt->execute($params);
    $filteredTotal = (int)$countStmt->fetchColumn();

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
        LIMIT :limit OFFSET :offset
    ";
    $dataStmt = $db->prepare($dataSql);
    foreach ($params as $k => $v) {
        $dataStmt->bindValue($k, $v);
    }
    $dataStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $dataStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $dataStmt->execute();
    $items = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'view' => 'flat',
        'period' => [
            'current_month' => $currMonth,
            'current_year' => $currYear,
            'current_label' => ($monthNames[$currMonth] ?? '') . " " . $currYear,
            'previous_month' => $prevMonth,
            'previous_year' => $prevYear,
            'previous_label' => ($monthNames[$prevMonth] ?? '') . " " . $prevYear,
        ],
        'stats' => $stats,
        'filter_options' => [
            'depts' => $availableDepts,
            'dept_subdept_map' => $deptSubDeptMap,
            'sites' => $availableSitesList
        ],
        'data' => $items,
        'total' => $filteredTotal,
        'page' => $page,
        'limit' => $limitParam,
        'total_pages' => $limit > 0 ? ceil($filteredTotal / $limit) : 1
    ], JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Terjadi kesalahan sistem: ' . $e->getMessage()
    ]);
}
