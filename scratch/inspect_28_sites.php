<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

$sites = [
    '50002004133', '50002003292', '0GRLKLA002', '0MNDKLA002', '50002004338', 'ATALSAT01',
    '50002002841', '50002002969', '50002004005', '50002002996', '50002004263', '0MDXKLA013',
    '50002002305', '50002001579', '50002004635', '50002001915', '50002004288', '0MRWKLA014',
    '0BANKLA001', '0BGIKLA005', '50002004745', '0NBRKLA002', '50002004008', '50002004344',
    '50002003180', '0SRBKLA016', '0TRNKLA003', '50002004746'
];

echo "Total list count: " . count($sites) . PHP_EOL;

$placeholders = implode(',', array_fill(0, count($sites), '?'));
$stmt = $db->prepare("SELECT id, sitecode, dept, group_type, is_active FROM site_regional WHERE sitecode IN ($placeholders)");
$stmt->execute($sites);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$found = [];
foreach ($rows as $r) {
    $found[$r['sitecode']] = $r;
}

echo "Found in site_regional: " . count($found) . PHP_EOL;

foreach ($sites as $s) {
    if (!isset($found[$s])) {
        echo "MISSING: $s\n";
    } else {
        $info = $found[$s];
        $hstmt = $db->prepare("SELECT group_type, effective_month, effective_year FROM site_group_history WHERE UPPER(sitecode) = UPPER(?) ORDER BY effective_year DESC, effective_month DESC");
        $hstmt->execute([$s]);
        $hist = $hstmt->fetchAll(PDO::FETCH_ASSOC);
        
        $effType = $info['group_type'];
        
        // Find effective rule for Sep 2026 (month 9)
        foreach ($hist as $h) {
            if ($h['effective_year'] < 2026 || ($h['effective_year'] == 2026 && $h['effective_month'] <= 9)) {
                $effType = $h['group_type'];
                break;
            }
        }
        
        echo sprintf("%-15s | Dept: %-5s | DB Type: %-10s | EffSep: %-10s | Active: %d | HistCount: %d\n", 
            $s, $info['dept'], $info['group_type'], $effType, $info['is_active'], count($hist));
    }
}

echo "\n--- ATALSAT01 History ---\n";
$hstmt = $db->prepare("SELECT * FROM site_group_history WHERE UPPER(sitecode) = 'ATALSAT01' ORDER BY effective_year, effective_month");
$hstmt->execute();
print_r($hstmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n--- ATALSAT01 in site_regional ---\n";
$srStmt = $db->prepare("SELECT * FROM site_regional WHERE UPPER(sitecode) = 'ATALSAT01'");
$srStmt->execute();
print_r($srStmt->fetch(PDO::FETCH_ASSOC));

echo "\n--- All quarterly entries in site_group_history ---\n";
$stmt = $db->query("SELECT sgh.*, sr.dept, sr.name_site, sr.group_type as sr_type FROM site_group_history sgh LEFT JOIN site_regional sr ON UPPER(sr.sitecode) = UPPER(sgh.sitecode) WHERE sgh.group_type = 'quarterly' ORDER BY sgh.sitecode, sgh.effective_year, sgh.effective_month");
$qEntries = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($qEntries as $qe) {
    echo sprintf("%-15s | %4d-%02d | dept: %-5s | sr_type: %-10s | notes: %s\n", 
        $qe['sitecode'], $qe['effective_year'], $qe['effective_month'], $qe['dept'], $qe['sr_type'], $qe['notes']);
}

