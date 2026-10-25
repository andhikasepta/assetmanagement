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
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_site_period UNIQUE (sitecode, period_month, period_year)
        );
        CREATE INDEX IF NOT EXISTS idx_gen_reports_sitecode ON generated_reports(sitecode);
        CREATE INDEX IF NOT EXISTS idx_gen_reports_period ON generated_reports(period_month, period_year);
        CREATE INDEX IF NOT EXISTS idx_gen_reports_status ON generated_reports(status);
    ");

    $reportsDir = __DIR__ . '/../uploads/reports/';
    if (!is_dir($reportsDir)) {
        mkdir($reportsDir, 0755, true);
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
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
    ];

    // ─────────────────────────────────────────────────────────────────
    // ACTION: list - Get sites list with status & SO metrics
    // ─────────────────────────────────────────────────────────────────
    if ($method === 'GET' && $action === 'list') {
        header('Content-Type: application/json; charset=utf-8');

        $month = (int)($_GET['month'] ?? 9);
        $year  = (int)($_GET['year'] ?? 2026);
        $dept  = trim($_GET['dept'] ?? 'all');
        $subDept = trim($_GET['sub_dept'] ?? 'all');
        $statusFilter = trim($_GET['status'] ?? 'all');
        $search = trim($_GET['search'] ?? '');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limitParam = $_GET['limit'] ?? '15';
        $limit = ($limitParam === 'all') ? 999999 : max(1, (int)$limitParam);
        $offset = ($page - 1) * $limit;

        $where = ["1=1"];
        $params = [
            ':month' => $month,
            ':year'  => $year
        ];

        if ($dept !== '' && $dept !== 'all') {
            $where[] = "UPPER(COALESCE(sr.dept, '')) = UPPER(:dept)";
            $params[':dept'] = $dept;
        }

        if ($subDept !== '' && $subDept !== 'all') {
            $where[] = "UPPER(COALESCE(sr.sub_dept, '')) = UPPER(:sub_dept)";
            $params[':sub_dept'] = $subDept;
        }

        if ($statusFilter === 'generated') {
            $where[] = "(gr.status = 'generated' OR gr.status = 'sent')";
        } elseif ($statusFilter === 'not_generated' || $statusFilter === 'pending') {
            $where[] = "gr.id IS NULL";
        } elseif ($statusFilter === 'sent') {
            $where[] = "gr.status = 'sent'";
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
        $total = (int)$countStmt->fetchColumn();

        $sql = "
            SELECT 
                sr.sitecode,
                COALESCE(NULLIF(sr.name_site, ''), sr.sitecode) as sitename,
                COALESCE(sr.dept, '-') as dept,
                COALESCE(sr.sub_dept, '-') as sub_dept,
                sp.pic as pic_name,
                sp.no_telp as pic_phone,
                gr.id as report_id,
                gr.status as report_status,
                gr.pdf_path,
                gr.docx_path,
                gr.generated_at,
                gr.sent_at
            FROM site_regional sr
            LEFT JOIN (
                SELECT DISTINCT ON (sitecode) sitecode, pic, no_telp
                FROM site_pics
                ORDER BY sitecode, id DESC
            ) sp ON sp.sitecode = sr.sitecode
            LEFT JOIN generated_reports gr ON gr.sitecode = sr.sitecode AND gr.period_month = :month AND gr.period_year = :year
            WHERE $whereSql
            GROUP BY sr.sitecode, sr.name_site, sr.dept, sr.sub_dept, sp.pic, sp.no_telp, gr.id, gr.status, gr.pdf_path, gr.docx_path, gr.generated_at, gr.sent_at
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

        // Fetch distinct depts and sub_depts
        $depts = $db->query("
            SELECT DISTINCT dept FROM site_regional WHERE dept IS NOT NULL AND TRIM(dept) != '' ORDER BY dept ASC
        ")->fetchAll(PDO::FETCH_COLUMN);

        $subDepts = $db->query("
            SELECT DISTINCT sub_dept FROM site_regional WHERE sub_dept IS NOT NULL AND TRIM(sub_dept) != '' ORDER BY sub_dept ASC
        ")->fetchAll(PDO::FETCH_COLUMN);

        // Calculate card counts (Total sites, Generated, Sent, Not Generated)
        $statStmt = $db->prepare("
            SELECT 
                COUNT(DISTINCT sr.sitecode) as total_sites,
                COUNT(DISTINCT CASE WHEN gr.id IS NOT NULL THEN sr.sitecode END) as total_generated,
                COUNT(DISTINCT CASE WHEN gr.status = 'sent' THEN sr.sitecode END) as total_sent,
                COUNT(DISTINCT CASE WHEN gr.id IS NULL THEN sr.sitecode END) as total_not_generated,
                COUNT(DISTINCT CASE WHEN gr.id IS NULL THEN sr.sitecode END) as total_pending
            FROM site_regional sr
            LEFT JOIN generated_reports gr ON gr.sitecode = sr.sitecode AND gr.period_month = :month AND gr.period_year = :year
        ");
        $statStmt->execute([':month' => $month, ':year' => $year]);
        $stats = $statStmt->fetch(PDO::FETCH_ASSOC) ?: [
            'total_sites' => 0, 'total_generated' => 0, 'total_sent' => 0, 'total_not_generated' => 0, 'total_pending' => 0
        ];

        echo json_encode([
            'success' => true,
            'data' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limitParam,
            'total_pages' => ($limitParam === 'all') ? 1 : (int)ceil($total / $limit),
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
        $month = (int)($_GET['month'] ?? 9);
        $year = (int)($_GET['year'] ?? 2026);

        if ($sitecode === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Sitecode required']);
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
    // ACTION: generate - Generates BA report docx and pdf
    // ─────────────────────────────────────────────────────────────────
    if ($method === 'POST' && $action === 'generate') {
        header('Content-Type: application/json; charset=utf-8');

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $sitecode = trim($input['sitecode'] ?? '');
        $month = (int)($input['month'] ?? 9);
        $year = (int)($input['year'] ?? 2026);

        if ($sitecode === '') {
            echo json_encode(['success' => false, 'message' => 'Sitecode required']);
            exit;
        }

        $reportData = fetchReportBundle($db, $sitecode, $month, $year, $dayNames, $monthNames);

        // Generate files
        $safeSite = preg_replace('/[^a-zA-Z0-9_-]/', '_', $sitecode);
        $filenameBase = "BA_Asset_Opname_{$safeSite}_{$year}_{$month}";
        $docxFilename = "{$filenameBase}.docx";
        $pdfFilename = "{$filenameBase}.pdf";
        $docxPath = $reportsDir . $docxFilename;
        $pdfPath = $reportsDir . $pdfFilename;

        // Build docx using WordprocessingML template builder
        buildDocxFromData($reportData, $docxPath);

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
            'pic_name' => $reportData['pic_name'],
            'pic_phone' => $reportData['pic_phone'],
            'avp_pic' => $reportData['avp_pic'],
            'avp_title' => $reportData['avp_title'],
            'fvp_pic' => $reportData['fvp_pic'],
            'fvp_title' => $reportData['fvp_title'],
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
            'pdf_url' => 'uploads/reports/' . $pdfFilename,
            'docx_url' => 'uploads/reports/' . $docxFilename,
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
        $month = (int)($input['month'] ?? 9);
        $year = (int)($input['year'] ?? 2026);

        if ($sitecode === '') {
            echo json_encode(['success' => false, 'message' => 'Sitecode required']);
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

        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $baseUrl = $protocol . $host . rtrim(dirname(dirname($_SERVER['PHP_SELF'])), '/\\');
        $pdfFullUrl = $baseUrl . '/' . ltrim($rep['pdf_path'], '/');

        $monthName = $monthNames[$month] ?? "Bulan $month";
        $message = "Halo Bapak/Ibu " . ($rep['pic_name'] ?: 'PIC') . ",\n\n"
            . "Berikut adalah dokumen Berita Acara Hasil Asset Opname dan Tindak Lanjut Data DB untuk Site *{$rep['sitecode']} - {$rep['sitename']}* Periode *{$monthName} {$year}*:\n\n"
            . "📥 Download Dokumen BA (PDF):\n" . $pdfFullUrl . "\n\n"
            . "Mohon untuk ditinjau dan ditandatangani. Terima kasih.\n"
            . "_Dashboard Asset Management - Lintasarta_";

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
            'pdf_url' => $rep['pdf_path'],
            'status' => 'sent'
        ]);
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
// HELPER: Fetch all data needed to bundle the BA report
// ─────────────────────────────────────────────────────────────────────
function fetchReportBundle(PDO $db, string $sitecode, int $month, int $year, array $dayNames, array $monthNames): array {
    // 1. Site details from site_regional
    $siteStmt = $db->prepare("
        SELECT sr.sitecode, sr.name_site, sr.dept, sr.sub_dept
        FROM site_regional sr
        WHERE UPPER(sr.sitecode) = UPPER(:sitecode)
        LIMIT 1
    ");
    $siteStmt->execute([':sitecode' => $sitecode]);
    $site = $siteStmt->fetch(PDO::FETCH_ASSOC);

    $sitename = $site['name_site'] ?? $sitecode;
    $dept = $site['dept'] ?? '';
    $subDept = $site['sub_dept'] ?? '';

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
    if ($picName === '') $picName = 'Panggah Kriesna Mukti'; // fallback sample if not set

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
        WHERE UPPER(dept) = UPPER(:dept)
          AND (sub_dept IS NULL OR sub_dept = '' OR sub_dept = '-' OR UPPER(sub_dept) = UPPER(dept))
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
    $monthIndo = $monthNames[(int)$now->format('n')] ?? $now->format('F');
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

    $matchQty = (int)($rec['match_physic_qty'] ?? 0);
    $physicQty = (int)($rec['physic_physic_qty'] ?? 0);
    $dbQty = (int)($rec['db_physic_qty'] ?? 0);
    $pencapaian = $rec['total_physic_pct'] ?? '100%';
    if (is_numeric($pencapaian)) {
        $pencapaian = round((float)$pencapaian, 2) . '%';
    }

    // 6. Rekap DB followup status (Total DB, Solved, Unsolved)
    $totalDb = $dbQty;
    $solvedDb = 0;
    $unsolvedDb = $dbQty;

    // Check if rekap_db_master has detailed rows for this site
    $dbMasterStmt = $db->prepare("
        SELECT reg_no, name_item, status_desc, is_solved
        FROM rekap_db_master
        WHERE sitecode ILIKE :sitecode
          AND period_month = :month
          AND period_year = :year
        ORDER BY id ASC
        LIMIT 15
    ");
    $devices = [];
    try {
        $dbMasterStmt->execute([
            ':sitecode' => "%$sitecode%",
            ':month' => $month,
            ':year' => $year
        ]);
        $deviceRows = $dbMasterStmt->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($deviceRows)) {
            $totalDb = count($deviceRows);
            $solvedDb = 0;
            foreach ($deviceRows as $dr) {
                if (!empty($dr['is_solved'])) $solvedDb++;
                $devices[] = [
                    'reg_no' => $dr['reg_no'] ?? '-',
                    'name' => $dr['name_item'] ?? '-',
                    'followup' => !empty($dr['is_solved']) ? 'Done' : ($dr['status_desc'] ?? 'Unsolved')
                ];
            }
            $unsolvedDb = max(0, $totalDb - $solvedDb);
        }
    } catch (Exception $e) {
        // Table may not have all columns; fall back gracefully
    }

    return [
        'sitecode' => $sitecode,
        'sitename' => $sitename,
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
        // Signatures
        'pic_name' => $picName,
        'pic_phone' => $picPhone,
        'avp_title' => $avpTitle,
        'avp_pic' => $avpPic,
        'fvp_title' => $fvpTitle,
        'fvp_pic' => $fvpPic,
        // Devices
        'devices' => $devices
    ];
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Convert DOCX to PDF
// ─────────────────────────────────────────────────────────────────────
function convertDocxToPdf(string $docxPath, string $pdfPath, array $reportData): bool {
    $dir = dirname($pdfPath);
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $winDocx = str_replace('/', '\\', realpath($docxPath) ?: $docxPath);
    $winPdf = str_replace('/', '\\', $pdfPath);

    // 1. Try Word COM via PowerShell on Windows (Pixel-perfect 2-page Word export)
    if (PHP_OS_FAMILY === 'Windows') {
        $psCmd = sprintf(
            'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject Word.Application;$w.Visible=$false;$w.DisplayAlerts=0;try{$d=$w.Documents.Open(\'%s\',$false,$true);$d.ExportAsFixedFormat(\'%s\',17);$d.Close($false)}finally{$w.Quit();[System.Runtime.InteropServices.Marshal]::ReleaseComObject($w)|Out-Null}" 2>&1',
            addslashes($winDocx),
            addslashes($winPdf)
        );
        @exec($psCmd);
        if (file_exists($pdfPath) && filesize($pdfPath) > 1000) {
            return true;
        }
    }

    // 2. Try Chrome / Edge headless printing with --no-pdf-header-footer
    $chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];

    $htmlTemp = dirname($docxPath) . '/' . basename($docxPath, '.docx') . '.temp.html';
    file_put_contents($htmlTemp, getBaHtmlString($reportData));

    foreach ($chromePaths as $bin) {
        if (file_exists($bin)) {
            $cmd = sprintf(
                '"%s" --headless --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw --print-to-pdf="%s" "%s" 2>&1',
                $bin,
                $pdfPath,
                $htmlTemp
            );
            @exec($cmd);
            if (file_exists($pdfPath) && filesize($pdfPath) > 1000) {
                @unlink($htmlTemp);
                return true;
            }
        }
    }

    @unlink($htmlTemp);
    return false;
}

// ─────────────────────────────────────────────────────────────────────
// HELPER: Build DOCX using WordprocessingML
// ─────────────────────────────────────────────────────────────────────
function buildDocxFromData(array $d, string $targetDocx): void {
    $dir = dirname($targetDocx);
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $FONT = 'Arial';
    $x = function ($s) { return htmlspecialchars($s ?? '', ENT_XML1 | ENT_QUOTES, 'UTF-8'); };

    $r = function ($text, $o = []) use ($FONT, $x) {
        $rpr = '<w:rFonts w:ascii="' . $FONT . '" w:hAnsi="' . $FONT . '" w:cs="' . $FONT . '"/>';
        if (!empty($o['b'])) $rpr .= '<w:b/>';
        if (!empty($o['u'])) $rpr .= '<w:u w:val="single"/>';
        if (!empty($o['color'])) $rpr .= '<w:color w:val="' . $o['color'] . '"/>';
        $sz = $o['sz'] ?? 18;
        $rpr .= '<w:sz w:val="' . $sz . '"/><w:szCs w:val="' . $sz . '"/>';
        $parts = explode("\t", $text);
        $out = '';
        foreach ($parts as $i => $p) {
            if ($i > 0) $out .= '<w:tab/>';
            if ($p !== '') $out .= '<w:t xml:space="preserve">' . $x($p) . '</w:t>';
        }
        return '<w:r><w:rPr>' . $rpr . '</w:rPr>' . $out . '</w:r>';
    };

    $p = function ($runs, $o = []) use ($r) {
        $ppr = '';
        if (!empty($o['tabs'])) {
            $ppr .= '<w:tabs>';
            foreach ($o['tabs'] as $t) $ppr .= '<w:tab w:val="left" w:pos="' . $t . '"/>';
            $ppr .= '</w:tabs>';
        }
        $before = $o['before'] ?? 0;
        $after  = $o['after'] ?? 0;
        $line   = $o['line'] ?? 264;
        $ppr .= '<w:spacing w:before="' . $before . '" w:after="' . $after . '" w:line="' . $line . '" w:lineRule="auto"/>';
        if (isset($o['ind'])) $ppr .= '<w:ind w:left="' . $o['ind'] . '"' . (isset($o['indR']) ? ' w:right="' . $o['indR'] . '"' : '') . '/>';
        $ppr .= '<w:jc w:val="' . ($o['jc'] ?? 'left') . '"/>';
        if (!empty($o['pageBreakBefore'])) $ppr .= '<w:pageBreakBefore/>';
        if (is_string($runs)) $runs = [$runs];
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
        foreach ($widths as $w) $xml .= '<w:gridCol w:w="' . $w . '"/>';
        return $xml . '</w:tblGrid>' . implode('', $rowsXml) . '</w:tbl>';
    };

    $tr = function ($cellsXml, $o = []) {
        $trpr = '';
        if (!empty($o['h'])) $trpr .= '<w:trHeight w:val="' . $o['h'] . '" w:hRule="' . ($o['hRule'] ?? 'atLeast') . '"/>';
        if (!empty($o['header'])) $trpr .= '<w:tblHeader/>';
        $trpr .= '<w:cantSplit/>';
        return '<w:tr><w:trPr>' . $trpr . '</w:trPr>' . implode('', $cellsXml) . '</w:tr>';
    };

    $tc = function ($w, $content, $o = []) use ($p) {
        $tcpr = '<w:tcW w:w="' . $w . '" w:type="dxa"/>';
        if (!empty($o['span'])) $tcpr .= '<w:gridSpan w:val="' . $o['span'] . '"/>';
        if (!empty($o['vMerge'])) $tcpr .= $o['vMerge'] === 'restart' ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>';
        if (!empty($o['fill'])) $tcpr .= '<w:shd w:val="clear" w:color="auto" w:fill="' . $o['fill'] . '"/>';
        $tcpr .= '<w:vAlign w:val="' . ($o['vAlign'] ?? 'center') . '"/>';
        if (is_string($content)) $content = [$content];
        if (empty($content)) $content = [$p('')];
        return '<w:tc><w:tcPr>' . $tcpr . '</w:tcPr>' . implode('', $content) . '</w:tc>';
    };

    $ctc = function ($w, $text, $o = []) use ($tc, $p, $r) {
        $lines = explode("\n", (string)$text);
        $ps = [];
        foreach ($lines as $l) {
            $ps[] = $p($r($l, ['b' => $o['b'] ?? false, 'sz' => $o['sz'] ?? 17]), ['jc' => $o['jc'] ?? 'center', 'line' => 240]);
        }
        return $tc($w, $ps, $o);
    };

    $pageW = 11906; $pageH = 16838;
    $marL = 1134; $marR = 1134; $marT = 567; $marB = 851;

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
        $tr([$ctc($t1W[0], $d['sitecode']), $ctc($t1W[1], $d['sitename']), $ctc($t1W[2], $d['periode_so']), $ctc($t1W[3], (string)$d['match_qty']), $ctc($t1W[4], (string)$d['physic_qty']), $ctc($t1W[5], (string)$d['db_qty']), $ctc($t1W[6], (string)$d['pencapaian'])], ['h' => 480]),
    ]);

    $body[] = $p($r('Tindak lanjut data DB:'), ['ind' => 200, 'before' => 300, 'after' => 20]);
    $t2W = [1330, 1900, 1500, 1300, 1300, 1570];
    $body[] = $tbl($t2W, [
        $tr([$ctc($t2W[0], 'Site ID', ['fill' => $H]), $ctc($t2W[1], 'Site Name', ['fill' => $H]), $ctc($t2W[2], 'Periode SO', ['fill' => $H]), $ctc($t2W[3], 'Total DB', ['fill' => $H]), $ctc($t2W[4], 'Solved DB', ['fill' => $H]), $ctc($t2W[5], 'Unsolved DB', ['fill' => $H])], ['h' => 520]),
        $tr([$ctc($t2W[0], $d['sitecode']), $ctc($t2W[1], $d['sitename']), $ctc($t2W[2], $d['periode_so']), $ctc($t2W[3], (string)$d['total_db']), $ctc($t2W[4], (string)$d['solved_db']), $ctc($t2W[5], (string)$d['unsolved_db'])], ['h' => 420]),
    ]);

    $body[] = $p($r('Selanjutnya akan dilakukan update secara Aplikasi dengan menyesuaikan kondisi terkini untuk data yang sudah terverifikasi. Demikian BA ini kami buat untuk menjadi perhatian bersama.'), ['ind' => 200, 'indR' => 200, 'before' => 300, 'line' => 300]);
    $body[] = $p($r('Adapun data DB ini terjadi karena tidak ada inputan flasma/prisma.'), ['ind' => 200, 'line' => 300, 'after' => 360]);

    // Signatures:
    // Kami yang membuat:
    $sW = [2980, 2980, 2980];
    $sigOpts = ['borders' => ['top', 'left', 'bottom', 'right', 'insideV']];
    $name = function ($w, $text) use ($ctc) { return $ctc($w, $text, ['vAlign' => 'bottom', 'sz' => 16]); };
    $title = function ($w, $text) use ($ctc) { return $ctc($w, $text, ['vAlign' => 'top', 'sz' => 16]); };

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
        $tr([$title($sW[0], 'Lead-Asset Management'), $title($sW[1], "Associate Vice President\nHead-Asset Management"), $title($sW[2], "PTH\nHead-Asset And Warehouse\nManagement")], ['h' => 400]),
        $tr([$tc($sW[0], $p('')), $tc($sW[1], $p('')), $tc($sW[2], $p(''))], ['h' => 640]),
        $tr([$name($sW[0], '(                               )'), $name($sW[1], '( Indra Vivaldi )'), $name($sW[2], '(Hudi Wahyu Utomo )')], ['h' => 360]),
    ], $sigOpts);

    // Page 2: Lampiran Rincian Perangkat
    $body[] = $p($r('Lampiran Rincian Perangkat :', ['b' => true]), ['ind' => 400, 'pageBreakBefore' => true, 'before' => 240, 'after' => 280]);
    $t3W = [620, 2400, 5118, 1500];
    $t3Rows = [
        $tr([$ctc($t3W[0], 'NO', ['fill' => $H, 'b' => true, 'sz' => 16]), $ctc($t3W[1], 'REGNO', ['fill' => $H, 'b' => true, 'sz' => 16]), $ctc($t3W[2], 'NAME', ['fill' => $H, 'b' => true, 'sz' => 16]), $ctc($t3W[3], 'FOLLOWUP', ['fill' => $H, 'b' => true, 'sz' => 16])], ['h' => 280, 'header' => true]),
    ];

    if (!empty($d['devices'])) {
        $no = 1;
        foreach ($d['devices'] as $dev) {
            $t3Rows[] = $tr([
                $ctc($t3W[0], (string)$no++, ['sz' => 16]),
                $ctc($t3W[1], $dev['reg_no'], ['sz' => 16, 'jc' => 'left']),
                $ctc($t3W[2], $dev['name'], ['sz' => 16, 'jc' => 'left']),
                $ctc($t3W[3], $dev['followup'], ['sz' => 16])
            ], ['h' => 280]);
        }
    } else {
        $t3Rows[] = $tr([$ctc($t3W[0], '1', ['sz' => 16]), $ctc($t3W[1], '-', ['sz' => 16, 'jc' => 'left']), $ctc($t3W[2], 'Tidak ada perangkat yang ditindaklanjuti', ['sz' => 16, 'jc' => 'left']), $ctc($t3W[3], 'N/A', ['sz' => 16])], ['h' => 280]);
    }

    // Pad remaining rows up to at least 7 rows
    $rowCount = count($t3Rows);
    for ($i = $rowCount; $i < 8; $i++) {
        $t3Rows[] = $tr([$ctc($t3W[0], '', ['sz' => 16]), $ctc($t3W[1], '', ['sz' => 16]), $ctc($t3W[2], '', ['sz' => 16]), $ctc($t3W[3], '', ['sz' => 16])], ['h' => 280]);
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
function getBaHtmlString(array $d): string {
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
            $deviceRowsHtml .= "<tr>"
                . "<td style='text-align:center;padding:5px;border:1px solid #000;font-size:11px;'>" . ($no++) . "</td>"
                . "<td style='padding:5px;border:1px solid #000;font-size:11px;'>" . htmlspecialchars($dev['reg_no']) . "</td>"
                . "<td style='padding:5px;border:1px solid #000;font-size:11px;'>" . htmlspecialchars($dev['name']) . "</td>"
                . "<td style='text-align:center;padding:5px;border:1px solid #000;font-size:11px;'>" . htmlspecialchars($dev['followup']) . "</td>"
                . "</tr>";
        }
    } else {
        $deviceRowsHtml = "<tr>"
            . "<td style='text-align:center;padding:5px;border:1px solid #000;font-size:11px;'>1</td>"
            . "<td style='padding:5px;border:1px solid #000;font-size:11px;'>-</td>"
            . "<td style='padding:5px;border:1px solid #000;font-size:11px;'>Tidak ada perangkat yang ditindaklanjuti</td>"
            . "<td style='text-align:center;padding:5px;border:1px solid #000;font-size:11px;'>N/A</td>"
            . "</tr>";
    }

    return <<<HTML
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Berita Acara - {$d['sitecode']}</title>
<style>
    @page {
        size: A4 portrait;
        margin: 10mm 15mm 10mm 15mm;
    }
    body {
        font-family: Arial, sans-serif;
        color: #000;
        margin: 0;
        padding: 0;
        font-size: 10pt;
        line-height: 1.3;
        background: #fff;
    }
    .page-container {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
    }
    .page {
        page-break-after: always;
        box-sizing: border-box;
        padding-top: 2px;
    }
    .header-tbl {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 14px;
        border: 1px solid #000;
    }
    .header-tbl td {
        border: 1px solid #000;
        padding: 4px 8px;
        vertical-align: middle;
    }
    .title-cell {
        text-align: center;
        font-weight: bold;
        font-size: 14pt;
        line-height: 1.25;
    }
    .logo-cell {
        text-align: center;
        width: 32%;
    }
    .logo-cell img {
        max-width: 170px;
        height: auto;
    }
    .meta-tbl td {
        font-size: 10pt;
    }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0 16px 0;
        border: 1px solid #000;
    }
    .data-table th, .data-table td {
        border: 1px solid #000;
        padding: 6px 8px;
        text-align: center;
        font-size: 10.5pt;
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
                </tr>
            </tbody>
        </table>

        <!-- Text -->
        <p style="text-align: justify; margin: 12px 0 6px 0; font-size: 10.5pt;">
            Selanjutnya akan dilakukan update secara Aplikasi dengan menyesuaikan kondisi terkini untuk data yang sudah terverifikasi. Demikian BA ini kami buat untuk menjadi perhatian bersama.
        </p>
        <p style="margin: 0 0 16px 0; font-size: 10.5pt;">
            Adapun data DB ini terjadi karena tidak ada inputan flasma/prisma.
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
                <td class="sig-title">Lead-Asset Management</td>
                <td class="sig-title">Associate Vice President<br><span style="font-size:11px;font-weight:normal;">Head-Asset Management</span></td>
                <td class="sig-title">PTH<br><span style="font-size:11px;font-weight:normal;">Head-Asset And Warehouse Management</span></td>
            </tr>
            <tr>
                <td class="sig-space"></td>
                <td class="sig-space"></td>
                <td class="sig-space"></td>
            </tr>
            <tr>
                <td class="sig-name">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</td>
                <td class="sig-name">( Indra Vivaldi )</td>
                <td class="sig-name">( Hudi Wahyu Utomo )</td>
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

        <table class="data-table" style="margin-top: 8px;">
            <thead>
                <tr>
                    <th style="width: 8%;">NO</th>
                    <th style="width: 25%;">REGNO</th>
                    <th style="width: 47%;">NAME</th>
                    <th style="width: 20%;">FOLLOWUP</th>
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
function renderHtmlBa(array $d): void {
    header('Content-Type: text/html; charset=utf-8');
    echo getBaHtmlString($d);
}
