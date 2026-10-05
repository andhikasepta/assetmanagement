<?php
require_once __DIR__ . '/../config/database.php';

function getSiteMovementsData(PDO $db, int $year, ?int $month = null) {
    // 1. Fetch all sites
    $siteStmt = $db->query("
        SELECT id, category, regional, dept, sub_dept, sitecode, name_site, info, group_type, COALESCE(is_active, TRUE) as is_active
        FROM site_regional
        ORDER BY regional ASC, dept ASC, sub_dept ASC, sitecode ASC
    ");
    $allSites = $siteStmt->fetchAll(PDO::FETCH_ASSOC);

    $siteMap = [];
    $baseTypes = [];
    foreach ($allSites as $s) {
        $sc = strtoupper(trim($s['sitecode'] ?? ''));
        if ($sc !== '') {
            $siteMap[$sc] = $s;
            // PMD is always monthly
            if (strtoupper(trim($s['dept'] ?? '')) === 'PMD') {
                $baseTypes[$sc] = 'monthly';
            } else {
                $baseTypes[$sc] = strtolower(trim($s['group_type'] ?? 'monthly')) ?: 'monthly';
            }
        }
    }

    // Helper to get effective map for any month/year
    $getEffMap = function(int $y, int $m) use ($db, $baseTypes, $siteMap) {
        $stmt = $db->prepare("
            SELECT DISTINCT ON (sitecode) sitecode, group_type
            FROM site_group_history
            WHERE effective_year < :y OR (effective_year = :y AND effective_month <= :m)
            ORDER BY sitecode, effective_year DESC, effective_month DESC
        ");
        $stmt->execute([':y' => $y, ':m' => $m]);
        $map = $baseTypes;
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $sc = strtoupper(trim($r['sitecode']));
            if (isset($map[$sc])) {
                // If PMD, it cannot be quarterly
                if (isset($siteMap[$sc]) && strtoupper(trim($siteMap[$sc]['dept'] ?? '')) === 'PMD') {
                    $map[$sc] = 'monthly';
                } else {
                    $map[$sc] = strtolower(trim($r['group_type']));
                }
            }
        }
        return $map;
    };

    // Preload rule notes from site_group_history
    $notesStmt = $db->prepare("
        SELECT sitecode, effective_year, effective_month, group_type, notes, created_at
        FROM site_group_history
        WHERE effective_year = :y
        ORDER BY effective_month ASC, id ASC
    ");
    $notesStmt->execute([':y' => $year]);
    $historyRules = [];
    foreach ($notesStmt->fetchAll(PDO::FETCH_ASSOC) as $hr) {
        $sc = strtoupper(trim($hr['sitecode']));
        $mKey = (int)$hr['effective_month'];
        $historyRules[$mKey][$sc] = $hr;
    }

    $monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    $monthsToAnalyze = ($month !== null && $month >= 1 && $month <= 12) ? [$month] : range(1, 12);

    $allMovements = [];
    $periodSummary = [
        'current_active' => 0,
        'prev_active' => 0,
        'active_diff' => 0,
        'current_monthly' => 0,
        'prev_monthly' => 0,
        'monthly_diff' => 0,
        'current_quarterly' => 0,
        'prev_quarterly' => 0,
        'quarterly_diff' => 0,
        'current_inactive' => 0,
        'prev_inactive' => 0,
        'inactive_diff' => 0,
        'total_movements' => 0,
    ];

    foreach ($monthsToAnalyze as $m) {
        if ($m === 1) {
            $prevMap = $getEffMap($year - 1, 12);
        } else {
            $prevMap = $getEffMap($year, $m - 1);
        }
        $currMap = $getEffMap($year, $m);

        // Calculate counts
        $cMonthly = 0; $cQuarterly = 0; $cInactive = 0;
        foreach ($currMap as $sc => $type) {
            if ($type === 'inactive') $cInactive++;
            elseif ($type === 'quarterly') $cQuarterly++;
            else $cMonthly++;
        }
        $pMonthly = 0; $pQuarterly = 0; $pInactive = 0;
        foreach ($prevMap as $sc => $type) {
            if ($type === 'inactive') $pInactive++;
            elseif ($type === 'quarterly') $pQuarterly++;
            else $pMonthly++;
        }

        if (count($monthsToAnalyze) === 1) {
            $periodSummary['current_active'] = $cMonthly + $cQuarterly;
            $periodSummary['prev_active'] = $pMonthly + $pQuarterly;
            $periodSummary['active_diff'] = $periodSummary['current_active'] - $periodSummary['prev_active'];
            $periodSummary['current_monthly'] = $cMonthly;
            $periodSummary['prev_monthly'] = $pMonthly;
            $periodSummary['monthly_diff'] = $cMonthly - $pMonthly;
            $periodSummary['current_quarterly'] = $cQuarterly;
            $periodSummary['prev_quarterly'] = $pQuarterly;
            $periodSummary['quarterly_diff'] = $cQuarterly - $pQuarterly;
            $periodSummary['current_inactive'] = $cInactive;
            $periodSummary['prev_inactive'] = $pInactive;
            $periodSummary['inactive_diff'] = $cInactive - $pInactive;
        }

        foreach ($currMap as $sc => $currType) {
            $prevType = $prevMap[$sc] ?? 'monthly';
            if ($currType !== $prevType) {
                $siteInfo = $siteMap[$sc] ?? [];
                $hr = $historyRules[$m][$sc] ?? null;

                $movementType = 'changed';
                $description = '';
                if ($prevType === 'monthly' && $currType === 'quarterly') {
                    $movementType = 'monthly_to_quarterly';
                    $description = 'Beralih ke Quarterly';
                } elseif ($prevType === 'quarterly' && $currType === 'monthly') {
                    $movementType = 'quarterly_to_monthly';
                    $description = 'Beralih ke Monthly';
                } elseif ($currType === 'inactive') {
                    $movementType = 'became_inactive';
                    $description = 'Site Dinonaktifkan (Inactive)';
                } elseif ($prevType === 'inactive' && $currType === 'monthly') {
                    $movementType = 'reactivated_monthly';
                    $description = 'Diaktifkan kembali (Monthly)';
                } elseif ($prevType === 'inactive' && $currType === 'quarterly') {
                    $movementType = 'reactivated_quarterly';
                    $description = 'Diaktifkan kembali (Quarterly)';
                }

                $note = ($hr && !empty($hr['notes'])) ? $hr['notes'] : $description;

                $allMovements[] = [
                    'sitecode' => $sc,
                    'name_site' => $siteInfo['name_site'] ?? '',
                    'regional' => $siteInfo['regional'] ?? '',
                    'dept' => $siteInfo['dept'] ?? '',
                    'sub_dept' => $siteInfo['sub_dept'] ?? '',
                    'info' => $siteInfo['info'] ?? 'Outlet',
                    'effective_month' => $m,
                    'effective_year' => $year,
                    'effective_period' => ($monthNames[$m] ?? $m) . ' ' . $year,
                    'prev_status' => $prevType,
                    'curr_status' => $currType,
                    'movement_type' => $movementType,
                    'description' => $description,
                    'notes' => $note,
                    'created_at' => $hr['created_at'] ?? null,
                ];
            }
        }
    }

    $periodSummary['total_movements'] = count($allMovements);

    return [
        'period' => [
            'year' => $year,
            'month' => $month,
            'month_name' => ($month ? ($monthNames[$month] ?? $month) : 'Semua Bulan'),
            'prev_month_name' => ($month && $month > 1 ? $monthNames[$month - 1] : ($month === 1 ? 'Desember ' . ($year - 1) : '-')),
        ],
        'summary' => $periodSummary,
        'movements' => $allMovements
    ];
}

$db = getDbConnection();
$resMarch = getSiteMovementsData($db, 2026, 3);
echo "March Summary:\n";
print_r($resMarch['summary']);
echo "First 3 March movements:\n";
print_r(array_slice($resMarch['movements'], 0, 3));
