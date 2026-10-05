<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['action'] = 'site_movements';
$_GET['year'] = '2026';
$_GET['month'] = '3';

ob_start();
require __DIR__ . '/../api/site_regional.php';
$out = ob_get_clean();
$json = json_decode($out, true);
echo "Success: " . ($json['success'] ? 'true' : 'false') . "\n";
echo "Month: " . $json['period']['month_name'] . " " . $json['period']['year'] . " (vs " . $json['period']['prev_month_name'] . ")\n";
echo "Total movements: " . $json['summary']['total_movements'] . "\n";
echo "Active diff: " . $json['summary']['active_diff'] . "\n";
echo "Monthly diff: " . $json['summary']['monthly_diff'] . "\n";
echo "Quarterly diff: " . $json['summary']['quarterly_diff'] . "\n";
echo "First movement: " . json_encode($json['movements'][0]) . "\n";
