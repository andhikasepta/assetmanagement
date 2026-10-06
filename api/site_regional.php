<?php
/**
 * Site Regional API Endpoint
 * Handles CRUD operations for Site Regional master data
 * Supports dynamic Info and Group Type (Monthly, Quarterly) with period history
 */

require_once __DIR__ . '/../config/database.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);
ini_set('memory_limit', '1024M');
set_time_limit(300);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    // Ensure database table and columns exist
    $db->exec("
        CREATE TABLE IF NOT EXISTS site_regional (
            id SERIAL PRIMARY KEY,
            category VARCHAR(30) NOT NULL DEFAULT 'monthly_outlet',
            regional VARCHAR(200) DEFAULT '',
            dept VARCHAR(200) DEFAULT '',
            sub_dept VARCHAR(200) DEFAULT '',
            sitecode VARCHAR(100) DEFAULT '',
            name_site VARCHAR(255) DEFAULT '',
            info VARCHAR(50) DEFAULT 'Outlet',
            group_type VARCHAR(20) DEFAULT 'monthly',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_site_regional_category ON site_regional (category);
        CREATE INDEX IF NOT EXISTS idx_site_regional_sitecode ON site_regional (sitecode);

        ALTER TABLE site_regional ADD COLUMN IF NOT EXISTS info VARCHAR(50) DEFAULT 'Outlet';
        ALTER TABLE site_regional ADD COLUMN IF NOT EXISTS group_type VARCHAR(20) DEFAULT 'monthly';
        ALTER TABLE site_regional ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        ALTER TABLE site_regional ADD COLUMN IF NOT EXISTS is_counted BOOLEAN DEFAULT TRUE;

        CREATE TABLE IF NOT EXISTS site_group_history (
            id SERIAL PRIMARY KEY,
            sitecode VARCHAR(100) NOT NULL,
            group_type VARCHAR(20) NOT NULL,
            effective_year INTEGER NOT NULL,
            effective_month INTEGER NOT NULL,
            notes VARCHAR(255) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (sitecode, effective_year, effective_month)
        );
        CREATE INDEX IF NOT EXISTS idx_site_group_hist_sitecode ON site_group_history (sitecode);
    ");

    $action = $_GET['action'] ?? $_POST['action'] ?? '';

    // ── GET: Read Operations ─────────────────────────────────────────
    if ($method === 'GET') {
        if ($action === 'get_history') {
            $sc = trim($_GET['sitecode'] ?? '');
            if ($sc === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Sitecode required']);
                exit;
            }
            $stmt = $db->prepare("
                SELECT id, sitecode, group_type, effective_year, effective_month, notes, created_at
                FROM site_group_history
                WHERE sitecode = :sc
                ORDER BY effective_year ASC, effective_month ASC, id ASC
            ");
            $stmt->execute([':sc' => $sc]);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        if ($action === 'site_movements') {
            $year = (int)($_GET['year'] ?? 2026);
            if ($year < 2000 || $year > 2100) $year = 2026;
            $monthParam = $_GET['month'] ?? null;
            $month = ($monthParam !== null && $monthParam !== '' && is_numeric($monthParam)) ? (int)$monthParam : null;

            // Fetch all sites
            $siteStmt = $db->query("
                SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type, COALESCE(is_active, TRUE) as is_active
                FROM site_regional
                ORDER BY regional ASC, dept ASC, sub_dept ASC, sitecode ASC
            ");
            $allSites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

            $siteMap = [];
            $baseTypes = [];
            foreach ($allSites as $s) {
                $sc = strtoupper(trim($s['sitecode'] ?? ''));
                if ($sc !== '') {
                    $siteMap[$sc] = $s;
                    if (strtoupper(trim($s['dept'] ?? '')) === 'PMD') {
                        $baseTypes[$sc] = 'monthly';
                    } else {
                        $baseTypes[$sc] = strtolower(trim($s['group_type'] ?? 'monthly')) ?: 'monthly';
                    }
                }
            }

            // Helper for effective map at (y, m)
            $getEffMap = function(int $y, int $m) use ($db, $baseTypes, $siteMap) {
                $stmt = $db->prepare("
                    SELECT DISTINCT ON (sitecode) sitecode, group_type
                    FROM site_group_history
                    WHERE effective_year < :y OR (effective_year = :y AND effective_month <= :m)
                    ORDER BY sitecode, effective_year DESC, effective_month DESC
                ");
                $stmt->execute([':y' => $y, ':m' => $m]);
                $map = $baseTypes;
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                    $sc = strtoupper(trim($r['sitecode']));
                    if (isset($map[$sc])) {
                        if (isset($siteMap[$sc]) && strtoupper(trim($siteMap[$sc]['dept'] ?? '')) === 'PMD') {
                            $map[$sc] = 'monthly';
                        } else {
                            $map[$sc] = strtolower(trim($r['group_type']));
                        }
                    }
                }
                return $map;
            };

            // Preload history rules for notes and created_at
            $notesStmt = $db->prepare("
                SELECT sitecode, effective_year, effective_month, group_type, notes, created_at
                FROM site_group_history
                WHERE effective_year = :y
                ORDER BY effective_month ASC, id ASC
            ");
            $notesStmt->execute([':y' => $year]);
            $historyRules = [];
            foreach ($notesStmt->fetchAll(PDO::FETCH_ASSOC) as $hr) {
                $sc = strtoupper(trim($hr['sitecode']));
                $mKey = (int)$hr['effective_month'];
                $historyRules[$mKey][$sc] = $hr;
            }

            $monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            $monthsToAnalyze = ($month !== null && $month >= 1 && $month <= 12) ? [$month] : range(1, 12);

            $allMovements = [];
            $periodSummary = [
                'current_active' => 0,
                'prev_active' => 0,
                'active_diff' => 0,
                'current_monthly' => 0,
                'prev_monthly' => 0,
                'monthly_diff' => 0,
                'current_quarterly' => 0,
                'prev_quarterly' => 0,
                'quarterly_diff' => 0,
                'current_inactive' => 0,
                'prev_inactive' => 0,
                'inactive_diff' => 0,
                'total_movements' => 0,
            ];

            foreach ($monthsToAnalyze as $m) {
                if ($m === 1) {
                    $prevMap = $getEffMap($year - 1, 12);
                } else {
                    $prevMap = $getEffMap($year, $m - 1);
                }
                $currMap = $getEffMap($year, $m);

                // Calculate counts
                $cMonthly = 0; $cQuarterly = 0; $cInactive = 0;
                foreach ($currMap as $sc => $type) {
                    if ($type === 'inactive') $cInactive++;
                    elseif ($type === 'quarterly') $cQuarterly++;
                    else $cMonthly++;
                }
                $pMonthly = 0; $pQuarterly = 0; $pInactive = 0;
                foreach ($prevMap as $sc => $type) {
                    if ($type === 'inactive') $pInactive++;
                    elseif ($type === 'quarterly') $pQuarterly++;
                    else $pMonthly++;
                }

                if (count($monthsToAnalyze) === 1) {
                    $periodSummary['current_active'] = $cMonthly + $cQuarterly;
                    $periodSummary['prev_active'] = $pMonthly + $pQuarterly;
                    $periodSummary['active_diff'] = $periodSummary['current_active'] - $periodSummary['prev_active'];
                    $periodSummary['current_monthly'] = $cMonthly;
                    $periodSummary['prev_monthly'] = $pMonthly;
                    $periodSummary['monthly_diff'] = $cMonthly - $pMonthly;
                    $periodSummary['current_quarterly'] = $cQuarterly;
                    $periodSummary['prev_quarterly'] = $pQuarterly;
                    $periodSummary['quarterly_diff'] = $cQuarterly - $pQuarterly;
                    $periodSummary['current_inactive'] = $cInactive;
                    $periodSummary['prev_inactive'] = $pInactive;
                    $periodSummary['inactive_diff'] = $cInactive - $pInactive;
                }

                foreach ($currMap as $sc => $currType) {
                    $prevType = $prevMap[$sc] ?? 'monthly';
                    if ($currType !== $prevType) {
                        $siteInfo = $siteMap[$sc] ?? [];
                        $hr = $historyRules[$m][$sc] ?? null;

                        $movementType = 'changed';
                        $description = '';
                        if ($prevType === 'monthly' && $currType === 'quarterly') {
                            $movementType = 'monthly_to_quarterly';
                            $description = 'Beralih ke Quarterly';
                        } elseif ($prevType === 'quarterly' && $currType === 'monthly') {
                            $movementType = 'quarterly_to_monthly';
                            $description = 'Beralih ke Monthly';
                        } elseif ($currType === 'inactive') {
                            $movementType = 'became_inactive';
                            $description = 'Site Dinonaktifkan (Inactive)';
                        } elseif ($prevType === 'inactive' && $currType === 'monthly') {
                            $movementType = 'reactivated_monthly';
                            $description = 'Diaktifkan kembali (Monthly)';
                        } elseif ($prevType === 'inactive' && $currType === 'quarterly') {
                            $movementType = 'reactivated_quarterly';
                            $description = 'Diaktifkan kembali (Quarterly)';
                        }

                        $note = ($hr && !empty($hr['notes'])) ? $hr['notes'] : $description;

                        $allMovements[] = [
                            'sitecode' => (string)($siteInfo['sitecode'] ?? $sc),
                            'name_site' => (string)($siteInfo['name_site'] ?? ''),
                            'regional' => (string)($siteInfo['regional'] ?? ''),
                            'dept' => (string)($siteInfo['dept'] ?? ''),
                            'sub_dept' => (string)($siteInfo['sub_dept'] ?? ''),
                            'info' => (string)($siteInfo['info'] ?? 'Outlet'),
                            'effective_month' => (int)$m,
                            'effective_year' => (int)$year,
                            'effective_period' => ($monthNames[$m] ?? $m) . ' ' . $year,
                            'prev_status' => (string)$prevType,
                            'curr_status' => (string)$currType,
                            'movement_type' => (string)$movementType,
                            'description' => (string)$description,
                            'notes' => (string)$note,
                            'created_at' => $hr['created_at'] ?? null,
                        ];
                    }
                }
            }

            if (count($monthsToAnalyze) > 1) {
                // If all months, current represents latest (month 12) vs initial (month 1)
                $firstMap = $getEffMap($year - 1, 12);
                $latestMap = $getEffMap($year, 12);
                $fM = 0; $fQ = 0; $fIn = 0;
                foreach ($firstMap as $sc => $t) {
                    if ($t === 'inactive') $fIn++; elseif ($t === 'quarterly') $fQ++; else $fM++;
                }
                $lM = 0; $lQ = 0; $lIn = 0;
                foreach ($latestMap as $sc => $t) {
                    if ($t === 'inactive') $lIn++; elseif ($t === 'quarterly') $lQ++; else $lM++;
                }
                $periodSummary['current_active'] = $lM + $lQ;
                $periodSummary['prev_active'] = $fM + $fQ;
                $periodSummary['active_diff'] = $periodSummary['current_active'] - $periodSummary['prev_active'];
                $periodSummary['current_monthly'] = $lM;
                $periodSummary['prev_monthly'] = $fM;
                $periodSummary['monthly_diff'] = $lM - $fM;
                $periodSummary['current_quarterly'] = $lQ;
                $periodSummary['prev_quarterly'] = $fQ;
                $periodSummary['quarterly_diff'] = $lQ - $fQ;
                $periodSummary['current_inactive'] = $lIn;
                $periodSummary['prev_inactive'] = $fIn;
                $periodSummary['inactive_diff'] = $lIn - $fIn;
            }

            $periodSummary['total_movements'] = count($allMovements);

            echo json_encode([
                'success' => true,
                'period' => [
                    'year' => $year,
                    'month' => $month,
                    'month_name' => ($month ? ($monthNames[$month] ?? $month) : 'Semua Bulan'),
                    'prev_month_name' => ($month && $month > 1 ? $monthNames[$month - 1] : ($month === 1 ? 'Desember ' . ($year - 1) : '-')),
                ],
                'summary' => $periodSummary,
                'movements' => $allMovements
            ]);
            exit;
        }

        $search   = trim($_GET['search'] ?? '');
        $sortCol  = $_GET['sort'] ?? 'sitecode';
        $sortDir  = strtolower($_GET['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

        $allowedSorts = ['id', 'regional', 'dept', 'sub_dept', 'sitecode', 'name_site', 'info', 'group_type'];
        if (!in_array($sortCol, $allowedSorts, true)) {
            $sortCol = 'sitecode';
        }

        $params = [];
        $whereParts = [];

        if ($search !== '') {
            $whereParts[] = '(
                sr.regional ILIKE :s
                OR sr.dept ILIKE :s
                OR sr.sub_dept ILIKE :s
                OR sr.sitecode ILIKE :s
                OR sr.name_site ILIKE :s
                OR sr.info ILIKE :s
                OR sr.group_type ILIKE :s
            )';
            $params[':s'] = '%' . $search . '%';
        }

        // Optional category filter if caller explicitly provided and it's not 'all'
        $category = trim($_GET['category'] ?? '');
        if ($category !== '' && $category !== 'all') {
            $whereParts[] = 'sr.category = :category';
            $params[':category'] = $category;
        }

        $whereSql = !empty($whereParts) ? 'WHERE ' . implode(' AND ', $whereParts) : '';

        $stmt = $db->prepare("
            SELECT 
                sr.id, sr.category, sr.regional, sr.dept, sr.sub_dept, sr.sitecode, sr.name_site,
                COALESCE(NULLIF(sr.info, ''), 'Outlet') as info,
                COALESCE(
                    (
                        SELECT sgh.group_type 
                        FROM site_group_history sgh 
                        WHERE sgh.sitecode = sr.sitecode 
                        ORDER BY sgh.effective_year DESC, sgh.effective_month DESC, sgh.id DESC 
                        LIMIT 1
                    ),
                    NULLIF(sr.group_type, ''),
                    'monthly'
                ) as group_type,
                COALESCE(sr.is_active, TRUE) as is_active,
                COALESCE(sr.is_counted, TRUE) as is_counted,
                (SELECT COUNT(*) FROM site_group_history sgh WHERE sgh.sitecode = sr.sitecode) as history_count
            FROM site_regional sr
            $whereSql
            ORDER BY $sortCol $sortDir, sr.id ASC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data'    => $rows,
            'total'   => count($rows),
        ]);
        exit;
    }

    // CSRF check for state-changing requests
    session_start();
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
    if (empty($csrfHeader) || !hash_equals($_SESSION['csrf_token'] ?? '', $csrfHeader)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }

    // ── POST: Write Operations ────────────────────────────────────────
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $jsonPayload = json_decode($raw, true) ?? [];

        // 1. Update Info column
        if ($action === 'update_info') {
            $id = (int) ($jsonPayload['id'] ?? $_POST['id'] ?? 0);
            $info = trim($jsonPayload['info'] ?? $_POST['info'] ?? '');
            $allowedInfo = ['Outlet', 'Subarep', 'HUB', 'Under Warehouse'];
            if (!in_array($info, $allowedInfo, true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid Info value. Allowed: Outlet, Subarep, HUB, Under Warehouse']);
                exit;
            }

            $stmt = $db->prepare("UPDATE site_regional SET info = :info, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            $stmt->execute([':info' => $info, ':id' => $id]);

            echo json_encode(['success' => true, 'message' => 'Info updated successfully']);
            exit;
        }

        // 2. Update Group Type column
        if ($action === 'update_group_type') {
            $id = (int) ($jsonPayload['id'] ?? $_POST['id'] ?? 0);
            $groupType = strtolower(trim($jsonPayload['group_type'] ?? $_POST['group_type'] ?? ''));
            if (!in_array($groupType, ['monthly', 'quarterly'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid Group Type. Allowed: monthly, quarterly']);
                exit;
            }

            $stmt = $db->prepare("UPDATE site_regional SET group_type = :gt, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            $stmt->execute([':gt' => $groupType, ':id' => $id]);

            // If effective month and year are optionally provided, also record to history
            $effYear = (int) ($jsonPayload['effective_year'] ?? $_POST['effective_year'] ?? 0);
            $effMonth = (int) ($jsonPayload['effective_month'] ?? $_POST['effective_month'] ?? 0);
            if ($effYear >= 2000 && $effMonth >= 1 && $effMonth <= 12) {
                $sitecodeStmt = $db->prepare("SELECT sitecode FROM site_regional WHERE id = :id");
                $sitecodeStmt->execute([':id' => $id]);
                $sitecode = $sitecodeStmt->fetchColumn();
                if ($sitecode) {
                    $histStmt = $db->prepare("
                        INSERT INTO site_group_history (sitecode, group_type, effective_year, effective_month, notes)
                        VALUES (:sc, :gt, :y, :m, 'Updated from Master Data')
                        ON CONFLICT (sitecode, effective_year, effective_month)
                        DO UPDATE SET group_type = EXCLUDED.group_type, notes = EXCLUDED.notes
                    ");
                    $histStmt->execute([':sc' => $sitecode, ':gt' => $groupType, ':y' => $effYear, ':m' => $effMonth]);
                }
            }

            echo json_encode(['success' => true, 'message' => 'Group Type updated successfully']);
            exit;
        }

        // Helper to sync inactive rule to site_group_history starting next month of Effective Period
        $syncSiteInactiveRule = function(PDO $db, string $sitecode, bool $isActive) {
            if (!$isActive && $sitecode !== '') {
                $pStmt = $db->prepare("
                    SELECT effective_year, effective_month 
                    FROM site_group_history 
                    WHERE sitecode = :sc AND group_type != 'inactive'
                    ORDER BY effective_year DESC, effective_month DESC, id DESC 
                    LIMIT 1
                ");
                $pStmt->execute([':sc' => $sitecode]);
                $lastRule = $pStmt->fetch(PDO::FETCH_ASSOC);

                if ($lastRule) {
                    $effY = (int)$lastRule['effective_year'];
                    $effM = (int)$lastRule['effective_month'];
                } else {
                    $arStmt = $db->prepare("
                        SELECT period_year, period_month 
                        FROM asset_reconciliation 
                        WHERE profile ILIKE :p1 OR profile ILIKE :p2 OR profile ILIKE :p3
                        ORDER BY period_year DESC, period_month DESC, id DESC 
                        LIMIT 1
                    ");
                    $arStmt->execute([
                        ':p1' => "% - {$sitecode} - %",
                        ':p2' => "%-{$sitecode}-%",
                        ':p3' => "%{$sitecode}%",
                    ]);
                    $lastAr = $arStmt->fetch(PDO::FETCH_ASSOC);
                    $effY = $lastAr ? (int)$lastAr['period_year'] : 2026;
                    $effM = $lastAr ? (int)$lastAr['period_month'] : 1;
                }

                // Next month of Effective Period
                $nextM = $effM + 1;
                $nextY = $effY;
                if ($nextM > 12) {
                    $nextM = 1;
                    $nextY++;
                }

                $insRule = $db->prepare("
                    INSERT INTO site_group_history (sitecode, group_type, effective_year, effective_month, notes)
                    VALUES (:sc, 'inactive', :y, :m, 'Set to Inactive')
                    ON CONFLICT (sitecode, effective_year, effective_month)
                    DO UPDATE SET group_type = 'inactive', notes = 'Set to Inactive'
                ");
                $insRule->execute([':sc' => $sitecode, ':y' => $nextY, ':m' => $nextM]);
            } elseif ($isActive && $sitecode !== '') {
                $delRule = $db->prepare("DELETE FROM site_group_history WHERE sitecode = :sc AND group_type = 'inactive'");
                $delRule->execute([':sc' => $sitecode]);
            }
        };

        // 2b. Update Active status
        if ($action === 'update_active') {
            $id = (int) ($jsonPayload['id'] ?? $_POST['id'] ?? 0);
            $isActive = filter_var($jsonPayload['is_active'] ?? $_POST['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);

            $scStmt = $db->prepare("SELECT sitecode FROM site_regional WHERE id = :id");
            $scStmt->execute([':id' => $id]);
            $sitecode = $scStmt->fetchColumn();

            if ($sitecode) {
                $syncSiteInactiveRule($db, $sitecode, $isActive);
            }

            $stmt = $db->prepare("UPDATE site_regional SET is_active = :act, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            $stmt->execute([':act' => $isActive ? 1 : 0, ':id' => $id]);

            echo json_encode(['success' => true, 'message' => 'Status updated successfully', 'is_active' => $isActive]);
            exit;
        }

        // 2c. Update Counted status (whether counted in summary & graphs)
        if ($action === 'update_counted') {
            $id = (int) ($jsonPayload['id'] ?? $_POST['id'] ?? 0);
            $isCounted = filter_var($jsonPayload['is_counted'] ?? $_POST['is_counted'] ?? true, FILTER_VALIDATE_BOOLEAN);

            $stmt = $db->prepare("UPDATE site_regional SET is_counted = :counted, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            $stmt->execute([':counted' => $isCounted ? 1 : 0, ':id' => $id]);

            echo json_encode(['success' => true, 'message' => 'Status hitung berhasil diperbarui', 'is_counted' => $isCounted]);
            exit;
        }

        // 3. Add History Rule
        if ($action === 'add_history') {
            $sitecode = trim($jsonPayload['sitecode'] ?? $_POST['sitecode'] ?? '');
            $groupType = strtolower(trim($jsonPayload['group_type'] ?? $_POST['group_type'] ?? ''));
            $effYear = (int) ($jsonPayload['effective_year'] ?? $_POST['effective_year'] ?? 0);
            $effMonth = (int) ($jsonPayload['effective_month'] ?? $_POST['effective_month'] ?? 0);
            $notes = trim($jsonPayload['notes'] ?? $_POST['notes'] ?? 'Manual rule');

            if ($sitecode === '' || !in_array($groupType, ['monthly', 'quarterly', 'inactive'], true) || $effYear < 2000 || $effMonth < 1 || $effMonth > 12) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid parameters for history rule']);
                exit;
            }

            $stmt = $db->prepare("
                INSERT INTO site_group_history (sitecode, group_type, effective_year, effective_month, notes)
                VALUES (:sc, :gt, :y, :m, :notes)
                ON CONFLICT (sitecode, effective_year, effective_month)
                DO UPDATE SET group_type = EXCLUDED.group_type, notes = EXCLUDED.notes
            ");
            $stmt->execute([':sc' => $sitecode, ':gt' => $groupType, ':y' => $effYear, ':m' => $effMonth, ':notes' => $notes]);

            // Sync site_regional.is_active status
            if ($groupType === 'inactive') {
                $db->prepare("UPDATE site_regional SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE sitecode = :sc")->execute([':sc' => $sitecode]);
            } else {
                $db->prepare("UPDATE site_regional SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE sitecode = :sc")->execute([':sc' => $sitecode]);
            }

            echo json_encode(['success' => true, 'message' => 'Dynamic period rule saved successfully']);
            exit;
        }

        // 4. Delete History Rule
        if ($action === 'delete_history') {
            $historyId = (int) ($jsonPayload['id'] ?? $_POST['id'] ?? 0);
            if ($historyId <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Valid history rule ID required']);
                exit;
            }

            $stmt = $db->prepare("DELETE FROM site_group_history WHERE id = :id");
            $stmt->execute([':id' => $historyId]);

            echo json_encode(['success' => true, 'message' => 'Rule deleted successfully']);
            exit;
        }

        // 5. Handle Excel Import
        if ($action === 'import' || isset($_FILES['excel_file'])) {
            require_once __DIR__ . '/../vendor/autoload.php';

            if (!class_exists('ZipArchive')) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'PHP zip extension is not enabled. Please reload php.ini.',
                ]);
                exit;
            }

            $uploadDir = __DIR__ . '/../uploads/';
            $tempPath = null;

            if (!empty($_POST['file_token'])) {
                $token = basename($_POST['file_token']);
                $candidate = $uploadDir . $token;
                if (file_exists($candidate) && is_file($candidate)) {
                    $tempPath = $candidate;
                }
            }

            if (!$tempPath) {
                if (!isset($_FILES['excel_file']) || $_FILES['excel_file']['error'] !== UPLOAD_ERR_OK) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'No valid Excel file was uploaded']);
                    exit;
                }

                $file = $_FILES['excel_file'];
                $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
                if (!in_array($extension, ['xlsx', 'xls'], true)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Only .xlsx and .xls files are allowed']);
                    exit;
                }

                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0750, true);
                }

                $tempPath = $uploadDir . bin2hex(random_bytes(16)) . '.' . $extension;
                if (!move_uploaded_file($file['tmp_name'], $tempPath)) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file']);
                    exit;
                }
            }

            try {
                $selectedSheetName = trim($_POST['sheet_name'] ?? '');

                $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($tempPath);
                $reader->setReadDataOnly(true);
                if ($selectedSheetName !== '') {
                    $reader->setLoadSheetsOnly($selectedSheetName);
                }
                $spreadsheet = $reader->load($tempPath);

                if ($selectedSheetName !== '' && $spreadsheet->sheetNameExists($selectedSheetName)) {
                    $sheet = $spreadsheet->getSheetByName($selectedSheetName);
                } else {
                    $sheet = $spreadsheet->getActiveSheet();
                }
                $rawRows = $sheet->toArray(null, true, true, true);

                if (count($rawRows) < 2) {
                    if (file_exists($tempPath)) unlink($tempPath);
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Excel file is empty or missing data rows']);
                    exit;
                }

                $rows = [];
                foreach ($rawRows as $r) {
                    $rows[] = array_values($r);
                }

                $dataStartIndex = 1;
                $maxCols = 0;
                for ($i = 0; $i < min(6, count($rows)); $i++) {
                    $maxCols = max($maxCols, count($rows[$i] ?? []));
                    $rowStr = strtolower(implode(' ', array_map('strval', $rows[$i])));
                    if (str_contains($rowStr, 'regional') || str_contains($rowStr, 'dept') || str_contains($rowStr, 'sitecode') || str_contains($rowStr, 'name site') || str_contains($rowStr, 'sub dept')) {
                        $dataStartIndex = $i + 1;
                    }
                }

                $compositeHeaders = [];
                for ($c = 0; $c < $maxCols; $c++) {
                    $parts = [];
                    $lastVal = '';
                    for ($i = 0; $i < $dataStartIndex; $i++) {
                        $val = trim((string)($rows[$i][$c] ?? ''));
                        if ($val !== '') $lastVal = $val;
                        if ($lastVal !== '') $parts[] = $lastVal;
                    }
                    $compositeHeaders[$c] = strtolower(implode(' ', $parts));
                }

                $map = [];
                foreach ($compositeHeaders as $c => $h) {
                    if (str_contains($h, 'regional') && !isset($map['regional'])) {
                        $map['regional'] = $c;
                    } elseif ((str_contains($h, 'sub dept') || str_contains($h, 'sub_dept') || str_contains($h, 'subdept')) && !isset($map['sub_dept'])) {
                        $map['sub_dept'] = $c;
                    } elseif (str_contains($h, 'dept') && !str_contains($h, 'sub') && !isset($map['dept'])) {
                        $map['dept'] = $c;
                    } elseif ((str_contains($h, 'sitecode') || str_contains($h, 'site code') || str_contains($h, 'site_code')) && !isset($map['sitecode'])) {
                        $map['sitecode'] = $c;
                    } elseif ((str_contains($h, 'name site') || str_contains($h, 'name_site') || str_contains($h, 'namesite')) && !isset($map['name_site'])) {
                        $map['name_site'] = $c;
                    } elseif (str_contains($h, 'info') && !isset($map['info'])) {
                        $map['info'] = $c;
                    } elseif ((str_contains($h, 'group') || str_contains($h, 'group_type') || str_contains($h, 'group type')) && !isset($map['group_type'])) {
                        $map['group_type'] = $c;
                    } elseif ((str_contains($h, 'active') || str_contains($h, 'is_active') || str_contains($h, 'aktif') || str_contains($h, 'status')) && !isset($map['is_active'])) {
                        $map['is_active'] = $c;
                    }
                }

                if (!isset($map['regional']))  $map['regional']  = 0;
                if (!isset($map['dept']))      $map['dept']      = 1;
                if (!isset($map['sub_dept']))   $map['sub_dept']   = 2;
                if (!isset($map['sitecode']))  $map['sitecode']  = 3;
                if (!isset($map['name_site'])) $map['name_site'] = 4;

                $replaceExisting = isset($_POST['replace_existing']) && $_POST['replace_existing'] === '1';

                $db->beginTransaction();

                if ($replaceExisting) {
                    $db->exec('DELETE FROM site_regional');
                }

                $findStmt = $db->prepare('SELECT id FROM site_regional WHERE sitecode = :sitecode LIMIT 1');
                $updateStmt = $db->prepare('
                    UPDATE site_regional
                    SET regional = :regional, dept = :dept, sub_dept = :sub_dept, name_site = :name_site, info = :info, group_type = :group_type, is_active = :is_active, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                ');
                $insertStmt = $db->prepare('
                    INSERT INTO site_regional (category, regional, dept, sub_dept, sitecode, name_site, info, group_type, is_active)
                    VALUES (:category, :regional, :dept, :sub_dept, :sitecode, :name_site, :info, :group_type, :is_active)
                ');

                $importedCount = 0;
                for ($r = $dataStartIndex; $r < count($rows); $r++) {
                    $row = $rows[$r];
                    $sitecode = trim((string)($row[$map['sitecode']] ?? ''));
                    $nameSite = trim((string)($row[$map['name_site']] ?? ''));
                    $regional = trim((string)($row[$map['regional']] ?? ''));
                    $dept     = trim((string)($row[$map['dept']] ?? ''));
                    $subDept  = trim((string)($row[$map['sub_dept']] ?? ''));

                    if ($sitecode === '' && $nameSite === '') continue;

                    // Info determination
                    $info = null;
                    if (isset($map['info']) && isset($row[$map['info']])) {
                        $rawInfo = trim((string)$row[$map['info']]);
                        $lowerInfo = strtolower($rawInfo);
                        if (str_contains($lowerInfo, 'subarep') || str_contains($lowerInfo, 'sub arep')) $info = 'Subarep';
                        elseif (str_contains($lowerInfo, 'gudang') || str_contains($lowerInfo, 'warehouse') || str_contains($lowerInfo, 'under')) $info = 'Under Warehouse';
                        elseif (str_contains($lowerInfo, 'hub')) $info = 'HUB';
                        elseif (str_contains($lowerInfo, 'outlet')) $info = 'Outlet';
                    }
                    if (!$info) {
                        $lowerName = strtolower($nameSite);
                        if (str_contains($lowerName, 'subarep') || str_contains($lowerName, 'sub arep') || str_contains($lowerName, 'sub-arep') || str_contains($lowerName, 'sub outlet') || str_contains($lowerName, 'suboutlet')) {
                            $info = 'Subarep';
                        } elseif (str_contains($lowerName, 'gudang') || str_contains($lowerName, 'warehouse') || str_contains($lowerName, 'under')) {
                            $info = 'Under Warehouse';
                        } elseif (str_contains($lowerName, 'hub')) {
                            $info = 'HUB';
                        } else {
                            $info = 'Outlet';
                        }
                    }

                    // Group Type determination
                    $groupType = 'monthly';
                    if (isset($map['group_type']) && isset($row[$map['group_type']])) {
                        $rawGt = strtolower(trim((string)$row[$map['group_type']]));
                        if (str_starts_with($rawGt, 'q') || str_contains($rawGt, 'quarter')) {
                            $groupType = 'quarterly';
                        }
                    }

                    // Active status determination (defaults to true if column omitted)
                    $isActive = true;
                    if (isset($map['is_active']) && isset($row[$map['is_active']])) {
                        $rawAct = strtolower(trim((string)$row[$map['is_active']]));
                        if (in_array($rawAct, ['false', '0', 'no', 'nonaktif', 'tidak', 'inactive', 'f'], true)) {
                            $isActive = false;
                        } elseif (in_array($rawAct, ['true', '1', 'yes', 'aktif', 'ya', 'active', 't'], true)) {
                            $isActive = true;
                        }
                    }

                    $category = (strtoupper($dept) === 'PMD') ? 'monthly_pmd' : ($groupType === 'quarterly' ? 'quarterly' : 'monthly_outlet');

                    $findStmt->execute([':sitecode' => $sitecode]);
                    $existingId = $findStmt->fetchColumn();

                    if ($existingId) {
                        $updateStmt->execute([
                            ':regional'   => $regional,
                            ':dept'       => $dept,
                            ':sub_dept'   => $subDept,
                            ':name_site'  => $nameSite,
                            ':info'       => $info,
                            ':group_type' => $groupType,
                            ':is_active'  => $isActive ? 1 : 0,
                            ':id'         => $existingId,
                        ]);
                    } else {
                        $insertStmt->execute([
                            ':category'   => $category,
                            ':regional'   => $regional,
                            ':dept'       => $dept,
                            ':sub_dept'   => $subDept,
                            ':sitecode'   => $sitecode,
                            ':name_site'  => $nameSite,
                            ':info'       => $info,
                            ':group_type' => $groupType,
                            ':is_active'  => $isActive ? 1 : 0,
                        ]);
                    }

                    // Sync inactive rule if active status changed
                    $syncSiteInactiveRule($db, $sitecode, $isActive);

                    $importedCount++;
                }

                $db->commit();

                if (file_exists($tempPath)) unlink($tempPath);

                echo json_encode([
                    'success'        => true,
                    'imported_count' => $importedCount,
                    'message'        => "Successfully imported {$importedCount} Site Regional records"
                ]);
                exit;

            } catch (Throwable $e) {
                if ($db->inTransaction()) $db->rollBack();
                if (file_exists($tempPath)) unlink($tempPath);
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Excel processing error: ' . $e->getMessage()]);
                exit;
            }
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Unknown POST action']);
        exit;
    }

    // ── DELETE: Delete Operations ─────────────────────────────────────
    if ($method === 'DELETE') {
        $action = $_GET['action'] ?? '';

        if ($action === 'bulk_delete') {
            $raw = file_get_contents('php://input');
            $payload = json_decode($raw, true) ?? [];
            $ids = $payload['ids'] ?? [];

            if (empty($ids) && !empty($_GET['ids'])) {
                $ids = explode(',', $_GET['ids']);
            }

            $validIds = array_values(array_filter(array_map(function($v) {
                return (is_numeric($v) && (int)$v > 0) ? (int)$v : null;
            }, (array)$ids)));

            if (empty($validIds)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No valid record IDs provided for deletion']);
                exit;
            }

            $placeholders = implode(',', array_fill(0, count($validIds), '?'));
            $stmt = $db->prepare("DELETE FROM site_regional WHERE id IN ($placeholders)");
            $stmt->execute($validIds);

            $deletedCount = $stmt->rowCount();

            echo json_encode([
                'success'       => true,
                'message'       => "Successfully deleted {$deletedCount} record(s)",
                'deleted_count' => $deletedCount
            ]);
            exit;
        }

        if ($action === 'clear_all') {
            $deletedCount = $db->exec('DELETE FROM site_regional');
            echo json_encode([
                'success'       => true,
                'message'       => "Cleared {$deletedCount} records from Site Regional",
                'deleted_count' => $deletedCount
            ]);
            exit;
        }

        $id = $_GET['id'] ?? null;
        if (!$id || !ctype_digit((string)$id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid record ID is required']);
            exit;
        }

        $stmt = $db->prepare('DELETE FROM site_regional WHERE id = :id');
        $stmt->execute([':id' => (int)$id]);

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
    error_log('Site Regional API error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
