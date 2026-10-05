<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

// Temporarily test in a transaction
$db->beginTransaction();

// Update ATALSAT01 in 2026-09 to monthly
$stmt = $db->prepare("UPDATE site_group_history SET group_type = 'monthly', notes = 'Set to Monthly' WHERE UPPER(sitecode) = 'ATALSAT01' AND effective_year = 2026 AND effective_month = 9");
$stmt->execute();

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['action'] = 'summary';
$_GET['month'] = '9';
$_GET['year'] = '2026';
$_GET['so_type'] = 'monthly';

ob_start();
// Run logic
include __DIR__ . '/../api/reconciliation.php';
// won't reach here if exit is called, but transaction will rollback on shutdown unless committed
