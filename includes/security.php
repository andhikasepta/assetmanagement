<?php
/**
 * Security and CSRF Protection Helper for AMORA
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/auth.php';

ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);

/**
 * Send standard security headers
 */
function sendSecurityHeaders(): void
{
    if (headers_sent()) {
        return;
    }
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
}

/**
 * Generate CSRF token if not already exists in session
 */
function getCsrfToken(): string
{
    if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
        @session_start();
    }
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'] ?? '';
}

/**
 * Validate CSRF token from header (X-CSRF-TOKEN), POST body, or JSON input
 *
 * @param bool $exitOnError If true, sends HTTP 403 JSON and terminates execution
 * @return bool
 */
function validateCsrfToken(bool $exitOnError = true): bool
{
    if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
        session_start();
    }

    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';

    // Check JSON body if token is not found in header or POST
    if (empty($token) && in_array($_SERVER['REQUEST_METHOD'] ?? '', ['POST', 'PUT', 'DELETE', 'PATCH'], true)) {
        $raw = file_get_contents('php://input');
        if (!empty($raw)) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && !empty($decoded['csrf_token'])) {
                $token = (string) $decoded['csrf_token'];
            }
        }
    }

    $validToken = $_SESSION['csrf_token'] ?? '';
    $isValid = (!empty($token) && !empty($validToken) && hash_equals($validToken, $token));

    if (!$isValid && $exitOnError) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'Sesi kadaluarsa atau CSRF token tidak valid. Silakan refresh halaman.',
            'error_code' => 'CSRF_INVALID'
        ]);
        exit;
    }

    return $isValid;
}

/**
 * Require user to be authenticated as admin
 *
 * @param bool $exitOnError
 * @return bool
 */
function requireAuth(bool $exitOnError = true): bool
{
    if (!isLoggedIn()) {
        if ($exitOnError) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'message' => 'Akses ditolak. Silakan login sebagai administrator terlebih dahulu.',
                'error_code' => 'UNAUTHORIZED'
            ]);
            exit;
        }
        return false;
    }
    return true;
}
