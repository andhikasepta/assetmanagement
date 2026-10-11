<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();
$rows = $db->query('SELECT DISTINCT period_month, period_year FROM rekap_db_master ORDER BY period_year DESC, period_month DESC')->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($rows, JSON_PRETTY_PRINT);
