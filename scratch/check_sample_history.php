<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

$sites = ['0BMAKLA001', '0BANKLA001', '0KRMKLA003', 'ATALSAT01'];
foreach ($sites as $sc) {
    echo "=== History for $sc ===\n";
    $stmt = $db->prepare("SELECT * FROM site_group_history WHERE UPPER(sitecode) = :sc ORDER BY effective_year ASC, effective_month ASC");
    $stmt->execute([':sc' => $sc]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        echo "{$r['effective_month']}/{$r['effective_year']}: type={$r['group_type']} | note={$r['notes']}\n";
    }
}
