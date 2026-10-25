<?php
/**
 * Authentication and Session Management
 */

require_once __DIR__ . '/../config/database.php';

if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
    @session_start();
}

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

/**
 * Get current logged in user or null
 *
 * @return array{id: int|string, username: string, name: string, role: string}|null
 */
function getCurrentUser(): ?array
{
    if (!empty($_SESSION['user'])) {
        if (!empty($_SESSION['user']['id']) || !empty($_SESSION['user']['username'])) {
            try {
                $db = getDbConnection();
                $stmt = $db->prepare('SELECT id, username, name, role, can_access_all_summary, can_access_weekly_summary, can_access_reports, reports_depts, can_access_master_data, can_access_master_data_weekly, can_access_user_management, can_master_add_import, can_master_edit, can_master_delete, can_master_weekly_add_import, can_master_weekly_delete FROM users WHERE id = :id OR LOWER(username) = LOWER(:u) LIMIT 1');
                $stmt->execute([
                    ':id' => (int)($_SESSION['user']['id'] ?? 0),
                    ':u'  => (string)($_SESSION['user']['username'] ?? '')
                ]);
                $u = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($u) {
                    $_SESSION['user']['id'] = $u['id'];
                    $_SESSION['user']['username'] = $u['username'];
                    $_SESSION['user']['name'] = $u['name'];
                    $_SESSION['user']['role'] = $u['role'] ?? 'admin';
                    $_SESSION['user']['permissions'] = [
                        'can_access_all_summary'         => filter_var($u['can_access_all_summary'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_access_weekly_summary'      => filter_var($u['can_access_weekly_summary'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_access_reports'             => filter_var($u['can_access_reports'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'reports_depts'                  => !empty($u['reports_depts']) ? $u['reports_depts'] : 'ALL',
                        'can_access_master_data'         => filter_var($u['can_access_master_data'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_access_master_data_weekly'  => filter_var($u['can_access_master_data_weekly'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_access_user_management'     => filter_var($u['can_access_user_management'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_add_import'          => filter_var($u['can_master_add_import'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_edit'                => filter_var($u['can_master_edit'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_delete'              => filter_var($u['can_master_delete'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_weekly_add_import'   => filter_var($u['can_master_weekly_add_import'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_weekly_delete'       => filter_var($u['can_master_weekly_delete'] ?? true, FILTER_VALIDATE_BOOLEAN),
                    ];
                }
            } catch (Throwable $e) {}
        }
        if (!isset($_SESSION['user']['permissions']['can_access_user_management'])) {
            $_SESSION['user']['permissions']['can_access_user_management'] = true;
        }
        return $_SESSION['user'];
    }
    return null;
}

/**
 * Check if session is logged in as admin
 *
 * @return bool
 */
function isLoggedIn(): bool
{
    return !empty($_SESSION['user']);
}

/**
 * Authenticate user with Username and Password
 * Default fallback admin: username 'admin', password 'admin', name 'Administrator'
 *
 * @param string $username
 * @param string $password
 * @return array{success: bool, message?: string, user?: array}
 */
function attemptLogin(string $username, string $password): array
{
    $username = trim($username);
    $password = trim($password);

    if ($username === '' || $password === '') {
        return [
            'success' => false,
            'message' => 'Username dan Password wajib diisi.'
        ];
    }

    // Try checking database first
    try {
        $db = getDbConnection();
        $stmt = $db->prepare('SELECT id, username, name, password, role, can_access_all_summary, can_access_weekly_summary, can_access_reports, reports_depts, can_access_master_data, can_access_master_data_weekly, can_access_user_management, can_master_add_import, can_master_edit, can_master_delete, can_master_weekly_add_import, can_master_weekly_delete FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && $user['username'] === $username) {
            $isPasswordValid = false;
            // Verify via password_verify or plain fallback
            if (password_verify($password, $user['password'])) {
                $isPasswordValid = true;
            } elseif ($password === $user['password']) {
                $isPasswordValid = true;
                // Rehash password
                try {
                    $newHash = password_hash($password, PASSWORD_DEFAULT);
                    $up = $db->prepare('UPDATE users SET password = :p WHERE id = :id');
                    $up->execute(['p' => $newHash, 'id' => $user['id']]);
                } catch (Throwable $ignore) {}
            }

            if ($isPasswordValid) {
                if (session_status() === PHP_SESSION_ACTIVE) {
                    session_regenerate_id(true);
                }
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
                $_SESSION['user'] = [
                    'id'          => $user['id'],
                    'username'    => $user['username'],
                    'name'        => $user['name'],
                    'role'        => $user['role'] ?? 'admin',
                    'permissions' => [
                        'can_access_all_summary'         => filter_var($user['can_access_all_summary'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_access_weekly_summary'      => filter_var($user['can_access_weekly_summary'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_access_reports'             => filter_var($user['can_access_reports'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'reports_depts'                  => !empty($user['reports_depts']) ? $user['reports_depts'] : 'ALL',
                        'can_access_master_data'         => filter_var($user['can_access_master_data'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_access_master_data_weekly'  => filter_var($user['can_access_master_data_weekly'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_access_user_management'     => filter_var($user['can_access_user_management'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_add_import'          => filter_var($user['can_master_add_import'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_edit'                => filter_var($user['can_master_edit'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_delete'              => filter_var($user['can_master_delete'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_weekly_add_import'   => filter_var($user['can_master_weekly_add_import'] ?? true, FILTER_VALIDATE_BOOLEAN),
                        'can_master_weekly_delete'       => filter_var($user['can_master_weekly_delete'] ?? true, FILTER_VALIDATE_BOOLEAN),
                    ],
                ];
                return ['success' => true, 'user' => $_SESSION['user']];
            }
        }
    } catch (Throwable $e) {
        // Fallback to strict credentials if DB connection fails
    }

    // Strict Fallback Admin Credentials (D3utsch / S3pt4@##!@#)
    if ($username === 'D3utsch' && $password === 'S3pt4@##!@#') {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $_SESSION['user'] = [
            'id'          => 1,
            'username'    => 'D3utsch',
            'name'        => 'Asset Management Administrator',
            'role'        => 'admin',
            'permissions' => [
                'can_access_all_summary'        => true,
                'can_access_weekly_summary'     => true,
                'can_access_reports'            => true,
                'reports_depts'                 => 'ALL',
                'can_access_master_data'        => true,
                'can_access_master_data_weekly' => true,
                'can_access_user_management'    => true,
                'can_master_add_import'         => true,
                'can_master_edit'               => true,
                'can_master_delete'             => true,
                'can_master_weekly_add_import'  => true,
                'can_master_weekly_delete'      => true,
            ],
        ];
        return ['success' => true, 'user' => $_SESSION['user']];
    }

    return [
        'success' => false,
        'message' => 'Username atau Password salah.'
    ];
}

/**
 * Destroy user session and logout
 */
function logoutUser(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    unset($_SESSION['user']);
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
}

/**
 * Check if the currently logged-in user has a specific permission
 *
 * @param string $permissionName
 * @return bool
 */
function hasPermission(string $permissionName): bool
{
    $user = getCurrentUser();
    if (!$user) {
        return false;
    }
    // Superadmin has all permissions
    if (($user['username'] ?? '') === 'D3utsch' || ($user['role'] ?? '') === 'superadmin') {
        return true;
    }
    if (isset($user['permissions'][$permissionName])) {
        return (bool) $user['permissions'][$permissionName];
    }
    return true; // Default fallback to allowed if not explicitly set
}

/**
 * Require specific permission or abort with 403 JSON
 *
 * @param string $permissionName
 * @return void
 */
function requirePermission(string $permissionName): void
{
    if (!hasPermission($permissionName)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Akses ditolak: Anda tidak memiliki hak akses untuk aksi ini.'
        ]);
        exit;
    }
}
