<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

$stmt = $db->prepare("UPDATE site_group_history SET group_type = 'monthly', notes = 'Set to Monthly (user spreadsheet Sep ERO)' WHERE UPPER(sitecode) = 'ATALSAT01' AND effective_year = 2026 AND effective_month = 9");
$stmt->execute();
echo "Updated rows: " . $stmt->rowCount() . "\n";
