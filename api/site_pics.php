<?php
/**
 * PIC Sites Master Data API Endpoint
 * Handles CRUD and Excel export operations for Site PICs master data
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/security.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);

sendSecurityHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

try {
    $db = getDbConnection();

    // Ensure site_pics table exists
    $db->exec("
        CREATE TABLE IF NOT EXISTS site_pics (
            id SERIAL PRIMARY KEY,
            dept VARCHAR(50),
            sub_dept VARCHAR(50),
            sitecode VARCHAR(50) NOT NULL,
            name_site VARCHAR(255),
            pic VARCHAR(150),
            no_telp VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_site_pics_sitecode ON site_pics (sitecode);
        CREATE INDEX IF NOT EXISTS idx_site_pics_dept ON site_pics (dept);
    ");

    // ── GET: Read / List Operations ──────────────────────────────────
    if ($method === 'GET' && $action === 'list') {
        header('Content-Type: application/json; charset=utf-8');

        $dept = trim($_GET['dept'] ?? 'all');
        $subDept = trim($_GET['sub_dept'] ?? 'all');
        $search = trim($_GET['search'] ?? '');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limitParam = $_GET['limit'] ?? '10';
        $limit = ($limitParam === 'all') ? 999999 : max(1, (int)$limitParam);
        $offset = ($page - 1) * $limit;

        $sortCol = $_GET['sort_col'] ?? 'dept';
        $sortDir = strtolower($_GET['sort_dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

        $allowedSort = [
            'id' => 'sp.id',
            'dept' => 'sp.dept',
            'sub_dept' => 'sp.sub_dept',
            'sitecode' => 'sp.sitecode',
            'name_site' => 'sp.name_site',
            'pic' => 'sp.pic',
            'no_telp' => 'sp.no_telp',
        ];
        $orderByCol = $allowedSort[$sortCol] ?? 'sp.dept';

        $where = ["1=1"];
        $params = [];

        if ($dept !== '' && $dept !== 'all') {
            $where[] = "UPPER(sp.dept) = UPPER(:dept)";
            $params[':dept'] = $dept;
        }

        if ($subDept !== '' && $subDept !== 'all') {
            $where[] = "UPPER(sp.sub_dept) = UPPER(:sub_dept)";
            $params[':sub_dept'] = $subDept;
        }

        if ($search !== '') {
            $where[] = "(
                sp.sitecode ILIKE :search
                OR sp.name_site ILIKE :search
                OR sp.dept ILIKE :search
                OR sp.sub_dept ILIKE :search
                OR sp.pic ILIKE :search
                OR sp.no_telp ILIKE :search
            )";
            $params[':search'] = "%$search%";
        }

        $whereSql = implode(' AND ', $where);

        // Total count
        $countStmt = $db->prepare("SELECT COUNT(*) FROM site_pics sp WHERE $whereSql");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Data query
        $sql = "
            SELECT sp.id, sp.dept, sp.sub_dept, sp.sitecode, sp.name_site, sp.pic, sp.no_telp, sp.created_at, sp.updated_at
            FROM site_pics sp
            WHERE $whereSql
            ORDER BY (CASE WHEN NULLIF(sp.dept, '') IS NULL THEN 1 ELSE 0 END) ASC, $orderByCol $sortDir, sp.sitecode ASC
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

        // Fetch distinct depts and sub_depts for filters
        $depts = $db->query("SELECT DISTINCT dept FROM site_pics WHERE dept IS NOT NULL AND TRIM(dept) != '' ORDER BY dept ASC")->fetchAll(PDO::FETCH_COLUMN);
        $subDepts = $db->query("SELECT DISTINCT sub_dept FROM site_pics WHERE sub_dept IS NOT NULL AND TRIM(sub_dept) != '' ORDER BY sub_dept ASC")->fetchAll(PDO::FETCH_COLUMN);

        $totalPages = ($limitParam === 'all') ? 1 : (int)ceil($total / $limit);

        echo json_encode([
            'success' => true,
            'data' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limitParam,
            'total_pages' => $totalPages,
            'depts' => $depts,
            'sub_depts' => $subDepts
        ]);
        exit;
    }

    // ── GET: Site Options for Modal Autocomplete ─────────────────────
    if ($method === 'GET' && $action === 'site_options') {
        header('Content-Type: application/json; charset=utf-8');
        $stmt = $db->query("
            SELECT DISTINCT sitecode, name_site, dept, sub_dept
            FROM site_regional
            WHERE sitecode IS NOT NULL AND TRIM(sitecode) != ''
            ORDER BY sitecode ASC
        ");
        $sites = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $sites]);
        exit;
    }

    // ── GET: Chat Sites Options for Chat Room Modal ───────────────────
    if ($method === 'GET' && $action === 'chat_sites') {
        header('Content-Type: application/json; charset=utf-8');
        $stmt = $db->query("
            SELECT dept, sub_dept, sitecode, name_site, pic, no_telp
            FROM site_pics
            WHERE sitecode IS NOT NULL AND TRIM(sitecode) != ''
            ORDER BY (CASE WHEN NULLIF(dept, '') IS NULL THEN 1 ELSE 0 END) ASC, dept ASC, sub_dept ASC, sitecode ASC
        ");
        $sites = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $sites]);
        exit;
    }

    // ── GET: Export to Excel ─────────────────────────────────────────
    if ($method === 'GET' && $action === 'export') {
        require_once __DIR__ . '/../vendor/autoload.php';

        $dept = trim($_GET['dept'] ?? 'all');
        $subDept = trim($_GET['sub_dept'] ?? 'all');
        $search = trim($_GET['search'] ?? '');

        $where = ["1=1"];
        $params = [];

        if ($dept !== '' && $dept !== 'all') {
            $where[] = "UPPER(sp.dept) = UPPER(:dept)";
            $params[':dept'] = $dept;
        }

        if ($subDept !== '' && $subDept !== 'all') {
            $where[] = "UPPER(sp.sub_dept) = UPPER(:sub_dept)";
            $params[':sub_dept'] = $subDept;
        }

        if ($search !== '') {
            $where[] = "(
                sp.sitecode ILIKE :search
                OR sp.name_site ILIKE :search
                OR sp.dept ILIKE :search
                OR sp.sub_dept ILIKE :search
                OR sp.pic ILIKE :search
                OR sp.no_telp ILIKE :search
            )";
            $params[':search'] = "%$search%";
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare("
            SELECT sp.dept, sp.sub_dept, sp.sitecode, sp.name_site, sp.pic, sp.no_telp
            FROM site_pics sp
            WHERE $whereSql
            ORDER BY sp.dept ASC, sp.sub_dept ASC, sp.sitecode ASC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('PIC Sites');

        // Header Style
        $headerStyle = [
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
            'alignment' => ['horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER, 'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER],
            'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E3A8A']],
            'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']]]
        ];

        // Title row
        $sheet->setCellValue('A1', 'PIC SITES MASTER DATA');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->setCellValue('A2', 'Tanggal Ekspor: ' . date('d/m/Y H:i:s'));
        $sheet->getStyle('A2')->getFont()->setSize(10)->setItalic(true);

        // Columns
        $cols = ['NO', 'DEPT', 'SUB DEPT', 'SITECODE', 'NAME SITE', 'PIC', 'NO. TELP'];
        $rowIdx = 4;
        foreach ($cols as $i => $title) {
            $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1);
            $sheet->setCellValue($colLetter . $rowIdx, $title);
        }
        $sheet->getStyle('A4:G4')->applyFromArray($headerStyle);
        $sheet->getRowDimension(4)->setRowHeight(26);

        $dataStartRow = 5;
        $curRow = $dataStartRow;
        $no = 1;

        $cellBorder = [
            'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN, 'color' => ['rgb' => 'E2E8F0']]]
        ];

        foreach ($rows as $r) {
            $sheet->setCellValue('A' . $curRow, $no++);
            $sheet->setCellValue('B' . $curRow, $r['dept'] ?? '-');
            $sheet->setCellValue('C' . $curRow, $r['sub_dept'] ?? '-');
            $sheet->setCellValueExplicit('D' . $curRow, (string)($r['sitecode'] ?? '-'), \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            $sheet->setCellValue('E' . $curRow, $r['name_site'] ?? '-');
            $sheet->setCellValue('F' . $curRow, $r['pic'] ?? '-');
            $sheet->setCellValueExplicit('G' . $curRow, (string)($r['no_telp'] ?? '-'), \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);

            $sheet->getStyle('A' . $curRow . ':G' . $curRow)->applyFromArray($cellBorder);
            $sheet->getStyle('A' . $curRow)->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('B' . $curRow)->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('C' . $curRow)->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('D' . $curRow)->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
            $curRow++;
        }

        foreach (range(1, 7) as $c) {
            $sheet->getColumnDimensionByColumn($c)->setAutoSize(true);
        }

        $filename = 'PIC_Sites_Master_Data_' . date('Ymd_His') . '.xlsx';
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: max-age=0');

        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $writer->save('php://output');
        exit;
    }

    // ── POST: Import Excel / CSV ─────────────────────────────────────
    if ($method === 'POST' && $action === 'import') {
        header('Content-Type: application/json; charset=utf-8');
        require_once __DIR__ . '/../vendor/autoload.php';

        $uploadDir = __DIR__ . '/../uploads/';
        $tempPath = null;
        $isUploadedTmp = false;

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
                echo json_encode(['success' => false, 'message' => 'File Excel tidak ditemukan atau gagal diunggah!']);
                exit;
            }

            $file = $_FILES['excel_file'];
            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (!in_array($extension, ['xlsx', 'xls', 'csv'], true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Format file harus berupa .xlsx, .xls, atau .csv!']);
                exit;
            }

            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0750, true);
            }

            $tempPath = $uploadDir . 'pic_import_' . bin2hex(random_bytes(8)) . '.' . $extension;
            if (!move_uploaded_file($file['tmp_name'], $tempPath) && !copy($file['tmp_name'], $tempPath)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Gagal memproses file unggahan']);
                exit;
            }
            $isUploadedTmp = true;
        }

        $replaceExisting = !empty($_POST['replace_existing']) && ($_POST['replace_existing'] === '1' || $_POST['replace_existing'] === 'true');
        $sheetName = trim($_POST['sheet_name'] ?? '');

        try {
            $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($tempPath);
            if (method_exists($reader, 'setReadDataOnly')) {
                $reader->setReadDataOnly(true);
            }

            if ($sheetName !== '') {
                $availableSheets = $reader->listWorksheetNames($tempPath);
                if (in_array($sheetName, $availableSheets, true) && method_exists($reader, 'setLoadSheetsOnly')) {
                    $reader->setLoadSheetsOnly([$sheetName]);
                }
            }

            $spreadsheet = $reader->load($tempPath);
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray(null, true, false, true);

            if (empty($rows)) {
                throw new Exception('File Excel kosong atau tidak memiliki data.');
            }

            // Find header row (search first 10 rows for sitecode)
            $headerRowIdx = null;
            $colMap = [
                'dept' => null,
                'sub_dept' => null,
                'sitecode' => null,
                'name_site' => null,
                'pic' => null,
                'no_telp' => null
            ];

            foreach ($rows as $rIdx => $row) {
                foreach ($row as $colLetter => $cellVal) {
                    $cleaned = strtolower(trim((string)$cellVal));
                    $cleaned = str_replace(['_', '.', ' '], '', $cleaned);
                    if ($cleaned === 'sitecode' || $cleaned === 'site' || $cleaned === 'kodesite') {
                        $headerRowIdx = $rIdx;
                        break 2;
                    }
                }
            }

            if ($headerRowIdx === null) {
                $headerRowIdx = 1;
            }

            // Map columns from header row
            $headerRow = $rows[$headerRowIdx];
            foreach ($headerRow as $colLetter => $cellVal) {
                $val = strtolower(trim((string)$cellVal));
                $norm = str_replace(['_', '.', ' '], '', $val);

                if (in_array($norm, ['sitecode', 'kodesite', 'siteid'], true) || ($norm === 'site' && !$colMap['sitecode'])) {
                    $colMap['sitecode'] = $colLetter;
                } elseif (in_array($norm, ['dept', 'departemen', 'department'], true)) {
                    $colMap['dept'] = $colLetter;
                } elseif (in_array($norm, ['subdept', 'subdepartemen', 'subdepartment'], true)) {
                    $colMap['sub_dept'] = $colLetter;
                } elseif (in_array($norm, ['namesite', 'namasite', 'sitename', 'outletsite', 'lokasi'], true)) {
                    $colMap['name_site'] = $colLetter;
                } elseif (in_array($norm, ['pic', 'namapic', 'personincharge', 'picname', 'petugas'], true)) {
                    $colMap['pic'] = $colLetter;
                } elseif (in_array($norm, ['notelp', 'telepon', 'nohp', 'notelepon', 'whatsapp', 'wa', 'phone', 'telephone', 'contact'], true)) {
                    $colMap['no_telp'] = $colLetter;
                }
            }

            if (!$colMap['sitecode']) {
                throw new Exception('Kolom SITECODE tidak ditemukan pada file Excel. Pastikan terdapat kolom bertuliskan SITECODE.');
            }

            // Pre-fetch site_regional for fallback lookups
            $srStmt = $db->query("SELECT sitecode, name_site, dept, sub_dept FROM site_regional WHERE sitecode IS NOT NULL");
            $srLookup = [];
            while ($srRow = $srStmt->fetch(PDO::FETCH_ASSOC)) {
                $sc = strtoupper(trim($srRow['sitecode']));
                $srLookup[$sc] = $srRow;
            }

            $db->beginTransaction();

            if ($replaceExisting) {
                $db->exec("TRUNCATE TABLE site_pics RESTART IDENTITY");
            }

            // Prepared statements
            $checkStmt = $db->prepare("SELECT id FROM site_pics WHERE UPPER(sitecode) = UPPER(:sc) LIMIT 1");
            $updateStmt = $db->prepare("
                UPDATE site_pics
                SET name_site = COALESCE(NULLIF(:name_site, ''), name_site),
                    dept = COALESCE(NULLIF(:dept, ''), dept),
                    sub_dept = COALESCE(NULLIF(:sub_dept, ''), sub_dept),
                    pic = :pic,
                    no_telp = :no_telp,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            ");
            $insertStmt = $db->prepare("
                INSERT INTO site_pics (sitecode, name_site, dept, sub_dept, pic, no_telp, created_at, updated_at)
                VALUES (:sitecode, :name_site, :dept, :sub_dept, :pic, :no_telp, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ");

            $imported = 0;
            $updated = 0;
            $inserted = 0;
            $skipped = 0;

            foreach ($rows as $rIdx => $row) {
                if ($rIdx <= $headerRowIdx) {
                    continue;
                }

                $sitecode = trim((string)($row[$colMap['sitecode']] ?? ''));
                if ($sitecode === '') {
                    $skipped++;
                    continue;
                }

                $dept = $colMap['dept'] ? trim((string)($row[$colMap['dept']] ?? '')) : '';
                $subDept = $colMap['sub_dept'] ? trim((string)($row[$colMap['sub_dept']] ?? '')) : '';
                $nameSite = $colMap['name_site'] ? trim((string)($row[$colMap['name_site']] ?? '')) : '';
                $pic = $colMap['pic'] ? trim((string)($row[$colMap['pic']] ?? '')) : '';
                $noTelp = $colMap['no_telp'] ? trim((string)($row[$colMap['no_telp']] ?? '')) : '';

                // Fallback from site_regional if name_site / dept / sub_dept is missing
                $scUpper = strtoupper($sitecode);
                if (isset($srLookup[$scUpper])) {
                    if ($nameSite === '') $nameSite = $srLookup[$scUpper]['name_site'] ?? '';
                    if ($dept === '') $dept = $srLookup[$scUpper]['dept'] ?? '';
                    if ($subDept === '') $subDept = $srLookup[$scUpper]['sub_dept'] ?? '';
                }

                // Clean phone number format if scientific notation from Excel
                if (is_numeric($noTelp) && strpos($noTelp, 'E+') !== false) {
                    $noTelp = number_format((float)$noTelp, 0, '', '');
                }

                if ($replaceExisting) {
                    $insertStmt->execute([
                        ':sitecode' => $sitecode,
                        ':name_site' => $nameSite,
                        ':dept' => $dept,
                        ':sub_dept' => $subDept,
                        ':pic' => $pic,
                        ':no_telp' => $noTelp,
                    ]);
                    $inserted++;
                } else {
                    $checkStmt->execute([':sc' => $sitecode]);
                    $existingId = $checkStmt->fetchColumn();

                    if ($existingId) {
                        $updateStmt->execute([
                            ':id' => $existingId,
                            ':name_site' => $nameSite,
                            ':dept' => $dept,
                            ':sub_dept' => $subDept,
                            ':pic' => $pic,
                            ':no_telp' => $noTelp,
                        ]);
                        $updated++;
                    } else {
                        $insertStmt->execute([
                            ':sitecode' => $sitecode,
                            ':name_site' => $nameSite,
                            ':dept' => $dept,
                            ':sub_dept' => $subDept,
                            ':pic' => $pic,
                            ':no_telp' => $noTelp,
                        ]);
                        $inserted++;
                    }
                }
                $imported++;
            }

            $db->commit();

            if ($isUploadedTmp && file_exists($tempPath)) {
                @unlink($tempPath);
            }

            echo json_encode([
                'success' => true,
                'message' => "Impor berhasil! Total diproses: {$imported} data ({$inserted} baru, {$updated} diperbarui).",
                'imported' => $imported,
                'inserted' => $inserted,
                'updated' => $updated,
                'skipped' => $skipped
            ]);
            exit;

        } catch (Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            if ($isUploadedTmp && file_exists($tempPath)) {
                @unlink($tempPath);
            }
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Gagal mengimpor file: ' . $e->getMessage()]);
            exit;
        }
    }

    // ── POST: Save / Update Record ───────────────────────────────────
    if ($method === 'POST' && ($action === 'save' || $action === 'create' || $action === 'update')) {
        header('Content-Type: application/json; charset=utf-8');

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }

        $id = !empty($input['id']) ? (int)$input['id'] : null;
        $sitecode = trim($input['sitecode'] ?? '');
        $nameSite = trim($input['name_site'] ?? '');
        $dept = trim($input['dept'] ?? '');
        $subDept = trim($input['sub_dept'] ?? '');
        $pic = trim($input['pic'] ?? '');
        $noTelp = trim($input['no_telp'] ?? '');

        if ($sitecode === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Sitecode wajib diisi!']);
            exit;
        }

        // If dept or name_site are empty, lookup from site_regional
        if ($nameSite === '' || $dept === '') {
            $srStmt = $db->prepare("SELECT name_site, dept, sub_dept FROM site_regional WHERE UPPER(sitecode) = UPPER(:sc) LIMIT 1");
            $srStmt->execute([':sc' => $sitecode]);
            $srRow = $srStmt->fetch(PDO::FETCH_ASSOC);
            if ($srRow) {
                if ($nameSite === '') $nameSite = $srRow['name_site'] ?? '';
                if ($dept === '') $dept = $srRow['dept'] ?? '';
                if ($subDept === '') $subDept = $srRow['sub_dept'] ?? '';
            }
        }

        if ($id) {
            $stmt = $db->prepare("
                UPDATE site_pics
                SET sitecode = :sitecode,
                    name_site = :name_site,
                    dept = :dept,
                    sub_dept = :sub_dept,
                    pic = :pic,
                    no_telp = :no_telp,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            ");
            $stmt->execute([
                ':sitecode' => $sitecode,
                ':name_site' => $nameSite,
                ':dept' => $dept,
                ':sub_dept' => $subDept,
                ':pic' => $pic,
                ':no_telp' => $noTelp,
                ':id' => $id,
            ]);
            $msg = 'Data PIC Site berhasil diperbarui!';
        } else {
            $stmt = $db->prepare("
                INSERT INTO site_pics (sitecode, name_site, dept, sub_dept, pic, no_telp, created_at, updated_at)
                VALUES (:sitecode, :name_site, :dept, :sub_dept, :pic, :no_telp, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ");
            $stmt->execute([
                ':sitecode' => $sitecode,
                ':name_site' => $nameSite,
                ':dept' => $dept,
                ':sub_dept' => $subDept,
                ':pic' => $pic,
                ':no_telp' => $noTelp,
            ]);
            $id = (int)$db->lastInsertId();
            $msg = 'Data PIC Site berhasil ditambahkan!';
        }

        echo json_encode(['success' => true, 'message' => $msg, 'id' => $id]);
        exit;
    }

    // ── POST: Delete Record ──────────────────────────────────────────
    if ($method === 'POST' && $action === 'delete') {
        header('Content-Type: application/json; charset=utf-8');

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }

        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID data tidak valid!']);
            exit;
        }

        $stmt = $db->prepare("DELETE FROM site_pics WHERE id = :id");
        $stmt->execute([':id' => $id]);

        echo json_encode(['success' => true, 'message' => 'Data PIC Site berhasil dihapus!']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Aksi tidak dikenal!']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
}
