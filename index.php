<?php
/**
 * Asset Management Dashboard
 * Clean Corporate White Layout
 */

require_once __DIR__ . '/config/database.php';

session_start();
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

// Fetch existing periods for the filter dropdown
$periods = [];
try {
    $db = getDbConnection();
    $stmt = $db->query('SELECT id, label, month, year FROM asset_periods ORDER BY year DESC, month DESC');
    $periods = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    // Graceful fallback
}

$currentMonth = (int) date('n');
$currentYear = (int) date('Y');
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
    <title>Asset Management</title>

    <!-- Google Fonts: Poppins -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap"
        rel="stylesheet">

    <!-- Clean Corporate App CSS -->
    <link rel="stylesheet" href="assets/css/style.css?v=<?= filemtime(__DIR__ . '/assets/css/style.css') ?>">
</head>

<body>

    <!-- Toast Notification Container -->
    <div id="toast-container" class="toast-container"></div>

    <!-- Top Navigation Bar (Clean Corporate Header) -->
    <header class="navbar">
        <a href="#" class="navbar-brand">
            Asset Management
        </a>

        <!-- Only Two Menus: Master Data & Summary -->
        <nav class="navbar-menu">
            <button class="nav-link active" data-page="master-data" id="tab-master-data"
                onclick="App.navigateTo('master-data')">
                Master Data
            </button>
            <button class="nav-link" data-page="summary" id="tab-summary" onclick="App.navigateTo('summary')">
                Summary
            </button>
        </nav>
    </header>

    <!-- Main Application Content -->
    <main class="main-wrapper">

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!-- PAGE 1: Stock Opname Master Data (21-Column with Pagination) -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        <section id="page-master-data" class="page-section active">
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">Stock Opname Master Data</h2>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="App.loadMasterData()">
                            Sync
                        </button>
                        <button class="btn btn-danger" onclick="App.openBulkDeleteModal()"
                            title="Delete data by month and year">
                            Delete Data
                        </button>
                        <button class="btn btn-primary" onclick="App.openImportModal()">
                            Import SO Data
                        </button>
                    </div>
                </div>

                <!-- Table Toolbar: Page Size & Search & Period Filters -->
                <div class="table-toolbar">
                    <div class="table-toolbar-left">
                        <label for="master-page-size">Show</label>
                        <select id="master-page-size" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                            onchange="App.changePageSize(this.value)">
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="all">All</option>
                        </select>
                        <span>entries per page</span>

                        <span style="margin-left: 1rem; border-left: 1px solid #e2e8f0; padding-left: 1rem;"></span>

                        <label for="filter-month">Month</label>
                        <select id="filter-month" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                            onchange="App.applyFilterAndRender()">
                            <option value="">All Months</option>
                            <?php
                            $monthNames = [
                                1 => 'January',
                                2 => 'February',
                                3 => 'March',
                                4 => 'April',
                                5 => 'May',
                                6 => 'June',
                                7 => 'July',
                                8 => 'August',
                                9 => 'September',
                                10 => 'October',
                                11 => 'November',
                                12 => 'December'
                            ];
                            foreach ($monthNames as $num => $name): ?>
                                <option value="<?= $num ?>"><?= $name ?></option>
                            <?php endforeach; ?>
                        </select>

                        <label for="filter-year">Year</label>
                        <select id="filter-year" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                            onchange="App.applyFilterAndRender()">
                            <option value="">All Years</option>
                            <?php for ($y = $currentYear; $y <= $currentYear + 5; $y++): ?>
                                <option value="<?= $y ?>"><?= $y ?></option>
                            <?php endfor; ?>
                        </select>
                    </div>
                    <div class="table-toolbar-right">
                        <input type="text" id="master-search-input" class="table-search-input" placeholder="Search..."
                            oninput="App.handleSearch(this.value)">
                    </div>
                </div>

                <!-- 21-Column Stock Opname Table + Action Column -->
                <div class="card-body" style="padding: 0;">
                    <div class="table-responsive">
                        <table class="reconciliation-table" id="master-opname-table">
                            <thead>
                                <!-- Level 1 Header -->
                                <tr>
                                    <th rowspan="3" class="text-center align-middle col-action">Action</th>
                                    <th rowspan="3" class="text-center align-middle sortable" style="min-width: 280px;"
                                        onclick="App.toggleSort('profile')">
                                        Profile <span class="sort-indicator" data-col="profile">⇅</span>
                                    </th>
                                    <th colspan="2" class="text-center">Periode</th>
                                    <th colspan="4" class="text-center">RESULT MATCH</th>
                                    <th colspan="4" class="text-center">RESULT PHYSIC</th>
                                    <th colspan="4" class="text-center">RESULT DB</th>
                                    <th colspan="6" class="text-center">TOTAL</th>
                                </tr>

                                <!-- Level 2 Sub-Header -->
                                <tr>
                                    <th rowspan="2" class="text-center align-middle sortable"
                                        onclick="App.toggleSort('period_start')">
                                        Start <span class="sort-indicator" data-col="period_start">⇅</span>
                                    </th>
                                    <th rowspan="2" class="text-center align-middle sortable"
                                        onclick="App.toggleSort('period_end')">
                                        End <span class="sort-indicator" data-col="period_end">⇅</span>
                                    </th>

                                    <!-- RESULT MATCH -->
                                    <th colspan="2" class="text-center">PHYSICAL</th>
                                    <th colspan="2" class="text-center">NBV</th>

                                    <!-- RESULT PHYSIC -->
                                    <th colspan="2" class="text-center">PHYSICAL</th>
                                    <th colspan="2" class="text-center">NBV</th>

                                    <!-- RESULT DB -->
                                    <th colspan="2" class="text-center">PHYSICAL</th>
                                    <th colspan="2" class="text-center">NBV</th>

                                    <!-- TOTAL -->
                                    <th colspan="3" class="text-center">PHYSICAL</th>
                                    <th colspan="3" class="text-center">NBV</th>
                                </tr>

                                <!-- Level 3 Leaf Columns (Sortable Asc/Desc on Click) -->
                                <tr>
                                    <!-- Under RESULT MATCH -->
                                    <th class="sortable text-center" onclick="App.toggleSort('match_physic_qty')">QTY
                                        <span class="sort-indicator" data-col="match_physic_qty">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('match_physic_pct')">%
                                        <span class="sort-indicator" data-col="match_physic_pct">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('match_nbv_value')">Value
                                        <span class="sort-indicator" data-col="match_nbv_value">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('match_nbv_pct')">% <span
                                            class="sort-indicator" data-col="match_nbv_pct">⇅</span></th>

                                    <!-- Under RESULT PHYSIC -->
                                    <th class="sortable text-center" onclick="App.toggleSort('physic_physic_qty')">QTY
                                        <span class="sort-indicator" data-col="physic_physic_qty">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('physic_physic_pct')">%
                                        <span class="sort-indicator" data-col="physic_physic_pct">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('physic_nbv_value')">Value
                                        <span class="sort-indicator" data-col="physic_nbv_value">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('physic_nbv_pct')">% <span
                                            class="sort-indicator" data-col="physic_nbv_pct">⇅</span></th>

                                    <!-- Under RESULT DB -->
                                    <th class="sortable text-center" onclick="App.toggleSort('db_physic_qty')">QTY <span
                                            class="sort-indicator" data-col="db_physic_qty">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('db_physic_pct')">% <span
                                            class="sort-indicator" data-col="db_physic_pct">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('db_nbv_value')">Value
                                        <span class="sort-indicator" data-col="db_nbv_value">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('db_nbv_pct')">% <span
                                            class="sort-indicator" data-col="db_nbv_pct">⇅</span></th>

                                    <!-- Under TOTAL -->
                                    <th class="sortable text-center" onclick="App.toggleSort('total_physic_actual')">
                                        ACTUAL <span class="sort-indicator" data-col="total_physic_actual">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_physic_target')">
                                        TARGET <span class="sort-indicator" data-col="total_physic_target">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_physic_pct')">%
                                        <span class="sort-indicator" data-col="total_physic_pct">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_nbv_actual')">ACTUAL
                                        <span class="sort-indicator" data-col="total_nbv_actual">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_nbv_target')">TARGET
                                        <span class="sort-indicator" data-col="total_nbv_target">⇅</span>
                                    </th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_nbv_pct')">% <span
                                            class="sort-indicator" data-col="total_nbv_pct">⇅</span></th>
                                </tr>
                            </thead>
                            <tbody id="master-table-body">
                                <tr>
                                    <td colspan="22" class="text-center" style="padding: 2rem; color: #64748b;">
                                        Loading data...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Table Pagination Footer -->
                <div class="table-pagination-footer">
                    <div id="master-pagination-info">Showing 0 to 0 of 0 entries</div>
                    <div class="pagination-controls" id="master-pagination-controls"></div>
                </div>
            </div>

            <!-- ═══════════════════════════════════════════════════════════ -->
            <!-- CARD 2: Site Regional                                       -->
            <!-- ═══════════════════════════════════════════════════════════ -->
            <div class="card" id="card-site-regional" style="margin-top: 2rem;">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">Site Regional</h2>
                        <p class="card-subtitle">Regional Site master data</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="App.loadSiteRegional()">
                            Sync
                        </button>
                        <button class="btn btn-danger" id="sr-bulk-delete-btn" style="display: none;"
                            onclick="App.bulkDeleteSiteRegional()" title="Delete selected records">
                            Delete Selected (<span id="sr-selected-count">0</span>)
                        </button>
                        <button class="btn btn-primary" onclick="App.openSiteRegionalImportModal()">
                            Import Data
                        </button>
                    </div>
                </div>

                <!-- ── Top-Level Tabs: Monthly / Quarterly ── -->
                <div class="sr-tabs-container">
                    <div class="sr-tabs-level1">
                        <button class="sr-tab-l1 active" data-sr-l1="monthly" onclick="App.switchSRLevel1('monthly')">
                            Monthly
                        </button>
                        <button class="sr-tab-l1" data-sr-l1="quarterly" onclick="App.switchSRLevel1('quarterly')">
                            Quarterly
                        </button>
                    </div>

                    <!-- ── Sub-Level Tabs: Outlet Regional / PMD (Monthly only) ── -->
                    <div class="sr-tabs-level2" id="sr-tabs-level2">
                        <button class="sr-tab-l2 active" data-sr-l2="outlet" onclick="App.switchSRLevel2('outlet')">
                            Outlet Regional
                        </button>
                        <button class="sr-tab-l2" data-sr-l2="pmd" onclick="App.switchSRLevel2('pmd')">
                            PMD
                        </button>
                    </div>
                </div>

                <!-- Table Toolbar: Page Size & Search -->
                <div class="table-toolbar">
                    <div class="table-toolbar-left">
                        <label for="sr-page-size">Show</label>
                        <select id="sr-page-size" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                            onchange="App.changeSRPageSize(this.value)">
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="all">All</option>
                        </select>
                        <span>entries per page</span>
                    </div>
                    <div class="table-toolbar-right">
                        <input type="text" id="sr-search-input" class="table-search-input" placeholder="Search..."
                            oninput="App.handleSRSearch(this.value)">
                    </div>
                </div>

                <!-- Site Regional Table -->
                <div class="card-body" style="padding: 0;">
                    <div class="table-responsive">
                        <table class="reconciliation-table" id="sr-table">
                            <thead>
                                <tr>
                                    <th colspan="2" class="text-center align-middle col-action-group">ACTION</th>
                                    <th rowspan="2" class="text-center align-middle sortable"
                                        onclick="App.toggleSRSort('regional')">
                                        REGIONAL <span class="sort-indicator" data-sr-col="regional">⇅</span>
                                    </th>
                                    <th rowspan="2" class="text-center align-middle sortable"
                                        onclick="App.toggleSRSort('dept')">
                                        DEPT <span class="sort-indicator" data-sr-col="dept">⇅</span>
                                    </th>
                                    <th rowspan="2" class="text-center align-middle sortable"
                                        onclick="App.toggleSRSort('sub_dept')">
                                        SUB DEPT <span class="sort-indicator" data-sr-col="sub_dept">⇅</span>
                                    </th>
                                    <th rowspan="2" class="text-center align-middle sortable"
                                        onclick="App.toggleSRSort('sitecode')">
                                        SITECODE <span class="sort-indicator" data-sr-col="sitecode">⇅</span>
                                    </th>
                                    <th rowspan="2" class="text-center align-middle sortable"
                                        onclick="App.toggleSRSort('name_site')">
                                        NAME SITE <span class="sort-indicator" data-sr-col="name_site">⇅</span>
                                    </th>
                                </tr>
                                <tr>
                                    <!-- Under ACTION -->
                                    <th class="text-center align-middle col-action-select" style="padding: 4px;">
                                        <input type="checkbox" id="sr-select-all" title="Select all on current page"
                                            onchange="App.toggleSelectAllSR(this.checked)"
                                            style="cursor: pointer; width: 15px; height: 15px;">
                                    </th>
                                    <th class="text-center align-middle col-action-delete"
                                        style="padding: 4px 6px; font-size: 10px; font-weight: 600;">
                                        DEL
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="sr-table-body">
                                <tr>
                                    <td colspan="7" class="text-center" style="padding: 2.5rem; color: #64748b;">
                                        Loading data...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Table Pagination Footer -->
                <div class="table-pagination-footer">
                    <div id="sr-pagination-info">Showing 0 to 0 of 0 entries</div>
                    <div class="pagination-controls" id="sr-pagination-controls"></div>
                </div>
            </div>
        </section>

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!-- PAGE 2: Stock Opname Summary (KPI Overview & Roll-Up)        -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        <section id="page-summary" class="page-section">
            <!-- ── Top Tab Slider: SO Type (Monthly / Quarterly) ────── -->
            <div class="summary-type-slider-card">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 13px; font-weight: 700; color: #0f172a; letter-spacing: 0.02em;">SO
                        TYPE</span>
                    <div class="summary-type-slider-wrapper">
                        <button type="button" class="summary-type-slider-btn active" id="btn-so-type-monthly"
                            onclick="App.switchSOType('monthly')">
                            <span>Monthly</span>
                        </button>
                        <button type="button" class="summary-type-slider-btn" id="btn-so-type-quarterly"
                            onclick="App.switchSOType('quarterly')">
                            <span>Quarterly</span>
                        </button>
                    </div>
                </div>
                <div style="font-size: 12px; color: #64748b;" id="summary-so-type-status">
                    <strong style="color: #2563eb;">Monthly</strong> Stock Opname Summary
                </div>
            </div>

            <!-- ── Summary Toolbar: Pilih Periode Data ────────────── -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 class="card-title">PILIH PERIODE DATA</h2>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label for="summary-filter-month"
                                style="font-size: 13px; font-weight: 600; color: #334155;">BULAN</label>
                            <select id="summary-filter-month" class="form-control"
                                style="width: auto; padding: 0.35rem 0.75rem;" onchange="App.loadSummaryData()">
                                <option value="">Semua Bulan</option>
                                <option value="1">January</option>
                                <option value="2">February</option>
                                <option value="3">March</option>
                                <option value="4">April</option>
                                <option value="5">May</option>
                                <option value="6">June</option>
                                <option value="7">July</option>
                                <option value="8">August</option>
                                <option value="9" selected>September</option>
                                <option value="10">October</option>
                                <option value="11">November</option>
                                <option value="12">December</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label for="summary-filter-year"
                                style="font-size: 13px; font-weight: 600; color: #334155;">TAHUN</label>
                            <select id="summary-filter-year" class="form-control"
                                style="width: auto; padding: 0.35rem 0.75rem;" onchange="App.loadSummaryData()">
                                <option value="2026" selected>2026</option>
                                <option value="2027">2027</option>
                                <option value="2028">2028</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Achievement Cards (National, CRO, ERO, WRO, PMD) ── -->
            <div class="kpi-grid" id="achievement-cards"
                style="margin-bottom: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));">
                <div class="kpi-card kpi-card-split">
                    <div class="kpi-title">National Regional Outlet Achievement</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="kpi-national-achievement">0.00%</div>
                        <div class="kpi-split-trend" id="kpi-national-trend"></div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="kpi-national-subtext">Outlet Regional &amp; PMD (0 Sites)</div>
                        <div class="kpi-status-box" id="kpi-national-status"></div>
                    </div>
                </div>
                <div class="kpi-card kpi-card-split">
                    <div class="kpi-title">CRO Achievement</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="kpi-cro-achievement">0.00%</div>
                        <div class="kpi-split-trend" id="kpi-cro-trend"></div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="kpi-cro-subtext">Avg DEPT CRO (0 Sites)</div>
                        <div class="kpi-status-box" id="kpi-cro-status"></div>
                    </div>
                </div>
                <div class="kpi-card kpi-card-split">
                    <div class="kpi-title">ERO Achievement</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="kpi-ero-achievement">0.00%</div>
                        <div class="kpi-split-trend" id="kpi-ero-trend"></div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="kpi-ero-subtext">Avg DEPT ERO (0 Sites)</div>
                        <div class="kpi-status-box" id="kpi-ero-status"></div>
                    </div>
                </div>
                <div class="kpi-card kpi-card-split">
                    <div class="kpi-title">WRO Achievement</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="kpi-wro-achievement">0.00%</div>
                        <div class="kpi-split-trend" id="kpi-wro-trend"></div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="kpi-wro-subtext">Avg DEPT WRO (0 Sites)</div>
                        <div class="kpi-status-box" id="kpi-wro-status"></div>
                    </div>
                </div>
                <div class="kpi-card kpi-card-split">
                    <div class="kpi-title">PMD Achievement</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="kpi-pmd-achievement">0.00%</div>
                        <div class="kpi-split-trend" id="kpi-pmd-trend"></div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="kpi-pmd-subtext">Avg DEPT PMD (0 Sites)</div>
                        <div class="kpi-status-box" id="kpi-pmd-status"></div>
                    </div>
                </div>
            </div>

            <!-- ── Trend Line Graphics (DEPT on top; Sub DEPT & PMD Sub DEPT below) ── -->
            <div class="trend-charts-container" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <!-- Card 1: Trend Line DEPT (Full Width on top) -->
                <div class="card" style="margin-bottom: 1.25rem;">
                    <div class="card-header"
                        style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 class="card-title"
                                style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                Trend Achievement SO Dept</h3>
                            <p class="card-subtitle trend-chart-subtitle"
                                style="font-size: 0.78rem; color: #64748b; margin-bottom: 0;">
                                Monthly Physical % (Jan - Dec 2026)</p>
                        </div>
                        <span class="badge"
                            style="background: #eff6ff; color: #2563eb; font-weight: 600; font-size: 11px; padding: 3px 8px; border-radius: 6px;">DEPT</span>
                    </div>
                    <div class="card-body" style="padding: 1rem; position: relative;">
                        <div style="position: relative; height: 260px; width: 100%;">
                            <canvas id="chart-trend-dept"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Row below: Card 2 (Sub DEPT) & Card 3 (PMD Sub DEPT) -->
                <div class="trend-charts-row-2">
                    <!-- Card 2: Trend Line Sub DEPT -->
                    <div class="card" style="margin-bottom: 0;">
                        <div class="card-header"
                            style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 class="card-title"
                                    style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                    Trend Achievement SO Outlet Regional Sub Dept</h3>
                                <p class="card-subtitle trend-chart-subtitle"
                                    style="font-size: 0.78rem; color: #64748b; margin-bottom: 0;">
                                    Monthly Physical % (Jan - Dec 2026)</p>
                            </div>
                            <span class="badge"
                                style="background: #f0fdf4; color: #16a34a; font-weight: 600; font-size: 11px; padding: 3px 8px; border-radius: 6px;">Outlet
                                Regional</span>
                        </div>
                        <div class="card-body" style="padding: 1rem; position: relative;">
                            <div style="position: relative; height: 260px; width: 100%;">
                                <canvas id="chart-trend-subdept"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Card 3: Trend Line PMD Sub DEPT -->
                    <div class="card" style="margin-bottom: 0;">
                        <div class="card-header"
                            style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 class="card-title"
                                    style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                    Trend Achievement SO PMD Sub Dept</h3>
                                <p class="card-subtitle trend-chart-subtitle"
                                    style="font-size: 0.78rem; color: #64748b; margin-bottom: 0;">
                                    Monthly Physical % (Jan - Dec 2026)</p>
                            </div>
                            <span class="badge"
                                style="background: #faf5ff; color: #9333ea; font-weight: 600; font-size: 11px; padding: 3px 8px; border-radius: 6px;">PMD</span>
                        </div>
                        <div class="card-body" style="padding: 1rem; position: relative;">
                            <div style="position: relative; height: 260px; width: 100%;">
                                <canvas id="chart-trend-pmd"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Card: Chart Hasil SO Outlet Regional ─────────── -->
            <div class="card" id="card-hasil-so-subdept" style="margin-top: 1rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <h2 class="card-title">Chart Hasil SO Outlet Regional</h2>
                        <p class="card-subtitle">Pencapaian dan Hasil Stock Opname Outlet Regional</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label for="dept-result-filter"
                                style="font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap;">
                                DEPT
                            </label>
                            <select id="dept-result-filter" class="form-control"
                                style="width: auto; padding: 0.35rem 0.75rem; font-weight: 600;"
                                onchange="App.onDeptResultFilterChange()">
                                <option value="all">Semua DEPT</option>
                                <option value="CRO" selected>CRO</option>
                                <option value="ERO">ERO</option>
                                <option value="WRO">WRO</option>
                                <option value="PMD">PMD</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label for="subdept-result-filter"
                                style="font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap;">
                                SUB DEPT
                            </label>
                            <select id="subdept-result-filter" class="form-control"
                                style="width: auto; padding: 0.35rem 0.75rem; font-weight: 600;"
                                onchange="App.loadSubDeptResults()">
                                <option value="all">Semua Sub Dept (CRO)</option>
                                <option value="CJDO" selected>CJDO</option>
                                <option value="EKO">EKO</option>
                                <option value="WJO">WJO</option>
                                <option value="WKO">WKO</option>
                            </select>
                        </div>
                        <button class="btn btn-secondary" onclick="App.loadSubDeptResults()" title="Refresh data">
                            Sync
                        </button>
                    </div>
                </div>

                <div class="card-body" style="padding: 1rem 1.25rem;">
                    <div class="so-subdept-layout">
                        <!-- Left: Compact Shrunk Table -->
                        <div class="so-subdept-table-wrapper">
                            <div class="table-responsive"
                                style="max-height: 480px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <table class="table so-subdept-table"
                                    style="margin-bottom: 0; width: 100%; border-collapse: separate; border-spacing: 0;">
                                    <thead>
                                        <tr
                                            style="background: #f8fafc; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                                            <th rowspan="2"
                                                style="vertical-align: middle; text-align: center; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Site Code</th>
                                            <th rowspan="2"
                                                style="vertical-align: middle; text-align: center; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Name Site</th>
                                            <th
                                                style="text-align: right; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Result Match</th>
                                            <th
                                                style="text-align: right; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Result Physic</th>
                                            <th
                                                style="text-align: right; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Result DB</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Pencapaian</th>
                                            <th rowspan="2"
                                                style="vertical-align: middle; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; width: 190px; min-width: 170px; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Status</th>
                                        </tr>
                                        <tr
                                            style="background: #f8fafc; font-size: 10px; color: #64748b; border-bottom: 2px solid #cbd5e1;">
                                            <th
                                                style="text-align: right; padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Physical (QTY)</th>
                                            <th
                                                style="text-align: right; padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Physical (QTY)</th>
                                            <th
                                                style="text-align: right; padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Physical (QTY)</th>
                                            <th
                                                style="text-align: center; padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                %</th>
                                        </tr>
                                    </thead>
                                    <tbody id="subdept-results-tbody">
                                        <tr>
                                            <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
                                                Loading Hasil SO Outlet Regional...
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot id="subdept-results-tfoot"
                                        style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1;">
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <!-- Right: Pie / Donut Chart for Tercapai vs Belum Tercapai -->
                        <div class="so-subdept-chart-wrapper">
                            <div class="so-pie-card">
                                <div class="so-pie-header">
                                    <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                        Status Pencapaian</h3>
                                    <p style="font-size: 11px; color: #64748b; margin: 0;" id="subdept-pie-subtitle">
                                        Tercapai vs Belum Tercapai</p>
                                </div>
                                <div class="so-pie-canvas-box">
                                    <canvas id="chart-subdept-pie"></canvas>
                                </div>
                                <div class="so-pie-stats" id="subdept-pie-stats">
                                    <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 0.5rem;">
                                        Memuat grafik...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Card: Rekapitulasi 2026 ────────────────────────── -->
            <div class="card" id="card-rekapitulasi" style="margin-top: 1rem;">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">Rekapitulasi 2026</h2>
                        <p class="card-subtitle">Monthly Stock Opname </p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="App.loadRekapitulasi()">
                            Sync
                        </button>
                    </div>
                </div>

                <!-- ── Sub-Level Tabs: Outlet Regional / PMD ── -->
                <div class="sr-tabs-container">
                    <div class="sr-tabs-level2" id="rekap-tabs-level2"
                        style="border-bottom: 2px solid #e2e8f0; margin-top: 0;">
                        <button class="rekap-tab-l2 active" data-rekap-l2="outlet"
                            onclick="App.switchRekapLevel2('outlet')">
                            Outlet Regional
                        </button>
                        <button class="rekap-tab-l2" data-rekap-l2="pmd" onclick="App.switchRekapLevel2('pmd')">
                            PMD
                        </button>
                    </div>
                </div>

                <!-- Table Toolbar: Page Size & Search -->
                <div class="table-toolbar">
                    <div class="table-toolbar-left">
                        <label for="rekap-page-size">Show</label>
                        <select id="rekap-page-size" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                            onchange="App.changeRekapPageSize(this.value)">
                            <option value="10">10</option>
                            <option value="25" selected>25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="all">All</option>
                        </select>
                        <span>entries per page</span>
                    </div>
                    <div class="table-toolbar-right">
                        <input type="text" id="rekap-search-input" class="table-search-input" placeholder="Search..."
                            oninput="App.handleRekapSearch(this.value)">
                    </div>
                </div>

                <!-- Rekapitulasi Table -->
                <div class="card-body" style="padding: 0;">
                    <div class="table-responsive">
                        <table class="reconciliation-table" id="rekap-table">
                            <thead>
                                <tr>
                                    <th class="text-center align-middle sortable"
                                        onclick="App.toggleRekapSort('regional')">
                                        REGIONAL <span class="sort-indicator" data-rekap-col="regional">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('dept')">
                                        DEPT <span class="sort-indicator" data-rekap-col="dept">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable"
                                        onclick="App.toggleRekapSort('sub_dept')">
                                        SUB DEPT <span class="sort-indicator" data-rekap-col="sub_dept">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable"
                                        onclick="App.toggleRekapSort('sitecode')">
                                        SITECODE <span class="sort-indicator" data-rekap-col="sitecode">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable"
                                        onclick="App.toggleRekapSort('name_site')">
                                        NAME SITE <span class="sort-indicator" data-rekap-col="name_site">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m1')">
                                        JANUARY <span class="sort-indicator" data-rekap-col="m1">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m2')">
                                        FEBRUARY <span class="sort-indicator" data-rekap-col="m2">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m3')">
                                        MARCH <span class="sort-indicator" data-rekap-col="m3">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m4')">
                                        APRIL <span class="sort-indicator" data-rekap-col="m4">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m5')">
                                        MAY <span class="sort-indicator" data-rekap-col="m5">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m6')">
                                        JUNE <span class="sort-indicator" data-rekap-col="m6">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m7')">
                                        JULY <span class="sort-indicator" data-rekap-col="m7">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m8')">
                                        AUGUST <span class="sort-indicator" data-rekap-col="m8">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m9')">
                                        SEPTEMBER <span class="sort-indicator" data-rekap-col="m9">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m10')">
                                        OCTOBER <span class="sort-indicator" data-rekap-col="m10">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m11')">
                                        NOVEMBER <span class="sort-indicator" data-rekap-col="m11">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable" onclick="App.toggleRekapSort('m12')">
                                        DECEMBER <span class="sort-indicator" data-rekap-col="m12">⇅</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="rekap-table-body">
                                <tr>
                                    <td colspan="17" class="text-center" style="padding: 2.5rem; color: #64748b;">
                                        Loading Rekapitulasi 2026 data...
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot id="rekap-table-foot"
                                style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1;">
                            </tfoot>
                        </table>
                    </div>
                </div>

                <!-- Table Pagination Footer -->
                <div class="table-pagination-footer">
                    <div id="rekap-pagination-info">Showing 0 to 0 of 0 entries</div>
                    <div class="pagination-controls" id="rekap-pagination-controls"></div>
                </div>
            </div>
        </section>

    </main>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Import Excel with Drag & Drop + Month/Year Selection  -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="import-modal" class="modal-backdrop">
        <div class="modal-dialog">
            <div class="modal-header">
                <h3 class="modal-title">Import SO Data</h3>
                <button class="modal-close-btn" onclick="App.closeImportModal()">&times;</button>
            </div>
            <div class="modal-body">
                <!-- Period Selection: Month & Year -->
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="import-month">Period Month</label>
                        <select id="import-month" class="form-control">
                            <?php
                            $monthList = [
                                1 => 'January',
                                2 => 'February',
                                3 => 'March',
                                4 => 'April',
                                5 => 'May',
                                6 => 'June',
                                7 => 'July',
                                8 => 'August',
                                9 => 'September',
                                10 => 'October',
                                11 => 'November',
                                12 => 'December'
                            ];
                            foreach ($monthList as $num => $name): ?>
                                <option value="<?= $num ?>" <?= ($num === $currentMonth) ? 'selected' : '' ?>>
                                    <?= $name ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="import-year">Period Year</label>
                        <select id="import-year" class="form-control">
                            <?php for ($y = 2024; $y <= 2030; $y++): ?>
                                <option value="<?= $y ?>" <?= ($y === $currentYear) ? 'selected' : '' ?>>
                                    <?= $y ?>
                                </option>
                            <?php endfor; ?>
                        </select>
                    </div>
                </div>

                <!-- Drag and Drop Upload Area -->
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Upload File (.xlsx, .xls)</label>
                    <div id="drag-drop-zone" class="drag-drop-zone"
                        onclick="document.getElementById('import-file-input').click()">
                        <div class="drag-drop-text">Drag &amp; drop Excel file here</div>
                        <div class="drag-drop-subtext">or click to browse from local computer</div>
                    </div>
                    <input type="file" id="import-file-input" accept=".xlsx,.xls" style="display: none;"
                        onchange="App.handleFileSelect(this.files)">

                    <!-- Selected File Display -->
                    <div id="selected-file-display" style="display: none;">
                        <div class="selected-file-badge">
                            <div class="selected-file-info">
                                <span id="selected-file-name">file.xlsx</span>
                                <span id="selected-file-size" style="color: #64748b; font-size: 11px;">(0 KB)</span>
                            </div>
                            <button type="button" class="selected-file-remove"
                                onclick="App.clearSelectedFile()">&times;</button>
                        </div>
                    </div>
                </div>

                <!-- Sheet Selection Group -->
                <div class="form-group" id="import-sheet-group" style="display: none; margin-top: 1rem;">
                    <label class="form-label" for="import-sheet-select">Select Sheet</label>
                    <select id="import-sheet-select" class="form-control" style="cursor: pointer;">
                        <option value="">Reading sheets...</option>
                    </select>
                    <div id="import-sheet-hint" style="font-size: 11px; color: #64748b; margin-top: 4px;"></div>
                </div>

                <!-- Overwrite Option -->
                <div class="form-group" style="margin-top: 1rem; margin-bottom: 0.5rem;">
                    <label
                        style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 13px; color: #475569;">
                        <input type="checkbox" id="import-replace-existing" checked
                            style="width: 16px; height: 16px; cursor: pointer;">
                        <span><strong>Replace data existing</strong> (Hapus data sebelumnya)</span>
                    </label>
                </div>

                <!-- Status message in modal -->
                <div id="modal-import-status"
                    style="display: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin-top: 12px;">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeImportModal()">Cancel</button>
                <button class="btn btn-primary" id="modal-upload-btn" onclick="App.submitImport()">Upload &amp;
                    Import</button>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Bulk Delete Data by Period & Year                     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="bulk-delete-modal" class="modal-backdrop">
        <div class="modal-dialog" style="max-width: 480px;">
            <div class="modal-header">
                <h3 class="modal-title" style="color: #dc2626;">Delete Data by Period</h3>
                <button class="modal-close-btn" onclick="App.closeBulkDeleteModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 1.25rem;">
                    Pilih Periode Data yang akan dihapus permanen.
                </p>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="bulk-delete-month">Periode Month</label>
                        <select id="bulk-delete-month" class="form-control">
                            <option value="">All Months in Selected Year</option>
                            <?php foreach ($monthList as $num => $name): ?>
                                <option value="<?= $num ?>" <?= ($num === $currentMonth) ? 'selected' : '' ?>>
                                    <?= $name ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="bulk-delete-year">Period Year</label>
                        <select id="bulk-delete-year" class="form-control">
                            <?php for ($y = 2024; $y <= 2030; $y++): ?>
                                <option value="<?= $y ?>" <?= ($y === $currentYear) ? 'selected' : '' ?>>
                                    <?= $y ?>
                                </option>
                            <?php endfor; ?>
                        </select>
                    </div>
                </div>

                <div
                    style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 0.75rem 1rem; margin-top: 1rem; color: #991b1b; font-size: 12px; line-height: 1.4;">
                    <strong>Warning:</strong> Data akan dihapus permanent!
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeBulkDeleteModal()">Cancel</button>
                <button class="btn btn-danger" id="bulk-delete-submit-btn" onclick="App.submitBulkDelete()">
                    Delete Period Data
                </button>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Import Site Regional Data                              -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="sr-import-modal" class="modal-backdrop">
        <div class="modal-dialog" style="max-width: 540px;">
            <div class="modal-header">
                <h3 class="modal-title">Import Site Regional Data</h3>
                <button class="modal-close-btn" onclick="App.closeSiteRegionalImportModal()">&times;</button>
            </div>

            <div class="modal-body" style="padding: 1.25rem;">

                <!-- Active Tab Category Indicator -->
                <div
                    style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.6rem 1rem; margin-bottom: 1rem; font-size: 13px; color: #1d4ed8;">
                    Import data to: <strong id="sr-import-category-label">Monthly - Outlet Regional</strong>
                </div>

                <!-- Drag and Drop Upload Area -->
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Upload File (.xlsx, .xls)</label>
                    <div id="sr-drag-drop-zone" class="drag-drop-zone"
                        onclick="document.getElementById('sr-import-file-input').click()">
                        <div class="drag-drop-text">Drag &amp; drop Excel file here</div>
                        <div class="drag-drop-subtext">or click to browse from local computer</div>
                    </div>
                    <input type="file" id="sr-import-file-input" accept=".xlsx,.xls" style="display: none;"
                        onchange="App.handleSRFileSelect(this.files)">

                    <!-- Selected File Display -->
                    <div id="sr-selected-file-display" style="display: none;">
                        <div class="selected-file-badge">
                            <div class="selected-file-info">
                                <span id="sr-selected-file-name">file.xlsx</span>
                                <span id="sr-selected-file-size" style="color: #64748b; font-size: 11px;">(0
                                    KB)</span>
                            </div>
                            <button type="button" class="selected-file-remove"
                                onclick="App.clearSRSelectedFile()">&times;</button>
                        </div>
                    </div>
                </div>

                <!-- Sheet Selection Group -->
                <div class="form-group" id="sr-import-sheet-group" style="display: none; margin-top: 1rem;">
                    <label class="form-label" for="sr-import-sheet-select">Select Sheet</label>
                    <select id="sr-import-sheet-select" class="form-control" style="cursor: pointer;">
                        <option value="">Reading sheets...</option>
                    </select>
                    <div id="sr-import-sheet-hint" style="font-size: 11px; color: #64748b; margin-top: 4px;"></div>
                </div>

                <!-- Overwrite Option -->
                <div class="form-group" style="margin-top: 1rem; margin-bottom: 0.5rem;">
                    <label
                        style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 13px; color: #475569;">
                        <input type="checkbox" id="sr-import-replace-existing"
                            style="width: 16px; height: 16px; cursor: pointer;">
                        <span><strong>Replace data existing</strong> (Hapus data sebelumnya)</span>
                    </label>
                </div>

                <!-- Status message in modal -->
                <div id="sr-modal-import-status"
                    style="display: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin-top: 12px;">
                </div>
            </div>

            <!-- Footer Buttons -->
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeSiteRegionalImportModal()">Cancel</button>
                <button class="btn btn-primary" id="sr-modal-import-btn" onclick="App.submitSRImport()">Upload &amp;
                    Import</button>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="assets/js/chart.umd.min.js"></script>
    <script src="assets/js/app.js"></script>

</body>

</html>