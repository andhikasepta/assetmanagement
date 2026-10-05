<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['action'] = 'site_movements';
$_GET['year'] = '2026';
$_GET['month'] = '';

ob_start();
require __DIR__ . '/../api/site_regional.php';
$out = ob_get_clean();
$json = json_decode($out, true);
echo "All Year Movements Count: " . $json['summary']['total_movements'] . "\n";
$byPeriod = [];
foreach ($json['movements'] as $m) {
    $byPeriod[$m['effective_period']] = ($byPeriod[$m['effective_period']] ?? 0) + 1;
}
print_r($byPeriod);
