<?php
require __DIR__ . '/../config/database.php';
$db = getDbConnection();

$t0 = microtime(true);
$sql = "
    WITH prev AS (
        SELECT DISTINCT ON (TRIM(r.reg_no)) 
            r.sitecode, TRIM(r.reg_no) as reg_no
        FROM rekap_db_master r
        WHERE r.period_month = 8 AND r.period_year = 2026 AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
        ORDER BY TRIM(r.reg_no), r.id
    ),
    curr AS (
        SELECT DISTINCT ON (TRIM(r.reg_no)) 
            r.sitecode, TRIM(r.reg_no) as reg_no
        FROM rekap_db_master r
        WHERE r.period_month = 9 AND r.period_year = 2026 AND r.reg_no IS NOT NULL AND TRIM(r.reg_no) != ''
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
$stmt = $db->query($sql);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Status CTE count: " . count($rows) . " time: " . round(microtime(true) - $t0, 3) . "s\n";
