<?php
/**
 * CSRF Token API
 * 
 * Generates and returns a CSRF token for the current session.
 * All state-changing API calls must include this token.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

session_start();

if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

echo json_encode([
    'success' => true,
    'token'   => $_SESSION['csrf_token'],
]);
