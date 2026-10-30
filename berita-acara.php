<?php
/**
 * Berita Acara Page (SPA Entrypoint)
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/security.php';

sendSecurityHeaders();

if (!isLoggedIn()) {
    $_SESSION['open_login_modal'] = true;
} elseif (($_SESSION['user']['permissions']['can_access_berita_acara'] ?? true) === false) {
    header('Location: ./');
    exit;
} else {
    $_SESSION['initial_page'] = 'berita-acara';
}
header('Location: ./');
exit;
