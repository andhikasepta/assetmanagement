<?php
/**
 * Weekly Summary Page Section (SPA Component)
 * Only displays:
 * 1. Achievements Cards (PMD / Outlet Regional with vs Previous Week Trend)
 * 2. Score Card Summary (Rating & Execution KPI)
 * 3. Report SO (Reconciliation Data Table)
 * Controls: Only Switch of PMD and Outlet Regional, Bulan, Week (Week 1 - 4), Tahun
 */

$latestWeeklyPeriod = null;
try {
    $weeklyDb = getDbConnection();
    $wkLatestStmt = $weeklyDb->query("
        SELECT 
            COALESCE(period_month, EXTRACT(MONTH FROM period_end)::int) as period_month, 
            COALESCE(period_week, CASE WHEN EXTRACT(DAY FROM period_end) <= 7 THEN 1 WHEN EXTRACT(DAY FROM period_end) <= 14 THEN 2 WHEN EXTRACT(DAY FROM period_end) <= 21 THEN 3 ELSE 4 END) as period_week, 
            COALESCE(period_year, EXTRACT(YEAR FROM period_end)::int) as period_year 
        FROM asset_reconciliation_weekly 
        WHERE profile NOT ILIKE 'profile%'
        ORDER BY period_year DESC, period_month DESC, period_week DESC, id DESC 
        LIMIT 1
    ");
    $latestWeeklyPeriod = $wkLatestStmt ? $wkLatestStmt->fetch(PDO::FETCH_ASSOC) : null;
} catch (Throwable $e) {
}

$defaultWeeklyYear = !empty($latestWeeklyPeriod['period_year']) ? (int) $latestWeeklyPeriod['period_year'] : (int) date('Y');
$defaultWeeklyMonth = !empty($latestWeeklyPeriod['period_month']) ? (int) $latestWeeklyPeriod['period_month'] : (int) date('n');
$defaultWeeklyWeek = !empty($latestWeeklyPeriod['period_week']) ? (int) $latestWeeklyPeriod['period_week'] : 1;
?>
<section id="page-weekly-summary" class="page-section" style="display: none;">

    <!-- ── Unified Dashboard Controls: Category Switch & Periode (Bulan, Week, Tahun) ────── -->
    <div class="card sticky-controls-card" id="card-weekly-summary-controls">
        <div class="card-header sticky-controls-header"
            style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem; padding: 0.75rem 1.25rem;">

            <!-- Left: Switch of PMD and Outlet Regional ONLY -->
            <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <span
                        style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">CATEGORY:</span>
                    <div class="summary-type-slider-wrapper" id="weekly-cat-slider">
                        <button type="button" class="summary-type-slider-btn active" id="btn-weekly-cat-pmd"
                            onclick="App.switchWeeklyCategory('pmd')">
                            <span>PMD</span>
                        </button>
                        <button type="button" class="summary-type-slider-btn" id="btn-weekly-cat-outlet"
                            onclick="App.switchWeeklyCategory('outlet')">
                            <span>Outlet Regional</span>
                        </button>
                    </div>
                    <span style="font-size: 11px; color: #94a3b8; margin-left: 2px;" id="weekly-cat-status">
                        (<strong style="color: #9333ea;">PMD</strong> Target 98%)
                    </span>
                </div>
            </div>

            <!-- Right: Periode Month, Week & Year Filters -->
            <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
                <!-- Bulan -->
                <div style="display: flex; align-items: center; gap: 0.45rem;">
                    <label for="weekly-filter-month"
                        style="font-size: 12px; font-weight: 600; color: #475569;">BULAN</label>
                    <select id="weekly-filter-month" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onWeeklyMonthChange()">
                        <?php
                        $monthNames = [
                            1 => 'Januari',
                            2 => 'Februari',
                            3 => 'Maret',
                            4 => 'April',
                            5 => 'Mei',
                            6 => 'Juni',
                            7 => 'Juli',
                            8 => 'Agustus',
                            9 => 'September',
                            10 => 'Oktober',
                            11 => 'November',
                            12 => 'Desember'
                        ];
                        foreach ($monthNames as $num => $name): ?>
                            <option value="<?= $num ?>" <?= ($num === $defaultWeeklyMonth) ? 'selected' : '' ?>>
                                <?= $name ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <!-- Week -->
                <div style="display: flex; align-items: center; gap: 0.45rem;">
                    <label for="weekly-filter-week"
                        style="font-size: 12px; font-weight: 600; color: #475569;">WEEK</label>
                    <select id="weekly-filter-week" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.loadWeeklySummary()">
                        <?php for ($wk = 1; $wk <= 4; $wk++): ?>
                            <option value="<?= $wk ?>" <?= ($wk === $defaultWeeklyWeek) ? 'selected' : '' ?>>
                                Week <?= $wk ?>
                            </option>
                        <?php endfor; ?>
                    </select>
                </div>

                <!-- Tahun -->
                <div style="display: flex; align-items: center; gap: 0.45rem;">
                    <label for="weekly-filter-year"
                        style="font-size: 12px; font-weight: 600; color: #475569;">TAHUN</label>
                    <select id="weekly-filter-year" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onWeeklyYearChange()">
                        <?php
                        $curY = (int) date('Y');
                        for ($y = $curY; $y <= $curY + 5; $y++): ?>
                            <option value="<?= $y ?>" <?= ($y === $defaultWeeklyYear) ? 'selected' : '' ?>><?= $y ?></option>
                        <?php endfor; ?>
                    </select>
                </div>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- SECTION 1: ACHIEVEMENTS CARDS                                       -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div class="card" id="weekly-card-executive-summary" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                    <h2 class="card-title" id="weekly-executive-title" style="margin: 0;">Executive Summary</h2>
                    <span id="weekly-executive-period-badge" class="badge"
                        style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11.5px; padding: 3px 9px; border-radius: 6px; letter-spacing: 0.2px;">
                        September - Week 1 2026
                    </span>
                </div>
            </div>
        </div>
        <div class="card-body" style="padding: 1.25rem;">
            <!-- ── Achievement Cards (PMD: PMD, DNO, DSO; Outlet Regional: National, WRO, CRO, ERO) ── -->
            <div class="kpi-grid" id="weekly-achievement-cards" style="margin-bottom: 0;">

                <!-- PMD Cards (Default Active) -->
                <div class="kpi-card kpi-card-split" id="weekly-kpi-card-pmd">
                    <div class="kpi-title">Summary PMD Achievement</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="weekly-kpi-pmd-achievement">0%</div>
                        <div class="kpi-split-badges">
                            <div class="kpi-status-box" id="weekly-kpi-pmd-status"></div>
                            <div class="kpi-split-trend" id="weekly-kpi-pmd-trend"></div>
                        </div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="weekly-kpi-pmd-subtext">Avg PMD Divisi (0 Sites)</div>
                    </div>
                </div>

                <div class="kpi-card kpi-card-split" id="weekly-kpi-card-dno">
                    <div class="kpi-title">DNO Achievement</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="weekly-kpi-dno-achievement">0%</div>
                        <div class="kpi-split-badges">
                            <div class="kpi-status-box" id="weekly-kpi-dno-status"></div>
                            <div class="kpi-split-trend" id="weekly-kpi-dno-trend"></div>
                        </div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="weekly-kpi-dno-subtext">Avg DEPT DNO (0 Sites)</div>
                    </div>
                </div>

                <div class="kpi-card kpi-card-split" id="weekly-kpi-card-dso">
                    <div class="kpi-title">DSO Achievement</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="weekly-kpi-dso-achievement">0%</div>
                        <div class="kpi-split-badges">
                            <div class="kpi-status-box" id="weekly-kpi-dso-status"></div>
                            <div class="kpi-split-trend" id="weekly-kpi-dso-trend"></div>
                        </div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="weekly-kpi-dso-subtext">Avg DEPT DSO (0 Sites)</div>
                    </div>
                </div>

                <!-- Outlet Regional Cards (Shown when Outlet Regional is selected) -->
                <div class="kpi-card kpi-card-split" id="weekly-kpi-card-outlet-national" style="display: none;">
                    <div class="kpi-title" id="weekly-kpi-outlet-title">Summary Outlet Regional Achievement</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="weekly-kpi-outlet-achievement">0%</div>
                        <div class="kpi-split-badges">
                            <div class="kpi-status-box" id="weekly-kpi-outlet-status"></div>
                            <div class="kpi-split-trend" id="weekly-kpi-outlet-trend"></div>
                        </div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="weekly-kpi-outlet-subtext">Avg Outlet Regional (0 Sites)</div>
                    </div>
                </div>

                <!-- WRO Group: WRO Card + Subdept Cards (CSO, NSO, SSO) -->
                <div class="kpi-card-group" id="weekly-kpi-group-wro" style="display: none;">
                    <div class="kpi-card kpi-card-split" id="weekly-kpi-card-wro">
                        <div class="kpi-title">WRO Achievement</div>
                        <div class="kpi-card-main">
                            <div class="kpi-split-value" id="weekly-kpi-wro-achievement">0%</div>
                            <div class="kpi-split-badges">
                                <div class="kpi-status-box" id="weekly-kpi-wro-status"></div>
                                <div class="kpi-split-trend" id="weekly-kpi-wro-trend"></div>
                            </div>
                        </div>
                        <div class="kpi-card-meta">
                            <div class="kpi-subtext" id="weekly-kpi-wro-subtext">Avg DEPT WRO (0 Sites)</div>
                        </div>
                    </div>
                    <div class="kpi-subdept-container">
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-cso">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">CSO</span>
                                <span id="weekly-kpi-subdept-trend-cso"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-cso">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-cso">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-cso"></div>
                        </div>
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-nso">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">NSO</span>
                                <span id="weekly-kpi-subdept-trend-nso"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-nso">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-nso">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-nso"></div>
                        </div>
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-sso">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">SSO</span>
                                <span id="weekly-kpi-subdept-trend-sso"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-sso">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-sso">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-sso"></div>
                        </div>
                    </div>
                </div>

                <!-- CRO Group: CRO Card + Subdept Cards (CJDO, EKO, WJO, WKO) -->
                <div class="kpi-card-group" id="weekly-kpi-group-cro" style="display: none;">
                    <div class="kpi-card kpi-card-split" id="weekly-kpi-card-cro">
                        <div class="kpi-title">CRO Achievement</div>
                        <div class="kpi-card-main">
                            <div class="kpi-split-value" id="weekly-kpi-cro-achievement">0%</div>
                            <div class="kpi-split-badges">
                                <div class="kpi-status-box" id="weekly-kpi-cro-status"></div>
                                <div class="kpi-split-trend" id="weekly-kpi-cro-trend"></div>
                            </div>
                        </div>
                        <div class="kpi-card-meta">
                            <div class="kpi-subtext" id="weekly-kpi-cro-subtext">Avg DEPT CRO (0 Sites)</div>
                        </div>
                    </div>
                    <div class="kpi-subdept-container">
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-cjdo">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">CJDO</span>
                                <span id="weekly-kpi-subdept-trend-cjdo"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-cjdo">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-cjdo">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-cjdo"></div>
                        </div>
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-eko">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">EKO</span>
                                <span id="weekly-kpi-subdept-trend-eko"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-eko">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-eko">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-eko"></div>
                        </div>
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-wjo">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">WJO</span>
                                <span id="weekly-kpi-subdept-trend-wjo"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-wjo">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-wjo">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-wjo"></div>
                        </div>
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-wko">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">WKO</span>
                                <span id="weekly-kpi-subdept-trend-wko"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-wko">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-wko">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-wko"></div>
                        </div>
                    </div>
                </div>

                <!-- ERO Group: ERO Card + Subdept Cards (BNO, EJO, MPO, SMO) -->
                <div class="kpi-card-group" id="weekly-kpi-group-ero" style="display: none;">
                    <div class="kpi-card kpi-card-split" id="weekly-kpi-card-ero">
                        <div class="kpi-title">ERO Achievement</div>
                        <div class="kpi-card-main">
                            <div class="kpi-split-value" id="weekly-kpi-ero-achievement">0%</div>
                            <div class="kpi-split-badges">
                                <div class="kpi-status-box" id="weekly-kpi-ero-status"></div>
                                <div class="kpi-split-trend" id="weekly-kpi-ero-trend"></div>
                            </div>
                        </div>
                        <div class="kpi-card-meta">
                            <div class="kpi-subtext" id="weekly-kpi-ero-subtext">Avg DEPT ERO (0 Sites)</div>
                        </div>
                    </div>
                    <div class="kpi-subdept-container">
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-bno">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">BNO</span>
                                <span id="weekly-kpi-subdept-trend-bno"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-bno">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-bno">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-bno"></div>
                        </div>
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-ejo">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">EJO</span>
                                <span id="weekly-kpi-subdept-trend-ejo"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-ejo">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-ejo">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-ejo"></div>
                        </div>
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-mpo">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">MPO</span>
                                <span id="weekly-kpi-subdept-trend-mpo"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-mpo">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-mpo">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-mpo"></div>
                        </div>
                        <div class="kpi-subdept-item" id="weekly-kpi-subdept-item-smo">
                            <div class="kpi-subdept-header">
                                <span class="kpi-subdept-name">SMO</span>
                                <span id="weekly-kpi-subdept-trend-smo"></span>
                            </div>
                            <div class="kpi-subdept-val" id="weekly-kpi-subdept-val-smo">0%</div>
                            <div class="kpi-subdept-meta" id="weekly-kpi-subdept-meta-smo">0 Sites</div>
                            <div class="kpi-subdept-status" id="weekly-kpi-subdept-status-smo"></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- SECTION 2: SCORE CARD SUMMARY (WEEKLY)                              -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div class="card" id="weekly-card-scorecard-summary" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
        <div class="card-header"
            style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <h2 class="card-title" style="margin: 0;">Score Card Summary (Weekly)</h2>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <!-- Dept Filter -->
                <div style="display: flex; align-items: center; gap: 0.45rem;"
                    id="weekly-scorecard-dept-filter-container">
                    <label for="weekly-scorecard-dept-filter" id="label-weekly-scorecard-dept-filter"
                        style="font-size: 12px; font-weight: 600; color: #475569;">DEPT</label>
                    <select id="weekly-scorecard-dept-filter" class="form-control unified-filter-select"
                        style="width: auto;" onchange="App.onWeeklyScorecardDeptFilterChange()">
                        <option value="all" selected>Semua DEPT</option>
                    </select>
                </div>
                <!-- Subdept Filter -->
                <div style="display: flex; align-items: center; gap: 0.45rem;"
                    id="weekly-scorecard-subdept-filter-container">
                    <label for="weekly-scorecard-subdept-filter" id="label-weekly-scorecard-subdept-filter"
                        style="font-size: 12px; font-weight: 600; color: #475569;">SUB DEPT</label>
                    <select id="weekly-scorecard-subdept-filter" class="form-control unified-filter-select"
                        style="width: auto;" onchange="App.onWeeklyScorecardSubDeptFilterChange()">
                        <option value="all" selected>Semua Sub Dept</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="scorecard-grid" style="padding-bottom: 0.5rem;">

            <!-- Sub-Card 1: Rating Summary -->
            <div class="scorecard-subcard" id="weekly-scorecard-rating-card">
                <div class="scorecard-subcard-header">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a;">Rating Summary
                            </h3>
                            <span id="weekly-scorecard-rating-period-badge" class="badge"
                                style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11px; padding: 2.5px 7px; border-radius: 6px;">
                                September - Week 1 2026
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <label for="weekly-scorecard-rating-filter"
                            style="font-size: 10.5px; font-weight: 600; color: #64748b; margin: 0;">Rating:</label>
                        <select id="weekly-scorecard-rating-filter"
                            class="form-control form-control-sm unified-filter-select"
                            style="font-size: 11.5px; padding: 2px 6px; width: auto; min-width: 115px; height: 26px;"
                            onchange="App.onWeeklyScorecardRatingFilterChange(this.value)">
                            <option value="all">Semua Rating</option>
                            <option value="very_poor" selected>Very Poor</option>
                            <option value="poor">Poor</option>
                            <option value="moderate">Moderate</option>
                            <option value="good">Good</option>
                            <option value="very_good">Very Good</option>
                        </select>
                    </div>
                </div>
                <div class="scorecard-subcard-body">
                    <!-- Chart Section -->
                    <div class="scorecard-top-chart-section scorecard-bottom-chart-section"
                        style="margin-top: 0; margin-bottom: 0.85rem;">
                        <div class="scorecard-bottom-chart-box">
                            <canvas id="chart-weekly-scorecard-rating-pie"></canvas>
                        </div>
                        <div class="scorecard-bottom-stats" id="weekly-scorecard-rating-pie-stats">
                            <div style="font-size: 10.5px; font-weight: 700; color: #475569; margin-bottom: 2px;">
                                Rating:</div>
                            <div class="scorecard-pie-stat-row" data-rating="very_good"
                                onclick="App.toggleWeeklyScorecardRatingFilter('very_good')">
                                <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                        style="background: #047857;"></span>Very Good</span>
                                <span class="scorecard-pie-stat-val" id="weekly-sc-stat-vg">0 sites (0%)</span>
                            </div>
                            <div class="scorecard-pie-stat-row" data-rating="good"
                                onclick="App.toggleWeeklyScorecardRatingFilter('good')">
                                <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                        style="background: #0284c7;"></span>Good</span>
                                <span class="scorecard-pie-stat-val" id="weekly-sc-stat-g">0 sites (0%)</span>
                            </div>
                            <div class="scorecard-pie-stat-row" data-rating="moderate"
                                onclick="App.toggleWeeklyScorecardRatingFilter('moderate')">
                                <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                        style="background: #d97706;"></span>Moderate</span>
                                <span class="scorecard-pie-stat-val" id="weekly-sc-stat-m">0 sites (0%)</span>
                            </div>
                            <div class="scorecard-pie-stat-row" data-rating="poor"
                                onclick="App.toggleWeeklyScorecardRatingFilter('poor')">
                                <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                        style="background: #ea580c;"></span>Poor</span>
                                <span class="scorecard-pie-stat-val" id="weekly-sc-stat-p">0 sites (0%)</span>
                            </div>
                            <div class="scorecard-pie-stat-row" data-rating="very_poor"
                                onclick="App.toggleWeeklyScorecardRatingFilter('very_poor')">
                                <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                        style="background: #b91c1c;"></span>Very Poor</span>
                                <span class="scorecard-pie-stat-val" id="weekly-sc-stat-vp">0 sites (0%)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Table -->
                    <div class="scorecard-table-wrapper">
                        <div class="table-responsive"
                            style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <table class="reconciliation-table scorecard-table">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        <th class="scorecard-col-subdept">DEPT</th>
                                        <th class="scorecard-col-sitecode">SITE CODE</th>
                                        <th class="scorecard-col-namesite">NAME SITE</th>
                                        <th class="scorecard-col-month">%</th>
                                        <th class="scorecard-col-status">RATING</th>
                                    </tr>
                                </thead>
                                <tbody id="weekly-scorecard-rating-tbody">
                                    <tr>
                                        <td colspan="5" class="text-center"
                                            style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                                            <div
                                                style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">
                                                Memuat data...</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sub-Card 2: SO Execution Summary -->
            <div class="scorecard-subcard" id="weekly-scorecard-exec-card">
                <div class="scorecard-subcard-header">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a;">SO Execution
                                Summary</h3>
                            <span id="weekly-scorecard-exec-period-badge" class="badge"
                                style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11px; padding: 2.5px 7px; border-radius: 6px;">
                                September - Week 1 2026
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <label for="weekly-scorecard-execution-filter"
                            style="font-size: 10.5px; font-weight: 600; color: #64748b; margin: 0;">Status:</label>
                        <select id="weekly-scorecard-execution-filter"
                            class="form-control form-control-sm unified-filter-select"
                            style="font-size: 11.5px; padding: 2px 6px; width: auto; min-width: 120px; height: 26px;"
                            onchange="App.onWeeklyScorecardExecutionFilterChange(this.value)">
                            <option value="all">Semua Status</option>
                            <option value="executed">Executed</option>
                            <option value="not_executed" selected>Not Executed</option>
                        </select>
                    </div>
                </div>
                <div class="scorecard-subcard-body">
                    <!-- Chart Section -->
                    <div class="scorecard-top-chart-section scorecard-bottom-chart-section"
                        style="margin-top: 0; margin-bottom: 0.85rem;">
                        <div class="scorecard-bottom-chart-box">
                            <canvas id="chart-weekly-scorecard-exec-pie"></canvas>
                        </div>
                        <div class="scorecard-bottom-stats" id="weekly-scorecard-exec-pie-stats">
                            <div style="font-size: 10.5px; font-weight: 700; color: #475569; margin-bottom: 2px;">Status
                                Eksekusi:</div>
                            <div class="scorecard-pie-stat-row" data-exec="executed"
                                onclick="App.toggleWeeklyScorecardExecutionFilter('executed')">
                                <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                        style="background: #047857;"></span>Executed</span>
                                <span class="scorecard-pie-stat-val" id="weekly-sc-stat-exec">0 sites (0%)</span>
                            </div>
                            <div class="scorecard-pie-stat-row" data-exec="not_executed"
                                onclick="App.toggleWeeklyScorecardExecutionFilter('not_executed')">
                                <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                        style="background: #b91c1c;"></span>Not Executed</span>
                                <span class="scorecard-pie-stat-val" id="weekly-sc-stat-not-exec">0 sites (0%)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Table -->
                    <div class="scorecard-table-wrapper">
                        <div class="table-responsive"
                            style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <table class="reconciliation-table scorecard-table">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        <th class="scorecard-col-subdept">DEPT</th>
                                        <th class="scorecard-col-sitecode">SITE CODE</th>
                                        <th class="scorecard-col-namesite">NAME SITE</th>
                                        <th class="scorecard-col-month"></th>
                                        <th class="scorecard-col-status">STATUS</th>
                                    </tr>
                                </thead>
                                <tbody id="weekly-scorecard-exec-tbody">
                                    <tr>
                                        <td colspan="5" class="text-center"
                                            style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                                            <div
                                                style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">
                                                Memuat data...</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- SECTION 3: REPORT SO (WEEKLY)                                       -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div class="card" id="weekly-card-hasil-so" style="margin-top: 1rem; margin-bottom: 2rem;">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                    <h2 class="card-title" id="weekly-hasil-so-title" style="margin: 0;">Report SO PMD (Weekly)</h2>
                    <span id="weekly-report-period-badge" class="badge"
                        style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11.5px; padding: 3px 9px; border-radius: 6px; letter-spacing: 0.2px;">
                        September - Week 1 2026
                    </span>
                </div>
                <p class="card-subtitle" id="weekly-hasil-so-subtitle" style="margin-top: 2px;">
                    Pencapaian dan Hasil Stock Opname Weekly
                </p>
            </div>

            <!-- Filters Toolbar -->
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <!-- Tampilkan Filter (Page Size) -->
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <label for="weekly-report-so-page-size"
                        style="font-size: 13px; font-weight: 600; color: #475569; margin: 0; white-space: nowrap;">Tampilkan</label>
                    <select id="weekly-report-so-page-size" class="form-control unified-filter-select"
                        onchange="App.changeWeeklyReportPageSize(this.value)" style="width: auto;">
                        <option value="10" selected>10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="all">Semua</option>
                    </select>
                </div>

                <!-- Dept Filter -->
                <div style="display: flex; align-items: center; gap: 0.45rem;" id="weekly-dept-filter-container">
                    <label for="weekly-report-so-dept-filter" id="label-weekly-dept-filter"
                        style="font-size: 12px; font-weight: 600; color: #475569;">DEPT</label>
                    <select id="weekly-report-so-dept-filter" class="form-control unified-filter-select"
                        style="width: auto;" onchange="App.onWeeklyDeptFilterChange()">
                        <option value="all" selected>Semua Dept</option>
                    </select>
                </div>

                <!-- Subdept Filter (Visible when Outlet Regional) -->
                <div style="display: none; align-items: center; gap: 0.45rem;" id="weekly-subdept-filter-container">
                    <label for="weekly-report-so-subdept-filter"
                        style="font-size: 12px; font-weight: 600; color: #475569;">SUB DEPT</label>
                    <select id="weekly-report-so-subdept-filter" class="form-control unified-filter-select"
                        style="width: auto;" onchange="App.applyWeeklyReportSoFilter()">
                        <option value="all" selected>Semua Sub Dept</option>
                    </select>
                </div>

                <!-- Status Filter -->
                <div style="display: flex; align-items: center; gap: 0.45rem;">
                    <label for="weekly-report-so-status-filter"
                        style="font-size: 12px; font-weight: 600; color: #475569;">STATUS</label>
                    <select id="weekly-report-so-status-filter" class="form-control unified-filter-select"
                        style="width: auto;" onchange="App.applyWeeklyReportSoFilter()">
                        <option value="all" selected>Semua Status</option>
                        <option value="tercapai">Tercapai</option>
                        <option value="tidak_tercapai">Tidak Tercapai</option>
                        <option value="no_data">Belum Ada Data</option>
                    </select>
                </div>

                <!-- Search Input: Rule placeholder="Search..." with .table-search-input.unified-search-input -->
                <div style="display: flex; align-items: center;">
                    <input type="search" id="weekly-report-so-search" class="table-search-input unified-search-input"
                        placeholder="Search..." autocomplete="off" oninput="App.applyWeeklyReportSoFilter()"
                        style="max-width: 200px;">
                </div>
            </div>
        </div>

        <div class="card-body" style="padding: 1rem 1.25rem;">
            <div class="so-subdept-layout">
                <!-- Left: Table Wrapper -->
                <div class="so-subdept-table-wrapper">
                    <div class="table-responsive"
                        style="max-height: 480px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <table class="table so-subdept-table" id="weekly-report-so-table"
                            style="margin-bottom: 0; width: 100%; border-collapse: separate; border-spacing: 0;">
                            <thead>
                                <tr
                                    style="background: #f8fafc; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                                    <th rowspan="2" class="sortable text-center"
                                        onclick="App.toggleWeeklyReportSort('sitecode')"
                                        style="vertical-align: middle; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        Site Code <span class="sort-indicator" data-weekly-col="sitecode">⇅</span>
                                    </th>
                                    <th rowspan="2" class="sortable text-left col-name-site"
                                        onclick="App.toggleWeeklyReportSort('name_site')"
                                        style="vertical-align: middle; text-align: left; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        NAME SITE <span class="sort-indicator" data-weekly-col="name_site">⇅</span>
                                    </th>
                                    <th rowspan="2" class="sortable text-center"
                                        onclick="App.toggleWeeklyReportSort('dept')"
                                        style="vertical-align: middle; text-align: center; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        Dept <span class="sort-indicator" data-weekly-col="dept">⇅</span>
                                    </th>
                                    <th class="text-center"
                                        style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        Result Match
                                    </th>
                                    <th class="text-center"
                                        style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        Result Physic
                                    </th>
                                    <th class="text-center"
                                        style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        Result DB
                                    </th>
                                    <th class="text-center"
                                        style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        Total Physical
                                    </th>
                                    <th class="text-center"
                                        style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        Pencapaian
                                    </th>
                                    <th rowspan="2" class="sortable text-center"
                                        onclick="App.toggleWeeklyReportSort('status')"
                                        style="vertical-align: middle; text-align: center; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; width: 150px; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        Status <span class="sort-indicator" data-weekly-col="status">⇅</span>
                                    </th>
                                </tr>
                                <tr
                                    style="background: #f8fafc; font-size: 10px; color: #64748b; border-bottom: 2px solid #cbd5e1;">
                                    <th class="text-center sortable" onclick="App.toggleWeeklyReportSort('match_qty')"
                                        style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                        Physical (QTY) <span class="sort-indicator" data-weekly-col="match_qty">⇅</span>
                                    </th>
                                    <th class="text-center sortable" onclick="App.toggleWeeklyReportSort('physic_qty')"
                                        style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                        Physical (QTY) <span class="sort-indicator"
                                            data-weekly-col="physic_qty">⇅</span>
                                    </th>
                                    <th class="text-center sortable" onclick="App.toggleWeeklyReportSort('db_qty')"
                                        style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                        Physical (QTY) <span class="sort-indicator" data-weekly-col="db_qty">⇅</span>
                                    </th>
                                    <th class="text-center sortable" onclick="App.toggleWeeklyReportSort('target_qty')"
                                        style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                        Target (QTY) <span class="sort-indicator" data-weekly-col="target_qty">⇅</span>
                                    </th>
                                    <th class="text-center sortable" onclick="App.toggleWeeklyReportSort('pct')"
                                        style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                        % <span class="sort-indicator" data-weekly-col="pct">⇅</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="weekly-report-so-tbody">
                                <tr>
                                    <td colspan="9" style="text-align: center; padding: 2rem; color: #64748b;">
                                        Memuat data Report SO Weekly...
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot id="weekly-report-so-tfoot"
                                style="position: sticky; bottom: 0; z-index: 5; background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1; box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);">
                            </tfoot>
                        </table>
                    </div>
                    <!-- Table Pagination Footer -->
                    <div class="table-pagination-footer"
                        style="margin-top: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <div id="weekly-report-so-table-info">Menampilkan 0 sampai 0 dari 0 data</div>
                        <div class="pagination-controls" id="weekly-report-so-pagination-controls"></div>
                    </div>
                </div>

                <!-- Right: Pie / Donut Chart for Tercapai vs Tidak Tercapai (Weekly) -->
                <div class="so-subdept-chart-wrapper">
                    <div class="so-pie-card">
                        <div class="so-pie-header">
                            <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;"
                                id="weekly-pie-title">
                                Status Pencapaian (Weekly)</h3>
                        </div>
                        <div class="so-pie-canvas-box">
                            <canvas id="chart-weekly-report-pie"></canvas>
                        </div>
                        <div class="so-pie-stats" id="weekly-report-pie-stats">
                            <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 0.5rem;">
                                Memuat grafik...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

</section>