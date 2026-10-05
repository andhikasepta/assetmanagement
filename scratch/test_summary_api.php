<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
// We want to see achievements
ob_start();
include __DIR__ . '/../api/reconciliation.php';
$json = ob_get_clean();
$res = json_decode($json, true);
echo "Current ERO achievements: " . json_encode($res['achievements']['ero']) . "\n";

$vals = [
    79.38, 100.00, 73.32, 100.00, 91.62, 0.00, 95.82, 77.88, 100.00, 99.17, 100.00, 86.38,
    99.95, 92.46, 92.64, 99.94, 71.45, 21.86, 80.27, 98.00, 86.40, 92.65, 100.00, 79.93,
    91.79, 98.45, 64.27, 81.43
];
echo "Count: " . count($vals) . "\n";
echo "Sum: " . array_sum($vals) . "\n";
echo "Avg 28 (with 0.00% ATALSAT01): " . (array_sum($vals) / 28) . " -> " . round(array_sum($vals) / 28) . "%\n";
$vals27 = array_slice($vals, 0, 5) + array_slice($vals, 6); // remove index 5 which is ATALSAT01
$sum27 = array_sum($vals) - 0.0;
echo "Avg 27 (excluding ATALSAT01): " . ($sum27 / 27) . " -> " . round($sum27 / 27) . "%\n";

