<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

$stmt = $db->query("SELECT * FROM site_group_history ORDER BY effective_year ASC, effective_month ASC, id ASC");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Total rules in site_group_history: " . count($rows) . "\n";
foreach ($rows as $r) {
    echo "ID: {$r['id']} | Site: {$r['sitecode']} | Type: {$r['group_type']} | Period: {$r['effective_month']}/{$r['effective_year']} | Notes: {$r['notes']}\n";
}
