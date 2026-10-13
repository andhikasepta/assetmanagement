<?php
/**
 * Logout Handler
 */

require_once __DIR__ . '/includes/auth.php';

logoutUser();

header('Location: ./');
exit;
