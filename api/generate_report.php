<?php
/**
 * Generate Report API Endpoint
 * Handles:
 * - Listing sites with SO data and generation status
 * - Generating 2-page Berita Acara (BA) reports with SO reconciliation & DB followup data
 * - Autofilling signatures:
 *     * PJ Stock Opname: PIC name from site_pics
 *     * Associate Vice President: job title & PIC from circular_pics (for SUBDEPT)
 *     * First Vice President: job title & PIC from circular_pics (for DEPT)
 *     * Signature boxes left blank for physical signature
 * - WhatsApp deeplink generation and tracking
 * - HTML print preview
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/security.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);

sendSecurityHeaders();

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'generate_report.php') {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = $_GET['action'] ?? $_POST['action'] ?? 'list';

    try {
        $db = getDbConnection();

        // Ensure generated_reports table exists
        $db->exec("
        CREATE TABLE IF NOT EXISTS generated_reports (
            id SERIAL PRIMARY KEY,
            sitecode VARCHAR(100) NOT NULL,
            sitename VARCHAR(255),
            dept VARCHAR(100),
            sub_dept VARCHAR(100),
            period_month INT NOT NULL,
            period_year INT NOT NULL,
            status VARCHAR(50) DEFAULT 'generated',
            pdf_path VARCHAR(500),
            docx_path VARCHAR(500),
            pic_name VARCHAR(150),
            pic_phone VARCHAR(50),
            avp_name VARCHAR(150),
            avp_title VARCHAR(255),
            fvp_name VARCHAR(150),
            fvp_title VARCHAR(255),
            summary_data JSONB,
            generated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            sent_at TIMESTAMP WITHOUT TIME ZONE,
            uploaded_file_path VARCHAR(500),
            uploaded_at TIMESTAMP WITHOUT TIME ZONE,
            verified_at TIMESTAMP WITHOUT TIME ZONE,
            verified_by VARCHAR(150),
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_site_period UNIQUE (sitecode, period_month, period_year)
        );
        CREATE INDEX IF NOT EXISTS idx_gen_reports_sitecode ON generated_reports(sitecode);
        CREATE INDEX IF NOT EXISTS idx_gen_reports_period ON generated_reports(period_month, period_year);
        CREATE INDEX IF NOT EXISTS idx_gen_reports_status ON generated_reports(status);
        ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS uploaded_file_path VARCHAR(500);
        ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITHOUT TIME ZONE;
        ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITHOUT TIME ZONE;
        ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS verified_by VARCHAR(150);
    ");

        $reportsDir = __DIR__ . '/../uploads/reports/';
        $signedDir = __DIR__ . '/../uploads/reports/signed/';
        if (!is_dir($reportsDir)) {
            mkdir($reportsDir, 0755, true);
        }
        if (!is_dir($signedDir)) {
            mkdir($signedDir, 0755, true);
        }

        // Helper: Indonesian day names
        $dayNames = [
            'Sunday' => 'Minggu',
            'Monday' => 'Senin',
            'Tuesday' => 'Selasa',
            'Wednesday' => 'Rabu',
            'Thursday' => 'Kamis',
            'Friday' => 'Jumat',
            'Saturday' => 'Sabtu'
        ];

        // Helper: Indonesian month names
        $monthNames = [
            1 => 'Januari',
            2 => 'Februari',
            3 => 'Maret',
            4 => 'April',
            5 => 'Mei',
            6 => 'Juni',
            7 => 'Juli',
            8 => 'Agustus',
            9 => 'September',
            10 => 'Oktober',
            11 => 'November',
            12 => 'Desember'
        ];

        // Helper: Check if current user has permission for a specific site's department
        $checkSiteAccess = function (string $sc) use ($db): bool {
            $currentUser = getCurrentUser();
            if (!$currentUser || empty($currentUser['permissions']['reports_depts'])) {
                return true;
            }
            $rawAllowed = strtoupper(trim($currentUser['permissions']['reports_depts']));
            if ($rawAllowed === 'ALL') {
                return true;
            }
            $allowed = array_values(array_filter(array_map('trim', explode(',', $rawAllowed))));
            $sStmt = $db->prepare("SELECT UPPER(COALESCE(dept, '')), UPPER(COALESCE(divisi, '')) FROM site_regional WHERE UPPER(sitecode) = UPPER(:sc) LIMIT 1");
            $sStmt->execute([':sc' => $sc]);
            $sRow = $sStmt->fetch(PDO::FETCH_NUM);
            $sDept = $sRow[0] ?? '';
            $sDivisi = $sRow[1] ?? '';
            if (in_array('PMD', $allowed) && ($sDivisi === 'PMD' || in_array($sDept, ['PMD', 'DNO', 'DSO']))) {
                return true;
            }
            if (in_array('BLANK', $allowed) || in_array('BLANKS', $allowed)) {
                if (($sDept === '' || $sDept === '-') && ($sDivisi === '' || $sDivisi === '-')) {
                    return true;
                }
            }
            return in_array($sDept, $allowed);
        };

        // ─────────────────────────────────────────────────────────────────
        // ACTION: list - Get sites list with status & SO metrics
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'GET' && $action === 'list') {
            header('Content-Type: application/json; charset=utf-8');

            $month = (int) ($_GET['month'] ?? (int) date('n'));
            $year = (int) ($_GET['year'] ?? (int) date('Y'));
            $soType = strtolower(trim($_GET['so_type'] ?? 'monthly'));
            if ($soType !== 'quarterly') {
                $soType = 'monthly';
            }
            $dept = trim($_GET['dept'] ?? 'all');
            $subDept = trim($_GET['sub_dept'] ?? 'all');
            $statusFilter = trim($_GET['status'] ?? 'all');
            $view = trim($_GET['view'] ?? '');
            $search = trim($_GET['search'] ?? '');
            $page = max(1, (int) ($_GET['page'] ?? 1));
            $limitParam = $_GET['limit'] ?? '15';
            $limit = ($limitParam === 'all') ? 999999 : max(1, (int) $limitParam);
            $offset = ($page - 1) * $limit;

            // Cutoff check: List report only allowed per tanggal 27 of the target period month
            $today = date('Y-m-d');
            $cutoffDate = sprintf('%04d-%02d-27', $year, $month);
            $isLockedPeriod = ($today < $cutoffDate);

            if ($isLockedPeriod) {
                $periodMonthName = $monthNames[$month] ?? "Bulan $month";
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success' => true,
                    'data' => [],
                    'total' => 0,
                    'page' => 1,
                    'limit' => $limitParam,
                    'total_pages' => 0,
                    'so_type' => $soType,
                    'user_allowed_depts' => ['ALL'],
                    'depts' => [],
                    'sub_depts' => [],
                    'stats' => [
                        'total_sites' => 0,
                        'total_generated' => 0,
                        'total_sent' => 0,
                        'total_uploaded' => 0,
                        'total_verified' => 0,
                        'total_not_generated' => 0,
                        'total_pending' => 0
                    ],
                    'is_locked_period' => true,
                    'locked_message' => "No data."
                ]);
                exit;
            }

            $effectiveGroupSql = "
                CASE
                    WHEN UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO') OR COALESCE(sr.category, '') = 'monthly_pmd' THEN 'monthly'
                    ELSE COALESCE(
                        (
                            SELECT sgh.group_type
                            FROM site_group_history sgh
                            WHERE UPPER(sgh.sitecode) = UPPER(sr.sitecode)
                              AND (sgh.effective_year < :year OR (sgh.effective_year = :year AND sgh.effective_month <= :month))
                            ORDER BY sgh.effective_year DESC, sgh.effective_month DESC, sgh.id DESC
                            LIMIT 1
                        ),
                        CASE
                            WHEN COALESCE(sr.is_active, TRUE) = FALSE THEN 'inactive'
                            WHEN COALESCE(sr.is_counted, TRUE) = FALSE THEN 'uncounted'
                            ELSE COALESCE(NULLIF(sr.group_type, ''), 'monthly')
                        END
                    )
                END
            ";

            $where = ["($effectiveGroupSql) = :so_type"];
            $params = [
                ':month' => $month,
                ':year' => $year,
                ':so_type' => $soType
            ];

            // Check UAC department restriction for current user session
            $currentUser = getCurrentUser();
            $userAllowedDepts = null;
            if ($currentUser && !empty($currentUser['permissions']['reports_depts']) && strtoupper(trim($currentUser['permissions']['reports_depts'])) !== 'ALL') {
                $rawAllowed = $currentUser['permissions']['reports_depts'];
                $parsed = array_map('trim', explode(',', $rawAllowed));
                $userAllowedDepts = array_values(array_filter(array_map('strtoupper', $parsed)));
                if (in_array('PMD', $userAllowedDepts)) {
                    if (!in_array('DNO', $userAllowedDepts)) $userAllowedDepts[] = 'DNO';
                    if (!in_array('DSO', $userAllowedDepts)) $userAllowedDepts[] = 'DSO';
                }
            }

            if ($userAllowedDepts !== null && count($userAllowedDepts) > 0) {
                if ($dept !== '' && $dept !== 'all') {
                    if (strtoupper($dept) === 'PMD') {
                        $where[] = "(UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                    } elseif (in_array(strtoupper($dept), ['BLANK', 'BLANKS', '-'])) {
                        $where[] = "((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                    } elseif (in_array(strtoupper($dept), $userAllowedDepts)) {
                        $where[] = "UPPER(COALESCE(sr.dept, '')) = UPPER(:dept)";
                        $params[':dept'] = $dept;
                    } else {
                        $deptClauses = [];
                        foreach ($userAllowedDepts as $idx => $ad) {
                            $paramKey = ":uad_{$idx}";
                            if ($ad === 'PMD') {
                                $deptClauses[] = "(UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                            } elseif ($ad === 'BLANK' || $ad === 'BLANKS') {
                                $deptClauses[] = "((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                            } else {
                                $deptClauses[] = "UPPER(COALESCE(sr.dept, '')) = {$paramKey}";
                                $params[$paramKey] = $ad;
                            }
                        }
                        $where[] = '(' . implode(' OR ', $deptClauses) . ')';
                    }
                } else {
                    $deptClauses = [];
                    foreach ($userAllowedDepts as $idx => $ad) {
                        $paramKey = ":uad_{$idx}";
                        if ($ad === 'PMD') {
                            $deptClauses[] = "(UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                        } elseif ($ad === 'BLANK' || $ad === 'BLANKS') {
                            $deptClauses[] = "((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                        } else {
                            $deptClauses[] = "UPPER(COALESCE(sr.dept, '')) = {$paramKey}";
                            $params[$paramKey] = $ad;
                        }
                    }
                    $where[] = '(' . implode(' OR ', $deptClauses) . ')';
                }
            } elseif ($dept !== '' && $dept !== 'all') {
                if (strtoupper($dept) === 'PMD') {
                    $where[] = "(UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                } elseif (in_array(strtoupper($dept), ['BLANK', 'BLANKS', '-'])) {
                    $where[] = "((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                } else {
                    $where[] = "UPPER(COALESCE(sr.dept, '')) = UPPER(:dept)";
                    $params[':dept'] = $dept;
                }
            }

            if ($subDept !== '' && $subDept !== 'all') {
                if (in_array(strtoupper($subDept), ['DNO', 'DSO'])) {
                    $where[] = "(UPPER(COALESCE(sr.dept, '')) = UPPER(:sub_dept) OR UPPER(COALESCE(sr.sub_dept, '')) = UPPER(:sub_dept))";
                    $params[':sub_dept'] = $subDept;
                } elseif (in_array(strtoupper($subDept), ['BLANK', 'BLANKS', '-'])) {
                    $where[] = "(sr.sub_dept IS NULL OR TRIM(sr.sub_dept) = '' OR TRIM(sr.sub_dept) = '-')";
                } else {
                    $where[] = "UPPER(COALESCE(sr.sub_dept, '')) = UPPER(:sub_dept)";
                    $params[':sub_dept'] = $subDept;
                }
            }

            if ($view === 'verification') {
                $where[] = "gr.status IN ('sent', 'uploaded', 'verified')";
            } elseif ($view === 'berita_acara') {
                if ($statusFilter !== 'not_generated') {
                    $where[] = "gr.id IS NOT NULL";
                }
            }

            if ($statusFilter === 'generated') {
                $where[] = "(gr.status = 'generated' OR gr.status = 'sent' OR gr.status = 'uploaded' OR gr.status = 'verified')";
            } elseif ($statusFilter === 'not_generated' || $statusFilter === 'pending_generate') {
                $where[] = "gr.id IS NULL";
            } elseif ($statusFilter === 'sent' || $statusFilter === 'pending') {
                $where[] = "gr.status = 'sent'";
            } elseif ($statusFilter === 'uploaded' || $statusFilter === 'menunggu_verifikasi') {
                $where[] = "gr.status = 'uploaded'";
            } elseif ($statusFilter === 'verified') {
                $where[] = "gr.status = 'verified'";
            } elseif ($statusFilter === 'pending_verification') {
                $where[] = "(gr.status = 'sent' OR gr.status = 'uploaded')";
            }

            if ($search !== '') {
                $where[] = "(
                sr.sitecode ILIKE :search
                OR sr.name_site ILIKE :search
                OR sr.dept ILIKE :search
                OR sr.sub_dept ILIKE :search
                OR sp.pic ILIKE :search
            )";
                $params[':search'] = "%$search%";
            }

            $whereSql = implode(' AND ', $where);

            $countSql = "
            SELECT COUNT(DISTINCT sr.sitecode)
            FROM site_regional sr
            LEFT JOIN site_pics sp ON sp.sitecode = sr.sitecode
            LEFT JOIN generated_reports gr ON gr.sitecode = sr.sitecode AND gr.period_month = :month AND gr.period_year = :year
            WHERE $whereSql
        ";
            $countStmt = $db->prepare($countSql);
            $countStmt->execute($params);
            $total = (int) $countStmt->fetchColumn();

            $sql = "
            SELECT 
                sr.sitecode,
                COALESCE(NULLIF(sr.name_site, ''), sr.sitecode) as sitename,
                COALESCE(sr.divisi, '') as divisi,
                CASE 
                    WHEN UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO') THEN 'PMD'
                    ELSE COALESCE(NULLIF(TRIM(sr.dept), ''), '-') 
                END as dept,
                COALESCE(NULLIF(TRIM(sr.sub_dept), ''), '-') as sub_dept,
                sp.pic as pic_name,
                sp.no_telp as pic_phone,
                gr.id as report_id,
                gr.status as report_status,
                gr.pdf_path,
                gr.docx_path,
                gr.uploaded_file_path,
                gr.uploaded_at,
                gr.verified_at,
                gr.verified_by,
                gr.generated_at,
                gr.sent_at,
                gr.summary_data->>'keterangan_db' as keterangan_db
            FROM site_regional sr
            LEFT JOIN (
                SELECT DISTINCT ON (sitecode) sitecode, pic, no_telp
                FROM site_pics
                ORDER BY sitecode, id DESC
            ) sp ON sp.sitecode = sr.sitecode
            LEFT JOIN generated_reports gr ON gr.sitecode = sr.sitecode AND gr.period_month = :month AND gr.period_year = :year
            WHERE $whereSql
            GROUP BY sr.sitecode, sr.name_site, sr.divisi, sr.dept, sr.sub_dept, sp.pic, sp.no_telp, gr.id, gr.status, gr.pdf_path, gr.docx_path, gr.uploaded_file_path, gr.uploaded_at, gr.verified_at, gr.verified_by, gr.generated_at, gr.sent_at, gr.summary_data
            ORDER BY sr.dept ASC, sr.sub_dept ASC, sr.sitecode ASC
            LIMIT :limit OFFSET :offset
        ";

            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            clearstatcache(true);
            foreach ($rows as &$row) {
                $periodMonthName = $monthNames[$month] ?? "Bulan $month";
                $periodStr = "{$periodMonthName} {$year}";
                $genDt = null;
                if (!empty($row['generated_at'])) {
                    try {
                        $genDt = new DateTime($row['generated_at']);
                    } catch (Exception $e) {
                    }
                }
                $filenameBase = buildReportExportName($row['sitecode'], $row['sitename'], $periodStr, $genDt ?: new DateTime());
                $row['export_filename'] = $filenameBase . '.pdf';
                $row['pdf_url'] = buildReportDownloadUrl($row['sitecode'], $month, $year);
                $row['preview_url'] = "api/generate_report.php?action=download&inline=1&sitecode=" . rawurlencode($row['sitecode']) . "&month={$month}&year={$year}";
                $row['uploaded_pdf_url'] = !empty($row['uploaded_file_path']) ? "api/generate_report.php?action=download_signed&inline=1&sitecode=" . rawurlencode($row['sitecode']) . "&month={$month}&year={$year}" : null;
                $row['uploaded_download_url'] = !empty($row['uploaded_file_path']) ? "api/generate_report.php?action=download_signed&sitecode=" . rawurlencode($row['sitecode']) . "&month={$month}&year={$year}" : null;
                $row['uploaded_filename'] = !empty($row['uploaded_file_path']) ? basename($row['uploaded_file_path']) : null;
                $row['sent_at_formatted'] = !empty($row['sent_at']) ? date('d/m/Y H:i', strtotime($row['sent_at'])) : null;
                $row['uploaded_at_formatted'] = !empty($row['uploaded_at']) ? date('d/m/Y H:i', strtotime($row['uploaded_at'])) : null;
                $row['verified_at_formatted'] = !empty($row['verified_at']) ? date('d/m/Y H:i', strtotime($row['verified_at'])) : null;
                $row['generated_at_formatted'] = !empty($row['generated_at']) ? date('d/m/Y H:i', strtotime($row['generated_at'])) : null;
            }
            unset($row);

            // Fetch distinct depts and sub_depts for current SO Type & user permissions
            $deptExtra = "";
            $deptParams = [':year' => $year, ':month' => $month, ':so_type' => $soType];
            if ($userAllowedDepts !== null && count($userAllowedDepts) > 0) {
                $dClauses = [];
                foreach ($userAllowedDepts as $idx => $ad) {
                    $paramKey = ":duad_{$idx}";
                    if ($ad === 'PMD') {
                        $dClauses[] = "(UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                    } elseif ($ad === 'BLANK' || $ad === 'BLANKS') {
                        $dClauses[] = "((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                    } else {
                        $dClauses[] = "UPPER(COALESCE(sr.dept, '')) = {$paramKey}";
                        $deptParams[$paramKey] = $ad;
                    }
                }
                $deptExtra = " AND (" . implode(' OR ', $dClauses) . ")";
            }

            $deptStmt = $db->prepare("
                SELECT DISTINCT 
                    CASE 
                        WHEN UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO') THEN 'PMD'
                        WHEN sr.dept IS NULL OR TRIM(sr.dept) = '' OR sr.dept = '-' THEN 'BLANK'
                        ELSE sr.dept 
                    END as dept_name
                FROM site_regional sr 
                WHERE ($effectiveGroupSql) = :so_type {$deptExtra}
                ORDER BY dept_name ASC
            ");
            $deptStmt->execute($deptParams);
            $rawDepts = $deptStmt->fetchAll(PDO::FETCH_COLUMN);
            $depts = [];
            foreach ($rawDepts as $d) {
                $d = trim((string)$d);
                if ($d === '') continue;
                if (in_array(strtoupper($d), ['DNO', 'DSO'])) {
                    $d = 'PMD';
                }
                if (!in_array($d, $depts)) {
                    $depts[] = $d;
                }
            }
            sort($depts);

            $subDeptExtra = "";
            $subDeptParams = [':year' => $year, ':month' => $month, ':so_type' => $soType];
            if ($userAllowedDepts !== null && count($userAllowedDepts) > 0) {
                $sdClauses = [];
                foreach ($userAllowedDepts as $idx => $ad) {
                    $paramKey = ":sduad_{$idx}";
                    if ($ad === 'PMD') {
                        $sdClauses[] = "(UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                    } elseif ($ad === 'BLANK' || $ad === 'BLANKS') {
                        $sdClauses[] = "((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                    } else {
                        $sdClauses[] = "UPPER(COALESCE(sr.dept, '')) = {$paramKey}";
                        $subDeptParams[$paramKey] = $ad;
                    }
                }
                $subDeptExtra = " AND (" . implode(' OR ', $sdClauses) . ")";
            }

            if ($dept !== '' && $dept !== 'all') {
                if (strtoupper($dept) === 'PMD') {
                    $subDeptExtra .= " AND (UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                } elseif (in_array(strtoupper($dept), ['BLANK', 'BLANKS', '-'])) {
                    $subDeptExtra .= " AND ((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                } else {
                    $subDeptExtra .= " AND UPPER(COALESCE(sr.dept, '')) = :sd_selected_dept";
                    $subDeptParams[':sd_selected_dept'] = $dept;
                }
            }

            $subDeptStmt = $db->prepare("
                SELECT DISTINCT sr.sub_dept 
                FROM site_regional sr 
                WHERE sr.sub_dept IS NOT NULL AND TRIM(sr.sub_dept) != ''
                  AND ($effectiveGroupSql) = :so_type {$subDeptExtra}
                ORDER BY sr.sub_dept ASC
            ");
            $subDeptStmt->execute($subDeptParams);
            $rawSubDepts = $subDeptStmt->fetchAll(PDO::FETCH_COLUMN);
            $subDepts = [];
            foreach ($rawSubDepts as $sd) {
                $sd = trim((string)$sd);
                if ($sd !== '' && !in_array($sd, $subDepts)) {
                    $subDepts[] = $sd;
                }
            }
            sort($subDepts);

            // Calculate card counts (Total sites, Generated, Sent, Uploaded, Verified, Pending) for current SO Type, UAC, Dept & Subdept
            $statDeptClause = "";
            $statParams = [':month' => $month, ':year' => $year, ':so_type' => $soType];
            if ($userAllowedDepts !== null && count($userAllowedDepts) > 0) {
                if ($dept !== '' && $dept !== 'all') {
                    if (strtoupper($dept) === 'PMD') {
                        $statDeptClause = " AND (UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                    } elseif (in_array(strtoupper($dept), ['BLANK', 'BLANKS', '-'])) {
                        $statDeptClause = " AND ((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                    } elseif (in_array(strtoupper($dept), $userAllowedDepts)) {
                        $statDeptClause = " AND UPPER(COALESCE(sr.dept, '')) = UPPER(:s_dept)";
                        $statParams[':s_dept'] = $dept;
                    } else {
                        $sClauses = [];
                        foreach ($userAllowedDepts as $idx => $ad) {
                            $paramKey = ":suad_{$idx}";
                            if ($ad === 'PMD') {
                                $sClauses[] = "(UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                            } elseif ($ad === 'BLANK' || $ad === 'BLANKS') {
                                $sClauses[] = "((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                            } else {
                                $sClauses[] = "UPPER(COALESCE(sr.dept, '')) = {$paramKey}";
                                $statParams[$paramKey] = $ad;
                            }
                        }
                        $statDeptClause = " AND (" . implode(' OR ', $sClauses) . ")";
                    }
                } else {
                    $sClauses = [];
                    foreach ($userAllowedDepts as $idx => $ad) {
                        $paramKey = ":suad_{$idx}";
                        if ($ad === 'PMD') {
                            $sClauses[] = "(UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                        } elseif ($ad === 'BLANK' || $ad === 'BLANKS') {
                            $sClauses[] = "((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                        } else {
                            $sClauses[] = "UPPER(COALESCE(sr.dept, '')) = {$paramKey}";
                            $statParams[$paramKey] = $ad;
                        }
                    }
                    $statDeptClause = " AND (" . implode(' OR ', $sClauses) . ")";
                }
            } elseif ($dept !== '' && $dept !== 'all') {
                if (strtoupper($dept) === 'PMD') {
                    $statDeptClause = " AND (UPPER(COALESCE(sr.divisi, '')) = 'PMD' OR UPPER(COALESCE(sr.dept, '')) IN ('PMD', 'DNO', 'DSO'))";
                } elseif (in_array(strtoupper($dept), ['BLANK', 'BLANKS', '-'])) {
                    $statDeptClause = " AND ((sr.dept IS NULL OR TRIM(sr.dept) = '' OR TRIM(sr.dept) = '-') AND UPPER(COALESCE(sr.divisi, '')) != 'PMD')";
                } else {
                    $statDeptClause = " AND UPPER(COALESCE(sr.dept, '')) = UPPER(:s_dept)";
                    $statParams[':s_dept'] = $dept;
                }
            }

            $statSubDeptClause = "";
            if ($subDept !== '' && $subDept !== 'all') {
                if (in_array(strtoupper($subDept), ['DNO', 'DSO'])) {
                    $statSubDeptClause = " AND (UPPER(COALESCE(sr.dept, '')) = UPPER(:s_sub_dept) OR UPPER(COALESCE(sr.sub_dept, '')) = UPPER(:s_sub_dept))";
                    $statParams[':s_sub_dept'] = $subDept;
                } elseif (in_array(strtoupper($subDept), ['BLANK', 'BLANKS', '-'])) {
                    $statSubDeptClause = " AND (sr.sub_dept IS NULL OR TRIM(sr.sub_dept) = '' OR TRIM(sr.sub_dept) = '-')";
                } else {
                    $statSubDeptClause = " AND UPPER(COALESCE(sr.sub_dept, '')) = UPPER(:s_sub_dept)";
                    $statParams[':s_sub_dept'] = $subDept;
                }
            }

            $statStmt = $db->prepare("
            SELECT 
                COUNT(DISTINCT sr.sitecode) as total_sites,
                COUNT(DISTINCT CASE WHEN gr.id IS NOT NULL THEN sr.sitecode END) as total_generated,
                COUNT(DISTINCT CASE WHEN gr.status = 'sent' THEN sr.sitecode END) as total_sent,
                COUNT(DISTINCT CASE WHEN gr.status = 'uploaded' THEN sr.sitecode END) as total_uploaded,
                COUNT(DISTINCT CASE WHEN gr.status = 'verified' THEN sr.sitecode END) as total_verified,
                COUNT(DISTINCT CASE WHEN gr.id IS NULL THEN sr.sitecode END) as total_not_generated,
                COUNT(DISTINCT CASE WHEN gr.status = 'sent' OR gr.status = 'uploaded' THEN sr.sitecode END) as total_pending
            FROM site_regional sr
            LEFT JOIN generated_reports gr ON gr.sitecode = sr.sitecode AND gr.period_month = :month AND gr.period_year = :year
            WHERE ($effectiveGroupSql) = :so_type {$statDeptClause} {$statSubDeptClause}
        ");
            $statStmt->execute($statParams);
            $stats = $statStmt->fetch(PDO::FETCH_ASSOC) ?: [
                'total_sites' => 0,
                'total_generated' => 0,
                'total_sent' => 0,
                'total_uploaded' => 0,
                'total_verified' => 0,
                'total_not_generated' => 0,
                'total_pending' => 0
            ];

            echo json_encode([
                'success' => true,
                'data' => $rows,
                'total' => $total,
                'page' => $page,
                'limit' => $limitParam,
                'total_pages' => ($limitParam === 'all') ? 1 : (int) ceil($total / $limit),
                'so_type' => $soType,
                'user_allowed_depts' => $userAllowedDepts ?: ['ALL'],
                'depts' => $depts,
                'sub_depts' => $subDepts,
                'stats' => $stats
            ]);
            exit;
        }

        // ─────────────────────────────────────────────────────────────────
        // ACTION: get_report_data - Fetch detailed data used to fill BA
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'GET' && ($action === 'data' || $action === 'preview_html')) {
            $sitecode = trim($_GET['sitecode'] ?? '');
            $month = (int) ($_GET['month'] ?? 9);
            $year = (int) ($_GET['year'] ?? 2026);

            if ($sitecode === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Sitecode required']);
                exit;
            }

            if (!$checkSiteAccess($sitecode)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Akses ditolak: Site bukan bagian dari departemen yang ditugaskan kepada Anda.']);
                exit;
            }

            $reportData = fetchReportBundle($db, $sitecode, $month, $year, $dayNames, $monthNames);

            if ($action === 'preview_html') {
                renderHtmlBa($reportData);
                exit;
            }

            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => true, 'data' => $reportData]);
            exit;
        }

        // ─────────────────────────────────────────────────────────────────
        // ACTION: download - Stream generated PDF through PHP
        // (uploads/ is protected by .htaccess "Require all denied", so files
        //  must never be linked directly)
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'GET' && $action === 'download') {
            $sitecode = trim($_GET['sitecode'] ?? '');
            $month = (int) ($_GET['month'] ?? 9);
            $year = (int) ($_GET['year'] ?? 2026);
            $disposition = (($_GET['inline'] ?? '') === '1') ? 'inline' : 'attachment';

            if ($sitecode === '') {
                http_response_code(400);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['success' => false, 'message' => 'Sitecode required']);
                exit;
            }

            if (!$checkSiteAccess($sitecode)) {
                http_response_code(403);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['success' => false, 'message' => 'Akses ditolak: Site bukan bagian dari departemen yang ditugaskan kepada Anda.']);
                exit;
            }

            $stmt = $db->prepare("
            SELECT * FROM generated_reports
            WHERE sitecode = :sitecode AND period_month = :month AND period_year = :year
            LIMIT 1
        ");
            $stmt->execute([':sitecode' => $sitecode, ':month' => $month, ':year' => $year]);
            $rep = $stmt->fetch(PDO::FETCH_ASSOC);

            $reportsReal = realpath($reportsDir);
            $cleanSite = preg_replace('/[^a-zA-Z0-9_-]/', '', trim($sitecode));
            $periodMonthName = $monthNames[$month] ?? "Bulan $month";
            $periodStr = "{$periodMonthName} {$year}";

            // 1. Check if specific pdf_path from DB exists on disk
            $pdfAbs = ($rep && !empty($rep['pdf_path'])) ? ($reportsDir . basename($rep['pdf_path'])) : null;

            // 2. If not found or < 1000 bytes, search for existing PDF for this site and period
            if (!$pdfAbs || !file_exists($pdfAbs) || filesize($pdfAbs) < 1000) {
                $matchingPdfs = glob($reportsDir . "*{$cleanSite}*" . strtoupper($periodMonthName) . "*{$year}*.pdf");
                if (!empty($matchingPdfs)) {
                    usort($matchingPdfs, function ($a, $b) {
                        return filemtime($b) - filemtime($a);
                    });
                    if (filesize($matchingPdfs[0]) > 1000) {
                        $pdfAbs = $matchingPdfs[0];
                    }
                }
            }

            // 3. If STILL missing or invalid, generate on the fly
            if (!$pdfAbs || !file_exists($pdfAbs) || filesize($pdfAbs) < 1000) {
                $summary = $rep ? (json_decode($rep['summary_data'] ?? '{}', true) ?: []) : [];
                $keteranganDb = $summary['keterangan_db'] ?? null;
                $reportData = fetchReportBundle($db, $sitecode, $month, $year, $dayNames, $monthNames, $keteranganDb);

                $genDt = null;
                if ($rep && !empty($rep['generated_at'])) {
                    try {
                        $genDt = new DateTime($rep['generated_at']);
                    } catch (Exception $e) {
                    }
                }
                $filenameBase = buildReportExportName($reportData['sitecode'], $reportData['sitename'], $reportData['periode_so'], $genDt ?: new DateTime());
                $reportData['export_filename'] = $filenameBase;
                $docxAbs = $reportsDir . $filenameBase . '.docx';
                $pdfAbs = $reportsDir . $filenameBase . '.pdf';

                buildDocxFromData($reportData, $docxAbs, $db);
                convertDocxToPdf($docxAbs, $pdfAbs, $reportData);

                // Record into generated_reports so state is synchronized
                $summaryJson = json_encode([
                    'sitecode' => $reportData['sitecode'],
                    'sitename' => $reportData['sitename'],
                    'match_qty' => $reportData['match_qty'],
                    'physic_qty' => $reportData['physic_qty'],
                    'db_qty' => $reportData['db_qty'],
                    'pencapaian' => $reportData['pencapaian'],
                    'total_db' => $reportData['total_db'],
                    'solved_db' => $reportData['solved_db'],
                    'unsolved_db' => $reportData['unsolved_db'],
                    'new_db' => $reportData['new_db'],
                    'pic_name' => $reportData['pic_name'],
                    'pic_phone' => $reportData['pic_phone'],
                    'avp_pic' => $reportData['avp_pic'],
                    'avp_title' => $reportData['avp_title'],
                    'fvp_pic' => $reportData['fvp_pic'],
                    'fvp_title' => $reportData['fvp_title'],
                    'keterangan_db' => $reportData['keterangan_db'],
                    'export_filename' => $filenameBase,
                ]);

                $insStmt = $db->prepare("
                    INSERT INTO generated_reports (
                        sitecode, sitename, dept, sub_dept, period_month, period_year,
                        status, pdf_path, docx_path, pic_name, pic_phone,
                        avp_name, avp_title, fvp_name, fvp_title, summary_data,
                        generated_at, updated_at
                    ) VALUES (
                        :sitecode, :sitename, :dept, :sub_dept, :month, :year,
                        'generated', :pdf_path, :docx_path, :pic_name, :pic_phone,
                        :avp_name, :avp_title, :fvp_name, :fvp_title, :summary_data,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (sitecode, period_month, period_year) DO UPDATE SET
                        status = 'generated',
                        pdf_path = EXCLUDED.pdf_path,
                        docx_path = EXCLUDED.docx_path,
                        pic_name = EXCLUDED.pic_name,
                        pic_phone = EXCLUDED.pic_phone,
                        summary_data = EXCLUDED.summary_data,
                        updated_at = CURRENT_TIMESTAMP
                ");
                $insStmt->execute([
                    ':sitecode' => $reportData['sitecode'],
                    ':sitename' => $reportData['sitename'],
                    ':dept' => $reportData['dept'],
                    ':sub_dept' => $reportData['sub_dept'],
                    ':month' => $month,
                    ':year' => $year,
                    ':pdf_path' => 'uploads/reports/' . $filenameBase . '.pdf',
                    ':docx_path' => 'uploads/reports/' . $filenameBase . '.docx',
                    ':pic_name' => $reportData['pic_name'],
                    ':pic_phone' => $reportData['pic_phone'],
                    ':avp_name' => $reportData['avp_pic'],
                    ':avp_title' => $reportData['avp_title'],
                    ':fvp_name' => $reportData['fvp_pic'],
                    ':fvp_title' => $reportData['fvp_title'],
                    ':summary_data' => $summaryJson
                ]);
            }

            clearstatcache(true);
            $pdfReal = ($pdfAbs && is_file($pdfAbs) && filesize($pdfAbs) > 1000) ? realpath($pdfAbs) : false;

            if ($pdfReal === false) {
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success' => false,
                    'message' => 'Gagal menghasilkan file PDF. Silakan coba klik Generate / Regenerate kembali.'
                ]);
                exit;
            }

            $downloadName = basename($pdfReal);
            if (stripos($downloadName, 'BERITA ACARA TINDAK LANJUT DB-') === 0) {
                $downloadName = 'Berita Acara Tindak Lanjut DB-' . substr($downloadName, strlen('BERITA ACARA TINDAK LANJUT DB-'));
            }
            $cleanDownloadName = str_replace(['"', "'", ',', ';'], '', $downloadName);
            if (!preg_match('/\.pdf$/i', $cleanDownloadName)) {
                $cleanDownloadName .= '.pdf';
            }

            while (ob_get_level()) {
                ob_end_clean();
            }

            header('Content-Type: application/pdf');
            header('Content-Length: ' . filesize($pdfReal));
            header('Content-Disposition: ' . $disposition . '; filename="' . $cleanDownloadName . '"; filename*=UTF-8\'\'' . rawurlencode($cleanDownloadName));
            header('Content-Transfer-Encoding: binary');
            header('Accept-Ranges: bytes');
            header('Cache-Control: public, must-revalidate, max-age=0');
            header('Pragma: public');
            readfile($pdfReal);
            exit;
        }

        // ─────────────────────────────────────────────────────────────────
        // ACTION: generate - Generates BA report docx and pdf
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'POST' && $action === 'generate') {
            header('Content-Type: application/json; charset=utf-8');

            $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
            $sitecode = trim($input['sitecode'] ?? '');
            $month = (int) ($input['month'] ?? 9);
            $year = (int) ($input['year'] ?? 2026);
            $keteranganDb = trim(preg_replace('/\s+/u', ' ', (string) ($input['keterangan_db'] ?? '')));
            $keteranganDb = rtrim($keteranganDb, '. ');

            if ($sitecode === '') {
                echo json_encode(['success' => false, 'message' => 'Sitecode required']);
                exit;
            }
            $today = date('Y-m-d');
            $cutoffDate = sprintf('%04d-%02d-27', $year, $month);
            if ($today < $cutoffDate) {
                echo json_encode(['success' => false, 'message' => 'Laporan periode ini baru dapat diakses per tanggal 27.']);
                exit;
            }
            if (!$checkSiteAccess($sitecode)) {
                echo json_encode(['success' => false, 'message' => 'Akses ditolak: Site bukan bagian dari departemen yang ditugaskan kepada Anda.']);
                exit;
            }
            if ($keteranganDb === '') {
                echo json_encode(['success' => false, 'message' => 'Keterangan DB wajib diisi']);
                exit;
            }
            if (mb_strlen($keteranganDb) > 500) {
                echo json_encode(['success' => false, 'message' => 'Keterangan DB maksimal 500 karakter']);
                exit;
            }

            $reportData = fetchReportBundle($db, $sitecode, $month, $year, $dayNames, $monthNames, $keteranganDb);

            // Generate files: BERITA ACARA TINDAK LANJUT DB-SITECODE_NAMESITE_PERIODE SO_ddmmYYYYHHii
            $filenameBase = buildReportExportName($reportData['sitecode'], $reportData['sitename'], $reportData['periode_so'], new DateTime());
            $reportData['export_filename'] = $filenameBase;
            $docxFilename = "{$filenameBase}.docx";
            $pdfFilename = "{$filenameBase}.pdf";
            $docxPath = $reportsDir . $docxFilename;
            $pdfPath = $reportsDir . $pdfFilename;

            // Remove previously generated files for this site/period (timestamped names would otherwise pile up)
            $oldStmt = $db->prepare("SELECT pdf_path, docx_path FROM generated_reports WHERE sitecode = :sc AND period_month = :m AND period_year = :y");
            $oldStmt->execute([':sc' => $reportData['sitecode'], ':m' => $month, ':y' => $year]);
            if ($old = $oldStmt->fetch(PDO::FETCH_ASSOC)) {
                foreach (['pdf_path', 'docx_path'] as $col) {
                    if (!empty($old[$col])) {
                        $oldAbs = $reportsDir . basename($old[$col]);
                        if (is_file($oldAbs) && basename($oldAbs) !== $pdfFilename && basename($oldAbs) !== $docxFilename) {
                            @unlink($oldAbs);
                        }
                    }
                }
            }

            // Build docx using WordprocessingML template builder or active template
            buildDocxFromData($reportData, $docxPath, $db);

            // Convert to PDF using Word COM if available, or HTML headless browser
            $pdfGenerated = convertDocxToPdf($docxPath, $pdfPath, $reportData);

            // Update database log
            $summaryJson = json_encode([
                'sitecode' => $reportData['sitecode'],
                'sitename' => $reportData['sitename'],
                'match_qty' => $reportData['match_qty'],
                'physic_qty' => $reportData['physic_qty'],
                'db_qty' => $reportData['db_qty'],
                'pencapaian' => $reportData['pencapaian'],
                'total_db' => $reportData['total_db'],
                'solved_db' => $reportData['solved_db'],
                'unsolved_db' => $reportData['unsolved_db'],
                'new_db' => $reportData['new_db'],
                'pic_name' => $reportData['pic_name'],
                'pic_phone' => $reportData['pic_phone'],
                'avp_pic' => $reportData['avp_pic'],
                'avp_title' => $reportData['avp_title'],
                'fvp_pic' => $reportData['fvp_pic'],
                'fvp_title' => $reportData['fvp_title'],
                'keterangan_db' => $keteranganDb,
                'export_filename' => $filenameBase,
            ]);

            $insSql = "
            INSERT INTO generated_reports (
                sitecode, sitename, dept, sub_dept, period_month, period_year,
                status, pdf_path, docx_path, pic_name, pic_phone,
                avp_name, avp_title, fvp_name, fvp_title, summary_data,
                generated_at, updated_at
            ) VALUES (
                :sitecode, :sitename, :dept, :sub_dept, :month, :year,
                'generated', :pdf_path, :docx_path, :pic_name, :pic_phone,
                :avp_name, :avp_title, :fvp_name, :fvp_title, :summary_data,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT (sitecode, period_month, period_year) DO UPDATE SET
                status = 'generated',
                pdf_path = EXCLUDED.pdf_path,
                docx_path = EXCLUDED.docx_path,
                pic_name = EXCLUDED.pic_name,
                pic_phone = EXCLUDED.pic_phone,
                avp_name = EXCLUDED.avp_name,
                avp_title = EXCLUDED.avp_title,
                fvp_name = EXCLUDED.fvp_name,
                fvp_title = EXCLUDED.fvp_title,
                summary_data = EXCLUDED.summary_data,
                generated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        ";
            $insStmt = $db->prepare($insSql);
            $insStmt->execute([
                ':sitecode' => $reportData['sitecode'],
                ':sitename' => $reportData['sitename'],
                ':dept' => $reportData['dept'],
                ':sub_dept' => $reportData['sub_dept'],
                ':month' => $month,
                ':year' => $year,
                ':pdf_path' => 'uploads/reports/' . $pdfFilename,
                ':docx_path' => 'uploads/reports/' . $docxFilename,
                ':pic_name' => $reportData['pic_name'],
                ':pic_phone' => $reportData['pic_phone'],
                ':avp_name' => $reportData['avp_pic'],
                ':avp_title' => $reportData['avp_title'],
                ':fvp_name' => $reportData['fvp_pic'],
                ':fvp_title' => $reportData['fvp_title'],
                ':summary_data' => $summaryJson
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Berita Acara berhasil di-generate!',
                'sitecode' => $reportData['sitecode'],
                'sitename' => $reportData['sitename'],
                'pdf_generated' => $pdfGenerated,
                'pdf_url' => buildReportDownloadUrl($reportData['sitecode'], $month, $year),
                'export_filename' => $pdfFilename,
                'pdf_filename' => $pdfFilename,
                'pic_name' => $reportData['pic_name'],
                'pic_phone' => $reportData['pic_phone'],
                'status' => 'generated'
            ]);
            exit;
        }

        // ─────────────────────────────────────────────────────────────────
        // ACTION: send_whatsapp - Prepare WhatsApp link & update status to sent
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'POST' && $action === 'send') {
            header('Content-Type: application/json; charset=utf-8');

            $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
            $sitecode = trim($input['sitecode'] ?? '');
            $month = (int) ($input['month'] ?? 9);
            $year = (int) ($input['year'] ?? 2026);

            if ($sitecode === '') {
                echo json_encode(['success' => false, 'message' => 'Sitecode required']);
                exit;
            }
            $today = date('Y-m-d');
            $cutoffDate = sprintf('%04d-%02d-27', $year, $month);
            if ($today < $cutoffDate) {
                echo json_encode(['success' => false, 'message' => 'Laporan periode ini baru dapat diakses per tanggal 27.']);
                exit;
            }
            if (!$checkSiteAccess($sitecode)) {
                echo json_encode(['success' => false, 'message' => 'Akses ditolak: Site bukan bagian dari departemen yang ditugaskan kepada Anda.']);
                exit;
            }

            // Fetch report log
            $stmt = $db->prepare("
            SELECT * FROM generated_reports 
            WHERE sitecode = :sitecode AND period_month = :month AND period_year = :year
        ");
            $stmt->execute([':sitecode' => $sitecode, ':month' => $month, ':year' => $year]);
            $rep = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$rep) {
                echo json_encode(['success' => false, 'message' => 'Laporan belum di-generate']);
                exit;
            }

            // Clean phone number for WhatsApp
            $rawPhone = $rep['pic_phone'] ?? '';
            $cleanPhone = preg_replace('/[^0-9]/', '', $rawPhone);
            if (str_starts_with($cleanPhone, '0')) {
                $cleanPhone = '62' . substr($cleanPhone, 1);
            }

            // Ensure physical PDF file exists on disk
            $pdfBasename = basename($rep['pdf_path'] ?? '');
            $pdfAbsFile = $reportsDir . $pdfBasename;
            clearstatcache(true);
            if (empty($pdfBasename) || !file_exists($pdfAbsFile) || filesize($pdfAbsFile) < 1000) {
                $summary = json_decode($rep['summary_data'] ?? '{}', true) ?: [];
                $keteranganDb = $summary['keterangan_db'] ?? null;
                $reportData = fetchReportBundle($db, $sitecode, $month, $year, $dayNames, $monthNames, $keteranganDb);
                $filenameBase = buildReportExportName($reportData['sitecode'], $reportData['sitename'], $reportData['periode_so'], new DateTime());
                $docxAbs = $reportsDir . $filenameBase . '.docx';
                $pdfAbsFile = $reportsDir . $filenameBase . '.pdf';
                buildDocxFromData($reportData, $docxAbs, $db);
                convertDocxToPdf($docxAbs, $pdfAbsFile, $reportData);
                $pdfBasename = $filenameBase . '.pdf';
                $db->prepare("UPDATE generated_reports SET pdf_path = :p, docx_path = :d, updated_at = CURRENT_TIMESTAMP WHERE id = :id")->execute([
                    ':p' => 'uploads/reports/' . $pdfBasename,
                    ':d' => 'uploads/reports/' . $filenameBase . '.docx',
                    ':id' => $rep['id']
                ]);
            }

            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $directPdfUrl = 'uploads/reports/' . rawurlencode($pdfBasename);
            $fullPdfUrl = $protocol . $host . '/' . ltrim($directPdfUrl, '/');
            $monthName = $monthNames[$month] ?? "Bulan $month";

            $message = "Dear Rekan Outlet - " . ($rep['pic_name'] ?: 'PIC') . ",\n\n"
                . "Berikut terlampir dokumen Berita Acara Hasil Asset Opname dan Tindak Lanjut Data DB untuk Site *{$rep['sitecode']} - {$rep['sitename']}* Periode *{$monthName} {$year}*.\n"
                . "Mohon untuk ditinjau dan wajib ditandatangani secara circular melalui email. Terima kasih.\n\n"
                . "Regards,\n"
                . "_Team Asset Management_";

            $waUrl = "https://wa.me/{$cleanPhone}?text=" . rawurlencode($message);

            // Update status to 'sent'
            $upd = $db->prepare("
            UPDATE generated_reports 
            SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
            $upd->execute([':id' => $rep['id']]);

            echo json_encode([
                'success' => true,
                'message' => 'Status berhasil diubah ke Sent!',
                'wa_url' => $waUrl,
                'phone' => $cleanPhone,
                'pic_name' => $rep['pic_name'],
                'pdf_url' => $directPdfUrl,
                'full_pdf_url' => $fullPdfUrl,
                'pdf_filename' => $pdfBasename,
                'message_text' => $message,
                'status' => 'sent'
            ]);
            exit;
        }

        // ─────────────────────────────────────────────────────────────────
        // ACTION: upload_signed - Re-upload signed BA document (PDF/Image)
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'POST' && $action === 'upload_signed') {
            header('Content-Type: application/json; charset=utf-8');
            requireAuth();

            $sitecode = trim($_POST['sitecode'] ?? '');
            $month = (int) ($_POST['month'] ?? (int) date('n'));
            $year = (int) ($_POST['year'] ?? (int) date('Y'));

            if ($sitecode === '') {
                echo json_encode(['success' => false, 'message' => 'Sitecode required']);
                exit;
            }
            if (!$checkSiteAccess($sitecode)) {
                echo json_encode(['success' => false, 'message' => 'Akses ditolak: Site bukan bagian dari departemen Anda.']);
                exit;
            }

            if (!isset($_FILES['signed_file']) || $_FILES['signed_file']['error'] !== UPLOAD_ERR_OK) {
                echo json_encode(['success' => false, 'message' => 'File dokumen bertanda-tangan tidak valid atau belum dipilih']);
                exit;
            }

            $file = $_FILES['signed_file'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
            if (!in_array($ext, $allowedExts, true)) {
                echo json_encode(['success' => false, 'message' => 'Format file harus PDF, JPG, atau PNG']);
                exit;
            }
            if ($file['size'] > 15 * 1024 * 1024) {
                echo json_encode(['success' => false, 'message' => 'Ukuran file maksimal 15MB']);
                exit;
            }

            $cleanSite = preg_replace('/[^a-zA-Z0-9_-]/', '', $sitecode);
            $newFilename = "SIGNED_BA_{$cleanSite}_{$year}_{$month}_" . date('YmdHis') . ".{$ext}";
            $destination = $signedDir . $newFilename;

            if (!move_uploaded_file($file['tmp_name'], $destination)) {
                echo json_encode(['success' => false, 'message' => 'Gagal memindahkan file ke direktori server']);
                exit;
            }

            $relPath = 'uploads/reports/signed/' . $newFilename;
            $upd = $db->prepare("
                UPDATE generated_reports 
                SET uploaded_file_path = :path,
                    uploaded_at = CURRENT_TIMESTAMP,
                    status = 'uploaded',
                    updated_at = CURRENT_TIMESTAMP
                WHERE sitecode = :sc AND period_month = :m AND period_year = :y
            ");
            $upd->execute([
                ':path' => $relPath,
                ':sc' => $sitecode,
                ':m' => $month,
                ':y' => $year
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Dokumen bertanda-tangan berhasil di-upload ulang!',
                'file_path' => $relPath,
                'filename' => $newFilename,
                'status' => 'uploaded',
                'uploaded_pdf_url' => "api/generate_report.php?action=download_signed&inline=1&sitecode=" . rawurlencode($sitecode) . "&month={$month}&year={$year}"
            ]);
            exit;
        }

        // ─────────────────────────────────────────────────────────────────
        // ACTION: verify - Admin verifies uploaded report
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'POST' && $action === 'verify') {
            header('Content-Type: application/json; charset=utf-8');
            requireAuth();

            $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
            $sitecode = trim($input['sitecode'] ?? '');
            $month = (int) ($input['month'] ?? (int) date('n'));
            $year = (int) ($input['year'] ?? (int) date('Y'));

            if ($sitecode === '') {
                echo json_encode(['success' => false, 'message' => 'Sitecode required']);
                exit;
            }
            if (!$checkSiteAccess($sitecode)) {
                echo json_encode(['success' => false, 'message' => 'Akses ditolak']);
                exit;
            }

            $adminUser = getCurrentUser();
            $adminName = $adminUser['name'] ?? $adminUser['username'] ?? 'Administrator';

            $upd = $db->prepare("
                UPDATE generated_reports 
                SET status = 'verified',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = :vby,
                    updated_at = CURRENT_TIMESTAMP
                WHERE sitecode = :sc AND period_month = :m AND period_year = :y
            ");
            $upd->execute([
                ':vby' => $adminName,
                ':sc' => $sitecode,
                ':m' => $month,
                ':y' => $year
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Laporan Berita Acara berhasil diverifikasi!',
                'status' => 'verified',
                'verified_by' => $adminName,
                'verified_at' => date('d/m/Y H:i')
            ]);
            exit;
        }

        // ─────────────────────────────────────────────────────────────────
        // ACTION: reject - Reject report at any verification step and return to 'generated'
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'POST' && $action === 'reject') {
            header('Content-Type: application/json; charset=utf-8');
            requireAuth();

            $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
            $sitecode = trim($input['sitecode'] ?? '');
            $month = (int) ($input['month'] ?? (int) date('n'));
            $year = (int) ($input['year'] ?? (int) date('Y'));

            if ($sitecode === '') {
                echo json_encode(['success' => false, 'message' => 'Sitecode required']);
                exit;
            }
            if (!$checkSiteAccess($sitecode)) {
                echo json_encode(['success' => false, 'message' => 'Akses ditolak: Site bukan bagian dari departemen yang ditugaskan kepada Anda.']);
                exit;
            }

            // Find existing record to clean up uploaded signed file if present
            $selStmt = $db->prepare("
                SELECT id, uploaded_file_path 
                FROM generated_reports 
                WHERE UPPER(sitecode) = UPPER(:sc) AND period_month = :m AND period_year = :y
            ");
            $selStmt->execute([
                ':sc' => $sitecode,
                ':m' => $month,
                ':y' => $year
            ]);
            $existing = $selStmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                echo json_encode(['success' => false, 'message' => 'Laporan tidak ditemukan']);
                exit;
            }

            if (!empty($existing['uploaded_file_path']) && file_exists($existing['uploaded_file_path'])) {
                @unlink($existing['uploaded_file_path']);
            }

            // Reset status back to 'generated', clearing flow timestamps & verifier
            $upd = $db->prepare("
                UPDATE generated_reports 
                SET status = 'generated',
                    sent_at = NULL,
                    uploaded_file_path = NULL,
                    uploaded_at = NULL,
                    verified_at = NULL,
                    verified_by = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            ");
            $upd->execute([':id' => $existing['id']]);

            echo json_encode([
                'success' => true,
                'message' => "Laporan untuk site {$sitecode} berhasil di-reject dan dikembalikan ke status Generated. Tombol Regenerate kini dapat diklik kembali.",
                'status' => 'generated'
            ]);
            exit;
        }

        // ─────────────────────────────────────────────────────────────────
        // ACTION: reset - Delete generated report to reset flow back to Generate button
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'POST' && $action === 'reset') {
            header('Content-Type: application/json; charset=utf-8');
            requireAuth();

            $user = getCurrentUser();
            $isSuperadmin = ($user && strtolower($user['username'] ?? '') === 'd3utsch');
            if (!$user || (empty($user['permissions']['can_reset_report']) && !$isSuperadmin)) {
                echo json_encode(['success' => false, 'message' => 'Anda tidak memiliki hak akses (UAC) untuk me-reset Berita Acara.']);
                exit;
            }

            $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
            $sitecode = trim($input['sitecode'] ?? '');
            $month = (int) ($input['month'] ?? (int) date('n'));
            $year = (int) ($input['year'] ?? (int) date('Y'));

            if ($sitecode === '') {
                echo json_encode(['success' => false, 'message' => 'Sitecode required']);
                exit;
            }
            if (!$checkSiteAccess($sitecode)) {
                echo json_encode(['success' => false, 'message' => 'Akses ditolak']);
                exit;
            }

            // Find existing record to clean up files if present
            $selStmt = $db->prepare("
                SELECT id, pdf_path, docx_path, uploaded_file_path 
                FROM generated_reports 
                WHERE UPPER(sitecode) = UPPER(:sc) AND period_month = :m AND period_year = :y
            ");
            $selStmt->execute([
                ':sc' => $sitecode,
                ':m' => $month,
                ':y' => $year
            ]);
            $existing = $selStmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // Delete physical files safely if they exist
                if (!empty($existing['pdf_path']) && file_exists($existing['pdf_path'])) {
                    @unlink($existing['pdf_path']);
                }
                if (!empty($existing['docx_path']) && file_exists($existing['docx_path'])) {
                    @unlink($existing['docx_path']);
                }
                if (!empty($existing['uploaded_file_path']) && file_exists($existing['uploaded_file_path'])) {
                    @unlink($existing['uploaded_file_path']);
                }

                // Delete record from database
                $delStmt = $db->prepare("
                    DELETE FROM generated_reports 
                    WHERE id = :id
                ");
                $delStmt->execute([':id' => $existing['id']]);
            }

            echo json_encode([
                'success' => true,
                'message' => "Laporan Berita Acara untuk site {$sitecode} berhasil di-reset. Alur laporan telah dikembalikan ke tombol Generate."
            ]);
            exit;
        }

        // ─────────────────────────────────────────────────────────────────
        // ACTION: download_signed - Stream uploaded signed document through PHP
        // ─────────────────────────────────────────────────────────────────
        if ($method === 'GET' && $action === 'download_signed') {
            $sitecode = trim($_GET['sitecode'] ?? '');
            $month = (int) ($_GET['month'] ?? (int) date('n'));
            $year = (int) ($_GET['year'] ?? (int) date('Y'));
            $disposition = (($_GET['inline'] ?? '') === '1') ? 'inline' : 'attachment';

            if ($sitecode === '') {
                http_response_code(400);
                exit('Sitecode required');
            }
            if (!$checkSiteAccess($sitecode)) {
                http_response_code(403);
                exit('Akses ditolak');
            }

            $stmt = $db->prepare("
                SELECT uploaded_file_path 
                FROM generated_reports 
                WHERE sitecode = :sc AND period_month = :m AND period_year = :y 
                LIMIT 1
            ");
            $stmt->execute([':sc' => $sitecode, ':m' => $month, ':y' => $year]);
            $filePath = $stmt->fetchColumn();

            if (empty($filePath)) {
                http_response_code(404);
                exit('Dokumen bertanda-tangan belum di-upload');
            }

            $absPath = __DIR__ . '/../' . ltrim($filePath, '/');
            if (!file_exists($absPath)) {
                http_response_code(404);
                exit('File tidak ditemukan di server');
            }

            $mime = mime_content_type($absPath) ?: 'application/octet-stream';
            $filename = basename($absPath);

            header('Content-Type: ' . $mime);
            header('Content-Disposition: ' . $disposition . '; filename="' . $filename . '"');
            header('Content-Length: ' . filesize($absPath));
            header('Cache-Control: private, max-age=0, must-revalidate');
            readfile($absPath);
            exit;
        }

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error: ' . $e->getMessage()
        ]);
        exit;
    }
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Standardized filename and secure download URL
// ─────────────────────────────────────────────────────────────────────
function buildReportExportName(string $sitecode, string $sitename, string $periodeSo, ?DateTime $dt = null): string
{
    $dt = $dt ?: new DateTime();
    $cleanSite = preg_replace('/[^a-zA-Z0-9_-]/', '', trim($sitecode));
    $cleanName = strtoupper(trim(preg_replace('/[^a-zA-Z0-9_\-\s]/', '', $sitename)));
    $cleanName = preg_replace('/\s+/', ' ', $cleanName);
    $cleanPeriod = strtoupper(trim(preg_replace('/[^a-zA-Z0-9_\-\s]/', '', $periodeSo)));
    $cleanPeriod = preg_replace('/\s+/', ' ', $cleanPeriod);
    $timeStr = $dt->format('dmYHi');
    return "Berita Acara Tindak Lanjut DB-{$cleanSite}_{$cleanName}_{$cleanPeriod}_{$timeStr}";
}

function buildReportDownloadUrl(string $sitecode, int $month, int $year): string
{
    return "api/generate_report.php?action=download&sitecode=" . rawurlencode($sitecode) . "&month={$month}&year={$year}";
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Fetch all data needed to bundle the BA report
// ─────────────────────────────────────────────────────────────────────
function fetchReportBundle(PDO $db, string $sitecode, int $month, int $year, array $dayNames, array $monthNames, ?string $keteranganDb = null): array
{
    if ($keteranganDb === null || trim($keteranganDb) === '') {
        try {
            $savedStmt = $db->prepare("SELECT summary_data->>'keterangan_db' FROM generated_reports WHERE sitecode = :sc AND period_month = :m AND period_year = :y LIMIT 1");
            $savedStmt->execute([':sc' => $sitecode, ':m' => $month, ':y' => $year]);
            $savedKet = $savedStmt->fetchColumn();
            if ($savedKet) {
                $keteranganDb = trim($savedKet);
            }
        } catch (Exception $e) {
            // ignore
        }
    }
    $keteranganDb = ($keteranganDb !== null && trim($keteranganDb) !== '') ? trim($keteranganDb) : 'tidak ada inputan flasma/prisma';

    // 1. Site details from site_regional
    $siteStmt = $db->prepare("
        SELECT sr.sitecode, sr.name_site, sr.dept, sr.sub_dept, COALESCE(sr.divisi, '') as divisi
        FROM site_regional sr
        WHERE UPPER(sr.sitecode) = UPPER(:sitecode)
        LIMIT 1
    ");
    $siteStmt->execute([':sitecode' => $sitecode]);
    $site = $siteStmt->fetch(PDO::FETCH_ASSOC);

    $sitename = $site['name_site'] ?? $sitecode;
    $dept = $site['dept'] ?? '';
    $subDept = $site['sub_dept'] ?? '';
    $divisi = $site['divisi'] ?? '';

    // 2. PIC from site_pics
    $picStmt = $db->prepare("
        SELECT pic, no_telp 
        FROM site_pics 
        WHERE UPPER(sitecode) = UPPER(:sitecode) 
        ORDER BY id DESC LIMIT 1
    ");
    $picStmt->execute([':sitecode' => $sitecode]);
    $picRow = $picStmt->fetch(PDO::FETCH_ASSOC);
    $picName = trim($picRow['pic'] ?? '');
    $picPhone = trim($picRow['no_telp'] ?? '');
    if ($picName === '')
        $picName = 'Panggah Kriesna Mukti'; // fallback sample if not set

    // 3. Circular Sign PICs:
    // Rule:
    // - Associate Vice President: if site has SUBDEPT, lookup circular_pics where sub_dept matches
    // - First Vice President: lookup circular_pics for DEPT (where sub_dept is empty/null/'-' or equals dept)
    $hasSubDept = ($subDept !== '' && $subDept !== '-' && strtoupper($subDept) !== 'NULL');
    $avpTitle = '';
    $avpPic = '';

    if ($hasSubDept) {
        $avpStmt = $db->prepare("
            SELECT job_title, pic
            FROM circular_pics
            WHERE (UPPER(sub_dept) = UPPER(:subdept) OR (UPPER(dept) = UPPER(:dept) AND UPPER(sub_dept) = UPPER(:subdept)))
              AND COALESCE(is_active, TRUE) = TRUE
            ORDER BY id ASC LIMIT 1
        ");
        $avpStmt->execute([':subdept' => $subDept, ':dept' => $dept]);
        $avpRow = $avpStmt->fetch(PDO::FETCH_ASSOC);
        if ($avpRow) {
            $avpTitle = $avpRow['job_title'];
            $avpPic = $avpRow['pic'];
        } else {
            // Default naming convention
            $avpTitle = "Head-Central Java And DIY Operation";
            $avpPic = "Achmad Fauzan";
        }
    }

    // First Vice President (DEPT level)
    $fvpStmt = $db->prepare("
        SELECT job_title, pic
        FROM circular_pics
        WHERE (UPPER(dept) = UPPER(:dept) OR (UPPER(dept) = 'PMD' AND UPPER(sub_dept) = UPPER(:dept)))
          AND (sub_dept IS NULL OR sub_dept = '' OR sub_dept = '-' OR UPPER(sub_dept) = UPPER(dept) OR UPPER(dept) = 'PMD')
          AND COALESCE(is_active, TRUE) = TRUE
        ORDER BY id ASC LIMIT 1
    ");
    $fvpStmt->execute([':dept' => $dept]);
    $fvpRow = $fvpStmt->fetch(PDO::FETCH_ASSOC);
    if ($fvpRow) {
        $fvpTitle = $fvpRow['job_title'];
        $fvpPic = $fvpRow['pic'];
    } else {
        $fvpTitle = "Head-Central Region Operation";
        $fvpPic = "Budi Hermanto";
    }

    // 4. Generation Date (Indonesian text)
    $now = new DateTime();
    $engDay = $now->format('l');
    $dayIndo = $dayNames[$engDay] ?? $engDay;
    $dateIndo = $now->format('j');
    $monthIndo = $monthNames[(int) $now->format('n')] ?? $now->format('F');
    $yearIndo = $now->format('Y');

    // Periode SO
    $periodMonthName = $monthNames[$month] ?? "Bulan $month";
    $periodStr = "{$periodMonthName} {$year}";

    // 5. Stock Opname Result Metrics from asset_reconciliation
    $reconcilStmt = $db->prepare("
        SELECT match_physic_qty, physic_physic_qty, db_physic_qty, total_physic_pct
        FROM asset_reconciliation
        WHERE profile ILIKE :profilePattern
          AND period_month = :month
          AND period_year = :year
        LIMIT 1
    ");
    $reconcilStmt->execute([
        ':profilePattern' => "%$sitecode%",
        ':month' => $month,
        ':year' => $year
    ]);
    $rec = $reconcilStmt->fetch(PDO::FETCH_ASSOC);

    $matchQty = (int) ($rec['match_physic_qty'] ?? 0);
    $physicQty = (int) ($rec['physic_physic_qty'] ?? 0);
    $dbQty = (int) ($rec['db_physic_qty'] ?? 0);
    $pencapaian = $rec['total_physic_pct'] ?? '100%';
    if (is_numeric($pencapaian)) {
        $pencapaian = number_format((float) $pencapaian, 2, '.', '') . '%';
    }

    // 6. Rekap DB followup status (Total DB, Solved, Unsolved) & Lampiran Rincian Perangkat
    // Exactly matches Rekapitulasi Status Penyelesaian DB logic (rekap_db_status.php)
    $isQuarterly = false;
    $groupStmt = $db->prepare("SELECT group_type FROM site_regional WHERE UPPER(sitecode) = UPPER(:sc) LIMIT 1");
    $groupStmt->execute([':sc' => $sitecode]);
    $gType = strtolower(trim((string) $groupStmt->fetchColumn()));
    if ($gType === 'quarterly') {
        $isQuarterly = true;
    }

    if ($isQuarterly) {
        if ($month <= 3) {
            $prevMonth = 12;
            $prevYear = $year - 1;
        } elseif ($month <= 6) {
            $prevMonth = 3;
            $prevYear = $year;
        } elseif ($month <= 9) {
            $prevMonth = 6;
            $prevYear = $year;
        } else {
            $prevMonth = 9;
            $prevYear = $year;
        }
    } else {
        if ($month === 1) {
            $prevMonth = 12;
            $prevYear = $year - 1;
        } else {
            $prevMonth = $month - 1;
            $prevYear = $year;
        }
    }

    $currMonthLabel = ($monthNames[$month] ?? "Bulan $month") . " " . $year;
    $prevMonthLabel = ($monthNames[$prevMonth] ?? "Bulan $prevMonth") . " " . $prevYear;

    $devices = [];
    $totalDb = $dbQty;
    $solvedDb = 0;
    $unsolvedDb = $dbQty;
    $newDb = 0;

    try {
        $sqlRdb = "
            WITH prev AS (
                SELECT DISTINCT ON (TRIM(r.reg_no)) 
                    r.sitecode, TRIM(r.reg_no) as reg_no, r.name, r.sn, r.nbv
                FROM rekap_db_master r
                WHERE r.period_month = :prev_m AND r.period_year = :prev_y AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
                  AND UPPER(TRIM(r.sitecode)) = UPPER(TRIM(:sitecode))
                ORDER BY TRIM(r.reg_no), r.id
            ),
            curr AS (
                SELECT DISTINCT ON (TRIM(r.reg_no)) 
                    r.sitecode, TRIM(r.reg_no) as reg_no, r.name, r.sn, r.nbv
                FROM rekap_db_master r
                WHERE r.period_month = :curr_m AND r.period_year = :curr_y AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
                  AND UPPER(TRIM(r.sitecode)) = UPPER(TRIM(:sitecode))
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
                    END as status
                FROM prev p
                FULL OUTER JOIN curr c ON p.reg_no = c.reg_no
            )
            SELECT reg_no, name, sn, nbv, status
            FROM combined
            ORDER BY status ASC, reg_no ASC
        ";

        $rdbStmt = $db->prepare($sqlRdb);
        $rdbStmt->execute([
            ':prev_m' => $prevMonth,
            ':prev_y' => $prevYear,
            ':curr_m' => $month,
            ':curr_y' => $year,
            ':sitecode' => $sitecode
        ]);
        $deviceRows = $rdbStmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($deviceRows)) {
            $totalDb = count($deviceRows);
            $solvedDb = 0;
            $unsolvedDb = 0;
            $newDb = 0;

            foreach ($deviceRows as $dr) {
                $st = strtolower(trim($dr['status'] ?? ''));
                if ($st === 'solved') {
                    $solvedDb++;
                    $statusLabel = 'SOLVED';
                    $keterangan = "Ada di {$prevMonthLabel}, DB solved di {$currMonthLabel}";
                } elseif ($st === 'unsolved') {
                    $unsolvedDb++;
                    $statusLabel = 'UNSOLVED';
                    $keterangan = "Belum solved (masih tercatat di {$currMonthLabel})";
                } else {
                    $newDb++;
                    $statusLabel = 'NEW DB';
                    $keterangan = "Temuan DB baru di {$currMonthLabel}";
                }

                $nbv = (float) ($dr['nbv'] ?? 0);
                $nbvFormatted = 'Rp ' . number_format($nbv, 2, ',', '.');

                $devices[] = [
                    'reg_no' => trim($dr['reg_no'] ?? '-') ?: '-',
                    'name' => trim($dr['name'] ?? '-') ?: '-',
                    'sn' => trim($dr['sn'] ?? '-') ?: '-',
                    'nbv' => $nbv,
                    'nbv_formatted' => $nbvFormatted,
                    'status' => $statusLabel,
                    'keterangan' => $keterangan
                ];
            }
        }
    } catch (Exception $e) {
        // Table may not have all columns; fall back gracefully
    }

    return [
        'sitecode' => $sitecode,
        'sitename' => $sitename,
        'divisi' => $divisi,
        'dept' => $dept,
        'sub_dept' => $subDept,
        'has_sub_dept' => $hasSubDept,
        // Date
        'gen_day' => $dayIndo,
        'gen_date' => $dateIndo,
        'gen_month' => $monthIndo,
        'gen_year' => $yearIndo,
        'periode_so' => $periodStr,
        // SO metrics
        'match_qty' => $matchQty,
        'physic_qty' => $physicQty,
        'db_qty' => $dbQty,
        'pencapaian' => $pencapaian,
        // Tindak lanjut
        'total_db' => $totalDb,
        'solved_db' => $solvedDb,
        'unsolved_db' => $unsolvedDb,
        'new_db' => $newDb,
        // Signatures
        'pic_name' => $picName,
        'pic_phone' => $picPhone,
        'avp_title' => $avpTitle,
        'avp_pic' => $avpPic,
        'fvp_title' => $fvpTitle,
        'fvp_pic' => $fvpPic,
        'keterangan_db' => $keteranganDb,
        // Devices
        'devices' => $devices
    ];
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Convert DOCX to PDF
// ─────────────────────────────────────────────────────────────────────
function convertDocxToPdf(string $docxPath, string $pdfPath, array $reportData): bool
{
    $dir = dirname($pdfPath);
    if (!is_dir($dir))
        mkdir($dir, 0755, true);

    $isWindows = (PHP_OS_FAMILY === 'Windows');
    $winDocx = $isWindows ? str_replace('/', '\\', realpath($docxPath) ?: $docxPath) : (realpath($docxPath) ?: $docxPath);
    // Only convert slashes on Windows; on Linux this produced an invalid path like "\var\www\..."
    $winPdf = $isWindows ? str_replace('/', '\\', $pdfPath) : $pdfPath;

    // Profile cache dir to avoid Edge/Chrome profile locks
    $userDataDir = $dir . '/.browser_profile';
    if (!is_dir($userDataDir))
        @mkdir($userDataDir, 0777, true);

    // 1. Try Chrome / Edge / Chromium headless printing first (pixel-perfect 2-page PDF)
    $browserPaths = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/snap/bin/chromium'
    ];

    $htmlTemp = dirname($docxPath) . '/' . basename($docxPath, '.docx') . '.temp.html';
    file_put_contents($htmlTemp, getBaHtmlString($reportData, $docxPath));
    $htmlReal = str_replace('\\', '/', realpath($htmlTemp) ?: $htmlTemp);
    $htmlUri = 'file://' . (str_starts_with($htmlReal, '/') ? '' : '/') . $htmlReal;

    // On Linux (Docker, www-data), Chromium needs a writable HOME for its config/crash dirs
    $envPrefix = $isWindows ? '' : 'HOME=/tmp XDG_CONFIG_HOME=/tmp XDG_CACHE_HOME=/tmp ';

    $foundBrowser = false;
    $lastOutput = [];
    foreach ($browserPaths as $bin) {
        if (file_exists($bin)) {
            $foundBrowser = true;
            foreach (['--headless=new', '--headless'] as $headlessFlag) {
                $cmd = sprintf(
                    '%s"%s" %s --disable-gpu --no-sandbox --disable-dev-shm-usage --no-first-run --disable-extensions --disable-crash-reporter --user-data-dir="%s" --no-pdf-header-footer --print-to-pdf-no-header --run-all-compositor-stages-before-draw --print-to-pdf="%s" "%s" 2>&1',
                    $envPrefix,
                    $bin,
                    $headlessFlag,
                    $userDataDir,
                    $winPdf,
                    $htmlUri
                );
                $lastOutput = [];
                @exec($cmd, $lastOutput);
                clearstatcache(true);
                if (file_exists($pdfPath) && filesize($pdfPath) > 1000) {
                    @unlink($htmlTemp);
                    return true;
                }
            }
        }
    }
    @unlink($htmlTemp);
    clearstatcache(true);
    if (!$foundBrowser) {
        error_log('convertDocxToPdf: no Chromium/Chrome/Edge binary found on this server (install "chromium" in the Docker image).');
    } else {
        error_log('convertDocxToPdf: headless browser failed: ' . implode(' | ', array_slice($lastOutput, -5)));
    }

    // 2. Fallback: LibreOffice / soffice (cross-platform enterprise converter)
    $libreBins = [
        'soffice',
        'libreoffice',
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ];
    foreach ($libreBins as $lbin) {
        $checkCmd = (PHP_OS_FAMILY === 'Windows') ? "where $lbin 2>nul" : "which $lbin 2>/dev/null";
        $hasBin = (file_exists($lbin) || @exec($checkCmd));
        if ($hasBin) {
            $loCmd = sprintf(
                '"%s" --headless --convert-to pdf "%s" --outdir "%s" 2>&1',
                $lbin,
                $winDocx,
                $dir
            );
            @exec($loCmd);
            clearstatcache(true);
            if (file_exists($pdfPath) && filesize($pdfPath) > 1000) {
                return true;
            }
        }
    }

    // 3. Fallback: Word COM via PowerShell on Windows if headless browser is not found
    if (PHP_OS_FAMILY === 'Windows') {
        $psCmd = sprintf(
            'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject Word.Application;$w.Visible=$false;$w.DisplayAlerts=0;try{$d=$w.Documents.Open(\'%s\',$false,$true);$d.ExportAsFixedFormat(\'%s\',17);$d.Close($false)}finally{$w.Quit();[System.Runtime.InteropServices.Marshal]::ReleaseComObject($w)|Out-Null}" 2>&1',
            addslashes($winDocx),
            addslashes($winPdf)
        );
        @exec($psCmd);
        clearstatcache(true);
        if (file_exists($pdfPath) && filesize($pdfPath) > 1000) {
            return true;
        }
    }

    return false;
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Resolve active DOCX template from Master Data (template_reports)
// ─────────────────────────────────────────────────────────────────────
function getActiveTemplateDocxPath(?PDO $db = null): ?string
{
    if ($db === null) {
        try {
            $db = getDbConnection();
        } catch (Exception $e) {
            $db = null;
        }
    }

    if ($db !== null) {
        try {
            $stmt = $db->query("
                SELECT file_path FROM template_reports 
                WHERE LOWER(file_ext) = 'docx' OR LOWER(file_type) = 'word'
                ORDER BY updated_at DESC, id DESC 
                LIMIT 1
            ");
            $dbPath = $stmt ? $stmt->fetchColumn() : null;
            if ($dbPath) {
                $candidates = [
                    __DIR__ . '/../' . ltrim($dbPath, '/\\'),
                    __DIR__ . '/../uploads/templates/' . basename($dbPath),
                    dirname(__DIR__) . '/' . ltrim($dbPath, '/\\'),
                ];
                foreach ($candidates as $cand) {
                    if (file_exists($cand) && filesize($cand) > 500) {
                        return $cand;
                    }
                }
            }
        } catch (Exception $e) {
            // ignore
        }
    }

    // Fallbacks in server uploads or database templates
    $fallbacks = [
        __DIR__ . '/../uploads/templates/BA_Asset_Opname_Tindak_Lanjut_DB_20261028_160424.docx',
        __DIR__ . '/../uploads/templates/BA_Asset_Opname_Tindak_Lanjut_DB.docx',
        __DIR__ . '/../database/templates/BA_Asset_Opname_Tindak_Lanjut_DB.docx',
    ];
    foreach ($fallbacks as $fb) {
        if (file_exists($fb) && filesize($fb) > 500) {
            return $fb;
        }
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Extract static "Mengetahui" titles and names from DOCX template
// ─────────────────────────────────────────────────────────────────────
function extractMengetahuiFromDocx(?string $docxPath): ?array
{
    if (!$docxPath || !file_exists($docxPath)) return null;
    $zip = new ZipArchive();
    if ($zip->open($docxPath) !== true) return null;
    $xml = $zip->getFromName('word/document.xml');
    $zip->close();
    if (!$xml) return null;

    $pos = strpos($xml, 'Mengetahui:');
    if ($pos === false) return null;
    $sub = substr($xml, $pos);
    if (!preg_match('/<w:tbl\b[^>]*>(?:(?!<\/w:tbl>).)*?<\/w:tbl>/s', $sub, $mTbl)) return null;

    preg_match_all('/<w:tr\b[^>]*>(?:(?!<\/w:tr>).)*?<\/w:tr>/s', $mTbl[0], $mRows);
    $rows = $mRows[0] ?? [];
    if (count($rows) < 3) return null;

    preg_match_all('/<w:tc\b[^>]*>(?:(?!<\/w:tc>).)*?<\/w:tc>/s', $rows[0], $mCols0);
    $nameRowIdx = count($rows) >= 4 ? 2 : count($rows) - 1;
    preg_match_all('/<w:tc\b[^>]*>(?:(?!<\/w:tc>).)*?<\/w:tc>/s', $rows[$nameRowIdx], $mColsLast);

    $titles = array_map(function ($tc) {
        preg_match_all('/<w:p\b[^>]*>(?:(?!<\/w:p>).)*?<\/w:p>/s', $tc, $mPs);
        $lines = [];
        foreach ($mPs[0] as $p) {
            $t = trim(strip_tags($p));
            if ($t !== '') $lines[] = htmlspecialchars($t);
        }
        return implode('<br>', $lines);
    }, $mCols0[0] ?? []);

    $names = array_map(function ($tc) {
        $n = trim(strip_tags($tc));
        return $n !== '' ? htmlspecialchars($n) : '( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )';
    }, $mColsLast[0] ?? []);

    return ['titles' => $titles, 'names' => $names];
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Populate DOCX template using dynamic placeholders
// ─────────────────────────────────────────────────────────────────────
function buildDocxFromTemplate(array $d, string $targetDocx, ?string $templatePath = null): bool
{
    if (!$templatePath || !file_exists($templatePath)) {
        return false;
    }

    $dir = dirname($targetDocx);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    if (!@copy($templatePath, $targetDocx)) {
        return false;
    }

    $zip = new ZipArchive();
    if ($zip->open($targetDocx) !== true) {
        return false;
    }

    $xml = $zip->getFromName('word/document.xml');
    if (!$xml) {
        $zip->close();
        return false;
    }

    $avpTitle = $d['has_sub_dept'] && !empty($d['avp_title']) ? $d['avp_title'] : 'Head-Central Java And DIY Operation';
    $avpPic = $d['has_sub_dept'] && !empty($d['avp_pic']) ? $d['avp_pic'] : 'Achmad Fauzan';
    $fvpTitle = !empty($d['fvp_title']) ? $d['fvp_title'] : 'Head-Central Region Operation';
    $fvpPic = !empty($d['fvp_pic']) ? $d['fvp_pic'] : 'Budi Hermanto';

    $map = [
        '{Day}' => $d['gen_day'],
        '{Date}' => $d['gen_date'],
        '{Month}' => $d['gen_month'],
        '{Year}' => $d['gen_year'],
        '[HARI]' => $d['gen_day'],
        '[TANGGAL]' => $d['gen_date'],
        '[BULAN]' => $d['gen_month'],
        '[TAHUN]' => $d['gen_year'],

        '{SITECODE}' => $d['sitecode'],
        '{SITENAME}' => $d['sitename'],
        '[SITE ID]' => $d['sitecode'],
        '[SITE NAME]' => $d['sitename'],
        '{Month} {Year}' => $d['periode_so'],
        '{Periode SO}' => $d['periode_so'],
        '[BULAN TAHUN]' => $d['periode_so'],

        '{Result Match}' => (string) $d['match_qty'],
        '{Result Physic}' => (string) $d['physic_qty'],
        '{Result DB}' => (string) $d['db_qty'],
        '{Pencapaian}' => (string) $d['pencapaian'],
        '[MATCH]' => (string) $d['match_qty'],
        '[FISIK]' => (string) $d['physic_qty'],
        '[DB]' => (string) $d['db_qty'],
        '[PENCAPAIAN]' => (string) $d['pencapaian'],

        '{Total DB}' => (string) $d['total_db'],
        '{Solved DB}' => (string) $d['solved_db'],
        '{Unsolved DB}' => (string) $d['unsolved_db'],
        '{New DB}' => (string) ($d['new_db'] ?? 0),
        '[TOTAL DB]' => (string) $d['total_db'],
        '[SOLVED DB]' => (string) $d['solved_db'],
        '[UNSOLVED DB]' => (string) $d['unsolved_db'],
        '[NEW DB]' => (string) ($d['new_db'] ?? 0),

        '{Keterangan DB}' => $d['keterangan_db'] ?? 'tidak ada inputan flasma/prisma',
        '[KETERANGAN DB]' => $d['keterangan_db'] ?? 'tidak ada inputan flasma/prisma',

        // Dynamic signers: Kami yang membuat
        '{PJ_NAME}' => $d['pic_name'],
        '{NAMA_PJ}' => $d['pic_name'],
        '{PJ Name}' => $d['pic_name'],
        '{pj_name}' => $d['pic_name'],
        '[NAMA PJ STOCK OPNAME]' => $d['pic_name'],

        '{AVP_TITLE}' => $avpTitle,
        '{Job Title AVP}' => $avpTitle,
        '{avp_title}' => $avpTitle,
        '[JOB TITLE AVP]' => $avpTitle,

        '{AVP_NAME}' => $avpPic,
        '{NAMA_AVP}' => $avpPic,
        '{avp_pic}' => $avpPic,
        '{AVP Name}' => $avpPic,
        '[NAMA AVP]' => $avpPic,

        '{FVP_TITLE}' => $fvpTitle,
        '{Job Title FVP}' => $fvpTitle,
        '{fvp_title}' => $fvpTitle,
        '[JOB TITLE FVP]' => $fvpTitle,

        '{FVP_NAME}' => $fvpPic,
        '{NAMA_FVP}' => $fvpPic,
        '{fvp_pic}' => $fvpPic,
        '{FVP Name}' => $fvpPic,
        '[NAMA FVP]' => $fvpPic,

        // Backward compatibility for static samples in template
        '( Panggah Kriesna Mukti )' => '( ' . $d['pic_name'] . ' )',
        'Head-Central Java And DIY Operation' => $avpTitle,
        '( Achmad Fauzan )' => '( ' . $avpPic . ' )',
        'Head-Central Region Operation' => $fvpTitle,
        '( Budi Hermanto )' => '( ' . $fvpPic . ' )',
    ];

    foreach ($map as $k => $v) {
        $xml = str_replace($k, htmlspecialchars($v, ENT_XML1, 'UTF-8'), $xml);
    }

    // Dynamic row replication for Lampiran Rincian Perangkat
    if (preg_match('/<w:tr\b[^>]*>(?:(?!<\/w:tr>).)*?\{REGNO\}.*?<\/w:tr>/s', $xml, $mRow)) {
        $templateRow = $mRow[0];
        $newRows = '';
        $devices = $d['devices'] ?? [];
        if (!empty($devices)) {
            $no = 1;
            foreach ($devices as $dev) {
                $rowXml = $templateRow;
                $rowXml = str_replace('{No}', (string) $no++, $rowXml);
                $rowXml = str_replace('{REGNO}', htmlspecialchars($dev['reg_no'], ENT_XML1, 'UTF-8'), $rowXml);
                $rowXml = str_replace('{NAME}', htmlspecialchars($dev['name'], ENT_XML1, 'UTF-8'), $rowXml);
                $rowXml = str_replace('{FOLLOWUP}', htmlspecialchars($dev['status'] . ' - ' . $dev['keterangan'], ENT_XML1, 'UTF-8'), $rowXml);
                $newRows .= $rowXml;
            }
        } else {
            $rowXml = $templateRow;
            $rowXml = str_replace('{No}', '1', $rowXml);
            $rowXml = str_replace('{REGNO}', '-', $rowXml);
            $rowXml = str_replace('{NAME}', 'Tidak ada perangkat dalam rekapitulasi status DB', $rowXml);
            $rowXml = str_replace('{FOLLOWUP}', '-', $rowXml);
            $newRows .= $rowXml;
        }
        $xml = str_replace($templateRow, $newRows, $xml);
    }

    $zip->addFromString('word/document.xml', $xml);
    $zip->close();
    return true;
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Build DOCX (uses Master Data template first, fallback to code)
// ─────────────────────────────────────────────────────────────────────
function buildDocxFromData(array $d, string $targetDocx, ?PDO $db = null): void
{
    $templatePath = getActiveTemplateDocxPath($db);
    if ($templatePath && buildDocxFromTemplate($d, $targetDocx, $templatePath)) {
        return;
    }

    $dir = dirname($targetDocx);
    if (!is_dir($dir))
        mkdir($dir, 0755, true);

    $FONT = 'Arial';
    $x = function ($s) {
        return htmlspecialchars($s ?? '', ENT_XML1 | ENT_QUOTES, 'UTF-8');
    };

    $r = function ($text, $o = []) use ($FONT, $x) {
        $rpr = '<w:rFonts w:ascii="' . $FONT . '" w:hAnsi="' . $FONT . '" w:cs="' . $FONT . '"/>';
        if (!empty($o['b']))
            $rpr .= '<w:b/>';
        if (!empty($o['u']))
            $rpr .= '<w:u w:val="single"/>';
        if (!empty($o['color']))
            $rpr .= '<w:color w:val="' . $o['color'] . '"/>';
        $sz = $o['sz'] ?? 18;
        $rpr .= '<w:sz w:val="' . $sz . '"/><w:szCs w:val="' . $sz . '"/>';
        $parts = explode("\t", $text);
        $out = '';
        foreach ($parts as $i => $p) {
            if ($i > 0)
                $out .= '<w:tab/>';
            if ($p !== '')
                $out .= '<w:t xml:space="preserve">' . $x($p) . '</w:t>';
        }
        return '<w:r><w:rPr>' . $rpr . '</w:rPr>' . $out . '</w:r>';
    };

    $p = function ($runs, $o = []) use ($r) {
        $ppr = '';
        if (!empty($o['tabs'])) {
            $ppr .= '<w:tabs>';
            foreach ($o['tabs'] as $t)
                $ppr .= '<w:tab w:val="left" w:pos="' . $t . '"/>';
            $ppr .= '</w:tabs>';
        }
        $before = $o['before'] ?? 0;
        $after = $o['after'] ?? 0;
        $line = $o['line'] ?? 264;
        $ppr .= '<w:spacing w:before="' . $before . '" w:after="' . $after . '" w:line="' . $line . '" w:lineRule="auto"/>';
        if (isset($o['ind']))
            $ppr .= '<w:ind w:left="' . $o['ind'] . '"' . (isset($o['indR']) ? ' w:right="' . $o['indR'] . '"' : '') . '/>';
        $ppr .= '<w:jc w:val="' . ($o['jc'] ?? 'left') . '"/>';
        if (!empty($o['pageBreakBefore']))
            $ppr .= '<w:pageBreakBefore/>';
        if (is_string($runs))
            $runs = [$runs];
        return '<w:p><w:pPr>' . $ppr . '</w:pPr>' . implode('', $runs) . '</w:p>';
    };

    $borders = function ($tag, $sides, $sz = 6) {
        $s = '<' . $tag . '>';
        foreach (['top', 'left', 'bottom', 'right', 'insideH', 'insideV'] as $side) {
            if (in_array($side, $sides, true)) {
                $s .= '<w:' . $side . ' w:val="single" w:sz="' . $sz . '" w:space="0" w:color="000000"/>';
            } elseif ($tag === 'w:tblBorders') {
                $s .= '<w:' . $side . ' w:val="nil"/>';
            }
        }
        return $s . '</' . $tag . '>';
    };

    $tbl = function ($widths, $rowsXml, $o = []) use ($borders) {
        $total = array_sum($widths);
        $sides = $o['borders'] ?? ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'];
        $xml = '<w:tbl><w:tblPr><w:tblW w:w="' . $total . '" w:type="dxa"/>'
            . '<w:jc w:val="' . ($o['jc'] ?? 'center') . '"/>'
            . $borders('w:tblBorders', $sides)
            . '<w:tblLayout w:type="fixed"/>'
            . '<w:tblCellMar><w:top w:w="30" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="30" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar>'
            . '</w:tblPr><w:tblGrid>';
        foreach ($widths as $w)
            $xml .= '<w:gridCol w:w="' . $w . '"/>';
        return $xml . '</w:tblGrid>' . implode('', $rowsXml) . '</w:tbl>';
    };

    $tr = function ($cellsXml, $o = []) {
        $trpr = '';
        if (!empty($o['h']))
            $trpr .= '<w:trHeight w:val="' . $o['h'] . '" w:hRule="' . ($o['hRule'] ?? 'atLeast') . '"/>';
        if (!empty($o['header']))
            $trpr .= '<w:tblHeader/>';
        $trpr .= '<w:cantSplit/>';
        return '<w:tr><w:trPr>' . $trpr . '</w:trPr>' . implode('', $cellsXml) . '</w:tr>';
    };

    $tc = function ($w, $content, $o = []) use ($p) {
        $tcpr = '<w:tcW w:w="' . $w . '" w:type="dxa"/>';
        if (!empty($o['span']))
            $tcpr .= '<w:gridSpan w:val="' . $o['span'] . '"/>';
        if (!empty($o['vMerge']))
            $tcpr .= $o['vMerge'] === 'restart' ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>';
        if (!empty($o['fill']))
            $tcpr .= '<w:shd w:val="clear" w:color="auto" w:fill="' . $o['fill'] . '"/>';
        $tcpr .= '<w:vAlign w:val="' . ($o['vAlign'] ?? 'center') . '"/>';
        if (is_string($content))
            $content = [$content];
        if (empty($content))
            $content = [$p('')];
        return '<w:tc><w:tcPr>' . $tcpr . '</w:tcPr>' . implode('', $content) . '</w:tc>';
    };

    $ctc = function ($w, $text, $o = []) use ($tc, $p, $r) {
        $lines = explode("\n", (string) $text);
        $ps = [];
        foreach ($lines as $l) {
            $ps[] = $p($r($l, ['b' => $o['b'] ?? false, 'sz' => $o['sz'] ?? 17]), ['jc' => $o['jc'] ?? 'center', 'line' => 240]);
        }
        return $tc($w, $ps, $o);
    };

    $pageW = 11906;
    $pageH = 16838;
    $marL = 1134;
    $marR = 1134;
    $marT = 567;
    $marB = 851;

    // Header (Lintasarta top table)
    $hW = [2750, 3900, 2988];
    $infoTabs = ['tabs' => [900], 'line' => 240, 'ind' => 60];
    $logoRunXml = '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
        . '<wp:extent cx="1400000" cy="358400"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
        . '<wp:docPr id="1" name="Logo Lintasarta" descr="Lintasarta"/>'
        . '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        . '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
        . '<pic:nvPicPr><pic:cNvPr id="1" name="Lintasarta.png"/><pic:cNvPicPr/></pic:nvPicPr>'
        . '<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        . '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1400000" cy="358400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        . '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';

    $fldPage = function ($instr, $def) use ($FONT, $r) {
        $rpr = '<w:rPr><w:rFonts w:ascii="' . $FONT . '" w:hAnsi="' . $FONT . '" w:cs="' . $FONT . '"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>';
        return '<w:r>' . $rpr . '<w:fldChar w:fldCharType="begin"/></w:r>'
            . '<w:r>' . $rpr . '<w:instrText xml:space="preserve"> ' . $instr . ' \* MERGEFORMAT </w:instrText></w:r>'
            . '<w:r>' . $rpr . '<w:fldChar w:fldCharType="separate"/></w:r>'
            . $r($def, ['sz' => 20])
            . '<w:r>' . $rpr . '<w:fldChar w:fldCharType="end"/></w:r>';
    };

    $hdrRows = [
        $tr([
            $tc($hW[0], $p('')),
            $tc($hW[1], $p($r("Berita Acara Hasil Asset\nOpname dan Tindak Lanjut\ndata DB", ['b' => true, 'sz' => 24]), ['jc' => 'center', 'line' => 240]), ['vMerge' => 'restart']),
            $tc($hW[2], $p($logoRunXml, ['jc' => 'center']), ['vMerge' => 'restart'])
        ], ['h' => 280]),
        $tr([$tc($hW[0], $p($r("Versi\t: 1.2", ['sz' => 20]), $infoTabs)), $tc($hW[1], $p(''), ['vMerge' => 'continue']), $tc($hW[2], $p(''), ['vMerge' => 'continue'])], ['h' => 360]),
        $tr([$tc($hW[0], $p([$r("Hal\t: ", ['sz' => 20]), $fldPage('PAGE', '1'), $r(' dari ', ['sz' => 20]), $fldPage('NUMPAGES', '2')], $infoTabs)), $tc($hW[1], $p(''), ['vMerge' => 'continue']), $tc($hW[2], $p(''), ['vMerge' => 'continue'])], ['h' => 360]),
        $tr([$tc($hW[0], $p($r("Label\t: Internal", ['sz' => 20]), $infoTabs)), $tc($hW[1], $p(''), ['vMerge' => 'continue']), $tc($hW[2], $p(''), ['vMerge' => 'continue'])], ['h' => 360]),
    ];
    $headerBody = $tbl($hW, $hdrRows) . $p('', ['after' => 120]);

    // Page 1 Body
    $body = [];
    $introText = "Pada hari ini {$d['gen_day']} , tanggal {$d['gen_date']} bulan {$d['gen_month']} tahun {$d['gen_year']}, kami yang bertanda tangan di bawah ini telah melakukan Asset Opname dan penelusuran secara bersama atas perangkat yang tidak terverifikasi dengan informasi data dibawah ini :";
    $body[] = $p($r($introText), ['jc' => 'both', 'ind' => 200, 'indR' => 200, 'line' => 300, 'after' => 80]);
    $body[] = $p($r('Hasil Asset Opname:'), ['ind' => 200, 'after' => 20]);

    $H = 'D9D9D9';
    $t1W = [1330, 1900, 1500, 950, 950, 950, 1320];
    $body[] = $tbl($t1W, [
        $tr([$ctc($t1W[0], 'Site ID', ['fill' => $H]), $ctc($t1W[1], 'SiteName', ['fill' => $H]), $ctc($t1W[2], 'Periode SO', ['fill' => $H]), $ctc($t1W[3], 'Match', ['fill' => $H]), $ctc($t1W[4], 'Fisik', ['fill' => $H]), $ctc($t1W[5], 'DB', ['fill' => $H]), $ctc($t1W[6], 'Pencapaian', ['fill' => $H])], ['h' => 300]),
        $tr([$ctc($t1W[0], $d['sitecode']), $ctc($t1W[1], $d['sitename']), $ctc($t1W[2], $d['periode_so']), $ctc($t1W[3], (string) $d['match_qty']), $ctc($t1W[4], (string) $d['physic_qty']), $ctc($t1W[5], (string) $d['db_qty']), $ctc($t1W[6], (string) $d['pencapaian'])], ['h' => 480]),
    ]);

    $body[] = $p($r('Tindak lanjut data DB:'), ['ind' => 200, 'before' => 300, 'after' => 20]);
    $t2W = [1330, 1900, 1500, 1050, 1050, 1050, 1070];
    $body[] = $tbl($t2W, [
        $tr([$ctc($t2W[0], 'Site ID', ['fill' => $H]), $ctc($t2W[1], 'Site Name', ['fill' => $H]), $ctc($t2W[2], 'Periode SO', ['fill' => $H]), $ctc($t2W[3], 'Total DB', ['fill' => $H]), $ctc($t2W[4], 'Solved DB', ['fill' => $H]), $ctc($t2W[5], 'Unsolved DB', ['fill' => $H]), $ctc($t2W[6], 'New DB', ['fill' => $H])], ['h' => 520]),
        $tr([$ctc($t2W[0], $d['sitecode']), $ctc($t2W[1], $d['sitename']), $ctc($t2W[2], $d['periode_so']), $ctc($t2W[3], (string) $d['total_db']), $ctc($t2W[4], (string) $d['solved_db']), $ctc($t2W[5], (string) $d['unsolved_db']), $ctc($t2W[6], (string) $d['new_db'])], ['h' => 420]),
    ]);

    $body[] = $p($r('Selanjutnya akan dilakukan update secara Aplikasi dengan menyesuaikan kondisi terkini untuk data yang sudah terverifikasi. Demikian BA ini kami buat untuk menjadi perhatian bersama.'), ['ind' => 200, 'indR' => 200, 'before' => 300, 'line' => 300]);
    $body[] = $p($r('Adapun data DB ini terjadi karena ' . ($d['keterangan_db'] ?? 'tidak ada inputan flasma/prisma') . '.'), ['ind' => 200, 'line' => 300, 'after' => 360]);

    // Signatures:
    // Kami yang membuat:
    $sW = [2980, 2980, 2980];
    $sigOpts = ['borders' => ['top', 'left', 'bottom', 'right', 'insideV']];
    $name = function ($w, $text) use ($ctc) {
        return $ctc($w, $text, ['vAlign' => 'bottom', 'sz' => 16]);
    };
    $title = function ($w, $text) use ($ctc) {
        return $ctc($w, $text, ['vAlign' => 'top', 'sz' => 16]);
    };

    $body[] = $p($r('Kami yang membuat :'), ['jc' => 'center', 'after' => 30]);

    // Determine AVP & FVP columns
    $avpTitleHeader = $d['has_sub_dept'] && $d['avp_title']
        ? "Associate Vice President\n{$d['avp_title']}"
        : "Associate Vice President\nHead-Central Java And DIY Operation";
    $avpPicName = $d['has_sub_dept'] && $d['avp_pic']
        ? "( {$d['avp_pic']} )"
        : "( Achmad Fauzan )";

    $fvpTitleHeader = $d['fvp_title']
        ? "First Vice President\n{$d['fvp_title']}"
        : "First Vice President\nHead-Central Region Operation";
    $fvpPicName = $d['fvp_pic']
        ? "( {$d['fvp_pic']} )"
        : "( Budi Hermanto )";

    $pjName = "( {$d['pic_name']} )";

    $body[] = $tbl($sW, [
        $tr([
            $title($sW[0], 'PJ Stock Opname'),
            $title($sW[1], $avpTitleHeader),
            $title($sW[2], $fvpTitleHeader)
        ], ['h' => 400]),
        $tr([$tc($sW[0], $p('')), $tc($sW[1], $p('')), $tc($sW[2], $p(''))], ['h' => 680]),
        $tr([
            $name($sW[0], $pjName),
            $name($sW[1], $avpPicName),
            $name($sW[2], $fvpPicName)
        ], ['h' => 360]),
    ], $sigOpts);

    // Mengetahui
    $body[] = $p($r('Mengetahui:', ['b' => true, 'u' => true]), ['jc' => 'center', 'before' => 360, 'after' => 0]);
    $body[] = $tbl($sW, [
        $tr([$title($sW[0], 'Engineer-Asset Management'), $title($sW[1], "Associate Vice President\nHead-Asset Management"), $title($sW[2], "PTH\nHead-Asset And Warehouse\nManagement")], ['h' => 400]),
        $tr([$tc($sW[0], $p('')), $tc($sW[1], $p('')), $tc($sW[2], $p(''))], ['h' => 640]),
        $tr([$name($sW[0], '( Andhika Septa Prawira )'), $name($sW[1], '( Indra Vivaldi )'), $name($sW[2], '(Hudi Wahyu Utomo )')], ['h' => 360]),
    ], $sigOpts);

    // Page 2: Lampiran Rincian Perangkat
    $body[] = $p($r('Lampiran Rincian Perangkat :', ['b' => true]), ['ind' => 200, 'pageBreakBefore' => true, 'before' => 240, 'after' => 280]);
    // Widths: total 9638 dxa: NO(500), REG NO(1600), NAME(2400), SN(1400), NBV(1300), Status(1000), Keterangan(1438)
    $t3W = [500, 1600, 2400, 1400, 1300, 1000, 1438];
    $t3Rows = [
        $tr([
            $ctc($t3W[0], 'NO', ['fill' => $H, 'b' => true, 'sz' => 15]),
            $ctc($t3W[1], 'REG NO', ['fill' => $H, 'b' => true, 'sz' => 15]),
            $ctc($t3W[2], 'NAME', ['fill' => $H, 'b' => true, 'sz' => 15]),
            $ctc($t3W[3], 'SN', ['fill' => $H, 'b' => true, 'sz' => 15]),
            $ctc($t3W[4], 'NBV', ['fill' => $H, 'b' => true, 'sz' => 15]),
            $ctc($t3W[5], 'Status', ['fill' => $H, 'b' => true, 'sz' => 15]),
            $ctc($t3W[6], 'Keterangan', ['fill' => $H, 'b' => true, 'sz' => 15])
        ], ['h' => 280, 'header' => true]),
    ];

    if (!empty($d['devices'])) {
        $no = 1;
        foreach ($d['devices'] as $dev) {
            $t3Rows[] = $tr([
                $ctc($t3W[0], (string) $no++, ['sz' => 14]),
                $ctc($t3W[1], $dev['reg_no'], ['sz' => 14]),
                $ctc($t3W[2], $dev['name'], ['sz' => 14, 'jc' => 'left']),
                $ctc($t3W[3], $dev['sn'], ['sz' => 14]),
                $ctc($t3W[4], $dev['nbv_formatted'], ['sz' => 14, 'jc' => 'right']),
                $ctc($t3W[5], $dev['status'], ['sz' => 14, 'b' => true]),
                $ctc($t3W[6], $dev['keterangan'], ['sz' => 13, 'jc' => 'left'])
            ], ['h' => 280]);
        }
    } else {
        $t3Rows[] = $tr([
            $ctc($t3W[0], '1', ['sz' => 14]),
            $ctc($t3W[1], '-', ['sz' => 14]),
            $ctc($t3W[2], 'Tidak ada perangkat dalam rekapitulasi status DB', ['sz' => 14, 'jc' => 'left']),
            $ctc($t3W[3], '-', ['sz' => 14]),
            $ctc($t3W[4], 'Rp 0,00', ['sz' => 14, 'jc' => 'right']),
            $ctc($t3W[5], '-', ['sz' => 14]),
            $ctc($t3W[6], '-', ['sz' => 14, 'jc' => 'left'])
        ], ['h' => 280]);
    }

    // Pad remaining rows up to at least 7 rows
    $rowCount = count($t3Rows);
    for ($i = $rowCount; $i < 8; $i++) {
        $t3Rows[] = $tr([
            $ctc($t3W[0], '', ['sz' => 14]),
            $ctc($t3W[1], '', ['sz' => 14]),
            $ctc($t3W[2], '', ['sz' => 14]),
            $ctc($t3W[3], '', ['sz' => 14]),
            $ctc($t3W[4], '', ['sz' => 14]),
            $ctc($t3W[5], '', ['sz' => 14]),
            $ctc($t3W[6], '', ['sz' => 14])
        ], ['h' => 280]);
    }
    $body[] = $tbl($t3W, $t3Rows);
    $body[] = $p('');

    // Assemble DOCX ZIP
    $ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    $documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<w:document ' . $ns . '><w:body>' . implode('', $body)
        . '<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader1"/>'
        . '<w:pgSz w:w="' . $pageW . '" w:h="' . $pageH . '"/>'
        . '<w:pgMar w:top="' . $marT . '" w:right="' . $marR . '" w:bottom="' . $marB . '" w:left="' . $marL . '" w:header="425" w:footer="425" w:gutter="0"/>'
        . '</w:sectPr></w:body></w:document>';

    $hdrNs = $ns . ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    $headerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' . $hdrNs . '>' . $headerBody . '</w:hdr>';
    $headerRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo_lintasarta.png"/>'
        . '</Relationships>';

    $stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        . '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault>'
        . '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        . '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        . '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
        . '</w:styles>';

    $settingsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/></w:settings>';
    $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Default Extension="png" ContentType="image/png"/>'
        . '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        . '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        . '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
        . '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
        . '</Types>';

    $rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        . '</Relationships>';

    $docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        . '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
        . '<Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
        . '</Relationships>';

    $logoImgPath = __DIR__ . '/../img/Lintasarta.png';
    $logoData = file_exists($logoImgPath) ? file_get_contents($logoImgPath) : '';

    @unlink($targetDocx);
    $zip = new ZipArchive();
    if ($zip->open($targetDocx, ZipArchive::CREATE) === true) {
        $zip->addFromString('[Content_Types].xml', $contentTypes);
        $zip->addFromString('_rels/.rels', $rootRels);
        $zip->addFromString('word/document.xml', $documentXml);
        $zip->addFromString('word/_rels/document.xml.rels', $docRels);
        $zip->addFromString('word/styles.xml', $stylesXml);
        $zip->addFromString('word/settings.xml', $settingsXml);
        $zip->addFromString('word/header1.xml', $headerXml);
        $zip->addFromString('word/_rels/header1.xml.rels', $headerRels);
        if ($logoData !== '') {
            $zip->addFromString('word/media/logo_lintasarta.png', $logoData);
        }
        $zip->close();
    }
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Generate HTML string for preview & headless print
// ─────────────────────────────────────────────────────────────────────
function getBaHtmlString(array $d, ?string $docxPath = null): string
{
    $logoDataUri = '';
    $logoPath = __DIR__ . '/../img/Lintasarta.png';
    if (file_exists($logoPath)) {
        $logoDataUri = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
    }

    $avpHeader = $d['has_sub_dept'] && $d['avp_title']
        ? "Associate Vice President<br><span style='font-size:11px;font-weight:normal;'>" . htmlspecialchars($d['avp_title']) . "</span>"
        : "Associate Vice President<br><span style='font-size:11px;font-weight:normal;'>Head-Central Java And DIY Operation</span>";
    $avpPicText = $d['has_sub_dept'] && $d['avp_pic']
        ? "( " . htmlspecialchars($d['avp_pic']) . " )"
        : "( Achmad Fauzan )";

    $fvpHeader = $d['fvp_title']
        ? "First Vice President<br><span style='font-size:11px;font-weight:normal;'>" . htmlspecialchars($d['fvp_title']) . "</span>"
        : "First Vice President<br><span style='font-size:11px;font-weight:normal;'>Head-Central Region Operation</span>";
    $fvpPicText = $d['fvp_pic']
        ? "( " . htmlspecialchars($d['fvp_pic']) . " )"
        : "( Budi Hermanto )";

    $deviceRowsHtml = '';
    if (!empty($d['devices'])) {
        $no = 1;
        foreach ($d['devices'] as $dev) {
            $badgeColor = '#15803d';
            $badgeBg = '#dcfce7';
            if ($dev['status'] === 'UNSOLVED') {
                $badgeColor = '#b91c1c';
                $badgeBg = '#fee2e2';
            } elseif ($dev['status'] === 'NEW DB') {
                $badgeColor = '#1d4ed8';
                $badgeBg = '#dbeafe';
            }
            $statusBadge = "<span style='display:inline-block;padding:2px 4px;border-radius:3px;font-weight:bold;font-size:7pt;background:{$badgeBg};color:{$badgeColor};'>{$dev['status']}</span>";

            $deviceRowsHtml .= "<tr>"
                . "<td style='text-align:center;padding:3px 2px;border:1px solid #000;font-size:7.5pt;'>" . ($no++) . "</td>"
                . "<td style='text-align:center;padding:3px 3px;border:1px solid #000;font-size:7.5pt;font-weight:600;font-family:monospace;word-break:break-all;'>" . htmlspecialchars($dev['reg_no']) . "</td>"
                . "<td style='text-align:left;padding:3px 4px;border:1px solid #000;font-size:7.5pt;word-break:break-word;'>" . htmlspecialchars($dev['name']) . "</td>"
                . "<td style='text-align:center;padding:3px 3px;border:1px solid #000;font-size:7.5pt;word-break:break-all;'>" . htmlspecialchars($dev['sn']) . "</td>"
                . "<td style='text-align:right;padding:3px 3px;border:1px solid #000;font-size:7.5pt;font-weight:600;white-space:nowrap;'>" . htmlspecialchars($dev['nbv_formatted']) . "</td>"
                . "<td style='text-align:center;padding:3px 2px;border:1px solid #000;font-size:7.5pt;'>" . $statusBadge . "</td>"
                . "<td style='text-align:left;padding:3px 4px;border:1px solid #000;font-size:7pt;word-break:break-word;'>" . htmlspecialchars($dev['keterangan']) . "</td>"
                . "</tr>";
        }
    } else {
        $deviceRowsHtml = "<tr>"
            . "<td style='text-align:center;padding:4px;border:1px solid #000;font-size:7.5pt;'>1</td>"
            . "<td style='text-align:center;padding:4px;border:1px solid #000;font-size:7.5pt;'>-</td>"
            . "<td style='text-align:left;padding:4px;border:1px solid #000;font-size:7.5pt;'>Tidak ada perangkat dalam rekapitulasi status DB</td>"
            . "<td style='text-align:center;padding:4px;border:1px solid #000;font-size:7.5pt;'>-</td>"
            . "<td style='text-align:right;padding:4px;border:1px solid #000;font-size:7.5pt;'>Rp 0,00</td>"
            . "<td style='text-align:center;padding:4px;border:1px solid #000;font-size:7.5pt;'>-</td>"
            . "<td style='text-align:left;padding:4px;border:1px solid #000;font-size:7.5pt;'>-</td>"
            . "</tr>";
    }

    $keteranganDbText = htmlspecialchars($d['keterangan_db'] ?? 'tidak ada inputan flasma/prisma');

    $mengetahuiTitles = [
        'Lead-Asset Management',
        'Associate Vice President<br><span style="font-size:11px;font-weight:normal;">Head-Asset Management</span>',
        'PTH<br><span style="font-size:11px;font-weight:normal;">Head-Asset And Warehouse Management</span>'
    ];
    $mengetahuiNames = [
        '( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )',
        '( Indra Vivaldi )',
        '( Hudi Wahyu Utomo )'
    ];

    $checkDocx = $docxPath ?: getActiveTemplateDocxPath();
    if ($checkDocx && file_exists($checkDocx)) {
        $extracted = extractMengetahuiFromDocx($checkDocx);
        if (!empty($extracted['titles']) && !empty($extracted['names']) && count($extracted['titles']) >= 3) {
            $mengetahuiTitles = $extracted['titles'];
            $mengetahuiNames = $extracted['names'];
        }
    }

    return <<<HTML
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>{$d['export_filename']}</title>
<style>
    *, *::before, *::after {
        box-sizing: border-box;
    }
    @page {
        size: A4 portrait;
        margin: 0;
    }
    @media print {
        @page {
            size: A4 portrait;
            margin: 0;
        }
        body {
            margin: 0 !important;
            padding: 0 !important;
        }
    }
    body {
        font-family: Arial, sans-serif;
        color: #000;
        margin: 0;
        padding: 0;
        font-size: 10pt;
        line-height: 1.3;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .page-container {
        width: 100%;
        max-width: 100%;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    .page {
        page-break-after: always;
        box-sizing: border-box;
        width: 100%;
        padding: 10mm 12mm 10mm 12mm;
    }
    .header-tbl {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
        border: 1px solid #000;
        table-layout: fixed;
    }
    .header-tbl td {
        border: 1px solid #000;
        padding: 4px 6px;
        vertical-align: middle;
        box-sizing: border-box;
    }
    .title-cell {
        text-align: center;
        font-weight: bold;
        font-size: 13.5pt;
        line-height: 1.25;
    }
    .logo-cell {
        text-align: center;
        width: 30%;
    }
    .logo-cell img {
        max-width: 160px;
        height: auto;
    }
    .meta-tbl td {
        font-size: 10pt;
    }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0 14px 0;
        border: 1px solid #000;
        table-layout: fixed;
    }
    .data-table th, .data-table td {
        border: 1px solid #000;
        padding: 5px 6px;
        text-align: center;
        font-size: 9.5pt;
        box-sizing: border-box;
        overflow-wrap: break-word;
        word-break: break-word;
    }
    .data-table th {
        background-color: #D9D9D9;
        font-weight: bold;
    }
    .sig-table {
        width: 100%;
        border-collapse: collapse;
        margin: 6px 0 16px 0;
        border: 1px solid #000;
    }
    .sig-table td {
        border: 1px solid #000;
        text-align: center;
        padding: 4px 6px;
        width: 33.33%;
    }
    .sig-title {
        font-size: 10.5pt;
        font-weight: 500;
        min-height: 40px;
        vertical-align: top;
        padding-top: 6px;
    }
    .sig-space {
        height: 65px;
        vertical-align: middle;
    }
    .sig-name {
        font-size: 10pt;
        font-weight: 500;
        padding-bottom: 6px;
        vertical-align: bottom;
    }
    @media print {
        body { background: transparent; }
        .page { page-break-after: always; }
        .no-print { display: none !important; }
    }
</style>
</head>
<body>
<div class="page-container">

    <!-- PAGE 1 -->
    <div class="page">
        <!-- Header -->
        <table class="header-tbl">
            <tr>
                <td style="width:30%; font-size:10pt;">Versi &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: 1.2</td>
                <td rowspan="3" class="title-cell" style="width:40%;">
                    Berita Acara Hasil Asset Opname dan Tindak Lanjut data DB
                </td>
                <td rowspan="3" class="logo-cell">
                    <img src="{$logoDataUri}" alt="Lintasarta">
                </td>
            </tr>
            <tr>
                <td style="font-size:10pt;">Hal &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: 1 dari 2</td>
            </tr>
            <tr>
                <td style="font-size:10pt;">Label &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Internal</td>
            </tr>
        </table>

        <!-- Intro -->
        <p style="text-align: justify; margin: 12px 0 10px 0; font-size: 10.5pt; text-indent: 10px;">
            Pada hari ini {$d['gen_day']} , tanggal {$d['gen_date']} bulan {$d['gen_month']} tahun {$d['gen_year']}, kami yang bertanda tangan di bawah ini telah melakukan Asset Opname dan penelusuran secara bersama atas perangkat yang tidak terverifikasi dengan informasi data dibawah ini :
        </p>

        <!-- Hasil Asset Opname -->
        <div style="font-weight: 500; margin-top: 10px; font-size: 10.5pt;">Hasil Asset Opname:</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Site ID</th>
                    <th>SiteName</th>
                    <th>Periode SO</th>
                    <th>Match</th>
                    <th>Fisik</th>
                    <th>DB</th>
                    <th>Pencapaian</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>{$d['sitecode']}</td>
                    <td>{$d['sitename']}</td>
                    <td>{$d['periode_so']}</td>
                    <td>{$d['match_qty']}</td>
                    <td>{$d['physic_qty']}</td>
                    <td>{$d['db_qty']}</td>
                    <td>{$d['pencapaian']}</td>
                </tr>
            </tbody>
        </table>

        <!-- Tindak Lanjut data DB -->
        <div style="font-weight: 500; margin-top: 10px; font-size: 10.5pt;">Tindak lanjut data DB:</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Site ID</th>
                    <th>Site Name</th>
                    <th>Periode SO</th>
                    <th>Total DB</th>
                    <th>Solved DB</th>
                    <th>Unsolved DB</th>
                    <th>New DB</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>{$d['sitecode']}</td>
                    <td>{$d['sitename']}</td>
                    <td>{$d['periode_so']}</td>
                    <td>{$d['total_db']}</td>
                    <td>{$d['solved_db']}</td>
                    <td>{$d['unsolved_db']}</td>
                    <td>{$d['new_db']}</td>
                </tr>
            </tbody>
        </table>

        <!-- Text -->
        <p style="text-align: justify; margin: 12px 0 6px 0; font-size: 10.5pt;">
            Selanjutnya akan dilakukan update secara Aplikasi dengan menyesuaikan kondisi terkini untuk data yang sudah terverifikasi. Demikian BA ini kami buat untuk menjadi perhatian bersama.
        </p>
        <p style="margin: 0 0 16px 0; font-size: 10.5pt;">
            Adapun data DB ini terjadi karena {$keteranganDbText}.
        </p>

        <!-- Signatures: Kami yang membuat -->
        <div style="text-align: center; font-size: 10.5pt; margin-bottom: 4px;">Kami yang membuat :</div>
        <table class="sig-table">
            <tr>
                <td class="sig-title">PJ Stock Opname</td>
                <td class="sig-title">{$avpHeader}</td>
                <td class="sig-title">{$fvpHeader}</td>
            </tr>
            <tr>
                <td class="sig-space"></td>
                <td class="sig-space"></td>
                <td class="sig-space"></td>
            </tr>
            <tr>
                <td class="sig-name">( {$d['pic_name']} )</td>
                <td class="sig-name">{$avpPicText}</td>
                <td class="sig-name">{$fvpPicText}</td>
            </tr>
        </table>

        <!-- Signatures: Mengetahui -->
        <div style="text-align: center; font-size: 10.5pt; margin-top: 14px; margin-bottom: 4px; font-weight: bold; text-decoration: underline;">
            Mengetahui:
        </div>
        <table class="sig-table">
            <tr>
                <td class="sig-title">{$mengetahuiTitles[0]}</td>
                <td class="sig-title">{$mengetahuiTitles[1]}</td>
                <td class="sig-title">{$mengetahuiTitles[2]}</td>
            </tr>
            <tr>
                <td class="sig-space"></td>
                <td class="sig-space"></td>
                <td class="sig-space"></td>
            </tr>
            <tr>
                <td class="sig-name">{$mengetahuiNames[0]}</td>
                <td class="sig-name">{$mengetahuiNames[1]}</td>
                <td class="sig-name">{$mengetahuiNames[2]}</td>
            </tr>
        </table>
    </div>

    <!-- PAGE 2 -->
    <div class="page">
        <!-- Header -->
        <table class="header-tbl">
            <tr>
                <td style="width:30%; font-size:10pt;">Versi &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: 1.2</td>
                <td rowspan="3" class="title-cell" style="width:40%;">
                    Berita Acara Hasil Asset Opname dan Tindak Lanjut data DB
                </td>
                <td rowspan="3" class="logo-cell">
                    <img src="{$logoDataUri}" alt="Lintasarta">
                </td>
            </tr>
            <tr>
                <td style="font-size:10pt;">Hal &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: 2 dari 2</td>
            </tr>
            <tr>
                <td style="font-size:10pt;">Label &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Internal</td>
            </tr>
        </table>

        <div style="font-weight: bold; margin: 16px 0 10px 0; font-size: 11pt;">
            Lampiran Rincian Perangkat :
        </div>

        <table class="data-table" style="margin-top: 8px; font-size: 7.5pt; width: 100%; table-layout: fixed; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="width: 5%; padding: 4px 2px;">NO</th>
                    <th style="width: 18%; padding: 4px 3px;">REG NO</th>
                    <th style="width: 25%; padding: 4px 4px;">NAME</th>
                    <th style="width: 13%; padding: 4px 3px;">SN</th>
                    <th style="width: 14%; padding: 4px 3px;">NBV</th>
                    <th style="width: 10%; padding: 4px 2px;">Status</th>
                    <th style="width: 15%; padding: 4px 4px;">Keterangan</th>
                </tr>
            </thead>
            <tbody>
                {$deviceRowsHtml}
            </tbody>
        </table>
    </div>

</div>
</body>
</html>
HTML;
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Render HTML for browser preview
// ─────────────────────────────────────────────────────────────────────
function renderHtmlBa(array $d): void
{
    header('Content-Type: text/html; charset=utf-8');
    $tpl = getActiveTemplateDocxPath();
    echo getBaHtmlString($d, $tpl);
}
