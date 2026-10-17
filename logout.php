<?php
/**
 * Logout Handler
 */

require_once __DIR__ . '/includes/auth.php';

logoutUser();

$isAjax = (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
    || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)
    || ($_SERVER['REQUEST_METHOD'] === 'POST');

if ($isAjax) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'message' => 'Logout berhasil.']);
    exit;
}

header('Location: ./');
exit;
