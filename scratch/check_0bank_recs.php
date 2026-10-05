<?php
require_once 'C:/laragon/www/assetmanagement/config/database.php';
$db = getDbConnection();
$rows = $db->query("
    SELECT id, profile, period_month, period_year, total_physic_pct 
    FROM asset_reconciliation 
    WHERE profile ILIKE '%0BANKLA001%'
    ORDER BY period_year, period_month, id
")->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $r) {
    echo "Month {$r['period_month']}/{$r['period_year']}: {$r['total_physic_pct']}% | {$r['profile']}\n";
}
