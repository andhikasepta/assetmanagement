<?php
require_once __DIR__ . '/test_movement_func.php';
$db = getDbConnection();
$resMay = getSiteMovementsData($db, 2026, 5);
echo "May Summary:\n";
print_r($resMay['summary']);
echo "May movements:\n";
print_r(array_map(function($m) {
    return "{$m['sitecode']} ({$m['name_site']}): {$m['prev_status']} -> {$m['curr_status']}";
}, $resMay['movements']));
