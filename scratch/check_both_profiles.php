<?php
require_once __DIR__ . '/../config/database.php';
$db = getDbConnection();

$stmt = $db->query("
    SELECT sitecode, period_year, period_month, COUNT(*) as cnt,
           SUM(CASE WHEN profile ~* '\\mQ[1-4]\\M' THEN 1 ELSE 0 END) as q_cnt,
           SUM(CASE WHEN profile !~* '\\mQ[1-4]\\M' THEN 1 ELSE 0 END) as m_cnt
    FROM (
        SELECT r.period_year, r.period_month, r.profile, s.sitecode
        FROM asset_reconciliation r
        JOIN site_regional s ON (
            r.profile ILIKE '% - ' || s.sitecode || ' - %'
            OR r.profile ILIKE '%-' || s.sitecode || '-%'
            OR r.profile ILIKE '% ' || s.sitecode || ' %'
        )
    ) t
    GROUP BY sitecode, period_year, period_month
    HAVING SUM(CASE WHEN profile ~* '\\mQ[1-4]\\M' THEN 1 ELSE 0 END) > 0
       AND SUM(CASE WHEN profile !~* '\\mQ[1-4]\\M' THEN 1 ELSE 0 END) > 0
    ORDER BY period_year, period_month, sitecode
");
$both = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Periods with both Monthly and Quarterly profiles for same site:\n";
foreach ($both as $b) {
    echo sprintf("Site: %-15s | %4d-%02d | Q: %d | M: %d\n", $b['sitecode'], $b['period_year'], $b['period_month'], $b['q_cnt'], $b['m_cnt']);
}
