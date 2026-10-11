<?php
$_GET['action'] = 'executive_summary';
$_GET['year'] = '2026';
$_GET['month'] = '9';
$_GET['category'] = 'all';
ob_start();
require __DIR__ . '/../api/reconciliation.php';
$output = ob_get_clean();
$data = json_decode($output, true);
echo "SUCCESS: " . ($data['success'] ? 'true' : 'false') . "\n";
$dbA = $data['data']['achievements']['db_analysis'] ?? [];
echo "OUTLET NATIONAL SOLVED: " . json_encode($dbA['outlet_national'] ?? []) . "\n";
echo "WRO SOLVED: " . json_encode($dbA['wro'] ?? []) . "\n";
echo "DNO SOLVED: " . json_encode($dbA['dno'] ?? []) . "\n";
