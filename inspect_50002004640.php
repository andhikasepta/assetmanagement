<?php
require_once 'config/database.php';
$db = getDbConnection();

echo "=== SITE_REGIONAL ===\n";
$stmt = $db->prepare('SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type, is_active, is_counted FROM site_regional WHERE sitecode = ?');
$stmt->execute(['50002004640']);
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "=== SITE_GROUP_HISTORY ===\n";
$stmt = $db->prepare('SELECT * FROM site_group_history WHERE sitecode = ?');
$stmt->execute(['50002004640']);
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "=== RECONCILIATION FOR 50002004640 ===\n";
$stmt = $db->query("SELECT id, profile, period_month, period_year, total_physic_pct FROM asset_reconciliation WHERE profile LIKE '%50002004640%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
