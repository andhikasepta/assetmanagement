<?php
/**
 * Asset Management - Executive Summary & Analytics
 * Clean Corporate White Layout (Public View)
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/security.php';

sendSecurityHeaders();

// Canonical 301 Redirect: Remove index.php from URL
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$parsedPath = parse_url($requestUri, PHP_URL_PATH);
if (is_string($parsedPath) && (str_ends_with($parsedPath, '/index.php') || $parsedPath === 'index.php')) {
    $cleanPath = preg_replace('#/index\.php$#', '/', $parsedPath);
    if ($cleanPath === '')
        $cleanPath = './';
    $queryString = $_SERVER['QUERY_STRING'] ?? '';
    $targetUrl = $cleanPath . ($queryString !== '' ? '?' . $queryString : '');
    header('Location: ' . $targetUrl, true, 301);
    exit;
}

$currentUser = getCurrentUser();
$isLoggedIn = isLoggedIn();
$csrfToken = getCsrfToken();

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
    <title>Amora - Asset Management Opname Report Analytics</title>

    <!-- Google Fonts: Inter (Enterprise Corporate Typography) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..800;1,14..32,400..700&display=swap"
        rel="stylesheet">

    <!-- Clean Corporate App CSS -->
    <link rel="stylesheet" href="assets/css/style.css?v=<?= filemtime(__DIR__ . '/assets/css/style.css') ?>">
    <link rel="stylesheet" href="layout/footer.css?v=<?= filemtime(__DIR__ . '/layout/footer.css') ?>">
</head>

<body class="<?= (($_SESSION['initial_page'] ?? '') === 'login') ? 'page-is-login' : '' ?>">

    <!-- Toast Notification Container -->
    <div id="toast-container" class="toast-container"></div>

    <!-- Top Navigation Bar (Clean Corporate Header) -->
    <header class="navbar">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <!-- Hamburger Button for Quick Access -->
            <button type="button" class="quick-access-btn" id="btn-quick-access-toggle"
                onclick="App.toggleQuickAccess()" aria-label="Toggle Quick Access">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <a href="javascript:void(0)" onclick="App.navigateTo(window.AUTH_USER ? 'all-summary' : 'summary')"
                class="navbar-brand">
                Asset Management
            </a>
        </div>

        <!-- Navigation Menus: Summary, All Summary, Weekly Summary, Master Data, Master Data Weekly, User Management (SPA) -->
        <nav class="navbar-menu" id="navbar-menu">
            <button type="button" class="nav-link <?= $isLoggedIn ? '' : 'active' ?>" data-page="summary"
                id="tab-summary" onclick="App.navigateTo('summary')" style="<?= $isLoggedIn ? 'display: none;' : '' ?>">
                Summary
            </button>
            <button type="button" class="nav-link <?= $isLoggedIn ? 'active' : '' ?>" data-page="all-summary"
                id="tab-all-summary" onclick="App.navigateTo('all-summary')"
                style="<?= ($isLoggedIn && ($currentUser['permissions']['can_access_all_summary'] ?? true) !== false) ? '' : 'display: none;' ?>">
                All Summary
            </button>
            <button type="button" class="nav-link" data-page="weekly-summary"
                id="tab-weekly-summary" onclick="App.navigateTo('weekly-summary')"
                style="<?= ($isLoggedIn && ($currentUser['permissions']['can_access_weekly_summary'] ?? true) !== false) ? '' : 'display: none;' ?>">
                Weekly Summary
            </button>
            <button type="button" class="nav-link" data-page="master-data" id="tab-master-data"
                onclick="App.navigateTo('master-data')"
                style="<?= ($isLoggedIn && ($currentUser['permissions']['can_access_master_data'] ?? true) !== false) ? '' : 'display: none;' ?>">
                Master Data
            </button>
            <button type="button" class="nav-link" data-page="master-data-weekly" id="tab-master-data-weekly"
                onclick="App.navigateTo('master-data-weekly')"
                style="<?= ($isLoggedIn && ($currentUser['permissions']['can_access_master_data_weekly'] ?? true) !== false) ? '' : 'display: none;' ?>">
                Master Data Weekly
            </button>
            <button type="button" class="nav-link" data-page="user-management" id="tab-user-management"
                onclick="App.navigateTo('user-management')"
                style="<?= ($isLoggedIn && ($currentUser['permissions']['can_access_user_management'] ?? true) !== false) ? '' : 'display: none;' ?>">
                User Management
            </button>
        </nav>

        <!-- Navbar Actions: Public Login Button & Direct Logout Button -->
        <div class="navbar-actions">
            <!-- User Session: Logout Button (Direct, no dropdown) -->
            <button type="button" class="nav-logout-btn" id="btn-navbar-logout"
                onclick="App.logout()" title="Logout"
                style="<?= $isLoggedIn ? 'display: inline-flex;' : 'display: none;' ?>">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Logout</span>
            </button>

            <!-- Public Session: Login Button -->
            <button type="button" class="nav-login-btn" id="btn-navbar-login"
                onclick="App.openLoginModal(sessionStorage.getItem('active_page') || 'summary')"
                style="<?= $isLoggedIn ? 'display: none;' : '' ?>">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10 17 15 12 10 7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                <span>Login</span>
            </button>
        </div>
    </header>

    <!-- Quick Access Drawer & Backdrop (Public & Admin View) -->
    <div id="quick-access-backdrop" class="quick-access-backdrop" onclick="App.closeQuickAccess()"></div>
    <aside id="quick-access-drawer" class="quick-access-drawer" aria-label="Quick Access">
        <div class="quick-access-header">
            <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0;">
                <h3 class="quick-access-title" style="margin: 0; white-space: nowrap;">Quick Access</h3>
                <?php if (!$isLoggedIn): ?>
                    <button type="button" onclick="App.closeQuickAccess(); App.navigateTo('login');"
                        class="btn-quick-access-login" id="drawer-header-login-btn">
                        <span>LOGIN</span>
                    </button>
                <?php endif; ?>
            </div>
            <button type="button" class="quick-access-close" onclick="App.closeQuickAccess()" aria-label="Close">
                &times;
            </button>
        </div>


        <div class="quick-access-body" id="quick-access-nav-list">
            <!-- Populated dynamically with links to cards -->
        </div>
    </aside>

    <!-- Main Application Content -->
    <main class="main-wrapper">
        <section id="page-summary" class="page-section active">
            <!-- ── Unified Dashboard Controls: SO Type, Category & Periode ────── -->
            <div class="card sticky-controls-card" id="card-summary-controls">
                <div class="card-header sticky-controls-header"
                    style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem; padding: 0.75rem 1.25rem;">
                    <!-- Left: SO Type & Category Selectors -->
                    <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
                        <!-- SO Type Toggle -->
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">SO
                                TYPE:</span>
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

                        <!-- Divider -->
                        <div id="summary-controls-divider"
                            style="width: 1px; height: 24px; background: #e2e8f0; display: inline-block;"></div>

                        <!-- Category Toggle -->
                        <div id="summary-cat-slider-card"
                            style="display: inline-flex; align-items: center; gap: 0.6rem; margin: 0; padding: 0; background: transparent; border: none; box-shadow: none;">
                            <span
                                style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">CATEGORY:</span>
                            <!-- Monthly Categories -->
                            <div class="summary-type-slider-wrapper" id="cat-slider-monthly">
                                <button type="button" class="summary-type-slider-btn active" id="btn-summary-cat-pmd"
                                    onclick="App.switchSummaryCategory('pmd')">
                                    <span>PMD</span>
                                </button>
                                <button type="button" class="summary-type-slider-btn" id="btn-summary-cat-outlet"
                                    onclick="App.switchSummaryCategory('outlet')">
                                    <span>Outlet Regional</span>
                                </button>
                                <button type="button" class="summary-type-slider-btn" id="btn-summary-cat-warehouse-m"
                                    onclick="App.switchSummaryCategory('warehouse_hub')">
                                    <span>Warehouse HUB</span>
                                </button>
                                <button type="button" class="summary-type-slider-btn" id="btn-summary-cat-tekno-m"
                                    onclick="App.switchSummaryCategory('warehouse_tekno')">
                                    <span>Warehouse Tekno</span>
                                </button>
                                <button type="button" class="summary-type-slider-btn" id="btn-summary-cat-it"
                                    onclick="App.switchSummaryCategory('it_coorporate')">
                                    <span>IT Coorporate</span>
                                </button>
                            </div>
                            <!-- Quarterly Categories -->
                            <div class="summary-type-slider-wrapper" id="cat-slider-quarterly" style="display: none;">
                                <button type="button" class="summary-type-slider-btn active"
                                    id="btn-summary-cat-subarep" onclick="App.switchSummaryCategory('outlet_subarep')">
                                    <span>Outlet Subarep</span>
                                </button>
                                <button type="button" class="summary-type-slider-btn" id="btn-summary-cat-warehouse"
                                    onclick="App.switchSummaryCategory('warehouse_hub')">
                                    <span>Warehouse HUB</span>
                                </button>
                                <button type="button" class="summary-type-slider-btn" id="btn-summary-cat-tekno-q"
                                    onclick="App.switchSummaryCategory('warehouse_tekno')">
                                    <span>Warehouse Tekno</span>
                                </button>
                            </div>
                            <span style="font-size: 11px; color: #94a3b8; margin-left: 2px;" id="summary-cat-status">
                                (<strong style="color: #9333ea;">PMD</strong> Target 98%)
                            </span>
                        </div>
                    </div>

                    <!-- Right: Periode Month & Year Filters -->
                    <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <label for="summary-filter-month"
                                style="font-size: 12px; font-weight: 600; color: #475569;">BULAN</label>
                            <select id="summary-filter-month" class="form-control unified-filter-select"
                                style="width: auto;" onchange="App.loadSummaryData()">
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
                            <label for="summary-filter-year"
                                style="font-size: 12px; font-weight: 600; color: #475569;">TAHUN</label>
                            <select id="summary-filter-year" class="form-control unified-filter-select"
                                style="width: auto;" onchange="App.loadSummaryData()">
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
                            <h2 class="card-title" style="margin: 0;">Executive Summary</h2>
                            <span id="executive-period-badge" class="badge"
                                style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11.5px; padding: 3px 9px; border-radius: 6px; letter-spacing: 0.2px;">
                                September 2026
                            </span>
                        </div>
                    </div>
                </div>
                <div class="card-body" style="padding: 1.25rem;">
                    <!-- ── Achievement Cards (PMD: PMD, DNO, DSO; Outlet Regional: National, WRO, CRO, ERO) ── -->
                    <div class="kpi-grid" id="achievement-cards" style="margin-bottom: 0;">
                        <!-- PMD Cards (Default Active) -->
                        <div class="kpi-card kpi-card-split" id="kpi-card-pmd">
                            <div class="kpi-title">Summary PMD Achievement</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-pmd-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-pmd-status"></div>
                                    <div class="kpi-split-trend" id="kpi-pmd-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-pmd-subtext">Avg PMD Divisi (0 Sites)</div>
                            </div>
                        </div>
                        <div class="kpi-card kpi-card-split" id="kpi-card-dno">
                            <div class="kpi-title">DNO Achievement</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-dno-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-dno-status"></div>
                                    <div class="kpi-split-trend" id="kpi-dno-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-dno-subtext">Avg DEPT DNO (0 Sites)</div>
                            </div>
                        </div>
                        <div class="kpi-card kpi-card-split" id="kpi-card-dso">
                            <div class="kpi-title">DSO Achievement</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-dso-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-dso-status"></div>
                                    <div class="kpi-split-trend" id="kpi-dso-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-dso-subtext">Avg DEPT DSO (0 Sites)</div>
                            </div>
                        </div>

                        <!-- Outlet Regional Cards (Hidden by default) -->
                        <div class="kpi-card kpi-card-split" id="kpi-card-national" style="display: none;">
                            <div class="kpi-title" id="kpi-national-title">Summary Outlet Regional Achievement</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-national-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-national-status"></div>
                                    <div class="kpi-split-trend" id="kpi-national-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-national-subtext">Avg Outlet Regional (0 Sites)</div>
                            </div>
                        </div>

                        <!-- WRO Group: WRO Card + Subdept Cards (CSO, NSO, SSO) -->
                        <div class="kpi-card-group" id="kpi-group-wro" style="display: none;">
                            <div class="kpi-card kpi-card-split" id="kpi-card-wro">
                                <div class="kpi-title">WRO Achievement</div>
                                <div class="kpi-card-main">
                                    <div class="kpi-split-value" id="kpi-wro-achievement">0%</div>
                                    <div class="kpi-split-badges">
                                        <div class="kpi-status-box" id="kpi-wro-status"></div>
                                        <div class="kpi-split-trend" id="kpi-wro-trend"></div>
                                    </div>
                                </div>
                                <div class="kpi-card-meta">
                                    <div class="kpi-subtext" id="kpi-wro-subtext">Avg DEPT WRO (0 Sites)</div>
                                </div>
                            </div>
                            <div class="kpi-subdept-container">
                                <div class="kpi-subdept-item" id="kpi-subdept-item-cso">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">CSO</span>
                                        <span id="kpi-subdept-trend-cso"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-cso">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-cso">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-cso"></div>
                                </div>
                                <div class="kpi-subdept-item" id="kpi-subdept-item-nso">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">NSO</span>
                                        <span id="kpi-subdept-trend-nso"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-nso">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-nso">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-nso"></div>
                                </div>
                                <div class="kpi-subdept-item" id="kpi-subdept-item-sso">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">SSO</span>
                                        <span id="kpi-subdept-trend-sso"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-sso">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-sso">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-sso"></div>
                                </div>
                            </div>
                        </div>

                        <!-- CRO Group: CRO Card + Subdept Cards (CJDO, EKO, WJO, WKO) -->
                        <div class="kpi-card-group" id="kpi-group-cro" style="display: none;">
                            <div class="kpi-card kpi-card-split" id="kpi-card-cro">
                                <div class="kpi-title">CRO Achievement</div>
                                <div class="kpi-card-main">
                                    <div class="kpi-split-value" id="kpi-cro-achievement">0%</div>
                                    <div class="kpi-split-badges">
                                        <div class="kpi-status-box" id="kpi-cro-status"></div>
                                        <div class="kpi-split-trend" id="kpi-cro-trend"></div>
                                    </div>
                                </div>
                                <div class="kpi-card-meta">
                                    <div class="kpi-subtext" id="kpi-cro-subtext">Avg DEPT CRO (0 Sites)</div>
                                </div>
                            </div>
                            <div class="kpi-subdept-container">
                                <div class="kpi-subdept-item" id="kpi-subdept-item-cjdo">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">CJDO</span>
                                        <span id="kpi-subdept-trend-cjdo"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-cjdo">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-cjdo">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-cjdo"></div>
                                </div>
                                <div class="kpi-subdept-item" id="kpi-subdept-item-eko">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">EKO</span>
                                        <span id="kpi-subdept-trend-eko"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-eko">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-eko">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-eko"></div>
                                </div>
                                <div class="kpi-subdept-item" id="kpi-subdept-item-wjo">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">WJO</span>
                                        <span id="kpi-subdept-trend-wjo"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-wjo">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-wjo">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-wjo"></div>
                                </div>
                                <div class="kpi-subdept-item" id="kpi-subdept-item-wko">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">WKO</span>
                                        <span id="kpi-subdept-trend-wko"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-wko">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-wko">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-wko"></div>
                                </div>
                            </div>
                        </div>

                        <!-- ERO Group: ERO Card + Subdept Cards (BNO, EJO, MPO, SMO) -->
                        <div class="kpi-card-group" id="kpi-group-ero" style="display: none;">
                            <div class="kpi-card kpi-card-split" id="kpi-card-ero">
                                <div class="kpi-title">ERO Achievement</div>
                                <div class="kpi-card-main">
                                    <div class="kpi-split-value" id="kpi-ero-achievement">0%</div>
                                    <div class="kpi-split-badges">
                                        <div class="kpi-status-box" id="kpi-ero-status"></div>
                                        <div class="kpi-split-trend" id="kpi-ero-trend"></div>
                                    </div>
                                </div>
                                <div class="kpi-card-meta">
                                    <div class="kpi-subtext" id="kpi-ero-subtext">Avg DEPT ERO (0 Sites)</div>
                                </div>
                            </div>
                            <div class="kpi-subdept-container">
                                <div class="kpi-subdept-item" id="kpi-subdept-item-bno">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">BNO</span>
                                        <span id="kpi-subdept-trend-bno"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-bno">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-bno">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-bno"></div>
                                </div>
                                <div class="kpi-subdept-item" id="kpi-subdept-item-ejo">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">EJO</span>
                                        <span id="kpi-subdept-trend-ejo"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-ejo">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-ejo">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-ejo"></div>
                                </div>
                                <div class="kpi-subdept-item" id="kpi-subdept-item-mpo">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">MPO</span>
                                        <span id="kpi-subdept-trend-mpo"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-mpo">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-mpo">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-mpo"></div>
                                </div>
                                <div class="kpi-subdept-item" id="kpi-subdept-item-smo">
                                    <div class="kpi-subdept-header">
                                        <span class="kpi-subdept-name">SMO</span>
                                        <span id="kpi-subdept-trend-smo"></span>
                                    </div>
                                    <div class="kpi-subdept-val" id="kpi-subdept-val-smo">0%</div>
                                    <div class="kpi-subdept-meta" id="kpi-subdept-meta-smo">0 Sites</div>
                                    <div class="kpi-subdept-status" id="kpi-subdept-status-smo"></div>
                                </div>
                            </div>
                        </div>

                        <!-- IT Corporate Cards (Shown only when Category is IT Coorporate) -->
                        <div class="kpi-card kpi-card-split" id="kpi-card-it-tbs" style="display: none;">
                            <div class="kpi-title">OUTLET OPTI TBS</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-it-tbs-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-it-tbs-status"></div>
                                    <div class="kpi-split-trend" id="kpi-it-tbs-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-it-tbs-subtext">50002001384</div>
                            </div>
                        </div>

                        <div class="kpi-card kpi-card-split" id="kpi-card-it-arcadia" style="display: none;">
                            <div class="kpi-title">OUTLET OPTI - IT CORPORATE - ARCADIA LT 4</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-it-arcadia-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-it-arcadia-status"></div>
                                    <div class="kpi-split-trend" id="kpi-it-arcadia-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-it-arcadia-subtext">50002003133</div>
                            </div>
                        </div>

                        <!-- Warehouse Tekno Monthly Cards (Shown when Category is Warehouse Tekno & SO Type is Monthly) -->
                        <div class="kpi-card kpi-card-split" id="kpi-card-tekno-gudang" style="display: none;">
                            <div class="kpi-title">GUDANG WAREHOUSE TEKNO</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-tekno-gudang-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-tekno-gudang-status"></div>
                                    <div class="kpi-split-trend" id="kpi-tekno-gudang-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-tekno-gudang-subtext">50002003289</div>
                            </div>
                        </div>

                        <div class="kpi-card kpi-card-split" id="kpi-card-tekno-khusus" style="display: none;">
                            <div class="kpi-title">PENYIMPANAN PERANGKAT
                                KHUSUS T TEKNO</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-tekno-khusus-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-tekno-khusus-status"></div>
                                    <div class="kpi-split-trend" id="kpi-tekno-khusus-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-tekno-khusus-subtext">50002003307</div>
                            </div>
                        </div>

                        <!-- Warehouse Tekno Quarterly Cards (Shown when Category is Warehouse Tekno & SO Type is Quarterly) -->
                        <div class="kpi-card kpi-card-split" id="kpi-card-tekno-buffer" style="display: none;">
                            <div class="kpi-title">BUFFER PERANGKAT
                                RUSAK WAREHOUSE T TEKNO</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-tekno-buffer-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-tekno-buffer-status"></div>
                                    <div class="kpi-split-trend" id="kpi-tekno-buffer-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-tekno-buffer-subtext">50002003305</div>
                            </div>
                        </div>

                        <div class="kpi-card kpi-card-split" id="kpi-card-tekno-storage2" style="display: none;">
                            <div class="kpi-title">STORAGE END OF
                                CYCLE LT.2 WAREHOUSE TEKNO</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-tekno-storage2-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-tekno-storage2-status"></div>
                                    <div class="kpi-split-trend" id="kpi-tekno-storage2-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-tekno-storage2-subtext">50002003448</div>
                            </div>
                        </div>

                        <div class="kpi-card kpi-card-split" id="kpi-card-tekno-storage1" style="display: none;">
                            <div class="kpi-title">STORAGE END OF
                                CYCLE LT.1 WAREHOUSE TEKNO</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-tekno-storage1-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-tekno-storage1-status"></div>
                                    <div class="kpi-split-trend" id="kpi-tekno-storage1-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-tekno-storage1-subtext">50002003922</div>
                            </div>
                        </div>

                        <div class="kpi-card kpi-card-split" id="kpi-card-tekno-persiapan" style="display: none;">
                            <div class="kpi-title">PERSIAPAN PENGUJIAN
                                WAREHOUSE T TEKNO</div>
                            <div class="kpi-card-main">
                                <div class="kpi-split-value" id="kpi-tekno-persiapan-achievement">0%</div>
                                <div class="kpi-split-badges">
                                    <div class="kpi-status-box" id="kpi-tekno-persiapan-status"></div>
                                    <div class="kpi-split-trend" id="kpi-tekno-persiapan-trend"></div>
                                </div>
                            </div>
                            <div class="kpi-card-meta">
                                <div class="kpi-subtext" id="kpi-tekno-persiapan-subtext">50002003599</div>
                            </div>
                        </div>
                    </div>

                    <!-- ── DB Analysis Row: Result DB Analysis (Left) + Status Penyelesaian DB (Right) ── -->
                    <div class="executive-db-row" id="card-executive-db-analysis">

                        <!-- Left Column: Result DB Analysis (1 Card per Dept Vertikal) -->
                        <div class="executive-db-col" id="col-result-db-analysis">
                            <div
                                style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.65rem;">
                                <div>
                                    <h3
                                        style="margin: 0; font-size: 14.5px; font-weight: 700; color: #1e293b; display: inline-flex; align-items: center; gap: 0.5rem;">
                                        Result DB Analysis
                                    </h3>
                                    <div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;">
                                        Perbandingan data DB dengan periode sebelumnya
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

                            <div id="db-analysis-content" class="db-analysis-scroll">
                                <!-- WRO Group: WRO Card + Subdept Cards (CSO, NSO, SSO) -->
                                <div class="kpi-card-group" id="db-group-wro">
                                    <div class="kpi-card kpi-card-split" id="db-card-wro">
                                        <div class="kpi-title">WRO Result DB</div>
                                        <div class="kpi-card-main">
                                            <div class="kpi-split-value" id="db-val-wro" style="color: #0f172a;">0</div>
                                            <div class="kpi-split-badges">
                                                <span class="db-dept-trend" id="db-trend-wro"></span>
                                            </div>
                                        </div>
                                        <div class="kpi-card-meta">
                                            <div class="kpi-subtext" id="db-subtext-wro">Avg DEPT WRO (0/0 Sites)</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container">
                                        <div class="kpi-subdept-item" id="db-subdept-item-cso">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">CSO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-cso"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-cso">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-cso">0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item" id="db-subdept-item-nso">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">NSO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-nso"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-nso">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-nso">0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item" id="db-subdept-item-sso">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">SSO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-sso"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-sso">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-sso">0 Sites</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- CRO Group: CRO Card + Subdept Cards (CJDO, EKO, WJO, WKO) -->
                                <div class="kpi-card-group" id="db-group-cro">
                                    <div class="kpi-card kpi-card-split" id="db-card-cro">
                                        <div class="kpi-title">CRO Result DB</div>
                                        <div class="kpi-card-main">
                                            <div class="kpi-split-value" id="db-val-cro" style="color: #0f172a;">0</div>
                                            <div class="kpi-split-badges">
                                                <span class="db-dept-trend" id="db-trend-cro"></span>
                                            </div>
                                        </div>
                                        <div class="kpi-card-meta">
                                            <div class="kpi-subtext" id="db-subtext-cro">Avg DEPT CRO (0/0 Sites)</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container">
                                        <div class="kpi-subdept-item" id="db-subdept-item-cjdo">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">CJDO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-cjdo"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-cjdo">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-cjdo">0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item" id="db-subdept-item-eko">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">EKO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-eko"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-eko">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-eko">0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item" id="db-subdept-item-wjo">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">WJO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-wjo"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-wjo">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-wjo">0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item" id="db-subdept-item-wko">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">WKO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-wko"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-wko">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-wko">0 Sites</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- ERO Group: ERO Card + Subdept Cards (BNO, EJO, MPO, SMO) -->
                                <div class="kpi-card-group" id="db-group-ero">
                                    <div class="kpi-card kpi-card-split" id="db-card-ero">
                                        <div class="kpi-title">ERO Result DB</div>
                                        <div class="kpi-card-main">
                                            <div class="kpi-split-value" id="db-val-ero" style="color: #0f172a;">0</div>
                                            <div class="kpi-split-badges">
                                                <span class="db-dept-trend" id="db-trend-ero"></span>
                                            </div>
                                        </div>
                                        <div class="kpi-card-meta">
                                            <div class="kpi-subtext" id="db-subtext-ero">Avg DEPT ERO (0/0 Sites)</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container">
                                        <div class="kpi-subdept-item" id="db-subdept-item-bno">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">BNO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-bno"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-bno">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-bno">0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item" id="db-subdept-item-ejo">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">EJO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-ejo"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-ejo">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-ejo">0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item" id="db-subdept-item-mpo">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">MPO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-mpo"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-mpo">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-mpo">0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item" id="db-subdept-item-smo">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">SMO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-smo"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-smo">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-smo">0 Sites</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- PMD Group: PMD Card + Subdept Cards (DNO, DSO) -->
                                <div class="kpi-card-group" id="db-group-pmd" style="display: none;">
                                    <div class="kpi-card kpi-card-split" id="db-card-pmd">
                                        <div class="kpi-title" style="color: #7e22ce;">PMD Result DB</div>
                                        <div class="kpi-card-main">
                                            <div class="kpi-split-value" id="db-val-pmd" style="color: #0f172a;">0</div>
                                            <div class="kpi-split-badges">
                                                <span class="db-dept-trend" id="db-trend-pmd"></span>
                                            </div>
                                        </div>
                                        <div class="kpi-card-meta">
                                            <div class="kpi-subtext" id="db-subtext-pmd">Avg PMD Divisi (0/0 Sites)
                                            </div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container">
                                        <div class="kpi-subdept-item" id="db-subdept-item-dno">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">DNO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-dno"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-dno">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-dno">0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item" id="db-subdept-item-dso">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">DSO</span>
                                                <span class="db-subdept-trend" id="db-subdept-trend-dso"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-subdept-val-dso">0</div>
                                            <div class="kpi-subdept-meta" id="db-subdept-meta-dso">0 Sites</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- IT Corporate DB Group (2 Sites: OUTLET OPTI TBS & OUTLET OPTI - IT CORPORATE - ARCADIA LT 4) -->
                                <div class="kpi-card-group" id="db-group-it"
                                    style="display: none; flex-direction: column; gap: 0.75rem;">
                                    <div class="kpi-card kpi-card-split" id="db-card-it-tbs">
                                        <div class="kpi-title">OUTLET OPTI TBS</div>
                                        <div class="kpi-card-main">
                                            <div class="kpi-split-value" id="db-val-it-tbs" style="color: #0f172a;">0
                                            </div>
                                            <div class="kpi-split-badges">
                                                <span class="db-dept-trend" id="db-trend-it-tbs"></span>
                                            </div>
                                        </div>
                                        <div class="kpi-card-meta">
                                            <div class="kpi-subtext" id="db-subtext-it-tbs">50002001384</div>
                                        </div>
                                    </div>
                                    <div class="kpi-card kpi-card-split" id="db-card-it-arcadia">
                                        <div class="kpi-title">OUTLET OPTI - IT CORPORATE - ARCADIA LT 4</div>
                                        <div class="kpi-card-main">
                                            <div class="kpi-split-value" id="db-val-it-arcadia" style="color: #0f172a;">
                                                0</div>
                                            <div class="kpi-split-badges">
                                                <span class="db-dept-trend" id="db-trend-it-arcadia"></span>
                                            </div>
                                        </div>
                                        <div class="kpi-card-meta">
                                            <div class="kpi-subtext" id="db-subtext-it-arcadia">50002003133</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Warehouse Tekno DB Group (Tekno Sites Cards) -->
                                <div class="kpi-card-group" id="db-group-tekno"
                                    style="display: none; flex-direction: column; gap: 0.75rem;">
                                    <div id="db-tekno-cards-container"
                                        style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Status Penyelesaian DB (1 Card per Status Vertikal) -->
                        <div class="executive-db-col" id="col-status-db-analysis">
                            <div class="db-status-section-header">
                                <div>
                                    <h3
                                        style="margin: 0; font-size: 14.5px; font-weight: 700; color: #1e293b; display: inline-flex; align-items: center; gap: 0.5rem;">
                                        Status Penyelesaian DB
                                    </h3>
                                    <div style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;">
                                        Distribusi status penyelesaian data DB dengan periode sebelumnya
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <span class="db-grand-trend" id="db-status-grand-trend"></span>
                                    <span class="so-status-badge"
                                        style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 6px;">
                                        Total DB: <span id="db-status-grand-total">0</span> QTY
                                    </span>
                                </div>
                            </div>

                            <div class="db-status-groups-container" id="db-status-groups-container">
                                <!-- Solved DB Group -->
                                <div class="kpi-card-group" id="db-status-group-solved">
                                    <div class="kpi-card kpi-card-split" id="db-card-solved">
                                        <div class="kpi-title" style="color: #166534;">SOLVED DB</div>
                                        <div class="kpi-card-main">
                                            <div class="kpi-split-value" id="db-grand-solved" style="color: #16a34a;">0
                                            </div>
                                            <div class="kpi-split-badges">
                                                <span class="db-dept-trend" id="db-trend-solved"></span>
                                            </div>
                                        </div>
                                        <div class="kpi-card-meta">
                                            <div class="kpi-subtext" id="db-subtext-solved">0/0 Sites</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-outlet">
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">WRO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-solved-wro"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-solved-wro" style="color: #16a34a;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-solved-wro">0/0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">CRO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-solved-cro"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-solved-cro" style="color: #16a34a;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-solved-cro">0/0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">ERO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-solved-ero"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-solved-ero" style="color: #16a34a;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-solved-ero">0/0 Sites</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-pmd" style="display: none;">
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">DNO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-solved-dno"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-solved-dno" style="color: #16a34a;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-solved-dno">0/0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">DSO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-solved-dso"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-solved-dso" style="color: #16a34a;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-solved-dso">0/0 Sites</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-it"
                                        style="display: none; grid-template-columns: repeat(2, minmax(0, 1fr));">
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">OUTLET OPTI
                                                    TBS</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-solved-it-tbs"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-solved-it-tbs" style="color: #16a34a;">0
                                            </div>
                                            <div class="kpi-subdept-meta">50002001384</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">OUTLET OPTI - IT
                                                    CORPORATE - ARCADIA LT 4</span>
                                                <span class="db-subdept-trend"
                                                    id="db-sub-trend-solved-it-arcadia"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-solved-it-arcadia"
                                                style="color: #16a34a;">0</div>
                                            <div class="kpi-subdept-meta">50002003133</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-tekno"
                                        id="db-status-sub-tekno-solved"
                                        style="display: none; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
                                    </div>
                                </div>

                                <!-- Unsolved DB Group -->
                                <div class="kpi-card-group" id="db-status-group-unsolved">
                                    <div class="kpi-card kpi-card-split" id="db-card-unsolved">
                                        <div class="kpi-title" style="color: #991b1b;">UNSOLVED DB</div>
                                        <div class="kpi-card-main">
                                            <div class="kpi-split-value" id="db-grand-unsolved" style="color: #dc2626;">
                                                0</div>
                                            <div class="kpi-split-badges">
                                                <span class="db-dept-trend" id="db-trend-unsolved"></span>
                                            </div>
                                        </div>
                                        <div class="kpi-card-meta">
                                            <div class="kpi-subtext" id="db-subtext-unsolved">0/0 Sites</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-outlet">
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">WRO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-unsolved-wro"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-unsolved-wro" style="color: #dc2626;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-unsolved-wro">0/0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">CRO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-unsolved-cro"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-unsolved-cro" style="color: #dc2626;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-unsolved-cro">0/0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">ERO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-unsolved-ero"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-unsolved-ero" style="color: #dc2626;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-unsolved-ero">0/0 Sites</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-pmd" style="display: none;">
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">DNO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-unsolved-dno"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-unsolved-dno" style="color: #dc2626;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-unsolved-dno">0/0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">DSO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-unsolved-dso"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-unsolved-dso" style="color: #dc2626;">0
                                            </div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-unsolved-dso">0/0 Sites</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-it"
                                        style="display: none; grid-template-columns: repeat(2, minmax(0, 1fr));">
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">OUTLET OPTI
                                                    TBS</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-unsolved-it-tbs"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-unsolved-it-tbs"
                                                style="color: #dc2626;">0</div>
                                            <div class="kpi-subdept-meta">50002001384</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">OUTLET OPTI - IT
                                                    CORPORATE - ARCADIA LT 4</span>
                                                <span class="db-subdept-trend"
                                                    id="db-sub-trend-unsolved-it-arcadia"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-unsolved-it-arcadia"
                                                style="color: #dc2626;">0</div>
                                            <div class="kpi-subdept-meta">50002003133</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-tekno"
                                        id="db-status-sub-tekno-unsolved"
                                        style="display: none; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
                                    </div>
                                </div>

                                <!-- New DB Group -->
                                <div class="kpi-card-group" id="db-status-group-new">
                                    <div class="kpi-card kpi-card-split" id="db-card-new">
                                        <div class="kpi-title" style="color: #1e40af;">NEW DB</div>
                                        <div class="kpi-card-main">
                                            <div class="kpi-split-value" id="db-grand-new" style="color: #2563eb;">0
                                            </div>
                                            <div class="kpi-split-badges">
                                                <span class="db-dept-trend" id="db-trend-new"></span>
                                            </div>
                                        </div>
                                        <div class="kpi-card-meta">
                                            <div class="kpi-subtext" id="db-subtext-new">0/0 Sites</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-outlet">
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">WRO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-new-wro"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-new-wro" style="color: #2563eb;">0</div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-new-wro">0/0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">CRO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-new-cro"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-new-cro" style="color: #2563eb;">0</div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-new-cro">0/0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">ERO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-new-ero"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-new-ero" style="color: #2563eb;">0</div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-new-ero">0/0 Sites</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-pmd" style="display: none;">
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">DNO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-new-dno"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-new-dno" style="color: #2563eb;">0</div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-new-dno">0/0 Sites</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">DSO</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-new-dso"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-new-dso" style="color: #2563eb;">0</div>
                                            <div class="kpi-subdept-meta" id="db-sub-sites-new-dso">0/0 Sites</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-it"
                                        style="display: none; grid-template-columns: repeat(2, minmax(0, 1fr));">
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">OUTLET OPTI
                                                    TBS</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-new-it-tbs"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-new-it-tbs" style="color: #2563eb;">0
                                            </div>
                                            <div class="kpi-subdept-meta">50002001384</div>
                                        </div>
                                        <div class="kpi-subdept-item">
                                            <div class="kpi-subdept-header">
                                                <span class="kpi-subdept-name">OUTLET OPTI - IT
                                                    CORPORATE - ARCADIA LT 4</span>
                                                <span class="db-subdept-trend" id="db-sub-trend-new-it-arcadia"></span>
                                            </div>
                                            <div class="kpi-subdept-val" id="db-new-it-arcadia" style="color: #2563eb;">
                                                0</div>
                                            <div class="kpi-subdept-meta">50002003133</div>
                                        </div>
                                    </div>
                                    <div class="kpi-subdept-container db-status-sub-tekno" id="db-status-sub-tekno-new"
                                        style="display: none; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- ── Catatan dan Evaluasi Hasil Stock Opname (Full Width di Bawah Kedua Card DB) ── -->
                <div class="executive-catatan-row" id="executive-bottom-row">
                    <div id="card-executive-catatan">
                        <div
                            style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                            <div>
                                <h3
                                    style="margin: 0; font-size: 14.5px; font-weight: 700; color: #1e293b; display: inline-flex; align-items: center; gap: 0.5rem;">
                                    Catatan dan Evaluasi Hasil Stock Opname
                                </h3>
                                <div id="exec-catatan-subtitle"
                                    style="font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px;">
                                    Kesimpulan hasil evaluasi stock opname
                                </div>
                            </div>
                        </div>
                        <div class="table-responsive"
                            style="border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);">
                            <table class="reconciliation-table" id="exec-catatan-table" style="margin: 0;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        <th style="width: 38px; text-align: center;">NO</th>
                                        <th class="sortable text-center" style="width: 95px;"
                                            id="exec-catatan-th-period" onclick="App.toggleExecCatatanSort('period')">
                                            BULAN <span class="sort-indicator" data-ecat-col="period">⇅</span>
                                        </th>
                                        <th class="sortable text-center" style="width: 75px;"
                                            onclick="App.toggleExecCatatanSort('dept')">
                                            <span id="exec-catatan-th-dept">DIVISI</span> <span class="sort-indicator"
                                                data-ecat-col="dept">⇅</span>
                                        </th>
                                        <th class="sortable text-center" style="width: 90px;"
                                            onclick="App.toggleExecCatatanSort('sub_dept')">
                                            <span id="exec-catatan-th-subdept">DEPT</span> <span class="sort-indicator"
                                                data-ecat-col="sub_dept">⇅</span>
                                        </th>
                                        <th class="sortable text-left"
                                            onclick="App.toggleExecCatatanSort('keterangan')">
                                            KETERANGAN <span class="sort-indicator" data-ecat-col="keterangan">⇅</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody id="exec-catatan-tbody">
                                    <tr>
                                        <td colspan="5" class="text-center" style="padding: 2.2rem; color: #94a3b8;">
                                            Memuat catatan...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            <!-- ── Card: Score Card Summary ── -->
            <div class="card" id="card-scorecard-summary" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <h2 class="card-title" style="margin: 0;">Score Card Summary</h2>
                    </div>
                </div>

                <!-- <div class="card-body" style="padding: 0;">
                        <div style="padding: 1rem 1.25rem 0.35rem 1.25rem;">
                            <span class="span-danger badge-danger danger" id="scorecard-default-filter-notice"
                                style="display: flex; align-items: center; gap: 0.65rem; padding: 0.7rem 1.1rem; font-size: 13px; font-weight: 600; line-height: 1.45; color: #991b1b; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
                                    style="flex-shrink: 0; color: #dc2626;">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                                <span>Default Filter : Rating Very Poor dan Status Not Executed<br>
                                    Bertujuan agar dapat menjadi perhatian
                                    khusus kepada pimpinan area dan dilakukan analisis mendalam untuk identifikasi
                                    penyebab
                                    serta menyiapkan
                                    langkah perbaikan yang diperlukan.
                                </span>
                        </div> -->

                <!-- Top Grid: Rating Summary & SO Execution Summary (Selected Period) -->
                <div class="scorecard-grid" style="padding-bottom: 0.5rem;">
                    <!-- Sub-Card 1: Rating -->
                    <div class="scorecard-subcard" id="scorecard-rating-card">
                        <div class="scorecard-subcard-header">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a;">Rating
                                        Summary</h3>
                                    <span id="scorecard-rating-period-badge" class="badge"
                                        style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11px; padding: 2.5px 7px; border-radius: 6px;">
                                        September 2026
                                    </span>
                                </div>
                                <p style="margin: 1px 0 0 0; font-size: 10.5px; color: #64748b;"
                                    id="scorecard-rating-subtitle">Evaluasi performa
                                    SO Sites periode terpilih</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.35rem;">
                                <label for="scorecard-rating-filter"
                                    style="font-size: 10.5px; font-weight: 600; color: #64748b; margin: 0;">Rating:</label>
                                <select id="scorecard-rating-filter" class="form-control form-control-sm"
                                    style="font-size: 11.5px; padding: 2px 6px; width: auto; min-width: 115px; height: 26px;"
                                    onchange="App.onScorecardRatingFilterChange(this.value)">
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
                            <!-- Top: Chart Section -->
                            <div class="scorecard-top-chart-section scorecard-bottom-chart-section"
                                style="margin-top: 0; margin-bottom: 0.85rem;">
                                <div class="scorecard-bottom-chart-box">
                                    <canvas id="chart-scorecard-rating-pie"></canvas>
                                </div>
                                <div class="scorecard-bottom-stats" id="scorecard-rating-pie-stats">
                                    <div
                                        style="font-size: 10.5px; font-weight: 700; color: #475569; margin-bottom: 2px;">
                                        Rating:</div>
                                    <div class="scorecard-pie-stat-row" data-rating="very_good"
                                        onclick="App.toggleScorecardRatingFilter('very_good')">
                                        <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                                style="background: #047857;"></span>Very Good</span>
                                        <span class="scorecard-pie-stat-val" id="sc-stat-vg">0 sites (0%)</span>
                                    </div>
                                    <div class="scorecard-pie-stat-row" data-rating="good"
                                        onclick="App.toggleScorecardRatingFilter('good')">
                                        <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                                style="background: #0284c7;"></span>Good</span>
                                        <span class="scorecard-pie-stat-val" id="sc-stat-g">0 sites (0%)</span>
                                    </div>
                                    <div class="scorecard-pie-stat-row" data-rating="moderate"
                                        onclick="App.toggleScorecardRatingFilter('moderate')">
                                        <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                                style="background: #d97706;"></span>Moderate</span>
                                        <span class="scorecard-pie-stat-val" id="sc-stat-m">0 sites (0%)</span>
                                    </div>
                                    <div class="scorecard-pie-stat-row" data-rating="poor"
                                        onclick="App.toggleScorecardRatingFilter('poor')">
                                        <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                                style="background: #ea580c;"></span>Poor</span>
                                        <span class="scorecard-pie-stat-val" id="sc-stat-p">0 sites (0%)</span>
                                    </div>
                                    <div class="scorecard-pie-stat-row" data-rating="very_poor"
                                        onclick="App.toggleScorecardRatingFilter('very_poor')">
                                        <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                                style="background: #b91c1c;"></span>Very Poor</span>
                                        <span class="scorecard-pie-stat-val" id="sc-stat-vp">0 sites (0%)</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Bottom: Table -->
                            <div class="scorecard-table-wrapper">
                                <div class="table-responsive"
                                    style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                                    <table class="reconciliation-table scorecard-table">
                                        <thead>
                                            <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                <th class="scorecard-col-no">NO</th>
                                                <th class="scorecard-col-subdept">DEPT</th>
                                                <th class="scorecard-col-sitecode">SITE CODE</th>
                                                <th class="scorecard-col-namesite">NAMA SITE</th>
                                                <th id="sc-rating-th-selected" class="scorecard-col-month">FISIK %
                                                </th>
                                                <th class="scorecard-col-status">RATING</th>
                                            </tr>
                                        </thead>
                                        <tbody id="scorecard-rating-tbody">
                                            <tr>
                                                <td colspan="6" class="text-center"
                                                    style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                                                    <div
                                                        style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">
                                                        No data
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sub-Card 2: SO Execution -->
                    <div class="scorecard-subcard" id="scorecard-exec-card">
                        <div class="scorecard-subcard-header">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a;">SO
                                        Execution Summary</h3>
                                    <span id="scorecard-exec-period-badge" class="badge"
                                        style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11px; padding: 2.5px 7px; border-radius: 6px;">
                                        September 2026
                                    </span>
                                </div>
                                <p style="margin: 1px 0 0 0; font-size: 10.5px; color: #64748b;"
                                    id="scorecard-exec-subtitle">Status eksekusi SO
                                    Sites periode terpilih</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.35rem;">
                                <label for="scorecard-execution-filter"
                                    style="font-size: 10.5px; font-weight: 600; color: #64748b; margin: 0;">Status:</label>
                                <select id="scorecard-execution-filter" class="form-control form-control-sm"
                                    style="font-size: 11.5px; padding: 2px 6px; width: auto; min-width: 120px; height: 26px;"
                                    onchange="App.onScorecardExecutionFilterChange(this.value)">
                                    <option value="all">Semua Status</option>
                                    <option value="executed">Executed</option>
                                    <option value="not_executed" selected>Not Executed</option>
                                </select>
                            </div>
                        </div>
                        <div class="scorecard-subcard-body">
                            <!-- Top: Chart Section -->
                            <div class="scorecard-top-chart-section scorecard-bottom-chart-section"
                                style="margin-top: 0; margin-bottom: 0.85rem;">
                                <div class="scorecard-bottom-chart-box">
                                    <canvas id="chart-scorecard-exec-pie"></canvas>
                                </div>
                                <div class="scorecard-bottom-stats" id="scorecard-exec-pie-stats">
                                    <div
                                        style="font-size: 10.5px; font-weight: 700; color: #475569; margin-bottom: 2px;">
                                        Status Eksekusi:</div>
                                    <div class="scorecard-pie-stat-row" data-exec="executed"
                                        onclick="App.toggleScorecardExecutionFilter('executed')">
                                        <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                                style="background: #047857;"></span>Executed</span>
                                        <span class="scorecard-pie-stat-val" id="sc-stat-exec">0 sites (0%)</span>
                                    </div>
                                    <div class="scorecard-pie-stat-row" data-exec="not_executed"
                                        onclick="App.toggleScorecardExecutionFilter('not_executed')">
                                        <span class="scorecard-pie-stat-label"><span class="scorecard-pie-stat-dot"
                                                style="background: #b91c1c;"></span>Not Executed</span>
                                        <span class="scorecard-pie-stat-val" id="sc-stat-not-exec">0 sites
                                            (0%)</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Bottom: Table -->
                            <div class="scorecard-table-wrapper">
                                <div class="table-responsive"
                                    style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                                    <table class="reconciliation-table scorecard-table">
                                        <thead>
                                            <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                <th class="scorecard-col-no">NO</th>
                                                <th class="scorecard-col-subdept">DEPT</th>
                                                <th class="scorecard-col-sitecode">SITE CODE</th>
                                                <th class="scorecard-col-namesite">NAMA SITE</th>
                                                <th id="sc-exec-th-selected" class="scorecard-col-month">FISIK %
                                                </th>
                                                <th class="scorecard-col-status">STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody id="scorecard-exec-tbody">
                                            <tr>
                                                <td colspan="6" class="text-center"
                                                    style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                                                    <div
                                                        style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">
                                                        No data
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bottom Sub-Card: Stock Opname Rating (3 Months Backdate in 3 Separate Tables) -->
                <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
                    <div class="scorecard-subcard" id="scorecard-national-card">
                        <div class="scorecard-subcard-header">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <h3 style="margin: 0; font-size: 13.5px; font-weight: 700; color: #0f172a;">
                                        Stock Opname Rating
                                    </h3>
                                    <span id="scorecard-national-period-badge" class="badge"
                                        style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11px; padding: 2.5px 8px; border-radius: 6px; letter-spacing: 0.2px;">
                                        Juli - September 2026
                                    </span>
                                </div>
                                <p style="margin: 1px 0 0 0; font-size: 10.5px; color: #64748b;"
                                    id="scorecard-subtitle">Perbandingan Rating Stock Opname 3 Bulan Terakhir
                                </p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <label for="national-rating-filter"
                                    style="font-size: 11px; font-weight: 600; color: #64748b; margin: 0;">Rating:</label>
                                <select id="national-rating-filter" class="form-control form-control-sm"
                                    style="font-size: 11.5px; padding: 2px 8px; width: auto; min-width: 125px; height: 28px;"
                                    onchange="App.onNationalRatingFilterChange(this.value)">
                                    <option value="all">Semua Rating</option>
                                    <option value="very_poor" selected>Very Poor</option>
                                    <option value="poor">Poor</option>
                                    <option value="moderate">Moderate</option>
                                    <option value="good">Good</option>
                                    <option value="very_good">Very Good</option>
                                </select>
                            </div>
                        </div>
                        <div class="scorecard-subcard-body" style="padding: 0.85rem 1rem;">
                            <!-- 3 Tables Grid for m1, m2, m3 -->
                            <div class="national-rating-grid">
                                <!-- Table 1: Month 1 -->
                                <div class="national-rating-col"
                                    style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
                                    <div
                                        style="padding: 0.5rem 0.75rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                        <div style="display: inline-flex; align-items: center; gap: 6px;">
                                            <span id="national-col-title-m1"
                                                style="font-size: 11.5px; font-weight: 700; color: #1e293b; letter-spacing: 0.3px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">BULAN
                                                1</span>
                                            <span id="national-col-trend-m1"
                                                style="display: inline-flex; align-items: center; justify-content: center;"></span>
                                        </div>
                                        <span id="national-col-count-m1" class="badge"
                                            style="background: #e2e8f0; color: #475569; font-size: 10px; padding: 2.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">0
                                            Sites</span>
                                    </div>
                                    <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
                                        <table class="reconciliation-table scorecard-table">
                                            <thead>
                                                <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                    <th class="scorecard-col-no">NO</th>
                                                    <th class="scorecard-col-subdept">DEPT</th>
                                                    <th class="scorecard-col-sitecode">SITE CODE</th>
                                                    <th class="scorecard-col-namesite">NAMA SITE</th>
                                                    <th class="scorecard-col-month">%</th>
                                                    <th class="scorecard-col-status">RATING</th>
                                                </tr>
                                            </thead>
                                            <tbody id="national-rating-tbody-m1">
                                                <tr>
                                                    <td colspan="6" class="text-center"
                                                        style="padding: 1.5rem; color: #94a3b8;">No data</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <!-- Table 2: Month 2 -->
                                <div class="national-rating-col"
                                    style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
                                    <div
                                        style="padding: 0.5rem 0.75rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                        <div style="display: inline-flex; align-items: center; gap: 6px;">
                                            <span id="national-col-title-m2"
                                                style="font-size: 11.5px; font-weight: 700; color: #1e293b; letter-spacing: 0.3px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">BULAN
                                                2</span>
                                            <span id="national-col-trend-m2"
                                                style="display: inline-flex; align-items: center; justify-content: center;"></span>
                                        </div>
                                        <span id="national-col-count-m2" class="badge"
                                            style="background: #e2e8f0; color: #475569; font-size: 10px; padding: 2.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">0
                                            Sites</span>
                                    </div>
                                    <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
                                        <table class="reconciliation-table scorecard-table">
                                            <thead>
                                                <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                    <th class="scorecard-col-no">NO</th>
                                                    <th class="scorecard-col-subdept">DEPT</th>
                                                    <th class="scorecard-col-sitecode">SITE CODE</th>
                                                    <th class="scorecard-col-namesite">NAMA SITE</th>
                                                    <th class="scorecard-col-month">%</th>
                                                    <th class="scorecard-col-status">RATING</th>
                                                </tr>
                                            </thead>
                                            <tbody id="national-rating-tbody-m2">
                                                <tr>
                                                    <td colspan="6" class="text-center"
                                                        style="padding: 1.5rem; color: #94a3b8;">No data</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <!-- Table 3: Month 3 -->
                                <div class="national-rating-col"
                                    style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
                                    <div
                                        style="padding: 0.5rem 0.75rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                        <div style="display: inline-flex; align-items: center; gap: 6px;">
                                            <span id="national-col-title-m3"
                                                style="font-size: 11.5px; font-weight: 700; color: #1e293b; letter-spacing: 0.3px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">BULAN
                                                3</span>
                                            <span id="national-col-trend-m3"
                                                style="display: inline-flex; align-items: center; justify-content: center;"></span>
                                        </div>
                                        <span id="national-col-count-m3" class="badge"
                                            style="background: #e2e8f0; color: #475569; font-size: 10px; padding: 2.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">0
                                            Sites</span>
                                    </div>
                                    <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
                                        <table class="reconciliation-table scorecard-table">
                                            <thead>
                                                <tr style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                    <th class="scorecard-col-no">NO</th>
                                                    <th class="scorecard-col-subdept">DEPT</th>
                                                    <th class="scorecard-col-sitecode">SITE CODE</th>
                                                    <th class="scorecard-col-namesite">NAMA SITE</th>
                                                    <th class="scorecard-col-month">%</th>
                                                    <th class="scorecard-col-status">RATING</th>
                                                </tr>
                                            </thead>
                                            <tbody id="national-rating-tbody-m3">
                                                <tr>
                                                    <td colspan="6" class="text-center"
                                                        style="padding: 1.5rem; color: #94a3b8;">No data</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            <!-- ── Trend Line Graphics (DEPT on top; Sub DEPT / PMD Sub DEPT below) ── -->
            <div class="trend-charts-container" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <!-- Card 1: Trend Line DEPT (Full Width on top) -->
                <div class="card" id="card-trend-dept-wrapper" style="margin-bottom: 1.25rem;">
                    <div class="card-header"
                        style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 class="card-title" id="trend-dept-title"
                                style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                Trend Achievement SO Divisi (PMD)</h3>
                            <p class="card-subtitle trend-chart-subtitle"
                                style="font-size: 0.78rem; color: #64748b; margin-bottom: 0;">
                                Monthly Physical % (Jan - Dec 2026)</p>
                        </div>
                        <span class="badge" id="trend-dept-badge"
                            style="background: #faf5ff; color: #9333ea; font-weight: 600; font-size: 11px; padding: 3px 8px; border-radius: 6px;">PMD</span>
                    </div>
                    <div class="card-body" style="padding: 1rem; position: relative;">
                        <div style="position: relative; height: 330px; width: 100%;">
                            <canvas id="chart-trend-dept"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Row below: Sub DEPT (Outlet) or PMD Sub DEPT -->
                <div class="trend-charts-row-2 single-chart" id="trend-charts-row-sub">
                    <!-- Card 2: Trend Line PMD Sub DEPT (Default Display) -->
                    <div class="card" id="card-trend-pmd-wrapper" style="margin-bottom: 0;">
                        <div class="card-header"
                            style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 class="card-title"
                                    style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                    Trend Achievement SO PMD Dept</h3>
                                <p class="card-subtitle trend-chart-subtitle"
                                    style="font-size: 0.78rem; color: #64748b; margin-bottom: 0;">
                                    Monthly Physical % (Jan - Dec 2026)</p>
                            </div>
                            <span class="badge"
                                style="background: #faf5ff; color: #9333ea; font-weight: 600; font-size: 11px; padding: 3px 8px; border-radius: 6px;">PMD</span>
                        </div>
                        <div class="card-body" style="padding: 1rem; position: relative;">
                            <div style="position: relative; height: 360px; width: 100%;">
                                <canvas id="chart-trend-pmd"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Card 3: Trend Line Sub DEPT (Outlet Regional) -->
                    <div class="card" id="card-trend-subdept-wrapper" style="margin-bottom: 0; display: none;">
                        <div class="card-header"
                            style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 class="card-title" id="trend-subdept-title"
                                    style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                    Trend Achievement SO Outlet Regional Sub Dept</h3>
                                <p class="card-subtitle trend-chart-subtitle" id="trend-subdept-subtitle"
                                    style="font-size: 0.78rem; color: #64748b; margin-bottom: 0;">
                                    Monthly Physical % (Jan - Dec 2026)</p>
                            </div>
                            <span class="badge" id="trend-subdept-badge"
                                style="background: #f0fdf4; color: #16a34a; font-weight: 600; font-size: 11px; padding: 3px 8px; border-radius: 6px;">Outlet
                                Regional</span>
                        </div>
                        <div class="card-body" style="padding: 1rem; position: relative;">
                            <div style="position: relative; height: 460px; width: 100%;">
                                <canvas id="chart-trend-subdept"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Card: Report SO Outlet Regional / PMD ─────────── -->
            <div class="card" id="card-hasil-so-subdept" style="margin-top: 1rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                            <h2 class="card-title" id="hasil-so-title" style="margin: 0;">Report SO PMD
                            </h2>
                            <span id="subdept-period-badge" class="badge"
                                style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11.5px; padding: 3px 9px; border-radius: 6px; letter-spacing: 0.2px;">
                                September 2026
                            </span>
                        </div>
                        <p class="card-subtitle" id="hasil-so-subtitle" style="margin-top: 2px;">Pencapaian dan Hasil
                            Stock Opname PMD</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <div style="display: none; align-items: center; gap: 0.5rem;" id="dept-result-filter-container">
                            <label for="dept-result-filter"
                                style="font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap;">
                                DEPT
                            </label>
                            <select id="dept-result-filter" class="form-control"
                                style="width: auto; padding: 0.35rem 0.75rem; font-weight: 600;"
                                onchange="App.onDeptResultFilterChange()">
                                <option value="all" selected>Semua DEPT</option>
                                <option value="CRO">CRO</option>
                                <option value="ERO">ERO</option>
                                <option value="WRO">WRO</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;"
                            id="subdept-result-filter-container">
                            <label for="subdept-result-filter" id="label-subdept-result-filter"
                                style="font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap;">
                                DEPT
                            </label>
                            <select id="subdept-result-filter" class="form-control"
                                style="width: auto; padding: 0.35rem 0.75rem; font-weight: 600;"
                                onchange="App.loadSubDeptResults()">
                                <option value="all" selected>Semua Dept</option>
                                <option value="DNO">DNO</option>
                                <option value="DSO">DSO</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;"
                            id="status-result-filter-container">
                            <label for="status-result-filter"
                                style="font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap;">
                                STATUS
                            </label>
                            <select id="status-result-filter" class="form-control"
                                style="width: auto; padding: 0.35rem 0.75rem; font-weight: 600;"
                                onchange="App.loadSubDeptResults()">
                                <option value="all" selected>Semua Status</option>
                                <option value="tercapai">Tercapai</option>
                                <option value="tidak_tercapai">Tidak Tercapai</option>
                            </select>
                        </div>
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
                                            <th rowspan="2" class="sortable"
                                                onclick="App.toggleSubdeptResultsSort('sitecode')"
                                                style="vertical-align: middle; text-align: center; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Site Code <span class="sort-indicator"
                                                    data-subdept-col="sitecode">⇅</span></th>
                                            <th rowspan="2" class="sortable col-name-site"
                                                onclick="App.toggleSubdeptResultsSort('name_site')"
                                                style="vertical-align: middle; text-align: left; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Name Site <span class="sort-indicator"
                                                    data-subdept-col="name_site">⇅</span></th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Result Match</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Result Physic</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Result DB</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Total Physical</th>
                                            <th
                                                style="text-align: center; padding: 0.5rem 0.75rem 0.2rem; font-weight: 700; color: #1e293b; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Pencapaian</th>
                                            <th rowspan="2" class="sortable col-status"
                                                onclick="App.toggleSubdeptResultsSort('status')"
                                                style="vertical-align: middle; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; width: 190px; min-width: 170px; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                                Status <span class="sort-indicator" data-subdept-col="status">⇅</span>
                                            </th>
                                        </tr>
                                        <tr
                                            style="background: #f8fafc; font-size: 10px; color: #64748b; border-bottom: 2px solid #cbd5e1;">
                                            <th class="sortable text-center"
                                                onclick="App.toggleSubdeptResultsSort('match_qty')"
                                                style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Physical (QTY) <span class="sort-indicator"
                                                    data-subdept-col="match_qty">⇅</span></th>
                                            <th class="sortable text-center"
                                                onclick="App.toggleSubdeptResultsSort('physic_qty')"
                                                style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Physical (QTY) <span class="sort-indicator"
                                                    data-subdept-col="physic_qty">⇅</span></th>
                                            <th class="sortable text-center"
                                                onclick="App.toggleSubdeptResultsSort('db_qty')"
                                                style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Physical (QTY) <span class="sort-indicator"
                                                    data-subdept-col="db_qty">⇅</span></th>
                                            <th class="sortable text-center"
                                                onclick="App.toggleSubdeptResultsSort('target_qty')"
                                                style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                Target (QTY) <span class="sort-indicator"
                                                    data-subdept-col="target_qty">⇅</span></th>
                                            <th class="sortable text-center"
                                                onclick="App.toggleSubdeptResultsSort('pct')"
                                                style="padding: 0.2rem 0.75rem 0.5rem; font-weight: 600; text-transform: none; position: sticky; top: 28px; background: #f8fafc; z-index: 2;">
                                                % <span class="sort-indicator" data-subdept-col="pct">⇅</span></th>
                                        </tr>
                                    </thead>
                                    <tbody id="subdept-results-tbody">
                                        <tr>
                                            <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
                                                Memuat Hasil SO...
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot id="subdept-results-tfoot"
                                        style="position: sticky; bottom: 0; z-index: 5; background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1; box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);">
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <!-- Right: Pie / Donut Chart for Tercapai vs Tidak Tercapai -->
                        <div class="so-subdept-chart-wrapper">
                            <div class="so-pie-card">
                                <div class="so-pie-header">
                                    <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                        Status Pencapaian</h3>
                                    <p style="font-size: 11px; color: #64748b; margin: 0;" id="subdept-pie-subtitle">
                                        Tercapai vs Tidak Tercapai</p>
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

            <!-- ═══════════════════════════════════════════════════════════ -->
            <!-- CARD: Rekapitulasi Status Penyelesaian DB                   -->
            <!-- ═══════════════════════════════════════════════════════════ -->
            <div class="card" id="card-rekap-status-db" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                            <h2 class="card-title"
                                style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                                Rekapitulasi Status Penyelesaian DB
                            </h2>
                            <span id="rdb-status-period-badge" class="badge"
                                style="background: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 11px; padding: 3px 9px; border-radius: 6px; border: 1px solid #bfdbfe;">
                                Februari 2026
                            </span>
                        </div>
                        <p class="card-subtitle" style="margin-top: 3px;">
                            Perbandingan data DB dengan periode sebelumnya
                        </p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <select id="rdb-status-filter-dept" class="form-control unified-filter-select"
                            style="width: auto; padding: 0.3rem 0.6rem; font-size: 12px; font-weight: 500;"
                            autocomplete="off" onchange="App.onRekapDbStatusDeptChange()">
                            <option value="all" selected>Semua Divisi</option>
                        </select>

                        <select id="rdb-status-filter-subdept" class="form-control unified-filter-select"
                            style="width: auto; padding: 0.3rem 0.6rem; font-size: 12px; font-weight: 500;"
                            autocomplete="off" onchange="App.onRekapDbStatusSubDeptChange()">
                            <option value="all" selected>Semua Dept</option>
                        </select>

                        <select id="rdb-status-filter-sitecode" class="form-control unified-filter-select"
                            style="width: auto; max-width: 200px; padding: 0.3rem 0.6rem; font-size: 12px; font-weight: 500;"
                            autocomplete="off" onchange="App.onRekapDbStatusSitecodeChange()">
                            <option value="all" selected>Semua Site</option>
                        </select>

                        <select id="rdb-status-filter-status" class="form-control unified-filter-select"
                            style="width: auto; padding: 0.3rem 0.6rem; font-size: 12px; font-weight: 500;"
                            autocomplete="off" onchange="App.onRekapDbStatusFilterChange()">
                            <option value="all" selected>Semua Status</option>
                            <option value="solved">Solved DB</option>
                            <option value="unsolved">Unsolved DB</option>
                            <option value="new_db">New DB</option>
                        </select>

                        <button class="btn btn-success" id="btn-rdb-status-export-excel"
                            onclick="App.exportRekapDbStatusExcel()"
                            style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; min-height: 36px; box-sizing: border-box; padding: 0 1rem; border-radius: 8px; font-size: 12.5px; font-weight: 600; line-height: 1;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>Export Excel</span>
                        </button>
                    </div>
                </div>

                <!-- KPI Metric Summary Strip -->
                <div class="card-body"
                    style="padding: 1rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <div
                        style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem;">
                        <!-- Metric 1: Total Sites -->
                        <div id="rdb-card-kpi-all"
                            style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">
                            <div>
                                <span
                                    style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">TOTAL
                                    DB</span>
                            </div>
                            <div
                                style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 4px; flex-wrap: wrap;">
                                <span id="rdb-metric-total-items"
                                    style="font-size: 1.4rem; font-weight: 800; color: #0f172a;">0</span>
                                <span id="rdb-metric-total-sites"
                                    style="font-size: 11px; font-weight: 600; color: #475569;">(0/0 Sites)</span>
                            </div>
                            <div id="rdb-metric-total-nbv"
                                style="font-size: 11px; color: #64748b; margin-top: 2px; font-weight: 500;">Total NBV :
                                Rp 0</div>
                        </div>

                        <!-- Metric 2: Solved -->
                        <div id="rdb-card-kpi-solved"
                            style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.85rem 1rem;">
                            <div>
                                <span
                                    style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.03em;">SOLVED
                                    DB</span>
                            </div>
                            <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 4px;">
                                <span id="rdb-metric-solved"
                                    style="font-size: 1.4rem; font-weight: 800; color: #16a34a;">0</span>
                                <span id="rdb-metric-solved-pct"
                                    style="font-size: 11px; font-weight: 600; color: #15803d;">(0%)</span>
                            </div>
                            <div id="rdb-metric-solved-nbv"
                                style="font-size: 11px; color: #166534; margin-top: 2px; font-weight: 500;">Total NBV :
                                Rp 0</div>
                        </div>

                        <!-- Metric 3: Unsolved -->
                        <div id="rdb-card-kpi-unsolved"
                            style="background: #ffffff; border: 1px solid #fecaca; border-radius: 8px; padding: 0.85rem 1rem;">
                            <div>
                                <span
                                    style="font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.03em;">UNSOLVED
                                    DB</span>
                            </div>
                            <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 4px;">
                                <span id="rdb-metric-unsolved"
                                    style="font-size: 1.4rem; font-weight: 800; color: #dc2626;">0</span>
                                <span id="rdb-metric-unsolved-pct"
                                    style="font-size: 11px; font-weight: 600; color: #b91c1c;">(0%)</span>
                            </div>
                            <div id="rdb-metric-unsolved-nbv"
                                style="font-size: 11px; color: #991b1b; margin-top: 2px; font-weight: 500;">Total NBV :
                                Rp 0</div>
                        </div>

                        <!-- Metric 4: New DB -->
                        <div id="rdb-card-kpi-new_db"
                            style="background: #ffffff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.85rem 1rem;">
                            <div>
                                <span
                                    style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.03em;">NEW
                                    DB</span>
                            </div>
                            <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 4px;">
                                <span id="rdb-metric-new-db"
                                    style="font-size: 1.4rem; font-weight: 800; color: #2563eb;">0</span>
                                <span id="rdb-metric-new-db-pct"
                                    style="font-size: 11px; font-weight: 600; color: #1d4ed8;">(0%)</span>
                            </div>
                            <div id="rdb-metric-new-db-nbv"
                                style="font-size: 11px; color: #1e40af; margin-top: 2px; font-weight: 500;">Total NBV :
                                Rp 0</div>
                        </div>
                    </div>
                </div>

                <!-- Toolbar (Page Size & Search) -->
                <div class="table-toolbar" style="flex-wrap: wrap; gap: 0.75rem;">
                    <div class="table-toolbar-left" style="flex-wrap: wrap; gap: 0.6rem;">
                        <label for="rdb-status-page-size">Tampilkan</label>
                        <select id="rdb-status-page-size" class="form-control"
                            style="width: auto; padding: 0.25rem 0.5rem;" autocomplete="off"
                            onchange="App.changeRekapDbStatusPageSize(this.value)">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="all">Semua</option>
                        </select>
                    </div>
                    <div class="table-toolbar-right">
                        <input type="text" id="rdb-status-search-input" class="table-search-input"
                            placeholder="Search..." autocomplete="off" value=""
                            oninput="App.handleRekapDbStatusSearch(this.value)">
                    </div>
                </div>

                <!-- Container for Flat Table View -->
                <div class="card-body" style="padding: 0;">
                    <div id="rdb-status-flat-container" style="display: block;">
                        <div class="table-responsive">
                            <table class="reconciliation-table" id="rdb-status-flat-table">
                                <thead>
                                    <tr>
                                        <th class="text-center align-middle" style="width: 45px;">NO</th>
                                        <th class="text-center align-middle sortable col-rdb-dept" id="rdb-th-dept-col"
                                            style="width: 85px;" onclick="App.toggleRekapDbStatusSort('dept')">
                                            <span id="rdb-th-dept">DIVISI</span> <span class="sort-indicator"
                                                data-rdb-status-col="dept">⇅</span>
                                        </th>
                                        <th class="text-center align-middle sortable col-rdb-subdept"
                                            id="rdb-th-subdept-col" style="width: 95px;"
                                            onclick="App.toggleRekapDbStatusSort('sub_dept')">
                                            <span id="rdb-th-subdept">DEPT</span> <span class="sort-indicator"
                                                data-rdb-status-col="sub_dept">⇅</span>
                                        </th>
                                        <th class="text-center align-middle sortable" style="width: 110px;"
                                            onclick="App.toggleRekapDbStatusSort('sitecode')">
                                            SITECODE <span class="sort-indicator"
                                                data-rdb-status-col="sitecode">⇅</span>
                                        </th>
                                        <th class="text-left align-middle sortable" style="min-width: 140px;"
                                            onclick="App.toggleRekapDbStatusSort('name_site')">
                                            NAMA SITE <span class="sort-indicator"
                                                data-rdb-status-col="name_site">⇅</span>
                                        </th>
                                        <th class="text-center align-middle sortable" style="width: 150px;"
                                            onclick="App.toggleRekapDbStatusSort('reg_no')">
                                            REG NO <span class="sort-indicator" data-rdb-status-col="reg_no">⇅</span>
                                        </th>
                                        <th class="text-left align-middle sortable rdb-col-name"
                                            style="min-width: 200px;" onclick="App.toggleRekapDbStatusSort('name')">
                                            NAME <span class="sort-indicator" data-rdb-status-col="name">⇅</span>
                                        </th>
                                        <th class="text-center align-middle sortable" style="width: 140px;"
                                            onclick="App.toggleRekapDbStatusSort('sn')">
                                            SN <span class="sort-indicator" data-rdb-status-col="sn">⇅</span>
                                        </th>
                                        <th class="text-right align-middle sortable" style="width: 130px;"
                                            onclick="App.toggleRekapDbStatusSort('nbv')">
                                            NBV <span class="sort-indicator" data-rdb-status-col="nbv">⇅</span>
                                        </th>
                                        <th class="text-center align-middle sortable" style="width: 105px;"
                                            onclick="App.toggleRekapDbStatusSort('status')">
                                            STATUS <span class="sort-indicator" data-rdb-status-col="status">⇅</span>
                                        </th>
                                        <th class="text-left align-middle" style="min-width: 180px;">KETERANGAN</th>
                                    </tr>
                                </thead>
                                <tbody id="rdb-status-flat-tbody">
                                    <tr>
                                        <td colspan="11" class="text-center" style="padding: 2.5rem; color: #64748b;">
                                            Memuat data status...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Pagination Footer -->
                <div class="table-pagination-footer">
                    <div id="rdb-status-pagination-info">Menampilkan 0 sampai 0 dari 0 data</div>
                    <div class="pagination-controls" id="rdb-status-pagination-controls"></div>
                </div>
            </div>

            <!-- ── Card: Rekapitulasi 2026 ────────────────────────── -->
            <div class="card" id="card-rekapitulasi" style="margin-top: 1rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <h2 class="card-title" id="rekap-card-title">Rekapitulasi 2026</h2>
                        <p class="card-subtitle" id="rekap-card-subtitle">Persentase Monthly Stock Opname PMD 2026</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;" id="rekap-dept-filter-container">
                            <label for="rekap-dept-filter" id="label-rekap-dept-filter"
                                style="font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap;">
                                DIVISI
                            </label>
                            <select id="rekap-dept-filter" class="form-control unified-filter-select"
                                style="width: auto; padding: 0.35rem 0.75rem; font-weight: 600;"
                                onchange="App.onRekapDeptFilterChange()">
                                <option value="all" selected>Semua Divisi</option>
                                <option value="PMD">PMD</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;"
                            id="rekap-subdept-filter-container">
                            <label for="rekap-subdept-filter" id="label-rekap-subdept-filter"
                                style="font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap;">
                                DEPT
                            </label>
                            <select id="rekap-subdept-filter" class="form-control unified-filter-select"
                                style="width: auto; padding: 0.35rem 0.75rem; font-weight: 600;"
                                onchange="App.onRekapSubDeptFilterChange()">
                                <option value="all" selected>Semua Dept</option>
                                <option value="DNO">DNO</option>
                                <option value="DSO">DSO</option>
                            </select>
                        </div>
                        <button class="btn btn-success" id="btn-rekap-export-excel"
                            onclick="App.exportRekapitulasiExcel()"
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

                <!-- ── Sub-Level Tabs: PMD / Outlet Regional (Controlled by Category Switch) ── -->
                <div class="sr-tabs-container" id="rekap-tabs-container" style="display: none;">
                    <div class="sr-tabs-level2" id="rekap-tabs-level2"
                        style="border-bottom: 2px solid #e2e8f0; margin-top: 0;">
                        <button class="rekap-tab-l2 active" data-rekap-l2="pmd" onclick="App.switchRekapLevel2('pmd')">
                            PMD
                        </button>
                        <button class="rekap-tab-l2" data-rekap-l2="outlet" onclick="App.switchRekapLevel2('outlet')">
                            Outlet Regional
                        </button>
                    </div>
                </div>

                <!-- Table Toolbar: Page Size & Search -->
                <div class="table-toolbar">
                    <div class="table-toolbar-left">
                        <label for="rekap-page-size">Tampilkan</label>
                        <select id="rekap-page-size" class="form-control" style="width: auto; padding: 0.25rem 0.5rem;"
                            autocomplete="off" onchange="App.changeRekapPageSize(this.value)">
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="all">Semua</option>
                        </select>
                        <span>baris per halaman</span>
                    </div>
                    <div class="table-toolbar-right">
                        <input type="text" id="rekap-search-input" class="table-search-input unified-search-input"
                            placeholder="Search..." autocomplete="off" oninput="App.handleRekapSearch(this.value)">
                    </div>
                </div>

                <!-- Rekapitulasi Table -->
                <div class="card-body" style="padding: 0;">
                    <div class="table-responsive">
                        <table class="reconciliation-table" id="rekap-table">
                            <thead>
                                <tr>
                                    <th class="text-center align-middle sortable col-rekap-dept" id="rekap-th-dept-col"
                                        onclick="App.toggleRekapSort('dept')">
                                        <span id="rekap-th-dept">DIVISI</span> <span class="sort-indicator"
                                            data-rekap-col="dept">⇅</span>
                                    </th>
                                    <th class="text-center align-middle sortable col-rekap-subdept"
                                        id="rekap-th-subdept-col" onclick="App.toggleRekapSort('sub_dept')">
                                        <span id="rekap-th-subdept">DEPT</span> <span class="sort-indicator"
                                            data-rekap-col="sub_dept">⇅</span>
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
                                        Memuat data Rekapitulasi 2026...
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
                    <div id="rekap-pagination-info">Menampilkan 0 sampai 0 dari 0 data</div>
                    <div class="pagination-controls" id="rekap-pagination-controls"></div>
                </div>
            </div>

            <!-- ── History Card Movement (Log Pergerakan & Perbandingan Site) ── -->
            <div class="card" id="card-site-movements"
                style="margin-top: 1.5rem; margin-bottom: 1.5rem; transition: all 0.3s ease;">
                <div class="card-header"
                    style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding: 0.85rem 1.25rem; cursor: pointer;"
                    onclick="App.toggleMovementDetails()">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <h3 class="card-title"
                                style="margin: 0; font-size: 1rem; font-weight: 700; color: #0f172a;">History &amp; Log
                            </h3>
                            <span id="sm-badge-total" class="badge"
                                style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 9999px;">
                                0 Perubahan
                            </span>
                        </div>
                        <p id="sm-period-subtitle" class="card-subtitle"
                            style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">
                            Memuat data perbandingan...
                        </p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;" onclick="event.stopPropagation()">
                        <button type="button" class="btn btn-outline-secondary btn-sm" id="sm-btn-toggle"
                            onclick="App.toggleMovementDetails()"
                            style="font-size: 12px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px;">
                            <span id="sm-toggle-text">Show</span>
                            <span id="sm-toggle-arrow" style="font-size: 11px; font-weight: bold;">▼</span>
                        </button>
                    </div>
                </div>

                <!-- Minimizable Body Wrapper (Hidden by default) -->
                <div id="sm-card-body-wrapper" style="display: none;">
                    <!-- Comparison KPI Strip -->
                    <div class="card-body"
                        style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                        <div
                            style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem;">
                            <!-- Card 1: Perubahan Status -->
                            <div
                                style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <div
                                    style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                                    Perubahan Status</div>
                                <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                                    <span id="sm-stat-movements"
                                        style="font-size: 1.35rem; font-weight: 800; color: #0284c7;">0</span>
                                    <span style="font-size: 12px; color: #64748b;">Site berpindah</span>
                                </div>
                                <div id="sm-stat-movements-desc"
                                    style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                                    Pada periode ini</div>
                            </div>

                            <!-- Card 2: Sites Aktif -->
                            <div
                                style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <div
                                    style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                                    Sites Aktif</div>
                                <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                                    <span id="sm-stat-active"
                                        style="font-size: 1.35rem; font-weight: 800; color: #0f172a;">0</span>
                                    <span id="sm-stat-active-diff"><span
                                            class="kpi-target-indicator target-neutral"><span>-</span></span></span>
                                </div>
                                <div id="sm-stat-active-desc" style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                                    vs
                                    bulan sebelumnya</div>
                            </div>

                            <!-- Card 3: Monthly Sites -->
                            <div
                                style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <div
                                    style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                                    Monthly Sites</div>
                                <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                                    <span id="sm-stat-monthly"
                                        style="font-size: 1.35rem; font-weight: 800; color: #16a34a;">0</span>
                                    <span id="sm-stat-monthly-diff"><span
                                            class="kpi-target-indicator target-neutral"><span>-</span></span></span>
                                </div>
                                <div id="sm-stat-monthly-desc"
                                    style="font-size: 11px; color: #94a3b8; margin-top: 2px;">vs
                                    bulan sebelumnya</div>
                            </div>

                            <!-- Card 4: Quarterly Sites -->
                            <div
                                style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <div
                                    style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                                    Quarterly Sites</div>
                                <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                                    <span id="sm-stat-quarterly"
                                        style="font-size: 1.35rem; font-weight: 800; color: #0284c7;">0</span>
                                    <span id="sm-stat-quarterly-diff"><span
                                            class="kpi-target-indicator target-neutral"><span>-</span></span></span>
                                </div>
                                <div id="sm-stat-quarterly-desc"
                                    style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                                    vs bulan sebelumnya</div>
                            </div>

                            <!-- Card 5: Inactive Sites -->
                            <div
                                style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <div
                                    style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                                    Inactive Sites</div>
                                <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                                    <span id="sm-stat-inactive"
                                        style="font-size: 1.35rem; font-weight: 800; color: #64748b;">0</span>
                                    <span id="sm-stat-inactive-diff"><span
                                            class="kpi-target-indicator target-neutral"><span>-</span></span></span>
                                </div>
                                <div id="sm-stat-inactive-desc"
                                    style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                                    Site nonaktif</div>
                            </div>
                        </div>
                    </div>

                    <!-- Movement Logs Table Container -->
                    <div id="sm-table-container" style="padding: 1.25rem;">
                        <div
                            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                            <input type="search" id="sm-search-input" class="table-search-input unified-search-input"
                                placeholder="Search..." oninput="App.filterMovementsTable()"
                                onkeyup="App.filterMovementsTable()" onsearch="App.filterMovementsTable()"
                                style="max-width: 320px;">
                            <div style="font-size: 12px; color: #64748b;" id="sm-table-info">
                                Menampilkan log pergerakan
                            </div>
                        </div>
                        <div class="table-responsive"
                            style="max-height: 380px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                            <table class="reconciliation-table" style="margin: 0; font-size: 12px; width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="padding: 8px 10px; width: 45px; text-align: center;">NO</th>
                                        <th style="padding: 8px 10px; width: 120px; text-align: center;">SITE CODE</th>
                                        <th style="padding: 8px 10px;">NAMA SITE</th>
                                        <th style="padding: 8px 10px;">DEPT / SUB DEPT</th>
                                        <th style="padding: 8px 10px; text-align: center; min-width: 175px;">LOG HISTORY
                                        </th>
                                        <th style="padding: 8px 10px; text-align: center; width: 120px;">PERIODE EFEKTIF
                                        </th>
                                        <th style="padding: 8px 10px;">KETERANGAN</th>
                                    </tr>
                                </thead>
                                <tbody id="sm-table-body">
                                    <tr>
                                        <td colspan="7" style="text-align: center; color: #94a3b8; padding: 2rem;">
                                            Memuat data log pergerakan...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Floating Chat Room Action Button (WhatsApp Direct) -->
            <button type="button" class="floating-chat-room-btn" id="btn-chat-room-fab"
                onclick="App.openChatRoomModal()" aria-label="Buka Chat Room PIC Sites">
                <svg viewBox="0 0 24 24">
                    <path
                        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 18.06c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.134 8.134 0 0 1-1.25-4.29c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.23.85 5.77 2.39a8.118 8.118 0 0 1 2.4 5.77c-.01 4.51-3.67 8.15-8.17 8.15zm4.48-6.11c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
                </svg>
            </button>
        </section>

        <!-- Login Page Section (SPA Clean URL) -->
        <?php require_once __DIR__ . '/layout/section_login.php'; ?>

        <!-- All Summary Page Section (SPA) -->
        <?php require_once __DIR__ . '/layout/section_all_summary.php'; ?>

        <!-- Weekly Summary Page Section (SPA) -->
        <?php require_once __DIR__ . '/layout/section_weekly_summary.php'; ?>

        <!-- Master Data Page Section (SPA) -->
        <?php require_once __DIR__ . '/layout/section_master_data.php'; ?>

        <!-- Master Data Weekly Page Section (SPA) -->
        <?php require_once __DIR__ . '/layout/section_master_data_weekly.php'; ?>

        <!-- User Management Page Section (SPA) -->
        <?php require_once __DIR__ . '/layout/section_user_management.php'; ?>

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!-- MODAL: Chat Room PIC Sites (WhatsApp Direct)                -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        <div id="chat-room-modal" class="modal-backdrop" style="display: none;">
            <div class="modal-dialog" style="max-width: 480px;">
                <div class="modal-header"
                    style="align-items: center; border-bottom: 1px solid #e2e8f0; padding: 1rem 1.25rem;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div
                            style="width: 36px; height: 36px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path
                                    d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 18.06c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.134 8.134 0 0 1-1.25-4.29c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.23.85 5.77 2.39a8.118 8.118 0 0 1 2.4 5.77c-.01 4.51-3.67 8.15-8.17 8.15zm4.48-6.11c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="modal-title"
                                style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">Chat Room PIC
                                Sites</h3>
                        </div>
                    </div>
                    <button type="button" class="modal-close-btn" onclick="App.closeChatRoomModal()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.25rem;">
                    <!-- Hidden phone number store (nomor tidak ditampilkan pada UI) -->
                    <input type="hidden" id="chat-room-notelp" value="">

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                        <!-- Dropdown DEPT -->
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" for="chat-room-dept"
                                style="font-size: 12px; font-weight: 600; color: #334155;">
                                DEPT <span style="color:#ef4444;">*</span>
                            </label>
                            <select id="chat-room-dept" class="form-control unified-filter-select" style="width: 100%;"
                                onchange="App.onChatRoomDeptChange(this.value)">
                                <option value="">Pilih Dept</option>
                            </select>
                        </div>

                        <!-- Dropdown SUB DEPT -->
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" for="chat-room-subdept"
                                style="font-size: 12px; font-weight: 600; color: #334155;">
                                SUB DEPT <span style="color:#ef4444;">*</span>
                            </label>
                            <select id="chat-room-subdept" class="form-control unified-filter-select"
                                style="width: 100%;" onchange="App.onChatRoomSubDeptChange(this.value)" disabled>
                                <option value="">Pilih Sub Dept</option>
                            </select>
                        </div>
                    </div>

                    <!-- Dropdown SITECODE -->
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label class="form-label" for="chat-room-sitecode"
                            style="font-size: 12px; font-weight: 600; color: #334155;">
                            SITECODE / SITE <span style="color:#ef4444;">*</span>
                        </label>
                        <select id="chat-room-sitecode" class="form-control unified-filter-select" style="width: 100%;"
                            onchange="App.onChatRoomSitecodeChange(this.value)" disabled>
                            <option value="">Pilih Sitecode</option>
                        </select>
                    </div>

                    <!-- Input PIC (Readonly) -->
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label class="form-label" for="chat-room-pic"
                            style="font-size: 12px; font-weight: 600; color: #334155;">
                            Nama PIC
                        </label>
                        <input type="text" id="chat-room-pic" class="form-control" readonly placeholder="Pilih sitecode"
                            style="background-color: #f8fafc; color: #0f172a; font-weight: 600; cursor: not-allowed; border-color: #cbd5e1;">
                        <!-- Alert if no phone number registered -->
                        <div id="chat-room-no-phone-alert"
                            style="display: none; margin-top: 6px; padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 11.5px; color: #b45309;">
                            ⚠️ Site ini belum memiliki nomor WhatsApp PIC terdaftar.
                        </div>
                    </div>

                    <!-- Textbox Pesan -->
                    <div class="form-group" style="margin-bottom: 0.5rem;">
                        <label class="form-label" for="chat-room-message"
                            style="font-size: 12px; font-weight: 600; color: #334155;">
                            Pesan <span style="color:#ef4444;">*</span>
                        </label>
                        <textarea id="chat-room-message" class="form-control" rows="4" placeholder="Masukkan pesan..."
                            style="resize: vertical; font-family: inherit; font-size: 13px; line-height: 1.45;"></textarea>
                    </div>
                </div>

                <div class="modal-footer"
                    style="padding: 0.85rem 1.25rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.6rem;">
                    <button type="button" class="btn btn-secondary" onclick="App.closeChatRoomModal()">Batal</button>
                    <button type="button" class="btn btn-success" id="btn-chat-room-send"
                        onclick="App.submitChatRoomMessage()"
                        style="display: inline-flex; align-items: center; gap: 6px; background-color: #16a34a; border-color: #15803d; font-weight: 600; padding: 0.5rem 1rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                            <path
                                d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 18.06c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.134 8.134 0 0 1-1.25-4.29c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.23.85 5.77 2.39a8.118 8.118 0 0 1 2.4 5.77c-.01 4.51-3.67 8.15-8.17 8.15zm4.48-6.11c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
                        </svg>
                        <span>Kirim ke WhatsApp</span>
                    </button>
                </div>
            </div>
        </div>
    </main>

    <!-- App Layout Footer -->
    <?php require_once __DIR__ . '/layout/footer.php'; ?>

    <!-- Global Auth Configuration -->
    <script>
        window.AUTH_USER = <?= json_encode($currentUser, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
        window.INITIAL_PAGE = <?= json_encode($_SESSION['initial_page'] ?? null) ?>;
        <?php unset($_SESSION['initial_page']); ?>
    </script>

    <!-- Scripts -->
    <script src="assets/js/chart.umd.min.js"></script>
    <script src="assets/js/all_summary.js?v=<?= filemtime(__DIR__ . '/assets/js/all_summary.js') ?>"></script>
    <script src="assets/js/app.js?v=<?= filemtime(__DIR__ . '/assets/js/app.js') ?>"></script>

</body>

</html>