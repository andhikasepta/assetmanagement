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
            COUNT(*) FILTER (WHERE cb.status = 'solved') as solved_count,
            COUNT(*) FILTER (WHERE cb.status = 'unsolved') as unsolved_count,
            COUNT(*) FILTER (WHERE cb.status = 'new_db') as new_db_count,
            COUNT(DISTINCT cb.sitecode) FILTER (WHERE cb.status = 'solved') as solved_sites,
            COUNT(DISTINCT cb.sitecode) FILTER (WHERE cb.status = 'unsolved') as unsolved_sites,
            COUNT(DISTINCT cb.sitecode) FILTER (WHERE cb.status = 'new_db') as new_db_sites
        FROM combined cb
        INNER JOIN site_regional sr ON sr.sitecode = cb.sitecode
        GROUP BY sr.dept
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute([':pm' => $pm, ':py' => $py, ':cm' => $cm, ':cy' => $cy]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
};

$curr = $getStatus($db, 8, 2026, 9, 2026);
$prev = $getStatus($db, 7, 2026, 8, 2026);

$map = [];
foreach ($curr as $c) {
    $map[$c['dept']] = [
        'curr' => $c,
        'diff_solved' => $c['solved_count'],
        'diff_unsolved' => $c['unsolved_count'],
        'diff_new' => $c['new_db_count'],
    ];
}
foreach ($prev as $p) {
    if (isset($map[$p['dept']])) {
        $map[$p['dept']]['diff_solved'] -= $p['solved_count'];
        $map[$p['dept']]['diff_unsolved'] -= $p['unsolved_count'];
        $map[$p['dept']]['diff_new'] -= $p['new_db_count'];
    }
}
echo json_encode($map, JSON_PRETTY_PRINT);
