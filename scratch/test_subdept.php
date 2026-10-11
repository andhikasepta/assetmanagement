<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

$getStatus = function($db, $pm, $py, $cm, $cy) {
    $sql = "
        WITH prev AS (
            SELECT DISTINCT ON (TRIM(r.reg_no)) 
                r.sitecode, TRIM(r.reg_no) as reg_no
            FROM rekap_db_master r
            WHERE r.period_month = :pm AND r.period_year = :py AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
            ORDER BY TRIM(r.reg_no), r.id
        ),
        curr AS (
            SELECT DISTINCT ON (TRIM(r.reg_no)) 
                r.sitecode, TRIM(r.reg_no) as reg_no
            FROM rekap_db_master r
            WHERE r.period_month = :cm AND r.period_year = :cy AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
            ORDER BY TRIM(r.reg_no), r.id
        ),
        combined AS (
            SELECT 
                COALESCE(c.sitecode, p.sitecode) as sitecode,
                COALESCE(c.reg_no, p.reg_no) as reg_no,
                CASE 
                    WHEN p.reg_no IS NOT NULL AND c.reg_no IS NULL THEN 'solved'
                    WHEN p.reg_no IS NOT NULL AND c.reg_no IS NOT NULL THEN 'unsolved'
                    ELSE 'new_db'
                END as status
            FROM prev p
            FULL OUTER JOIN curr c ON p.reg_no = c.reg_no
        )
        SELECT 
            sr.dept,
            sr.sub_dept,
            cb.sitecode,
            cb.status
        FROM combined cb
        INNER JOIN site_regional sr ON sr.sitecode = cb.sitecode
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute([':pm' => $pm, ':py' => $py, ':cm' => $cm, ':cy' => $cy]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
};

$currRows = $getStatus($db, 8, 2026, 9, 2026);
$prevRows = $getStatus($db, 7, 2026, 8, 2026);

function aggregateData($rows) {
    $depts = [];
    $subDepts = [];
    $outlet = ['solved' => 0, 'unsolved' => 0, 'new_db' => 0, 'solved_sites' => [], 'unsolved_sites' => [], 'new_db_sites' => []];
    $pmd = ['solved' => 0, 'unsolved' => 0, 'new_db' => 0, 'solved_sites' => [], 'unsolved_sites' => [], 'new_db_sites' => []];

    foreach ($rows as $r) {
        $d = strtoupper(trim($r['dept'] ?? ''));
        $sub = strtoupper(trim($r['sub_dept'] ?? ''));
        $status = $r['status'];
        $sc = $r['sitecode'];

        if (!isset($depts[$d])) {
            $depts[$d] = ['solved' => 0, 'unsolved' => 0, 'new_db' => 0, 'solved_sites' => [], 'unsolved_sites' => [], 'new_db_sites' => []];
        }
        $depts[$d][$status]++;
        $depts[$d][$status . '_sites'][$sc] = true;

        if ($sub !== '') {
            if (!isset($subDepts[$sub])) {
                $subDepts[$sub] = ['solved' => 0, 'unsolved' => 0, 'new_db' => 0, 'solved_sites' => [], 'unsolved_sites' => [], 'new_db_sites' => []];
            }
            $subDepts[$sub][$status]++;
            $subDepts[$sub][$status . '_sites'][$sc] = true;
        }

        if (in_array($d, ['CRO', 'ERO', 'WRO'])) {
            $outlet[$status]++;
            $outlet[$status . '_sites'][$sc] = true;
        }
        if ($d === 'PMD') {
            $pmd[$status]++;
            $pmd[$status . '_sites'][$sc] = true;
        }
    }

    $format = function($arr) {
        return [
            'solved' => $arr['solved'],
            'unsolved' => $arr['unsolved'],
            'new_db' => $arr['new_db'],
            'solved_sites' => count($arr['solved_sites']),
            'unsolved_sites' => count($arr['unsolved_sites']),
            'new_db_sites' => count($arr['new_db_sites']),
        ];
    };

    $out = [
        'outlet' => $format($outlet),
        'pmd' => $format($pmd),
        'depts' => array_map($format, $depts),
        'sub_depts' => array_map($format, $subDepts),
    ];
    return $out;
}

$cData = aggregateData($currRows);
$pData = aggregateData($prevRows);

echo json_encode([
    'current' => $cData,
    'prev' => $pData,
], JSON_PRETTY_PRINT);
