<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

$updates = [
    '0JKSKLA964'  => ['divisi' => 'PMD', 'dept' => 'DSO', 'sub_dept' => 'BDA'],
    '50002003679' => ['divisi' => 'PMD', 'dept' => 'DNO', 'sub_dept' => 'CDA'],
    '50002003684' => ['divisi' => 'PMD', 'dept' => 'DNO', 'sub_dept' => 'BWA'],
    '50002003965' => ['divisi' => 'PMD', 'dept' => 'DSO', 'sub_dept' => 'SAST'],
    '50002003976' => ['divisi' => 'PMD', 'dept' => 'DNO', 'sub_dept' => 'BWA'],
    '50002004145' => ['divisi' => 'PMD', 'dept' => 'DNO', 'sub_dept' => 'NEA'],
    '50002003434' => ['divisi' => 'PMD', 'dept' => 'DSO', 'sub_dept' => 'SEOA'],
];

$upStmt = $db->prepare("UPDATE generated_reports SET divisi = :divisi, dept = :dept, sub_dept = :sub_dept WHERE sitecode = :sitecode");
foreach ($updates as $sc => $u) {
    $upStmt->execute([
        ':divisi' => $u['divisi'],
        ':dept' => $u['dept'],
        ':sub_dept' => $u['sub_dept'],
        ':sitecode' => $sc
    ]);
}
echo "generated_reports updated successfully\n";
