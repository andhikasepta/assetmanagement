<?php
/**
 * CSRF Token API
 * Generates and returns a CSRF token for the current session.
 */

require_once __DIR__ . '/../includes/security.php';

sendSecurityHeaders();
header('Content-Type: application/json; charset=utf-8');

$token = getCsrfToken();

echo json_encode([
    'success' => true,
    'token'   => $token,
]);
