<?php
/**
 * Template Reports Master Data API Endpoint
 * Handles CRUD and file upload / download for Word (.docx, .doc) and PDF (.pdf) report templates
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

    // Ensure template_reports table exists
    $db->exec("
        CREATE TABLE IF NOT EXISTS template_reports (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_type VARCHAR(50) NOT NULL,
            file_ext VARCHAR(10) NOT NULL,
            file_size BIGINT DEFAULT 0,
            uploaded_by VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_template_reports_type ON template_reports (file_type);
        CREATE INDEX IF NOT EXISTS idx_template_reports_title ON template_reports (title);
    ");

    // Ensure upload directory exists
    $uploadDir = __DIR__ . '/../uploads/templates/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // ── GET: Read / List Operations ──────────────────────────────────
    if ($method === 'GET' && $action === 'list') {
        header('Content-Type: application/json; charset=utf-8');

        $type = trim($_GET['type'] ?? 'all');
        $search = trim($_GET['search'] ?? '');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limitParam = $_GET['limit'] ?? '10';
        $limit = ($limitParam === 'all') ? 999999 : max(1, (int)$limitParam);
        $offset = ($page - 1) * $limit;

        $sortCol = $_GET['sort_col'] ?? 'created_at';
        $sortDir = strtolower($_GET['sort_dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';

        $allowedSort = [
            'id' => 'tr.id',
            'title' => 'tr.title',
            'file_type' => 'tr.file_type',
            'file_size' => 'tr.file_size',
            'created_at' => 'tr.created_at',
        ];
        $orderByCol = $allowedSort[$sortCol] ?? 'tr.created_at';

        $where = ["1=1"];
        $params = [];

        if ($type !== '' && $type !== 'all') {
            $where[] = "LOWER(tr.file_type) = LOWER(:type)";
            $params[':type'] = $type;
        }

        if ($search !== '') {
            $where[] = "(
                tr.title ILIKE :search
                OR tr.description ILIKE :search
                OR tr.file_name ILIKE :search
            )";
            $params[':search'] = "%$search%";
        }

        $whereSql = implode(' AND ', $where);

        $countStmt = $db->prepare("SELECT COUNT(*) FROM template_reports tr WHERE $whereSql");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $sql = "
            SELECT tr.id, tr.title, tr.description, tr.file_name, tr.file_path, tr.file_type, tr.file_ext, tr.file_size, tr.uploaded_by, tr.created_at, tr.updated_at
            FROM template_reports tr
            WHERE $whereSql
            ORDER BY $orderByCol $sortDir
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

        $totalPages = ($limitParam === 'all') ? 1 : (int)ceil($total / $limit);

        echo json_encode([
            'success' => true,
            'data' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limitParam,
            'total_pages' => $totalPages
        ]);
        exit;
    }

    // ── GET: Download Template File ──────────────────────────────────
    if ($method === 'GET' && $action === 'download') {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            die('ID template tidak valid');
        }

        $stmt = $db->prepare("SELECT * FROM template_reports WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $template = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$template) {
            http_response_code(404);
            die('Template tidak ditemukan');
        }

        $fullPath = __DIR__ . '/../' . ltrim($template['file_path'], '/');
        if (!file_exists($fullPath)) {
            http_response_code(404);
            die('File template fisik tidak ditemukan di server');
        }

        $ext = strtolower($template['file_ext']);
        $mime = 'application/octet-stream';
        if ($ext === 'docx') {
            $mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } elseif ($ext === 'doc') {
            $mime = 'application/msword';
        } elseif ($ext === 'pdf') {
            $mime = 'application/pdf';
        }

        header('Content-Description: File Transfer');
        header('Content-Type: ' . $mime);
        header('Content-Disposition: attachment; filename="' . basename($template['file_name']) . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($fullPath));
        readfile($fullPath);
        exit;
    }

    // ── POST: Upload / Import Template File (Word & PDF) ─────────────
    if ($method === 'POST' && ($action === 'upload' || $action === 'import')) {
        header('Content-Type: application/json; charset=utf-8');

        if (!isset($_FILES['template_file']) || $_FILES['template_file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'File tidak ditemukan atau terjadi kesalahan saat mengunggah!']);
            exit;
        }

        $file = $_FILES['template_file'];
        $origName = $file['name'];
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

        $allowedExts = ['docx', 'doc', 'pdf'];
        if (!in_array($ext, $allowedExts, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Format file tidak didukung! Hanya file Word (.docx, .doc) dan PDF (.pdf) yang diperbolehkan.']);
            exit;
        }

        $title = trim($_POST['title'] ?? '');
        if ($title === '') {
            $title = pathinfo($origName, PATHINFO_FILENAME);
        }
        $description = trim($_POST['description'] ?? '');
        $fileType = ($ext === 'pdf') ? 'pdf' : 'word';

        // Generate clean unique filename
        $safeBase = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($origName, PATHINFO_FILENAME));
        $newFilename = $safeBase . '_' . date('Ymd_His') . '.' . $ext;
        $targetPath = $uploadDir . $newFilename;
        $dbPath = 'uploads/templates/' . $newFilename;

        $moved = @move_uploaded_file($file['tmp_name'], $targetPath);
        if (!$moved && PHP_SAPI === 'cli' && file_exists($file['tmp_name'])) {
            $moved = @copy($file['tmp_name'], $targetPath);
        }
        if (!$moved) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Gagal memindahkan file yang diunggah ke server storage.']);
            exit;
        }

        $fileSize = filesize($targetPath);
        $uploadedBy = !empty($_SESSION['user_name']) ? $_SESSION['user_name'] : 'Administrator';

        $stmt = $db->prepare("
            INSERT INTO template_reports (title, description, file_name, file_path, file_type, file_ext, file_size, uploaded_by, created_at, updated_at)
            VALUES (:title, :description, :file_name, :file_path, :file_type, :file_ext, :file_size, :uploaded_by, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $stmt->execute([
            ':title' => $title,
            ':description' => $description,
            ':file_name' => $origName,
            ':file_path' => $dbPath,
            ':file_type' => $fileType,
            ':file_ext' => $ext,
            ':file_size' => $fileSize,
            ':uploaded_by' => $uploadedBy
        ]);
        $newId = (int)$db->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => "Template report \"$title\" berhasil diunggah!",
            'id' => $newId,
            'file_name' => $origName,
            'file_type' => $fileType
        ]);
        exit;
    }

    // ── POST: Edit Title / Description ───────────────────────────────
    if ($method === 'POST' && $action === 'edit') {
        header('Content-Type: application/json; charset=utf-8');

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) $input = $_POST;

        $id = (int)($input['id'] ?? 0);
        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');

        if ($id <= 0 || $title === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID dan Nama Template wajib diisi!']);
            exit;
        }

        $stmt = $db->prepare("
            UPDATE template_reports
            SET title = :title,
                description = :description,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $stmt->execute([
            ':title' => $title,
            ':description' => $description,
            ':id' => $id
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Data template report berhasil diperbarui!'
        ]);
        exit;
    }

    // ── POST: Delete Template ────────────────────────────────────────
    if ($method === 'POST' && $action === 'delete') {
        header('Content-Type: application/json; charset=utf-8');

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) $input = $_POST;

        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID data tidak valid!']);
            exit;
        }

        // Get file path to unlink
        $stmt = $db->prepare("SELECT file_path FROM template_reports WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $filePath = $stmt->fetchColumn();

        if ($filePath) {
            $fullPath = __DIR__ . '/../' . ltrim($filePath, '/');
            if (file_exists($fullPath)) {
                @unlink($fullPath);
            }
        }

        $delStmt = $db->prepare("DELETE FROM template_reports WHERE id = :id");
        $delStmt->execute([':id' => $id]);

        echo json_encode(['success' => true, 'message' => 'Template report berhasil dihapus!']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Aksi tidak dikenal!']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
}
