<?php
/**
 * All Summary Page (Admin View)
 * Displays consolidated opname report analytics for ALL sites
 * Features SO Type toggle (Monthly & Quarterly), Achievement Card (All Data),
 * Single Trend Line Chart for All Sites, Scorecard, and full data tables.
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/security.php';

sendSecurityHeaders();

// Redirect cleanly to SPA container with clean URL
if (!isLoggedIn()) {
    $_SESSION['open_login_modal'] = true;
} else {
    $_SESSION['initial_page'] = 'all-summary';
}
header('Location: ./');
exit;

$currentUser = getCurrentUser();
$isLoggedIn = true;
$csrfToken = getCsrfToken();
?>
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>All Summary - Asset Management</title>

    <meta name="description"
        content="Dashboard All Summary Konsolidasi Stock Opname Asset Management - Laporan Seluruh Site">

    <link rel="icon" type="image/svg+xml"
        href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230284c7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='2' y='7' width='20' height='14' rx='2' ry='2'></rect><path d='M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'></path></svg>">

    <!-- Fonts: Inter & JetBrains Mono -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet">

    <!-- Stylesheets -->
    <link rel="stylesheet" href="assets/css/style.css?v=<?= filemtime(__DIR__ . '/assets/css/style.css') ?>">
    <link rel="stylesheet" href="layout/footer.css?v=<?= filemtime(__DIR__ . '/layout/footer.css') ?>">
</head>

<body>

    <!-- Toast Notification Container -->
    <div id="toast-container" class="toast-container"></div>

    <!-- Top Navigation Bar -->
    <header class="navbar">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <a href="all-summary.php" class="navbar-brand">
                Asset Management
            </a>
        </div>

        <!-- Navigation Menus: Admin Navigation (All Summary & Master Data) -->
        <nav class="navbar-menu">
            <button class="nav-link active" data-page="all-summary" id="tab-all-summary">
                All Summary
            </button>
            <a href="reports.php" class="nav-link" id="tab-reports">
                Reports
            </a>
            <a href="berita-acara.php" class="nav-link" id="tab-berita-acara">
                Berita Acara
            </a>
            <a href="master-data.php" class="nav-link" data-page="master-data" id="tab-master-data">
                Master Data
            </a>
        </nav>

        <!-- Navbar Actions: User Dropdown -->
        <div class="navbar-actions">
            <div class="user-dropdown-container" id="user-dropdown-container">
                <button type="button" class="user-dropdown-btn" id="user-dropdown-toggle"
                    onclick="AllSummaryApp.toggleUserDropdown(event)">
                    <div class="user-avatar-circle">
                        <?= strtoupper(substr($currentUser['name'] ?? 'A', 0, 1)) ?>
                    </div>
                    <span class="user-name-text">
                        <?= htmlspecialchars($currentUser['name'] ?? 'Administrator', ENT_QUOTES, 'UTF-8') ?>
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
        <section id="page-all-summary" class="page-section active">

            <!-- ── Unified Dashboard Controls: SO Type & Periode (No Category Switch) ────── -->
            <div class="card sticky-controls-card" id="card-all-summary-controls">
                <div class="card-header sticky-controls-header"
                    style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem; padding: 0.75rem 1.25rem;">
                    <!-- Left: SO Type Toggle Only -->
                    <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">SO
                                TYPE:</span>
                            <div class="summary-type-slider-wrapper">
                                <button type="button" class="summary-type-slider-btn active" id="btn-so-type-monthly"
                                    onclick="AllSummaryApp.switchSOType('monthly')">
                                    <span>Monthly</span>
                                </button>
                                <button type="button" class="summary-type-slider-btn" id="btn-so-type-quarterly"
                                    onclick="AllSummaryApp.switchSOType('quarterly')">
                                    <span>Quarterly</span>
                                </button>
                            </div>
                        </div>
                        <span
                            style="font-size: 11.5px; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 3px 10px; border-radius: 6px;">
                            All Sites Mode
                        </span>
                    </div>

                    <!-- Right: Periode Month & Year Filters -->
                    <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <label for="all-summary-filter-month"
                                style="font-size: 12px; font-weight: 600; color: #475569;">BULAN</label>
                            <select id="all-summary-filter-month" class="form-control unified-filter-select"
                                style="width: auto; padding: 0.3rem 0.65rem; font-size: 12.5px;"
                                onchange="AllSummaryApp.loadAllSummary()">
                                <option value="">Semua Bulan</option>
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
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <label for="all-summary-filter-year"
                                style="font-size: 12px; font-weight: 600; color: #475569;">TAHUN</label>
                            <select id="all-summary-filter-year" class="form-control unified-filter-select"
                                style="width: auto; padding: 0.3rem 0.65rem; font-size: 12.5px;"
                                onchange="AllSummaryApp.loadAllSummary()">
                                <option value="2026" selected>2026</option>
                                <option value="2027">2027</option>
                                <option value="2028">2028</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Card: Executive Summary ── -->
            <div class="card" id="card-executive-summary" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                            <h2 class="card-title" style="margin: 0;">Executive Summary (All Data)</h2>
                            <span id="all-executive-period-badge" class="badge"
                                style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11.5px; padding: 3px 9px; border-radius: 6px; letter-spacing: 0.2px;">
                                September 2026
                            </span>
                        </div>
                    </div>
                </div>
                <div class="card-body" style="padding: 1.25rem;">
                    <!-- ── Executive Summary: 3 Cards Inline (Achievement, Result DB, Status DB) ── -->
                    <div class="executive-all-inline-row" id="card-executive-db-analysis">

                        <!-- ── Card 1: Summary Achievement (All Sites) ── -->
                        <div class="executive-db-col" id="col-achievement"
                            style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                            <div
                                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.65rem;">
                                <div>
                                    <h3
                                        style="margin: 0; font-size: 14.5px; font-weight: 700; color: #1e293b; display: inline-flex; align-items: center; gap: 0.5rem;">
                                        Summary Achievement (All Sites)
                                    </h3>
                                    <div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;"
                                        id="kpi-all-subtext">
                                        Avg All Sites (0 Sites)
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <span id="kpi-all-status" style="display: none;"></span>
                                    <div class="kpi-split-trend" id="kpi-all-trend"></div>
                                </div>
                            </div>
                            <div class="db-status-card"
                                style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.03em;">
                                        PHYSICAL ACHIEVEMENT</div>
                                    <span class="so-status-badge"
                                        style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 6px;">
                                        All Sites
                                    </span>
                                </div>
                                <div style="font-size: 22px; font-weight: 800; color: #0284c7; margin-top: 4px;"
                                    id="kpi-all-achievement">0%</div>
                            </div>
                        </div>

                        <!-- ── Card 2: Result DB Analysis (All Sites) ── -->
                        <div class="executive-db-col" id="col-result-db-analysis"
                            style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                            <div
                                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.65rem;">
                                <div>
                                    <h3
                                        style="margin: 0; font-size: 14.5px; font-weight: 700; color: #1e293b; display: inline-flex; align-items: center; gap: 0.5rem;">
                                        Result DB Analysis (All Sites)
                                    </h3>
                                    <div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;">
                                        Total data DB seluruh site dibanding periode sebelumnya
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <span class="db-grand-trend" id="db-grand-trend"></span>
                                    <span class="so-status-badge"
                                        style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 6px;">
                                        Total DB: <span id="db-analysis-grand-total">0</span> QTY
                                    </span>
                                </div>
                            </div>
                            <div class="db-status-card"
                                style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div
                                        style="font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.03em;">
                                        TOTAL RESULT DB</div>
                                    <span class="db-trend-indicator" id="all-db-card-trend"></span>
                                </div>
                                <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px;"
                                    id="all-db-val-total">0</div>
                            </div>
                        </div>

                        <!-- ── Card 3: Status Penyelesaian DB Summary ── -->
                        <div class="executive-db-col" id="col-status-db-analysis"
                            style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                            <div
                                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.65rem;">
                                <div>
                                    <h3
                                        style="margin: 0; font-size: 14.5px; font-weight: 700; color: #1e293b; display: inline-flex; align-items: center; gap: 0.5rem;">
                                        Status Penyelesaian DB (All Sites)
                                    </h3>
                                    <div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;">
                                        Total data DB seluruh site dibanding periode sebelumnya
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <span class="db-grand-trend" id="all-db-status-grand-trend"></span>
                                    <span class="so-status-badge"
                                        style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 6px;">
                                        Total DB: <span id="all-db-status-grand-total">0</span> QTY
                                    </span>
                                </div>
                            </div>
                            <div
                                style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem;">
                                <div class="db-status-card"
                                    style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.75rem 0.65rem; text-align: center;">
                                    <div
                                        style="font-size: 11px; font-weight: 700; color: #16a34a; letter-spacing: 0.03em;">
                                        SOLVED</div>
                                    <div style="font-size: 20px; font-weight: 800; color: #15803d; margin-top: 4px;"
                                        id="db-status-val-solved">0</div>
                                </div>
                                <div class="db-status-card"
                                    style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.75rem 0.65rem; text-align: center;">
                                    <div
                                        style="font-size: 11px; font-weight: 700; color: #d97706; letter-spacing: 0.03em;">
                                        UNSOLVED</div>
                                    <div style="font-size: 20px; font-weight: 800; color: #b45309; margin-top: 4px;"
                                        id="db-status-val-unsolved">0</div>
                                </div>
                                <div class="db-status-card"
                                    style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.75rem 0.65rem; text-align: center;">
                                    <div
                                        style="font-size: 11px; font-weight: 700; color: #2563eb; letter-spacing: 0.03em;">
                                        NEW DB</div>
                                    <div style="font-size: 20px; font-weight: 800; color: #1d4ed8; margin-top: 4px;"
                                        id="db-status-val-new">0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Card: Score Card Summary (All Sites) ── -->
            <div class="card" id="card-scorecard-summary" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card-header"
                    style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h2 class="card-title">Score Card Summary (All Sites)</h2>
                        <p class="card-subtitle">Evaluasi Rating & SO Execution seluruh site</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <!-- Dept Filter -->
                        <div style="display: flex; align-items: center; gap: 0.45rem;"
                            id="scorecard-dept-filter-container">
                            <label for="scorecard-filter-dept" id="label-scorecard-dept-filter"
                                style="font-size: 12px; font-weight: 600; color: #475569;">DEPT</label>
                            <select id="scorecard-filter-dept" class="form-control unified-filter-select"
                                style="width: auto;" onchange="AllSummaryApp.onScorecardDeptChange()">
                                <option value="all" selected>Semua DEPT</option>
                            </select>
                        </div>
                        <!-- Subdept Filter -->
                        <div style="display: flex; align-items: center; gap: 0.45rem;"
                            id="scorecard-subdept-filter-container">
                            <label for="scorecard-filter-subdept" id="label-scorecard-subdept-filter"
                                style="font-size: 12px; font-weight: 600; color: #475569;">SUB DEPT</label>
                            <select id="scorecard-filter-subdept" class="form-control unified-filter-select"
                                style="width: auto;" onchange="AllSummaryApp.onScorecardSubDeptChange()">
                                <option value="all" selected>Semua Sub Dept</option>
                            </select>
                        </div>
                        <span id="scorecard-total-sites-badge" class="badge"
                            style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11.5px; padding: 4px 10px; border-radius: 6px;">
                            0 Sites Total
                        </span>
                    </div>
                </div>
                <div class="card-body" style="padding: 1.25rem;">
                    <div
                        style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
                        <!-- Rating Pie Card -->
                        <div class="scorecard-subcard" id="scorecard-rating-card"
                            style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
                            <h4
                                style="margin: 0 0 0.75rem 0; font-size: 13px; font-weight: 700; color: #334155; text-align: center;">
                                Rating</h4>
                            <div style="position: relative; height: 180px;">
                                <canvas id="chart-scorecard-rating"></canvas>
                            </div>
                            <div
                                style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem; font-size: 11px;">
                                <span><strong style="color: #16a34a;">Very Good:</strong> <span
                                        id="stat-rating-vg">0</span></span>
                                <span><strong style="color: #3b82f6;">Good:</strong> <span
                                        id="stat-rating-g">0</span></span>
                                <span><strong style="color: #f59e0b;">Moderate:</strong> <span
                                        id="stat-rating-m">0</span></span>
                                <span><strong style="color: #f97316;">Poor:</strong> <span
                                        id="stat-rating-p">0</span></span>
                                <span><strong style="color: #dc2626;">Very Poor:</strong> <span
                                        id="stat-rating-vp">0</span></span>
                            </div>
                        </div>

                        <!-- Execution Pie Card -->
                        <div class="scorecard-subcard" id="scorecard-exec-card"
                            style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
                            <h4
                                style="margin: 0 0 0.75rem 0; font-size: 13px; font-weight: 700; color: #334155; text-align: center;">
                                SO Execution</h4>
                            <div style="position: relative; height: 180px;">
                                <canvas id="chart-scorecard-exec"></canvas>
                            </div>
                            <div
                                style="display: flex; justify-content: center; gap: 1.25rem; margin-top: 0.75rem; font-size: 11.5px;">
                                <span><strong style="color: #16a34a;">Executed:</strong> <span
                                        id="stat-exec-yes">0</span></span>
                                <span><strong style="color: #dc2626;">Not Executed:</strong> <span
                                        id="stat-exec-no">0</span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Card: Trend Line Graphics (Count All - Not Per Dept or Subdept) ── -->
            <div class="card" id="card-trend-all-wrapper" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card-header"
                    style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h3 class="card-title"
                            style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                            Trend Achievement SO (All Data)
                        </h3>
                        <p class="card-subtitle" id="trend-all-subtitle"
                            style="font-size: 0.78rem; color: #64748b; margin-bottom: 0;">
                            Monthly Physical % Jan - Dec 2026 (All Sites)
                        </p>
                    </div>
                    <span class="badge"
                        style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11px; padding: 3px 9px; border-radius: 6px;">
                        All Sites
                    </span>
                </div>
                <div class="card-body" style="padding: 1rem; position: relative;">
                    <div style="position: relative; height: 280px; width: 100%;">
                        <canvas id="chart-trend-all"></canvas>
                    </div>
                </div>
            </div>

            <!-- ── Card: Trend Achievement SO (Division & Warehouse - 3 Months Backdate) ── -->
            <div class="card" id="card-trend-div-wh-wrapper" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card-header"
                    style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem;">
                    <div>
                        <h3 class="card-title"
                            style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                            Grafik Achievement SO
                        </h3>
                        <p class="card-subtitle" id="trend-div-wh-subtitle"
                            style="font-size: 0.78rem; color: #64748b; margin-bottom: 0;">
                            Pencapaian Fisik (%) per Bulan - PMD, CRO, WRO, ERO, HUB & Warehouse Tekno
                        </p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span id="trend-div-wh-badge" class="badge"
                            style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11px; padding: 3px 9px; border-radius: 6px;">
                            3 Months Backdate
                        </span>
                    </div>
                </div>
                <div class="card-body" style="padding: 1rem; position: relative;">
                    <div style="position: relative; height: 380px; width: 100%;">
                        <canvas id="chart-trend-div-wh"></canvas>
                    </div>
                </div>
            </div>

            <!-- ── Card: Report Hasil Stock Opname (All Data) ─────────── -->
            <div class="card" id="card-hasil-so-all" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 class="card-title">Report Hasil Stock Opname (All Data)</h2>
                        <p class="card-subtitle">Hasil pencapaian Stock Opname untuk seluruh site</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                        <!-- Dept Filter -->
                        <select id="all-hasil-filter-dept" class="form-control unified-filter-select"
                            onchange="AllSummaryApp.onAllHasilDeptChange()" style="width: auto;">
                            <option value="all" selected>Semua DEPT</option>
                        </select>

                        <!-- Subdept Filter -->
                        <select id="all-hasil-filter-subdept" class="form-control unified-filter-select"
                            onchange="AllSummaryApp.onAllHasilSubDeptChange()" style="width: auto;">
                            <option value="all" selected>Semua Sub Dept</option>
                        </select>

                        <!-- Status Filter -->
                        <select id="hasil-so-filter-status" class="form-control unified-filter-select"
                            onchange="AllSummaryApp.applyHasilFilter()" style="width: auto;">
                            <option value="all">Semua Status</option>
                            <option value="tercapai">Tercapai</option>
                            <option value="tidak_tercapai">Tidak Tercapai</option>
                            <option value="no_data">Belum Ada Data</option>
                        </select>

                        <!-- Tampilkan Row Data (Page Size) -->
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <label for="hasil-so-page-size"
                                style="font-size: 13px; font-weight: 600; color: #475569; margin: 0; white-space: nowrap;">Tampilkan</label>
                            <select id="hasil-so-page-size" class="form-control unified-filter-select"
                                onchange="AllSummaryApp.changeHasilPageSize(this.value)" style="width: auto;">
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="all">Semua</option>
                            </select>
                        </div>

                        <!-- Search Input -->
                        <input type="search" id="hasil-so-search" class="table-search-input unified-search-input"
                            placeholder="Search..." oninput="AllSummaryApp.applyHasilFilter()"
                            style="max-width: 200px;">
                    </div>
                </div>
                <div class="card-body" style="padding: 1rem 1.25rem;">
                    <div class="so-subdept-layout">
                        <!-- Left: Compact Shrunk Table -->
                        <div class="so-subdept-table-wrapper">
                            <div class="table-responsive"
                                style="max-height: 480px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <table class="table so-subdept-table reconciliation-table"
                                    style="margin-bottom: 0; width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px;">
                                    <thead>
                                        <tr
                                            style="background: #f8fafc; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                                            <th rowspan="2"
                                                style="width: 110px; text-align: center; vertical-align: middle; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                SITE CODE</th>
                                            <th rowspan="2"
                                                style="vertical-align: middle; text-align: left; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                NAME SITE</th>
                                            <th rowspan="2"
                                                style="vertical-align: middle; text-align: left; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                DEPT / SUB DEPT</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                RESULT MATCH</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                RESULT PHYSIC</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                RESULT DB</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                TOTAL PHYSICAL</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                PENCAPAIAN</th>
                                            <th rowspan="2"
                                                style="vertical-align: middle; text-align: center; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; width: 140px; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                STATUS</th>
                                        </tr>
                                        <tr
                                            style="background: #f8fafc; font-size: 10px; color: #64748b; border-bottom: 2px solid #cbd5e1;">
                                            <th
                                                style="text-align: center; padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Physical (QTY)</th>
                                            <th
                                                style="text-align: center; padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Physical (QTY)</th>
                                            <th
                                                style="text-align: center; padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Physical (QTY)</th>
                                            <th
                                                style="text-align: center; padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Target (QTY)</th>
                                            <th
                                                style="text-align: center; padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                %</th>
                                        </tr>
                                    </thead>
                                    <tbody id="hasil-so-table-body">
                                        <tr>
                                            <td colspan="9" style="text-align: center; padding: 2rem; color: #94a3b8;">
                                                Memuat data Report SO...
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <!-- Table Pagination Footer -->
                            <div class="table-pagination-footer"
                                style="margin-top: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <div id="hasil-so-table-info">Menampilkan 0 sampai 0 dari 0 data</div>
                                <div class="pagination-controls" id="hasil-so-pagination-controls"></div>
                            </div>
                        </div>

                        <!-- Right: Pie / Donut Chart for Tercapai vs Tidak Tercapai -->
                        <div class="so-subdept-chart-wrapper">
                            <div class="so-pie-card">
                                <div class="so-pie-header">
                                    <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                        Status Pencapaian</h3>
                                </div>
                                <div class="so-pie-canvas-box">
                                    <canvas id="all-chart-hasil-so-pie"></canvas>
                                </div>
                                <div class="so-pie-stats" id="all-hasil-pie-stats">
                                    <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 0.5rem;">
                                        Memuat grafik...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Card: Rekapitulasi Status DB (All Data) ───────────── -->
            <div class="card" id="card-rekap-status-db" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 class="card-title">Rekapitulasi Status Penyelesaian DB (All Data)</h2>
                        <p class="card-subtitle">Perbandingan status DB (Solved / Unsolved / New DB) seluruh site</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                        <!-- Dept Filter -->
                        <select id="all-rdb-filter-dept" class="form-control unified-filter-select"
                            style="width: auto;" onchange="AllSummaryApp.onAllRdbDeptChange()">
                            <option value="all" selected>Semua DEPT</option>
                        </select>

                        <!-- Subdept Filter -->
                        <select id="all-rdb-filter-subdept" class="form-control unified-filter-select"
                            style="width: auto;" onchange="AllSummaryApp.onAllRdbSubDeptChange()">
                            <option value="all" selected>Semua Sub Dept</option>
                        </select>

                        <!-- Status Filter -->
                        <select id="all-rdb-filter-status" class="form-control unified-filter-select"
                            style="width: auto;" onchange="AllSummaryApp.onAllRdbStatusChange()">
                            <option value="all" selected>Semua Status</option>
                            <option value="solved">Solved DB</option>
                            <option value="unsolved">Unsolved DB</option>
                            <option value="new_db">New DB</option>
                        </select>

                        <!-- Tampilkan Row Data (Page Size) -->
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <label for="all-rdb-page-size"
                                style="font-size: 13px; font-weight: 600; color: #475569; margin: 0; white-space: nowrap;">Tampilkan</label>
                            <select id="all-rdb-page-size" class="form-control unified-filter-select"
                                onchange="AllSummaryApp.changeAllRekapDbStatusPageSize(this.value)" style="width: auto;">
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="all">Semua</option>
                            </select>
                        </div>

                        <!-- Search Input -->
                        <input type="search" id="all-rdb-search-input" class="table-search-input unified-search-input"
                            placeholder="Search..." oninput="AllSummaryApp.handleAllRdbSearch(this.value)"
                            style="max-width: 200px;">
                    </div>
                </div>
                <div class="card-body" style="padding: 1rem;">
                    <div class="table-responsive"
                        style="max-height: 400px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <table class="reconciliation-table" style="margin: 0; font-size: 12px; width: 100%;">
                            <thead>
                                <tr>
                                    <th style="width: 120px; text-align: center;">SITE CODE</th>
                                    <th style="text-align: left;">NAME SITE</th>
                                    <th>DEPT / SUB DEPT</th>
                                    <th style="width: 130px;">REG NO</th>
                                    <th>DESKRIPSI</th>
                                    <th style="width: 100px; text-align: center;">STATUS</th>
                                </tr>
                            </thead>
                            <tbody id="rekap-db-status-tbody">
                                <tr>
                                    <td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">
                                        Memuat data status DB...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!-- Table Pagination Footer -->
                    <div class="table-pagination-footer"
                        style="margin-top: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <div id="all-rdb-status-pagination-info">Menampilkan 0 sampai 0 dari 0 data</div>
                        <div class="pagination-controls" id="all-rdb-status-pagination-controls"></div>
                    </div>
                </div>
            </div>

            <!-- ── Card: Rekapitulasi 2026 (All Sites) ──────────────── -->
            <div class="card" id="card-rekapitulasi" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 class="card-title">Rekapitulasi Stock Opname (All Data)</h2>
                        <p class="card-subtitle">Rekapitulasi persentase seluruh site per bulan</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                        <!-- Dept Filter -->
                        <select id="all-rekap-filter-dept" class="form-control unified-filter-select"
                            style="width: auto;" onchange="AllSummaryApp.onAllRekapDeptChange()">
                            <option value="all" selected>Semua DEPT</option>
                        </select>

                        <!-- Subdept Filter -->
                        <select id="all-rekap-filter-subdept" class="form-control unified-filter-select"
                            style="width: auto;" onchange="AllSummaryApp.onAllRekapSubDeptChange()">
                            <option value="all" selected>Semua Sub Dept</option>
                        </select>

                        <!-- Tampilkan Row Data (Page Size) -->
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <label for="all-rekap-page-size"
                                style="font-size: 13px; font-weight: 600; color: #475569; margin: 0; white-space: nowrap;">Tampilkan</label>
                            <select id="all-rekap-page-size" class="form-control unified-filter-select"
                                onchange="AllSummaryApp.changeRekapPageSize(this.value)" style="width: auto;">
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="all">Semua</option>
                            </select>
                        </div>

                        <!-- Search Input -->
                        <input type="search" id="all-rekap-search" class="table-search-input unified-search-input"
                            placeholder="Search..." oninput="AllSummaryApp.applyRekapFilter()"
                            style="max-width: 200px;">

                        <!-- Export Excel -->
                        <button class="btn btn-success" id="btn-all-rekap-export-excel"
                            onclick="AllSummaryApp.exportRekapExcel()"
                            style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; min-height: 36px; box-sizing: border-box; padding: 0 1rem; border-radius: 8px; font-size: 12.5px; font-weight: 600; line-height: 1;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>Export Excel</span>
                        </button>
                    </div>
                </div>
                <div class="card-body" style="padding: 1rem;">
                    <div class="table-responsive"
                        style="max-height: 480px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <table class="reconciliation-table" style="margin: 0; font-size: 11.5px; width: 100%;">
                            <thead>
                                <tr>
                                    <th style="width: 110px; text-align: center;">SITE CODE</th>
                                    <th style="text-align: left;">NAME SITE</th>
                                    <th>DEPT</th>
                                    <th style="text-align: center;">JAN</th>
                                    <th style="text-align: center;">FEB</th>
                                    <th style="text-align: center;">MAR</th>
                                    <th style="text-align: center;">APR</th>
                                    <th style="text-align: center;">MEI</th>
                                    <th style="text-align: center;">JUN</th>
                                    <th style="text-align: center;">JUL</th>
                                    <th style="text-align: center;">AGU</th>
                                    <th style="text-align: center;">SEP</th>
                                    <th style="text-align: center;">OKT</th>
                                    <th style="text-align: center;">NOV</th>
                                    <th style="text-align: center;">DES</th>
                                </tr>
                            </thead>
                            <tbody id="rekap-table-body">
                                <tr>
                                    <td colspan="16" style="text-align: center; padding: 2rem; color: #94a3b8;">
                                        Memuat data Rekapitulasi...
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot id="rekap-table-foot"></tfoot>
                        </table>
                    </div>
                    <!-- Table Pagination Footer -->
                    <div class="table-pagination-footer"
                        style="margin-top: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <div id="rekap-table-info">Menampilkan 0 sampai 0 dari 0 data</div>
                        <div class="pagination-controls" id="rekap-pagination-controls"></div>
                    </div>
                </div>
            </div>

            <!-- ── Card: Site Movements & Logs ─────────────────────── -->
            <div class="card" id="card-site-movements" style="margin-top: 1.5rem; margin-bottom: 2rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 class="card-title">Pergerakan & Log Site Master Data</h2>
                        <p class="card-subtitle">Log mutasi dan perubahan status master site</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                        <!-- Dept Filter -->
                        <select id="all-sm-filter-dept" class="form-control unified-filter-select"
                            onchange="AllSummaryApp.onAllSmDeptChange()" style="width: auto;">
                            <option value="all" selected>Semua DEPT</option>
                        </select>

                        <!-- Movement Status Filter -->
                        <select id="all-sm-filter-status" class="form-control unified-filter-select"
                            onchange="AllSummaryApp.onAllSmStatusChange()" style="width: auto;">
                            <option value="all" selected>Semua Perubahan</option>
                            <option value="monthly">To Monthly</option>
                            <option value="quarterly">To Quarterly</option>
                            <option value="inactive">To Inactive</option>
                            <option value="uncounted">To Uncounted</option>
                        </select>

                        <!-- Tampilkan Row Data (Page Size) -->
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <label for="all-sm-page-size"
                                style="font-size: 13px; font-weight: 600; color: #475569; margin: 0; white-space: nowrap;">Tampilkan</label>
                            <select id="all-sm-page-size" class="form-control unified-filter-select"
                                onchange="AllSummaryApp.changeAllSmPageSize(this.value)" style="width: auto;">
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="all">Semua</option>
                            </select>
                        </div>

                        <!-- Search Input -->
                        <input type="search" id="sm-search-input" class="table-search-input unified-search-input"
                            placeholder="Search..." oninput="AllSummaryApp.filterMovementsTable()"
                            style="max-width: 200px;">
                    </div>
                </div>
                <div class="card-body" style="padding: 1rem;">
                    <div class="table-responsive"
                        style="max-height: 380px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <table class="reconciliation-table" style="margin: 0; font-size: 12px; width: 100%;">
                            <thead>
                                <tr>
                                    <th style="width: 45px; text-align: center;">NO</th>
                                    <th style="width: 120px; text-align: center;">SITE CODE</th>
                                    <th style="text-align: left;">NAME SITE</th>
                                    <th>DEPT / SUB DEPT</th>
                                    <th style="text-align: center;">LOG HISTORY</th>
                                    <th style="text-align: center; width: 120px;">PERIODE EFEKTIF</th>
                                    <th>KETERANGAN</th>
                                </tr>
                            </thead>
                            <tbody id="sm-table-body">
                                <tr>
                                    <td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">
                                        Memuat data log pergerakan...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!-- Table Pagination Footer -->
                    <div class="table-pagination-footer"
                        style="margin-top: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <div id="all-sm-pagination-info">Menampilkan 0 sampai 0 dari 0 data</div>
                        <div class="pagination-controls" id="all-sm-pagination-controls"></div>
                    </div>
                </div>
            </div>

        </section>
    </main>

    <!-- App Layout Footer -->
    <?php require_once __DIR__ . '/layout/footer.php'; ?>

    <!-- Global Auth Configuration -->
    <script>
        window.AUTH_USER = <?= json_encode($currentUser, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
    </script>

    <!-- Scripts -->
    <script src="assets/js/chart.umd.min.js"></script>
    <script src="assets/js/all_summary.js?v=<?= filemtime(__DIR__ . '/assets/js/all_summary.js') ?>"></script>

</body>

</html>