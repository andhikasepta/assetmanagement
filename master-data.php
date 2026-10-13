<?php
/**
 * Master Data Management (Admin Only)
 * Clean Corporate White Layout
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/security.php';

sendSecurityHeaders();

if (!isLoggedIn()) {
    header('Location: login.php');
    exit;
}

$currentUser = getCurrentUser();
$isLoggedIn = true;
$csrfToken = getCsrfToken();

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
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
    <title>Master Data - Amora Asset Management</title>

    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..800;1,14..32,400..700&display=swap" rel="stylesheet">

    <!-- Clean Corporate App CSS -->
    <link rel="stylesheet" href="assets/css/style.css?v=<?= filemtime(__DIR__ . '/assets/css/style.css') ?>">
    <link rel="stylesheet" href="layout/footer.css?v=<?= filemtime(__DIR__ . '/layout/footer.css') ?>">
</head>

<body>

    <!-- Toast Notification Container -->
    <div id="toast-container" class="toast-container"></div>

    <!-- Top Navigation Bar -->
    <header class="navbar">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <a href="master-data.php" class="navbar-brand">
                Asset Management
            </a>
        </div>

        <!-- Navigation Menus: Master Data Admin -->
        <nav class="navbar-menu">
            <button class="nav-link active" data-page="master-data" id="tab-master-data">
                Master Data
            </button>
        </nav>

        <!-- Navbar Actions (Right): User Dropdown with Full Name & Only Logout for Admin -->
        <div class="navbar-actions">
            <div class="user-dropdown-container" id="user-dropdown-container">
                <button type="button" class="user-dropdown-btn" id="user-dropdown-toggle"
                    onclick="App.toggleUserDropdown(event)" title="Detail Akun Admin">
                    <div class="user-avatar-circle">
                        <?= strtoupper(substr($currentUser['name'] ?? 'A', 0, 1)) ?>
                    </div>
                    <span class="user-name-text">
                        <?= htmlspecialchars($currentUser['name'] ?? 'Asset Management Administrator', ENT_QUOTES, 'UTF-8') ?>
                    </span>
                    <svg class="chevron-icon" width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2.2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="user-dropdown-menu" id="user-dropdown-menu">
                    <a href="logout.php" class="user-dropdown-item text-danger">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>Logout</span>
                    </a>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Application Content -->
    <main class="main-wrapper">
            <section id="page-master-data" class="page-section active">
                <div class="card" id="card-master-opname">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Stock Opname Master Data</h2>
                            <p class="card-subtitle">INTAN Raw Stock Opname Data (Download data per tanggal 26 setiap bulan)
                            </p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                            <button class="btn btn-refresh" onclick="App.loadMasterData()">
                                Refresh
                            </button>
                            <button class="btn btn-danger" onclick="App.openBulkDeleteModal()"
                                title="Hapus data berdasarkan bulan dan tahun">
                                Hapus Data
                            </button>
                            <button class="btn btn-primary" onclick="App.openImportModal()">
                                Impor Data SO
                            </button>
                        </div>
                    </div>

                    <!-- Table Toolbar: Page Size & Search & Period Filters -->
                    <div class="table-toolbar">
                        <div class="table-toolbar-left">
                            <label for="master-page-size">Tampilkan</label>
                            <select id="master-page-size" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                                autocomplete="off" onchange="App.changePageSize(this.value)">
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="all">Semua</option>
                            </select>
                            <span>baris per halaman</span>

                            <span style="margin-left: 1rem; border-left: 1px solid #e2e8f0; padding-left: 1rem;"></span>

                            <label for="filter-month">BULAN</label>
                            <select id="filter-month" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                                autocomplete="off" onchange="App.applyFilterAndRender()">
                                <option value="" selected>Semua Bulan</option>
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
                                    <option value="<?= $num ?>"><?= $name ?></option>
                                <?php endforeach; ?>
                            </select>

                            <label for="filter-year">TAHUN</label>
                            <select id="filter-year" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                                autocomplete="off" onchange="App.applyFilterAndRender()">
                                <option value="" selected>Semua Tahun</option>
                                <?php for ($y = $currentYear; $y <= $currentYear + 5; $y++): ?>
                                    <option value="<?= $y ?>"><?= $y ?></option>
                                <?php endfor; ?>
                            </select>
                        </div>
                        <div class="table-toolbar-right">
                            <input type="text" id="master-search-input" class="table-search-input" placeholder="Search..."
                                autocomplete="off" value="" oninput="App.handleSearch(this.value)">
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
                                            Memuat data...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Table Pagination Footer -->
                    <div class="table-pagination-footer">
                        <div id="master-pagination-info">Menampilkan 0 sampai 0 dari 0 data</div>
                        <div class="pagination-controls" id="master-pagination-controls"></div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!-- CARD 2: Site Regional                                       -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div class="card" id="card-site-regional" style="margin-top: 2rem;">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Site Master Data</h2>
                            <p class="card-subtitle">All Site master data</p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                            <button class="btn btn-refresh" onclick="App.loadSiteRegional()">
                                Refresh
                            </button>
                            <button class="btn btn-danger" id="sr-bulk-delete-btn" style="display: none;"
                                onclick="App.bulkDeleteSiteRegional()" title="Hapus data terpilih">
                                Hapus Terpilih (<span id="sr-selected-count">0</span>)
                            </button>
                            <button class="btn btn-primary" onclick="App.openSiteRegionalImportModal()">
                                Impor Data
                            </button>
                        </div>
                    </div>

                    <!-- Table Toolbar: Page Size, Filters & Search -->
                    <div class="table-toolbar" style="gap: 0.75rem; flex-wrap: wrap;">
                        <div class="table-toolbar-left"
                            style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                            <label for="sr-page-size">Tampilkan</label>
                            <select id="sr-page-size" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                                autocomplete="off" onchange="App.changeSRPageSize(this.value)">
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="all">Semua</option>
                            </select>
                            <span>baris</span>

                            <span style="border-left: 1px solid #cbd5e1; height: 18px; margin: 0 4px;"></span>

                            <label for="sr-filter-regional">REGIONAL</label>
                            <select id="sr-filter-regional" class="form-control"
                                style="width: auto; padding: 0.25rem 0.5rem;" autocomplete="off"
                                onchange="App.onSRRegionalFilterChange()">
                                <option value="all" selected>Semua Regional</option>
                            </select>

                            <label for="sr-filter-dept">DEPT</label>
                            <select id="sr-filter-dept" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                                autocomplete="off" onchange="App.onSRDeptFilterChange()">
                                <option value="all" selected>Semua Dept</option>
                            </select>

                            <label for="sr-filter-subdept">SUB DEPT</label>
                            <select id="sr-filter-subdept" class="form-control"
                                style="width: auto; padding: 0.25rem 0.5rem;" autocomplete="off"
                                onchange="App.onSRSubDeptFilterChange()">
                                <option value="all" selected>Semua Sub Dept</option>
                            </select>

                            <label for="sr-filter-info">INFO</label>
                            <select id="sr-filter-info" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                                autocomplete="off" onchange="App.onSRInfoFilterChange()">
                                <option value="all" selected>Semua Info</option>
                            </select>

                            <label for="sr-filter-grouptype">GROUP TYPE</label>
                            <select id="sr-filter-grouptype" class="form-control"
                                style="width: auto; padding: 0.25rem 0.5rem;" autocomplete="off"
                                onchange="App.onSRGroupTypeFilterChange()">
                                <option value="all" selected>Semua Group</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                            </select>

                            <label for="sr-filter-status">STATUS</label>
                            <select id="sr-filter-status" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                                autocomplete="off" onchange="App.onSRStatusFilterChange()">
                                <option value="all" selected>Semua Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div class="table-toolbar-right">
                            <input type="text" id="sr-search-input" class="table-search-input" placeholder="Search..."
                                autocomplete="off" value="" oninput="App.handleSRSearch(this.value)">
                        </div>
                    </div>

                    <!-- Site Regional Table -->
                    <div class="card-body" style="padding: 0;">
                        <div class="table-responsive">
                            <table class="reconciliation-table" id="sr-table">
                                <thead>
                                    <tr>
                                        <th colspan="4" class="text-center align-middle col-action-group">ACTION</th>
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
                                        <th rowspan="2" class="text-center align-middle sortable"
                                            onclick="App.toggleSRSort('info')">
                                            INFO <span class="sort-indicator" data-sr-col="info">⇅</span>
                                        </th>
                                        <th rowspan="2" class="text-center align-middle sortable"
                                            onclick="App.toggleSRSort('group_type')">
                                            GROUP TYPE <span class="sort-indicator" data-sr-col="group_type">⇅</span>
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
                                        <th class="text-center align-middle col-action-active"
                                            style="padding: 4px 6px; font-size: 10px; font-weight: 600;"
                                            title="Active status">
                                            ACT
                                        </th>
                                        <th class="text-center align-middle col-action-counted"
                                            style="padding: 4px 6px; font-size: 10px; font-weight: 600;"
                                            title="Dihitung dalam Ringkasan / Count in summary">
                                            COUNT
                                        </th>
                                    </tr>
                                </thead>
                                <tbody id="sr-table-body">
                                    <tr>
                                        <td colspan="11" class="text-center" style="padding: 2.5rem; color: #64748b;">
                                            Memuat data...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Table Pagination Footer -->
                    <div class="table-pagination-footer">
                        <div id="sr-pagination-info">Menampilkan 0 sampai 0 dari 0 data</div>
                        <div class="pagination-controls" id="sr-pagination-controls"></div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!-- CARD 3: Rekap DB Master Data                                -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div class="card" id="card-rekap-db" style="margin-top: 2rem;">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Rekap DB Master Data</h2>
                            <p class="card-subtitle">Raw Rekap data DB (INTAN > Monitoring Detail [filter Result DB])</p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                            <button class="btn btn-refresh" onclick="App.loadRekapDbData()">
                                Refresh
                            </button>
                            <button class="btn btn-danger" onclick="App.openRekapDbBulkDeleteModal()"
                                title="Hapus data Rekap DB berdasarkan bulan dan tahun">
                                Hapus Data
                            </button>
                            <button class="btn btn-primary" onclick="App.openRekapDbImportModal()">
                                Impor Data Rekap DB
                            </button>
                        </div>
                    </div>

                    <!-- Table Toolbar: Page Size & Search & Period Filters -->
                    <div class="table-toolbar">
                        <div class="table-toolbar-left">
                            <label for="rekap-db-page-size">Tampilkan</label>
                            <select id="rekap-db-page-size" class="form-control"
                                style="width: auto; padding: 0.25rem 0.5rem;" autocomplete="off"
                                onchange="App.changeRekapDbPageSize(this.value)">
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="all">Semua</option>
                            </select>
                            <span>baris per halaman</span>

                            <span style="margin-left: 1rem; border-left: 1px solid #e2e8f0; padding-left: 1rem;"></span>

                            <label for="rekap-db-filter-month">BULAN</label>
                            <select id="rekap-db-filter-month" class="form-control"
                                style="width: auto; padding: 0.25rem 0.5rem;" autocomplete="off"
                                onchange="App.applyRekapDbFilter()">
                                <option value="" selected>Semua Bulan</option>
                                <?php foreach ($monthNames as $num => $name): ?>
                                    <option value="<?= $num ?>"><?= $name ?></option>
                                <?php endforeach; ?>
                            </select>

                            <label for="rekap-db-filter-year">TAHUN</label>
                            <select id="rekap-db-filter-year" class="form-control"
                                style="width: auto; padding: 0.25rem 0.5rem;" autocomplete="off"
                                onchange="App.applyRekapDbFilter()">
                                <option value="" selected>Semua Tahun</option>
                                <?php for ($y = $currentYear; $y <= $currentYear + 5; $y++): ?>
                                    <option value="<?= $y ?>"><?= $y ?></option>
                                <?php endfor; ?>
                            </select>
                        </div>
                        <div class="table-toolbar-right">
                            <input type="text" id="rekap-db-search-input" class="table-search-input" placeholder="Search..."
                                autocomplete="off" value="" oninput="App.handleRekapDbSearch(this.value)">
                        </div>
                    </div>

                    <!-- Rekap DB Table -->
                    <div class="card-body" style="padding: 0;">
                        <div class="table-responsive">
                            <table class="reconciliation-table" id="rekap-db-table">
                                <thead>
                                    <tr>
                                        <th class="text-center align-middle" style="width: 50px;">NO</th>
                                        <th class="text-center align-middle sortable" style="width: 130px;"
                                            onclick="App.toggleRekapDbSort('sitecode')">
                                            SITECODE <span class="sort-indicator" data-rdb-col="sitecode">⇅</span>
                                        </th>
                                        <th class="text-center align-middle sortable" style="width: 140px;"
                                            onclick="App.toggleRekapDbSort('reg_no')">
                                            REG NO <span class="sort-indicator" data-rdb-col="reg_no">⇅</span>
                                        </th>
                                        <th class="text-left align-middle sortable" style="min-width: 220px;"
                                            onclick="App.toggleRekapDbSort('name')">
                                            NAME <span class="sort-indicator" data-rdb-col="name">⇅</span>
                                        </th>
                                        <th class="text-center align-middle sortable" style="width: 140px;"
                                            onclick="App.toggleRekapDbSort('sn')">
                                            SN <span class="sort-indicator" data-rdb-col="sn">⇅</span>
                                        </th>
                                        <th class="text-right align-middle sortable" style="width: 150px;"
                                            onclick="App.toggleRekapDbSort('nbv')">
                                            NBV <span class="sort-indicator" data-rdb-col="nbv">⇅</span>
                                        </th>
                                        <th class="text-center align-middle col-action" style="width: 90px;">ACTION</th>
                                    </tr>
                                </thead>
                                <tbody id="rekap-db-tbody">
                                    <tr>
                                        <td colspan="7" class="text-center" style="padding: 2.5rem; color: #64748b;">
                                            Memuat data Rekap DB...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Table Pagination Footer -->
                    <div class="table-pagination-footer">
                        <div id="rekap-db-pagination-info">Menampilkan 0 sampai 0 dari 0 data</div>
                        <div class="pagination-controls" id="rekap-db-pagination-controls"></div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!-- SECTION: Master Data Catatan Executive Summary              -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div class="card" id="card-master-catatan" style="margin-top: 2rem; margin-bottom: 2rem;">
                    <div class="card-header"
                        style="flex-wrap: wrap; gap: 0.75rem; justify-content: space-between; align-items: center; padding: 0.85rem 1.25rem;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                                <h2 class="card-title"
                                    style="font-size: 15px; margin: 0; display: inline-flex; align-items: center; gap: 0.45rem;">
                                    Catatan dan Evaluasi Master Data
                                </h2>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">

                            <button class="btn btn-secondary btn-sm" onclick="App.loadMasterCatatan()" title="Segarkan data"
                                style="font-size: 11.5px; padding: 3px 8px;">
                                Refresh
                            </button>
                            <!-- Filter Tipe SO -->
                            <div style="display: flex; align-items: center; gap: 0.35rem;">
                                <label for="master-catatan-filter-sotype"
                                    style="font-size: 11.5px; font-weight: 600; color: #64748b; margin: 0;">Tipe SO:</label>
                                <select id="master-catatan-filter-sotype" class="form-control form-control-sm"
                                    style="font-size: 11.5px; padding: 2px 8px; height: 28px; width: auto;"
                                    onchange="App.loadMasterCatatan()">
                                    <option value="" selected>Semua</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                </select>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.35rem;">
                                <label for="master-catatan-filter-year"
                                    style="font-size: 11.5px; font-weight: 600; color: #64748b; margin: 0;">Tahun:</label>
                                <select id="master-catatan-filter-year" class="form-control form-control-sm"
                                    style="font-size: 11.5px; padding: 2px 8px; height: 28px; width: auto;"
                                    onchange="App.loadMasterCatatan()">
                                    <option value="">Semua</option>
                                    <option value="2026" selected>2026</option>
                                    <option value="2027">2027</option>
                                    <option value="2028">2028</option>
                                </select>
                            </div>
                            <!-- Filter Bulan -->
                            <div style="display: flex; align-items: center; gap: 0.35rem;">
                                <label for="master-catatan-filter-month"
                                    style="font-size: 11.5px; font-weight: 600; color: #64748b; margin: 0;">Bulan:</label>
                                <select id="master-catatan-filter-month" class="form-control form-control-sm"
                                    style="font-size: 11.5px; padding: 2px 8px; height: 28px; width: auto;"
                                    onchange="App.loadMasterCatatan()">
                                    <option value="" selected>Semua Bulan</option>
                                    <option value="1">Januari</option>
                                    <option value="2">Februari</option>
                                    <option value="3">Maret</option>
                                    <option value="4">April</option>
                                    <option value="5">Mei</option>
                                    <option value="6">Juni</option>
                                    <option value="7">Juli</option>
                                    <option value="8">Agustus</option>
                                    <option value="9">September</option>
                                    <option value="10">Oktober</option>
                                    <option value="11">November</option>
                                    <option value="12">Desember</option>
                                </select>
                            </div>
                            <button class="btn btn-primary btn-sm" onclick="App.openAddExecutiveNoteModal()"
                                style="font-size: 11.5px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Tambah Catatan
                            </button>
                        </div>
                    </div>
                    <div class="card-body" style="padding: 0;">
                        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                            <table class="reconciliation-table" id="master-catatan-table">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        <th style="width: 45px; text-align: center;">NO</th>
                                        <th class="sortable text-center" style="width: 105px;"
                                            onclick="App.toggleMasterCatatanSort('so_type')">
                                            TIPE SO <span class="sort-indicator" data-mcat-col="so_type">⇅</span>
                                        </th>
                                        <th class="sortable text-center" style="width: 130px;"
                                            onclick="App.toggleMasterCatatanSort('period')">
                                            PERIODE <span class="sort-indicator" data-mcat-col="period">⇅</span>
                                        </th>
                                        <th class="sortable text-center" style="width: 95px;"
                                            onclick="App.toggleMasterCatatanSort('dept')">
                                            DEPT <span class="sort-indicator" data-mcat-col="dept">⇅</span>
                                        </th>
                                        <th class="sortable text-center" style="width: 105px;"
                                            onclick="App.toggleMasterCatatanSort('sub_dept')">
                                            SUB DEPT <span class="sort-indicator" data-mcat-col="sub_dept">⇅</span>
                                        </th>
                                        <th class="sortable text-left" onclick="App.toggleMasterCatatanSort('keterangan')">
                                            KETERANGAN <span class="sort-indicator" data-mcat-col="keterangan">⇅</span>
                                        </th>
                                        <th style="width: 95px; text-align: center;">ACTION</th>
                                    </tr>
                                </thead>
                                <tbody id="master-catatan-tbody">
                                    <tr>
                                        <td colspan="7" class="text-center" style="padding: 2.5rem; color: #64748b;">
                                            Memuat data catatan...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════════════════════════ -->
                <!-- SECTION: Score Card KPI Master Data (Rating & Execution)    -->
                <!-- ═══════════════════════════════════════════════════════════ -->
                <div class="scorecard-kpi-grid"
                    style="display: grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 1.25rem; margin-top: 2rem; margin-bottom: 2rem; align-items: start;">

                    <!-- ── Left Card: Rating KPI Master Data ─────────────────── -->
                    <div class="card" id="card-scorecard-rating-kpi"
                        style="margin: 0; display: flex; flex-direction: column;">
                        <div class="card-header" style="flex-wrap: wrap; gap: 0.6rem; padding: 0.75rem 1rem;">
                            <div>
                                <h2 class="card-title" style="font-size: 14.5px;">Rating KPI Master Data</h2>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                                <button class="btn btn-refresh btn-sm" id="kpi-rating-refresh-btn"
                                    onclick="App.loadScorecardKpi()" title="Muat ulang data KPI"
                                    style="font-size: 11.5px; padding: 3px 8px;">
                                    Refresh
                                </button>
                                <button class="btn btn-primary btn-sm" id="kpi-edit-btn"
                                    onclick="App.toggleEditScorecardKpi()" style="font-size: 11.5px; padding: 3px 8px;">
                                    Edit Range (%)
                                </button>
                                <button class="btn btn-warning btn-sm" id="kpi-reset-btn"
                                    style="display: none; font-size: 11.5px; padding: 3px 8px;"
                                    onclick="App.resetScorecardKpi()">
                                    Reset Default
                                </button>
                                <button class="btn btn-primary btn-sm" id="kpi-save-btn"
                                    style="display: none; font-size: 11.5px; padding: 3px 8px;"
                                    onclick="App.saveScorecardKpi()">
                                    Simpan
                                </button>
                            </div>
                        </div>

                        <div class="card-body" style="padding: 0; flex: 1;">
                            <div class="table-responsive">
                                <table class="reconciliation-table kpi-config-table" id="kpi-config-table">
                                    <thead>
                                        <tr>
                                            <th class="text-center align-middle" style="width: 125px;">RATING</th>
                                            <th class="text-center align-middle" style="width: 175px;">RANGE (%)</th>
                                            <th class="text-center align-middle" style="width: 90px;">DESIMAL</th>
                                            <th class="text-center align-middle">Indikator</th>
                                        </tr>
                                    </thead>
                                    <tbody id="kpi-config-tbody">
                                        <tr>
                                            <td colspan="4" class="text-center" style="padding: 2.2rem; color: #64748b;">
                                                Memuat konfigurasi KPI...
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- ── Right Card: SO Execution KPI Master Data ──────────── -->
                    <div class="card" id="card-scorecard-exec-kpi"
                        style="margin: 0; display: flex; flex-direction: column;">
                        <div class="card-header" style="flex-wrap: wrap; gap: 0.6rem; padding: 0.75rem 1rem;">
                            <div>
                                <h2 class="card-title" style="font-size: 14.5px;">SO Execution KPI Master Data</h2>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                                <button class="btn btn-refresh btn-sm" id="kpi-exec-refresh-btn"
                                    onclick="App.loadScorecardKpi()" title="Muat ulang data KPI"
                                    style="font-size: 11.5px; padding: 3px 8px;">
                                    Refresh
                                </button>
                                <button class="btn btn-primary btn-sm" id="kpi-exec-edit-btn"
                                    onclick="App.toggleEditScorecardExecKpi()" style="font-size: 11.5px; padding: 3px 8px;">
                                    Edit Range (%)
                                </button>
                                <button class="btn btn-warning btn-sm" id="kpi-exec-reset-btn"
                                    style="display: none; font-size: 11.5px; padding: 3px 8px;"
                                    onclick="App.resetScorecardExecKpi()">
                                    Reset Default
                                </button>
                                <button class="btn btn-primary btn-sm" id="kpi-exec-save-btn"
                                    style="display: none; font-size: 11.5px; padding: 3px 8px;"
                                    onclick="App.saveScorecardExecKpi()">
                                    Simpan
                                </button>
                            </div>
                        </div>

                        <div class="card-body" style="padding: 0; flex: 1;">
                            <div class="table-responsive">
                                <table class="reconciliation-table kpi-config-table" id="kpi-exec-config-table">
                                    <thead>
                                        <tr>
                                            <th class="text-center align-middle" style="width: 140px;">STATUS</th>
                                            <th class="text-center align-middle" style="width: 175px;">FORMULA</th>
                                            <th class="text-center align-middle">THRESHOLD</th>
                                        </tr>
                                    </thead>
                                    <tbody id="kpi-exec-config-tbody">
                                        <tr>
                                            <td colspan="3" class="text-center" style="padding: 2.2rem; color: #64748b;">
                                                Memuat konfigurasi KPI...
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                </div>
            </section>
    </main>

    <!-- Layout Footer -->
    <?php require_once __DIR__ . '/layout/footer.php'; ?>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Import Excel with Drag & Drop + Month/Year Selection  -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="import-modal" class="modal-backdrop">
        <div class="modal-dialog">
            <div class="modal-header">
                <h3 class="modal-title">Impor Data SO</h3>
                <button class="modal-close-btn" onclick="App.closeImportModal()">&times;</button>
            </div>
            <div class="modal-body">
                <!-- Period Selection: Month & Year -->
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="import-month">Periode Bulan</label>
                        <select id="import-month" class="form-control">
                            <?php
                            $monthList = [
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
                            foreach ($monthList as $num => $name): ?>
                                <option value="<?= $num ?>" <?= ($num === $currentMonth) ? 'selected' : '' ?>>
                                    <?= $name ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="import-year">Periode Tahun</label>
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
                    <label class="form-label">Unggah File (.xlsx, .xls)</label>
                    <div id="drag-drop-zone" class="drag-drop-zone"
                        onclick="document.getElementById('import-file-input').click()">
                        <div class="drag-drop-text">Tarik &amp; lepas file Excel di sini</div>
                        <div class="drag-drop-subtext">atau klik untuk memilih dari komputer</div>
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
                    <label class="form-label" for="import-sheet-select">Pilih Sheet</label>
                    <select id="import-sheet-select" class="form-control" style="cursor: pointer;">
                        <option value="">Membaca sheet...</option>
                    </select>
                    <div id="import-sheet-hint" style="font-size: 11px; color: #64748b; margin-top: 4px;"></div>
                </div>

                <!-- Overwrite Option -->
                <div class="form-group" style="margin-top: 1rem; margin-bottom: 0.5rem;">
                    <label
                        style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 13px; color: #475569;">
                        <input type="checkbox" id="import-replace-existing" checked
                            style="width: 16px; height: 16px; cursor: pointer;">
                        <span><strong>Ganti data yang ada</strong> (Hapus data sebelumnya)</span>
                    </label>
                </div>

                <!-- Status message in modal -->
                <div id="modal-import-status"
                    style="display: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin-top: 12px;">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeImportModal()">Batal</button>
                <button class="btn btn-primary" id="modal-upload-btn" onclick="App.submitImport()">Unggah &amp;
                    Impor</button>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Bulk Delete Data by Period & Year                     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="bulk-delete-modal" class="modal-backdrop">
        <div class="modal-dialog" style="max-width: 480px;">
            <div class="modal-header">
                <h3 class="modal-title" style="color: #dc2626;">Hapus Data berdasarkan Periode</h3>
                <button class="modal-close-btn" onclick="App.closeBulkDeleteModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 1.25rem;">
                    Pilih Periode Data yang akan dihapus permanen.
                </p>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="bulk-delete-month">Periode Bulan</label>
                        <select id="bulk-delete-month" class="form-control">
                            <option value="">Semua Bulan pada Tahun Terpilih</option>
                            <?php foreach ($monthList as $num => $name): ?>
                                <option value="<?= $num ?>" <?= ($num === $currentMonth) ? 'selected' : '' ?>>
                                    <?= $name ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="bulk-delete-year">Periode Tahun</label>
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
                    <strong>Peringatan:</strong> Data akan dihapus permanen!
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeBulkDeleteModal()">Batal</button>
                <button class="btn btn-danger" id="bulk-delete-submit-btn" onclick="App.submitBulkDelete()">
                    Hapus Data Periode
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
                <h3 class="modal-title">Impor Data Site Regional</h3>
                <button class="modal-close-btn" onclick="App.closeSiteRegionalImportModal()">&times;</button>
            </div>

            <div class="modal-body" style="padding: 1.25rem;">

                <!-- Drag and Drop Upload Area -->
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Unggah File (.xlsx, .xls)</label>
                    <div id="sr-drag-drop-zone" class="drag-drop-zone"
                        onclick="document.getElementById('sr-import-file-input').click()">
                        <div class="drag-drop-text">Tarik &amp; lepas file Excel di sini</div>
                        <div class="drag-drop-subtext">atau klik untuk memilih dari komputer</div>
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
                    <label class="form-label" for="sr-import-sheet-select">Pilih Sheet</label>
                    <select id="sr-import-sheet-select" class="form-control" style="cursor: pointer;">
                        <option value="">Membaca sheet...</option>
                    </select>
                    <div id="sr-import-sheet-hint" style="font-size: 11px; color: #64748b; margin-top: 4px;"></div>
                </div>

                <!-- Overwrite Option -->
                <div class="form-group" style="margin-top: 1rem; margin-bottom: 0.5rem;">
                    <label
                        style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 13px; color: #475569;">
                        <input type="checkbox" id="sr-import-replace-existing"
                            style="width: 16px; height: 16px; cursor: pointer;">
                        <span><strong>Ganti data yang ada</strong> (Hapus data sebelumnya)</span>
                    </label>
                </div>

                <!-- Status message in modal -->
                <div id="sr-modal-import-status"
                    style="display: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin-top: 12px;">
                </div>
            </div>

            <!-- Footer Buttons -->
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeSiteRegionalImportModal()">Batal</button>
                <button class="btn btn-primary" id="sr-modal-import-btn" onclick="App.submitSRImport()">Unggah &amp;
                    Impor</button>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Manage Site Group History (Dynamic Period Rules)       -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="sr-history-modal" class="modal-backdrop">
        <div class="modal-dialog" style="max-width: 620px;">
            <div class="modal-header">
                <div>
                    <h3 class="modal-title" id="sr-hist-modal-title">Aturan Grup</h3>
                    <p id="sr-hist-modal-subtitle" style="font-size: 12px; color: #64748b; margin: 3px 0 0 0;"></p>
                </div>
                <button class="modal-close-btn" onclick="App.closeSRHistoryModal()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.25rem;">

                <!-- Add New Rule Form -->
                <div
                    style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.9rem; margin-bottom: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; margin-bottom: 0.6rem;">Pilih Group
                        Type</div>
                    <div
                        style="display: grid; grid-template-columns: 1.2fr 1fr 1.2fr auto; gap: 0.5rem; align-items: flex-end;">
                        <div>
                            <label
                                style="font-size: 11px; font-weight: 600; color: #475569; display: block; margin-bottom: 3px;">Bulan</label>
                            <select id="sr-hist-month" class="form-control" style="font-size: 12px; padding: 4px 8px;">
                                <option value="1">1 - Januari</option>
                                <option value="2">2 - Februari</option>
                                <option value="3" selected>3 - Maret</option>
                                <option value="4">4 - April</option>
                                <option value="5">5 - Mei</option>
                                <option value="6">6 - Juni</option>
                                <option value="7">7 - Juli</option>
                                <option value="8">8 - Agustus</option>
                                <option value="9">9 - September</option>
                                <option value="10">10 - Oktober</option>
                                <option value="11">11 - November</option>
                                <option value="12">12 - Desember</option>
                            </select>
                        </div>
                        <div>
                            <label
                                style="font-size: 11px; font-weight: 600; color: #475569; display: block; margin-bottom: 3px;">Tahun</label>
                            <select id="sr-hist-year" class="form-control" style="font-size: 12px; padding: 4px 8px;">
                                <option value="2025">2025</option>
                                <option value="2026" selected>2026</option>
                                <option value="2027">2027</option>
                            </select>
                        </div>
                        <div>
                            <label
                                style="font-size: 11px; font-weight: 600; color: #475569; display: block; margin-bottom: 3px;">Tipe
                                Grup</label>
                            <select id="sr-hist-grouptype" class="form-control"
                                style="font-size: 12px; padding: 4px 8px; font-weight: 600;">
                                <option value="monthly">Monthly</option>
                                <option value="quarterly" selected>Quarterly</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div>
                            <button type="button" class="btn btn-primary btn-sm" onclick="App.addSRHistoryRule()"
                                style="white-space: nowrap; height: 32px; padding: 0 12px;">
                                + Simpan
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Table of Existing Rules -->
                <div style="max-height: 240px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <table class="reconciliation-table" style="margin: 0; font-size: 12px;">
                        <thead>
                            <tr>
                                <th style="padding: 6px 10px;">Effective Period</th>
                                <th style="padding: 6px 10px;">Group Type</th>
                                <th style="padding: 6px 10px;">Note</th>
                                <th style="padding: 6px 10px; text-align: center;">Action</th>
                            </tr>
                        </thead>
                        <tbody id="sr-hist-tbody">
                            <tr>
                                <td colspan="4" style="text-align: center; color: #94a3b8; padding: 1.25rem;">Memuat
                                    aturan...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer" style="padding: 0.75rem 1.25rem; display: flex; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="App.closeSRHistoryModal()">Tutup</button>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Tambah / Edit Catatan Executive Summary              -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="modal-executive-note" class="modal-backdrop">
        <div class="modal-dialog modal-dialog-lg" style="max-width: 820px; width: 95%; position: relative;">
            <div class="modal-header" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #ffffff;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <h3 class="modal-title" id="modal-exec-note-title"
                        style="color: #ffffff; font-size: 15px; margin: 0;">Tambah Catatan Executive Summary</h3>
                </div>
                <button class="modal-close-btn" style="color: #94a3b8;"
                    onclick="App.closeExecutiveNoteModal()">&times;</button>
            </div>
            <form id="form-executive-note" onsubmit="App.submitExecutiveNote(event)" style="position: relative;">
                <input type="hidden" id="modal-note-edit-id" value="">
                <div class="modal-body" style="padding: 1.25rem; max-height: calc(85vh - 120px); overflow-y: auto;">
                    <!-- Periode Row: Tipe SO, Bulan & Tahun -->
                    <div
                        style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 1.25rem;">
                        <div
                            style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem;">
                            PILIH TIPE & PERIODE
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
                            <div class="form-group" style="margin: 0;">
                                <label class="form-label" for="modal-note-so-type"
                                    style="font-size: 12px; font-weight: 600;">Tipe SO</label>
                                <select id="modal-note-so-type" class="form-control" required>
                                    <option value="monthly" selected>Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin: 0;">
                                <label class="form-label" for="modal-note-month"
                                    style="font-size: 12px; font-weight: 600;">Bulan</label>
                                <select id="modal-note-month" class="form-control" required>
                                    <option value="1">Januari</option>
                                    <option value="2">Februari</option>
                                    <option value="3">Maret</option>
                                    <option value="4">April</option>
                                    <option value="5">Mei</option>
                                    <option value="6">Juni</option>
                                    <option value="7">Juli</option>
                                    <option value="8">Agustus</option>
                                    <option value="9" selected>September</option>
                                    <option value="10">Oktober</option>
                                    <option value="11">November</option>
                                    <option value="12">Desember</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin: 0;">
                                <label class="form-label" for="modal-note-year"
                                    style="font-size: 12px; font-weight: 600;">Tahun</label>
                                <select id="modal-note-year" class="form-control" required>
                                    <option value="2025">2025</option>
                                    <option value="2026" selected>2026</option>
                                    <option value="2027">2027</option>
                                    <option value="2028">2028</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Dynamic Note Rows Section -->
                    <div>
                        <div
                            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <div
                                style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">
                                DAFTAR KETERANGAN
                            </div>
                            <button type="button" class="btn btn-outline-primary btn-sm" id="btn-add-note-row"
                                onclick="App.addExecutiveNoteRow()"
                                style="font-size: 11.5px; padding: 3px 9px; display: inline-flex; align-items: center; gap: 4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Tambah Data
                            </button>
                        </div>

                        <!-- Container for row cards -->
                        <div id="modal-note-rows-container"
                            style="display: flex; flex-direction: column; gap: 0.85rem; padding-bottom: 2.5rem;">
                            <!-- Rows added dynamically via JavaScript -->
                        </div>
                    </div>
                </div>

                <!-- Floating Action Button (+ circle) on bottom right following scrolling -->
                <button type="button" class="fab-add-note-row" id="btn-add-note-row-fab"
                    onclick="App.addExecutiveNoteRow()" title="Tambah Data Catatan (+)"
                    aria-label="Tambah Data Catatan">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
                        stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>

                <div class="modal-footer"
                    style="padding: 0.75rem 1.25rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.5rem;">
                    <button type="button" class="btn btn-secondary"
                        onclick="App.closeExecutiveNoteModal()">Batal</button>
                    <button type="submit" class="btn btn-primary" id="btn-submit-exec-note">Simpan</button>
                </div>
            </form>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Impor Data Rekap DB                                  -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="rekap-db-import-modal" class="modal-backdrop">
        <div class="modal-dialog" style="max-width: 540px;">
            <div class="modal-header">
                <h3 class="modal-title">Impor Rekap DB Master Data</h3>
                <button class="modal-close-btn" onclick="App.closeRekapDbImportModal()">&times;</button>
            </div>

            <div class="modal-body" style="padding: 1.25rem;">
                <!-- Periode Dropdowns -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" for="rekap-db-import-month">Bulan Periode</label>
                        <select id="rekap-db-import-month" class="form-control">
                            <?php foreach ($monthNames as $num => $name): ?>
                                <option value="<?= $num ?>" <?= $num == $currentMonth ? 'selected' : '' ?>><?= $name ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" for="rekap-db-import-year">Tahun Periode</label>
                        <select id="rekap-db-import-year" class="form-control">
                            <?php for ($y = $currentYear - 1; $y <= $currentYear + 5; $y++): ?>
                                <option value="<?= $y ?>" <?= $y == $currentYear ? 'selected' : '' ?>><?= $y ?></option>
                            <?php endfor; ?>
                        </select>
                    </div>
                </div>

                <!-- Drag and Drop Upload Area -->
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Unggah File Excel/CSV (.xlsx, .xls, .csv)</label>
                    <div id="rekap-db-drag-drop-zone" class="drag-drop-zone"
                        onclick="document.getElementById('rekap-db-import-file-input').click()">
                        <div class="drag-drop-text">Tarik &amp; lepas file Rekap DB di sini</div>
                        <div class="drag-drop-subtext">atau klik untuk memilih dari komputer</div>
                    </div>
                    <input type="file" id="rekap-db-import-file-input" accept=".xlsx,.xls,.csv" style="display: none;"
                        onchange="App.handleRekapDbFileSelect(this.files)">

                    <!-- Selected File Display -->
                    <div id="rekap-db-selected-file-display" style="display: none; margin-top: 0.5rem;">
                        <div class="selected-file-badge">
                            <div class="selected-file-info">
                                <span id="rekap-db-selected-file-name">file.xlsx</span>
                                <span id="rekap-db-selected-file-size" style="color: #64748b; font-size: 11px;">(0
                                    KB)</span>
                            </div>
                            <button type="button" class="selected-file-remove"
                                onclick="App.clearRekapDbSelectedFile()">&times;</button>
                        </div>
                    </div>
                </div>

                <!-- Replace Existing Option -->
                <div class="form-group" style="margin-top: 1rem; margin-bottom: 0.5rem;">
                    <label
                        style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 13px; color: #475569;">
                        <input type="checkbox" id="rekap-db-import-replace" checked
                            style="width: 16px; height: 16px; cursor: pointer;">
                        <span><strong>Ganti data yang ada</strong> (Hapus data periode ini terlebih dahulu)</span>
                    </label>
                </div>

                <!-- Status message in modal -->
                <div id="modal-rekap-db-import-status"
                    style="display: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin-top: 12px;">
                </div>
            </div>

            <!-- Footer Buttons -->
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeRekapDbImportModal()">Batal</button>
                <button class="btn btn-primary" id="rekap-db-modal-upload-btn"
                    onclick="App.submitRekapDbImport()">Unggah &amp; Impor</button>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Bulk Delete Rekap DB Master Data                     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="rekap-db-bulk-delete-modal" class="modal-backdrop">
        <div class="modal-dialog" style="max-width: 480px;">
            <div class="modal-header">
                <h3 class="modal-title">Hapus Data Rekap DB Berdasarkan Periode</h3>
                <button class="modal-close-btn" onclick="App.closeRekapDbBulkDeleteModal()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.25rem;">
                <p style="font-size: 13px; color: #64748b; margin-top: 0; margin-bottom: 1rem;">
                    Pilih periode data Rekap DB yang ingin dihapus. Semua data pada periode tersebut akan dihapus secara
                    permanen.
                </p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" for="rekap-db-bulk-delete-month">Bulan</label>
                        <select id="rekap-db-bulk-delete-month" class="form-control">
                            <option value="">Semua Bulan</option>
                            <?php foreach ($monthNames as $num => $name): ?>
                                <option value="<?= $num ?>"><?= $name ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" for="rekap-db-bulk-delete-year">Tahun</label>
                        <select id="rekap-db-bulk-delete-year" class="form-control">
                            <option value="">Semua Tahun</option>
                            <?php for ($y = $currentYear - 1; $y <= $currentYear + 5; $y++): ?>
                                <option value="<?= $y ?>" <?= $y == $currentYear ? 'selected' : '' ?>><?= $y ?></option>
                            <?php endfor; ?>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeRekapDbBulkDeleteModal()">Batal</button>
                <button class="btn btn-danger" id="rekap-db-bulk-delete-submit-btn"
                    onclick="App.submitRekapDbBulkDelete()">Hapus Data</button>
            </div>
        </div>
    </div>

    <!-- Global Auth Configuration -->
    <script>
        window.AUTH_USER = <?= json_encode($currentUser, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
    </script>

    <!-- Scripts -->
    <script src="assets/js/chart.umd.min.js"></script>
    <script src="assets/js/app.js?v=<?= filemtime(__DIR__ . '/assets/js/app.js') ?>"></script>

</body>

</html>