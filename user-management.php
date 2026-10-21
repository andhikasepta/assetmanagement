<?php
/**
 * User Management Page (SPA Entrypoint)
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/security.php';

sendSecurityHeaders();

if (!isLoggedIn()) {
    $_SESSION['open_login_modal'] = true;
} elseif (($_SESSION['user']['permissions']['can_access_user_management'] ?? true) === false) {
    $_SESSION['initial_page'] = 'all-summary';
} else {
    $_SESSION['initial_page'] = 'user-management';
}
header('Location: ./');
exit;
