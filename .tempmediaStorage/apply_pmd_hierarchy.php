<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

// 1. Add column divisi to site_regional if not exists
$db->exec("ALTER TABLE site_regional ADD COLUMN IF NOT EXISTS divisi VARCHAR(100)");

// 2. Add column divisi to generated_reports if not exists
$db->exec("ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS divisi VARCHAR(100)");

echo "Columns added.\n";

// 3. Check current PMD sites
$stmt = $db->query("SELECT sitecode, name_site, dept, sub_dept, category FROM site_regional WHERE dept = 'PMD' OR category = 'monthly_pmd' ORDER BY sitecode");
$pmdSites = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($pmdSites) . " PMD sites before update:\n";
foreach ($pmdSites as $s) {
    echo "{$s['sitecode']} | {$s['name_site']} | dept: {$s['dept']} | sub_dept: {$s['sub_dept']}\n";
}

// 4. Update the 7 sites:
// CDA: DNO, CDA
// BWA MERUYA: DNO, BWA
// BWA BANTEN: DNO, BWA
// NEA: DNO, NEA
// BDA KELINKIT: DSO, BDA
// SAST: DSO, SAST
// SEOA: DSO, SEOA
$updates = [
    '0JKSKLA964'  => ['divisi' => 'PMD', 'dept' => 'DSO', 'sub_dept' => 'BDA'],
    '50002003679' => ['divisi' => 'PMD', 'dept' => 'DNO', 'sub_dept' => 'CDA'],
    '50002003684' => ['divisi' => 'PMD', 'dept' => 'DNO', 'sub_dept' => 'BWA'],
    '50002003965' => ['divisi' => 'PMD', 'dept' => 'DSO', 'sub_dept' => 'SAST'],
    '50002003976' => ['divisi' => 'PMD', 'dept' => 'DNO', 'sub_dept' => 'BWA'],
    '50002004145' => ['divisi' => 'PMD', 'dept' => 'DNO', 'sub_dept' => 'NEA'],
    '50002003434' => ['divisi' => 'PMD', 'dept' => 'DSO', 'sub_dept' => 'SEOA'],
];

$upStmt = $db->prepare("UPDATE site_regional SET divisi = :divisi, dept = :dept, sub_dept = :sub_dept WHERE sitecode = :sitecode");
foreach ($updates as $sc => $u) {
    $upStmt->execute([
        ':divisi' => $u['divisi'],
        ':dept' => $u['dept'],
        ':sub_dept' => $u['sub_dept'],
        ':sitecode' => $sc
    ]);
}

echo "\nUpdated site_regional for PMD sites.\n";

// Also check circular_pics:
// Ensure DNO and DSO have dept set as well:
// id 21: Taufiqurrohman: dept: PMD / DSO, sub_dept: DSO
// id 22: Azis Budi Prasetyo: dept: PMD / DNO, sub_dept: DNO
// id 18: Cecep H Rudi Riyanto: sub_dept: BWA BANTEN -> ensure BWA also matches!
$db->exec("
    INSERT INTO circular_pics (dept, sub_dept, pic, job_title, is_active)
    SELECT 'DNO', '', 'Azis Budi Prasetyo', 'Head-DOM North Area', true
    WHERE NOT EXISTS (SELECT 1 FROM circular_pics WHERE UPPER(dept) = 'DNO' AND (sub_dept IS NULL OR sub_dept = '' OR sub_dept = 'DNO'))
");
$db->exec("
    INSERT INTO circular_pics (dept, sub_dept, pic, job_title, is_active)
    SELECT 'DSO', '', 'Taufiqurrohman', 'Head-DOM South Area', true
    WHERE NOT EXISTS (SELECT 1 FROM circular_pics WHERE UPPER(dept) = 'DSO' AND (sub_dept IS NULL OR sub_dept = '' OR sub_dept = 'DSO'))
");
$db->exec("
    INSERT INTO circular_pics (dept, sub_dept, pic, job_title, is_active)
    SELECT '', 'BWA', 'Cecep H Rudi Riyanto', 'Head-Banten And West Area', true
    WHERE NOT EXISTS (SELECT 1 FROM circular_pics WHERE UPPER(sub_dept) = 'BWA')
");

echo "circular_pics updated.\n";

// Verify circular_pics
$stmt = $db->query("SELECT * FROM circular_pics WHERE dept IN ('DNO', 'DSO', 'PMD') OR sub_dept IN ('CDA', 'BWA', 'SAST', 'BDA', 'NEA', 'SEOA', 'DNO', 'DSO') ORDER BY id");
while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "ID: {$r['id']} | Dept: '{$r['dept']}' | SubDept: '{$r['sub_dept']}' | PIC: {$r['pic']} | Title: {$r['job_title']}\n";
}
