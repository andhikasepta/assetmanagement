<?php
/**
 * User Management API Endpoint
 * Handles CRUD for administrator accounts with User Access Control (UAC)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/security.php';

sendSecurityHeaders();
header('Content-Type: application/json; charset=utf-8');

// Must be logged in
requireAuth();

if (!empty($_SESSION['user']['permissions']) && ($_SESSION['user']['permissions']['can_access_user_management'] ?? true) === false) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Anda tidak memiliki hak akses untuk User Management.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    $db = getDbConnection();

    // ── GET: List All Users ─────────────────────────────────────────
    if ($method === 'GET') {
        $stmt = $db->query("
            SELECT 
                id, 
                username, 
                name, 
                role, 
                COALESCE(can_access_all_summary, TRUE) as can_access_all_summary,
                COALESCE(can_access_weekly_summary, TRUE) as can_access_weekly_summary,
                COALESCE(can_access_reports, TRUE) as can_access_reports,
                COALESCE(reports_depts, 'ALL') as reports_depts,
                COALESCE(can_reset_report, FALSE) as can_reset_report,
                COALESCE(can_access_berita_acara, TRUE) as can_access_berita_acara,
                COALESCE(can_access_master_data, TRUE) as can_access_master_data,
                COALESCE(can_access_master_data_weekly, TRUE) as can_access_master_data_weekly,
                COALESCE(can_access_user_management, TRUE) as can_access_user_management,
                COALESCE(can_master_add_import, TRUE) as can_master_add_import,
                COALESCE(can_master_edit, TRUE) as can_master_edit,
                COALESCE(can_master_delete, TRUE) as can_master_delete,
                COALESCE(can_master_weekly_add_import, TRUE) as can_master_weekly_add_import,
                COALESCE(can_master_weekly_delete, TRUE) as can_master_weekly_delete,
                created_at, 
                updated_at
            FROM users 
            ORDER BY id ASC
        ");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Normalize boolean fields
        foreach ($users as &$u) {
            $u['id'] = (int) $u['id'];
            $u['can_access_all_summary'] = filter_var($u['can_access_all_summary'], FILTER_VALIDATE_BOOLEAN);
            $u['can_access_weekly_summary'] = filter_var($u['can_access_weekly_summary'], FILTER_VALIDATE_BOOLEAN);
            $u['can_access_reports'] = filter_var($u['can_access_reports'] ?? true, FILTER_VALIDATE_BOOLEAN);
            $u['reports_depts'] = !empty($u['reports_depts']) ? $u['reports_depts'] : 'ALL';
            $u['can_reset_report'] = filter_var($u['can_reset_report'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $u['can_access_berita_acara'] = filter_var($u['can_access_berita_acara'] ?? true, FILTER_VALIDATE_BOOLEAN);
            $u['can_access_master_data'] = filter_var($u['can_access_master_data'], FILTER_VALIDATE_BOOLEAN);
            $u['can_access_master_data_weekly'] = filter_var($u['can_access_master_data_weekly'], FILTER_VALIDATE_BOOLEAN);
            $u['can_access_user_management'] = filter_var($u['can_access_user_management'], FILTER_VALIDATE_BOOLEAN);
            $u['can_master_add_import'] = filter_var($u['can_master_add_import'], FILTER_VALIDATE_BOOLEAN);
            $u['can_master_edit'] = filter_var($u['can_master_edit'], FILTER_VALIDATE_BOOLEAN);
            $u['can_master_delete'] = filter_var($u['can_master_delete'], FILTER_VALIDATE_BOOLEAN);
            $u['can_master_weekly_add_import'] = filter_var($u['can_master_weekly_add_import'], FILTER_VALIDATE_BOOLEAN);
            $u['can_master_weekly_delete'] = filter_var($u['can_master_weekly_delete'], FILTER_VALIDATE_BOOLEAN);
        }
        unset($u);

        echo json_encode([
            'success' => true,
            'data'    => $users,
        ]);
        exit;
    }

    // For POST/PUT/DELETE, validate CSRF
    validateCsrfToken();

    // ── POST: Create User ───────────────────────────────────────────
    if ($method === 'POST' && $action === 'create') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $name = trim($input['name'] ?? '');
        $username = trim($input['username'] ?? '');
        $password = trim($input['password'] ?? '');

        if ($name === '' || $username === '' || $password === '') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Nama, Username, dan Password wajib diisi.'
            ]);
            exit;
        }

        // Check if username already exists
        $checkStmt = $db->prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(:u)');
        $checkStmt->execute([':u' => $username]);
        if ($checkStmt->fetch()) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Username sudah digunakan oleh user lain.'
            ]);
            exit;
        }

        $canAccessAllSummary = !empty($input['can_access_all_summary']);
        $canAccessWeeklySummary = !empty($input['can_access_weekly_summary']);
        $canAccessReports = !empty($input['can_access_reports']);
        $reportsDepts = trim($input['reports_depts'] ?? 'ALL');
        if ($reportsDepts === '') $reportsDepts = 'ALL';
        $canResetReport = !empty($input['can_reset_report']);
        $canAccessBeritaAcara = !empty($input['can_access_berita_acara']);
        $canAccessMasterData = !empty($input['can_access_master_data']);
        $canAccessMasterDataWeekly = !empty($input['can_access_master_data_weekly']);
        $canAccessUserManagement = !empty($input['can_access_user_management']);
        $canMasterAddImport = !empty($input['can_master_add_import']);
        $canMasterEdit = !empty($input['can_master_edit']);
        $canMasterDelete = !empty($input['can_master_delete']);
        $canMasterWeeklyAddImport = !empty($input['can_master_weekly_add_import']);
        $canMasterWeeklyDelete = !empty($input['can_master_weekly_delete']);

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $db->prepare('
            INSERT INTO users (
                username, 
                name, 
                password, 
                role, 
                can_access_all_summary, 
                can_access_weekly_summary, 
                can_access_reports,
                reports_depts,
                can_reset_report,
                can_access_berita_acara,
                can_access_master_data, 
                can_access_master_data_weekly, 
                can_access_user_management, 
                can_master_add_import, 
                can_master_edit, 
                can_master_delete,
                can_master_weekly_add_import,
                can_master_weekly_delete
            ) VALUES (
                :username, 
                :name, 
                :password, 
                :role, 
                :can_all, 
                :can_weekly, 
                :can_rep,
                :rep_depts,
                :can_reset_rep,
                :can_ba,
                :can_md, 
                :can_md_wk, 
                :can_usr_mgmt, 
                :can_add, 
                :can_edit, 
                :can_del,
                :can_wk_add,
                :can_wk_del
            ) RETURNING id
        ');

        $stmt->execute([
            ':username'     => $username,
            ':name'         => $name,
            ':password'     => $hashedPassword,
            ':role'         => 'admin',
            ':can_all'      => $canAccessAllSummary ? 't' : 'f',
            ':can_weekly'   => $canAccessWeeklySummary ? 't' : 'f',
            ':can_rep'      => $canAccessReports ? 't' : 'f',
            ':rep_depts'    => $reportsDepts,
            ':can_reset_rep'=> $canResetReport ? 't' : 'f',
            ':can_ba'       => $canAccessBeritaAcara ? 't' : 'f',
            ':can_md'       => $canAccessMasterData ? 't' : 'f',
            ':can_md_wk'    => $canAccessMasterDataWeekly ? 't' : 'f',
            ':can_usr_mgmt' => $canAccessUserManagement ? 't' : 'f',
            ':can_add'      => $canMasterAddImport ? 't' : 'f',
            ':can_edit'     => $canMasterEdit ? 't' : 'f',
            ':can_del'      => $canMasterDelete ? 't' : 'f',
            ':can_wk_add'   => $canMasterWeeklyAddImport ? 't' : 'f',
            ':can_wk_del'   => $canMasterWeeklyDelete ? 't' : 'f',
        ]);

        $newId = (int) $stmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'id'      => $newId,
            'message' => 'User berhasil ditambahkan.'
        ]);
        exit;
    }

    // ── POST: Update User ───────────────────────────────────────────
    if ($method === 'POST' && $action === 'update') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

        $id = (int) ($input['id'] ?? 0);
        $name = trim($input['name'] ?? '');
        $username = trim($input['username'] ?? '');
        $password = trim($input['password'] ?? '');

        if ($id <= 0 || $name === '' || $username === '') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'ID, Nama, dan Username wajib diisi.'
            ]);
            exit;
        }

        // Check duplicate username for another id
        $checkStmt = $db->prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(:u) AND id != :id');
        $checkStmt->execute([':u' => $username, ':id' => $id]);
        if ($checkStmt->fetch()) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Username sudah digunakan oleh user lain.'
            ]);
            exit;
        }

        $canAccessAllSummary = !empty($input['can_access_all_summary']);
        $canAccessWeeklySummary = !empty($input['can_access_weekly_summary']);
        $canAccessReports = !empty($input['can_access_reports']);
        $reportsDepts = trim($input['reports_depts'] ?? 'ALL');
        if ($reportsDepts === '') $reportsDepts = 'ALL';
        $canResetReport = !empty($input['can_reset_report']);
        $canAccessBeritaAcara = !empty($input['can_access_berita_acara']);
        $canAccessMasterData = !empty($input['can_access_master_data']);
        $canAccessMasterDataWeekly = !empty($input['can_access_master_data_weekly']);
        $canAccessUserManagement = !empty($input['can_access_user_management']);
        $canMasterAddImport = !empty($input['can_master_add_import']);
        $canMasterEdit = !empty($input['can_master_edit']);
        $canMasterDelete = !empty($input['can_master_delete']);
        $canMasterWeeklyAddImport = !empty($input['can_master_weekly_add_import']);
        $canMasterWeeklyDelete = !empty($input['can_master_weekly_delete']);

        // Check if user is D3utsch (keep superadmin privileges)
        $userCheck = $db->prepare('SELECT username FROM users WHERE id = :id');
        $userCheck->execute([':id' => $id]);
        $existingUser = $userCheck->fetch(PDO::FETCH_ASSOC);
        if ($existingUser && strtolower($existingUser['username']) === 'd3utsch') {
            // D3utsch must always have full permissions
            $canAccessAllSummary = true;
            $canAccessWeeklySummary = true;
            $canAccessReports = true;
            $canResetReport = true;
            $canAccessBeritaAcara = true;
            $canAccessMasterData = true;
            $canAccessMasterDataWeekly = true;
            $canAccessUserManagement = true;
            $canMasterAddImport = true;
            $canMasterEdit = true;
            $canMasterDelete = true;
            $canMasterWeeklyAddImport = true;
            $canMasterWeeklyDelete = true;
        }

        if ($password !== '') {
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $db->prepare('
                UPDATE users SET
                    name = :name,
                    username = :username,
                    password = :password,
                    can_access_all_summary = :can_all,
                    can_access_weekly_summary = :can_weekly,
                    can_access_reports = :can_rep,
                    reports_depts = :rep_depts,
                    can_reset_report = :can_reset_rep,
                    can_access_berita_acara = :can_ba,
                    can_access_master_data = :can_md,
                    can_access_master_data_weekly = :can_md_wk,
                    can_access_user_management = :can_usr_mgmt,
                    can_master_add_import = :can_add,
                    can_master_edit = :can_edit,
                    can_master_delete = :can_del,
                    can_master_weekly_add_import = :can_wk_add,
                    can_master_weekly_delete = :can_wk_del,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            ');
            $stmt->execute([
                ':name'         => $name,
                ':username'     => $username,
                ':password'     => $hashedPassword,
                ':can_all'      => $canAccessAllSummary ? 't' : 'f',
                ':can_weekly'   => $canAccessWeeklySummary ? 't' : 'f',
                ':can_rep'      => $canAccessReports ? 't' : 'f',
                ':rep_depts'    => $reportsDepts,
                ':can_reset_rep'=> $canResetReport ? 't' : 'f',
                ':can_ba'       => $canAccessBeritaAcara ? 't' : 'f',
                ':can_md'       => $canAccessMasterData ? 't' : 'f',
                ':can_md_wk'    => $canAccessMasterDataWeekly ? 't' : 'f',
                ':can_usr_mgmt' => $canAccessUserManagement ? 't' : 'f',
                ':can_add'      => $canMasterAddImport ? 't' : 'f',
                ':can_edit'     => $canMasterEdit ? 't' : 'f',
                ':can_del'      => $canMasterDelete ? 't' : 'f',
                ':can_wk_add'   => $canMasterWeeklyAddImport ? 't' : 'f',
                ':can_wk_del'   => $canMasterWeeklyDelete ? 't' : 'f',
                ':id'           => $id,
            ]);
        } else {
            $stmt = $db->prepare('
                UPDATE users SET
                    name = :name,
                    username = :username,
                    can_access_all_summary = :can_all,
                    can_access_weekly_summary = :can_weekly,
                    can_access_reports = :can_rep,
                    reports_depts = :rep_depts,
                    can_reset_report = :can_reset_rep,
                    can_access_berita_acara = :can_ba,
                    can_access_master_data = :can_md,
                    can_access_master_data_weekly = :can_md_wk,
                    can_access_user_management = :can_usr_mgmt,
                    can_master_add_import = :can_add,
                    can_master_edit = :can_edit,
                    can_master_delete = :can_del,
                    can_master_weekly_add_import = :can_wk_add,
                    can_master_weekly_delete = :can_wk_del,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            ');
            $stmt->execute([
                ':name'         => $name,
                ':username'     => $username,
                ':can_all'      => $canAccessAllSummary ? 't' : 'f',
                ':can_weekly'   => $canAccessWeeklySummary ? 't' : 'f',
                ':can_rep'      => $canAccessReports ? 't' : 'f',
                ':rep_depts'    => $reportsDepts,
                ':can_reset_rep'=> $canResetReport ? 't' : 'f',
                ':can_ba'       => $canAccessBeritaAcara ? 't' : 'f',
                ':can_md'       => $canAccessMasterData ? 't' : 'f',
                ':can_md_wk'    => $canAccessMasterDataWeekly ? 't' : 'f',
                ':can_usr_mgmt' => $canAccessUserManagement ? 't' : 'f',
                ':can_add'      => $canMasterAddImport ? 't' : 'f',
                ':can_edit'     => $canMasterEdit ? 't' : 'f',
                ':can_del'      => $canMasterDelete ? 't' : 'f',
                ':can_wk_add'   => $canMasterWeeklyAddImport ? 't' : 'f',
                ':can_wk_del'   => $canMasterWeeklyDelete ? 't' : 'f',
                ':id'           => $id,
            ]);
        }

        // If editing currently logged in user, refresh session
        $curUser = getCurrentUser();
        if ($curUser && (int) $curUser['id'] === $id) {
            $_SESSION['user']['name'] = $name;
            $_SESSION['user']['username'] = $username;
            $_SESSION['user']['permissions'] = [
                'can_access_all_summary'        => $canAccessAllSummary,
                'can_access_weekly_summary'     => $canAccessWeeklySummary,
                'can_access_reports'            => $canAccessReports,
                'reports_depts'                 => $reportsDepts,
                'can_reset_report'              => $canResetReport,
                'can_access_berita_acara'       => $canAccessBeritaAcara,
                'can_access_master_data'        => $canAccessMasterData,
                'can_access_master_data_weekly' => $canAccessMasterDataWeekly,
                'can_access_user_management'    => $canAccessUserManagement,
                'can_master_add_import'         => $canMasterAddImport,
                'can_master_edit'               => $canMasterEdit,
                'can_master_delete'             => $canMasterDelete,
                'can_master_weekly_add_import'  => $canMasterWeeklyAddImport,
                'can_master_weekly_delete'      => $canMasterWeeklyDelete,
            ];
        }

        echo json_encode([
            'success' => true,
            'message' => 'User berhasil diperbarui.'
        ]);
        exit;
    }

    // ── POST/DELETE: Delete User ────────────────────────────────────
    if (($method === 'POST' && $action === 'delete') || $method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $id = (int) ($input['id'] ?? ($_GET['id'] ?? 0));

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID user tidak valid.']);
            exit;
        }

        // Check if user is D3utsch
        $checkStmt = $db->prepare('SELECT username FROM users WHERE id = :id');
        $checkStmt->execute([':id' => $id]);
        $targetUser = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$targetUser) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User tidak ditemukan.']);
            exit;
        }

        if (strtolower($targetUser['username']) === 'd3utsch') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'User Administrator Utama (D3utsch) tidak dapat dihapus.']);
            exit;
        }

        $curUser = getCurrentUser();
        if ($curUser && (int) $curUser['id'] === $id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.']);
            exit;
        }

        $delStmt = $db->prepare('DELETE FROM users WHERE id = :id');
        $delStmt->execute([':id' => $id]);

        echo json_encode([
            'success' => true,
            'message' => 'User berhasil dihapus.'
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method or action not allowed']);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
