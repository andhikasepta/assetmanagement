<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

$year = 2026;

// 1. Get all sites
$stmt = $db->query("
    SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type, COALESCE(is_active, TRUE) as is_active
    FROM site_regional
    ORDER BY sitecode ASC
");
$allSites = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Map by upper sitecode
$siteMap = [];
$baseTypes = [];
foreach ($allSites as $s) {
    $sc = strtoupper(trim($s['sitecode'] ?? ''));
    if ($sc !== '') {
        $siteMap[$sc] = $s;
        $baseTypes[$sc] = strtolower(trim($s['group_type'] ?? 'monthly')) ?: 'monthly';
    }
}

// Helper to get effective type for all sites at month m, year y
function getEffectiveMap($db, $year, $month, $baseTypes) {
    $stmt = $db->prepare("
        SELECT DISTINCT ON (sitecode) sitecode, group_type
        FROM site_group_history
        WHERE effective_year < :y OR (effective_year = :y AND effective_month <= :m)
        ORDER BY sitecode, effective_year DESC, effective_month DESC
    ");
    $stmt->execute([':y' => $year, ':m' => $month]);
    $map = $baseTypes;
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $sc = strtoupper(trim($r['sitecode']));
        if (isset($map[$sc])) {
            $map[$sc] = strtolower(trim($r['group_type']));
        }
    }
    return $map;
}

// Compare each month 1 to 12
echo "=== Site Movements in 2026 ===\n";
for ($m = 1; $m <= 12; $m++) {
    // Previous month (for m=1, compare with m=12 of year-1 or base)
    if ($m === 1) {
        $prevMap = getEffectiveMap($db, $year - 1, 12, $baseTypes);
    } else {
        $prevMap = getEffectiveMap($db, $year, $m - 1, $baseTypes);
    }
    $currMap = getEffectiveMap($db, $year, $m, $baseTypes);

    $movements = [];
    foreach ($currMap as $sc => $currType) {
        $prevType = $prevMap[$sc] ?? 'monthly';
        if ($currType !== $prevType) {
            $siteInfo = $siteMap[$sc] ?? [];
            $movements[] = [
                'sitecode' => $sc,
                'name_site' => $siteInfo['name_site'] ?? '',
                'regional' => $siteInfo['regional'] ?? '',
                'dept' => $siteInfo['dept'] ?? '',
                'prev' => $prevType,
                'curr' => $currType
            ];
        }
    }

    if (!empty($movements)) {
        echo "\nMonth $m/$year has " . count($movements) . " movements:\n";
        foreach ($movements as $mv) {
            echo "  [{$mv['regional']}] {$mv['sitecode']} ({$mv['name_site']}): {$mv['prev']} -> {$mv['curr']}\n";
        }
    }
}
