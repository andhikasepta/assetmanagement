<?php
require_once 'C:/laragon/www/WarehouseManagementSystem/backend/config/database.php';

$sql = "SELECT 
    inbound_master.po_nomor,
    MAX(inbound_master.po_target_delivery) as target_delivery,
    MIN(g.gr_date) as gr_date,
    EXTRACT(MONTH FROM COALESCE(MAX(inbound_master.po_target_delivery), MIN(g.gr_date))) as mth,
    EXTRACT(YEAR FROM COALESCE(MAX(inbound_master.po_target_delivery), MIN(g.gr_date))) as yr
FROM inbound_master
INNER JOIN inbound_gr g ON TRIM(inbound_master.po_nomor) = TRIM(g.po_no)
WHERE inbound_master.po_nomor IS NOT NULL AND TRIM(inbound_master.po_nomor) != ''
GROUP BY inbound_master.po_nomor
HAVING EXTRACT(MONTH FROM COALESCE(MAX(inbound_master.po_target_delivery), MIN(g.gr_date))) = 7";

$stmt = $pdo->query($sql);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Total POs in July: " . count($rows) . "\n";
echo str_repeat("-", 80) . "\n";
printf("%-15s | %-12s | %-12s | %-12s | %-15s\n", "PO Nomor", "Target Deliv", "GR Date", "Target < GR", "Code Status");
echo str_repeat("-", 80) . "\n";

$ontime = 0;
$terlambat = 0;

foreach ($rows as $r) {
    $t = $r['target_delivery'];
    $g = $r['gr_date'];
    $isLess = ($t !== null && $g !== null && $t < $g);
    $status = $isLess ? 'ontime_cnt' : 'late_cnt';
    if ($isLess) $ontime++; else $terlambat++;
    
    printf("%-15s | %-12s | %-12s | %-12s | %-15s\n", 
        $r['po_nomor'], 
        $t ?? 'NULL', 
        $g ?? 'NULL', 
        $isLess ? 'YES (<)' : 'NO (>=)',
        $status
    );
}
echo str_repeat("-", 80) . "\n";
echo "Summary: Ontime=$ontime, Terlambat=$terlambat\n";
