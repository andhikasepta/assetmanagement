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
                        <button class="btn btn-danger" onclick="App.openBulkDeleteModal()" title="Delete bulk data by period month and year">
                            🗑️ Bulk Delete
                        </button>
                        <button class="btn btn-danger" onclick="App.clearAllData()" title="Clear all imported records from database" style="background-color: #ef4444;">
                            ⚠️ Clear All
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
                                    <th rowspan="3" class="text-center align-middle sortable" style="min-width: 280px;" onclick="App.toggleSort('profile')">
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
                                    <th rowspan="2" class="text-center align-middle sortable" onclick="App.toggleSort('period_start')">
                                        Start <span class="sort-indicator" data-col="period_start">⇅</span>
                                    </th>
                                    <th rowspan="2" class="text-center align-middle sortable" onclick="App.toggleSort('period_end')">
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
                                    <th class="sortable text-center" onclick="App.toggleSort('match_physic_qty')">QTY <span class="sort-indicator" data-col="match_physic_qty">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('match_physic_pct')">% <span class="sort-indicator" data-col="match_physic_pct">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('match_nbv_value')">Value <span class="sort-indicator" data-col="match_nbv_value">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('match_nbv_pct')">% <span class="sort-indicator" data-col="match_nbv_pct">⇅</span></th>

                                    <!-- Under RESULT PHYSIC -->
                                    <th class="sortable text-center" onclick="App.toggleSort('physic_physic_qty')">QTY <span class="sort-indicator" data-col="physic_physic_qty">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('physic_physic_pct')">% <span class="sort-indicator" data-col="physic_physic_pct">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('physic_nbv_value')">Value <span class="sort-indicator" data-col="physic_nbv_value">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('physic_nbv_pct')">% <span class="sort-indicator" data-col="physic_nbv_pct">⇅</span></th>

                                    <!-- Under RESULT DB -->
                                    <th class="sortable text-center" onclick="App.toggleSort('db_physic_qty')">QTY <span class="sort-indicator" data-col="db_physic_qty">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('db_physic_pct')">% <span class="sort-indicator" data-col="db_physic_pct">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('db_nbv_value')">Value <span class="sort-indicator" data-col="db_nbv_value">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('db_nbv_pct')">% <span class="sort-indicator" data-col="db_nbv_pct">⇅</span></th>

                                    <!-- Under TOTAL -->
                                    <th class="sortable text-center" onclick="App.toggleSort('total_physic_actual')">ACTUAL <span class="sort-indicator" data-col="total_physic_actual">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_physic_target')">TARGET <span class="sort-indicator" data-col="total_physic_target">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_physic_pct')">% <span class="sort-indicator" data-col="total_physic_pct">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_nbv_actual')">ACTUAL <span class="sort-indicator" data-col="total_nbv_actual">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_nbv_target')">TARGET <span class="sort-indicator" data-col="total_nbv_target">⇅</span></th>
                                    <th class="sortable text-center" onclick="App.toggleSort('total_nbv_pct')">% <span class="sort-indicator" data-col="total_nbv_pct">⇅</span></th>
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

                <!-- Overwrite Option -->
                <div class="form-group" style="margin-top: 1rem; margin-bottom: 0.5rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 13px; color: #475569;">
                        <input type="checkbox" id="import-replace-existing" checked style="width: 16px; height: 16px; cursor: pointer;">
                        <span><strong>Replace existing records</strong> (clears previous table data before importing new records)</span>
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
                <h3 class="modal-title" style="color: #dc2626;">🗑️ Bulk Delete by Period</h3>
                <button class="modal-close-btn" onclick="App.closeBulkDeleteModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 1.25rem;">
                    Select the Period Month and Year to delete matching Stock Opname records from the database.
                </p>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="bulk-delete-month">Period Month</label>
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

                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 0.75rem 1rem; margin-top: 1rem; color: #991b1b; font-size: 12px; line-height: 1.4;">
                    <strong>⚠️ Warning:</strong> This action permanently deletes records matching the selected period from the database. This cannot be undone.
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeBulkDeleteModal()">Cancel</button>
                <button class="btn btn-danger" id="bulk-delete-submit-btn" onclick="App.submitBulkDelete()">
                    🗑️ Delete Period Data
                </button>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="assets/js/app.js"></script>

</body>

</html>