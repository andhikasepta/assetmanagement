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

    <!-- Clean Corporate App CSS -->
    <link rel="stylesheet" href="assets/css/style.css">
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
                            🔄 Refresh
                        </button>
                        <button class="btn btn-primary" onclick="App.openImportModal()">
                            📥 Import Excel
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
                                    <th rowspan="3" class="text-center align-middle" style="min-width: 280px;">Profile
                                    </th>
                                    <th colspan="2" class="text-center">Periode</th>
                                    <th colspan="4" class="text-center">RESULT MATCH</th>
                                    <th colspan="4" class="text-center">RESULT PHYSIC</th>
                                    <th colspan="4" class="text-center">RESULT DB</th>
                                    <th colspan="6" class="text-center">TOTAL</th>
                                </tr>

                                <!-- Level 2 Sub-Header -->
                                <tr>
                                    <th rowspan="2" class="text-center align-middle">Start</th>
                                    <th rowspan="2" class="text-center align-middle">End</th>

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

                                <!-- Level 3 Leaf Columns -->
                                <tr>
                                    <!-- Under RESULT MATCH -->
                                    <th>QTY</th>
                                    <th>%</th>
                                    <th>Value</th>
                                    <th>%</th>

                                    <!-- Under RESULT PHYSIC -->
                                    <th>QTY</th>
                                    <th>%</th>
                                    <th>Value</th>
                                    <th>%</th>

                                    <!-- Under RESULT DB -->
                                    <th>QTY</th>
                                    <th>%</th>
                                    <th>Value</th>
                                    <th>%</th>

                                    <!-- Under TOTAL -->
                                    <th>ACTUAL</th>
                                    <th>TARGET</th>
                                    <th>%</th>
                                    <th>ACTUAL</th>
                                    <th>TARGET</th>
                                    <th>%</th>
                                </tr>

                                <!-- Level 4: Column Filter Dropdowns -->
                                <tr class="filter-row">
                                    <th></th>
                                    <th><select class="col-filter" data-col="profile"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="period_start"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="period_end"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="match_physic_qty"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="match_physic_pct"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="match_nbv_value"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="match_nbv_pct"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="physic_physic_qty"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="physic_physic_pct"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="physic_nbv_value"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="physic_nbv_pct"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="db_physic_qty"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="db_physic_pct"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="db_nbv_value"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="db_nbv_pct"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="total_physic_actual"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="total_physic_target"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="total_physic_pct"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="total_nbv_actual"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="total_nbv_target"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                    <th><select class="col-filter" data-col="total_nbv_pct"
                                            onchange="App.applyFilterAndRender()">
                                            <option value="">All</option>
                                        </select></th>
                                </tr>
                            </thead>
                            <tbody id="master-table-body">
                                <tr>
                                    <td colspan="22" class="text-center" style="padding: 2rem; color: #64748b;">
                                        Loading records from PostgreSQL...
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
        </section>

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!-- PAGE 2: Stock Opname Summary (KPI Overview & Roll-Up)        -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        <section id="page-summary" class="page-section">
            <!-- KPI Summary Cards -->
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-title">Total Outlets / Profiles</div>
                    <div class="kpi-value" id="kpi-total-profiles">0</div>
                    <div class="kpi-subtext">Registered Records</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Total Physical Match</div>
                    <div class="kpi-value" id="kpi-match-qty">0</div>
                    <div class="kpi-subtext">Units Verified</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Total NBV Match</div>
                    <div class="kpi-value" id="kpi-match-nbv">Rp 0</div>
                    <div class="kpi-subtext">Book Value Matched</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Total Physic Only</div>
                    <div class="kpi-value" id="kpi-physic-qty">0</div>
                    <div class="kpi-subtext">Unmatched in DB</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-title">Total DB Only</div>
                    <div class="kpi-value" id="kpi-db-qty">0</div>
                    <div class="kpi-subtext">Missing Physical</div>
                </div>
            </div>

            <!-- Grand Totals Overview Card -->
            <div class="card">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">Stock Opname Summary Totals</h2>
                        <p class="card-subtitle">Aggregated totals across all profiles</p>
                    </div>
                    <button class="btn btn-secondary" onclick="App.loadSummaryData()">
                        🔄 Refresh
                    </button>
                </div>
                <div class="card-body" style="padding: 0;">
                    <div class="table-responsive">
                        <table class="reconciliation-table" id="summary-overview-table">
                            <thead>
                                <tr>
                                    <th rowspan="2" class="text-center align-middle">Scope</th>
                                    <th colspan="2" class="text-center">RESULT MATCH</th>
                                    <th colspan="2" class="text-center">RESULT PHYSIC</th>
                                    <th colspan="2" class="text-center">RESULT DB</th>
                                    <th colspan="2" class="text-center">TOTAL TARGET</th>
                                </tr>
                                <tr>
                                    <th>Physical Qty</th>
                                    <th>NBV Value</th>
                                    <th>Physical Qty</th>
                                    <th>NBV Value</th>
                                    <th>Physical Qty</th>
                                    <th>NBV Value</th>
                                    <th>Physical Target</th>
                                    <th>NBV Target</th>
                                </tr>
                            </thead>
                            <tbody id="summary-overview-body">
                                <tr>
                                    <td colspan="9" class="text-center" style="padding: 2rem; color: #64748b;">
                                        Loading summary totals...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
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
                <h3 class="modal-title">Import Excel Assets</h3>
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
                        <div class="drag-drop-icon">📥</div>
                        <div class="drag-drop-text">Drag &amp; drop Excel file here</div>
                        <div class="drag-drop-subtext">or click to browse from local computer</div>
                    </div>
                    <input type="file" id="import-file-input" accept=".xlsx,.xls" style="display: none;"
                        onchange="App.handleFileSelect(this.files)">

                    <!-- Selected File Display -->
                    <div id="selected-file-display" style="display: none;">
                        <div class="selected-file-badge">
                            <div class="selected-file-info">
                                <span>📄</span>
                                <span id="selected-file-name">file.xlsx</span>
                                <span id="selected-file-size" style="color: #64748b; font-size: 11px;">(0 KB)</span>
                            </div>
                            <button type="button" class="selected-file-remove"
                                onclick="App.clearSelectedFile()">&times;</button>
                        </div>
                    </div>
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

    <!-- Scripts -->
    <script src="assets/js/app.js"></script>

</body>

</html>