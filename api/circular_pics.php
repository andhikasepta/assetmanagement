<?php
/**
 * Circular Sign PIC Master Data API Endpoint
 * Handles CRUD, Excel export, and Excel import for Circular Sign PICs
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

    // Ensure circular_pics table exists
    $db->exec("
        CREATE TABLE IF NOT EXISTS circular_pics (
            id SERIAL PRIMARY KEY,
            dept VARCHAR(100),
            sub_dept VARCHAR(100),
            pic VARCHAR(150) NOT NULL,
            job_title VARCHAR(150) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE circular_pics ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        CREATE INDEX IF NOT EXISTS idx_circular_pics_dept ON circular_pics (dept);
        CREATE INDEX IF NOT EXISTS idx_circular_pics_pic ON circular_pics (pic);
        CREATE INDEX IF NOT EXISTS idx_circular_pics_active ON circular_pics (is_active);
    ");

    // ── GET: Read / List Operations ──────────────────────────────────
    if ($method === 'GET' && $action === 'list') {
        header('Content-Type: application/json; charset=utf-8');

        $dept = trim($_GET['dept'] ?? 'all');
        $subDept = trim($_GET['sub_dept'] ?? 'all');
        $status = trim($_GET['status'] ?? 'all');
        $search = trim($_GET['search'] ?? '');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limitParam = $_GET['limit'] ?? '10';
        $limit = ($limitParam === 'all') ? 999999 : max(1, (int)$limitParam);
        $offset = ($page - 1) * $limit;

        $sortCol = $_GET['sort_col'] ?? 'dept';
        $sortDir = strtolower($_GET['sort_dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

        $allowedSort = [
            'id' => 'cp.id',
            'dept' => 'cp.dept',
            'sub_dept' => 'cp.sub_dept',
            'pic' => 'cp.pic',
            'job_title' => 'cp.job_title',
            'is_active' => 'cp.is_active',
        ];
        $orderByCol = $allowedSort[$sortCol] ?? 'cp.dept';

        $where = ["1=1"];
        $params = [];

        if ($dept !== '' && $dept !== 'all') {
            $where[] = "UPPER(cp.dept) = UPPER(:dept)";
            $params[':dept'] = $dept;
        }

        if ($subDept !== '' && $subDept !== 'all') {
            $where[] = "UPPER(cp.sub_dept) = UPPER(:sub_dept)";
            $params[':sub_dept'] = $subDept;
        }

        if ($status === 'active') {
            $where[] = "COALESCE(cp.is_active, TRUE) = TRUE";
        } elseif ($status === 'inactive') {
            $where[] = "COALESCE(cp.is_active, TRUE) = FALSE";
        }

        if ($search !== '') {
            $where[] = "(
                cp.dept ILIKE :search
                OR cp.sub_dept ILIKE :search
                OR cp.pic ILIKE :search
                OR cp.job_title ILIKE :search
            )";
            $params[':search'] = "%$search%";
        }

        $whereSql = implode(' AND ', $where);

        // Total count
        $countStmt = $db->prepare("SELECT COUNT(*) FROM circular_pics cp WHERE $whereSql");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Data query
        $sql = "
            SELECT cp.id, cp.dept, cp.sub_dept, cp.pic, cp.job_title, COALESCE(cp.is_active, TRUE) as is_active, cp.created_at, cp.updated_at
            FROM circular_pics cp
            WHERE $whereSql
            ORDER BY (CASE WHEN NULLIF(cp.dept, '') IS NULL THEN 1 ELSE 0 END) ASC, $orderByCol $sortDir, cp.pic ASC
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
        $depts = $db->query("SELECT DISTINCT dept FROM circular_pics WHERE dept IS NOT NULL AND TRIM(dept) != '' ORDER BY dept ASC")->fetchAll(PDO::FETCH_COLUMN);
        $subDepts = $db->query("SELECT DISTINCT sub_dept FROM circular_pics WHERE sub_dept IS NOT NULL AND TRIM(sub_dept) != '' ORDER BY sub_dept ASC")->fetchAll(PDO::FETCH_COLUMN);

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

    // ── GET: Department Options for Modal Suggestions ───────────────
    if ($method === 'GET' && $action === 'dept_options') {
        header('Content-Type: application/json; charset=utf-8');
        $stmt = $db->query("
            SELECT DISTINCT dept, sub_dept
            FROM site_regional
            WHERE dept IS NOT NULL AND TRIM(dept) != ''
            ORDER BY dept ASC, sub_dept ASC
        ");
        $deptOptions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $deptOptions]);
        exit;
    }

    // ── GET: Export to Excel ─────────────────────────────────────────
    if ($method === 'GET' && $action === 'export') {
        require_once __DIR__ . '/../vendor/autoload.php';

        $dept = trim($_GET['dept'] ?? 'all');
        $subDept = trim($_GET['sub_dept'] ?? 'all');
        $status = trim($_GET['status'] ?? 'all');
        $search = trim($_GET['search'] ?? '');

        $where = ["1=1"];
        $params = [];

        if ($dept !== '' && $dept !== 'all') {
            $where[] = "UPPER(cp.dept) = UPPER(:dept)";
            $params[':dept'] = $dept;
        }

        if ($subDept !== '' && $subDept !== 'all') {
            $where[] = "UPPER(cp.sub_dept) = UPPER(:sub_dept)";
            $params[':sub_dept'] = $subDept;
        }

        if ($status === 'active') {
            $where[] = "COALESCE(cp.is_active, TRUE) = TRUE";
        } elseif ($status === 'inactive') {
            $where[] = "COALESCE(cp.is_active, TRUE) = FALSE";
        }

        if ($search !== '') {
            $where[] = "(
                cp.dept ILIKE :search
                OR cp.sub_dept ILIKE :search
                OR cp.pic ILIKE :search
                OR cp.job_title ILIKE :search
            )";
            $params[':search'] = "%$search%";
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare("
            SELECT cp.dept, cp.sub_dept, cp.pic, cp.job_title, COALESCE(cp.is_active, TRUE) as is_active
            FROM circular_pics cp
            WHERE $whereSql
            ORDER BY cp.dept ASC, cp.sub_dept ASC, cp.pic ASC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Circular PICs');

        // Header Style
        $headerStyle = [
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
            'alignment' => ['horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER, 'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER],
            'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E3A8A']],
            'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']]]
        ];

        // Title row
        $sheet->setCellValue('A1', 'CIRCULAR SIGN PIC MASTER DATA');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->setCellValue('A2', 'Tanggal Ekspor: ' . date('d/m/Y H:i:s'));
        $sheet->getStyle('A2')->getFont()->setSize(10)->setItalic(true);

        // Columns
        $cols = ['NO', 'DEPT', 'SUB DEPT', 'PIC', 'JOB TITLE', 'STATUS'];
        $rowIdx = 4;
        foreach ($cols as $i => $title) {
            $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1);
            $sheet->setCellValue($colLetter . $rowIdx, $title);
        }
        $sheet->getStyle('A4:F4')->applyFromArray($headerStyle);
        $sheet->getRowDimension(4)->setRowHeight(26);

        $rowNum = 5;
        $no = 1;
        foreach ($rows as $r) {
            $isActive = !empty($r['is_active']) && $r['is_active'] !== 'f' && $r['is_active'] !== '0';
            $sheet->setCellValue('A' . $rowNum, $no++);
            $sheet->setCellValue('B' . $rowNum, $r['dept'] ?? '-');
            $sheet->setCellValue('C' . $rowNum, $r['sub_dept'] ?? '-');
            $sheet->setCellValue('D' . $rowNum, $r['pic'] ?? '-');
            $sheet->setCellValue('E' . $rowNum, $r['job_title'] ?? '-');
            $sheet->setCellValue('F' . $rowNum, $isActive ? 'Active' : 'Inactive');

            $sheet->getStyle('A' . $rowNum)->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('B' . $rowNum)->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('C' . $rowNum)->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('F' . $rowNum)->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

            $borderStyle = [
                'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN, 'color' => ['rgb' => 'E2E8F0']]]
            ];
            $sheet->getStyle("A{$rowNum}:F{$rowNum}")->applyFromArray($borderStyle);

            if ($no % 2 === 0) {
                $sheet->getStyle("A{$rowNum}:F{$rowNum}")->getFill()
                    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                    ->getStartColor()->setRGB('F8FAFC');
            }

            $rowNum++;
        }

        // Auto size columns
        foreach (range('A', 'F') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $filename = 'Circular_Sign_PIC_Master_Data_' . date('Ymd_His') . '.xlsx';
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: max-age=0');

        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $writer->save('php://output');
        exit;
    }

    // ── GET: Download Excel Template ─────────────────────────────────
    if ($method === 'GET' && $action === 'template') {
        require_once __DIR__ . '/../vendor/autoload.php';

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Template Circular PIC');

        $headerStyle = [
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
            'alignment' => ['horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER, 'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER],
            'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E3A8A']],
            'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']]]
        ];

        $headers = ['DEPT', 'SUB DEPT', 'PIC', 'JOB TITLE', 'STATUS'];
        foreach ($headers as $i => $title) {
            $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1);
            $sheet->setCellValue($colLetter . '1', $title);
        }
        $sheet->getStyle('A1:E1')->applyFromArray($headerStyle);
        $sheet->getRowDimension(1)->setRowHeight(26);

        // Sample data illustrating replacement flow
        $samples = [
            ['PMD', 'DNO', 'Budi Santoso', 'Department Head PMD', 'Active'],
            ['CRO', 'WJO', 'Ahmad Fadillah', 'Regional Manager CRO', 'Active'],
            ['CJDO', 'CJDO', 'Achmad Fauzan', 'Head-Central Java And DIY', 'Inactive'],
            ['CJDO', 'CJDO', 'Bambang Irawan', 'Head-Central Java And DIY', 'Active'],
            ['ERO', 'EKO', 'Dewi Lestari', 'Area Supervisor ERO', 'Active'],
        ];

        foreach ($samples as $idx => $s) {
            $r = $idx + 2;
            $sheet->setCellValue('A' . $r, $s[0]);
            $sheet->setCellValue('B' . $r, $s[1]);
            $sheet->setCellValue('C' . $r, $s[2]);
            $sheet->setCellValue('D' . $r, $s[3]);
            $sheet->setCellValue('E' . $r, $s[4]);
        }

        foreach (range('A', 'E') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $filename = 'Template_Circular_Sign_PIC.xlsx';
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: max-age=0');

        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $writer->save('php://output');
        exit;
    }

    // ── POST: Import from Excel ──────────────────────────────────────
    if ($method === 'POST' && $action === 'import') {
        require_once __DIR__ . '/../vendor/autoload.php';
        header('Content-Type: application/json; charset=utf-8');

        $uploadDir = __DIR__ . '/../uploads/temp/';
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

            $tempPath = $uploadDir . 'cpic_import_' . bin2hex(random_bytes(8)) . '.' . $extension;
            if (!move_uploaded_file($file['tmp_name'], $tempPath) && !copy($file['tmp_name'], $tempPath)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Gagal memproses file unggahan']);
                exit;
            }
            $isUploadedTmp = true;
        }

        $replaceExisting = !empty($_POST['replace_existing']) && ($_POST['replace_existing'] === '1' || $_POST['replace_existing'] === 'true');

        try {
            $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($tempPath);
            if (method_exists($reader, 'setReadDataOnly')) {
                $reader->setReadDataOnly(true);
            }

            $spreadsheet = $reader->load($tempPath);
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray(null, true, false, true);

            if (empty($rows)) {
                throw new Exception('File Excel kosong atau tidak memiliki data.');
            }

            // Find header row
            $headerRowIdx = null;
            $colMap = [
                'dept' => null,
                'sub_dept' => null,
                'pic' => null,
                'job_title' => null,
                'is_active' => null
            ];

            foreach ($rows as $rIdx => $row) {
                foreach ($row as $colLetter => $cellVal) {
                    $cleaned = strtolower(trim((string)$cellVal));
                    $cleaned = str_replace(['_', '.', ' '], '', $cleaned);
                    if ($cleaned === 'pic' || $cleaned === 'namapic' || $cleaned === 'jobtitle' || $cleaned === 'jabatan') {
                        $headerRowIdx = $rIdx;
                        break 2;
                    }
                }
            }

            if ($headerRowIdx === null) {
                $headerRowIdx = 1;
            }

            $headerRow = $rows[$headerRowIdx];
            foreach ($headerRow as $colLetter => $cellVal) {
                $val = strtolower(trim((string)$cellVal));
                $norm = str_replace(['_', '.', ' ', '/', '-'], '', $val);

                if (in_array($norm, ['dept', 'departemen', 'department'], true)) {
                    $colMap['dept'] = $colLetter;
                } elseif (in_array($norm, ['subdept', 'subdepartemen', 'subdepartment'], true)) {
                    $colMap['sub_dept'] = $colLetter;
                } elseif (in_array($norm, ['deptsubdept', 'deptsub'], true)) {
                    // Combined column
                    if (!$colMap['dept']) $colMap['dept'] = $colLetter;
                } elseif (in_array($norm, ['pic', 'namapic', 'personincharge', 'picname', 'nama'], true)) {
                    $colMap['pic'] = $colLetter;
                } elseif (in_array($norm, ['jobtitle', 'title', 'jabatan', 'posisi', 'position'], true)) {
                    $colMap['job_title'] = $colLetter;
                } elseif (in_array($norm, ['status', 'active', 'isactive', 'aktif', 'act'], true)) {
                    $colMap['is_active'] = $colLetter;
                }
            }

            if (!$colMap['pic'] && !$colMap['job_title']) {
                throw new Exception('Kolom PIC atau JOB TITLE tidak ditemukan pada file Excel. Pastikan terdapat kolom bertuliskan PIC dan JOB TITLE.');
            }

            $db->beginTransaction();

            if ($replaceExisting) {
                $db->exec("TRUNCATE TABLE circular_pics RESTART IDENTITY");
            }

            $checkStmt = $db->prepare("SELECT id FROM circular_pics WHERE UPPER(pic) = UPPER(:pic) AND UPPER(COALESCE(dept, '')) = UPPER(:dept) LIMIT 1");
            $updateStmt = $db->prepare("
                UPDATE circular_pics
                SET sub_dept = COALESCE(NULLIF(:sub_dept, ''), sub_dept),
                    job_title = :job_title,
                    is_active = :is_active,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            ");
            $insertStmt = $db->prepare("
                INSERT INTO circular_pics (dept, sub_dept, pic, job_title, is_active, created_at, updated_at)
                VALUES (:dept, :sub_dept, :pic, :job_title, :is_active, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ");

            $imported = 0;
            $updated = 0;
            $inserted = 0;
            $skipped = 0;

            foreach ($rows as $rIdx => $row) {
                if ($rIdx <= $headerRowIdx) {
                    continue;
                }

                $pic = $colMap['pic'] ? trim((string)($row[$colMap['pic']] ?? '')) : '';
                $jobTitle = $colMap['job_title'] ? trim((string)($row[$colMap['job_title']] ?? '')) : '';
                $dept = $colMap['dept'] ? trim((string)($row[$colMap['dept']] ?? '')) : '';
                $subDept = $colMap['sub_dept'] ? trim((string)($row[$colMap['sub_dept']] ?? '')) : '';

                if ($pic === '' && $jobTitle === '') {
                    $skipped++;
                    continue;
                }

                if ($pic === '') {
                    $pic = '-';
                }
                if ($jobTitle === '') {
                    $jobTitle = '-';
                }

                $isActive = true;
                if ($colMap['is_active'] && isset($row[$colMap['is_active']])) {
                    $actStr = strtolower(trim((string)$row[$colMap['is_active']]));
                    if (in_array($actStr, ['inactive', 'nonaktif', 'inaktif', '0', 'false', 'tidak', 'n', 'no', 'disabled'], true)) {
                        $isActive = false;
                    }
                }

                $checkStmt->execute([':pic' => $pic, ':dept' => $dept]);
                $existingId = $checkStmt->fetchColumn();

                if ($existingId) {
                    $updateStmt->bindValue(':sub_dept', $subDept);
                    $updateStmt->bindValue(':job_title', $jobTitle);
                    $updateStmt->bindValue(':is_active', $isActive, PDO::PARAM_BOOL);
                    $updateStmt->bindValue(':id', $existingId, PDO::PARAM_INT);
                    $updateStmt->execute();
                    $updated++;
                } else {
                    $insertStmt->bindValue(':dept', $dept);
                    $insertStmt->bindValue(':sub_dept', $subDept);
                    $insertStmt->bindValue(':pic', $pic);
                    $insertStmt->bindValue(':job_title', $jobTitle);
                    $insertStmt->bindValue(':is_active', $isActive, PDO::PARAM_BOOL);
                    $insertStmt->execute();
                    $inserted++;
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

    // ── POST: Toggle Active Status ───────────────────────────────────
    if ($method === 'POST' && ($action === 'toggle_active' || $action === 'update_active')) {
        header('Content-Type: application/json; charset=utf-8');

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }

        $id = !empty($input['id']) ? (int)$input['id'] : null;
        $isActive = filter_var($input['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID data tidak valid!']);
            exit;
        }

        $stmt = $db->prepare("
            UPDATE circular_pics
            SET is_active = :is_active,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $stmt->bindValue(':is_active', $isActive, PDO::PARAM_BOOL);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();

        echo json_encode([
            'success' => true,
            'message' => 'Status PIC berhasil diatur menjadi ' . ($isActive ? 'Aktif' : 'Nonaktif'),
            'id' => $id,
            'is_active' => $isActive
        ]);
        exit;
    }

    // ── POST: Save / Update Record ───────────────────────────────────
    if ($method === 'POST' && ($action === 'save' || $action === 'create' || $action === 'update')) {
        header('Content-Type: application/json; charset=utf-8');

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }

        $id = !empty($input['id']) ? (int)$input['id'] : null;
        $dept = trim($input['dept'] ?? '');
        $subDept = trim($input['sub_dept'] ?? '');
        $pic = trim($input['pic'] ?? '');
        $jobTitle = trim($input['job_title'] ?? '');
        $isActive = filter_var($input['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);

        if ($pic === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Nama PIC wajib diisi!']);
            exit;
        }
        if ($jobTitle === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Job Title wajib diisi!']);
            exit;
        }

        if ($id) {
            $stmt = $db->prepare("
                UPDATE circular_pics
                SET dept = :dept,
                    sub_dept = :sub_dept,
                    pic = :pic,
                    job_title = :job_title,
                    is_active = :is_active,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            ");
            $stmt->bindValue(':dept', $dept);
            $stmt->bindValue(':sub_dept', $subDept);
            $stmt->bindValue(':pic', $pic);
            $stmt->bindValue(':job_title', $jobTitle);
            $stmt->bindValue(':is_active', $isActive, PDO::PARAM_BOOL);
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            $msg = 'Data Circular Sign PIC berhasil diperbarui!';
        } else {
            $stmt = $db->prepare("
                INSERT INTO circular_pics (dept, sub_dept, pic, job_title, is_active, created_at, updated_at)
                VALUES (:dept, :sub_dept, :pic, :job_title, :is_active, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ");
            $stmt->bindValue(':dept', $dept);
            $stmt->bindValue(':sub_dept', $subDept);
            $stmt->bindValue(':pic', $pic);
            $stmt->bindValue(':job_title', $jobTitle);
            $stmt->bindValue(':is_active', $isActive, PDO::PARAM_BOOL);
            $stmt->execute();
            $id = (int)$db->lastInsertId();
            $msg = 'Data Circular Sign PIC berhasil ditambahkan!';
        }

        echo json_encode(['success' => true, 'message' => $msg, 'id' => $id, 'is_active' => $isActive]);
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

        $stmt = $db->prepare("DELETE FROM circular_pics WHERE id = :id");
        $stmt->execute([':id' => $id]);

        echo json_encode(['success' => true, 'message' => 'Data Circular Sign PIC berhasil dihapus!']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Aksi tidak dikenal!']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
}
