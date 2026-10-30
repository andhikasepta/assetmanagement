/**
 * Asset Management - Core Application JS
 * Stock Opname Master Data with Pagination, Column Filters & Delete
 */

// Universal prevention of browser hover text tooltips
(function disableAllHoverTooltips() {
    try {
        if (typeof HTMLElement !== 'undefined' && HTMLElement.prototype) {
            Object.defineProperty(HTMLElement.prototype, 'title', {
                get: function () { return ''; },
                set: function () { this.removeAttribute('title'); },
                configurable: true
            });
        }
        if (typeof SVGElement !== 'undefined' && SVGElement.prototype) {
            Object.defineProperty(SVGElement.prototype, 'title', {
                get: function () { return ''; },
                set: function () { this.removeAttribute('title'); },
                configurable: true
            });
        }
    } catch (e) { }

    function removeTitles(root) {
        if (!root) return;
        if (root.nodeType === 1 && root.hasAttribute('title')) {
            root.removeAttribute('title');
        }
        if (root.querySelectorAll) {
            root.querySelectorAll('[title]').forEach(function (el) {
                el.removeAttribute('title');
            });
        }
    }

    document.addEventListener('mouseover', function (e) {
        let el = e.target;
        while (el && el !== document && el.nodeType === 1) {
            if (el.hasAttribute('title')) {
                el.removeAttribute('title');
            }
            el = el.parentElement;
        }
    }, true);

    document.addEventListener('pointerover', function (e) {
        let el = e.target;
        while (el && el !== document && el.nodeType === 1) {
            if (el.hasAttribute('title')) {
                el.removeAttribute('title');
            }
            el = el.parentElement;
        }
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            removeTitles(document.body || document.documentElement);
        });
    } else {
        removeTitles(document.body || document.documentElement);
    }

    if (window.MutationObserver) {
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type === 'attributes' && m.attributeName === 'title') {
                    if (m.target && m.target.hasAttribute && m.target.hasAttribute('title')) {
                        m.target.removeAttribute('title');
                    }
                } else if (m.addedNodes && m.addedNodes.length > 0) {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        removeTitles(m.addedNodes[j]);
                    }
                }
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['title']
        });
    }
})();

const App = (() => {
    let allMasterRows = [];
    let filteredMasterRows = [];
    let masterPeriodUpdates = {};
    let masterLatestUpdate = null;
    let currentPage = 1;
    let pageSize = 10;
    let searchQuery = '';

    let selectedFile = null;
    let importFileToken = null;
    let csrfToken = '';

    // Sorting state
    let sortColumn = null;
    let sortDirection = 'asc'; // 'asc' or 'desc'

    // Site Regional state
    let allSRRows = [];
    let filteredSRRows = [];
    let srCurrentPage = 1;
    let srPageSize = 10;
    let srSearchQuery = '';
    let srSortCol = 'sitecode';
    let srSortDir = 'asc';
    let selectedSRIds = new Set();
    let selectedSRFile = null;
    let srFileToken = null;
    let srLevel1 = 'monthly';  // 'monthly' or 'quarterly'
    let srLevel2 = 'outlet';   // 'outlet' or 'pmd'
    let srFilterRegional = 'all';
    let srFilterDept = 'all';
    let srFilterSubDept = 'all';
    let srFilterInfo = 'all';
    let srFilterGroupType = 'all';
    let srFilterStatus = 'all';

    // Rekapitulasi 2026 state
    let rekapYear = 2026;
    let rekapLevel1 = 'monthly'; // 'monthly' or 'quarterly'
    let rekapLevel2 = 'pmd';  // 'pmd' or 'outlet'
    let allRekapRows = [];
    let filteredRekapRows = [];
    let rekapMonthAverages = {};
    let rekapCurrentPage = 1;
    let rekapPageSize = 10;
    let rekapSearchQuery = '';
    let rekapSortCol = 'regional';
    let rekapSortDir = 'asc';
    let rekapDeptFilter = 'all';
    let rekapSubDeptFilter = 'all';

    // Summary SO Type & Category state
    let summarySOType = 'monthly';
    let summaryCategory = 'pmd'; // 'pmd' or 'outlet'
    let summaryInitialized = false;

    // In-Memory Instant Caches (0ms Data Switch)
    const summaryDataCache = new Map();
    const scorecardDataCache = new Map();
    const subdeptResultsCache = new Map();
    const trendChartsCache = new Map();
    const rekapDataCache = new Map();

    // Trend Charts state
    let chartTrendDept = null;
    let chartTrendSubDept = null;
    let chartTrendSubDeptList = [];
    let chartTrendPmd = null;
    let currentTrendSubDeptFilter = 'CSO';
    let currentTrendPmdSiteFilter = 'all';
    let lastTrendJsonData = null;
    let chartRekapAverage = null;

    function resetMasterFilters() {
        const monthFilter = document.getElementById('filter-month');
        if (monthFilter) monthFilter.value = '';

        const yearFilter = document.getElementById('filter-year');
        if (yearFilter) yearFilter.value = '';

        const searchInput = document.getElementById('master-search-input');
        if (searchInput) searchInput.value = '';

        const pageSizeSelect = document.getElementById('master-page-size');
        if (pageSizeSelect) pageSizeSelect.value = '10';

        searchQuery = '';
        currentPage = 1;
        pageSize = 10;
        sortColumn = null;
        sortDirection = 'asc';
    }

    function resetSRFilters() {
        const srSearchInput = document.getElementById('sr-search-input');
        if (srSearchInput) srSearchInput.value = '';

        const srPageSizeSelect = document.getElementById('sr-page-size');
        if (srPageSizeSelect) srPageSizeSelect.value = '10';

        const selectAll = document.getElementById('sr-select-all');
        if (selectAll) selectAll.checked = false;

        srSearchQuery = '';
        srCurrentPage = 1;
        srPageSize = 10;
        srSortCol = null;
        srSortDir = 'asc';
        selectedSRIds.clear();
        updateSRSortIndicators();
    }

    function resetRekapFilters() {
        const rekapSearchInput = document.getElementById('rekap-search-input');
        if (rekapSearchInput) rekapSearchInput.value = '';

        const rekapPageSizeSelect = document.getElementById('rekap-page-size');
        if (rekapPageSizeSelect) rekapPageSizeSelect.value = '10';

        rekapSearchQuery = '';
        rekapCurrentPage = 1;
        rekapPageSize = 10;
        rekapSortCol = 'regional';
        rekapSortDir = 'asc';
        updateRekapSortIndicators();
    }

    function updateCsrfToken(newToken) {
        if (!newToken) return;
        csrfToken = newToken;
        const metaCsrf = document.querySelector('meta[name="csrf-token"]');
        if (metaCsrf) {
            metaCsrf.setAttribute('content', newToken);
        }
        document.querySelectorAll('input[name="csrf_token"], #login-page-csrf, #login-modal-csrf').forEach(el => {
            el.value = newToken;
        });
    }

    async function refreshCsrfToken() {
        try {
            const res = await fetch('api/csrf.php');
            const data = await res.json();
            if (data && data.success && data.token) {
                updateCsrfToken(data.token);
                return data.token;
            }
        } catch (e) {
            console.warn('Gagal merefresh token CSRF:', e);
        }
        return null;
    }

    function init() {
        const metaCsrf = document.querySelector('meta[name="csrf-token"]');
        if (metaCsrf) {
            csrfToken = metaCsrf.getAttribute('content');
        }

        // Always clear/reset all filters on page reload
        resetMasterFilters();
        resetSRFilters();
        resetRekapFilters();

        setupDragAndDrop();
        setupSRDragAndDrop();
        setupRekapDbDragAndDrop();
        setupPicSitesDragAndDrop();
        setupCircularPicsDragAndDrop();
        setupTemplateReportDragAndDrop();
        setupWeeklyDragAndDrop();

        // Clean legacy localStorage to prevent stale storage hijacking default landing page
        try {
            localStorage.removeItem('active_page');
        } catch (e) { }

        // Clean URL enforcer: strips any .php, query strings or hash so URL stays clean (e.g. amora.wmsdev.my.id/)
        keepCleanUrl();

        let initialPage = window.AUTH_USER ? 'all-summary' : 'summary';
        if (window.INITIAL_PAGE && (window.INITIAL_PAGE === 'all-summary' || window.INITIAL_PAGE === 'weekly-summary' || window.INITIAL_PAGE === 'reports' || window.INITIAL_PAGE === 'berita-acara' || window.INITIAL_PAGE === 'master-data' || window.INITIAL_PAGE === 'master-data-weekly' || window.INITIAL_PAGE === 'user-management' || window.INITIAL_PAGE === 'summary' || window.INITIAL_PAGE === 'login')) {
            if (window.INITIAL_PAGE === 'login') {
                initialPage = window.AUTH_USER ? 'all-summary' : 'login';
            } else {
                initialPage = (window.INITIAL_PAGE === 'summary' || window.AUTH_USER) ? window.INITIAL_PAGE : 'summary';
            }
        } else {
            const savedPage = sessionStorage.getItem('active_page');
            if (savedPage && (savedPage === 'all-summary' || savedPage === 'weekly-summary' || savedPage === 'reports' || savedPage === 'berita-acara' || savedPage === 'master-data' || savedPage === 'master-data-weekly' || savedPage === 'user-management' || savedPage === 'summary' || savedPage === 'login')) {
                if (savedPage === 'login') {
                    initialPage = window.AUTH_USER ? 'all-summary' : 'login';
                } else {
                    initialPage = (savedPage === 'summary' || window.AUTH_USER) ? savedPage : 'summary';
                }
            }
        }
        if (window.AUTH_USER && (initialPage === 'summary' || !initialPage)) {
            const perms = window.AUTH_USER.permissions || {};
            const canAll = perms.can_access_all_summary !== false;
            const canWk = perms.can_access_weekly_summary !== false;
            const canRep = perms.can_access_reports !== false;
            const canBA = perms.can_access_berita_acara !== false;
            const canMst = perms.can_access_master_data !== false;
            const canMstWk = perms.can_access_master_data_weekly !== false;
            const canUserMgmt = perms.can_access_user_management !== false;
            initialPage = canAll ? 'all-summary' : (canWk ? 'weekly-summary' : (canRep ? 'reports' : (canBA ? 'berita-acara' : (canMst ? 'master-data' : (canMstWk ? 'master-data-weekly' : (canUserMgmt ? 'user-management' : 'all-summary'))))));
        }

        // Restore active SO Type & Category from sessionStorage
        const savedSOType = sessionStorage.getItem('summary_so_type');
        const savedCategory = sessionStorage.getItem('summary_category');

        if (savedSOType === 'quarterly') {
            summarySOType = 'quarterly';
            if (savedCategory === 'outlet_subarep' || savedCategory === 'warehouse_hub') {
                summaryCategory = savedCategory;
            } else {
                summaryCategory = 'outlet_subarep';
            }
        } else if (savedSOType === 'monthly') {
            summarySOType = 'monthly';
            if (savedCategory === 'pmd' || savedCategory === 'outlet' || savedCategory === 'warehouse_hub' || savedCategory === 'it_coorporate') {
                summaryCategory = savedCategory;
            } else {
                summaryCategory = 'pmd';
            }
        } else {
            // Default condition: monthly PMD
            summarySOType = 'monthly';
            summaryCategory = 'pmd';
        }

        navigateTo(initialPage, true);

        // Display pending login / logout toast messages after page reload
        try {
            const loginSuccessUser = sessionStorage.getItem('login_success_toast');
            if (loginSuccessUser) {
                sessionStorage.removeItem('login_success_toast');
                showToast('success', 'Login Berhasil', `Selamat datang, ${loginSuccessUser}!`);
            }
            const logoutSuccess = sessionStorage.getItem('logout_toast');
            if (logoutSuccess) {
                sessionStorage.removeItem('logout_toast');
                showToast('info', 'Logout', 'Anda telah berhasil logout.');
            }
        } catch (e) { }

        // Check if there was a card jump pending from quick access
        const pendingCard = sessionStorage.getItem('target_card');
        if (pendingCard) {
            sessionStorage.removeItem('target_card');
            setTimeout(() => scrollToCard(pendingCard), 300);
        }

        // Listen for popstate when user uses browser Back/Forward
        window.addEventListener('popstate', () => {
            keepCleanUrl();
            const saved = sessionStorage.getItem('active_page') || 'summary';
            navigateTo(saved);
        });
    }

    // ── Keep Clean URL (Removes .php, query string & hash from address bar) ──
    function keepCleanUrl() {
        try {
            let path = window.location.pathname;
            let cleanPath = path.replace(/(index|login|summary|all-summary|weekly-summary|reports|berita-acara|master-data-weekly|master-data|user-management)\.php.*$/i, '');
            if (!cleanPath.endsWith('/')) {
                cleanPath += '/';
            }
            if (window.location.search || window.location.hash || path !== cleanPath) {
                history.replaceState(null, '', cleanPath);
            }
        } catch (e) { }
    }

    // ── Apply UAC (User Access Control) Permissions ───────────────────
    function applyUacPermissions() {
        if (!window.AUTH_USER || !window.AUTH_USER.permissions) return;
        const perms = window.AUTH_USER.permissions;

        // Navbar Tabs (Use !== false so missing/uninitialized keys default to visible)
        const tabAllSummary = document.getElementById('tab-all-summary');
        if (tabAllSummary) {
            tabAllSummary.style.display = perms.can_access_all_summary !== false ? '' : 'none';
        }
        const tabWeeklySummary = document.getElementById('tab-weekly-summary');
        if (tabWeeklySummary) {
            tabWeeklySummary.style.display = perms.can_access_weekly_summary !== false ? '' : 'none';
        }
        const tabReports = document.getElementById('tab-reports');
        if (tabReports) {
            tabReports.style.display = perms.can_access_reports !== false ? '' : 'none';
        }
        const tabBeritaAcara = document.getElementById('tab-berita-acara');
        if (tabBeritaAcara) {
            tabBeritaAcara.style.display = perms.can_access_berita_acara !== false ? '' : 'none';
        }
        const tabMasterData = document.getElementById('tab-master-data');
        if (tabMasterData) {
            tabMasterData.style.display = perms.can_access_master_data !== false ? '' : 'none';
        }
        const tabMasterDataWeekly = document.getElementById('tab-master-data-weekly');
        if (tabMasterDataWeekly) {
            tabMasterDataWeekly.style.display = perms.can_access_master_data_weekly !== false ? '' : 'none';
        }
        const tabUserManagement = document.getElementById('tab-user-management');
        if (tabUserManagement) {
            tabUserManagement.style.display = perms.can_access_user_management !== false ? '' : 'none';
        }

        // Toggle Generate PNG buttons
        document.querySelectorAll('.btn-generate-png').forEach(b => {
            b.style.display = window.AUTH_USER ? 'inline-flex' : 'none';
        });

        // Master Data (Monthly) Buttons: Add / Import
        document.querySelectorAll('[data-uac="master-add-import"]').forEach(el => {
            const can = perms.can_master_add_import !== false;
            el.style.setProperty('display', can ? '' : 'none', can ? '' : 'important');
        });

        // Master Data (Monthly) Buttons: Edit
        document.querySelectorAll('[data-uac="master-edit"]').forEach(el => {
            const can = perms.can_master_edit !== false;
            el.style.setProperty('display', can ? '' : 'none', can ? '' : 'important');
        });

        // Master Data (Monthly) Buttons: Delete
        document.querySelectorAll('[data-uac="master-delete"]').forEach(el => {
            const can = perms.can_master_delete !== false;
            el.style.setProperty('display', can ? '' : 'none', can ? '' : 'important');
        });

        // Master Data Weekly Buttons: Add / Import
        document.querySelectorAll('[data-uac="master-weekly-add-import"]').forEach(el => {
            const can = perms.can_master_weekly_add_import !== false;
            el.style.setProperty('display', can ? '' : 'none', can ? '' : 'important');
        });

        // Master Data Weekly Buttons: Delete
        document.querySelectorAll('[data-uac="master-weekly-delete"]').forEach(el => {
            const can = perms.can_master_weekly_delete !== false;
            el.style.setProperty('display', can ? '' : 'none', can ? '' : 'important');
        });

        // Reports Page UAC: SO Type switch & DEPT rules based on reports_depts
        const soTypeFilterGroup = document.getElementById('reports-so-type-filter-group');
        const userDepts = getUserReportsDepts();
        const onlyPMD = (userDepts.length === 1 && userDepts[0] === 'PMD');
        if (soTypeFilterGroup) {
            if (onlyPMD) {
                // When only PMD is assigned, PMD only has monthly data: hide switch and lock to monthly
                soTypeFilterGroup.style.display = 'none';
                if (typeof reportsState !== 'undefined') {
                    reportsState.so_type = 'monthly';
                    reportsState.dept = 'PMD';
                }
            } else {
                // When CRO, ERO, WRO, or ALL (or multiple) are assigned: show Monthly and Quarterly switch
                soTypeFilterGroup.style.display = 'flex';
            }
        }
    }

    // ── Navigation (SPA Core: Summary vs All Summary vs Weekly Summary vs Reports vs Master Data vs Master Data Weekly vs User Management) ──
    let pendingTargetPage = 'all-summary';

    function navigateTo(page, isInit = false) {
        if (!page) page = 'summary';

        // On initial landing without explicit page chosen, admin defaults to all-summary
        if (isInit && page === 'summary' && window.AUTH_USER && !sessionStorage.getItem('active_page')) {
            const perms = window.AUTH_USER.permissions || {};
            const canAll = perms.can_access_all_summary !== false;
            const canWk = perms.can_access_weekly_summary !== false;
            const canRep = perms.can_access_reports !== false;
            const canBA = perms.can_access_berita_acara !== false;
            const canMst = perms.can_access_master_data !== false;
            const canMstWk = perms.can_access_master_data_weekly !== false;
            const canUserMgmt = perms.can_access_user_management !== false;
            page = canAll ? 'all-summary' : (canWk ? 'weekly-summary' : (canRep ? 'reports' : (canBA ? 'berita-acara' : (canMst ? 'master-data' : (canMstWk ? 'master-data-weekly' : (canUserMgmt ? 'user-management' : 'all-summary'))))));
        }

        // Protected pages require authenticated session
        if ((page === 'all-summary' || page === 'weekly-summary' || page === 'reports' || page === 'berita-acara' || page === 'master-data' || page === 'master-data-weekly' || page === 'user-management') && !window.AUTH_USER) {
            showToast('info', 'Akses Terbatas', 'Silakan login untuk mengakses menu Administrator.');
            openLoginModal(page);
            return;
        }

        // Check UAC permissions for protected pages
        if (window.AUTH_USER && window.AUTH_USER.permissions) {
            const perms = window.AUTH_USER.permissions;
            if (page === 'all-summary' && perms.can_access_all_summary === false) {
                if (perms.can_access_weekly_summary !== false) page = 'weekly-summary';
                else if (perms.can_access_master_data !== false) page = 'master-data';
                else if (perms.can_access_master_data_weekly !== false) page = 'master-data-weekly';
                else page = 'user-management';
            } else if (page === 'weekly-summary' && perms.can_access_weekly_summary === false) {
                if (perms.can_access_all_summary !== false) page = 'all-summary';
                else if (perms.can_access_master_data !== false) page = 'master-data';
                else if (perms.can_access_master_data_weekly !== false) page = 'master-data-weekly';
                else page = 'user-management';
            } else if (page === 'master-data' && perms.can_access_master_data === false) {
                if (perms.can_access_master_data_weekly !== false) page = 'master-data-weekly';
                else if (perms.can_access_all_summary !== false) page = 'all-summary';
                else if (perms.can_access_weekly_summary !== false) page = 'weekly-summary';
                else page = 'user-management';
            } else if (page === 'master-data-weekly' && perms.can_access_master_data_weekly === false) {
                if (perms.can_access_master_data !== false) page = 'master-data';
                else if (perms.can_access_all_summary !== false) page = 'all-summary';
                else if (perms.can_access_weekly_summary !== false) page = 'weekly-summary';
                else page = 'user-management';
            } else if (page === 'reports' && perms.can_access_reports === false) {
                if (perms.can_access_all_summary !== false) page = 'all-summary';
                else if (perms.can_access_weekly_summary !== false) page = 'weekly-summary';
                else if (perms.can_access_master_data !== false) page = 'master-data';
                else if (perms.can_access_master_data_weekly !== false) page = 'master-data-weekly';
                else page = 'user-management';
            } else if (page === 'berita-acara' && perms.can_access_berita_acara === false) {
                if (perms.can_access_all_summary !== false) page = 'all-summary';
                else if (perms.can_access_weekly_summary !== false) page = 'weekly-summary';
                else if (perms.can_access_reports !== false) page = 'reports';
                else if (perms.can_access_master_data !== false) page = 'master-data';
                else if (perms.can_access_master_data_weekly !== false) page = 'master-data-weekly';
                else page = 'user-management';
            } else if (page === 'user-management' && perms.can_access_user_management === false) {
                if (perms.can_access_all_summary !== false) page = 'all-summary';
                else if (perms.can_access_weekly_summary !== false) page = 'weekly-summary';
                else if (perms.can_access_master_data !== false) page = 'master-data';
                else if (perms.can_access_master_data_weekly !== false) page = 'master-data-weekly';
            }
        }

        // Hide all page sections
        document.querySelectorAll('.page-section').forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
        });

        // Activate target section
        const targetSec = document.getElementById('page-' + page);
        if (targetSec) {
            targetSec.classList.add('active');
            targetSec.style.display = (page === 'login') ? 'flex' : 'block';
        }
        document.body.classList.toggle('page-is-login', page === 'login');

        // Update Navbar Tabs active state
        document.querySelectorAll('.navbar-menu .nav-link').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeNavTab = document.getElementById('tab-' + page);
        if (activeNavTab) activeNavTab.classList.add('active');

        // Persist page in sessionStorage
        try {
            sessionStorage.setItem('active_page', page);
        } catch (e) { }

        // Keep address bar URL clean
        keepCleanUrl();

        // Update drawer quick jump links for this active page
        renderQuickAccessList(page);

        // Toggle Chat Room FAB visibility (shown only on summary pages)
        const chatFab = document.getElementById('btn-chat-room-fab');
        const chatFabAll = document.getElementById('btn-chat-room-fab-all');
        if (chatFab) chatFab.style.display = (page === 'summary') ? 'inline-flex' : 'none';
        if (chatFabAll) chatFabAll.style.display = (page === 'all-summary') ? 'inline-flex' : 'none';

        // Page-specific data loaders
        if (page === 'summary') {
            if (!summaryInitialized || !isInit) {
                switchSOType(summarySOType || 'monthly', summaryCategory || 'pmd');
                summaryInitialized = true;
            }
        } else if (page === 'all-summary') {
            if (typeof AllSummaryApp !== 'undefined' && typeof AllSummaryApp.init === 'function') {
                AllSummaryApp.init();
            }
        } else if (page === 'weekly-summary') {
            const savedWeeklyCat = sessionStorage.getItem('weekly_category') || 'pmd';
            switchWeeklyCategory(savedWeeklyCat);
        } else if (page === 'master-data') {
            loadMasterData();
            loadSiteRegional();
            loadRekapDbData();
            loadScorecardKpi();
            loadMasterCatatan();
            loadPicSites();
            loadCircularPics();
            loadTemplateReports();
        } else if (page === 'master-data-weekly') {
            loadMasterDataWeekly();
        } else if (page === 'user-management') {
            loadUsers();
        } else if (page === 'reports') {
            const userDepts = getUserReportsDepts();
            const onlyPMD = (userDepts.length === 1 && userDepts[0] === 'PMD');
            if (onlyPMD) {
                reportsState.so_type = 'monthly';
                reportsState.dept = 'PMD';
            } else {
                const savedReportsSOType = sessionStorage.getItem('reports_so_type');
                if (savedReportsSOType && (savedReportsSOType === 'monthly' || savedReportsSOType === 'quarterly')) {
                    reportsState.so_type = savedReportsSOType;
                }
            }
            const btnM = document.getElementById('reports-btn-so-type-monthly');
            const btnQ = document.getElementById('reports-btn-so-type-quarterly');
            if (btnM && btnQ) {
                btnM.classList.toggle('active', reportsState.so_type === 'monthly');
                btnQ.classList.toggle('active', reportsState.so_type === 'quarterly');
            }
            updateReportsMonthDropdown();
            loadReportsData();
            loadReportsVerificationData();
        } else if (page === 'berita-acara') {
            initBeritaAcaraPage();
        }

        // Apply UAC rules (button visibility)
        applyUacPermissions();

        // Scroll to top on page switch
        if (!isInit) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }

    // ── Quick Access Sidebar & Smooth Scroll Navigation ────────
    const QUICK_ACCESS_ITEMS_SUMMARY = [
        { id: 'card-executive-summary', title: 'Executive Summary' },


        { id: 'card-scorecard-summary', title: 'Score Card Summary' },
        { id: 'card-trend-dept-wrapper', title: 'Trend Line Chart' },

        { id: 'card-result-db-chart', title: 'Result DB Analysis (Chart)' },
        { id: 'card-rekap-status-db', title: 'Status Penyelesaian DB' },

        { id: 'card-rekapitulasi', title: 'Tabel Rekapitulasi' },
        { id: 'card-site-movements', title: 'Log Pergerakan Site' }
    ];

    const QUICK_ACCESS_ITEMS_ALL_SUMMARY = [
        { id: 'all-card-executive-summary', title: 'Executive Summary (All)' },

        { id: 'all-card-scorecard-summary', title: 'Score Card Summary (All)' },
        { id: 'all-card-trend-all-wrapper', title: 'Trend Chart (All Sites)' },

        { id: 'all-card-rekap-status-db', title: 'DB Analysis & Status DB (All)' },

        { id: 'all-card-rekapitulasi', title: 'Tabel Rekapitulasi (All)' },
        { id: 'all-card-site-movements', title: 'Log Pergerakan Site' }
    ];

    const QUICK_ACCESS_ITEMS_WEEKLY_SUMMARY = [
        { id: 'weekly-card-executive-summary', title: 'Executive Summary (Weekly)' },
        { id: 'weekly-card-scorecard-summary', title: 'Score Card Summary (Weekly)' },
        { id: 'weekly-card-hasil-so', title: 'Report Stock Opname (Weekly)' }
    ];

    const QUICK_ACCESS_ITEMS_REPORTS = [
        { id: 'card-generate-report', title: 'Generate Report' },
        { id: 'card-verification-report', title: 'Verification Report' }
    ];

    const QUICK_ACCESS_ITEMS_BERITA_ACARA = [
        { id: 'card-berita-acara-table', title: 'Daftar Berita Acara Tindak Lanjut DB' }
    ];

    const QUICK_ACCESS_ITEMS_USER_MANAGEMENT = [
        { id: 'card-user-management', title: 'User Management & UAC' }
    ];

    const QUICK_ACCESS_ITEMS_MASTER = [
        { id: 'card-master-opname', title: 'Stock Opname Raw Data' },
        { id: 'card-site-regional', title: 'Master Site Regional' },
        { id: 'card-master-rekap-db', title: 'Master Rekap DB' },
        { id: 'card-master-catatan', title: 'Catatan & Evaluasi Master' },
        { id: 'card-pic-sites', title: 'PIC Sites Master Data' },
        { id: 'card-circular-pics', title: 'Circular Sign PIC Master Data' },
        { id: 'card-template-reports', title: 'Template Report Master Data' },
        { id: 'card-scorecard-rating-kpi', title: 'KPI Rating Master' },
        { id: 'card-scorecard-exec-kpi', title: 'KPI Execution Master' }
    ];

    const QUICK_ACCESS_ITEMS_MASTER_WEEKLY = [
        { id: 'card-master-opname-weekly', title: 'SO Profile Weekly' }
    ];

    function toggleQuickAccess() {
        const drawer = document.getElementById('quick-access-drawer');
        if (drawer && drawer.classList.contains('open')) {
            closeQuickAccess();
        } else {
            openQuickAccess();
        }
    }

    function openQuickAccess() {
        const activePage = sessionStorage.getItem('active_page') || 'summary';
        renderQuickAccessList(activePage);
        const drawer = document.getElementById('quick-access-drawer');
        const backdrop = document.getElementById('quick-access-backdrop');
        if (drawer) drawer.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeQuickAccess() {
        const drawer = document.getElementById('quick-access-drawer');
        const backdrop = document.getElementById('quick-access-backdrop');
        if (drawer) drawer.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    function renderQuickAccessList(page) {
        const container = document.getElementById('quick-access-nav-list');
        if (!container) return;

        let html = '';

        // Quick Access Section (Card Shortcuts for the active page)
        let items = QUICK_ACCESS_ITEMS_SUMMARY;
        if (page === 'all-summary') {
            items = QUICK_ACCESS_ITEMS_ALL_SUMMARY;
        } else if (page === 'weekly-summary') {
            items = QUICK_ACCESS_ITEMS_WEEKLY_SUMMARY;
        } else if (page === 'reports') {
            items = QUICK_ACCESS_ITEMS_REPORTS;
        } else if (page === 'berita-acara') {
            items = QUICK_ACCESS_ITEMS_BERITA_ACARA;
        } else if (page === 'master-data') {
            items = QUICK_ACCESS_ITEMS_MASTER;
        } else if (page === 'master-data-weekly') {
            items = QUICK_ACCESS_ITEMS_MASTER_WEEKLY;
        } else if (page === 'user-management') {
            items = QUICK_ACCESS_ITEMS_USER_MANAGEMENT;
        }

        items.forEach(item => {
            html += `
                <a class="quick-access-item" href="javascript:void(0)" onclick="App.scrollToCard('${item.id}');">
                    <span>${escapeHtml(item.title)}</span>
                </a>
            `;
        });
        container.innerHTML = html;
    }

    function scrollToCard(cardId) {
        closeQuickAccess();

        setTimeout(() => {
            const el = document.getElementById(cardId);
            if (!el) return;

            // Determine if sticky controls bar is visible on the active page
            const activePage = sessionStorage.getItem('active_page') || 'summary';
            let controlsHeight = 0;
            const controlsEl = (activePage === 'all-summary')
                ? document.getElementById('card-all-summary-controls')
                : document.getElementById('card-summary-controls');

            if (controlsEl && controlsEl.offsetParent !== null) {
                controlsHeight = controlsEl.offsetHeight || 0;
            }

            // Scroll with offset for sticky navbar (height: 56px / 52px) + sticky controls + spacing
            const navHeight = (window.innerWidth <= 768) ? 52 : 56;
            const yOffset = -(navHeight + controlsHeight + 16);
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }, 120);
    }

    // ── Navigate to Login View (SPA Clean URL) ────────────────
    function openLoginModal(targetPage) {
        pendingTargetPage = targetPage;
        closeQuickAccess();
        navigateTo('login');
    }

    function closeLoginModal() {
        const modal = document.getElementById('modal-login');
        if (modal) modal.style.display = 'none';
        keepCleanUrl();
    }

    function toggleLoginPassword() {
        const passInput = document.getElementById('login-page-password') || document.getElementById('login-modal-password');
        const eyeIcon = document.getElementById('login-page-eye-icon') || document.getElementById('login-modal-eye-icon');
        if (!passInput) return;

        if (passInput.type === 'password') {
            passInput.type = 'text';
            if (eyeIcon) eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
            passInput.type = 'password';
            if (eyeIcon) eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
    }
    const toggleLoginModalPassword = toggleLoginPassword;

    async function submitLogin(event) {
        if (event) event.preventDefault();

        const userInput = document.getElementById('login-page-username') || document.getElementById('login-modal-username');
        const passInput = document.getElementById('login-page-password') || document.getElementById('login-modal-password');
        const alertEl = document.getElementById('login-page-alert') || document.getElementById('login-modal-alert');
        const alertMsg = document.getElementById('login-page-alert-msg') || document.getElementById('login-modal-alert-msg');
        const submitBtn = document.getElementById('login-page-submit-btn') || document.getElementById('login-modal-submit-btn');
        const submitText = document.getElementById('login-page-submit-text') || document.getElementById('login-modal-submit-text');
        const spinner = document.getElementById('login-page-spinner') || document.getElementById('login-modal-spinner');
        const csrfInp = document.getElementById('login-page-csrf') || document.getElementById('login-modal-csrf');

        const username = userInput ? userInput.value.trim() : '';
        const password = passInput ? passInput.value : '';
        const activeCsrf = csrfInp ? csrfInp.value : csrfToken;

        if (!username || !password) {
            if (alertEl && alertMsg) {
                alertMsg.textContent = 'Username dan password wajib diisi.';
                alertEl.style.display = 'block';
            }
            return;
        }

        if (alertEl) alertEl.style.display = 'none';
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = 'Memverifikasi...';
        if (spinner) spinner.style.display = 'inline-block';

        try {
            const res = await fetch('login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': activeCsrf
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    csrf_token: activeCsrf
                })
            });

            const json = await res.json();
            if (json.success) {
                // Update client session state & fresh CSRF token
                if (json.csrf_token) {
                    updateCsrfToken(json.csrf_token);
                }

                window.AUTH_USER = json.user || {
                    name: username,
                    role: 'admin',
                    permissions: {}
                };

                closeLoginModal();

                const targetPage = (pendingTargetPage && pendingTargetPage !== 'summary') ? pendingTargetPage : 'all-summary';

                // Persist state for post-reload toast & navigation
                try {
                    sessionStorage.setItem('active_page', targetPage);
                    sessionStorage.setItem('login_success_toast', (window.AUTH_USER.name || 'Administrator'));
                } catch (e) { }

                // Clean reload so server PHP re-renders navbar tabs, permissions, and CSRF token fresh
                window.location.href = './';
                return;
            } else {
                if (res.status === 403 || json.error_code === 'CSRF_INVALID') {
                    await refreshCsrfToken();
                }
                if (alertEl && alertMsg) {
                    alertMsg.textContent = json.message || 'Username atau password tidak sesuai.';
                    alertEl.style.display = 'block';
                }
            }
        } catch (err) {
            console.error('Login error:', err);
            if (alertEl && alertMsg) {
                alertMsg.textContent = 'Terjadi kesalahan jaringan. Silakan coba kembali.';
                alertEl.style.display = 'block';
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (submitText) submitText.textContent = 'Login';
            if (spinner) spinner.style.display = 'none';
            keepCleanUrl();
        }
    }

    async function logout() {
        closeUserDropdown();
        closeQuickAccess();

        // Immediately hide protected tabs in navbar so UI responds instantly
        const tabSummary = document.getElementById('tab-summary');
        const tabAllSummary = document.getElementById('tab-all-summary');
        const tabWeeklySummary = document.getElementById('tab-weekly-summary');
        const tabReports = document.getElementById('tab-reports');
        const tabBeritaAcara = document.getElementById('tab-berita-acara');
        const tabMasterData = document.getElementById('tab-master-data');
        const tabMasterDataWeekly = document.getElementById('tab-master-data-weekly');
        const tabUserManagement = document.getElementById('tab-user-management');
        const userDropdown = document.getElementById('user-dropdown-container');
        const btnNavLogin = document.getElementById('btn-navbar-login');
        const btnNavLogout = document.getElementById('btn-navbar-logout');

        if (tabSummary) tabSummary.style.display = 'inline-flex';
        if (tabAllSummary) tabAllSummary.style.display = 'none';
        if (tabWeeklySummary) tabWeeklySummary.style.display = 'none';
        if (tabReports) tabReports.style.display = 'none';
        if (tabBeritaAcara) tabBeritaAcara.style.display = 'none';
        if (tabMasterData) tabMasterData.style.display = 'none';
        if (tabMasterDataWeekly) tabMasterDataWeekly.style.display = 'none';
        if (tabUserManagement) tabUserManagement.style.display = 'none';
        if (userDropdown) userDropdown.style.display = 'none';
        if (btnNavLogout) btnNavLogout.style.display = 'none';
        if (btnNavLogin) btnNavLogin.style.display = 'none';

        const btnGen = document.getElementById('btn-generate-executive-summary');
        if (btnGen) btnGen.style.display = 'none';
        const btnGenAll = document.getElementById('btn-generate-all-executive-summary');
        if (btnGenAll) btnGenAll.style.display = 'none';
        const btnGenWk = document.getElementById('btn-generate-weekly-executive-summary');
        if (btnGenWk) btnGenWk.style.display = 'none';

        // Clear local auth session state
        window.AUTH_USER = null;

        try {
            await fetch('logout.php', { method: 'POST' });
        } catch (e) { }

        // Clear local storage and set logout flag (preserve landing dismissed state so overlay doesn't reappear)
        try {
            const landingDismissed = sessionStorage.getItem('amora_landing_dismissed');
            sessionStorage.clear();
            sessionStorage.setItem('logout_toast', 'true');
            if (landingDismissed) {
                sessionStorage.setItem('amora_landing_dismissed', landingDismissed);
            }
        } catch (e) { }

        // Clean reload to ensure server session is completely destroyed and fresh guest CSRF token is loaded
        window.location.href = './';
    }

    function toggleUserDropdown(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const container = document.getElementById('user-dropdown-container');
        if (container) {
            container.classList.toggle('active');
        }
    }

    function closeUserDropdown() {
        const container = document.getElementById('user-dropdown-container');
        if (container) {
            container.classList.remove('active');
        }
    }

    // Global click listener to close user dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-dropdown-container');
        if (dropdown && dropdown.classList.contains('active')) {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        }
    });

    // ── Page 1: Stock Opname Master Data with Pagination ────────

    async function loadMasterData() {
        const tbody = document.getElementById('master-table-body');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="21" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    Loading records from PostgreSQL database...
                </td>
            </tr>
        `;

        try {
            const res = await fetch('api/reconciliation.php');
            const json = await res.json();

            if (!json.success) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="21" class="text-center" style="padding: 2rem; color: #dc2626;">
                            ${json.message || 'Error loading records from database'}
                        </td>
                    </tr>
                `;
                return;
            }

            allMasterRows = json.data || [];
            masterPeriodUpdates = json.period_updates || {};
            masterLatestUpdate = json.latest_update || null;
            applyFilterAndRender();
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="21" class="text-center" style="padding: 2rem; color: #dc2626;">
                        Network error loading records: ${escapeHtml(err.message || 'Unknown error')}
                    </td>
                </tr>
            `;
        }
    }

    // ── Search, Filter & Pagination ────────────────────────────

    function handleSearch(query) {
        searchQuery = (query || '').toLowerCase().trim();
        currentPage = 1;
        applyFilterAndRender();
    }

    function changePageSize(size) {
        pageSize = size === 'all' ? allMasterRows.length : parseInt(size, 10);
        currentPage = 1;
        applyFilterAndRender();
    }

    function goToPage(page) {
        const totalPages = Math.ceil(filteredMasterRows.length / pageSize) || 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;
        renderMasterTable();
    }

    function applyFilterAndRender() {
        let rows = allMasterRows.slice();

        // Apply Month filter
        const monthFilter = document.getElementById('filter-month');
        if (monthFilter && monthFilter.value) {
            const m = parseInt(monthFilter.value, 10);
            rows = rows.filter(r => {
                if (r.period_month !== undefined && r.period_month !== null && r.period_month !== '') {
                    return parseInt(r.period_month, 10) === m;
                }
                const endDate = r.period_end || '';
                if (endDate) {
                    const parts = endDate.split('-');
                    if (parts.length >= 2) {
                        return parseInt(parts[1], 10) === m;
                    }
                }
                const startDate = r.period_start || '';
                if (startDate) {
                    const parts = startDate.split('-');
                    if (parts.length >= 2) {
                        return parseInt(parts[1], 10) === m;
                    }
                }
                return false;
            });
        }

        // Apply Year filter
        const yearFilter = document.getElementById('filter-year');
        if (yearFilter && yearFilter.value) {
            const y = parseInt(yearFilter.value, 10);
            rows = rows.filter(r => {
                if (r.period_year !== undefined && r.period_year !== null && r.period_year !== '') {
                    return parseInt(r.period_year, 10) === y;
                }
                const endDate = r.period_end || '';
                if (endDate) {
                    const parts = endDate.split('-');
                    if (parts.length >= 1) {
                        return parseInt(parts[0], 10) === y;
                    }
                }
                const startDate = r.period_start || '';
                if (startDate) {
                    const parts = startDate.split('-');
                    if (parts.length >= 1) {
                        return parseInt(parts[0], 10) === y;
                    }
                }
                return false;
            });
        }

        // Apply text search
        if (searchQuery) {
            rows = rows.filter(r => {
                const profile = (r.profile || '').toLowerCase();
                const start = (r.period_start || '').toLowerCase();
                const end = (r.period_end || '').toLowerCase();
                return profile.includes(searchQuery) || start.includes(searchQuery) || end.includes(searchQuery);
            });
        }

        // Apply Sorting (Asc / Desc on header click)
        if (sortColumn) {
            const isNumeric = [
                'match_physic_qty', 'match_physic_pct', 'match_nbv_value', 'match_nbv_pct',
                'physic_physic_qty', 'physic_physic_pct', 'physic_nbv_value', 'physic_nbv_pct',
                'db_physic_qty', 'db_physic_pct', 'db_nbv_value', 'db_nbv_pct',
                'total_physic_actual', 'total_physic_target', 'total_physic_pct',
                'total_nbv_actual', 'total_nbv_target', 'total_nbv_pct'
            ].includes(sortColumn);

            rows.sort((a, b) => {
                let valA = a[sortColumn];
                let valB = b[sortColumn];

                if (isNumeric) {
                    valA = parseFloat(valA) || 0;
                    valB = parseFloat(valB) || 0;
                    return sortDirection === 'asc' ? valA - valB : valB - valA;
                } else {
                    valA = (valA || '').toString();
                    valB = (valB || '').toString();
                    return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                }
            });
        }

        filteredMasterRows = rows;
        currentPage = 1;
        updateMasterLastUpdateText();
        renderMasterTable();
    }

    function updateMasterLastUpdateText() {
        const el = document.getElementById('master-opname-last-update');
        if (!el) return;

        const monthFilter = document.getElementById('filter-month');
        const yearFilter = document.getElementById('filter-year');
        const m = monthFilter && monthFilter.value ? parseInt(monthFilter.value, 10) : null;
        const y = yearFilter && yearFilter.value ? parseInt(yearFilter.value, 10) : 2026;

        if (m && masterPeriodUpdates[`${m}_${y}`]) {
            el.textContent = masterPeriodUpdates[`${m}_${y}`].text;
        } else if (m) {
            const key = Object.keys(masterPeriodUpdates).find(k => k.startsWith(`${m}_`));
            if (key && masterPeriodUpdates[key]) {
                el.textContent = masterPeriodUpdates[key].text;
            } else {
                const indonesianMonths = [
                    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                ];
                const pName = indonesianMonths[m] || `Bulan ${m}`;
                el.textContent = `Last Update : Periode ${pName} (Belum ada data)`;
            }
        } else if (masterLatestUpdate && masterLatestUpdate.text) {
            el.textContent = masterLatestUpdate.text;
        } else {
            el.textContent = 'Last Update : Periode September (26 September 2026, 09:25:20 WIB)';
        }
    }

    // ── Table Header Sorting ───────────────────────────────────

    function toggleSort(col) {
        if (sortColumn === col) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = col;
            sortDirection = 'asc';
        }
        applyFilterAndRender();
        updateSortIndicators();
    }

    function updateSortIndicators() {
        document.querySelectorAll('#master-reconciliation-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#master-reconciliation-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (sortColumn) {
            const activeTh = document.querySelector(`#master-reconciliation-table th.sortable[onclick*="'${sortColumn}'"]`);
            if (activeTh) {
                activeTh.classList.add(sortDirection);
            }
            const activeInd = document.querySelector(`#master-reconciliation-table .sort-indicator[data-col="${sortColumn}"]`);
            if (activeInd) {
                activeInd.textContent = sortDirection === 'asc' ? '▲' : '▼';
            }
        }
    }

    function renderMasterTable() {
        const tbody = document.getElementById('master-table-body');
        const infoEl = document.getElementById('master-pagination-info');
        const controlsEl = document.getElementById('master-pagination-controls');
        if (!tbody) return;

        const totalItems = filteredMasterRows.length;

        if (totalItems === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="21" class="text-center" style="padding: 2.5rem; color: #64748b;">
                        ${allMasterRows.length === 0 ? "Tidak ada data Stock Opname." : "Data Stock Opname tidak ditemukan."}
                    </td>
                </tr>
            `;
            if (infoEl) infoEl.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            if (controlsEl) controlsEl.innerHTML = '';
            return;
        }

        const effectivePageSize = pageSize > 0 ? pageSize : totalItems;
        const totalPages = Math.ceil(totalItems / effectivePageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * effectivePageSize;
        const endIndex = Math.min(startIndex + effectivePageSize, totalItems);
        const pageRows = filteredMasterRows.slice(startIndex, endIndex);

        let html = '';
        pageRows.forEach(row => {
            html += `
                <tr>
                    <td class="text-left" style="font-weight: 500; max-width: 320px; white-space: normal;">
                        ${escapeHtml(row.profile)}
                    </td>
                    <td class="text-center">${escapeHtml(row.period_start)}</td>
                    <td class="text-center">${escapeHtml(row.period_end)}</td>

                    <!-- RESULT MATCH -->
                    <td class="text-right">${formatNumber(row.match_physic_qty)}</td>
                    <td class="text-right">${formatPercent(row.match_physic_pct)}</td>
                    <td class="text-right">${formatNumber(row.match_nbv_value)}</td>
                    <td class="text-right">${formatPercent(row.match_nbv_pct)}</td>

                    <!-- RESULT PHYSIC -->
                    <td class="text-right">${formatNumber(row.physic_physic_qty)}</td>
                    <td class="text-right">${formatPercent(row.physic_physic_pct)}</td>
                    <td class="text-right">${formatNumber(row.physic_nbv_value)}</td>
                    <td class="text-right">${formatPercent(row.physic_nbv_pct)}</td>

                    <!-- RESULT DB -->
                    <td class="text-right">${formatNumber(row.db_physic_qty)}</td>
                    <td class="text-right">${formatPercent(row.db_physic_pct)}</td>
                    <td class="text-right">${formatNumber(row.db_nbv_value)}</td>
                    <td class="text-right">${formatPercent(row.db_nbv_pct)}</td>

                    <!-- TOTAL -->
                    <td class="text-right" style="font-weight: 600;">${formatNumber(row.total_physic_actual)}</td>
                    <td class="text-right">${formatNumber(row.total_physic_target)}</td>
                    <td class="text-right" style="font-weight: 600;">${formatPercent(row.total_physic_pct)}</td>
                    <td class="text-right" style="font-weight: 600;">${formatNumber(row.total_nbv_actual)}</td>
                    <td class="text-right">${formatNumber(row.total_nbv_target)}</td>
                    <td class="text-right" style="font-weight: 600;">${formatPercent(row.total_nbv_pct)}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // Update info text
        if (infoEl) {
            infoEl.textContent = `Menampilkan ${totalItems > 0 ? (startIndex + 1).toLocaleString('id-ID') : 0} sampai ${endIndex.toLocaleString('id-ID')} dari ${totalItems.toLocaleString('id-ID')} data`;
        }

        // Generate pagination buttons
        if (controlsEl) {
            if (totalPages <= 1 || pageSize === 'all') {
                controlsEl.innerHTML = '';
            } else {
                let btnsHtml = '';
                btnsHtml += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="App.goToPage(${currentPage - 1})">&laquo; Prev</button>`;

                const maxButtons = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
                let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                if (endPage - startPage + 1 < maxButtons) {
                    startPage = Math.max(1, endPage - maxButtons + 1);
                }

                if (startPage > 1) {
                    btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(1)">1</button>`;
                    if (startPage > 2) btnsHtml += `<span class="pagination-ellipsis">...</span>`;
                }

                for (let p = startPage; p <= endPage; p++) {
                    btnsHtml += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="App.goToPage(${p})">${p}</button>`;
                }

                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) btnsHtml += `<span class="pagination-ellipsis">...</span>`;
                    btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(${totalPages})">${totalPages}</button>`;
                }

                btnsHtml += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="App.goToPage(${currentPage + 1})">Next &raquo;</button>`;

                controlsEl.innerHTML = btnsHtml;
            }
        }
    }

    // ── Delete Record ──────────────────────────────────────────

    async function deleteRecord(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.')) {
            return;
        }

        try {
            const res = await fetch(`api/reconciliation.php?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                }
            });

            const json = await res.json();

            if (json.success) {
                showToast('success', 'Berhasil Dihapus', json.message || 'Data berhasil dihapus.');
                // Remove from local data and re-render
                allMasterRows = allMasterRows.filter(r => r.id != id);
                applyFilterAndRender();
            } else {
                showToast('error', 'Gagal Menghapus', json.message || 'Gagal menghapus data.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Server', 'Gagal terhubung ke server.');
        }
    }

    // ── Site Regional Master Data ────────────────────────────────

    function getSRCategory() {
        if (srLevel1 === 'quarterly') {
            return 'quarterly';
        }
        return `monthly_${srLevel2}`;
    }

    function getSRCategoryLabel() {
        const labels = {
            'monthly_outlet': 'Monthly - Outlet Regional',
            'monthly_pmd': 'Monthly - PMD',
            'quarterly': 'Quarterly - Outlet Regional',
            'quarterly_outlet': 'Quarterly - Outlet Regional',
        };
        return labels[getSRCategory()] || getSRCategory();
    }

    function switchSRLevel1(level) {
        srLevel1 = level;
        document.querySelectorAll('.sr-tab-l1').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-sr-l1') === level);
        });

        // Sub-tabs (Outlet Regional / PMD) are only shown for Monthly
        const subTabs = document.getElementById('sr-tabs-level2');
        if (subTabs) {
            subTabs.style.display = (level === 'monthly') ? 'flex' : 'none';
        }

        // Reset search & selection on tab switch
        srSearchQuery = '';
        const searchInput = document.getElementById('sr-search-input');
        if (searchInput) searchInput.value = '';
        selectedSRIds.clear();
        srCurrentPage = 1;
        loadSiteRegional();
    }

    function switchSRLevel2(level) {
        srLevel2 = level;
        document.querySelectorAll('.sr-tab-l2').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-sr-l2') === level);
        });
        // Reset search & selection on tab switch
        srSearchQuery = '';
        const searchInput = document.getElementById('sr-search-input');
        if (searchInput) searchInput.value = '';
        selectedSRIds.clear();
        srCurrentPage = 1;
        loadSiteRegional();
    }

    async function loadSiteRegional() {
        const tbody = document.getElementById('sr-table-body');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    Loading Site Regional records...
                </td>
            </tr>
        `;

        try {
            const res = await fetch('api/site_regional.php');
            const json = await res.json();

            if (!json.success) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="12" class="text-center" style="padding: 2rem; color: #dc2626;">
                            ${escapeHtml(json.message || 'Error loading records')}
                        </td>
                    </tr>
                `;
                return;
            }

            allSRRows = json.data || [];
            populateSRFilters();
            applySRFilterAndRender();
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center" style="padding: 2rem; color: #dc2626;">
                        Network error: ${escapeHtml(err.message || 'Unknown error')}
                    </td>
                </tr>
            `;
        }
    }

    function populateSRFilters() {
        populateSRRegionalDropdown();
        populateSRDeptDropdown();
        populateSRSubDeptDropdown();
        populateSRInfoDropdown();
        populateSRGroupTypeDropdown();
        populateSRStatusDropdown();
    }

    function populateSRRegionalDropdown() {
        const regionalSelect = document.getElementById('sr-filter-regional');
        if (!regionalSelect) return;

        const regSet = new Set();
        allSRRows.forEach(r => {
            const v = (r.regional || '').trim();
            if (v) regSet.add(v);
        });

        const curVal = regionalSelect.value || srFilterRegional || 'all';
        let html = '<option value="all">Semua Regional</option>';
        Array.from(regSet).sort().forEach(reg => {
            html += `<option value="${escapeHtml(reg)}">${escapeHtml(reg)}</option>`;
        });
        regionalSelect.innerHTML = html;

        if (regSet.has(curVal)) {
            regionalSelect.value = curVal;
            srFilterRegional = curVal;
        } else {
            regionalSelect.value = 'all';
            srFilterRegional = 'all';
        }
    }

    function populateSRDeptDropdown() {
        const deptSelect = document.getElementById('sr-filter-dept');
        if (!deptSelect) return;

        const deptSet = new Set();
        allSRRows.forEach(r => {
            if (srFilterRegional === 'all' || (r.regional || '').trim() === srFilterRegional) {
                const d = (r.dept || '').trim();
                if (d) deptSet.add(d);
            }
        });

        const curVal = deptSelect.value || srFilterDept || 'all';
        let html = '<option value="all">Semua Dept</option>';
        Array.from(deptSet).sort().forEach(d => {
            html += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
        });
        deptSelect.innerHTML = html;

        if (deptSet.has(curVal)) {
            deptSelect.value = curVal;
            srFilterDept = curVal;
        } else {
            deptSelect.value = 'all';
            srFilterDept = 'all';
        }
    }

    function populateSRSubDeptDropdown() {
        const subDeptSelect = document.getElementById('sr-filter-subdept');
        if (!subDeptSelect) return;

        const subSet = new Set();
        allSRRows.forEach(r => {
            const matchesReg = (srFilterRegional === 'all' || (r.regional || '').trim() === srFilterRegional);
            const matchesDept = (srFilterDept === 'all' || (r.dept || '').trim() === srFilterDept);
            if (matchesReg && matchesDept) {
                const sd = (r.sub_dept || '').trim();
                if (sd) subSet.add(sd);
            }
        });

        const curVal = subDeptSelect.value || srFilterSubDept || 'all';
        let html = '<option value="all">Semua Sub Dept</option>';
        Array.from(subSet).sort().forEach(sd => {
            html += `<option value="${escapeHtml(sd)}">${escapeHtml(sd)}</option>`;
        });
        subDeptSelect.innerHTML = html;

        if (subSet.has(curVal)) {
            subDeptSelect.value = curVal;
            srFilterSubDept = curVal;
        } else {
            subDeptSelect.value = 'all';
            srFilterSubDept = 'all';
        }
    }

    function populateSRInfoDropdown() {
        const infoSelect = document.getElementById('sr-filter-info');
        if (!infoSelect) return;

        const infoSet = new Set();
        allSRRows.forEach(r => {
            const inf = (r.info || '').trim();
            if (inf) infoSet.add(inf);
        });

        const curVal = infoSelect.value || srFilterInfo || 'all';
        let html = '<option value="all">Semua Info</option>';
        Array.from(infoSet).sort().forEach(inf => {
            html += `<option value="${escapeHtml(inf)}">${escapeHtml(inf)}</option>`;
        });
        infoSelect.innerHTML = html;

        if (infoSet.has(curVal)) {
            infoSelect.value = curVal;
            srFilterInfo = curVal;
        } else {
            infoSelect.value = 'all';
            srFilterInfo = 'all';
        }
    }

    function populateSRGroupTypeDropdown() {
        const gtSelect = document.getElementById('sr-filter-grouptype');
        if (!gtSelect) return;

        const gtSet = new Set();
        allSRRows.forEach(r => {
            const gt = (r.group_type || '').trim().toLowerCase();
            if (gt) gtSet.add(gt);
        });

        const curVal = gtSelect.value || srFilterGroupType || 'all';
        let html = '<option value="all">Semua Group</option>';
        Array.from(gtSet).sort().forEach(gt => {
            const label = gt.charAt(0).toUpperCase() + gt.slice(1);
            html += `<option value="${escapeHtml(gt)}">${label}</option>`;
        });
        gtSelect.innerHTML = html;

        if (gtSet.has(curVal)) {
            gtSelect.value = curVal;
            srFilterGroupType = curVal;
        } else {
            gtSelect.value = 'all';
            srFilterGroupType = 'all';
        }
    }

    function populateSRStatusDropdown() {
        const statusSelect = document.getElementById('sr-filter-status');
        if (!statusSelect) return;
        const curVal = statusSelect.value || srFilterStatus || 'all';
        statusSelect.value = ['all', 'active', 'inactive'].includes(curVal) ? curVal : 'all';
        srFilterStatus = statusSelect.value;
    }

    function onSRRegionalFilterChange() {
        const sel = document.getElementById('sr-filter-regional');
        srFilterRegional = sel ? sel.value : 'all';
        populateSRDeptDropdown();
        populateSRSubDeptDropdown();
        srCurrentPage = 1;
        applySRFilterAndRender();
    }

    function onSRDeptFilterChange() {
        const sel = document.getElementById('sr-filter-dept');
        srFilterDept = sel ? sel.value : 'all';
        populateSRSubDeptDropdown();
        srCurrentPage = 1;
        applySRFilterAndRender();
    }

    function onSRSubDeptFilterChange() {
        const sel = document.getElementById('sr-filter-subdept');
        srFilterSubDept = sel ? sel.value : 'all';
        srCurrentPage = 1;
        applySRFilterAndRender();
    }

    function onSRInfoFilterChange() {
        const sel = document.getElementById('sr-filter-info');
        srFilterInfo = sel ? sel.value : 'all';
        srCurrentPage = 1;
        applySRFilterAndRender();
    }

    function onSRGroupTypeFilterChange() {
        const sel = document.getElementById('sr-filter-grouptype');
        srFilterGroupType = sel ? sel.value : 'all';
        srCurrentPage = 1;
        applySRFilterAndRender();
    }

    function onSRStatusFilterChange() {
        const sel = document.getElementById('sr-filter-status');
        srFilterStatus = sel ? sel.value : 'all';
        srCurrentPage = 1;
        applySRFilterAndRender();
    }

    function handleSRSearch(query) {
        srSearchQuery = (query || '').toLowerCase().trim();
        srCurrentPage = 1;
        applySRFilterAndRender();
    }

    function changeSRPageSize(size) {
        srPageSize = size === 'all' ? allSRRows.length : parseInt(size, 10);
        srCurrentPage = 1;
        applySRFilterAndRender();
    }

    function goToSRPage(page) {
        const effectiveSize = srPageSize > 0 ? srPageSize : (filteredSRRows.length || 1);
        const totalPages = Math.ceil(filteredSRRows.length / effectiveSize) || 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        srCurrentPage = page;
        renderSRTable();
    }

    function applySRFilterAndRender() {
        let rows = allSRRows.slice();

        if (srFilterRegional !== 'all' && srFilterRegional !== '') {
            rows = rows.filter(r => (r.regional || '').toString().trim() === srFilterRegional);
        }

        if (srFilterDept !== 'all' && srFilterDept !== '') {
            rows = rows.filter(r => (r.dept || '').toString().trim() === srFilterDept);
        }

        if (srFilterSubDept !== 'all' && srFilterSubDept !== '') {
            rows = rows.filter(r => (r.sub_dept || '').toString().trim() === srFilterSubDept);
        }

        if (srFilterInfo !== 'all' && srFilterInfo !== '') {
            rows = rows.filter(r => (r.info || '').toString().trim().toLowerCase() === srFilterInfo.toLowerCase());
        }

        if (srFilterGroupType !== 'all' && srFilterGroupType !== '') {
            rows = rows.filter(r => (r.group_type || '').toString().trim().toLowerCase() === srFilterGroupType.toLowerCase());
        }

        if (srFilterStatus !== 'all' && srFilterStatus !== '') {
            if (srFilterStatus === 'active') {
                rows = rows.filter(r => r.is_active !== false && r.is_active !== 0 && r.is_active !== '0' && r.is_active !== 'f');
            } else if (srFilterStatus === 'inactive') {
                rows = rows.filter(r => r.is_active === false || r.is_active === 0 || r.is_active === '0' || r.is_active === 'f');
            }
        }

        if (srSearchQuery) {
            rows = rows.filter(r => {
                const fields = [r.regional, r.dept, r.sub_dept, r.sitecode, r.name_site, r.info, r.group_type];
                return fields.some(f => (f || '').toString().toLowerCase().includes(srSearchQuery));
            });
        }

        if (srSortCol) {
            rows.sort((a, b) => {
                const valA = (a[srSortCol] || '').toString();
                const valB = (b[srSortCol] || '').toString();
                return srSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            });
        }

        filteredSRRows = rows;
        renderSRTable();
        updateSRSortIndicators();
    }

    function toggleSRSort(col) {
        if (srSortCol === col) {
            srSortDir = srSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            srSortCol = col;
            srSortDir = 'asc';
        }
        applySRFilterAndRender();
    }

    function updateSRSortIndicators() {
        document.querySelectorAll('#sr-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#sr-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (srSortCol) {
            const activeTh = document.querySelector(`#sr-table th.sortable[onclick*="'${srSortCol}'"]`);
            if (activeTh) {
                activeTh.classList.add(srSortDir);
            }
            const activeInd = document.querySelector(`#sr-table .sort-indicator[data-sr-col="${srSortCol}"]`);
            if (activeInd) {
                activeInd.textContent = srSortDir === 'asc' ? '▲' : '▼';
            }
        }
    }

    function renderSRTable() {
        const tbody = document.getElementById('sr-table-body');
        const infoEl = document.getElementById('sr-pagination-info');
        const controlsEl = document.getElementById('sr-pagination-controls');
        if (!tbody) return;

        const totalItems = filteredSRRows.length;

        if (totalItems === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center" style="padding: 2.5rem; color: #64748b;">
                        ${allSRRows.length === 0 ? "Tidak ada data Site Regional." : "Data tidak ditemukan."}
                    </td>
                </tr>
            `;
            if (infoEl) infoEl.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            if (controlsEl) controlsEl.innerHTML = '';
            updateSRSelectAllCheckbox();
            updateSRBulkDeleteButton();
            return;
        }

        const effectiveSize = srPageSize > 0 ? srPageSize : totalItems;
        const totalPages = Math.ceil(totalItems / effectiveSize) || 1;
        if (srCurrentPage > totalPages) srCurrentPage = totalPages;

        const startIndex = (srCurrentPage - 1) * effectiveSize;
        const endIndex = Math.min(startIndex + effectiveSize, totalItems);
        const pageRows = filteredSRRows.slice(startIndex, endIndex);

        let html = '';
        pageRows.forEach(row => {
            const isChecked = selectedSRIds.has(Number(row.id));
            const currentInfo = row.info || 'Outlet';
            const currentGt = row.group_type || 'monthly';
            const histCount = row.history_count || 0;
            const isActive = row.is_active !== false && row.is_active !== 0 && row.is_active !== '0' && row.is_active !== 'f';
            const isCounted = row.is_counted !== false && row.is_counted !== 0 && row.is_counted !== '0' && row.is_counted !== 'f';
            const isCountedWeekly = row.is_counted_weekly !== false && row.is_counted_weekly !== 0 && row.is_counted_weekly !== '0' && row.is_counted_weekly !== 'f';
            const isSynced = row.is_synced === true || row.is_synced === 1 || row.is_synced === '1' || row.is_synced === 't';
            html += `
                <tr class="${isChecked ? 'row-selected' : ''}">
                    <td class="text-center col-action-select">
                        <input type="checkbox" class="sr-row-checkbox" value="${row.id}" ${isChecked ? 'checked' : ''}
                            onchange="App.toggleSRSelection(${row.id}, this.checked)">
                    </td>
                    <td class="text-center col-action-delete">
                        <button class="btn btn-danger btn-sm btn-delete" onclick="App.deleteSRRecord(${row.id})">
                            Hapus
                        </button>
                    </td>
                    <td class="text-center col-action-active" style="padding: 4px;">
                        <input type="checkbox" class="sr-active-checkbox" ${isActive ? 'checked' : ''}
                            onchange="App.toggleSRActive(${row.id}, this.checked, this)"
                            style="cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb;">
                    </td>
                    <td class="text-center col-action-counted" style="padding: 4px;">
                        <input type="checkbox" class="sr-counted-checkbox" id="sr-counted-${row.id}"
                            ${isActive && isCounted ? 'checked' : ''}
                            ${!isActive ? 'disabled' : ''}
                            onchange="App.toggleSRCounted(${row.id}, this.checked, this)"
                            style="cursor: ${!isActive ? 'not-allowed' : 'pointer'}; width: 16px; height: 16px; accent-color: #16a34a; opacity: ${!isActive ? '0.45' : '1'};">
                    </td>
                    <td class="text-center col-action-sync" id="sr-sync-cell-${row.id}" style="padding: 3px 6px;">
                        ${!isSynced ? `
                            <button class="btn btn-primary btn-sm btn-sync-profile" id="sr-sync-btn-${row.id}"
                                onclick="App.syncSiteProfile(${row.id}, '${escapeHtml(row.sitecode || '')}', this)"
                                style="padding: 2px 7px; font-size: 11px; font-weight: 600; border-radius: 4px; background: #2563eb; color: #fff; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="23 4 23 10 17 10"></polyline>
                                    <polyline points="1 20 1 14 7 14"></polyline>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                </svg>
                                <span>Sync</span>
                            </button>
                        ` : ''}
                    </td>
                    <td class="text-center col-action-weekly" style="padding: 4px;">
                        <input type="checkbox" class="sr-weekly-checkbox" id="sr-weekly-${row.id}"
                            ${isActive && isCountedWeekly ? 'checked' : ''}
                            ${!isActive ? 'disabled' : ''}
                            onchange="App.toggleSRCountedWeekly(${row.id}, this.checked, this)"
                            style="cursor: ${!isActive ? 'not-allowed' : 'pointer'}; width: 16px; height: 16px; accent-color: #0284c7; opacity: ${!isActive ? '0.45' : '1'};">
                    </td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.dept || '')}</td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.sub_dept || '')}</td>
                    <td class="text-center" style="white-space: nowrap;">
                        ${escapeHtml(row.sitecode || '')}
                    </td>
                    <td class="text-left" style="min-width: 180px;">${escapeHtml(row.name_site || '')}</td>
                    <td class="text-center" style="white-space: nowrap;">
                        <select class="form-control form-control-sm sr-table-select"
                            onchange="App.updateSRInfo(${row.id}, this.value, this)"
                            style="min-width: 135px;">
                            <option value="Outlet" ${currentInfo === 'Outlet' ? 'selected' : ''}>Outlet</option>
                            <option value="Subarep" ${currentInfo === 'Subarep' ? 'selected' : ''}>Subarep</option>
                            <option value="HUB Monthly" ${currentInfo === 'HUB Monthly' ? 'selected' : ''}>HUB Monthly</option>
                            <option value="HUB Quarterly" ${currentInfo === 'HUB Quarterly' ? 'selected' : ''}>HUB Quarterly</option>
                            <option value="IT Coorporate" ${currentInfo === 'IT Coorporate' ? 'selected' : ''}>IT Coorporate</option>
                            ${(currentInfo === 'HUB' || currentInfo === 'Under Warehouse') ? `<option value="${escapeHtml(currentInfo)}" selected>${escapeHtml(currentInfo)}</option>` : ''}
                        </select>
                    </td>
                    <td class="text-center" style="white-space: nowrap;">
                        <div style="display: inline-flex; align-items: center; gap: 6px;">
                            <span style="min-width: 82px; display: inline-block; padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 6px; text-align: center; color: ${currentGt === 'quarterly' ? '#0284c7' : '#16a34a'}; background: ${currentGt === 'quarterly' ? '#e0f2fe' : '#dcfce7'}; border: 1px solid ${currentGt === 'quarterly' ? '#bae6fd' : '#bbf7d0'}; line-height: 16px;">
                                ${currentGt === 'quarterly' ? 'Quarterly' : 'Monthly'}
                            </span>
                            <button class="btn btn-outline-secondary btn-sm"
                                onclick="App.openSRHistoryModal('${escapeHtml(row.sitecode || '')}', '${escapeHtml(row.name_site || '')}')"
                                style="padding: 2px 8px; font-size: 11px; border-radius: 6px; white-space: nowrap; height: 26px;">
                                Edit
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        updateSRSelectAllCheckbox();
        updateSRBulkDeleteButton();

        if (infoEl) {
            infoEl.textContent = `Menampilkan ${totalItems > 0 ? (startIndex + 1).toLocaleString('id-ID') : 0} sampai ${endIndex.toLocaleString('id-ID')} dari ${totalItems.toLocaleString('id-ID')} data`;
        }

        if (controlsEl) {
            if (totalPages <= 1 || srPageSize === 'all') {
                controlsEl.innerHTML = '';
            } else {
                let btnsHtml = '';
                btnsHtml += `<button class="pagination-btn" ${srCurrentPage === 1 ? 'disabled' : ''} onclick="App.goToSRPage(${srCurrentPage - 1})">&laquo; Prev</button>`;

                const maxButtons = 5;
                let startPage = Math.max(1, srCurrentPage - Math.floor(maxButtons / 2));
                let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                if (endPage - startPage + 1 < maxButtons) {
                    startPage = Math.max(1, endPage - maxButtons + 1);
                }

                if (startPage > 1) {
                    btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(1)">1</button>`;
                    if (startPage > 2) btnsHtml += `<span class="pagination-ellipsis">...</span>`;
                }

                for (let p = startPage; p <= endPage; p++) {
                    btnsHtml += `<button class="pagination-btn ${p === srCurrentPage ? 'active' : ''}" onclick="App.goToSRPage(${p})">${p}</button>`;
                }

                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) btnsHtml += `<span class="pagination-ellipsis">...</span>`;
                    btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(${totalPages})">${totalPages}</button>`;
                }

                btnsHtml += `<button class="pagination-btn" ${srCurrentPage === totalPages ? 'disabled' : ''} onclick="App.goToSRPage(${srCurrentPage + 1})">Next &raquo;</button>`;

                controlsEl.innerHTML = btnsHtml;
            }
        }
    }

    function toggleSRSelection(id, checked) {
        const numId = Number(id);
        if (checked) {
            selectedSRIds.add(numId);
        } else {
            selectedSRIds.delete(numId);
        }
        updateSRSelectAllCheckbox();
        updateSRBulkDeleteButton();
    }

    function toggleSelectAllSR(checked) {
        const effectiveSize = srPageSize > 0 ? srPageSize : filteredSRRows.length;
        const startIndex = (srCurrentPage - 1) * effectiveSize;
        const endIndex = Math.min(startIndex + effectiveSize, filteredSRRows.length);
        const pageRows = filteredSRRows.slice(startIndex, endIndex);

        pageRows.forEach(row => {
            const numId = Number(row.id);
            if (checked) {
                selectedSRIds.add(numId);
            } else {
                selectedSRIds.delete(numId);
            }
        });

        document.querySelectorAll('.sr-row-checkbox').forEach(cb => {
            cb.checked = checked;
            const tr = cb.closest('tr');
            if (tr) tr.classList.toggle('row-selected', checked);
        });

        updateSRBulkDeleteButton();
    }

    function updateSRSelectAllCheckbox() {
        const selectAllEl = document.getElementById('sr-select-all');
        if (!selectAllEl) return;

        const effectiveSize = srPageSize > 0 ? srPageSize : filteredSRRows.length;
        const startIndex = (srCurrentPage - 1) * effectiveSize;
        const endIndex = Math.min(startIndex + effectiveSize, filteredSRRows.length);
        const pageRows = filteredSRRows.slice(startIndex, endIndex);

        if (pageRows.length === 0) {
            selectAllEl.checked = false;
            selectAllEl.indeterminate = false;
            return;
        }

        const pageSelectedCount = pageRows.filter(r => selectedSRIds.has(Number(r.id))).length;
        if (pageSelectedCount === 0) {
            selectAllEl.checked = false;
            selectAllEl.indeterminate = false;
        } else if (pageSelectedCount === pageRows.length) {
            selectAllEl.checked = true;
            selectAllEl.indeterminate = false;
        } else {
            selectAllEl.checked = false;
            selectAllEl.indeterminate = true;
        }
    }

    function updateSRBulkDeleteButton() {
        const bulkBtn = document.getElementById('sr-bulk-delete-btn');
        const countSpan = document.getElementById('sr-selected-count');
        const count = selectedSRIds.size;

        if (countSpan) countSpan.textContent = count;

        if (bulkBtn) {
            if (count > 0) {
                bulkBtn.style.display = 'inline-flex';
            } else {
                bulkBtn.style.display = 'none';
            }
        }
    }

    async function bulkDeleteSiteRegional() {
        const ids = Array.from(selectedSRIds);
        if (ids.length === 0) {
            showToast('error', 'Belum Ada Pilihan', 'Pilih minimal satu data untuk dihapus.');
            return;
        }

        const confirmMsg = `Apakah Anda yakin ingin menghapus secara permanen ${ids.length} data terpilih? Tindakan ini tidak dapat dibatalkan.`;
        if (!confirm(confirmMsg)) {
            return;
        }

        const bulkBtn = document.getElementById('sr-bulk-delete-btn');
        if (bulkBtn) {
            bulkBtn.disabled = true;
            bulkBtn.textContent = 'Menghapus...';
        }

        try {
            const res = await fetch('api/site_regional.php?action=bulk_delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ ids: ids })
            });

            const json = await res.json();
            if (json.success) {
                showToast('success', 'Hapus Massal Berhasil', json.message || `${ids.length} data berhasil dihapus.`);
                allSRRows = allSRRows.filter(r => !selectedSRIds.has(Number(r.id)));
                selectedSRIds.clear();
                updateSRBulkDeleteButton();
                applySRFilterAndRender();
            } else {
                showToast('error', 'Hapus Massal Gagal', json.message || 'Gagal menghapus data terpilih.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Server', 'Gagal berkomunikasi dengan server.');
        } finally {
            if (bulkBtn) {
                bulkBtn.disabled = false;
                updateSRBulkDeleteButton();
            }
        }
    }

    async function deleteSRRecord(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.')) {
            return;
        }

        try {
            const res = await fetch(`api/site_regional.php?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                }
            });

            const json = await res.json();
            if (json.success) {
                showToast('success', 'Data Dihapus', json.message || 'Data berhasil dihapus.');
                selectedSRIds.delete(Number(id));
                allSRRows = allSRRows.filter(r => r.id != id);
                applySRFilterAndRender();
                updateSRBulkDeleteButton();
            } else {
                showToast('error', 'Gagal Menghapus', json.message || 'Gagal menghapus data.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Server', 'Gagal terhubung ke server.');
        }
    }

    async function updateSRInfo(id, info, selectEl) {
        try {
            const res = await fetch('api/site_regional.php?action=update_info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ id: id, info: info })
            });
            const json = await res.json();
            if (json.success) {
                const row = allSRRows.find(r => r.id == id);
                if (row) {
                    row.info = info;
                    if (info === 'HUB Quarterly') {
                        row.group_type = 'quarterly';
                    } else if (info === 'HUB Monthly' || info === 'IT Coorporate' || info === 'IT Corporate') {
                        row.group_type = 'monthly';
                    }
                }
                if (selectEl) {
                    selectEl.classList.add('is-saved');
                    setTimeout(() => selectEl.classList.remove('is-saved'), 1200);
                }
                applySRFilterAndRender();
                showToast('success', 'Info Diperbarui', `Diperbarui menjadi ${info}`);
                if (typeof loadSummaryData === 'function') loadSummaryData();
            } else {
                showToast('error', 'Gagal Memperbarui', json.message || 'Gagal memperbarui info');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Jaringan', err.message);
        }
    }

    async function updateSRGroupType(id, groupType, selectEl) {
        try {
            const res = await fetch('api/site_regional.php?action=update_group_type', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ id: id, group_type: groupType })
            });
            const json = await res.json();
            if (json.success) {
                const row = allSRRows.find(r => r.id == id);
                if (row) row.group_type = groupType;
                if (selectEl) {
                    selectEl.style.color = (groupType === 'quarterly') ? '#0284c7' : '#16a34a';
                    selectEl.classList.add('is-saved');
                    setTimeout(() => selectEl.classList.remove('is-saved'), 1200);
                }
                showToast('success', 'Tipe Grup Diperbarui', `Diperbarui menjadi ${groupType}`);
                if (typeof loadSummaryData === 'function') loadSummaryData();
            } else {
                showToast('error', 'Gagal Memperbarui', json.message || 'Gagal memperbarui tipe grup');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Jaringan', err.message);
        }
    }

    async function toggleSRActive(id, isActive, checkboxEl) {
        try {
            const res = await fetch('api/site_regional.php?action=update_active', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ id: id, is_active: isActive })
            });
            const json = await res.json();
            if (json.success) {
                const row = allSRRows.find(r => r.id == id);
                if (row) row.is_active = isActive;

                // Update Count checkbox state for this row
                const countCb = document.getElementById(`sr-counted-${id}`) || checkboxEl?.closest('tr')?.querySelector('.sr-counted-checkbox');
                if (countCb) {
                    countCb.disabled = !isActive;
                    countCb.style.cursor = !isActive ? 'not-allowed' : 'pointer';
                    countCb.style.opacity = !isActive ? '0.45' : '1';
                    const isCounted = row ? (row.is_counted !== false && row.is_counted !== 0 && row.is_counted !== '0' && row.is_counted !== 'f') : countCb.checked;
                    countCb.checked = isActive && isCounted;
                }

                // Update Weekly checkbox state for this row
                const weeklyCb = document.getElementById(`sr-weekly-${id}`) || checkboxEl?.closest('tr')?.querySelector('.sr-weekly-checkbox');
                if (weeklyCb) {
                    weeklyCb.disabled = !isActive;
                    weeklyCb.style.cursor = !isActive ? 'not-allowed' : 'pointer';
                    weeklyCb.style.opacity = !isActive ? '0.45' : '1';
                    const isCountedWeekly = row ? (row.is_counted_weekly !== false && row.is_counted_weekly !== 0 && row.is_counted_weekly !== '0' && row.is_counted_weekly !== 'f') : weeklyCb.checked;
                    weeklyCb.checked = isActive && isCountedWeekly;
                }

                showToast('success', 'Status Diperbarui', `Status site diatur menjadi ${isActive ? 'Aktif' : 'Nonaktif'}`);
                if (typeof loadSummaryData === 'function') loadSummaryData();
                if (typeof loadRekapitulasi === 'function') loadRekapitulasi();
                if (typeof loadWeeklySummary === 'function') loadWeeklySummary();
            } else {
                if (checkboxEl) checkboxEl.checked = !isActive;
                showToast('error', 'Gagal Memperbarui', json.message || 'Gagal memperbarui status');
            }
        } catch (err) {
            if (checkboxEl) checkboxEl.checked = !isActive;
            showToast('error', 'Kesalahan Jaringan', err.message);
        }
    }

    async function toggleSRCounted(id, isCounted, checkboxEl) {
        try {
            const res = await fetch('api/site_regional.php?action=update_counted', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ id: id, is_counted: isCounted })
            });
            const json = await res.json();
            if (json.success) {
                const row = allSRRows.find(r => r.id == id);
                if (row) row.is_counted = isCounted;
                showToast('success', 'Status Hitung Diperbarui', `Site ${isCounted ? 'dihitung' : 'tidak dihitung'} dalam ringkasan & grafik`);
                if (typeof loadSummaryData === 'function') loadSummaryData();
                if (typeof loadRekapitulasi === 'function') loadRekapitulasi();
            } else {
                if (checkboxEl) checkboxEl.checked = !isCounted;
                showToast('error', 'Gagal Memperbarui', json.message || 'Gagal memperbarui status hitung');
            }
        } catch (err) {
            if (checkboxEl) checkboxEl.checked = !isCounted;
            showToast('error', 'Kesalahan Jaringan', err.message);
        }
    }

    async function toggleSRCountedWeekly(id, isCountedWeekly, checkboxEl) {
        try {
            const res = await fetch('api/site_regional.php?action=update_counted_weekly', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ id: id, is_counted_weekly: isCountedWeekly })
            });
            const json = await res.json();
            if (json.success) {
                const row = allSRRows.find(r => r.id == id);
                if (row) row.is_counted_weekly = isCountedWeekly;
                showToast('success', 'Status Mingguan Diperbarui', `Site ${isCountedWeekly ? 'dihitung' : 'tidak dihitung'} dalam ringkasan mingguan (Weekly Summary)`);
                if (typeof loadWeeklySummary === 'function') loadWeeklySummary();
            } else {
                if (checkboxEl) checkboxEl.checked = !isCountedWeekly;
                showToast('error', 'Gagal Memperbarui', json.message || 'Gagal memperbarui status mingguan');
            }
        } catch (err) {
            if (checkboxEl) checkboxEl.checked = !isCountedWeekly;
            showToast('error', 'Kesalahan Jaringan', err.message);
        }
    }

    async function syncSiteProfile(id, sitecode, btnEl) {
        if (!id || !sitecode) return;

        const originalHtml = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<span style="display:inline-block;animation:spin 0.75s linear infinite;">⟳</span> Sync...';
        }

        try {
            const res = await fetch('api/site_regional.php?action=sync_profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ id: Number(id), sitecode: sitecode })
            });
            const json = await res.json();
            if (json.success) {
                const row = allSRRows.find(r => Number(r.id) === Number(id));
                if (row) {
                    row.is_synced = true;
                    if (json.group_type) row.group_type = json.group_type;
                    if (json.mapped_count) row.history_count = (row.history_count || 0) + json.mapped_count;
                }
                if (btnEl) {
                    btnEl.style.background = '#16a34a';
                    btnEl.innerHTML = '✓ Synced';
                    setTimeout(() => {
                        const cell = document.getElementById(`sr-sync-cell-${id}`);
                        if (cell) cell.innerHTML = '';
                        renderSRTable();
                    }, 500);
                } else {
                    renderSRTable();
                }
                showToast('success', 'Sinkronisasi Berhasil', json.message || `Site ${sitecode} berhasil disinkronkan`);
                if (typeof loadRekapitulasi === 'function') loadRekapitulasi();
            } else {
                if (btnEl) {
                    btnEl.disabled = false;
                    btnEl.innerHTML = originalHtml;
                }
                showToast('error', 'Gagal Sinkronisasi', json.message || 'Gagal menyinkronkan profil');
            }
        } catch (err) {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = originalHtml;
            }
            showToast('error', 'Kesalahan Jaringan', err.message);
        }
    }

    async function syncAllSiteProfiles() {
        const btn = document.getElementById('btn-sync-all-sites');
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span style="display:inline-block;animation:spin 0.75s linear infinite;">⟳</span> Sync All...';
        }

        try {
            const res = await fetch('api/site_regional.php?action=sync_all_profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({})
            });
            const json = await res.json();
            if (json.success) {
                showToast('success', 'Sinkronisasi Berhasil', json.message || 'Semua site master data berhasil disinkronkan');
                await loadSiteRegional();
                if (typeof loadRekapitulasi === 'function') loadRekapitulasi();
            } else {
                showToast('error', 'Gagal Sinkronisasi', json.message || 'Gagal menyinkronkan seluruh site');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Jaringan', err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    }

    let currentHistorySitecode = '';

    async function openSRHistoryModal(sitecode, nameSite) {
        currentHistorySitecode = sitecode;
        const modal = document.getElementById('sr-history-modal');
        const titleEl = document.getElementById('sr-hist-modal-title');
        const subEl = document.getElementById('sr-hist-modal-subtitle');
        if (titleEl) titleEl.textContent = `Site Code: ${sitecode}`;
        if (subEl) subEl.textContent = nameSite || sitecode;

        if (modal) modal.classList.add('active');
        await loadSRHistory(sitecode);
    }

    function closeSRHistoryModal() {
        const modal = document.getElementById('sr-history-modal');
        if (modal) modal.classList.remove('active');
        currentHistorySitecode = '';
    }

    async function loadSRHistory(sitecode) {
        const tbody = document.getElementById('sr-hist-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 1.25rem;">Memuat aturan...</td></tr>';

        try {
            const res = await fetch(`api/site_regional.php?action=get_history&sitecode=${encodeURIComponent(sitecode)}`);
            const json = await res.json();
            if (!json.success || !json.data || json.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 1.25rem;">Belum ada aturan periode dinamis yang dikonfigurasi. Site menggunakan tipe grup default.</td></tr>';
                return;
            }

            const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            let html = '';
            json.data.forEach(rule => {
                const mName = monthNames[rule.effective_month] || rule.effective_month;
                const isQ = rule.group_type === 'quarterly';
                const isInactive = rule.group_type === 'inactive';
                const isUncounted = rule.group_type === 'uncounted';
                const badgeColor = isInactive ? '#64748b' : (isUncounted ? '#b45309' : (isQ ? '#0284c7' : '#16a34a'));
                const badgeBg = isInactive ? '#f1f5f9' : (isUncounted ? '#fef3c7' : (isQ ? '#e0f2fe' : '#dcfce7'));
                const border = isInactive ? 'border: 1px solid #cbd5e1;' : (isUncounted ? 'border: 1px solid #fde68a;' : '');

                html += `
                    <tr>
                        <td style="padding: 6px 10px; font-weight: 700;">${mName} ${rule.effective_year}</td>
                        <td style="padding: 6px 10px;">
                            <span style="background: ${badgeBg}; color: ${badgeColor}; ${border} padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 11px;">
                                ${rule.group_type.toUpperCase()}
                            </span>
                        </td>
                        <td style="padding: 6px 10px; color: #64748b;">${escapeHtml(rule.notes || '-')}</td>
                        <td style="padding: 6px 10px; text-align: center;">
                            <button class="btn btn-danger btn-xs" onclick="App.deleteSRHistoryRule(${rule.id})" style="padding: 2px 6px; font-size: 11px;">
                                Hapus
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444; padding: 1.25rem;">Gagal memuat aturan: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    async function addSRHistoryRule() {
        if (!currentHistorySitecode) return;
        const month = parseInt(document.getElementById('sr-hist-month')?.value || '1', 10);
        const year = parseInt(document.getElementById('sr-hist-year')?.value || '2026', 10);
        const groupType = document.getElementById('sr-hist-grouptype')?.value || 'monthly';

        try {
            const res = await fetch('api/site_regional.php?action=add_history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({
                    sitecode: currentHistorySitecode,
                    group_type: groupType,
                    effective_year: year,
                    effective_month: month,
                    notes: 'Aturan manual'
                })
            });
            const json = await res.json();
            if (json.success) {
                showToast('success', 'Aturan Disimpan', json.message || 'Aturan berhasil disimpan.');
                await loadSRHistory(currentHistorySitecode);
                loadSiteRegional();
                if (typeof loadSummaryData === 'function') loadSummaryData();
            } else {
                showToast('error', 'Gagal Menyimpan', json.message || 'Gagal menyimpan aturan.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Jaringan', err.message);
        }
    }

    async function deleteSRHistoryRule(historyId) {
        if (!confirm('Apakah Anda yakin ingin menghapus aturan periode ini?')) return;
        try {
            const res = await fetch('api/site_regional.php?action=delete_history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ id: historyId })
            });
            const json = await res.json();
            if (json.success) {
                showToast('success', 'Aturan Dihapus', json.message || 'Aturan berhasil dihapus.');
                await loadSRHistory(currentHistorySitecode);
                loadSiteRegional();
                if (typeof loadSummaryData === 'function') loadSummaryData();
            } else {
                showToast('error', 'Gagal Menghapus', json.message || 'Gagal menghapus aturan.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Jaringan', err.message);
        }
    }

    function openSiteRegionalImportModal() {
        const modal = document.getElementById('sr-import-modal');
        if (modal) {
            clearSRSelectedFile();
            const replaceCb = document.getElementById('sr-import-replace-existing');
            if (replaceCb) replaceCb.checked = false;

            // Update category label in modal
            const labelEl = document.getElementById('sr-import-category-label');
            if (labelEl) labelEl.textContent = 'Site Regional Master Data';

            const statusDiv = document.getElementById('sr-modal-import-status');
            if (statusDiv) statusDiv.style.display = 'none';

            modal.classList.add('active');
        }
    }

    function closeSiteRegionalImportModal() {
        const modal = document.getElementById('sr-import-modal');
        if (modal) {
            modal.classList.remove('active');
            clearSRSelectedFile();
        }
    }

    function setupSRDragAndDrop() {
        const dropZone = document.getElementById('sr-drag-drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleSRFileSelect(dt.files);
            }
        });
    }

    async function fetchExcelSheets(file) {
        const formData = new FormData();
        formData.append('excel_file', file);
        formData.append('csrf_token', csrfToken);

        const res = await fetch('api/excel_sheets.php', {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': csrfToken
            },
            body: formData
        });
        return await res.json();
    }

    async function handleSRFileSelect(files) {
        if (!files || files.length === 0) return;
        const file = files[0];

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            showToast('error', 'File Tidak Valid', 'Hanya file Excel (.xlsx, .xls) yang diperbolehkan.');
            return;
        }

        selectedSRFile = file;
        srFileToken = null;

        const displayEl = document.getElementById('sr-selected-file-display');
        const nameEl = document.getElementById('sr-selected-file-name');
        const sizeEl = document.getElementById('sr-selected-file-size');

        if (displayEl && nameEl && sizeEl) {
            nameEl.textContent = file.name;
            const sizeKb = Math.round(file.size / 1024);
            sizeEl.textContent = `(${sizeKb.toLocaleString()} KB)`;
            displayEl.style.display = 'block';
        }

        // Show sheet selection and set loading state
        const sheetGroup = document.getElementById('sr-import-sheet-group');
        const sheetSelect = document.getElementById('sr-import-sheet-select');
        const sheetHint = document.getElementById('sr-import-sheet-hint');
        const submitBtn = document.getElementById('sr-modal-import-btn');

        if (sheetGroup && sheetSelect) {
            sheetGroup.style.display = 'block';
            sheetSelect.innerHTML = '<option value="">Membaca sheet dari file...</option>';
            sheetSelect.disabled = true;
            if (sheetHint) sheetHint.textContent = 'Mohon tunggu saat membaca nama lembar kerja...';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Membaca sheet...';
        }

        try {
            const json = await fetchExcelSheets(file);
            if (json.success && json.sheets && json.sheets.length > 0) {
                srFileToken = json.file_token || null;
                sheetSelect.innerHTML = '';

                // Smart default selection based on current category
                let defaultSheetIndex = 0;
                const cat = getSRCategory();
                json.sheets.forEach((s, idx) => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    sheetSelect.appendChild(opt);

                    const sLower = s.toLowerCase();
                    if (cat === 'monthly_outlet' && (sLower.includes('outlet') || sLower.includes('regional'))) {
                        defaultSheetIndex = idx;
                    } else if (cat === 'monthly_pmd' && sLower.includes('pmd')) {
                        defaultSheetIndex = idx;
                    } else if (cat === 'quarterly' && (sLower.includes('quarter') || sLower.includes('q'))) {
                        defaultSheetIndex = idx;
                    }
                });

                sheetSelect.selectedIndex = defaultSheetIndex;
                sheetSelect.disabled = false;
                if (sheetHint) {
                    sheetHint.textContent = json.sheets.length === 1
                        ? '1 sheet terdeteksi pada file.'
                        : `${json.sheets.length} sheet ditemukan. Silakan pilih sheet untuk diimpor.`;
                }
            } else {
                sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
                sheetSelect.disabled = false;
                if (sheetHint) sheetHint.textContent = json.message || 'Tidak dapat membaca sheet; sheet default akan digunakan.';
            }
        } catch (err) {
            sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
            sheetSelect.disabled = false;
            if (sheetHint) sheetHint.textContent = 'Tidak dapat membaca sheet; sheet default akan digunakan.';
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah & Impor';
            }
        }
    }

    function clearSRSelectedFile() {
        selectedSRFile = null;
        srFileToken = null;
        const fileInput = document.getElementById('sr-import-file-input');
        if (fileInput) fileInput.value = '';

        const displayEl = document.getElementById('sr-selected-file-display');
        if (displayEl) displayEl.style.display = 'none';

        const sheetGroup = document.getElementById('sr-import-sheet-group');
        const sheetSelect = document.getElementById('sr-import-sheet-select');
        const sheetHint = document.getElementById('sr-import-sheet-hint');
        if (sheetGroup) sheetGroup.style.display = 'none';
        if (sheetSelect) {
            sheetSelect.innerHTML = '<option value="">Pilih Sheet...</option>';
            sheetSelect.disabled = false;
        }
        if (sheetHint) sheetHint.textContent = '';

        const submitBtn = document.getElementById('sr-modal-import-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unggah & Impor';
        }
    }

    async function submitSRImport() {
        if (!selectedSRFile) {
            showToast('error', 'File Belum Dipilih', 'Silakan pilih atau seret & lepas file Excel.');
            return;
        }

        const submitBtn = document.getElementById('sr-modal-import-btn');
        const statusDiv = document.getElementById('sr-modal-import-status');
        const replaceExisting = document.getElementById('sr-import-replace-existing')?.checked ? '1' : '0';
        const category = getSRCategory();

        const sheetSelect = document.getElementById('sr-import-sheet-select');
        const sheetName = sheetSelect ? sheetSelect.value : '';

        const formData = new FormData();
        formData.append('action', 'import');
        formData.append('category', category);
        formData.append('replace_existing', replaceExisting);
        formData.append('sheet_name', sheetName);
        if (srFileToken) {
            formData.append('file_token', srFileToken);
        } else {
            formData.append('excel_file', selectedSRFile);
        }
        formData.append('csrf_token', csrfToken);

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Mengunggah...';
        }

        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#eff6ff';
            statusDiv.style.color = '#1d4ed8';
            statusDiv.style.border = '1px solid #bfdbfe';
            statusDiv.textContent = `Mengunggah dan mengimpor data ${getSRCategoryLabel()}...`;
        }

        try {
            const res = await fetch(`api/site_regional.php?action=import&category=${category}`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                },
                body: formData
            });

            const json = await res.json();

            if (json.success) {
                if (statusDiv) {
                    statusDiv.style.background = '#f0fdf4';
                    statusDiv.style.color = '#15803d';
                    statusDiv.style.border = '1px solid #bbf7d0';
                    statusDiv.textContent = json.message || 'Impor berhasil!';
                }

                showToast('success', 'Impor Selesai', json.message || 'Data berhasil diimpor.');

                loadSiteRegional();

                setTimeout(() => {
                    closeSiteRegionalImportModal();
                }, 1200);
            } else {
                if (statusDiv) {
                    statusDiv.style.background = '#fef2f2';
                    statusDiv.style.color = '#b91c1c';
                    statusDiv.style.border = '1px solid #fecaca';
                    statusDiv.textContent = json.message || 'Impor gagal.';
                }
                showToast('error', 'Impor Gagal', json.message || 'Gagal mengimpor data.');
            }
        } catch (err) {
            if (statusDiv) {
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = 'Kesalahan koneksi saat mengunggah file.';
            }
            showToast('error', 'Kesalahan Server', 'Gagal terhubung ke server.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah & Impor';
            }
        }
    }

    // ── Rekap DB Master Data Management ─────────────────────────
    let rekapDbCurrentPage = 1;
    let rekapDbPageSize = 10;
    let rekapDbSearchTerm = '';
    let rekapDbFilterMonth = '';
    let rekapDbFilterYear = '';
    let rekapDbSortCol = 'id';
    let rekapDbSortDir = 'asc';
    let selectedRekapDbFile = null;
    let rekapDbSearchDebounce = null;

    function setupRekapDbDragAndDrop() {
        const dropZone = document.getElementById('rekap-db-drag-drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleRekapDbFileSelect(dt.files);
            }
        });
    }

    async function loadRekapDbData() {
        const tbody = document.getElementById('rekap-db-tbody');
        const pageInfo = document.getElementById('rekap-db-pagination-info');
        const paginationControls = document.getElementById('rekap-db-pagination-controls');

        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
                        <span class="spinner" style="width: 16px; height: 16px;"></span>
                        <span>Memuat data Rekap DB...</span>
                    </div>
                </td>
            </tr>
        `;

        try {
            const params = new URLSearchParams({
                page: rekapDbCurrentPage,
                limit: rekapDbPageSize,
                month: rekapDbFilterMonth,
                year: rekapDbFilterYear,
                search: rekapDbSearchTerm,
                sort_col: rekapDbSortCol,
                sort_dir: rekapDbSortDir
            });

            const res = await fetch(`api/rekap_db.php?${params.toString()}`);
            const json = await res.json();

            if (!json.success) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center" style="padding: 2rem; color: #ef4444;">
                            Gagal memuat data: ${escapeHtml(json.message || 'Kesalahan sistem')}
                        </td>
                    </tr>
                `;
                return;
            }

            const rows = json.data || [];
            const total = json.total || 0;

            if (rows.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center" style="padding: 2.5rem; color: #94a3b8;">
                            Tidak ada data Rekap DB.
                        </td>
                    </tr>
                `;
                if (pageInfo) pageInfo.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
                if (paginationControls) paginationControls.innerHTML = '';
                return;
            }

            const startIdx = rekapDbPageSize === 'all' ? 0 : (json.page - 1) * parseInt(json.limit, 10);

            let html = '';
            rows.forEach((r, i) => {
                const no = startIdx + i + 1;
                const sitecode = escapeHtml(r.sitecode || '-');
                const regNo = escapeHtml(r.reg_no || '-');
                const name = escapeHtml(r.name || '-');
                const sn = escapeHtml(r.sn || '-');
                const nbvNum = parseFloat(r.nbv || 0);
                const nbvFormatted = Number(nbvNum).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                html += `
                    <tr>
                        <td class="text-center" style="color: #64748b; font-weight: 600;">${no}</td>
                        <td class="text-center" style="font-weight: 700; color: #0284c7;">${sitecode}</td>
                        <td class="text-center" style="font-weight: 600; color: #1e293b;">${regNo}</td>
                        <td class="text-left" style="font-weight: 500; color: #334155; word-break: break-word;">${name}</td>
                        <td class="text-center" style="font-weight: 500; color: #475569;">${sn}</td>
                        <td class="text-right" style="font-weight: 700; color: #0f172a; white-space: nowrap;">Rp ${nbvFormatted}</td>
                        <td class="text-center col-action">
                            <button class="btn btn-danger btn-sm btn-delete" onclick="App.deleteRekapDbItem(${r.id})">
                                Hapus
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

            // Update Pagination Info
            if (pageInfo) {
                const endIdx = rekapDbPageSize === 'all' ? total : Math.min(startIdx + rows.length, total);
                pageInfo.textContent = `Menampilkan ${startIdx + 1} sampai ${endIdx} dari ${total.toLocaleString()} data`;
            }

            renderRekapDbPagination(json.page, json.total_pages);

        } catch (err) {
            console.error('Error loading rekap db data:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center" style="padding: 2rem; color: #ef4444;">
                        Kesalahan jaringan saat memuat Rekap DB: ${escapeHtml(err.message || 'Unknown error')}
                    </td>
                </tr>
            `;
        }
    }

    function renderRekapDbPagination(currentPage, totalPages) {
        const controls = document.getElementById('rekap-db-pagination-controls');
        if (!controls) return;

        if (totalPages <= 1 || rekapDbPageSize === 'all') {
            controls.innerHTML = '';
            return;
        }

        let html = '';
        html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="App.goToRekapDbPage(${currentPage - 1})">&laquo; Prev</button>`;

        const maxButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        if (startPage > 1) {
            html += `<button class="pagination-btn" onclick="App.goToRekapDbPage(1)">1</button>`;
            if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
        }

        for (let p = startPage; p <= endPage; p++) {
            html += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="App.goToRekapDbPage(${p})">${p}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
            html += `<button class="pagination-btn" onclick="App.goToRekapDbPage(${totalPages})">${totalPages}</button>`;
        }

        html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="App.goToRekapDbPage(${currentPage + 1})">Next &raquo;</button>`;
        controls.innerHTML = html;
    }

    function goToRekapDbPage(p) {
        rekapDbCurrentPage = p;
        loadRekapDbData();
    }

    function changeRekapDbPageSize(sz) {
        rekapDbPageSize = sz;
        rekapDbCurrentPage = 1;
        loadRekapDbData();
    }

    function applyRekapDbFilter() {
        rekapDbFilterMonth = document.getElementById('rekap-db-filter-month')?.value || '';
        rekapDbFilterYear = document.getElementById('rekap-db-filter-year')?.value || '';
        rekapDbCurrentPage = 1;
        loadRekapDbData();
    }

    function handleRekapDbSearch(term) {
        clearTimeout(rekapDbSearchDebounce);
        rekapDbSearchDebounce = setTimeout(() => {
            rekapDbSearchTerm = (term || '').trim();
            rekapDbCurrentPage = 1;
            loadRekapDbData();
        }, 300);
    }

    function toggleRekapDbSort(col) {
        if (rekapDbSortCol === col) {
            rekapDbSortDir = (rekapDbSortDir === 'asc') ? 'desc' : 'asc';
        } else {
            rekapDbSortCol = col;
            rekapDbSortDir = 'asc';
        }

        document.querySelectorAll('[data-rdb-col]').forEach(el => {
            if (el.getAttribute('data-rdb-col') === col) {
                el.textContent = rekapDbSortDir === 'asc' ? '▲' : '▼';
            } else {
                el.textContent = '⇅';
            }
        });

        rekapDbCurrentPage = 1;
        loadRekapDbData();
    }

    // Modal & File Handlers for Rekap DB Import
    function openRekapDbImportModal() {
        const modal = document.getElementById('rekap-db-import-modal');
        if (!modal) return;
        clearRekapDbSelectedFile();
        const statusDiv = document.getElementById('modal-rekap-db-import-status');
        if (statusDiv) statusDiv.style.display = 'none';
        modal.classList.add('active');
    }

    function closeRekapDbImportModal() {
        const modal = document.getElementById('rekap-db-import-modal');
        if (modal) modal.classList.remove('active');
        clearRekapDbSelectedFile();
    }

    function handleRekapDbFileSelect(files) {
        if (!files || files.length === 0) return;
        selectedRekapDbFile = files[0];
        const display = document.getElementById('rekap-db-selected-file-display');
        const nameEl = document.getElementById('rekap-db-selected-file-name');
        const sizeEl = document.getElementById('rekap-db-selected-file-size');
        const zone = document.getElementById('rekap-db-drag-drop-zone');

        if (nameEl) nameEl.textContent = selectedRekapDbFile.name;
        if (sizeEl) sizeEl.textContent = `(${Math.round(selectedRekapDbFile.size / 1024)} KB)`;
        if (display) display.style.display = 'block';
        if (zone) zone.style.display = 'none';
    }

    function clearRekapDbSelectedFile() {
        selectedRekapDbFile = null;
        const input = document.getElementById('rekap-db-import-file-input');
        if (input) input.value = '';
        const display = document.getElementById('rekap-db-selected-file-display');
        const zone = document.getElementById('rekap-db-drag-drop-zone');
        if (display) display.style.display = 'none';
        if (zone) zone.style.display = 'block';
    }

    async function submitRekapDbImport() {
        if (!selectedRekapDbFile) {
            showToast('error', 'File Belum Dipilih', 'Silakan pilih file Excel atau CSV Rekap DB.');
            return;
        }

        const monthSelect = document.getElementById('rekap-db-import-month');
        const yearSelect = document.getElementById('rekap-db-import-year');
        const replaceCheck = document.getElementById('rekap-db-import-replace');
        const submitBtn = document.getElementById('rekap-db-modal-upload-btn');
        const statusDiv = document.getElementById('modal-rekap-db-import-status');

        const month = monthSelect ? monthSelect.value : '';
        const year = yearSelect ? yearSelect.value : '';
        const replaceExisting = replaceCheck && replaceCheck.checked ? '1' : '0';

        const formData = new FormData();
        formData.append('action', 'import');
        formData.append('month', month);
        formData.append('year', year);
        formData.append('replace_existing', replaceExisting);
        formData.append('excel_file', selectedRekapDbFile);
        formData.append('csrf_token', csrfToken);

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Mengunggah & Mengimpor...';
        }

        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#eff6ff';
            statusDiv.style.color = '#1d4ed8';
            statusDiv.style.border = '1px solid #bfdbfe';
            statusDiv.textContent = 'Memproses data Rekap DB...';
        }

        try {
            const res = await fetch('api/rekap_db.php', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                },
                body: formData
            });

            const rawText = await res.text();
            let json;
            try {
                json = JSON.parse(rawText);
            } catch (e) {
                console.error('Non-JSON response:', rawText);
                if (statusDiv) {
                    statusDiv.style.background = '#fef2f2';
                    statusDiv.style.color = '#b91c1c';
                    statusDiv.style.border = '1px solid #fecaca';
                    statusDiv.textContent = 'Kesalahan server: ' + (rawText.replace(/<[^>]*>?/gm, '').trim().substring(0, 150) || 'Respon server tidak valid');
                }
                showToast('error', 'Kesalahan Server', 'Gagal memproses data di server.');
                return;
            }

            if (json.success) {
                if (statusDiv) {
                    statusDiv.style.background = '#f0fdf4';
                    statusDiv.style.color = '#15803d';
                    statusDiv.style.border = '1px solid #bbf7d0';
                    statusDiv.textContent = json.message || 'Impor data Rekap DB berhasil!';
                }
                showToast('success', 'Impor Rekap DB Berhasil', json.message || 'Data berhasil diimpor.');

                // Sync filter and reload table
                const filterMonth = document.getElementById('rekap-db-filter-month');
                const filterYear = document.getElementById('rekap-db-filter-year');
                if (filterMonth && month) filterMonth.value = month;
                if (filterYear && year) filterYear.value = year;
                rekapDbFilterMonth = month;
                rekapDbFilterYear = year;
                rekapDbCurrentPage = 1;
                loadRekapDbData();

                setTimeout(() => {
                    closeRekapDbImportModal();
                }, 1200);
            } else {
                if (statusDiv) {
                    statusDiv.style.background = '#fef2f2';
                    statusDiv.style.color = '#b91c1c';
                    statusDiv.style.border = '1px solid #fecaca';
                    statusDiv.textContent = json.message || 'Impor Rekap DB gagal.';
                }
                showToast('error', 'Impor Gagal', json.message || 'Gagal mengimpor file Rekap DB.');
            }

        } catch (err) {
            console.error('Upload fetch error:', err);
            if (statusDiv) {
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = 'Kesalahan koneksi: ' + (err.message || 'Gagal terhubung');
            }
            showToast('error', 'Kesalahan Jaringan', err.message || 'Gagal terhubung ke server.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah & Impor';
            }
        }
    }

    // Bulk Delete Rekap DB
    function openRekapDbBulkDeleteModal() {
        const modal = document.getElementById('rekap-db-bulk-delete-modal');
        if (!modal) return;
        const curM = document.getElementById('rekap-db-filter-month')?.value || '';
        const curY = document.getElementById('rekap-db-filter-year')?.value || '';
        const modalM = document.getElementById('rekap-db-bulk-delete-month');
        const modalY = document.getElementById('rekap-db-bulk-delete-year');
        if (modalM && curM) modalM.value = curM;
        if (modalY && curY) modalY.value = curY;
        modal.classList.add('active');
    }

    function closeRekapDbBulkDeleteModal() {
        const modal = document.getElementById('rekap-db-bulk-delete-modal');
        if (!modal) return;
        modal.classList.remove('active');
    }

    async function submitRekapDbBulkDelete() {
        const monthSelect = document.getElementById('rekap-db-bulk-delete-month');
        const yearSelect = document.getElementById('rekap-db-bulk-delete-year');
        const submitBtn = document.getElementById('rekap-db-bulk-delete-submit-btn');

        const month = monthSelect ? monthSelect.value : '';
        const year = yearSelect ? yearSelect.value : '';

        if (!year && !month) {
            showToast('error', 'Pilihan Diperlukan', 'Pilih minimal Bulan atau Tahun yang akan dihapus.');
            return;
        }

        const monthName = month ? monthSelect.options[monthSelect.selectedIndex].text : 'Semua Bulan';
        const confirmMsg = `Apakah Anda yakin ingin menghapus permanen data Rekap DB untuk:\nBulan: ${monthName}\nTahun: ${year || 'Semua Tahun'}?\n\nTindakan ini tidak dapat dibatalkan!`;

        if (!confirm(confirmMsg)) {
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Menghapus...';
        }

        try {
            const formData = new FormData();
            formData.append('action', 'bulk_delete');
            formData.append('month', month);
            formData.append('year', year);
            formData.append('csrf_token', csrfToken);

            const res = await fetch('api/rekap_db.php', {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrfToken },
                body: formData
            });
            const json = await res.json();

            if (json.success) {
                showToast('success', 'Hapus Berhasil', json.message || 'Data Rekap DB berhasil dihapus.');
                closeRekapDbBulkDeleteModal();
                loadRekapDbData();
            } else {
                showToast('error', 'Hapus Gagal', json.message || 'Gagal menghapus data.');
            }
        } catch (err) {
            console.error('Bulk delete error:', err);
            showToast('error', 'Kesalahan Sistem', 'Gagal berkomunikasi dengan server.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Hapus Data Rekap DB';
            }
        }
    }

    async function deleteRekapDbItem(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus baris data Rekap DB ini?')) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('action', 'delete');
            formData.append('id', id);
            formData.append('csrf_token', csrfToken);

            const res = await fetch('api/rekap_db.php', {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrfToken },
                body: formData
            });
            const json = await res.json();

            if (json.success) {
                showToast('success', 'Data Dihapus', 'Baris data berhasil dihapus.');
                loadRekapDbData();
            } else {
                showToast('error', 'Gagal Menghapus', json.message || 'Gagal menghapus data.');
            }
        } catch (err) {
            console.error('Delete item error:', err);
            showToast('error', 'Kesalahan Sistem', 'Gagal berkomunikasi dengan server.');
        }
    }

    // ── Score Card KPI Master Data ───────────────────────────────

    let scorecardKpiData = [];
    let isEditingScorecardKpi = false;
    let scorecardExecKpiData = [];
    let isEditingScorecardExecKpi = false;

    async function loadScorecardKpi() {
        const tbodyRating = document.getElementById('kpi-config-tbody');
        const tbodyExec = document.getElementById('kpi-exec-config-tbody');
        if (!tbodyRating && !tbodyExec) return;

        try {
            const res = await fetch('api/scorecard_kpi.php');
            const json = await res.json();
            if (json.success) {
                scorecardKpiData = json.rating || json.data || [];
                scorecardExecKpiData = json.execution || [];
                renderScorecardKpiTable();
                renderScorecardExecKpiTable();
            } else {
                if (tbodyRating) tbodyRating.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 1.5rem; color: #dc2626;">Gagal memuat konfigurasi KPI: ${escapeHtml(json.message || 'Data tidak tersedia')}</td></tr>`;
                if (tbodyExec) tbodyExec.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 1.5rem; color: #dc2626;">Gagal memuat konfigurasi KPI.</td></tr>`;
            }
        } catch (err) {
            if (tbodyRating) tbodyRating.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 1.5rem; color: #dc2626;">Kesalahan server saat memuat KPI.</td></tr>`;
            if (tbodyExec) tbodyExec.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 1.5rem; color: #dc2626;">Kesalahan server saat memuat KPI.</td></tr>`;
        }
    }

    function renderScorecardKpiTable() {
        const tbody = document.getElementById('kpi-config-tbody');
        if (!tbody) return;

        if (!scorecardKpiData || scorecardKpiData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 1.5rem; color: #64748b;">Belum ada data konfigurasi KPI.</td></tr>`;
            return;
        }

        const editBtn = document.getElementById('kpi-edit-btn');
        const resetBtn = document.getElementById('kpi-reset-btn');
        const saveBtn = document.getElementById('kpi-save-btn');

        if (editBtn) {
            editBtn.textContent = isEditingScorecardKpi ? 'Batal' : 'Edit Range (%)';
            editBtn.className = isEditingScorecardKpi ? 'btn btn-secondary' : 'btn btn-primary';
        }
        if (resetBtn) resetBtn.style.display = isEditingScorecardKpi ? 'inline-flex' : 'none';
        if (saveBtn) saveBtn.style.display = isEditingScorecardKpi ? 'inline-flex' : 'none';

        const badgeClassMap = {
            'very_poor': 'badge-rating-vp',
            'poor': 'badge-rating-p',
            'moderate': 'badge-rating-m',
            'good': 'badge-rating-g',
            'very_good': 'badge-rating-vg'
        };

        let html = '';

        scorecardKpiData.forEach(item => {
            const key = item.rating_key;
            const badgeClass = badgeClassMap[key] || 'badge-rating-vp';
            const label = escapeHtml(item.rating_label);

            if (!isEditingScorecardKpi) {
                // View Mode
                const formula = escapeHtml(item.formula_text || '-');
                const threshold = item.threshold_decimal !== null ? item.threshold_decimal.toFixed(2) : '-';
                const matchRule = escapeHtml(item.match_label || '-');

                html += `
                    <tr>
                        <td class="text-center" style="font-weight: 600; color: #0f172a;">
                            ${label}
                        </td>
                        <td class="text-center" style="font-weight: 600; color: #0f172a; font-family: monospace; font-size: 13px;">
                            ${formula}
                        </td>
                        <td class="text-center" style="font-weight: 600; color: #334155;">
                            ${threshold}
                        </td>
                        <td style="color: #334155; font-weight: 500;">
                            ${matchRule}
                        </td>
                    </tr>
                `;
            } else {
                // Edit Mode
                let formulaInputs = '';
                let decInput = '';

                if (key === 'very_poor') {
                    const maxVal = item.max_pct !== null ? item.max_pct : 34;
                    const decVal = (maxVal / 100).toFixed(2);
                    formulaInputs = `
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                            <span style="font-weight: 700; color: #64748b;">&lt;</span>
                            <input type="number" id="kpi-input-max-${key}" class="kpi-num-input" value="${maxVal}" min="0" max="100"
                                oninput="App.onKpiInputChange('${key}')">
                            <span style="font-weight: 600; color: #64748b;">%</span>
                        </div>
                    `;
                    decInput = `<input type="number" step="0.01" id="kpi-input-dec-${key}" class="kpi-num-input" value="${decVal}" readonly>`;
                } else if (key === 'very_good') {
                    const minVal = item.min_pct !== null ? item.min_pct : 85;
                    const displayThreshold = minVal > 0 ? (minVal - 1) : 84;
                    formulaInputs = `
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                            <span style="font-weight: 700; color: #64748b;">&gt;</span>
                            <input type="number" id="kpi-input-min-${key}" class="kpi-num-input" value="${displayThreshold}" min="0" max="100"
                                oninput="App.onKpiInputChange('${key}')">
                            <span style="font-weight: 600; color: #64748b;">%</span>
                        </div>
                    `;
                    decInput = `<span style="color: #94a3b8; font-weight: 600;">-</span>`;
                } else {
                    const minVal = item.min_pct !== null ? item.min_pct : 0;
                    const maxVal = item.max_pct !== null ? item.max_pct : 100;
                    const decVal = (maxVal / 100).toFixed(2);
                    formulaInputs = `
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                            <input type="number" id="kpi-input-min-${key}" class="kpi-num-input" value="${minVal}" min="0" max="100"
                                oninput="App.onKpiInputChange('${key}')">
                            <span style="font-weight: 700; color: #64748b;">&lt; x &lt;</span>
                            <input type="number" id="kpi-input-max-${key}" class="kpi-num-input" value="${maxVal}" min="0" max="100"
                                oninput="App.onKpiInputChange('${key}')">
                            <span style="font-weight: 600; color: #64748b;">%</span>
                        </div>
                    `;
                    decInput = `<input type="number" step="0.01" id="kpi-input-dec-${key}" class="kpi-num-input" value="${decVal}" readonly>`;
                }

                html += `
                    <tr>
                        <td class="text-center" style="font-weight: 600; color: #0f172a;">
                            ${label}
                        </td>
                        <td class="text-center">
                            ${formulaInputs}
                        </td>
                        <td class="text-center">
                            ${decInput}
                        </td>
                        <td>
                            <input type="text" id="kpi-input-match-${key}" class="form-control form-control-sm"
                                value="${escapeHtml(item.match_label || '')}" style="font-size: 12px; width: 100%;">
                        </td>
                    </tr>
                `;
            }
        });

        tbody.innerHTML = html;
    }

    function toggleEditScorecardKpi() {
        isEditingScorecardKpi = !isEditingScorecardKpi;
        renderScorecardKpiTable();
    }

    function onKpiInputChange(key) {
        const decEl = document.getElementById(`kpi-input-dec-${key}`);
        const matchEl = document.getElementById(`kpi-input-match-${key}`);

        if (key === 'very_poor') {
            const maxEl = document.getElementById(`kpi-input-max-${key}`);
            const maxVal = parseFloat(maxEl ? maxEl.value : 34) || 0;
            if (decEl) decEl.value = (maxVal / 100).toFixed(2);
            if (matchEl) matchEl.value = `Very Poor (Match <${maxVal})`;

            // Suggest poor min
            const poorMinEl = document.getElementById('kpi-input-min-poor');
            if (poorMinEl && parseFloat(poorMinEl.value) <= maxVal) {
                poorMinEl.value = maxVal + 1;
                onKpiInputChange('poor');
            }
        } else if (key === 'poor') {
            const minEl = document.getElementById(`kpi-input-min-${key}`);
            const maxEl = document.getElementById(`kpi-input-max-${key}`);
            const minVal = parseFloat(minEl ? minEl.value : 35) || 0;
            const maxVal = parseFloat(maxEl ? maxEl.value : 62) || 0;
            if (decEl) decEl.value = (maxVal / 100).toFixed(2);
            if (matchEl) matchEl.value = `Poor (Match ${minVal} -${maxVal})`;

            // Suggest moderate min
            const modMinEl = document.getElementById('kpi-input-min-moderate');
            if (modMinEl && parseFloat(modMinEl.value) <= maxVal) {
                modMinEl.value = maxVal + 1;
                onKpiInputChange('moderate');
            }
        } else if (key === 'moderate') {
            const minEl = document.getElementById(`kpi-input-min-${key}`);
            const maxEl = document.getElementById(`kpi-input-max-${key}`);
            const minVal = parseFloat(minEl ? minEl.value : 63) || 0;
            const maxVal = parseFloat(maxEl ? maxEl.value : 71) || 0;
            if (decEl) decEl.value = (maxVal / 100).toFixed(2);
            if (matchEl) matchEl.value = `Moderate (Match ${minVal} - ${maxVal})`;

            // Suggest good min
            const goodMinEl = document.getElementById('kpi-input-min-good');
            if (goodMinEl && parseFloat(goodMinEl.value) <= maxVal) {
                goodMinEl.value = maxVal + 1;
                onKpiInputChange('good');
            }
        } else if (key === 'good') {
            const minEl = document.getElementById(`kpi-input-min-${key}`);
            const maxEl = document.getElementById(`kpi-input-max-${key}`);
            const minVal = parseFloat(minEl ? minEl.value : 72) || 0;
            const maxVal = parseFloat(maxEl ? maxEl.value : 84) || 0;
            if (decEl) decEl.value = (maxVal / 100).toFixed(2);
            if (matchEl) matchEl.value = `Good (Match ${minVal} - ${maxVal})`;

            // Suggest very good min
            const vgMinEl = document.getElementById('kpi-input-min-very_good');
            if (vgMinEl) {
                vgMinEl.value = maxVal;
                onKpiInputChange('very_good');
            }
        } else if (key === 'very_good') {
            const minEl = document.getElementById(`kpi-input-min-${key}`);
            const minVal = parseFloat(minEl ? minEl.value : 84) || 0;
            if (matchEl) matchEl.value = `Very Good (Match >${minVal})`;
        }
    }

    async function saveScorecardKpi() {
        const saveBtn = document.getElementById('kpi-save-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Menyimpan...';
        }

        try {
            const kpis = [];

            // 1. Very Poor
            const vpMax = parseFloat(document.getElementById('kpi-input-max-very_poor')?.value) || 34;
            const vpMatch = document.getElementById('kpi-input-match-very_poor')?.value || `Very Poor (Match <${vpMax})`;
            kpis.push({
                rating_key: 'very_poor',
                min_pct: 0,
                max_pct: vpMax,
                threshold_decimal: parseFloat((vpMax / 100).toFixed(2)),
                formula_text: `<${vpMax}`,
                match_label: vpMatch
            });

            // 2. Poor
            const pMin = parseFloat(document.getElementById('kpi-input-min-poor')?.value) || 35;
            const pMax = parseFloat(document.getElementById('kpi-input-max-poor')?.value) || 62;
            const pMatch = document.getElementById('kpi-input-match-poor')?.value || `Poor (Match ${pMin} -${pMax})`;
            kpis.push({
                rating_key: 'poor',
                min_pct: pMin,
                max_pct: pMax,
                threshold_decimal: parseFloat((pMax / 100).toFixed(2)),
                formula_text: `${pMin}<x<${pMax}`,
                match_label: pMatch
            });

            // 3. Moderate
            const mMin = parseFloat(document.getElementById('kpi-input-min-moderate')?.value) || 63;
            const mMax = parseFloat(document.getElementById('kpi-input-max-moderate')?.value) || 71;
            const mMatch = document.getElementById('kpi-input-match-moderate')?.value || `Moderate (Match ${mMin} - ${mMax})`;
            kpis.push({
                rating_key: 'moderate',
                min_pct: mMin,
                max_pct: mMax,
                threshold_decimal: parseFloat((mMax / 100).toFixed(2)),
                formula_text: `${mMin}<x<${mMax}`,
                match_label: mMatch
            });

            // 4. Good
            const gMin = parseFloat(document.getElementById('kpi-input-min-good')?.value) || 72;
            const gMax = parseFloat(document.getElementById('kpi-input-max-good')?.value) || 84;
            const gMatch = document.getElementById('kpi-input-match-good')?.value || `Good (Match ${gMin} - ${gMax})`;
            kpis.push({
                rating_key: 'good',
                min_pct: gMin,
                max_pct: gMax,
                threshold_decimal: parseFloat((gMax / 100).toFixed(2)),
                formula_text: `${gMin}<x<${gMax}`,
                match_label: gMatch
            });

            // 5. Very Good
            const vgMin = parseFloat(document.getElementById('kpi-input-min-very_good')?.value) || 84;
            const vgMatch = document.getElementById('kpi-input-match-very_good')?.value || `Very Good (Match >${vgMin})`;
            kpis.push({
                rating_key: 'very_good',
                min_pct: vgMin + 1,
                max_pct: 100,
                threshold_decimal: null,
                formula_text: `>${vgMin}`,
                match_label: vgMatch
            });

            const res = await fetch('api/scorecard_kpi.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({
                    action: 'update',
                    kpis: kpis
                })
            });

            const json = await res.json();
            if (json.success) {
                showToast('success', 'Tersimpan', json.message || 'Konfigurasi KPI Score Card berhasil disimpan.');
                isEditingScorecardKpi = false;
                await loadScorecardKpi();
            } else {
                showToast('error', 'Gagal Menyimpan', json.message || 'Terjadi kesalahan saat menyimpan.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Server', 'Gagal terhubung ke server.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Simpan Perubahan';
            }
        }
    }

    async function resetScorecardKpi() {
        if (!confirm('Kembalikan konfigurasi range KPI ke nilai default?')) return;

        const resetBtn = document.getElementById('kpi-reset-btn');
        if (resetBtn) {
            resetBtn.disabled = true;
            resetBtn.textContent = 'Mereset...';
        }

        try {
            const res = await fetch('api/scorecard_kpi.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ action: 'reset' })
            });

            const json = await res.json();
            if (json.success) {
                showToast('success', 'Reset Berhasil', json.message || 'Konfigurasi KPI direset ke default.');
                isEditingScorecardKpi = false;
                await loadScorecardKpi();
            } else {
                showToast('error', 'Gagal Reset', json.message || 'Gagal mereset konfigurasi.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Server', 'Gagal terhubung ke server.');
        } finally {
            if (resetBtn) {
                resetBtn.disabled = false;
                resetBtn.textContent = 'Reset Default';
            }
        }
    }

    // ── SO Execution KPI Master Data ────────────────────────────

    function renderScorecardExecKpiTable() {
        const tbody = document.getElementById('kpi-exec-config-tbody');
        if (!tbody) return;

        if (!scorecardExecKpiData || scorecardExecKpiData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 1.5rem; color: #64748b;">Belum ada data konfigurasi KPI Execution.</td></tr>`;
            return;
        }

        const editBtn = document.getElementById('kpi-exec-edit-btn');
        const resetBtn = document.getElementById('kpi-exec-reset-btn');
        const saveBtn = document.getElementById('kpi-exec-save-btn');

        if (editBtn) {
            editBtn.textContent = isEditingScorecardExecKpi ? 'Batal' : 'Edit Range (%)';
            editBtn.className = isEditingScorecardExecKpi ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
        }
        if (resetBtn) resetBtn.style.display = isEditingScorecardExecKpi ? 'inline-flex' : 'none';
        if (saveBtn) saveBtn.style.display = isEditingScorecardExecKpi ? 'inline-flex' : 'none';

        const notExecItem = scorecardExecKpiData.find(i => i.rating_key === 'not_executed') || scorecardExecKpiData[0];
        const execItem = scorecardExecKpiData.find(i => i.rating_key === 'executed') || scorecardExecKpiData[1];
        const currentThresh = notExecItem && notExecItem.threshold_decimal !== null ? notExecItem.threshold_decimal : 0.25;
        const currentThreshFormatted = String(currentThresh).replace('.', ',');

        let html = '';

        if (!isEditingScorecardExecKpi) {
            html += `
                <tr>
                    <td class="text-center" style="font-weight: 600; color: #0f172a;">
                        Not Execution
                    </td>
                    <td class="text-center" style="font-weight: 600; color: #0f172a; font-family: monospace; font-size: 13px;">
                        ${escapeHtml(notExecItem?.formula_text || `x< ${currentThreshFormatted}`)}
                    </td>
                    <td class="text-center" style="font-weight: 600; color: #334155;">
                        ${currentThresh.toFixed(2)}
                    </td>
                </tr>
                <tr>
                    <td class="text-center" style="font-weight: 600; color: #0f172a;">
                        Execution
                    </td>
                    <td class="text-center" style="font-weight: 600; color: #0f172a; font-family: monospace; font-size: 13px;">
                        ${escapeHtml(execItem?.formula_text || `x>=${currentThreshFormatted}`)}
                    </td>
                    <td class="text-center" style="color: #94a3b8; font-weight: 600;">
                        -
                    </td>
                </tr>
            `;
        } else {
            html += `
                <tr>
                    <td class="text-center" style="font-weight: 600; color: #0f172a;">
                        Not Execution
                    </td>
                    <td class="text-center">
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                            <span style="font-weight: 700; color: #64748b;">x &lt;</span>
                            <span id="kpi-exec-formula-preview-not" style="font-weight: 700; color: #0f172a; font-family: monospace;">${currentThreshFormatted}</span>
                        </div>
                    </td>
                    <td class="text-center">
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                            <input type="number" step="0.01" min="0" max="1" id="kpi-exec-input-thresh" class="kpi-num-input"
                                value="${currentThresh}" style="width: 72px;" oninput="App.onKpiExecInputChange(this.value)">
                        </div>
                    </td>
                </tr>
                <tr>
                    <td class="text-center" style="font-weight: 600; color: #0f172a;">
                        Execution
                    </td>
                    <td class="text-center">
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                            <span style="font-weight: 700; color: #64748b;">x &gt;=</span>
                            <span id="kpi-exec-formula-preview-done" style="font-weight: 700; color: #0f172a; font-family: monospace;">${currentThreshFormatted}</span>
                        </div>
                    </td>
                    <td class="text-center" style="color: #94a3b8; font-weight: 600;">
                        -
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = html;
    }

    function toggleEditScorecardExecKpi() {
        isEditingScorecardExecKpi = !isEditingScorecardExecKpi;
        renderScorecardExecKpiTable();
    }

    function onKpiExecInputChange(val) {
        const num = parseFloat(val) || 0;
        const formatted = String(num).replace('.', ',');
        const prevNot = document.getElementById('kpi-exec-formula-preview-not');
        const prevDone = document.getElementById('kpi-exec-formula-preview-done');
        if (prevNot) prevNot.textContent = formatted;
        if (prevDone) prevDone.textContent = formatted;
    }

    async function saveScorecardExecKpi() {
        const saveBtn = document.getElementById('kpi-exec-save-btn');
        const input = document.getElementById('kpi-exec-input-thresh');
        const thresh = parseFloat(input ? input.value : 0.25) || 0.25;

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Menyimpan...';
        }

        try {
            const res = await fetch('api/scorecard_kpi.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({
                    action: 'update_execution',
                    threshold_decimal: thresh
                })
            });

            const json = await res.json();
            if (json.success) {
                showToast('success', 'Tersimpan', json.message || 'Konfigurasi KPI Execution berhasil disimpan.');
                isEditingScorecardExecKpi = false;
                await loadScorecardKpi();
            } else {
                showToast('error', 'Gagal Menyimpan', json.message || 'Terjadi kesalahan saat menyimpan.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Server', 'Gagal terhubung ke server.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Simpan';
            }
        }
    }

    async function resetScorecardExecKpi() {
        if (!confirm('Kembalikan konfigurasi KPI Execution ke nilai default (0.25)?')) return;

        const resetBtn = document.getElementById('kpi-exec-reset-btn');
        if (resetBtn) {
            resetBtn.disabled = true;
            resetBtn.textContent = 'Mereset...';
        }

        try {
            const res = await fetch('api/scorecard_kpi.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ action: 'reset_execution' })
            });

            const json = await res.json();
            if (json.success) {
                showToast('success', 'Reset Berhasil', json.message || 'Konfigurasi KPI Execution direset ke default.');
                isEditingScorecardExecKpi = false;
                await loadScorecardKpi();
            } else {
                showToast('error', 'Gagal Reset', json.message || 'Gagal mereset konfigurasi.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan Server', 'Gagal terhubung ke server.');
        } finally {
            if (resetBtn) {
                resetBtn.disabled = false;
                resetBtn.textContent = 'Reset Default';
            }
        }
    }

    // ── Color Helpers for Percentage ───────────────────────────

    function getPctColor(val, isPmd = false) {
        if (val === null || val === undefined || isNaN(val)) return '#64748b';
        const num = parseFloat(val);
        if (isPmd) {
            return num >= 98 ? '#16a34a' : '#dc2626';
        }
        if (num >= 85) {
            return '#16a34a'; // Green (>= 85%)
        } else if (num >= 75) {
            return '#ea580c'; // Orange (75% - 84%)
        } else {
            return '#dc2626'; // Red (< 75%)
        }
    }

    function getPctClass(val, isPmd = false) {
        if (val === null || val === undefined || isNaN(val)) return 'pct-none';
        const num = parseFloat(val);
        if (isPmd) {
            return num >= 98 ? 'pct-green' : 'pct-red';
        }
        if (num >= 85) {
            return 'pct-green';
        } else if (num >= 75) {
            return 'pct-orange';
        } else {
            return 'pct-red';
        }
    }

    // ── Page 2: Stock Opname Summary (KPI & Overview) ───────────

    const MONTHS_MONTHLY = [
        { val: '', label: 'Semua Bulan' },
        { val: '1', label: 'Januari' },
        { val: '2', label: 'Februari' },
        { val: '3', label: 'Maret' },
        { val: '4', label: 'April' },
        { val: '5', label: 'Mei' },
        { val: '6', label: 'Juni' },
        { val: '7', label: 'Juli' },
        { val: '8', label: 'Agustus' },
        { val: '9', label: 'September' },
        { val: '10', label: 'Oktober' },
        { val: '11', label: 'November' },
        { val: '12', label: 'Desember' }
    ];

    const MONTHS_QUARTERLY = [
        { val: '', label: 'Semua Bulan' },
        { val: '3', label: 'Maret' },
        { val: '6', label: 'Juni' },
        { val: '9', label: 'September' },
        { val: '12', label: 'Desember' }
    ];

    function updateSummaryMonthDropdown() {
        const monthSelect = document.getElementById('summary-filter-month');
        if (!monthSelect) return;

        const currentVal = monthSelect.value;
        const optionsList = summarySOType === 'quarterly' ? MONTHS_QUARTERLY : MONTHS_MONTHLY;

        monthSelect.innerHTML = '';
        optionsList.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.val;
            el.textContent = opt.label;
            monthSelect.appendChild(el);
        });

        // Try to keep previous value if it exists in the new option list, otherwise choose best default
        const hasCurrent = optionsList.some(o => o.val === currentVal);
        if (hasCurrent) {
            monthSelect.value = currentVal;
        } else if (summarySOType === 'quarterly') {
            // Find closest quarterly ending month (3, 6, 9, 12)
            const num = parseInt(currentVal, 10) || 3;
            let qMonth = '3';
            if (num >= 10) qMonth = '12';
            else if (num >= 7) qMonth = '9';
            else if (num >= 4) qMonth = '6';
            else qMonth = '3';
            monthSelect.value = qMonth;
        }
    }

    function switchSOType(type, targetCategory = null) {
        summarySOType = (type === 'quarterly') ? 'quarterly' : 'monthly';

        try {
            sessionStorage.setItem('summary_so_type', summarySOType);
        } catch (e) { }

        const btnMonthly = document.getElementById('btn-so-type-monthly');
        const btnQuarterly = document.getElementById('btn-so-type-quarterly');
        const statusText = document.getElementById('summary-so-type-status');

        if (btnMonthly && btnQuarterly) {
            btnMonthly.classList.toggle('active', summarySOType === 'monthly');
            btnQuarterly.classList.toggle('active', summarySOType === 'quarterly');
        }

        // Update BULAN dropdown based on SO Type (Monthly = 12 months, Quarterly = per 3 months)
        updateSummaryMonthDropdown();

        // Toggle Rekapitulasi sub-tabs (Outlet Regional / PMD only apply to Monthly)
        const rekapSubTabs = document.getElementById('rekap-tabs-level2');
        if (rekapSubTabs) {
            rekapSubTabs.style.display = (summarySOType === 'monthly') ? 'flex' : 'none';
        }

        const rekapSubtitle = document.querySelector('#card-rekapitulasi .card-subtitle');
        if (rekapSubtitle) {
            rekapSubtitle.textContent = summarySOType === 'monthly'
                ? 'Monthly Stock Opname'
                : 'Quarterly Stock Opname';
        }

        // Update Trend Chart Subtitles
        const curYear = document.getElementById('summary-filter-year')?.value || 2026;
        document.querySelectorAll('.trend-chart-subtitle').forEach(el => {
            el.textContent = (summarySOType === 'monthly')
                ? `Monthly Physical % (Jan - Dec ${curYear})`
                : `Quarterly Physical % (Q1 - Q4 ${curYear})`;
        });

        // Update Rekap Chart Title (Monthly vs Quarterly)
        const chartTitleEl = document.getElementById('rekap-chart-title');
        if (chartTitleEl) {
            const prefix = (summarySOType === 'quarterly') ? 'Quarterly' : 'Monthly';
            chartTitleEl.textContent = `${prefix} Target Achievement ${rekapYear || curYear}`;
        }

        // Quarterly has 2 Category tabs: Outlet Subarep and Warehouse HUB
        const catSlider = document.getElementById('summary-cat-slider-card');
        const controlsDivider = document.getElementById('summary-controls-divider');
        const catSliderMonthly = document.getElementById('cat-slider-monthly');
        const catSliderQuarterly = document.getElementById('cat-slider-quarterly');

        if (catSlider) catSlider.style.display = 'inline-flex';
        if (controlsDivider) controlsDivider.style.display = 'inline-block';

        let nextCat = targetCategory;
        if (summarySOType === 'quarterly') {
            if (catSliderMonthly) catSliderMonthly.style.display = 'none';
            if (catSliderQuarterly) catSliderQuarterly.style.display = 'inline-flex';
            if (!nextCat || (nextCat !== 'outlet_subarep' && nextCat !== 'warehouse_hub' && nextCat !== 'warehouse_tekno')) {
                const savedQCat = sessionStorage.getItem('summary_category_quarterly');
                nextCat = ['warehouse_hub', 'warehouse_tekno'].includes(savedQCat) ? savedQCat : 'outlet_subarep';
            }
        } else {
            if (catSliderMonthly) catSliderMonthly.style.display = 'inline-flex';
            if (catSliderQuarterly) catSliderQuarterly.style.display = 'none';
            if (!nextCat || (nextCat !== 'pmd' && nextCat !== 'outlet' && nextCat !== 'warehouse_hub' && nextCat !== 'warehouse_tekno' && nextCat !== 'it_coorporate')) {
                const savedMCat = sessionStorage.getItem('summary_category_monthly');
                nextCat = (savedMCat && ['outlet', 'warehouse_hub', 'warehouse_tekno', 'it_coorporate'].includes(savedMCat)) ? savedMCat : 'pmd';
            }
        }

        switchSummaryCategory(nextCat);
    }

    function switchSummaryCategory(cat) {
        if (summarySOType === 'quarterly') {
            if (cat === 'outlet_subarep' || cat === 'warehouse_hub' || cat === 'warehouse_tekno') {
                try { sessionStorage.setItem('summary_category_quarterly', cat); } catch (e) { }
            } else {
                cat = 'outlet_subarep';
            }
        } else {
            if (cat === 'pmd' || cat === 'outlet' || cat === 'warehouse_hub' || cat === 'warehouse_tekno' || cat === 'it_coorporate') {
                try { sessionStorage.setItem('summary_category_monthly', cat); } catch (e) { }
            } else {
                cat = 'pmd';
            }
        }
        summaryCategory = cat;

        try {
            sessionStorage.setItem('summary_so_type', summarySOType);
            sessionStorage.setItem('summary_category', summaryCategory);
        } catch (e) { }

        // 1. Sync button states for Monthly Category tabs
        const btnOutlet = document.getElementById('btn-summary-cat-outlet');
        const btnPmd = document.getElementById('btn-summary-cat-pmd');
        const btnWarehouseM = document.getElementById('btn-summary-cat-warehouse-m');
        const btnTeknoM = document.getElementById('btn-summary-cat-tekno-m');
        const btnIt = document.getElementById('btn-summary-cat-it');
        if (btnOutlet && btnPmd) {
            btnOutlet.classList.toggle('active', cat === 'outlet');
            btnPmd.classList.toggle('active', cat === 'pmd');
            if (btnWarehouseM) btnWarehouseM.classList.toggle('active', cat === 'warehouse_hub');
            if (btnTeknoM) btnTeknoM.classList.toggle('active', cat === 'warehouse_tekno');
            if (btnIt) btnIt.classList.toggle('active', cat === 'it_coorporate');
        }

        // 2. Sync button states for Quarterly Category tabs
        const btnSubarep = document.getElementById('btn-summary-cat-subarep');
        const btnWarehouse = document.getElementById('btn-summary-cat-warehouse');
        const btnTeknoQ = document.getElementById('btn-summary-cat-tekno-q');
        if (btnSubarep && btnWarehouse) {
            btnSubarep.classList.toggle('active', cat === 'outlet_subarep');
            btnWarehouse.classList.toggle('active', cat === 'warehouse_hub');
            if (btnTeknoQ) btnTeknoQ.classList.toggle('active', cat === 'warehouse_tekno');
        }

        const catStatus = document.getElementById('summary-cat-status');
        if (catStatus) {
            let label = 'PMD';
            let color = '#9333ea';
            let threshold = '98%';

            if (cat === 'outlet') {
                label = 'Outlet Regional';
                color = '#2563eb';
                threshold = '85%';
            } else if (cat === 'outlet_subarep') {
                label = 'Outlet Subarep';
                color = '#0284c7';
                threshold = '85%';
            } else if (cat === 'warehouse_hub') {
                label = 'Warehouse HUB';
                color = '#d97706';
                threshold = '85%';
            } else if (cat === 'warehouse_tekno') {
                label = 'Warehouse Tekno';
                color = '#0891b2';
                threshold = '98%';
            } else if (cat === 'it_coorporate') {
                label = 'IT Coorporate';
                color = '#059669';
                threshold = '98%';
            }

            catStatus.innerHTML = `(<strong style="color: ${color};">${label}</strong> Target ${threshold})`;
        }

        // Toggle KPI cards & groups
        const isQuarterly = (summarySOType === 'quarterly');
        const outletKpiCards = isQuarterly
            ? ['kpi-card-national', 'kpi-group-wro', 'kpi-group-ero']
            : ['kpi-card-national', 'kpi-group-wro', 'kpi-group-cro', 'kpi-group-ero'];
        const pmdKpiCards = ['kpi-card-pmd', 'kpi-card-dno', 'kpi-card-dso'];

        // IT Corporate & Warehouse Tekno cards
        const itTbsCard = document.getElementById('kpi-card-it-tbs');
        const itArcadiaCard = document.getElementById('kpi-card-it-arcadia');
        const teknoGudangCard = document.getElementById('kpi-card-tekno-gudang');
        const teknoKhususCard = document.getElementById('kpi-card-tekno-khusus');
        const teknoQuarterlyCards = ['kpi-card-tekno-buffer', 'kpi-card-tekno-storage2', 'kpi-card-tekno-storage1', 'kpi-card-tekno-persiapan'];
        const hideTeknoQuarterly = () => {
            teknoQuarterlyCards.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        };
        const natCard = document.getElementById('kpi-card-national');

        if (cat === 'it_coorporate') {
            if (natCard) natCard.style.display = 'flex';
            if (itTbsCard) itTbsCard.style.display = 'flex';
            if (itArcadiaCard) itArcadiaCard.style.display = 'flex';
            if (teknoGudangCard) teknoGudangCard.style.display = 'none';
            if (teknoKhususCard) teknoKhususCard.style.display = 'none';
            hideTeknoQuarterly();

            ['kpi-group-wro', 'kpi-group-cro', 'kpi-group-ero'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            pmdKpiCards.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        } else if (cat === 'warehouse_tekno') {
            if (natCard) natCard.style.display = 'flex';
            if (itTbsCard) itTbsCard.style.display = 'none';
            if (itArcadiaCard) itArcadiaCard.style.display = 'none';

            const isQuarterlyTekno = (summarySOType === 'quarterly');
            if (teknoGudangCard) teknoGudangCard.style.display = isQuarterlyTekno ? 'none' : 'flex';
            if (teknoKhususCard) teknoKhususCard.style.display = isQuarterlyTekno ? 'none' : 'flex';

            teknoQuarterlyCards.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = isQuarterlyTekno ? 'flex' : 'none';
            });

            ['kpi-group-wro', 'kpi-group-cro', 'kpi-group-ero'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            pmdKpiCards.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        } else if (cat === 'pmd') {
            if (itTbsCard) itTbsCard.style.display = 'none';
            if (itArcadiaCard) itArcadiaCard.style.display = 'none';
            if (teknoGudangCard) teknoGudangCard.style.display = 'none';
            if (teknoKhususCard) teknoKhususCard.style.display = 'none';
            hideTeknoQuarterly();
            outletKpiCards.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            pmdKpiCards.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'flex';
            });
        } else {
            if (itTbsCard) itTbsCard.style.display = 'none';
            if (itArcadiaCard) itArcadiaCard.style.display = 'none';
            if (teknoGudangCard) teknoGudangCard.style.display = 'none';
            if (teknoKhususCard) teknoKhususCard.style.display = 'none';
            hideTeknoQuarterly();
            pmdKpiCards.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            outletKpiCards.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'flex';
            });
            if (isQuarterly) {
                const croGroup = document.getElementById('kpi-group-cro');
                if (croGroup) croGroup.style.display = (cat === 'warehouse_hub') ? 'flex' : 'none';
            }
        }

        // Subdept visibility for Warehouse HUB (both Monthly & Quarterly): only show EKO, NSO, SSO, EJO
        // Explicitly remove/hide CSO, BNO, MPO, and SMO
        const allSubDeptItems = ['cso', 'nso', 'sso', 'cjdo', 'eko', 'wjo', 'wko', 'bno', 'ejo', 'mpo', 'smo'];
        if (cat === 'warehouse_hub') {
            const whAllowedSubDepts = ['eko', 'nso', 'sso', 'ejo'];
            allSubDeptItems.forEach(code => {
                const el = document.getElementById(`kpi-subdept-item-${code}`);
                if (el) el.style.display = whAllowedSubDepts.includes(code) ? 'block' : 'none';
            });
        } else {
            allSubDeptItems.forEach(code => {
                const el = document.getElementById(`kpi-subdept-item-${code}`);
                if (el) el.style.display = 'block';
            });
        }

        const showOutletKpis = (cat === 'outlet' || cat === 'outlet_subarep' || cat === 'warehouse_hub' || cat === 'warehouse_tekno' || cat === 'it_coorporate');

        // Sync DB Analysis visibility and grand total
        syncDbAnalysisVisibility();

        // Toggle Trend chart cards
        const pmdTrendCard = document.getElementById('card-trend-pmd-wrapper');
        const subDeptTrendCard = document.getElementById('card-trend-subdept-wrapper');
        const trendRow2 = document.getElementById('trend-charts-row-sub');
        const deptTrendTitle = document.getElementById('trend-dept-title');
        const deptTrendBadge = document.getElementById('trend-dept-badge');
        const subDeptTrendTitle = document.getElementById('trend-subdept-title');
        const subDeptTrendBadge = document.getElementById('trend-subdept-badge');

        if (trendRow2) {
            trendRow2.classList.add('single-chart');
        }

        if (cat === 'it_coorporate') {
            if (pmdTrendCard) pmdTrendCard.style.display = 'none';
            if (subDeptTrendCard) subDeptTrendCard.style.display = 'block';
            if (deptTrendTitle) deptTrendTitle.textContent = 'Trend Achievement SO IT Coorporate';
            if (deptTrendBadge) {
                deptTrendBadge.textContent = 'IT Coorporate';
                deptTrendBadge.style.background = '#ecfdf5';
                deptTrendBadge.style.color = '#059669';
            }
            if (subDeptTrendTitle) subDeptTrendTitle.textContent = 'Trend Achievement SO TBS & ARCADIA';
            if (subDeptTrendBadge) {
                subDeptTrendBadge.textContent = 'TBS & ARCADIA';
                subDeptTrendBadge.style.background = '#ecfdf5';
                subDeptTrendBadge.style.color = '#059669';
            }
        } else if (cat === 'warehouse_tekno') {
            if (pmdTrendCard) pmdTrendCard.style.display = 'none';
            if (subDeptTrendCard) subDeptTrendCard.style.display = 'none';
            if (deptTrendTitle) deptTrendTitle.textContent = 'Trend Achievement SO Warehouse Tekno';
            if (deptTrendBadge) {
                deptTrendBadge.textContent = 'Warehouse Tekno';
                deptTrendBadge.style.background = '#ecfeff';
                deptTrendBadge.style.color = '#0891b2';
            }
        } else if (cat === 'pmd') {
            if (pmdTrendCard) pmdTrendCard.style.display = 'block';
            if (subDeptTrendCard) subDeptTrendCard.style.display = 'none';
            if (deptTrendTitle) deptTrendTitle.textContent = 'Trend Achievement SO Divisi (PMD)';
            if (deptTrendBadge) {
                deptTrendBadge.textContent = 'DIVISI';
                deptTrendBadge.style.background = '#faf5ff';
                deptTrendBadge.style.color = '#9333ea';
            }
        } else {
            if (pmdTrendCard) pmdTrendCard.style.display = 'none';
            if (subDeptTrendCard) subDeptTrendCard.style.display = 'block';
            if (deptTrendTitle) {
                const subTitleLabel = (cat === 'warehouse_hub')
                    ? 'Trend Achievement SO Dept (Warehouse HUB)'
                    : (cat === 'outlet_subarep' ? 'Trend Achievement SO Dept (Outlet Subarep)' : 'Trend Achievement SO Dept (Outlet Regional)');
                deptTrendTitle.textContent = subTitleLabel;
            }
            if (deptTrendBadge) {
                deptTrendBadge.textContent = 'DEPT';
                deptTrendBadge.style.background = '#eff6ff';
                deptTrendBadge.style.color = '#2563eb';
            }
            if (subDeptTrendTitle) {
                subDeptTrendTitle.textContent = (cat === 'warehouse_hub')
                    ? 'Trend Achievement SO Warehouse HUB Sub Dept'
                    : (cat === 'outlet_subarep' ? 'Trend Achievement SO Outlet Subarep Sub Dept' : 'Trend Achievement SO Outlet Regional Sub Dept');
            }
            if (subDeptTrendBadge) {
                subDeptTrendBadge.textContent = (cat === 'warehouse_hub') ? 'Warehouse HUB' : ((cat === 'outlet_subarep') ? 'Outlet Subarep' : 'Outlet Regional');
                subDeptTrendBadge.style.background = '#f0fdf4';
                subDeptTrendBadge.style.color = '#16a34a';
            }
        }

        // Update Card Hasil SO UI
        updateHasilSOCardUI();

        // Sync Rekapitulasi level 2
        rekapLevel2 = (cat === 'pmd' ? 'pmd' : 'outlet');
        document.querySelectorAll('.rekap-tab-l2').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-rekap-l2') === rekapLevel2);
        });

        const rekapSubtitle = document.querySelector('#card-rekapitulasi .card-subtitle');
        if (rekapSubtitle) {
            let catDisplayName = 'PMD';
            if (cat === 'outlet') catDisplayName = 'Outlet Regional';
            else if (cat === 'outlet_subarep') catDisplayName = 'Outlet Subarep';
            else if (cat === 'warehouse_hub') catDisplayName = 'Warehouse HUB';
            else if (cat === 'warehouse_tekno') catDisplayName = 'Warehouse Tekno';
            else if (cat === 'it_coorporate') catDisplayName = 'IT Coorporate';

            rekapSubtitle.textContent = summarySOType === 'monthly'
                ? `Monthly Stock Opname - ${catDisplayName}`
                : `Quarterly Stock Opname - ${catDisplayName}`;
        }

        rekapDeptFilter = 'all';
        rekapSubDeptFilter = 'all';
        rdbStatusDept = 'all';
        rdbStatusSubDept = 'all';
        rdbStatusCurrentPage = 1;
        rdbStatusFiltersPopulated = false;
        currentScorecardDeptFilter = 'all';
        currentScorecardSubDeptFilter = 'all';
        loadRekapitulasi();
        loadSubDeptResults();

        const yearSelect = document.getElementById('summary-filter-year');
        loadTrendCharts(yearSelect ? yearSelect.value : 2026);
        loadScoreCardSummary();
        loadSummaryData();
    }

    function updateHasilSOCardUI() {
        const titleEl = document.getElementById('hasil-so-title');
        const subtitleEl = document.getElementById('hasil-so-subtitle');
        const deptFilterContainer = document.getElementById('dept-result-filter-container');
        const subdeptFilterContainer = document.getElementById('subdept-result-filter-container');
        const statusFilterContainer = document.getElementById('status-result-filter-container');
        const deptSelect = document.getElementById('dept-result-filter');
        const subDeptSelect = document.getElementById('subdept-result-filter');
        const subDeptLabel = document.getElementById('label-subdept-result-filter');
        const statusSelect = document.getElementById('status-result-filter');

        const isIt = (summaryCategory === 'it_coorporate');
        const isTekno = (summaryCategory === 'warehouse_tekno');
        const isHub = (summaryCategory === 'warehouse_hub');
        const isPmd = (summaryCategory === 'pmd');

        if (isIt || isTekno) {
            let reportName = isIt ? 'IT Coorporate' : ((summarySOType === 'quarterly') ? 'Warehouse Tekno (Quarterly)' : 'Warehouse Tekno');
            if (titleEl) titleEl.textContent = `Report Stock Opname ${reportName}`;
            if (subtitleEl) subtitleEl.textContent = `Pencapaian dan Hasil Stock Opname ${reportName}`;
            if (deptFilterContainer) deptFilterContainer.style.display = 'none';
            if (subdeptFilterContainer) subdeptFilterContainer.style.display = 'none';
            if (statusFilterContainer) statusFilterContainer.style.display = 'flex';
            if (statusSelect) statusSelect.value = 'all';
        } else if (isPmd) {
            if (titleEl) titleEl.textContent = 'Report Stock Opname PMD';
            if (subtitleEl) subtitleEl.textContent = 'Pencapaian dan Hasil Stock Opname PMD';
            if (deptFilterContainer) deptFilterContainer.style.display = 'none';
            if (subdeptFilterContainer) subdeptFilterContainer.style.display = 'flex';
            if (statusFilterContainer) statusFilterContainer.style.display = 'flex';
            if (statusSelect) statusSelect.value = 'all';
            if (subDeptLabel) subDeptLabel.textContent = 'DEPT';

            if (subDeptSelect) {
                subDeptSelect.innerHTML = `
                    <option value="all" selected>Semua Dept</option>
                    <option value="DNO">DNO</option>
                    <option value="DSO">DSO</option>
                `;
            }
        } else {
            if (subDeptLabel) subDeptLabel.textContent = 'SUB DEPT';
            let reportName = 'Outlet Regional';
            if (summaryCategory === 'outlet_subarep') reportName = 'Outlet Subarep (Quarterly)';
            else if (isHub) reportName = (summarySOType === 'quarterly') ? 'Warehouse HUB (Quarterly)' : 'Warehouse HUB';

            if (titleEl) titleEl.textContent = `Report Stock Opname ${reportName}`;
            if (subtitleEl) subtitleEl.textContent = `Pencapaian dan Hasil Stock Opname ${reportName}`;
            if (deptFilterContainer) deptFilterContainer.style.display = 'flex';
            if (subdeptFilterContainer) subdeptFilterContainer.style.display = 'flex';
            if (statusFilterContainer) statusFilterContainer.style.display = 'flex';

            if (deptSelect) {
                if (isHub) {
                    // Warehouse HUB has sites in CRO (Balikpapan), ERO (Surabaya), WRO (Medan & Palembang) in both Monthly and Quarterly
                    deptSelect.innerHTML = `
                        <option value="all" selected>Semua DEPT</option>
                        <option value="CRO">CRO</option>
                        <option value="ERO">ERO</option>
                        <option value="WRO">WRO</option>
                    `;
                    deptSelect.value = 'all';
                } else if (summarySOType === 'quarterly') {
                    deptSelect.innerHTML = `
                        <option value="all" selected>Semua DEPT</option>
                        <option value="ERO">ERO</option>
                        <option value="WRO">WRO</option>
                    `;
                    deptSelect.value = 'all';
                } else {
                    deptSelect.innerHTML = `
                        <option value="all" selected>Semua DEPT</option>
                        <option value="CRO">CRO</option>
                        <option value="ERO">ERO</option>
                        <option value="WRO">WRO</option>
                    `;
                    deptSelect.value = 'all';
                }
            }

            if (subDeptSelect) {
                let html = '<option value="all" selected>Semua Sub Dept</option>';
                if (isHub) {
                    html += `<optgroup label="WRO">
                        <option value="NSO">NSO</option>
                        <option value="SSO">SSO</option>
                    </optgroup>
                    <optgroup label="CRO">
                        <option value="EKO">EKO</option>
                    </optgroup>
                    <optgroup label="ERO">
                        <option value="EJO">EJO</option>
                    </optgroup>`;
                } else {
                    const allowedDepts = (summarySOType === 'quarterly' ? ['ERO', 'WRO'] : ['CRO', 'ERO', 'WRO']);
                    allowedDepts.forEach(deptKey => {
                        const list = DEPT_SUBDEPTS_MAP[deptKey] || [];
                        html += `<optgroup label="${deptKey}">`;
                        list.forEach(code => {
                            html += `<option value="${code}">${code}</option>`;
                        });
                        html += `</optgroup>`;
                    });
                }
                subDeptSelect.innerHTML = html;
                subDeptSelect.value = 'all';
            }

            if (statusSelect) {
                statusSelect.value = 'all';
            }
        }
    }

    async function loadSummaryData(forcedPeriod = null) {
        const monthSelect = document.getElementById('summary-filter-month');
        const yearSelect = document.getElementById('summary-filter-year');

        // If forcedPeriod provided (e.g. after upload), set dropdown values directly
        if (forcedPeriod && forcedPeriod.month && forcedPeriod.year) {
            if (monthSelect) monthSelect.value = forcedPeriod.month.toString();
            if (yearSelect) {
                // Ensure the year option exists in dropdown
                const yStr = forcedPeriod.year.toString();
                if (!Array.from(yearSelect.options).some(opt => opt.value === yStr)) {
                    const opt = document.createElement('option');
                    opt.value = yStr;
                    opt.textContent = yStr;
                    yearSelect.appendChild(opt);
                }
                yearSelect.value = yStr;
            }
            summaryInitialized = true;
        }

        // On first initial page load, if not initialized yet, restore from session or fetch the latest period first
        if (!summaryInitialized) {
            const savedMonth = sessionStorage.getItem('summary_filter_month');
            const savedYear = sessionStorage.getItem('summary_filter_year');

            if (savedMonth !== null && savedYear && monthSelect && yearSelect) {
                if (Array.from(monthSelect.options).some(opt => opt.value === savedMonth)) {
                    monthSelect.value = savedMonth;
                }
                if (!Array.from(yearSelect.options).some(opt => opt.value === savedYear)) {
                    const opt = document.createElement('option');
                    opt.value = savedYear;
                    opt.textContent = savedYear;
                    yearSelect.appendChild(opt);
                }
                yearSelect.value = savedYear;
                summaryInitialized = true;
            } else {
                try {
                    const initRes = await fetch('api/reconciliation.php?action=summary&so_type=' + summarySOType);
                    const initJson = await initRes.json();
                    if (initJson.success && initJson.latest_period && initJson.latest_period.period_month && initJson.latest_period.period_year) {
                        const lp = initJson.latest_period;
                        if (monthSelect) monthSelect.value = lp.period_month.toString();
                        if (yearSelect) {
                            const yStr = lp.period_year.toString();
                            if (!Array.from(yearSelect.options).some(opt => opt.value === yStr)) {
                                const opt = document.createElement('option');
                                opt.value = yStr;
                                opt.textContent = yStr;
                                yearSelect.appendChild(opt);
                            }
                            yearSelect.value = yStr;
                        }
                    }
                } catch (initErr) {
                    console.warn('Could not determine latest period, fallback to current dropdown:', initErr);
                }
                summaryInitialized = true;
            }
        }

        const month = monthSelect ? monthSelect.value : '';
        const year = yearSelect ? yearSelect.value : '';

        // Save selected filter month & year to sessionStorage for reload persistence
        try {
            if (month !== undefined && month !== null) sessionStorage.setItem('summary_filter_month', month);
            if (year) sessionStorage.setItem('summary_filter_year', year);
        } catch (e) { }

        // Update Executive Summary period badge next to title
        const execPeriodText = document.getElementById('executive-period-text');
        const execPeriodBadge = document.getElementById('executive-period-badge');
        if (execPeriodText || execPeriodBadge) {
            const mText = monthSelect && monthSelect.selectedIndex >= 0 && monthSelect.options[monthSelect.selectedIndex]
                ? monthSelect.options[monthSelect.selectedIndex].text
                : (month ? `Bulan ${month}` : 'Semua Bulan');
            const pLabel = (summarySOType === 'quarterly')
                ? `${mText} ${year} (Quarterly)`
                : `${mText} ${year}`;
            if (execPeriodText) {
                execPeriodText.textContent = pLabel;
            } else if (execPeriodBadge) {
                execPeriodBadge.textContent = pLabel;
            }
            const dbPeriodBadge = document.getElementById('db-analysis-period-badge');
            if (dbPeriodBadge) dbPeriodBadge.textContent = pLabel;
        }

        // Update achievement card helper
        const updateAchCard = (valId, subId, trendId, statusId, item, defaultLabel, isPmd = false, customTarget = null) => {
            const rawPct = item && item.pct !== null && item.pct !== undefined ? parseFloat(item.pct) : 0;
            const pct = rawPct;
            const count = item?.count || 0;
            const total = item?.total_sites || 0;
            let targetThreshold = 85;
            if (customTarget !== null) {
                targetThreshold = customTarget;
            } else if (isPmd || summaryCategory === 'warehouse_tekno' || summaryCategory === 'it_coorporate') {
                targetThreshold = 98;
            }
            const color = total === 0 ? '#94a3b8' : getPctColor(pct, targetThreshold === 98);

            const valEl = document.getElementById(valId);
            if (valEl) {
                valEl.textContent = `${pct.toFixed(2)}%`;
                valEl.style.color = color;
            }

            const subEl = document.getElementById(subId);
            if (subEl) {
                subEl.textContent = `${defaultLabel} (${count}/${total} Sites)`;
            }

            const statusEl = document.getElementById(statusId);
            if (statusEl) {
                if (total === 0) {
                    statusEl.innerHTML = '<span class="so-status-badge status-none">Belum Ada Data</span>';
                } else if (pct >= targetThreshold) {
                    statusEl.innerHTML = '<span class="so-status-badge status-green">Tercapai</span>';
                } else {
                    statusEl.innerHTML = '<span class="so-status-badge status-red">Tidak Tercapai</span>';
                }
            }

            const trendEl = document.getElementById(trendId);
            if (trendEl) {
                if (total === 0) {
                    trendEl.innerHTML = '';
                } else {
                    let diff = null;
                    if (item && item.diff_pct !== undefined && item.diff_pct !== null) {
                        diff = Number(item.diff_pct);
                    } else if (item && item.prev_pct !== undefined && item.prev_pct !== null && item.pct !== null && item.pct !== undefined) {
                        diff = Number(item.pct) - Number(item.prev_pct);
                    }

                    if (diff === null) {
                        trendEl.innerHTML = '<span class="kpi-target-indicator target-neutral"><span>-</span></span>';
                    } else {
                        const isUp = diff > 0;
                        const isDown = diff < 0;
                        const sign = isUp ? '+' : '';
                        const trendClass = isUp ? 'target-up' : (isDown ? 'target-down' : 'target-neutral');
                        const formattedDiff = `${sign}${diff.toFixed(2)}%`;

                        // Solid triangle style: up (green) if > 0, down (red) if < 0
                        const triangleSvg = isUp
                            ? `<svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"/></svg>`
                            : (isDown ? `<svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"/></svg>` : '');

                        trendEl.innerHTML = `
                            <span class="kpi-target-indicator ${trendClass}">
                                ${triangleSvg}
                                <span>${formattedDiff}</span>
                            </span>
                        `;
                    }
                }
            }
        };

        function applySummaryJsonData(json) {
            if (!json || !json.success) return;
            const t = json.totals || {};
            const ach = json.achievements || {};

            const isNationalCategory = (summaryCategory === 'it_coorporate' || summaryCategory === 'warehouse_tekno' || summaryCategory === 'warehouse_hub');
            const nat = isNationalCategory
                ? ((ach.national && ach.national.total_sites > 0) ? ach.national : (ach.outlet_national || ach.national || {}))
                : ((ach.outlet_national && ach.outlet_national.total_sites > 0) ? ach.outlet_national : (ach.national || ach.outlet_national || {}));
            const cro = ach.cro || {};
            const ero = ach.ero || {};
            const wro = ach.wro || {};
            const pmd = ach.pmd || {};
            const dno = ach.dno || {};
            const dso = ach.dso || {};

            let natTitle = 'Summary Outlet Regional Achievement';
            let natDefaultLabel = 'Avg Outlet Regional';
            if (summaryCategory === 'outlet_subarep') {
                natTitle = 'Summary Outlet Subarep Achievement';
                natDefaultLabel = 'Avg Outlet Subarep';
            } else if (summaryCategory === 'warehouse_hub') {
                natTitle = 'Summary Warehouse HUB Achievement';
                natDefaultLabel = 'Avg Warehouse HUB';
            } else if (summaryCategory === 'warehouse_tekno') {
                natTitle = 'Summary Warehouse Tekno Achievement';
                natDefaultLabel = 'Avg Warehouse Tekno';
            } else if (summaryCategory === 'it_coorporate') {
                natTitle = 'Summary IT Coorporate Achievement';
                natDefaultLabel = 'Avg IT Coorporate';
            }

            const natTitleEl = document.getElementById('kpi-national-title');
            if (natTitleEl) natTitleEl.textContent = natTitle;

            updateAchCard('kpi-national-achievement', 'kpi-national-subtext', 'kpi-national-trend', 'kpi-national-status', nat, natDefaultLabel, false, (summaryCategory === 'it_coorporate' || summaryCategory === 'warehouse_tekno') ? 98 : 85);
            updateAchCard('kpi-cro-achievement', 'kpi-cro-subtext', 'kpi-cro-trend', 'kpi-cro-status', cro, 'Avg DEPT CRO', false);
            updateAchCard('kpi-ero-achievement', 'kpi-ero-subtext', 'kpi-ero-trend', 'kpi-ero-status', ero, 'Avg DEPT ERO', false);
            updateAchCard('kpi-wro-achievement', 'kpi-wro-subtext', 'kpi-wro-trend', 'kpi-wro-status', wro, 'Avg DEPT WRO', false);
            updateAchCard('kpi-pmd-achievement', 'kpi-pmd-subtext', 'kpi-pmd-trend', 'kpi-pmd-status', pmd, 'Avg PMD Divisi', true);
            updateAchCard('kpi-dno-achievement', 'kpi-dno-subtext', 'kpi-dno-trend', 'kpi-dno-status', dno, 'Avg DEPT DNO', true);
            updateAchCard('kpi-dso-achievement', 'kpi-dso-subtext', 'kpi-dso-trend', 'kpi-dso-status', dso, 'Avg DEPT DSO', true);

            // Populate IT Corporate Specific Site Cards (OUTLET OPTI TBS & IT CORPORATE - ARCADIA LT 4)
            if (summaryCategory === 'it_coorporate') {
                const sitesData = ach.sites || {};
                const tbsSite = sitesData['50002001384'];
                const arcadiaSite = sitesData['50002003133'];

                updateAchCard(
                    'kpi-it-tbs-achievement',
                    'kpi-it-tbs-subtext',
                    'kpi-it-tbs-trend',
                    'kpi-it-tbs-status',
                    tbsSite ? { ...tbsSite, count: (tbsSite && tbsSite.has_data) ? 1 : 0, total_sites: 1 } : { pct: null, count: 0, total_sites: 1 },
                    '50002001384',
                    false,
                    98
                );

                updateAchCard(
                    'kpi-it-arcadia-achievement',
                    'kpi-it-arcadia-subtext',
                    'kpi-it-arcadia-trend',
                    'kpi-it-arcadia-status',
                    arcadiaSite ? { ...arcadiaSite, count: (arcadiaSite && arcadiaSite.has_data) ? 1 : 0, total_sites: 1 } : { pct: null, count: 0, total_sites: 1 },
                    '50002003133',
                    false,
                    98
                );
            }

            // Populate Warehouse Tekno Specific Site Cards (2 Monthly sites or 4 Quarterly sites)
            if (summaryCategory === 'warehouse_tekno') {
                const sitesData = ach.sites || {};
                const isQuarterlyTekno = (summarySOType === 'quarterly');

                if (isQuarterlyTekno) {
                    const teknoBuffer = sitesData['50002003305'];
                    const teknoStorage2 = sitesData['50002003448'];
                    const teknoStorage1 = sitesData['50002003922'];
                    const teknoPersiapan = sitesData['50002003599'];

                    updateAchCard(
                        'kpi-tekno-buffer-achievement',
                        'kpi-tekno-buffer-subtext',
                        'kpi-tekno-buffer-trend',
                        'kpi-tekno-buffer-status',
                        teknoBuffer ? { ...teknoBuffer, count: (teknoBuffer && teknoBuffer.has_data) ? 1 : 0, total_sites: 1 } : { pct: null, count: 0, total_sites: 1 },
                        '50002003305',
                        false,
                        98
                    );

                    updateAchCard(
                        'kpi-tekno-storage2-achievement',
                        'kpi-tekno-storage2-subtext',
                        'kpi-tekno-storage2-trend',
                        'kpi-tekno-storage2-status',
                        teknoStorage2 ? { ...teknoStorage2, count: (teknoStorage2 && teknoStorage2.has_data) ? 1 : 0, total_sites: 1 } : { pct: null, count: 0, total_sites: 1 },
                        '50002003448',
                        false,
                        98
                    );

                    updateAchCard(
                        'kpi-tekno-storage1-achievement',
                        'kpi-tekno-storage1-subtext',
                        'kpi-tekno-storage1-trend',
                        'kpi-tekno-storage1-status',
                        teknoStorage1 ? { ...teknoStorage1, count: (teknoStorage1 && teknoStorage1.has_data) ? 1 : 0, total_sites: 1 } : { pct: null, count: 0, total_sites: 1 },
                        '50002003922',
                        false,
                        98
                    );

                    updateAchCard(
                        'kpi-tekno-persiapan-achievement',
                        'kpi-tekno-persiapan-subtext',
                        'kpi-tekno-persiapan-trend',
                        'kpi-tekno-persiapan-status',
                        teknoPersiapan ? { ...teknoPersiapan, count: (teknoPersiapan && teknoPersiapan.has_data) ? 1 : 0, total_sites: 1 } : { pct: null, count: 0, total_sites: 1 },
                        '50002003599',
                        false,
                        98
                    );
                } else {
                    const teknoGudang = sitesData['50002003289'];
                    const teknoKhusus = sitesData['50002003307'];

                    updateAchCard(
                        'kpi-tekno-gudang-achievement',
                        'kpi-tekno-gudang-subtext',
                        'kpi-tekno-gudang-trend',
                        'kpi-tekno-gudang-status',
                        teknoGudang ? { ...teknoGudang, count: (teknoGudang && teknoGudang.has_data) ? 1 : 0, total_sites: 1 } : { pct: null, count: 0, total_sites: 1 },
                        '50002003289',
                        false,
                        98
                    );

                    updateAchCard(
                        'kpi-tekno-khusus-achievement',
                        'kpi-tekno-khusus-subtext',
                        'kpi-tekno-khusus-trend',
                        'kpi-tekno-khusus-status',
                        teknoKhusus ? { ...teknoKhusus, count: (teknoKhusus && teknoKhusus.has_data) ? 1 : 0, total_sites: 1 } : { pct: null, count: 0, total_sites: 1 },
                        '50002003307',
                        false,
                        98
                    );
                }
            }

            // Populate Subdept Average Value Cards under each group (WRO, CRO, ERO)
            const subDeptsData = ach.sub_depts || {};
            const updateSubDeptCard = (subKey) => {
                const sKey = subKey.toLowerCase();
                const sData = subDeptsData[sKey] || {};
                const rawPct = sData.pct !== undefined && sData.pct !== null ? parseFloat(sData.pct) : 0;
                const pct = rawPct;
                const count = sData.count || 0;
                const total = sData.total_sites || 0;
                const targetThreshold = (summaryCategory === 'warehouse_tekno' || summaryCategory === 'it_coorporate') ? 98 : 85;
                const color = total === 0 ? '#94a3b8' : getPctColor(pct, targetThreshold === 98);

                const valEl = document.getElementById(`kpi-subdept-val-${sKey}`);
                if (valEl) {
                    valEl.textContent = `${pct.toFixed(2)}%`;
                    valEl.style.color = color;
                }

                const metaEl = document.getElementById(`kpi-subdept-meta-${sKey}`);
                if (metaEl) {
                    metaEl.textContent = `${count}/${total} Sites`;
                }

                const trendEl = document.getElementById(`kpi-subdept-trend-${sKey}`);
                if (trendEl) {
                    if (total === 0) {
                        trendEl.innerHTML = '';
                    } else {
                        let diff = null;
                        if (sData && sData.diff_pct !== undefined && sData.diff_pct !== null) {
                            diff = Number(sData.diff_pct);
                        } else if (sData && sData.prev_pct !== undefined && sData.prev_pct !== null && sData.pct !== null && sData.pct !== undefined) {
                            diff = Number(sData.pct) - Number(sData.prev_pct);
                        }

                        if (diff === null) {
                            trendEl.innerHTML = '<span class="kpi-target-indicator target-neutral"><span>-</span></span>';
                        } else {
                            const isUp = diff > 0;
                            const isDown = diff < 0;
                            const sign = isUp ? '+' : '';
                            const trendClass = isUp ? 'target-up' : (isDown ? 'target-down' : 'target-neutral');
                            const formattedDiff = `${sign}${diff.toFixed(2)}%`;
                            const triangleSvg = isUp
                                ? `<svg width="5.5" height="5.5" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"/></svg>`
                                : (isDown ? `<svg width="5.5" height="5.5" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"/></svg>` : '');

                            trendEl.innerHTML = `
                                <span class="kpi-target-indicator ${trendClass}">
                                    ${triangleSvg}
                                    <span>${formattedDiff}</span>
                                </span>
                            `;
                        }
                    }
                }

                const statusEl = document.getElementById(`kpi-subdept-status-${sKey}`);
                if (statusEl) {
                    if (total === 0) {
                        statusEl.innerHTML = '<span class="so-status-badge status-none">Belum Ada Data</span>';
                    } else if (pct >= targetThreshold) {
                        statusEl.innerHTML = '<span class="so-status-badge status-green">Tercapai</span>';
                    } else {
                        statusEl.innerHTML = '<span class="so-status-badge status-red">Tidak Tercapai</span>';
                    }
                }
            };

            ['cso', 'nso', 'sso', 'cjdo', 'eko', 'wjo', 'wko', 'bno', 'ejo', 'mpo', 'smo'].forEach(updateSubDeptCard);

            // Populate DB Analysis Card (Result DB QTY)
            updateDbAnalysis(json.db_analysis || ach.db_analysis || {});
        }

        const summaryCacheKey = `${summarySOType}_${summaryCategory}_${year}_${month}`;

        // ── 0ms Instant Cache Render ──
        if (summaryDataCache.has(summaryCacheKey)) {
            applySummaryJsonData(summaryDataCache.get(summaryCacheKey));
        }

        try {
            const params = new URLSearchParams({
                action: 'summary',
                so_type: summarySOType,
                category: summaryCategory
            });
            if (month) params.append('month', month);
            if (year) params.append('year', year);

            const res = await fetch(`api/reconciliation.php?${params.toString()}`);
            const json = await res.json();

            if (!json.success) {
                console.error('Failed to load summary data:', json.message);
                return;
            }

            summaryDataCache.set(summaryCacheKey, json);
            applySummaryJsonData(json);

            // Pre-fetch other categories in background (warmer for 0ms switch)
            prefetchCategoryVariants(year, month);

            // Load Trend Line Graphics (DEPT, Sub DEPT, PMD Sub DEPT)
            loadTrendCharts(year);

            // Load Report SO Outlet Regional / PMD
            loadSubDeptResults();

            // Reload Rekapitulasi for the selected year
            loadRekapitulasi();

            // Load Site Movement History & Comparison Logs
            loadSiteMovements(year, month);

            // Update Score Card Summary period & headers (rolling 3 months back)
            updateScoreCardPeriod(year, month);

            // Load Catatan Executive Summary for selected period
            loadExecutiveNotes(year, month);

            // Load Rekapitulasi Status Penyelesaian DB for selected period
            loadRekapDbStatusData(year, month);

        } catch (err) {
            console.error('Error loading summary totals:', err);
        }
    }

    function prefetchCategoryVariants(year, month) {
        const variants = (summarySOType === 'quarterly')
            ? ['outlet_subarep', 'warehouse_hub', 'warehouse_tekno']
            : ['pmd', 'outlet', 'warehouse_hub', 'warehouse_tekno', 'it_coorporate'];

        variants.forEach(cat => {
            if (cat === summaryCategory) return;
            const cKey = `${summarySOType}_${cat}_${year}_${month}`;
            if (!summaryDataCache.has(cKey)) {
                fetch(`api/reconciliation.php?action=summary&so_type=${summarySOType}&category=${cat}&month=${month}&year=${year}`)
                    .then(r => r.json())
                    .then(res => {
                        if (res.success) summaryDataCache.set(cKey, res);
                    })
                    .catch(() => { });
            }
            const scKey = `${summarySOType}_${cat}_${year}_${month}`;
            if (!scorecardDataCache.has(scKey)) {
                fetch(`api/scorecard_summary.php?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}&category=${encodeURIComponent(cat)}&so_type=${encodeURIComponent(summarySOType)}`)
                    .then(r => r.json())
                    .then(res => {
                        if (res.success) scorecardDataCache.set(scKey, res);
                    })
                    .catch(() => { });
            }
            const sKey = `${summarySOType}_${cat}_all_all_${month}_${year}`;
            if (!subdeptResultsCache.has(sKey)) {
                fetch(`api/reconciliation.php?action=subdept_results&so_type=${summarySOType}&category=${cat}&dept=all&sub_dept=all&month=${month}&year=${year}`)
                    .then(r => r.json())
                    .then(res => {
                        if (res.success) subdeptResultsCache.set(sKey, res);
                    })
                    .catch(() => { });
            }
        });
    }

    // ── DB Analysis (Result DB QTY) Helper Functions ─────────────
    let currentDbAnalysisData = null;

    function syncDbAnalysisVisibility() {
        const isPmd = (summaryCategory === 'pmd');
        const isIt = (summaryCategory === 'it_coorporate');
        const isTekno = (summaryCategory === 'warehouse_tekno');
        const isHub = (summaryCategory === 'warehouse_hub');
        const isQuarterly = (summarySOType === 'quarterly');

        const gWro = document.getElementById('db-group-wro');
        const gCro = document.getElementById('db-group-cro');
        const gEro = document.getElementById('db-group-ero');
        const gPmd = document.getElementById('db-group-pmd');
        const gIt = document.getElementById('db-group-it');
        const gTekno = document.getElementById('db-group-tekno');

        if (isIt) {
            if (gWro) gWro.style.display = 'none';
            if (gCro) gCro.style.display = 'none';
            if (gEro) gEro.style.display = 'none';
            if (gPmd) gPmd.style.display = 'none';
            if (gTekno) gTekno.style.display = 'none';
            if (gIt) gIt.style.display = 'flex';
        } else if (isTekno) {
            if (gWro) gWro.style.display = 'none';
            if (gCro) gCro.style.display = 'none';
            if (gEro) gEro.style.display = 'none';
            if (gPmd) gPmd.style.display = 'none';
            if (gIt) gIt.style.display = 'none';
            if (gTekno) gTekno.style.display = 'flex';
        } else if (isPmd) {
            if (gWro) gWro.style.display = 'none';
            if (gCro) gCro.style.display = 'none';
            if (gEro) gEro.style.display = 'none';
            if (gIt) gIt.style.display = 'none';
            if (gTekno) gTekno.style.display = 'none';
            if (gPmd) gPmd.style.display = 'flex';
        } else {
            if (gIt) gIt.style.display = 'none';
            if (gTekno) gTekno.style.display = 'none';
            if (gPmd) gPmd.style.display = 'none';
            if (gWro) gWro.style.display = 'flex';
            // In Warehouse HUB, CRO is active in quarterly (Balikpapan). For regular outlet quarterly, CRO has no sites.
            if (gCro) gCro.style.display = (isQuarterly && !isHub) ? 'none' : 'flex';
            if (gEro) gEro.style.display = 'flex';
        }

        // Subdept items filtering in Result DB Analysis:
        // For Warehouse HUB, ONLY show NSO, SSO, EKO, EJO. Hide others (CSO, CJDO, WJO, WKO, BNO, MPO, SMO).
        const hubSubDepts = ['nso', 'sso', 'eko', 'ejo'];
        ['cso', 'nso', 'sso', 'cjdo', 'eko', 'wjo', 'wko', 'bno', 'ejo', 'mpo', 'smo', 'dno', 'dso'].forEach(code => {
            const el = document.getElementById(`db-subdept-item-${code}`);
            if (el) {
                if (isHub) {
                    el.style.display = hubSubDepts.includes(code) ? 'flex' : 'none';
                } else {
                    el.style.display = 'flex';
                }
            }
        });

        // Toggle subdepts in Status Groups (Outlet vs PMD vs IT vs Tekno)
        document.querySelectorAll('.db-status-sub-outlet').forEach(el => {
            el.style.display = (!isPmd && !isIt && !isTekno) ? 'grid' : 'none';
            // In Warehouse HUB quarterly, make sure CRO item inside .db-status-sub-outlet is visible
            const croItem = el.children[1];
            if (croItem) {
                croItem.style.display = (isQuarterly && !isHub) ? 'none' : 'block';
            }
        });
        document.querySelectorAll('.db-status-sub-pmd').forEach(el => {
            el.style.display = isPmd ? 'grid' : 'none';
        });
        document.querySelectorAll('.db-status-sub-it').forEach(el => {
            el.style.display = isIt ? 'grid' : 'none';
        });
        document.querySelectorAll('.db-status-sub-tekno').forEach(el => {
            el.style.display = isTekno ? 'grid' : 'none';
        });

        updateDbAnalysisGrandTotalBadge();
        renderResultDbChart(currentDbAnalysisData);
        if (currentDbAnalysisData) {
            const curSolved = Number(currentDbAnalysisData.solved || 0);
            const curUnsolved = Number(currentDbAnalysisData.unsolved || 0);
            const curNew = Number(currentDbAnalysisData.new_db || 0);
            const curTotal = curSolved + curUnsolved + curNew;
            const curRate = curTotal > 0 ? ((curSolved / curTotal) * 100) : 0;
            renderDbResolutionGauge(curRate, currentDbAnalysisData);
        }
    }

    function setDbAnalysisDept() {
        syncDbAnalysisVisibility();
    }

    function toggleDbBreakdownPanel() {
        const panel = document.getElementById('db-breakdown-panel');
        const text = document.getElementById('db-breakdown-toggle-text');
        if (!panel) return;
        const isHidden = (panel.style.display === 'none' || panel.style.display === '' || window.getComputedStyle(panel).display === 'none');
        panel.style.display = isHidden ? 'block' : 'none';
        if (text) {
            text.textContent = isHidden ? 'Sembunyikan Breakdown ▲' : 'Tampilkan Breakdown ▼';
        }
    }
    window.toggleDbBreakdownPanel = toggleDbBreakdownPanel;

    function getDbPrevPeriodLabel() {
        if (!currentDbAnalysisData || !currentDbAnalysisData.previous_period) return 'periode sebelumnya';
        const prev = currentDbAnalysisData.previous_period;
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        if (prev.month) {
            return `${monthNames[prev.month] || ('Bulan ' + prev.month)} ${prev.year}`;
        }
        return `Tahun ${prev.year}`;
    }

    function renderDbTrendBadge(item, isSmall = false) {
        if (!currentDbAnalysisData || !currentDbAnalysisData.has_previous || !item || item.diff_qty === undefined || item.diff_qty === null) {
            return `
                <span class="db-trend-indicator db-trend-neutral">
                    <span>-</span>
                </span>
            `;
        }
        const diff = item.diff_qty;
        const prevQty = item.prev_qty !== undefined ? item.prev_qty : 0;
        const prevLabel = getDbPrevPeriodLabel();
        const svgSize = isSmall ? '6' : '7.5';
        const formatQty = (n) => Number(n || 0).toLocaleString();
        const statusDetail = (item.solved !== undefined || item.unsolved !== undefined || item.new_db !== undefined)
            ? ` | Solved: ${formatQty(item.solved || 0)}, Unsolved: ${formatQty(item.unsolved || 0)}, New: ${formatQty(item.new_db || 0)}`
            : '';

        // User requirement: If DB is MORE than previous period -> UP arrow, color RED.
        // If DB is LESS than previous period -> DOWN arrow, color GREEN.
        if (diff > 0) {
            const formatted = `+${formatQty(diff)}`;
            return `
                <span class="db-trend-indicator db-trend-up">
                    <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12,4 21,20 3,20"/>
                    </svg>
                    <span>${formatted}</span>
                </span>
            `;
        } else if (diff < 0) {
            const formatted = `${formatQty(diff)}`;
            return `
                <span class="db-trend-indicator db-trend-down">
                    <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12,20 3,4 21,4"/>
                    </svg>
                    <span>${formatted}</span>
                </span>
            `;
        } else {
            return `
                <span class="db-trend-indicator db-trend-neutral">
                    <span>-</span>
                </span>
            `;
        }
    }

    function renderStatusTrendBadge(diff, prevVal, isSmall = false, statusType = 'unsolved') {
        if (!currentDbAnalysisData || !currentDbAnalysisData.has_previous || diff === undefined || diff === null) {
            return `
                <span class="db-trend-indicator db-trend-neutral">
                    <span>-</span>
                </span>
            `;
        }
        const prevLabel = getDbPrevPeriodLabel();
        const svgSize = isSmall ? '6' : '7.5';
        const formatQty = (n) => Number(n || 0).toLocaleString();

        const isSolved = (statusType === 'solved' || statusType === true);

        if (diff > 0) {
            const formatted = `+${formatQty(diff)}`;
            // Solved bertambah: hijau (membaik). Unsolved / New DB bertambah: merah (buruk)
            const trendClass = isSolved ? 'db-trend-good-up' : 'db-trend-bad-up';
            return `
                <span class="db-trend-indicator ${trendClass}">
                    <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12,4 21,20 3,20"/>
                    </svg>
                    <span>${formatted}</span>
                </span>
            `;
        } else if (diff < 0) {
            const formatted = `${formatQty(diff)}`;
            // Solved DB dari bulan lalu: selalu warna hijau karena solved menandakan penyelesaian yang membaik
            // Unsolved / New DB berkurang: warna hijau (karena berkurang = membaik)
            const trendClass = isSolved ? 'db-trend-good-down' : 'db-trend-good-down';
            return `
                <span class="db-trend-indicator ${trendClass}">
                    <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12,20 3,4 21,4"/>
                    </svg>
                    <span>${formatted}</span>
                </span>
            `;
        } else {
            return `
                <span class="db-trend-indicator db-trend-neutral">
                    <span>-</span>
                </span>
            `;
        }
    }

    function updateDbAnalysisGrandTotalBadge() {
        if (!currentDbAnalysisData) return;
        const badgeEl = document.getElementById('db-analysis-grand-total');
        const trendEl = document.getElementById('db-grand-trend');
        const gSolvedEl = document.getElementById('db-grand-solved');
        const gUnsolvedEl = document.getElementById('db-grand-unsolved');
        const gNewEl = document.getElementById('db-grand-new');
        if (!badgeEl) return;
        const isPmd = (summaryCategory === 'pmd');
        const isIt = (summaryCategory === 'it_coorporate');
        const isTekno = (summaryCategory === 'warehouse_tekno');
        const isHub = (summaryCategory === 'warehouse_hub');

        let totalQty = 0;
        let activeItem = null;
        if (isPmd) {
            activeItem = currentDbAnalysisData.pmd || currentDbAnalysisData.national || {};
            totalQty = activeItem.qty || 0;
        } else if (isIt || isTekno || isHub) {
            activeItem = currentDbAnalysisData.national || {};
            totalQty = activeItem.qty || 0;
        } else {
            activeItem = currentDbAnalysisData.outlet_national || currentDbAnalysisData.national || {};
            totalQty = activeItem.qty || 0;
        }
        // Result DB Analysis Grand Total
        const elDbAnalysisGrand = document.getElementById('db-analysis-grand-total');
        if (elDbAnalysisGrand) elDbAnalysisGrand.textContent = Number(totalQty).toLocaleString();

        // Status Penyelesaian DB: Total DB is counted Solved DB, Unsolved DB and New DB
        const statusSolved = Number(activeItem?.solved || 0);
        const statusUnsolved = Number(activeItem?.unsolved || 0);
        const statusNew = Number(activeItem?.new_db || 0);
        const totalStatusDb = (activeItem?.total_status !== undefined && activeItem?.total_status !== null)
            ? Number(activeItem.total_status)
            : (statusSolved + statusUnsolved + statusNew);

        ['db-status-grand-total', 'all-db-status-grand-total'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = Number(totalStatusDb).toLocaleString();
        });

        if (activeItem) {
            // Trend badge for Result DB Analysis
            const trendBadgeHtml = renderDbTrendBadge(activeItem, false);
            const elGrandTrend = document.getElementById('db-grand-trend');
            if (elGrandTrend) elGrandTrend.innerHTML = trendBadgeHtml;

            // Trend badge for Status Penyelesaian DB (Total DB Solved + Unsolved + New DB vs previous period)
            let prevStatusTotal = null;
            if (activeItem.prev_total_status !== undefined && activeItem.prev_total_status !== null) {
                prevStatusTotal = Number(activeItem.prev_total_status);
            } else if (activeItem.prev_solved !== undefined && activeItem.prev_solved !== null &&
                activeItem.prev_unsolved !== undefined && activeItem.prev_unsolved !== null &&
                activeItem.prev_new_db !== undefined && activeItem.prev_new_db !== null) {
                prevStatusTotal = Number(activeItem.prev_solved) + Number(activeItem.prev_unsolved) + Number(activeItem.prev_new_db);
            }

            let diffStatusTotal = null;
            if (activeItem.diff_total_status !== undefined && activeItem.diff_total_status !== null) {
                diffStatusTotal = Number(activeItem.diff_total_status);
            } else if (prevStatusTotal !== null) {
                diffStatusTotal = totalStatusDb - prevStatusTotal;
            }

            const statusTrendBadgeHtml = renderStatusTrendBadge(diffStatusTotal, prevStatusTotal, false, 'unsolved');
            ['db-status-grand-trend', 'all-db-status-grand-trend', 'strip-metric-db-grand-trend'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = statusTrendBadgeHtml;
            });
        }

        const formatQty = (n) => Number(n || 0).toLocaleString();
        if (gSolvedEl) gSolvedEl.textContent = formatQty(activeItem?.solved || 0);
        if (gUnsolvedEl) gUnsolvedEl.textContent = formatQty(activeItem?.unsolved || 0);
        if (gNewEl) gNewEl.textContent = formatQty(activeItem?.new_db || 0);

        // Trend badges for Status top cards and strip metrics
        ['db-trend-solved', 'strip-metric-trend-solved'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = renderStatusTrendBadge(activeItem?.diff_solved, activeItem?.prev_solved, false, 'solved');
        });
        ['db-trend-unsolved', 'strip-metric-trend-unsolved'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = renderStatusTrendBadge(activeItem?.diff_unsolved, activeItem?.prev_unsolved, false, 'unsolved');
        });
        ['db-trend-new', 'strip-metric-trend-new'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = renderStatusTrendBadge(activeItem?.diff_new_db, activeItem?.prev_new_db, false, 'new_db');
        });

        // Sites under value for Status top cards
        const subtextSolved = document.getElementById('db-subtext-solved');
        const subtextUnsolved = document.getElementById('db-subtext-unsolved');
        const subtextNew = document.getElementById('db-subtext-new');
        let totalScopeSites = 55;
        if (isPmd) totalScopeSites = activeItem?.total_sites || 7;
        else if (isIt) totalScopeSites = activeItem?.total_sites || 2;
        else if (isHub) totalScopeSites = activeItem?.total_sites || 4;
        else if (isTekno) totalScopeSites = activeItem?.total_sites || ((summarySOType === 'quarterly') ? 4 : 2);
        else totalScopeSites = activeItem?.total_sites || ((summarySOType === 'quarterly') ? 16 : 55);

        if (subtextSolved) subtextSolved.textContent = `${activeItem?.solved_sites || 0}/${totalScopeSites} Sites`;
        if (subtextUnsolved) subtextUnsolved.textContent = `${activeItem?.unsolved_sites || 0}/${totalScopeSites} Sites`;
        if (subtextNew) subtextNew.textContent = `${activeItem?.new_db_sites || 0}/${totalScopeSites} Sites`;

        // Update Column 3: Ringkasan DB Analysis & Status
        const solvedRate = totalStatusDb > 0 ? ((statusSolved / totalStatusDb) * 100) : 0;
        const unsolvedRate = totalStatusDb > 0 ? ((statusUnsolved / totalStatusDb) * 100) : 0;
        const newDbRate = totalStatusDb > 0 ? ((statusNew / totalStatusDb) * 100) : 0;

        const elSummaryRateBadge = document.getElementById('db-summary-rate-badge');
        if (elSummaryRateBadge) elSummaryRateBadge.textContent = `${solvedRate.toFixed(2)}% Solved`;

        const elSummaryRateText = document.getElementById('db-summary-rate-text');
        if (elSummaryRateText) elSummaryRateText.textContent = `${solvedRate.toFixed(2)}%`;

        const elBarSolved = document.getElementById('db-summary-bar-solved');
        if (elBarSolved) elBarSolved.style.width = `${Math.min(100, solvedRate)}%`;

        const elBarUnsolved = document.getElementById('db-summary-bar-unsolved');
        if (elBarUnsolved) elBarUnsolved.style.width = `${Math.min(100, unsolvedRate)}%`;

        const elBarNew = document.getElementById('db-summary-bar-new');
        if (elBarNew) elBarNew.style.width = `${Math.min(100, newDbRate)}%`;

        const elSumTotal = document.getElementById('db-summary-grand-total');
        if (elSumTotal) elSumTotal.textContent = Number(totalQty).toLocaleString();

        const elSumTrend = document.getElementById('db-summary-grand-trend');
        const elGrandTrend = document.getElementById('db-grand-trend');
        if (elSumTrend && elGrandTrend) elSumTrend.innerHTML = elGrandTrend.innerHTML;

        const elSumValSolved = document.getElementById('db-summary-val-solved');
        if (elSumValSolved) elSumValSolved.textContent = formatQty(statusSolved);
        const elSumPctSolved = document.getElementById('db-summary-pct-solved');
        if (elSumPctSolved) elSumPctSolved.textContent = `(${solvedRate.toFixed(2)}%)`;

        const elSumValUnsolved = document.getElementById('db-summary-val-unsolved');
        if (elSumValUnsolved) elSumValUnsolved.textContent = formatQty(statusUnsolved);
        const elSumPctUnsolved = document.getElementById('db-summary-pct-unsolved');
        if (elSumPctUnsolved) elSumPctUnsolved.textContent = `(${unsolvedRate.toFixed(2)}%)`;

        const elSumValNew = document.getElementById('db-summary-val-new');
        if (elSumValNew) elSumValNew.textContent = formatQty(statusNew);
        const elSumPctNew = document.getElementById('db-summary-pct-new');
        if (elSumPctNew) elSumPctNew.textContent = `(${newDbRate.toFixed(2)}%)`;

        const elSumStatTotal = document.getElementById('db-summary-stat-status-total');
        if (elSumStatTotal) elSumStatTotal.textContent = Number(totalStatusDb).toLocaleString();

        const elSumCoverage = document.getElementById('db-summary-val-coverage');
        if (elSumCoverage) {
            const sSites = activeItem?.solved_sites || 0;
            const uSites = activeItem?.unsolved_sites || 0;
            const nSites = activeItem?.new_db_sites || 0;
            const maxSites = Math.max(sSites, uSites, nSites);
            elSumCoverage.textContent = `${maxSites}/${totalScopeSites} Sites`;
        }

        renderDbResolutionGauge(solvedRate, activeItem || {});
    }

    function updateDbAnalysis(data) {
        currentDbAnalysisData = data || {};
        syncDbAnalysisVisibility();

        const formatQty = (n) => Number(n || 0).toLocaleString();

        const updateDeptGroup = (deptKey, valId, trendId, subtextId) => {
            const item = currentDbAnalysisData[deptKey] || {};
            const valEl = document.getElementById(valId);
            if (valEl) valEl.textContent = formatQty(item.qty);

            const trendEl = document.getElementById(trendId);
            if (trendEl) {
                trendEl.innerHTML = renderDbTrendBadge(item, false);
            }

            const subEl = document.getElementById(subtextId);
            if (subEl) {
                const withQty = item.sites_with_qty !== undefined ? item.sites_with_qty : (item.count || 0);
                const total = item.total_sites || 0;
                subEl.textContent = `(${withQty}/${total} Sites)`;
            }

            const solvedDeptEl = document.getElementById(`db-solved-${deptKey}`);
            if (solvedDeptEl) solvedDeptEl.textContent = formatQty(item.solved);
            const trendSolvedEl = document.getElementById(`db-sub-trend-solved-${deptKey}`);
            if (trendSolvedEl) trendSolvedEl.innerHTML = renderStatusTrendBadge(item.diff_solved, item.prev_solved, true, 'solved');
            const sitesSolvedEl = document.getElementById(`db-sub-sites-solved-${deptKey}`);
            if (sitesSolvedEl) {
                const sSites = item.solved_sites || 0;
                const tSites = item.total_sites || 0;
                sitesSolvedEl.textContent = `${sSites}/${tSites} Sites`;
            }

            const unsolvedDeptEl = document.getElementById(`db-unsolved-${deptKey}`);
            if (unsolvedDeptEl) unsolvedDeptEl.textContent = formatQty(item.unsolved);
            const trendUnsolvedEl = document.getElementById(`db-sub-trend-unsolved-${deptKey}`);
            if (trendUnsolvedEl) trendUnsolvedEl.innerHTML = renderStatusTrendBadge(item.diff_unsolved, item.prev_unsolved, true, 'unsolved');
            const sitesUnsolvedEl = document.getElementById(`db-sub-sites-unsolved-${deptKey}`);
            if (sitesUnsolvedEl) {
                const uSites = item.unsolved_sites || 0;
                const tSites = item.total_sites || 0;
                sitesUnsolvedEl.textContent = `${uSites}/${tSites} Sites`;
            }

            const newDeptEl = document.getElementById(`db-new-${deptKey}`);
            if (newDeptEl) newDeptEl.textContent = formatQty(item.new_db);
            const trendNewEl = document.getElementById(`db-sub-trend-new-${deptKey}`);
            if (trendNewEl) trendNewEl.innerHTML = renderStatusTrendBadge(item.diff_new_db, item.prev_new_db, true, 'new_db');
            const sitesNewEl = document.getElementById(`db-sub-sites-new-${deptKey}`);
            if (sitesNewEl) {
                const nSites = item.new_db_sites || 0;
                const tSites = item.total_sites || 0;
                sitesNewEl.textContent = `${nSites}/${tSites} Sites`;
            }
        };

        updateDeptGroup('wro', 'db-val-wro', 'db-trend-wro', 'db-subtext-wro');
        updateDeptGroup('cro', 'db-val-cro', 'db-trend-cro', 'db-subtext-cro');
        updateDeptGroup('ero', 'db-val-ero', 'db-trend-ero', 'db-subtext-ero');
        updateDeptGroup('pmd', 'db-val-pmd', 'db-trend-pmd', 'db-subtext-pmd');

        const subData = currentDbAnalysisData.sub_depts || {};
        const updateSubDeptDb = (sKey) => {
            const key = sKey.toLowerCase();
            const item = subData[key] || currentDbAnalysisData[key] || {};
            const valEl = document.getElementById(`db-subdept-val-${key}`);
            if (valEl) valEl.textContent = formatQty(item.qty);

            const trendEl = document.getElementById(`db-subdept-trend-${key}`);
            if (trendEl) {
                trendEl.innerHTML = renderDbTrendBadge(item, true);
            }

            const metaEl = document.getElementById(`db-subdept-meta-${key}`);
            if (metaEl) {
                const withQty = item.sites_with_qty !== undefined ? item.sites_with_qty : (item.count || 0);
                const total = item.total_sites || 0;
                metaEl.textContent = `${withQty}/${total} Sites`;
            }

            const solvedEl = document.getElementById(`db-solved-${key}`);
            if (solvedEl) solvedEl.textContent = formatQty(item.solved);
            const trendSolvedEl = document.getElementById(`db-sub-trend-solved-${key}`);
            if (trendSolvedEl) trendSolvedEl.innerHTML = renderStatusTrendBadge(item.diff_solved, item.prev_solved, true, 'solved');
            const sitesSolvedEl = document.getElementById(`db-sub-sites-solved-${key}`);
            if (sitesSolvedEl) {
                const sSites = item.solved_sites || 0;
                const tSites = item.total_sites || 0;
                sitesSolvedEl.textContent = `${sSites}/${tSites} Sites`;
            }

            const unsolvedEl = document.getElementById(`db-unsolved-${key}`);
            if (unsolvedEl) unsolvedEl.textContent = formatQty(item.unsolved);
            const trendUnsolvedEl = document.getElementById(`db-sub-trend-unsolved-${key}`);
            if (trendUnsolvedEl) trendUnsolvedEl.innerHTML = renderStatusTrendBadge(item.diff_unsolved, item.prev_unsolved, true, 'unsolved');
            const sitesUnsolvedEl = document.getElementById(`db-sub-sites-unsolved-${key}`);
            if (sitesUnsolvedEl) {
                const uSites = item.unsolved_sites || 0;
                const tSites = item.total_sites || 0;
                sitesUnsolvedEl.textContent = `${uSites}/${tSites} Sites`;
            }

            const newEl = document.getElementById(`db-new-${key}`);
            if (newEl) newEl.textContent = formatQty(item.new_db);
            const trendNewEl = document.getElementById(`db-sub-trend-new-${key}`);
            if (trendNewEl) trendNewEl.innerHTML = renderStatusTrendBadge(item.diff_new_db, item.prev_new_db, true, 'new_db');
            const sitesNewEl = document.getElementById(`db-sub-sites-new-${key}`);
            if (sitesNewEl) {
                const nSites = item.new_db_sites || 0;
                const tSites = item.total_sites || 0;
                sitesNewEl.textContent = `${nSites}/${tSites} Sites`;
            }
        };

        ['cso', 'nso', 'sso', 'cjdo', 'eko', 'wjo', 'wko', 'bno', 'ejo', 'mpo', 'smo', 'dno', 'dso'].forEach(updateSubDeptDb);

        // IT Corporate: Populate individual site cards and status breakdowns
        const sitesData = currentDbAnalysisData.sites || {};
        const tbsItem = sitesData['50002001384'] || {};
        const arcadiaItem = sitesData['50002003133'] || {};

        const valTbs = document.getElementById('db-val-it-tbs');
        if (valTbs) valTbs.textContent = formatQty(tbsItem.qty);
        const trendTbs = document.getElementById('db-trend-it-tbs');
        if (trendTbs) trendTbs.innerHTML = renderDbTrendBadge(tbsItem, false);

        const valArcadia = document.getElementById('db-val-it-arcadia');
        if (valArcadia) valArcadia.textContent = formatQty(arcadiaItem.qty);
        const trendArcadia = document.getElementById('db-trend-it-arcadia');
        if (trendArcadia) trendArcadia.innerHTML = renderDbTrendBadge(arcadiaItem, false);

        // IT Corporate status sub-items
        const sTbsSolved = document.getElementById('db-solved-it-tbs');
        if (sTbsSolved) sTbsSolved.textContent = formatQty(tbsItem.solved);
        const stTbsSolved = document.getElementById('db-sub-trend-solved-it-tbs');
        if (stTbsSolved) stTbsSolved.innerHTML = renderStatusTrendBadge(tbsItem.diff_solved, tbsItem.prev_solved, true, 'solved');

        const sArcSolved = document.getElementById('db-solved-it-arcadia');
        if (sArcSolved) sArcSolved.textContent = formatQty(arcadiaItem.solved);
        const stArcSolved = document.getElementById('db-sub-trend-solved-it-arcadia');
        if (stArcSolved) stArcSolved.innerHTML = renderStatusTrendBadge(arcadiaItem.diff_solved, arcadiaItem.prev_solved, true, 'solved');

        const sTbsUnsolved = document.getElementById('db-unsolved-it-tbs');
        if (sTbsUnsolved) sTbsUnsolved.textContent = formatQty(tbsItem.unsolved);
        const stTbsUnsolved = document.getElementById('db-sub-trend-unsolved-it-tbs');
        if (stTbsUnsolved) stTbsUnsolved.innerHTML = renderStatusTrendBadge(tbsItem.diff_unsolved, tbsItem.prev_unsolved, true, 'unsolved');

        const sArcUnsolved = document.getElementById('db-unsolved-it-arcadia');
        if (sArcUnsolved) sArcUnsolved.textContent = formatQty(arcadiaItem.unsolved);
        const stArcUnsolved = document.getElementById('db-sub-trend-unsolved-it-arcadia');
        if (stArcUnsolved) stArcUnsolved.innerHTML = renderStatusTrendBadge(arcadiaItem.diff_unsolved, arcadiaItem.prev_unsolved, true, 'unsolved');

        const sTbsNew = document.getElementById('db-new-it-tbs');
        if (sTbsNew) sTbsNew.textContent = formatQty(tbsItem.new_db);
        const stTbsNew = document.getElementById('db-sub-trend-new-it-tbs');
        if (stTbsNew) stTbsNew.innerHTML = renderStatusTrendBadge(tbsItem.diff_new_db, tbsItem.prev_new_db, true, 'new_db');

        const sArcNew = document.getElementById('db-new-it-arcadia');
        if (sArcNew) sArcNew.textContent = formatQty(arcadiaItem.new_db);
        const stArcNew = document.getElementById('db-sub-trend-new-it-arcadia');
        if (stArcNew) stArcNew.innerHTML = renderStatusTrendBadge(arcadiaItem.diff_new_db, arcadiaItem.prev_new_db, true, 'new_db');

        // Warehouse Tekno: Populate dynamic cards and status breakdown
        const teknoContainer = document.getElementById('db-tekno-cards-container');
        if (teknoContainer) {
            let html = '';
            Object.values(sitesData).forEach(s => {
                const siteCode = s.sitecode || '';
                const siteName = s.name_site || siteCode;
                html += `
                    <div class="kpi-card kpi-card-split">
                        <div class="kpi-title">${escapeHtml(siteName)}</div>
                        <div class="kpi-card-main">
                            <div class="kpi-split-value" style="color: #0f172a;">${formatQty(s.qty || 0)}</div>
                            <div class="kpi-split-badges">
                                <span class="db-dept-trend">${renderDbTrendBadge(s, false)}</span>
                            </div>
                        </div>
                        <div class="kpi-card-meta">
                            <div class="kpi-subtext">${escapeHtml(siteCode)}</div>
                        </div>
                    </div>
                `;
            });
            teknoContainer.innerHTML = html || '<div style="color: #94a3b8; font-size: 12px; padding: 1rem; text-align: center;">Tidak ada data site Tekno</div>';
        }

        const renderTeknoSubStatus = (type, color) => {
            return Object.values(sitesData).map(s => {
                const diffVal = type === 'solved' ? s.diff_solved : (type === 'unsolved' ? s.diff_unsolved : s.diff_new_db);
                const prevVal = type === 'solved' ? s.prev_solved : (type === 'unsolved' ? s.prev_unsolved : s.prev_new_db);
                const countVal = type === 'solved' ? s.solved : (type === 'unsolved' ? s.unsolved : s.new_db);
                const displayName = s.name_site || s.sitecode;
                return `
                    <div class="kpi-subdept-item">
                        <div class="kpi-subdept-header">
                            <span class="kpi-subdept-name">${escapeHtml(displayName)}</span>
                            <span class="db-subdept-trend">${renderStatusTrendBadge(diffVal, prevVal, true, type)}</span>
                        </div>
                        <div class="kpi-subdept-val" style="color: ${color};">${formatQty(countVal || 0)}</div>
                        <div class="kpi-subdept-meta">${escapeHtml(s.sitecode)}</div>
                    </div>
                `;
            }).join('');
        };

        const teknoSolved = document.getElementById('db-status-sub-tekno-solved');
        if (teknoSolved) teknoSolved.innerHTML = renderTeknoSubStatus('solved', '#16a34a');

        const teknoUnsolved = document.getElementById('db-status-sub-tekno-unsolved');
        if (teknoUnsolved) teknoUnsolved.innerHTML = renderTeknoSubStatus('unsolved', '#dc2626');

        const teknoNew = document.getElementById('db-status-sub-tekno-new');
        if (teknoNew) teknoNew.innerHTML = renderTeknoSubStatus('new_db', '#2563eb');

        updateDbAnalysisGrandTotalBadge();
        renderResultDbChart(currentDbAnalysisData);
        if (currentDbAnalysisData) {
            const curSolved = Number(currentDbAnalysisData.solved || 0);
            const curUnsolved = Number(currentDbAnalysisData.unsolved || 0);
            const curNew = Number(currentDbAnalysisData.new_db || 0);
            const curTotal = curSolved + curUnsolved + curNew;
            const curRate = curTotal > 0 ? ((curSolved / curTotal) * 100) : 0;
            renderDbResolutionGauge(curRate, currentDbAnalysisData);
        }
    }

    // ── Result DB Analysis (Breakdown Wilayah - Bar Chart) ──────
    let chartResultDbAnalysis = null;
    let resultDbChartWilayahFilter = 'all';

    function onResultDbChartFilterChange(val) {
        resultDbChartWilayahFilter = val || 'all';
        renderResultDbChart(currentDbAnalysisData);
    }

    function renderResultDbChart(data) {
        const canvas = document.getElementById('chart-result-db-analysis');
        if (!canvas) return;

        const dbData = data || currentDbAnalysisData || {};

        // Update Period Badge
        const periodBadge = document.getElementById('chart-rdb-period-badge');
        const filterMonth = document.getElementById('summary-filter-month')?.value;
        const filterYear = document.getElementById('summary-filter-year')?.value || 2026;
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        if (periodBadge) {
            const mText = filterMonth && monthNames[parseInt(filterMonth, 10)] ? monthNames[parseInt(filterMonth, 10)] : (filterMonth ? `Bulan ${filterMonth}` : 'Semua Bulan');
            periodBadge.textContent = `${mText} ${filterYear}`;
        }

        // Update Wilayah Filter Select options dynamically
        const filterSelect = document.getElementById('chart-rdb-filter-wilayah');
        if (filterSelect && (filterSelect.getAttribute('data-active-cat') !== summaryCategory || filterSelect.getAttribute('data-active-so') !== summarySOType)) {
            filterSelect.setAttribute('data-active-cat', summaryCategory);
            filterSelect.setAttribute('data-active-so', summarySOType);
            let optionsHtml = '<option value="all" selected>Semua Wilayah</option>';
            if (summaryCategory === 'pmd') {
                optionsHtml = '<option value="all" selected>Semua Dept</option><option value="DNO">DNO</option><option value="DSO">DSO</option>';
            } else if (summaryCategory === 'it_coorporate') {
                optionsHtml = '<option value="all" selected>Semua Site</option><option value="50002001384">OUTLET OPTI TBS</option><option value="50002003133">IT CORP ARCADIA LT 4</option>';
            } else if (summaryCategory === 'warehouse_tekno') {
                optionsHtml = '<option value="all" selected>Semua Site Tekno</option>';
                const teknoSites = dbData.sites || {};
                Object.values(teknoSites).forEach(s => {
                    const sc = s.sitecode || '';
                    const nm = (s.name_site || sc).replace('WAREHOUSE TEKNO', 'TEKNO').trim();
                    optionsHtml += `<option value="${sc}">${escapeHtml(nm)}</option>`;
                });
            } else if (summaryCategory === 'warehouse_hub') {
                optionsHtml = '<option value="all" selected>Semua Sub Dept Hub</option><option value="NSO">NSO</option><option value="SSO">SSO</option><option value="EKO">EKO</option><option value="EJO">EJO</option>';
            } else {
                if (summarySOType === 'quarterly') {
                    optionsHtml = '<option value="all" selected>Semua Wilayah</option><option value="WRO">WRO (CSO, NSO, SSO)</option><option value="ERO">ERO (BNO, EJO, MPO, SMO)</option>';
                } else {
                    optionsHtml = '<option value="all" selected>Semua Wilayah</option><option value="WRO">WRO (CSO, NSO, SSO)</option><option value="CRO">CRO (CJDO, EKO, WJO, WKO)</option><option value="ERO">ERO (BNO, EJO, MPO, SMO)</option>';
                }
            }
            filterSelect.innerHTML = optionsHtml;
            resultDbChartWilayahFilter = 'all';
        }

        const subData = dbData.sub_depts || {};
        let items = [];

        if (summaryCategory === 'pmd') {
            items = [
                { code: 'DNO', name: 'DNO', dept: 'PMD', color: '#8b5cf6', data: subData.dno || dbData.dno || {} },
                { code: 'DSO', name: 'DSO', dept: 'PMD', color: '#a855f7', data: subData.dso || dbData.dso || {} }
            ];
            if (resultDbChartWilayahFilter !== 'all') {
                items = items.filter(it => it.code === resultDbChartWilayahFilter);
            }
        } else if (summaryCategory === 'it_coorporate') {
            const sites = dbData.sites || {};
            items = [
                { code: '50002001384', name: 'OPTI TBS', dept: 'IT', color: '#059669', data: sites['50002001384'] || {} },
                { code: '50002003133', name: 'IT ARCADIA LT 4', dept: 'IT', color: '#0d9488', data: sites['50002003133'] || {} }
            ];
            if (resultDbChartWilayahFilter !== 'all') {
                items = items.filter(it => it.code === resultDbChartWilayahFilter);
            }
        } else if (summaryCategory === 'warehouse_tekno') {
            const sites = dbData.sites || {};
            items = Object.values(sites).map(s => ({
                code: s.sitecode || s.name_site,
                name: (s.name_site || s.sitecode || '').replace('WAREHOUSE TEKNO', 'TEKNO').trim(),
                dept: 'TEKNO',
                color: '#0891b2',
                data: s
            }));
            if (resultDbChartWilayahFilter !== 'all') {
                items = items.filter(it => it.code === resultDbChartWilayahFilter);
            }
        } else if (summaryCategory === 'warehouse_hub') {
            items = [
                { code: 'NSO', name: 'NSO', dept: 'WRO', color: '#3b82f6', data: subData.nso || {} },
                { code: 'SSO', name: 'SSO', dept: 'WRO', color: '#3b82f6', data: subData.sso || {} },
                { code: 'EKO', name: 'EKO', dept: 'CRO', color: '#f59e0b', data: subData.eko || {} },
                { code: 'EJO', name: 'EJO', dept: 'ERO', color: '#10b981', data: subData.ejo || {} }
            ];
            if (resultDbChartWilayahFilter !== 'all') {
                items = items.filter(it => it.dept === resultDbChartWilayahFilter || it.code === resultDbChartWilayahFilter);
            }
        } else {
            // Outlet Regional default (11 Wilayah)
            items = [
                { code: 'CSO', name: 'CSO', dept: 'WRO', color: '#3b82f6', data: subData.cso || {} },
                { code: 'NSO', name: 'NSO', dept: 'WRO', color: '#3b82f6', data: subData.nso || {} },
                { code: 'SSO', name: 'SSO', dept: 'WRO', color: '#3b82f6', data: subData.sso || {} },
                { code: 'CJDO', name: 'CJDO', dept: 'CRO', color: '#f59e0b', data: subData.cjdo || {} },
                { code: 'EKO', name: 'EKO', dept: 'CRO', color: '#f59e0b', data: subData.eko || {} },
                { code: 'WJO', name: 'WJO', dept: 'CRO', color: '#f59e0b', data: subData.wjo || {} },
                { code: 'WKO', name: 'WKO', dept: 'CRO', color: '#f59e0b', data: subData.wko || {} },
                { code: 'BNO', name: 'BNO', dept: 'ERO', color: '#10b981', data: subData.bno || {} },
                { code: 'EJO', name: 'EJO', dept: 'ERO', color: '#10b981', data: subData.ejo || {} },
                { code: 'MPO', name: 'MPO', dept: 'ERO', color: '#10b981', data: subData.mpo || {} },
                { code: 'SMO', name: 'SMO', dept: 'ERO', color: '#10b981', data: subData.smo || {} }
            ];
            if (summarySOType === 'quarterly') {
                items = items.filter(it => it.dept !== 'CRO');
            }
            if (resultDbChartWilayahFilter !== 'all') {
                items = items.filter(it => it.dept === resultDbChartWilayahFilter || it.code === resultDbChartWilayahFilter);
            }
        }

        const labels = items.map(it => it.name || it.code);
        const curVals = items.map(it => Number(it.data?.qty || 0));
        const prevVals = items.map(it => Number(it.data?.prev_qty || 0));

        let curPeriodLabel = 'Periode Ini';
        if (filterMonth && monthNames[parseInt(filterMonth, 10)]) {
            curPeriodLabel = `${monthNames[parseInt(filterMonth, 10)]} ${filterYear}`;
        } else if (filterYear) {
            curPeriodLabel = `Tahun ${filterYear}`;
        }

        let prevPeriodLabel = (typeof getDbPrevPeriodLabel === 'function') ? getDbPrevPeriodLabel() : 'Periode Lalu';
        if (!prevPeriodLabel || prevPeriodLabel === 'periode sebelumnya') {
            prevPeriodLabel = 'Periode Lalu';
        }

        if (chartResultDbAnalysis) {
            chartResultDbAnalysis.destroy();
            chartResultDbAnalysis = null;
        }

        // Custom plugin to guarantee paired bars are always strictly side-by-side (adjacent) regardless of category count
        const pairedBarsPlugin = {
            id: 'pairedBarsPlugin',
            afterUpdate(chart) {
                positionPairedBars(chart);
            },
            beforeDatasetsDraw(chart) {
                positionPairedBars(chart);
            }
        };

        function positionPairedBars(chart) {
            const { scales: { x } } = chart;
            if (!x) return;
            const meta0 = chart.getDatasetMeta(0);
            const meta1 = chart.getDatasetMeta(1);
            if (!meta0 || !meta1) return;

            const hide0 = meta0.hidden || false;
            const hide1 = meta1.hidden || false;
            const count = Math.max(meta0.data?.length || 0, meta1.data?.length || 0);
            if (count === 0) return;

            // Responsive bar thickness and gap between the 2 paired bars
            let barW = count <= 2 ? 42 : (count <= 4 ? 30 : (count <= 8 ? 24 : 18));
            let gap = count <= 2 ? 6 : (count <= 4 ? 5 : 4);
            if (window.innerWidth < 640) {
                barW = Math.max(14, Math.round(barW * 0.7));
                gap = Math.max(2, Math.round(gap * 0.7));
            }

            for (let i = 0; i < count; i++) {
                const catX = x.getPixelForTick(i);
                if (catX === undefined || isNaN(catX)) continue;

                const b0 = meta0.data ? meta0.data[i] : null;
                const b1 = meta1.data ? meta1.data[i] : null;

                if (!hide0 && !hide1) {
                    if (b0) {
                        b0.x = catX - (barW / 2 + gap / 2);
                        b0.width = barW;
                    }
                    if (b1) {
                        b1.x = catX + (barW / 2 + gap / 2);
                        b1.width = barW;
                    }
                } else if (!hide0 && hide1) {
                    if (b0) {
                        b0.x = catX;
                        b0.width = barW;
                    }
                } else if (hide0 && !hide1) {
                    if (b1) {
                        b1.x = catX;
                        b1.width = barW;
                    }
                }
            }
        }

        const catCount = labels.length;
        const initialBarW = catCount <= 2 ? 42 : (catCount <= 4 ? 30 : (catCount <= 8 ? 24 : 18));

        const ctx = canvas.getContext('2d');
        chartResultDbAnalysis = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `Periode Lalu (${prevPeriodLabel})`,
                        data: prevVals,
                        backgroundColor: '#93c5fd',
                        hoverBackgroundColor: '#60a5fa',
                        borderColor: 'transparent',
                        borderWidth: 0,
                        barThickness: initialBarW,
                        borderRadius: {
                            topLeft: 6,
                            topRight: 6,
                            bottomLeft: 0,
                            bottomRight: 0
                        },
                        borderSkipped: 'bottom'
                    },
                    {
                        label: `Periode Ini (${curPeriodLabel})`,
                        data: curVals,
                        backgroundColor: '#3b66ff',
                        hoverBackgroundColor: '#2551ec',
                        borderColor: 'transparent',
                        borderWidth: 0,
                        barThickness: initialBarW,
                        borderRadius: {
                            topLeft: 6,
                            topRight: 6,
                            bottomLeft: 0,
                            bottomRight: 0
                        },
                        borderSkipped: 'bottom'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 16,
                        bottom: 6,
                        left: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            callback: val => Number(val).toLocaleString(),
                            color: '#94a3b8',
                            font: { size: 11, family: 'Inter, -apple-system, sans-serif' }
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            font: { size: 11, weight: '500', family: 'Inter, -apple-system, sans-serif' },
                            color: '#475569'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'rectRounded',
                            boxWidth: 9,
                            boxHeight: 9,
                            padding: 16,
                            font: {
                                size: 11.5,
                                weight: '600',
                                family: 'Inter, -apple-system, sans-serif'
                            },
                            color: '#475569'
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleFont: { size: 12, weight: '700', family: 'Inter, -apple-system, sans-serif' },
                        bodyFont: { size: 11.5, weight: '500', family: 'Inter, -apple-system, sans-serif' },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        callbacks: {
                            title: (tooltipItems) => {
                                const idx = tooltipItems[0]?.dataIndex;
                                const it = items[idx];
                                return `${it?.name || it?.code || ''} (${it?.dept || ''})`;
                            },
                            label: (context) => {
                                const val = Number(context.raw || 0);
                                return ` ${context.dataset.label}: ${val.toLocaleString()} QTY`;
                            },
                            afterBody: (tooltipItems) => {
                                if (!tooltipItems || tooltipItems.length === 0) return [];
                                const idx = tooltipItems[0].dataIndex;
                                const it = items[idx];
                                const cur = Number(it?.data?.qty || 0);
                                const prev = Number(it?.data?.prev_qty || 0);
                                const diff = cur - prev;
                                const sign = diff > 0 ? '+' : '';
                                const trendArrow = diff > 0 ? '▲' : (diff < 0 ? '▼' : '—');
                                const lines = [];
                                if (it?.data?.prev_qty !== undefined && it?.data?.prev_qty !== null) {
                                    lines.push(` Selisih: ${trendArrow} ${sign}${diff.toLocaleString()} QTY`);
                                }
                                if (it?.data?.total_sites) {
                                    lines.push(` Sites: ${it?.data?.count || 0}/${it?.data?.total_sites}`);
                                }
                                return lines;
                            }
                        }
                    }
                }
            },
            plugins: [pairedBarsPlugin]
        });
    }

    // ── Database Resolution Breakdown (Semi-Circular Target Arch Gauge) ──
    let chartDbResolutionGauge = null;

    function renderDbResolutionGauge(solvedRate, activeItem = {}) {
        const canvas = document.getElementById('chart-db-resolution-gauge');
        if (!canvas) return;

        const rate = Math.max(0, Math.min(100, Number(solvedRate || 0)));
        const remaining = 100 - rate;

        // Sync period badge
        const periodBadge = document.getElementById('db-gauge-period-badge');
        const filterMonth = document.getElementById('summary-filter-month')?.value;
        const filterYear = document.getElementById('summary-filter-year')?.value || 2026;
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        if (periodBadge) {
            const mText = filterMonth && monthNames[parseInt(filterMonth, 10)] ? monthNames[parseInt(filterMonth, 10)] : (filterMonth ? `Bulan ${filterMonth}` : 'Semua Bulan');
            periodBadge.textContent = `${mText} ${filterYear}`;
        }

        // Center Percentage Text
        const pctEl = document.getElementById('db-gauge-pct');
        if (pctEl) pctEl.textContent = `${rate.toFixed(2)}%`;

        // Trend Pill Badge
        const trendEl = document.getElementById('db-gauge-trend');
        if (trendEl) {
            let diffRate = null;
            const prevTotal = Number(activeItem.prev_total_status ?? (Number(activeItem.prev_solved || 0) + Number(activeItem.prev_unsolved || 0) + Number(activeItem.prev_new_db || 0)));
            if (prevTotal > 0 && activeItem.prev_solved !== undefined && activeItem.prev_solved !== null) {
                const prevRate = (Number(activeItem.prev_solved) / prevTotal) * 100;
                diffRate = rate - prevRate;
            } else if (activeItem.diff_solved !== undefined && activeItem.diff_solved !== null) {
                diffRate = Number(activeItem.diff_solved);
            }

            if (diffRate !== null && !isNaN(diffRate)) {
                const isUp = diffRate > 0;
                const isDown = diffRate < 0;
                const sign = isUp ? '+' : '';
                trendEl.textContent = `${sign}${diffRate.toFixed(1)}%`;
                if (isUp) {
                    trendEl.style.background = '#ecfdf5';
                    trendEl.style.color = '#10b981';
                } else if (isDown) {
                    trendEl.style.background = '#fef2f2';
                    trendEl.style.color = '#dc2626';
                } else {
                    trendEl.style.background = '#f1f5f9';
                    trendEl.style.color = '#64748b';
                }
            } else {
                trendEl.textContent = '+0%';
                trendEl.style.background = '#f1f5f9';
                trendEl.style.color = '#64748b';
            }
        }

        // Narrative Summary Text
        const solvedQty = Number(activeItem.solved || 0);
        const unsolvedQty = Number(activeItem.unsolved || 0);
        const newDbQty = Number(activeItem.new_db || 0);
        const totalQty = solvedQty + unsolvedQty + newDbQty;

        const descEl = document.getElementById('db-gauge-desc');
        if (descEl) {
            if (totalQty > 0) {
                descEl.innerHTML = `Sebanyak <strong style="color: #0f172a;">${solvedQty.toLocaleString('id-ID')}</strong> dari <strong style="color: #0f172a;">${totalQty.toLocaleString('id-ID')}</strong> data DB telah terselesaikan.`;
            } else {
                descEl.textContent = 'Belum ada data resolusi DB pada periode ini.';
            }
        }

        const subtextEl = document.getElementById('db-gauge-subtext');
        if (subtextEl) {
            if (rate >= 80) {
                subtextEl.textContent = 'Excellent progress! Keep up your good work!';
                subtextEl.style.color = '#10b981';
            } else if (rate >= 50) {
                subtextEl.textContent = 'Good momentum, terus tingkatkan penyelesaian!';
                subtextEl.style.color = '#0284c7';
            } else {
                subtextEl.textContent = 'Keep up your good work!';
                subtextEl.style.color = '#94a3b8';
            }
        }

        // Mini Status Tags
        const sTag = document.getElementById('db-gauge-tag-solved');
        if (sTag) sTag.textContent = solvedQty.toLocaleString('id-ID');
        const uTag = document.getElementById('db-gauge-tag-unsolved');
        if (uTag) uTag.textContent = unsolvedQty.toLocaleString('id-ID');
        const nTag = document.getElementById('db-gauge-tag-new');
        if (nTag) nTag.textContent = newDbQty.toLocaleString('id-ID');

        // Draw / Update Semicircle Gauge
        const chartData = rate <= 0 ? [0.001, 99.999] : (rate >= 100 ? [100, 0.001] : [rate, remaining]);

        if (chartDbResolutionGauge) {
            chartDbResolutionGauge.data.datasets[0].data = chartData;
            chartDbResolutionGauge.update();
            return;
        }

        const ctx = canvas.getContext('2d');
        chartDbResolutionGauge = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: chartData,
                    backgroundColor: ['#3b66ff', '#f1f5f9'],
                    borderWidth: 0,
                    borderRadius: [10, 10],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rotation: -90,
                circumference: 180,
                cutout: '80%',
                layout: {
                    padding: { top: 6, bottom: 0, left: 8, right: 8 }
                },
                animation: {
                    animateRotate: true,
                    duration: 800
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }

    // ── Site Movement History & Comparison Logs ──────────────────

    let allMovementsData = [];
    let filteredMovementsData = [];
    let isMovementDetailsVisible = false;

    async function loadSiteMovements(year, month) {
        const badgeTotal = document.getElementById('sm-badge-total');
        const periodSub = document.getElementById('sm-period-subtitle');
        const tbody = document.getElementById('sm-table-body');

        const curYear = year || document.getElementById('summary-filter-year')?.value || 2026;
        const curMonth = (month !== undefined && month !== null) ? month : (document.getElementById('summary-filter-month')?.value || '');

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #94a3b8; padding: 2rem;">
                        Memuat data log pergerakan...
                    </td>
                </tr>
            `;
        }

        try {
            const res = await fetch(`api/site_regional.php?action=site_movements&year=${encodeURIComponent(curYear)}&month=${encodeURIComponent(curMonth)}`);
            const json = await res.json();

            if (!json.success) {
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align: center; color: #ef4444; padding: 1.5rem;">
                                Gagal memuat data log pergerakan: ${escapeHtml(json.message || 'Error')}
                            </td>
                        </tr>
                    `;
                }
                return;
            }

            const summary = json.summary || {};
            const pInfo = json.period || {};
            allMovementsData = json.movements || [];
            filteredMovementsData = [...allMovementsData];

            // 1. Update Header
            if (badgeTotal) {
                const total = summary.total_movements || 0;
                badgeTotal.textContent = `${total} Perubahan`;
                if (total > 0) {
                    badgeTotal.style.background = '#e0f2fe';
                    badgeTotal.style.color = '#0369a1';
                } else {
                    badgeTotal.style.background = '#f1f5f9';
                    badgeTotal.style.color = '#64748b';
                }
            }

            if (periodSub) {
                if (pInfo.month) {
                    periodSub.textContent = `Periode: ${pInfo.month_name} ${pInfo.year}`;
                } else {
                    periodSub.textContent = `Log history Kumulatif Tahun ${pInfo.year}`;
                }
            }

            // 2. Update KPI Stats
            const statMovements = document.getElementById('sm-stat-movements');
            if (statMovements) statMovements.textContent = summary.total_movements || 0;

            const renderDiffBadge = (diff, invertColors = false) => {
                if (diff === null || diff === undefined || diff === 0) {
                    return `<span class="kpi-target-indicator target-neutral"><span>-</span></span>`;
                }
                const isGood = invertColors ? (diff < 0) : (diff > 0);
                const cls = isGood ? 'target-up' : 'target-down';
                const formatted = diff > 0 ? `+${diff}` : `${diff}`;
                const arrowSvg = diff > 0
                    ? `<svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"></polygon></svg>`
                    : `<svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"></polygon></svg>`;
                return `
                    <span class="kpi-target-indicator ${cls}">
                        ${arrowSvg}
                        <span>${formatted}</span>
                    </span>
                `;
            };

            const statActive = document.getElementById('sm-stat-active');
            const statActiveDiff = document.getElementById('sm-stat-active-diff');
            if (statActive) statActive.textContent = summary.current_active || 0;
            if (statActiveDiff) {
                statActiveDiff.innerHTML = renderDiffBadge(summary.active_diff, false);
            }

            const statMonthly = document.getElementById('sm-stat-monthly');
            const statMonthlyDiff = document.getElementById('sm-stat-monthly-diff');
            if (statMonthly) statMonthly.textContent = summary.current_monthly || 0;
            if (statMonthlyDiff) {
                statMonthlyDiff.innerHTML = renderDiffBadge(summary.monthly_diff, false);
            }

            const statQuarterly = document.getElementById('sm-stat-quarterly');
            const statQuarterlyDiff = document.getElementById('sm-stat-quarterly-diff');
            if (statQuarterly) statQuarterly.textContent = summary.current_quarterly || 0;
            if (statQuarterlyDiff) {
                statQuarterlyDiff.innerHTML = renderDiffBadge(summary.quarterly_diff, false);
            }

            const statInactive = document.getElementById('sm-stat-inactive');
            const statInactiveDiff = document.getElementById('sm-stat-inactive-diff');
            if (statInactive) statInactive.textContent = summary.current_inactive || 0;
            if (statInactiveDiff) {
                statInactiveDiff.innerHTML = renderDiffBadge(summary.inactive_diff, true);
            }

            // 3. Render Table (respect active search filter if user already typed a query)
            const searchInput = document.getElementById('sm-search-input');
            if (searchInput && searchInput.value.trim() !== '') {
                filterMovementsTable();
            } else {
                renderMovementsTable();
            }

        } catch (err) {
            console.error('Error loading site movements:', err);
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: #ef4444; padding: 1.5rem;">
                            Kesalahan koneksi saat memuat log pergerakan.
                        </td>
                    </tr>
                `;
            }
        }
    }

    function renderMovementsTable() {
        const tbody = document.getElementById('sm-table-body');
        const infoEl = document.getElementById('sm-table-info');
        if (!tbody) return;

        const curYear = document.getElementById('summary-filter-year')?.value || 2026;
        const monthSelect = document.getElementById('summary-filter-month');
        const monthText = (monthSelect && monthSelect.value) ? monthSelect.options[monthSelect.selectedIndex].text : 'Tahun Ini';
        const hasSearch = Boolean(document.getElementById('sm-search-input')?.value?.trim());

        if (infoEl) {
            infoEl.textContent = hasSearch
                ? `Menampilkan ${filteredMovementsData.length} dari ${allMovementsData.length} perubahan (difilter)`
                : `Menampilkan ${filteredMovementsData.length} dari ${allMovementsData.length} perubahan`;
        }

        if (filteredMovementsData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2.25rem 1rem; color: #64748b;">
                        <div style="font-weight: 700; color: #334155; font-size: 13.5px;">
                            ${hasSearch
                    ? 'Tidak ada data log yang cocok dengan pencarian.'
                    : (allMovementsData.length === 0 ? `No data ${escapeHtml(monthText)} ${curYear}` : 'No data.')}
                        </div>
                        ${!hasSearch && allMovementsData.length === 0 && monthSelect && monthSelect.value ? `
                            <button type="button" class="btn btn-outline-primary btn-sm" onclick="App.viewAllYearMovements()" style="margin-top: 12px; font-size: 12px; padding: 4px 12px;">
                                Lihat Seluruh Log Tahun ${curYear}
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filteredMovementsData.forEach((m, idx) => {
            let prevBadge = '';
            if (m.prev_status === 'quarterly') {
                prevBadge = '<span class="badge-status-quarterly">Quarterly</span>';
            } else if (m.prev_status === 'inactive') {
                prevBadge = '<span class="badge-status-inactive">Inactive</span>';
            } else if (m.prev_status === 'uncounted') {
                prevBadge = '<span class="badge-status-uncounted" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">Uncounted</span>';
            } else {
                prevBadge = '<span class="badge-status-monthly">Monthly</span>';
            }

            let currBadge = '';
            if (m.curr_status === 'quarterly') {
                currBadge = '<span class="badge-status-quarterly">Quarterly</span>';
            } else if (m.curr_status === 'inactive') {
                currBadge = '<span class="badge-status-inactive">Inactive</span>';
            } else if (m.curr_status === 'uncounted') {
                currBadge = '<span class="badge-status-uncounted" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">Uncounted</span>';
            } else {
                currBadge = '<span class="badge-status-monthly">Monthly</span>';
            }

            html += `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #64748b; padding: 8px 10px;">${idx + 1}</td>
                    <td style="text-align: center; white-space: nowrap; padding: 8px 10px; font-weight: 600; color: #1e293b;">
                        ${escapeHtml(m.sitecode)}
                    </td>
                    <td style="font-weight: 600; color: #1e293b; padding: 8px 10px; min-width: 170px;">
                        ${escapeHtml(m.name_site || '-')}
                    </td>
                    <td style="padding: 8px 10px; white-space: nowrap; color: #475569;">
                        <strong>${escapeHtml(m.dept || '-')}</strong>
                        <div style="font-size: 11px; color: #64748b;">${m.sub_dept ? escapeHtml(m.sub_dept) : ''}</div>
                    </td>
                    <td style="text-align: center; padding: 8px 10px; white-space: nowrap;">
                        <div style="display: inline-flex; align-items: center; gap: 6px; justify-content: center;">
                            ${prevBadge}
                            <span style="color: #94a3b8; font-weight: 600; font-size: 12px; margin: 0 4px;">&rarr;</span>
                            ${currBadge}
                        </div>
                    </td>
                    <td style="text-align: center; padding: 8px 10px; font-weight: 700; color: #0f172a; white-space: nowrap;">
                        ${escapeHtml(m.effective_period)}
                    </td>
                    <td style="padding: 8px 10px; color: #64748b; font-size: 11.5px; max-width: 200px;">
                        ${escapeHtml(m.notes || m.description || '-')}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function filterMovementsTable() {
        const query = (document.getElementById('sm-search-input')?.value || '').toLowerCase().trim();
        if (!query) {
            filteredMovementsData = [...allMovementsData];
        } else {
            filteredMovementsData = allMovementsData.filter(m => {
                const sc = String(m.sitecode ?? '').toLowerCase();
                const ns = String(m.name_site ?? '').toLowerCase();
                const reg = String(m.regional ?? '').toLowerCase();
                const dept = String(m.dept ?? '').toLowerCase();
                const subDept = String(m.sub_dept ?? '').toLowerCase();
                const info = String(m.info ?? '').toLowerCase();
                const notes = String(m.notes ?? '').toLowerCase();
                const desc = String(m.description ?? '').toLowerCase();
                const period = String(m.effective_period ?? '').toLowerCase();
                const prev = String(m.prev_status ?? '').toLowerCase();
                const curr = String(m.curr_status ?? '').toLowerCase();
                const movType = String(m.movement_type ?? '').toLowerCase();

                return sc.includes(query) ||
                    ns.includes(query) ||
                    reg.includes(query) ||
                    dept.includes(query) ||
                    subDept.includes(query) ||
                    info.includes(query) ||
                    notes.includes(query) ||
                    desc.includes(query) ||
                    period.includes(query) ||
                    prev.includes(query) ||
                    curr.includes(query) ||
                    movType.includes(query);
            });
        }
        renderMovementsTable();
    }

    function toggleMovementDetails() {
        const container = document.getElementById('sm-card-body-wrapper') || document.getElementById('sm-table-container');
        const textEl = document.getElementById('sm-toggle-text');
        const arrowEl = document.getElementById('sm-toggle-arrow');
        if (!container) return;

        isMovementDetailsVisible = !isMovementDetailsVisible;
        if (isMovementDetailsVisible) {
            container.style.display = 'block';
            if (textEl) textEl.textContent = 'Hide';
            if (arrowEl) arrowEl.textContent = '▲';
        } else {
            container.style.display = 'none';
            if (textEl) textEl.textContent = 'Show';
            if (arrowEl) arrowEl.textContent = '▼';
        }
    }

    function viewAllYearMovements() {
        const monthSelect = document.getElementById('summary-filter-month');
        if (monthSelect) monthSelect.value = '';
        const yearSelect = document.getElementById('summary-filter-year');
        const curYear = yearSelect ? yearSelect.value : 2026;
        loadSiteMovements(curYear, '');
    }

    function openMovementsFromSR() {
        navigateTo('summary');
        const card = document.getElementById('card-site-movements');
        const container = document.getElementById('sm-card-body-wrapper') || document.getElementById('sm-table-container');
        const textEl = document.getElementById('sm-toggle-text');
        const arrowEl = document.getElementById('sm-toggle-arrow');
        if (container && container.style.display === 'none') {
            container.style.display = 'block';
            isMovementDetailsVisible = true;
            if (textEl) textEl.textContent = 'Hide';
            if (arrowEl) arrowEl.textContent = '▲';
        }
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('card-highlight-pulse');
            setTimeout(() => card.classList.remove('card-highlight-pulse'), 2000);
        }
    }

    // ── Rekapitulasi Status Penyelesaian DB (Solved, Unsolved, New DB) ──
    // ── Rekapitulasi Status Penyelesaian DB (Solved, Unsolved, New DB) ──
    let rdbStatusCurrentPage = 1;
    let rdbStatusPageSize = 10;
    let rdbStatusMonth = 2;
    let rdbStatusYear = 2026;
    let rdbStatusDept = 'all';
    let rdbStatusSubDept = 'all';
    let rdbStatusSitecode = 'all';
    let rdbStatusFilterStatusVal = 'all';
    let rdbStatusSearchQuery = '';
    let rdbStatusSortCol = null;
    let rdbStatusSortDir = 'asc';
    let rdbStatusAllSitesList = [];
    let rdbStatusView = 'flat'; // Default: flat table view with pagination
    let rdbStatusExpandedSites = new Set();
    let rdbStatusDebounceTimer = null;
    let rdbStatusTotalSites = 0;
    let rdbStatusTotalPages = 1;
    let rdbStatusUserInteracted = false;
    let rdbStatusDeptSubDeptMap = {};
    let rdbStatusFiltersPopulated = false;

    async function loadRekapDbStatusData(forcedYear = null, forcedMonth = null) {
        const masterMonthEl = document.getElementById('summary-filter-month');
        const masterYearEl = document.getElementById('summary-filter-year');
        const deptSelect = document.getElementById('rdb-status-filter-dept');
        const subDeptSelect = document.getElementById('rdb-status-filter-subdept');
        const statusSelect = document.getElementById('rdb-status-filter-status');
        const searchInput = document.getElementById('rdb-status-search-input');
        const pageSizeSelect = document.getElementById('rdb-status-page-size');

        // Master period synchronization from top of page
        if (forcedYear) {
            rdbStatusYear = parseInt(forcedYear, 10);
        } else if (masterYearEl && masterYearEl.value) {
            rdbStatusYear = parseInt(masterYearEl.value, 10);
        }

        if (forcedMonth && forcedMonth !== '') {
            rdbStatusMonth = parseInt(forcedMonth, 10);
        } else if (masterMonthEl && masterMonthEl.value && masterMonthEl.value !== '') {
            rdbStatusMonth = parseInt(masterMonthEl.value, 10);
        } else {
            // Default to empty string so API uses dynamic latest month from database
            rdbStatusMonth = '';
        }

        if (deptSelect) rdbStatusDept = deptSelect.value;
        if (subDeptSelect) rdbStatusSubDept = subDeptSelect.value;
        const siteSelect = document.getElementById('rdb-status-filter-sitecode');
        if (siteSelect) rdbStatusSitecode = siteSelect.value;
        if (statusSelect) rdbStatusFilterStatusVal = statusSelect.value;
        if (searchInput) rdbStatusSearchQuery = searchInput.value.trim();
        if (pageSizeSelect) rdbStatusPageSize = pageSizeSelect.value;

        const flatTbody = document.getElementById('rdb-status-flat-tbody');
        const paginationInfo = document.getElementById('rdb-status-pagination-info');
        const paginationControls = document.getElementById('rdb-status-pagination-controls');

        const thDept = document.getElementById('rdb-th-dept');
        const thSubDept = document.getElementById('rdb-th-subdept');
        const thDeptCol = document.getElementById('rdb-th-dept-col');
        const thSubDeptCol = document.getElementById('rdb-th-subdept-col');
        const isPmd = (summaryCategory === 'pmd');
        const noDept = (summaryCategory === 'it_coorporate' || summaryCategory === 'warehouse_tekno');

        if (thDeptCol) thDeptCol.style.display = noDept ? 'none' : '';
        if (thSubDeptCol) thSubDeptCol.style.display = noDept ? 'none' : '';
        if (deptSelect) deptSelect.style.display = noDept ? 'none' : '';
        if (subDeptSelect) subDeptSelect.style.display = noDept ? 'none' : '';

        if (thDept) thDept.textContent = isPmd ? 'DIVISI' : 'DEPT';
        if (thSubDept) thSubDept.textContent = isPmd ? 'DEPT' : 'SUB DEPT';

        if (flatTbody) {
            flatTbody.innerHTML = `
                <tr>
                    <td colspan="${noDept ? 9 : 11}" class="text-center" style="padding: 2.5rem; color: #64748b;">
                        <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
                            <span class="spinner" style="width: 16px; height: 16px;"></span>
                            <span>Memuat data status penyelesaian DB...</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        try {
            const currentCat = summaryCategory || 'pmd';
            const currentSoType = summarySOType || 'monthly';

            const params = new URLSearchParams({
                month: rdbStatusMonth,
                year: rdbStatusYear,
                category: currentCat,
                so_type: currentSoType,
                dept: rdbStatusDept,
                sub_dept: rdbStatusSubDept,
                sitecode: rdbStatusSitecode,
                status: rdbStatusFilterStatusVal,
                search: rdbStatusSearchQuery,
                sort_col: rdbStatusSortCol || '',
                sort_dir: rdbStatusSortDir,
                view: rdbStatusView,
                page: rdbStatusCurrentPage,
                limit: rdbStatusPageSize
            });

            const res = await fetch(`api/rekap_db_status.php?${params.toString()}`);
            const json = await res.json();

            if (!json.success) {
                const errMsg = escapeHtml(json.message || 'Gagal memuat data');
                if (rdbStatusView === 'grouped' && groupedContainer) {
                    groupedContainer.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 2rem;">${errMsg}</div>`;
                } else if (flatTbody) {
                    flatTbody.innerHTML = `<tr><td colspan="${noDept ? 9 : 11}" class="text-center" style="padding: 2rem; color: #ef4444;">${errMsg}</td></tr>`;
                }
                return;
            }

            // Populate DEPT and SUB DEPT filters for the current category
            if (json.filter_options && !rdbStatusFiltersPopulated) {
                populateRekapDbStatusFilters(json.filter_options);
                rdbStatusFiltersPopulated = true;
            }

            // Update Period Badge
            const pBadge = document.getElementById('rdb-status-period-badge');
            if (pBadge && json.period) {
                pBadge.textContent = json.period.current_label || '';
            }

            // Update KPI Strip - Follows filtered Site Master Data
            const stats = json.stats || {};
            const totalItems = parseInt(stats.total_items || 0, 10);
            const totalSites = parseInt(stats.total_sites || 0, 10);
            const solvedCount = parseInt(stats.solved_count || 0, 10);
            const unsolvedCount = parseInt(stats.unsolved_count || 0, 10);
            const newDbCount = parseInt(stats.new_db_count || 0, 10);

            const solvedPct = totalItems > 0 ? ((solvedCount / totalItems) * 100).toFixed(2) : '0.00';
            const unsolvedPct = totalItems > 0 ? ((unsolvedCount / totalItems) * 100).toFixed(2) : '0.00';
            const newDbPct = totalItems > 0 ? ((newDbCount / totalItems) * 100).toFixed(2) : '0.00';

            const formatRp = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const elTotalItems = document.getElementById('rdb-metric-total-items');
            if (elTotalItems) elTotalItems.textContent = totalItems.toLocaleString('id-ID');

            const elTotalNbv = document.getElementById('rdb-metric-total-nbv');
            if (elTotalNbv) elTotalNbv.textContent = `Total NBV : ${formatRp(stats.total_nbv)}`;

            const elTotalSites = document.getElementById('rdb-metric-total-sites');
            if (elTotalSites) {
                if (stats.sites_display) {
                    elTotalSites.textContent = `(${stats.sites_display})`;
                } else {
                    const totalMasterSites = stats.total_master_sites != null ? stats.total_master_sites : totalSites;
                    elTotalSites.textContent = `(${totalSites}/${totalMasterSites} Sites)`;
                }
            }

            const elSolved = document.getElementById('rdb-metric-solved');
            if (elSolved) elSolved.textContent = solvedCount.toLocaleString('id-ID');
            const elSolvedPct = document.getElementById('rdb-metric-solved-pct');
            if (elSolvedPct) elSolvedPct.textContent = `(${solvedPct}%)`;
            const elSolvedNbv = document.getElementById('rdb-metric-solved-nbv');
            if (elSolvedNbv) elSolvedNbv.textContent = `Total NBV : ${formatRp(stats.solved_nbv)}`;

            const elUnsolved = document.getElementById('rdb-metric-unsolved');
            if (elUnsolved) elUnsolved.textContent = unsolvedCount.toLocaleString('id-ID');
            const elUnsolvedPct = document.getElementById('rdb-metric-unsolved-pct');
            if (elUnsolvedPct) elUnsolvedPct.textContent = `(${unsolvedPct}%)`;

            const elUnsolvedNbv = document.getElementById('rdb-metric-unsolved-nbv');
            if (elUnsolvedNbv) elUnsolvedNbv.textContent = `Total NBV : ${formatRp(stats.unsolved_nbv)}`;

            const elNewDb = document.getElementById('rdb-metric-new-db');
            if (elNewDb) elNewDb.textContent = newDbCount.toLocaleString('id-ID');
            const elNewDbPct = document.getElementById('rdb-metric-new-db-pct');
            if (elNewDbPct) elNewDbPct.textContent = `(${newDbPct}%)`;
            const elNewDbNbv = document.getElementById('rdb-metric-new-db-nbv');
            if (elNewDbNbv) elNewDbNbv.textContent = `Total NBV : ${formatRp(stats.new_db_nbv)}`;

            // Sync Metric 2 (Progress Bar & Rate)
            const elSummaryRateText = document.getElementById('db-summary-rate-text');
            if (elSummaryRateText) elSummaryRateText.textContent = `${solvedPct}%`;
            const elSummaryRateBadge = document.getElementById('db-summary-rate-badge');
            if (elSummaryRateBadge) elSummaryRateBadge.textContent = `${solvedPct}% Solved`;
            const elBarSolved = document.getElementById('db-summary-bar-solved');
            if (elBarSolved) elBarSolved.style.width = `${Math.min(100, parseFloat(solvedPct))}%`;
            const elBarUnsolved = document.getElementById('db-summary-bar-unsolved');
            if (elBarUnsolved) elBarUnsolved.style.width = `${Math.min(100, parseFloat(unsolvedPct))}%`;
            const elBarNew = document.getElementById('db-summary-bar-new');
            if (elBarNew) elBarNew.style.width = `${Math.min(100, parseFloat(newDbPct))}%`;
            const elSummaryStatTotal = document.getElementById('db-summary-stat-status-total');
            if (elSummaryStatTotal) elSummaryStatTotal.textContent = totalItems.toLocaleString('id-ID');

            renderDbResolutionGauge(Number(solvedPct), {
                solved: solvedCount,
                unsolved: unsolvedCount,
                new_db: newDbCount,
                prev_solved: stats.prev_solved,
                prev_total_status: stats.prev_total_status,
                diff_solved: stats.diff_solved
            });

            // Render Flat View Table
            renderRekapDbStatusFlat(json.data || [], json.period);
            const totalFlat = json.total || 0;
            rdbStatusTotalPages = json.total_pages || 1;
            if (paginationInfo) {
                const startIdx = rdbStatusPageSize === 'all' ? 0 : (json.page - 1) * parseInt(json.limit, 10);
                const endIdx = rdbStatusPageSize === 'all' ? totalFlat : Math.min(startIdx + (json.data || []).length, totalFlat);
                paginationInfo.textContent = `Menampilkan ${totalFlat > 0 ? startIdx + 1 : 0} sampai ${endIdx} dari ${totalFlat.toLocaleString('id-ID')} data`;
            }

            // Pagination Controls
            renderRekapDbStatusPagination(paginationControls);
            updateRekapDbStatusSortIndicators();

        } catch (err) {
            console.error('Error loading rekap db status:', err);
            const errStr = escapeHtml(err.message || 'Kesalahan jaringan');
            if (flatTbody) {
                flatTbody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 2rem; color: #ef4444;">Gagal memuat: ${errStr}</td></tr>`;
            }
        }
    }

    function populateRekapDbStatusFilters(filterOpts) {
        rdbStatusDeptSubDeptMap = filterOpts.dept_subdept_map || {};
        rdbStatusAllSitesList = filterOpts.sites || [];
        const deptSelect = document.getElementById('rdb-status-filter-dept');
        const isPmd = (summaryCategory === 'pmd');
        const thDept = document.getElementById('rdb-th-dept');
        const thSubDept = document.getElementById('rdb-th-subdept');
        if (thDept) thDept.textContent = isPmd ? 'DIVISI' : 'DEPT';
        if (thSubDept) thSubDept.textContent = isPmd ? 'DEPT' : 'SUB DEPT';

        if (deptSelect && filterOpts.depts) {
            const curVal = rdbStatusDept || deptSelect.value || 'all';
            const defaultAllDept = isPmd ? 'Semua Divisi' : 'Semua Dept';
            let html = `<option value="all">${defaultAllDept}</option>`;
            filterOpts.depts.forEach(d => {
                html += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
            });
            deptSelect.innerHTML = html;
            if (filterOpts.depts.includes(curVal)) {
                deptSelect.value = curVal;
                rdbStatusDept = curVal;
            } else {
                deptSelect.value = 'all';
                rdbStatusDept = 'all';
            }
        }
        updateRekapDbSubDeptDropdown();
        updateRekapDbSitecodeDropdown();
    }

    function updateRekapDbSubDeptDropdown() {
        const deptSelect = document.getElementById('rdb-status-filter-dept');
        const subDeptSelect = document.getElementById('rdb-status-filter-subdept');
        if (!subDeptSelect) return;

        const isPmd = (summaryCategory === 'pmd');
        const selectedDept = deptSelect ? deptSelect.value : 'all';
        let availableSubs = [];

        if (selectedDept === 'all') {
            const allSet = new Set();
            Object.values(rdbStatusDeptSubDeptMap).forEach(arr => {
                arr.forEach(s => allSet.add(s));
            });
            availableSubs = Array.from(allSet).sort();
        } else {
            availableSubs = rdbStatusDeptSubDeptMap[selectedDept] || [];
        }

        const curSub = rdbStatusSubDept || subDeptSelect.value || 'all';
        const defaultAllSub = isPmd ? 'Semua Dept' : 'Semua Sub Dept';
        let html = `<option value="all">${defaultAllSub}</option>`;
        availableSubs.forEach(sd => {
            html += `<option value="${escapeHtml(sd)}">${escapeHtml(sd)}</option>`;
        });
        subDeptSelect.innerHTML = html;
        if (availableSubs.includes(curSub)) {
            subDeptSelect.value = curSub;
            rdbStatusSubDept = curSub;
        } else {
            subDeptSelect.value = 'all';
            rdbStatusSubDept = 'all';
        }
    }

    function updateRekapDbSitecodeDropdown() {
        const deptSelect = document.getElementById('rdb-status-filter-dept');
        const subDeptSelect = document.getElementById('rdb-status-filter-subdept');
        const siteSelect = document.getElementById('rdb-status-filter-sitecode');
        if (!siteSelect) return;

        const selectedDept = deptSelect ? deptSelect.value : 'all';
        const selectedSub = subDeptSelect ? subDeptSelect.value : 'all';

        let matchingSites = rdbStatusAllSitesList.filter(s => {
            if (selectedDept !== 'all' && selectedDept !== '' && s.dept !== selectedDept) return false;
            if (selectedSub !== 'all' && selectedSub !== '' && s.sub_dept !== selectedSub) return false;
            return true;
        });

        const curSite = rdbStatusSitecode || siteSelect.value || 'all';
        let html = '<option value="all">Semua Site</option>';
        matchingSites.forEach(s => {
            const sc = escapeHtml(s.sitecode);
            const ns = escapeHtml(s.name_site ? `${s.sitecode} - ${s.name_site}` : s.sitecode);
            html += `<option value="${sc}">${ns}</option>`;
        });
        siteSelect.innerHTML = html;

        const hasCur = matchingSites.some(s => s.sitecode === curSite);
        if (hasCur) {
            siteSelect.value = curSite;
            rdbStatusSitecode = curSite;
        } else {
            siteSelect.value = 'all';
            rdbStatusSitecode = 'all';
        }
    }

    function onRekapDbStatusDeptChange() {
        const deptSelect = document.getElementById('rdb-status-filter-dept');
        if (deptSelect) rdbStatusDept = deptSelect.value;
        updateRekapDbSubDeptDropdown();
        updateRekapDbSitecodeDropdown();
        rdbStatusCurrentPage = 1;
        loadRekapDbStatusData();
    }

    function onRekapDbStatusSubDeptChange() {
        const subDeptSelect = document.getElementById('rdb-status-filter-subdept');
        if (subDeptSelect) rdbStatusSubDept = subDeptSelect.value;
        updateRekapDbSitecodeDropdown();
        rdbStatusCurrentPage = 1;
        loadRekapDbStatusData();
    }

    function onRekapDbStatusSitecodeChange() {
        const siteSelect = document.getElementById('rdb-status-filter-sitecode');
        if (siteSelect) rdbStatusSitecode = siteSelect.value;
        rdbStatusCurrentPage = 1;
        loadRekapDbStatusData();
    }

    function toggleRekapDbStatusSort(col) {
        if (rdbStatusSortCol === col) {
            rdbStatusSortDir = rdbStatusSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            rdbStatusSortCol = col;
            rdbStatusSortDir = 'asc';
        }
        rdbStatusCurrentPage = 1;
        loadRekapDbStatusData();
    }

    function updateRekapDbStatusSortIndicators() {
        document.querySelectorAll('#rdb-status-flat-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#rdb-status-flat-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (rdbStatusSortCol) {
            const activeTh = document.querySelector(`#rdb-status-flat-table th.sortable[onclick*="'${rdbStatusSortCol}'"]`);
            if (activeTh) {
                activeTh.classList.add(rdbStatusSortDir);
            }
            const activeInd = document.querySelector(`#rdb-status-flat-table .sort-indicator[data-rdb-status-col="${rdbStatusSortCol}"]`);
            if (activeInd) {
                activeInd.textContent = rdbStatusSortDir === 'asc' ? '▲' : '▼';
            }
        }
    }

    function renderRekapDbStatusGrouped(sites, period) {
        const container = document.getElementById('rdb-status-grouped-container');
        if (!container) return;

        if (sites.length === 0) {
            const noDataMsg = (period && period.is_uploaded === false)
                ? `Data DB periode ${escapeHtml(period.current_label || '')} no data.`
                : 'Tidak ada data Site yang sesuai dengan filter atau pencarian.';
            container.innerHTML = `
                <div style="text-align: center; color: #94a3b8; padding: 2.5rem;">
                    ${noDataMsg}
                </div>
            `;
            return;
        }

        const formatRp = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const prevLabel = period?.previous_label || 'Bulan Sebelumnya';
        const currLabel = period?.current_label || 'Bulan Berjalan';

        let html = '';
        sites.forEach(site => {
            const sc = escapeHtml(site.sitecode || '-');
            const nameSite = escapeHtml(site.name_site || '-');
            const regional = escapeHtml(site.regional || '-');
            const dept = escapeHtml(site.dept || '-');
            const subDept = escapeHtml(site.sub_dept || '-');
            const isExpanded = rdbStatusExpandedSites.has(site.sitecode);

            const totalItems = parseInt(site.total_items || 0, 10);
            const solvedCount = parseInt(site.solved_count || 0, 10);
            const unsolvedCount = parseInt(site.unsolved_count || 0, 10);
            const newDbCount = parseInt(site.new_db_count || 0, 10);
            const totalNbv = formatRp(site.total_nbv);

            const items = site.items || [];

            html += `
                <div class="rdb-site-card" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 0.85rem; overflow: hidden; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <!-- Site Header Accordion Toggle -->
                    <div class="rdb-site-header" onclick="App.toggleRekapDbSiteAccordion('${escapeHtml(site.sitecode)}')"
                        style="padding: 0.75rem 1rem; background: #f8fafc; cursor: pointer; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem; user-select: none; border-bottom: ${isExpanded ? '1px solid #e2e8f0' : 'none'};">
                        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                            <span class="rdb-chevron" style="display: inline-block; transition: transform 0.2s ease; font-size: 11px; color: #64748b; transform: ${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'};">
                                &#9654;
                            </span>
                            <span class="badge" style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 12px; padding: 3px 8px; border-radius: 4px; font-family: monospace;">
                                ${sc}
                            </span>
                            <strong style="font-size: 13px; color: #0f172a;">${nameSite}</strong>
                            <span style="font-size: 11.5px; color: #64748b;">
                                (${regional} &bull; ${dept}${subDept !== '-' ? ' - ' + subDept : ''})
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                            <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 11px; padding: 2.5px 7px; border-radius: 4px;">
                                ${totalItems.toLocaleString('id-ID')} Aset
                            </span>
                            ${solvedCount > 0 ? `
                                <span class="badge" style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 600; padding: 2.5px 7px; border-radius: 4px;">
                                    ${solvedCount.toLocaleString('id-ID')} Solved
                                </span>
                            ` : ''}
                            ${unsolvedCount > 0 ? `
                                <span class="badge" style="background: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 600; padding: 2.5px 7px; border-radius: 4px;">
                                    ${unsolvedCount.toLocaleString('id-ID')} Unsolved
                                </span>
                            ` : ''}
                            ${newDbCount > 0 ? `
                                <span class="badge" style="background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 600; padding: 2.5px 7px; border-radius: 4px;">
                                    ${newDbCount.toLocaleString('id-ID')} New DB
                                </span>
                            ` : ''}
                            <span class="badge" style="background: #ffffff; color: #0f172a; font-weight: 700; border: 1px solid #cbd5e1; font-size: 11px; padding: 2.5px 8px; border-radius: 4px;">
                                ${totalNbv}
                            </span>
                        </div>
                    </div>

                    <!-- Items Collapsible Body -->
                    <div class="rdb-site-body" style="display: ${isExpanded ? 'block' : 'none'}; padding: 0.5rem 0.75rem 0.75rem 0.75rem; background: #ffffff;">
                        ${items.length === 0 ? `
                            <div style="text-align: center; color: #94a3b8; padding: 1.25rem; font-size: 12px;">
                                Tidak ada aset yang cocok dengan filter pada site ini.
                            </div>
                        ` : `
                            <div class="table-responsive" style="border: 1px solid #e2e8f0; border-radius: 6px;">
                                <table class="reconciliation-table" style="font-size: 11.5px; width: 100%;">
                                    <thead>
                                        <tr style="background: #f8fafc;">
                                            <th class="text-center" style="width: 170px; padding: 5px 8px;">REG NO</th>
                                            <th class="text-left rdb-col-name" style="padding: 5px 8px;">NAME</th>
                                            <th class="text-center" style="width: 160px; padding: 5px 8px;">SN</th>
                                            <th class="text-right" style="width: 125px; padding: 5px 8px;">NBV</th>
                                            <th class="text-center" style="width: 105px; padding: 5px 8px;">STATUS</th>
                                            <th class="text-left" style="min-width: 180px; padding: 5px 8px;">KETERANGAN</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${items.map((it, idx) => {
                const regNo = escapeHtml(it.reg_no || '-');
                const name = escapeHtml(it.name || '-');
                const sn = escapeHtml(it.sn || '-');
                const nbvVal = formatRp(it.nbv);

                let statusBadge = '';
                let note = '';
                if (it.status === 'solved') {
                    statusBadge = `<span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; font-size: 10.5px; padding: 2px 7px; border-radius: 4px; border: 1px solid #bbf7d0;">SOLVED</span>`;
                    note = `<span style="color: #15803d;">Ada di ${prevLabel}, <strong>DB solved</strong> di ${currLabel}</span>`;
                } else if (it.status === 'unsolved') {
                    statusBadge = `<span class="badge" style="background: #fee2e2; color: #b91c1c; font-weight: 700; font-size: 10.5px; padding: 2px 7px; border-radius: 4px; border: 1px solid #fecaca;">UNSOLVED</span>`;
                    note = `<span style="color: #b91c1c;">Belum solved (masih tercatat di ${currLabel})</span>`;
                } else {
                    statusBadge = `<span class="badge" style="background: #dbeafe; color: #1d4ed8; font-weight: 700; font-size: 10.5px; padding: 2px 7px; border-radius: 4px; border: 1px solid #bfdbfe;">NEW DB</span>`;
                    note = `<span style="color: #1d4ed8;">Temuan DB baru di ${currLabel}</span>`;
                }

                return `
                                                <tr>
                                                    <td class="text-center" style="font-weight: 600; color: #1e293b;">${regNo}</td>
                                                    <td class="text-left rdb-col-name" style="color: #334155; font-weight: 500;">${name}</td>
                                                    <td class="text-center" style="color: #475569; font-weight: 500;">${sn}</td>
                                                    <td class="text-right" style="font-weight: 700; color: #0f172a; white-space: nowrap;">${nbvVal}</td>
                                                    <td class="text-center" style="white-space: nowrap;">${statusBadge}</td>
                                                    <td class="text-left" style="font-size: 11px;">${note}</td>
                                                </tr>
                                            `;
            }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function renderRekapDbStatusFlat(items, period) {
        const tbody = document.getElementById('rdb-status-flat-tbody');
        if (!tbody) return;

        const noDept = (summaryCategory === 'it_coorporate' || summaryCategory === 'warehouse_tekno');
        const thDeptCol = document.getElementById('rdb-th-dept-col');
        const thSubDeptCol = document.getElementById('rdb-th-subdept-col');
        if (thDeptCol) thDeptCol.style.display = noDept ? 'none' : '';
        if (thSubDeptCol) thSubDeptCol.style.display = noDept ? 'none' : '';

        const filterDept = document.getElementById('rdb-status-filter-dept');
        const filterSubDept = document.getElementById('rdb-status-filter-subdept');
        if (filterDept) filterDept.style.display = noDept ? 'none' : '';
        if (filterSubDept) filterSubDept.style.display = noDept ? 'none' : '';

        if (items.length === 0) {
            const noDataMsg = (period && period.is_uploaded === false)
                ? `Data DB periode ${escapeHtml(period.current_label || '')} no data.`
                : 'No data.';
            tbody.innerHTML = `
                <tr>
                    <td colspan="${noDept ? 8 : 10}" class="text-center" style="padding: 2.5rem; color: #94a3b8;">
                        ${noDataMsg}
                    </td>
                </tr>
            `;
            return;
        }

        const formatRp = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const startIdx = rdbStatusPageSize === 'all' ? 0 : (rdbStatusCurrentPage - 1) * parseInt(rdbStatusPageSize, 10);
        const prevLabel = period?.previous_label || 'Bulan Sebelumnya';
        const currLabel = period?.current_label || 'Bulan Berjalan';

        let html = '';
        items.forEach((it, idx) => {
            const no = startIdx + idx + 1;
            const sc = escapeHtml(it.sitecode || '-');
            const nameSite = escapeHtml(it.name_site || '-');
            const dept = escapeHtml(it.dept || '-');
            const subDept = escapeHtml(it.sub_dept || '-');
            const regNo = escapeHtml(it.reg_no || '-');
            const name = escapeHtml(it.name || '-');
            const sn = escapeHtml(it.sn || '-');
            const nbvVal = formatRp(it.nbv);

            let statusBadge = '';
            let note = '';
            if (it.status === 'solved') {
                statusBadge = `<span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 4px; border: 1px solid #bbf7d0;">SOLVED</span>`;
                note = `<span style="color: #15803d; font-size: 11px;">Ada di ${prevLabel}, <strong>DB solved</strong> di ${currLabel}</span>`;
            } else if (it.status === 'unsolved') {
                statusBadge = `<span class="badge" style="background: #fee2e2; color: #b91c1c; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 4px; border: 1px solid #fecaca;">UNSOLVED</span>`;
                note = `<span style="color: #b91c1c; font-size: 11px;">Belum solved (masih tercatat di ${currLabel})</span>`;
            } else {
                statusBadge = `<span class="badge" style="background: #dbeafe; color: #1d4ed8; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 4px; border: 1px solid #bfdbfe;">NEW DB</span>`;
                note = `<span style="color: #1d4ed8; font-size: 11px;">Temuan DB baru di ${currLabel}</span>`;
            }

            const deptColsHtml = noDept ? '' : `
                <td class="text-center" style="font-weight: 600; color: #475569;"><span class="badge" style="background: #f1f5f9; color: #334155; font-size: 11px;">${dept}</span></td>
                <td class="text-center" style="font-weight: 500; color: #64748b; font-size: 11px;">${subDept}</td>
            `;

            html += `
                <tr>
                    ${deptColsHtml}
                    <td class="text-center" style="font-weight: 600; color: #1e293b;">${sc}</td>
                    <td class="text-left" style="font-weight: 500; color: #1e293b;">${nameSite}</td>
                    <td class="text-center" style="font-weight: 600; color: #1e293b;">${regNo}</td>
                    <td class="text-left rdb-col-name" style="color: #334155; font-weight: 500;">${name}</td>
                    <td class="text-center" style="color: #475569; font-weight: 500;">${sn}</td>
                    <td class="text-right" style="font-weight: 700; color: #0f172a; white-space: nowrap;">${nbvVal}</td>
                    <td class="text-center" style="white-space: nowrap;">${statusBadge}</td>
                    <td class="text-left" style="font-size: 11px;">${note}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function switchRekapDbStatusView(mode) {
        rdbStatusView = mode;
        const btnGrouped = document.getElementById('rdb-btn-view-grouped');
        const btnFlat = document.getElementById('rdb-btn-view-flat');
        const groupedContainer = document.getElementById('rdb-status-grouped-container');
        const flatContainer = document.getElementById('rdb-status-flat-container');

        if (mode === 'grouped') {
            if (btnGrouped) {
                btnGrouped.style.background = '#1e3a8a';
                btnGrouped.style.color = '#ffffff';
            }
            if (btnFlat) {
                btnFlat.style.background = '#ffffff';
                btnFlat.style.color = '#475569';
            }
            if (groupedContainer) groupedContainer.style.display = 'block';
            if (flatContainer) flatContainer.style.display = 'none';
        } else {
            if (btnGrouped) {
                btnGrouped.style.background = '#ffffff';
                btnGrouped.style.color = '#475569';
            }
            if (btnFlat) {
                btnFlat.style.background = '#1e3a8a';
                btnFlat.style.color = '#ffffff';
            }
            if (groupedContainer) groupedContainer.style.display = 'none';
            if (flatContainer) flatContainer.style.display = 'block';
        }

        rdbStatusCurrentPage = 1;
        loadRekapDbStatusData();
    }

    function toggleRekapDbSiteAccordion(sitecode) {
        if (rdbStatusExpandedSites.has(sitecode)) {
            rdbStatusExpandedSites.delete(sitecode);
        } else {
            rdbStatusExpandedSites.add(sitecode);
        }
        loadRekapDbStatusData();
    }

    function toggleAllRekapDbStatusSites() {
        const btn = document.getElementById('rdb-btn-toggle-all');
        const allSitecodes = [];
        document.querySelectorAll('.rdb-site-header').forEach(h => {
            const onclickStr = h.getAttribute('onclick') || '';
            const match = onclickStr.match(/'([^']+)'/);
            if (match && match[1]) allSitecodes.push(match[1]);
        });

        if (rdbStatusExpandedSites.size >= allSitecodes.length && allSitecodes.length > 0) {
            rdbStatusExpandedSites.clear();
            if (btn) btn.textContent = 'Expand All';
        } else {
            allSitecodes.forEach(sc => rdbStatusExpandedSites.add(sc));
            if (btn) btn.textContent = 'Collapse All';
        }
        loadRekapDbStatusData();
    }

    function filterRekapDbStatus(status) {
        const select = document.getElementById('rdb-status-filter-status');
        if (select) {
            select.value = status;
        }
        rdbStatusFilterStatusVal = status;
        rdbStatusCurrentPage = 1;
        loadRekapDbStatusData();
    }

    function onRekapDbStatusPeriodChange() {
        rdbStatusUserInteracted = true;
        rdbStatusCurrentPage = 1;
        loadRekapDbStatusData();
    }

    function onRekapDbStatusFilterChange() {
        rdbStatusCurrentPage = 1;
        loadRekapDbStatusData();
    }

    function changeRekapDbStatusPageSize(val) {
        rdbStatusPageSize = val;
        rdbStatusCurrentPage = 1;
        loadRekapDbStatusData();
    }

    function goToRekapDbStatusPage(page) {
        if (page < 1) page = 1;
        if (page > rdbStatusTotalPages) page = rdbStatusTotalPages;
        rdbStatusCurrentPage = page;
        loadRekapDbStatusData();
    }

    function handleRekapDbStatusSearch(val) {
        clearTimeout(rdbStatusDebounceTimer);
        rdbStatusDebounceTimer = setTimeout(() => {
            rdbStatusSearchQuery = (val || '').trim();
            rdbStatusCurrentPage = 1;
            loadRekapDbStatusData();
        }, 300);
    }

    function renderRekapDbStatusPagination(container) {
        if (!container) return;
        if (rdbStatusTotalPages <= 1 || rdbStatusPageSize === 'all') {
            container.innerHTML = '';
            return;
        }

        let html = '';
        html += `<button class="pagination-btn" ${rdbStatusCurrentPage === 1 ? 'disabled' : ''} onclick="App.goToRekapDbStatusPage(${rdbStatusCurrentPage - 1})">&laquo; Prev</button>`;

        const maxButtons = 5;
        let startPage = Math.max(1, rdbStatusCurrentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(rdbStatusTotalPages, startPage + maxButtons - 1);
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        if (startPage > 1) {
            html += `<button class="pagination-btn" onclick="App.goToRekapDbStatusPage(1)">1</button>`;
            if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
        }

        for (let p = startPage; p <= endPage; p++) {
            html += `<button class="pagination-btn ${p === rdbStatusCurrentPage ? 'active' : ''}" onclick="App.goToRekapDbStatusPage(${p})">${p}</button>`;
        }

        if (endPage < rdbStatusTotalPages) {
            if (endPage < rdbStatusTotalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
            html += `<button class="pagination-btn" onclick="App.goToRekapDbStatusPage(${rdbStatusTotalPages})">${rdbStatusTotalPages}</button>`;
        }

        html += `<button class="pagination-btn" ${rdbStatusCurrentPage === rdbStatusTotalPages ? 'disabled' : ''} onclick="App.goToRekapDbStatusPage(${rdbStatusCurrentPage + 1})">Next &raquo;</button>`;
        container.innerHTML = html;
    }

    async function exportRekapDbStatusExcel() {
        const btn = document.getElementById('btn-rdb-status-export-excel');
        const origContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 0.8s linear infinite;">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                <span>Mengekspor...</span>
            `;
        }

        try {
            const masterMonthEl = document.getElementById('summary-filter-month');
            const masterYearEl = document.getElementById('summary-filter-year');
            const deptSelect = document.getElementById('rdb-status-filter-dept');
            const subDeptSelect = document.getElementById('rdb-status-filter-subdept');
            const statusSelect = document.getElementById('rdb-status-filter-status');
            const searchInput = document.getElementById('rdb-status-search-input');

            let yr = rdbStatusYear || (masterYearEl && masterYearEl.value ? parseInt(masterYearEl.value, 10) : 2026);
            let mo = rdbStatusMonth || (masterMonthEl && masterMonthEl.value && masterMonthEl.value !== '' ? parseInt(masterMonthEl.value, 10) : 2);
            let cat = summaryCategory || 'pmd';
            let catLabel = 'Outlet Regional';
            if (cat === 'pmd') catLabel = 'PMD';
            else if (cat === 'outlet_subarep') catLabel = 'Outlet Subarep';
            else if (cat === 'warehouse_hub') catLabel = 'Warehouse HUB';
            else if (cat === 'warehouse_tekno') catLabel = 'Warehouse Tekno';
            else if (cat === 'it_coorporate') catLabel = 'IT Corporate';
            let soType = summarySOType || 'monthly';
            let dept = deptSelect ? deptSelect.value : (rdbStatusDept || 'all');
            let subDept = subDeptSelect ? subDeptSelect.value : (rdbStatusSubDept || 'all');
            const siteSelect = document.getElementById('rdb-status-filter-sitecode');
            let sitecode = siteSelect ? siteSelect.value : (rdbStatusSitecode || 'all');
            let status = statusSelect ? statusSelect.value : (rdbStatusFilterStatusVal || 'all');
            let search = searchInput ? searchInput.value.trim() : (rdbStatusSearchQuery || '');

            const params = new URLSearchParams({
                month: mo,
                year: yr,
                category: cat,
                category_label: catLabel,
                so_type: soType,
                dept: dept,
                sub_dept: subDept,
                sitecode: sitecode,
                status: status,
                search: search,
                sort_col: rdbStatusSortCol || '',
                sort_dir: rdbStatusSortDir
            });

            const res = await fetch(`api/export_rekap_db_status.php?${params.toString()}`);

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.message || `Export gagal dengan status HTTP ${res.status}`);
            }

            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;

            let downloadFilename = '';
            const disposition = res.headers.get('content-disposition');
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) {
                    downloadFilename = matches[1].replace(/['"]/g, '').trim();
                }
            }
            if (!downloadFilename) {
                const now = new Date();
                const d = String(now.getDate()).padStart(2, '0');
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const y = String(now.getFullYear());
                const H = String(now.getHours()).padStart(2, '0');
                const i = String(now.getMinutes()).padStart(2, '0');
                let catSlug = (catLabel || cat || 'outletregional').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (catSlug === 'outlet' || catSlug === 'monthlyoutlet') catSlug = 'outletregional';
                downloadFilename = `rekapdb_${catSlug}_${d}${m}${y}${H}${i}.xlsx`;
            }

            a.download = downloadFilename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);

            showToast('success', 'Export Berhasil', 'File Excel Rekapitulasi Status DB berhasil diunduh.');
        } catch (err) {
            console.error('Error exporting Rekap DB Status Excel:', err);
            showToast('error', 'Export Gagal', err.message || 'Terjadi kesalahan saat mengekspor Excel.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origContent;
            }
        }
    }

    // ── Score Card Summary (Rating & SO Execution - Rolling 3 Months) ──

    let scorecardRatingData = [];
    let scorecardExecutionData = [];
    let scorecardPeriod = null;
    let currentRatingFilter = 'very_poor';
    let currentExecutionFilter = 'not_executed';
    let currentNationalRatingFilter = 'very_poor';
    let currentScorecardDeptFilter = 'all';
    let currentScorecardSubDeptFilter = 'all';

    function matchesScorecardFilter(item, deptFilter, subDeptFilter) {
        if (!item) return false;
        const itemDept = (item.dept || '').trim().toUpperCase();
        const itemSub = (item.sub_dept || '').trim().toUpperCase();

        if (deptFilter && deptFilter !== 'all') {
            const d = deptFilter.trim().toUpperCase();
            if (d === 'DNO' || d === 'DSO') {
                if (itemSub !== d && itemDept !== d) return false;
            } else {
                if (itemDept !== d && itemSub !== d) return false;
            }
        }

        if (subDeptFilter && subDeptFilter !== 'all') {
            const s = subDeptFilter.trim().toUpperCase();
            if (itemSub !== s) return false;
        }

        return true;
    }

    function getThreeMonthsBack(year, month) {
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const shortNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        let m = parseInt(month, 10);
        let y = parseInt(year, 10) || 2026;
        if (isNaN(m) || m < 1 || m > 12) {
            m = 9; // Default to September if all months or unset
        }

        if (summarySOType === 'quarterly') {
            let curQ = Math.ceil(m / 3);
            if (curQ < 1) curQ = 1;
            if (curQ > 4) curQ = 4;
            // Stop on Q1-Q3 because 2025 data not uploaded in the database
            curQ = Math.max(3, curQ);

            const quarters = [];
            for (let i = 2; i >= 0; i--) {
                let tq = curQ - i;
                let ty = y;
                while (tq <= 0) {
                    tq += 4;
                    ty -= 1;
                }
                quarters.push({
                    month: tq * 3,
                    year: ty,
                    label: `Q${tq}`,
                    fullName: `Q${tq} ${ty}`
                });
            }
            return quarters;
        }

        const months = [];
        // Stop rolling back at January - March because 2025 data is not uploaded in the database
        const effM = Math.max(3, m);
        for (let i = 2; i >= 0; i--) {
            let targetM = effM - i;
            let targetY = y;
            while (targetM <= 0) {
                targetM += 12;
                targetY -= 1;
            }
            months.push({
                month: targetM,
                year: targetY,
                fullName: `${monthNames[targetM]} ${targetY}`,
                shortName: `${shortNames[targetM]} ${targetY}`,
                label: shortNames[targetM].toUpperCase(),
                monthName: monthNames[targetM]
            });
        }
        return months;
    }

    async function loadScoreCardSummary(year, month) {
        const y = year || document.getElementById('summary-filter-year')?.value || 2026;
        const m = month || document.getElementById('summary-filter-month')?.value || 9;
        const category = summaryCategory || 'pmd';
        const soType = summarySOType || 'monthly';
        const isPmd = (category === 'pmd');

        document.querySelectorAll('th.scorecard-col-subdept').forEach(th => {
            th.textContent = isPmd ? 'DEPT' : 'SUB DEPT';
        });

        const threeMonths = getThreeMonthsBack(y, m);

        // 1. National Stock Opname Rating 3-Month Period Badge
        const natBadgeEl = document.getElementById('scorecard-national-period-badge') || document.getElementById('scorecard-period-badge');
        if (natBadgeEl && threeMonths.length === 3) {
            const first = threeMonths[0];
            const last = threeMonths[2];
            const fName = first.monthName || first.label;
            const lName = last.monthName || last.label;
            if (first.year === last.year) {
                natBadgeEl.textContent = `${fName} - ${lName} ${last.year}`;
            } else {
                natBadgeEl.textContent = `${fName} ${first.year} - ${lName} ${last.year}`;
            }
        }

        const natSubtitle = document.getElementById('national-rating-subtitle');
        if (natSubtitle && threeMonths.length === 3) {
            natSubtitle.textContent = `Performa rating 3 periode berturut-turut (${threeMonths[0].label} - ${threeMonths[2].label})`;
        }

        // Sync National Rating filter from dropdown (defaults to 'very_poor' on initial load)
        const natFilterEl = document.getElementById('national-rating-filter');
        if (natFilterEl && natFilterEl.value) {
            currentNationalRatingFilter = natFilterEl.value;
        } else if (natFilterEl) {
            natFilterEl.value = currentNationalRatingFilter;
        }

        // Sync Rating Summary filter from dropdown (defaults to 'very_poor' on initial load)
        const ratingFilterEl = document.getElementById('scorecard-rating-filter');
        if (ratingFilterEl && ratingFilterEl.value) {
            currentRatingFilter = ratingFilterEl.value;
        } else if (ratingFilterEl) {
            ratingFilterEl.value = currentRatingFilter;
        }

        // Sync SO Execution filter from dropdown (defaults to 'not_executed' on initial load)
        const execFilterEl = document.getElementById('scorecard-execution-filter');
        if (execFilterEl && execFilterEl.value) {
            currentExecutionFilter = execFilterEl.value;
        } else if (execFilterEl) {
            execFilterEl.value = currentExecutionFilter;
        }

        // 2. Current / Selected Month Period Badges for Rating Summary and SO Execution Summary
        const currentPeriodLabel = (threeMonths.length === 3)
            ? (threeMonths[2].fullName || `${threeMonths[2].label} ${threeMonths[2].year}`)
            : `${m}/${y}`;

        const ratingBadgeEl = document.getElementById('scorecard-rating-period-badge');
        if (ratingBadgeEl) {
            ratingBadgeEl.textContent = currentPeriodLabel;
        }

        const execBadgeEl = document.getElementById('scorecard-exec-period-badge');
        if (execBadgeEl) {
            execBadgeEl.textContent = currentPeriodLabel;
        }

        const scRatingSubtitle = document.getElementById('scorecard-rating-subtitle');
        if (scRatingSubtitle) {
            scRatingSubtitle.textContent = `Rating Performa Stock Opname Sites`;
        }
        const scExecSubtitle = document.getElementById('scorecard-exec-subtitle');
        if (scExecSubtitle) {
            scExecSubtitle.textContent = `Status eksekusi Stock Opname Sites`;
        }

        const thRatingSel = document.getElementById('sc-rating-th-selected');
        if (thRatingSel && threeMonths.length === 3) {
            thRatingSel.textContent = `${threeMonths[2].label} (%)`;
        }
        const thExecSel = document.getElementById('sc-exec-th-selected');
        if (thExecSel && threeMonths.length === 3) {
            thExecSel.textContent = `${threeMonths[2].label} (%)`;
        }

        // Set initial header titles for National 3 columns
        if (threeMonths.length === 3) {
            const title1 = document.getElementById('national-col-title-m1');
            const title2 = document.getElementById('national-col-title-m2');
            const title3 = document.getElementById('national-col-title-m3');
            if (title1) title1.textContent = `${threeMonths[0].label} ${threeMonths[0].year}`;
            if (title2) title2.textContent = `${threeMonths[1].label} ${threeMonths[1].year}`;
            if (title3) title3.textContent = `${threeMonths[2].label} ${threeMonths[2].year}`;
        }

        function applyScorecardJsonData(json) {
            if (!json || !json.success) return;
            scorecardRatingData = json.rating || [];
            scorecardExecutionData = json.execution || [];
            scorecardPeriod = json.period || null;

            if (json.period && json.period.m1 && json.period.m2 && json.period.m3) {
                const title1 = document.getElementById('national-col-title-m1');
                const title2 = document.getElementById('national-col-title-m2');
                const title3 = document.getElementById('national-col-title-m3');
                if (title1) title1.textContent = `${json.period.m1.label} ${json.period.m1.year}`;
                if (title2) title2.textContent = `${json.period.m2.label} ${json.period.m2.year}`;
                if (title3) title3.textContent = `${json.period.m3.label} ${json.period.m3.year}`;

                const thRatingSel = document.getElementById('sc-rating-th-selected');
                if (thRatingSel) thRatingSel.textContent = `${json.period.m3.label} (%)`;
                const thExecSel = document.getElementById('sc-exec-th-selected');
                if (thExecSel) thExecSel.textContent = `${json.period.m3.label} (%)`;
            }

            populateScorecardFilters();
            applyScorecardFiltersAndRender();
        }

        const scorecardCacheKey = `${soType}_${category}_${y}_${m}`;
        if (scorecardDataCache.has(scorecardCacheKey)) {
            applyScorecardJsonData(scorecardDataCache.get(scorecardCacheKey));
        }

        try {
            const res = await fetch(`api/scorecard_summary.php?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}&category=${encodeURIComponent(category)}&so_type=${encodeURIComponent(soType)}`);
            const json = await res.json();

            if (json.success) {
                scorecardDataCache.set(scorecardCacheKey, json);
                applyScorecardJsonData(json);
            } else {
                console.warn('Scorecard summary failed:', json.message);
                scorecardRatingData = [];
                scorecardExecutionData = [];
                scorecardPeriod = null;
                populateScorecardFilters();
                applyScorecardFiltersAndRender();
            }
        } catch (err) {
            console.error('Error fetching scorecard summary:', err);
            scorecardRatingData = [];
            scorecardExecutionData = [];
            scorecardPeriod = null;
            populateScorecardFilters();
            applyScorecardFiltersAndRender();
        }
    }

    function updateScoreCardPeriod(year, month) {
        return loadScoreCardSummary(year, month);
    }

    function populateScorecardFilters() {
        const deptSelect = document.getElementById('scorecard-dept-filter');
        const subdeptSelect = document.getElementById('scorecard-subdept-filter');
        if (!deptSelect || !subdeptSelect) return;

        const isPmd = (summaryCategory === 'pmd');

        let deptHtml = '<option value="all">Semua DEPT</option>';
        if (isPmd) {
            deptHtml += '<option value="PMD">PMD</option>';
            deptHtml += '<option value="DNO">DNO</option>';
            deptHtml += '<option value="DSO">DSO</option>';
        } else {
            const depts = (summarySOType === 'quarterly') ? ['ERO', 'WRO'] : ['CRO', 'ERO', 'WRO'];
            depts.forEach(d => {
                deptHtml += `<option value="${d}">${d}</option>`;
            });
        }
        deptSelect.innerHTML = deptHtml;

        if (currentScorecardDeptFilter !== 'all' && deptSelect.querySelector(`option[value="${currentScorecardDeptFilter}"]`)) {
            deptSelect.value = currentScorecardDeptFilter;
        } else {
            deptSelect.value = 'all';
            currentScorecardDeptFilter = 'all';
        }

        updateScorecardSubdeptOptions();
    }

    function updateScorecardSubdeptOptions() {
        const deptSelect = document.getElementById('scorecard-dept-filter');
        const subdeptSelect = document.getElementById('scorecard-subdept-filter');
        if (!subdeptSelect) return;

        const selectedDept = deptSelect ? deptSelect.value : 'all';
        const isPmd = (summaryCategory === 'pmd');

        let html = '<option value="all">Semua Sub Dept</option>';

        if (isPmd) {
            html += '<option value="DNO">DNO</option>';
            html += '<option value="DSO">DSO</option>';
        } else {
            if (selectedDept === 'all') {
                const depts = (summarySOType === 'quarterly') ? ['ERO', 'WRO'] : ['CRO', 'ERO', 'WRO'];
                depts.forEach(d => {
                    const subs = DEPT_SUBDEPTS_MAP[d] || [];
                    if (subs.length > 0) {
                        html += `<optgroup label="${d}">`;
                        subs.forEach(s => {
                            html += `<option value="${s}">${s}</option>`;
                        });
                        html += `</optgroup>`;
                    }
                });
            } else if (DEPT_SUBDEPTS_MAP[selectedDept]) {
                const subs = DEPT_SUBDEPTS_MAP[selectedDept] || [];
                subs.forEach(s => {
                    html += `<option value="${s}">${s}</option>`;
                });
            }
        }

        subdeptSelect.innerHTML = html;
        if (currentScorecardSubDeptFilter !== 'all' && subdeptSelect.querySelector(`option[value="${currentScorecardSubDeptFilter}"]`)) {
            subdeptSelect.value = currentScorecardSubDeptFilter;
        } else {
            subdeptSelect.value = 'all';
            currentScorecardSubDeptFilter = 'all';
        }
    }

    function onScorecardDeptFilterChange() {
        const deptSelect = document.getElementById('scorecard-dept-filter');
        currentScorecardDeptFilter = deptSelect ? deptSelect.value : 'all';
        updateScorecardSubdeptOptions();
        const subdeptSelect = document.getElementById('scorecard-subdept-filter');
        currentScorecardSubDeptFilter = subdeptSelect ? subdeptSelect.value : 'all';

        applyScorecardFiltersAndRender();
    }

    function onScorecardSubDeptFilterChange() {
        const subdeptSelect = document.getElementById('scorecard-subdept-filter');
        currentScorecardSubDeptFilter = subdeptSelect ? subdeptSelect.value : 'all';

        applyScorecardFiltersAndRender();
    }

    function applyScorecardFiltersAndRender() {
        // 1. Recompute Rating Pie Chart counts based on filtered rating data
        const filteredRating = scorecardRatingData.filter(r => matchesScorecardFilter(r, currentScorecardDeptFilter, currentScorecardSubDeptFilter));
        const rCounts = {
            very_good: 0,
            good: 0,
            moderate: 0,
            poor: 0,
            very_poor: 0
        };
        filteredRating.forEach(r => {
            const k = (r.rating || '').toLowerCase().replace(/\s+/g, '_');
            if (rCounts[k] !== undefined) rCounts[k]++;
        });
        renderScoreCardRatingPieChart(rCounts);

        // 2. Recompute Execution Pie Chart counts based on filtered execution data
        const filteredExec = scorecardExecutionData.filter(e => matchesScorecardFilter(e, currentScorecardDeptFilter, currentScorecardSubDeptFilter));
        const eCounts = {
            executed: 0,
            not_executed: 0
        };
        filteredExec.forEach(e => {
            const k = (e.execution_status || '').toLowerCase().replace(/\s+/g, '_');
            if (eCounts[k] !== undefined) eCounts[k]++;
        });
        renderScoreCardExecPieChart(eCounts);

        // 3. Render Tables
        renderScoreCardRating();
        renderScoreCardExecution();
        renderNationalScoreCardRating();
    }

    function onNationalRatingFilterChange(filterValue) {
        currentNationalRatingFilter = filterValue || 'all';
        renderNationalScoreCardRating();
    }

    function renderNationalScoreCardRating() {
        const tbody1 = document.getElementById('national-rating-tbody-m1');
        const tbody2 = document.getElementById('national-rating-tbody-m2');
        const tbody3 = document.getElementById('national-rating-tbody-m3');
        if (!tbody1 || !tbody2 || !tbody3) return;

        const trendEl1 = document.getElementById('national-col-trend-m1');
        const trendEl2 = document.getElementById('national-col-trend-m2');
        const trendEl3 = document.getElementById('national-col-trend-m3');

        if (scorecardRatingData.length === 0) {
            const emptyHtml = `
                <tr>
                    <td colspan="6" class="text-center" style="padding: 1.5rem 0.5rem; color: #94a3b8;">
                        <div style="font-size: 12px; font-weight: 600; color: #64748b;">No data</div>
                    </td>
                </tr>
            `;
            tbody1.innerHTML = emptyHtml;
            tbody2.innerHTML = emptyHtml;
            tbody3.innerHTML = emptyHtml;
            const c1 = document.getElementById('national-col-count-m1');
            const c2 = document.getElementById('national-col-count-m2');
            const c3 = document.getElementById('national-col-count-m3');
            if (c1) c1.textContent = '0 Sites';
            if (c2) c2.textContent = '0 Sites';
            if (c3) c3.textContent = '0 Sites';
            if (trendEl1) trendEl1.innerHTML = '';
            if (trendEl2) trendEl2.innerHTML = '';
            if (trendEl3) trendEl3.innerHTML = '';
            return;
        }

        const renderTableMonth = (tbody, countEl, monthKey, ratingKey) => {
            let filtered = scorecardRatingData.filter(r => matchesScorecardFilter(r, currentScorecardDeptFilter, currentScorecardSubDeptFilter));
            if (currentNationalRatingFilter !== 'all') {
                filtered = filtered.filter(r => {
                    const rVal = (r[ratingKey] || '').toLowerCase().replace(/\s+/g, '_');
                    return rVal === currentNationalRatingFilter;
                });
            }

            if (countEl) {
                countEl.textContent = `${filtered.length} Sites`;
            }

            if (filtered.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center" style="padding: 1.5rem 0.5rem; color: #94a3b8; font-size: 11px;">
                            Tidak ada data untuk rating ini
                        </td>
                    </tr>
                `;
                return filtered;
            }

            let html = '';
            filtered.forEach((r, idx) => {
                const pctVal = r[monthKey];
                const ratingBadge = renderRatingBadge(r[ratingKey]);
                html += `
                    <tr>
                        <td class="scorecard-col-subdept" style="color: #475569;">${escapeHtml(r.sub_dept || '-')}</td>
                        <td class="scorecard-col-sitecode">${escapeHtml(r.sitecode)}</td>
                        <td class="scorecard-col-namesite" style="font-weight: 600; color: #1e293b;">${escapeHtml(r.name_site || '-')}</td>
                        <td class="scorecard-col-month">${formatPercent(pctVal)}</td>
                        <td class="scorecard-col-status">${ratingBadge}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
            return filtered;
        };

        const list1 = renderTableMonth(tbody1, document.getElementById('national-col-count-m1'), 'm1_pct', 'm1_rating') || [];
        const list2 = renderTableMonth(tbody2, document.getElementById('national-col-count-m2'), 'm2_pct', 'm2_rating') || [];
        const list3 = renderTableMonth(tbody3, document.getElementById('national-col-count-m3'), 'm3_pct', 'm3_rating') || [];

        // Trend indicators comparing count of sites across the 3 backdate months
        const title1 = document.getElementById('national-col-title-m1')?.textContent?.trim() || 'Bulan 1';
        const title2 = document.getElementById('national-col-title-m2')?.textContent?.trim() || 'Bulan 2';
        const title3 = document.getElementById('national-col-title-m3')?.textContent?.trim() || 'Bulan 3';

        // Preceding month info (m0) for Month 1 monthly comparison
        const m0Data = scorecardPeriod && scorecardPeriod.m0;
        const title0 = (m0Data && m0Data.label && m0Data.year)
            ? `${m0Data.label} ${m0Data.year}`
            : (m0Data && m0Data.label ? m0Data.label : 'Bulan Sebelumnya');
        const hasM0Data = Boolean(m0Data && m0Data.has_data);

        // Count for m0 sites matching current filter
        let list0Count = null;
        if (hasM0Data) {
            const filteredM0 = scorecardRatingData.filter(r => matchesScorecardFilter(r, currentScorecardDeptFilter, currentScorecardSubDeptFilter));
            if (currentNationalRatingFilter === 'all') {
                list0Count = filteredM0.length;
            } else {
                list0Count = filteredM0.filter(r => {
                    const rVal = (r.m0_rating || '').toLowerCase().replace(/\s+/g, '_');
                    return rVal === currentNationalRatingFilter;
                }).length;
            }
        }

        const isNegativeMetric = (currentNationalRatingFilter === 'very_poor' || currentNationalRatingFilter === 'poor');

        const renderCountTrendBadge = (diff, prevLabel, isBaseline = false) => {
            if (isBaseline || diff === null || diff === undefined) {
                return `<span class="kpi-target-indicator target-neutral" style="font-size: 10px; padding: 2.5px 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; vertical-align: middle;"><span style="display: inline-flex; align-items: center; justify-content: center; line-height: 1;">-</span></span>`;
            }
            if (diff === 0) {
                return `<span class="kpi-target-indicator target-neutral" style="font-size: 10px; padding: 2.5px 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; vertical-align: middle;"><span style="display: inline-flex; align-items: center; justify-content: center; line-height: 1;">0</span></span>`;
            }

            const isUp = diff > 0;
            // For negative metrics (Very Poor / Poor), decrease in count is good (target-up/green), increase is bad (target-down/red)
            const isGood = isNegativeMetric ? (diff < 0) : (diff > 0);
            const cls = isGood ? 'target-up' : 'target-down';
            const formatted = (diff > 0 ? '+' : '') + diff;

            const triangleSvg = isUp
                ? `<svg width="7.5" height="7.5" viewBox="0 0 24 24" fill="currentColor" style="display: block; flex-shrink: 0;"><polygon points="12,4 21,20 3,20"/></svg>`
                : `<svg width="7.5" height="7.5" viewBox="0 0 24 24" fill="currentColor" style="display: block; flex-shrink: 0;"><polygon points="12,20 3,4 21,4"/></svg>`;

            return `
                <span class="kpi-target-indicator ${cls}" style="font-size: 10px; padding: 2.5px 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; vertical-align: middle;">
                    ${triangleSvg}
                    <span style="display: inline-flex; align-items: center; justify-content: center; line-height: 1;">${formatted}</span>
                </span>
            `;
        };

        if (trendEl1) {
            if (hasM0Data && list0Count !== null) {
                const diff1 = list1.length - list0Count;
                trendEl1.innerHTML = renderCountTrendBadge(diff1, title0, false);
            } else {
                trendEl1.innerHTML = renderCountTrendBadge(null, title0, true);
            }
        }
        if (trendEl2) {
            const diff2 = list2.length - list1.length;
            trendEl2.innerHTML = renderCountTrendBadge(diff2, title1, false);
        }
        if (trendEl3) {
            const diff3 = list3.length - list2.length;
            trendEl3.innerHTML = renderCountTrendBadge(diff3, title2, false);
        }
    }

    function onScorecardRatingFilterChange(filterValue) {
        currentRatingFilter = filterValue || 'all';
        renderScoreCardRating();
    }

    function toggleScorecardRatingFilter(filterValue) {
        const sel = document.getElementById('scorecard-rating-filter');
        const nextVal = (currentRatingFilter === filterValue) ? 'all' : filterValue;
        currentRatingFilter = nextVal;
        if (sel) sel.value = nextVal;
        renderScoreCardRating();
    }

    function onScorecardExecutionFilterChange(filterValue) {
        currentExecutionFilter = filterValue || 'all';
        renderScoreCardExecution();
    }

    function toggleScorecardExecutionFilter(filterValue) {
        const sel = document.getElementById('scorecard-execution-filter');
        const nextVal = (currentExecutionFilter === filterValue) ? 'all' : filterValue;
        currentExecutionFilter = nextVal;
        if (sel) sel.value = nextVal;
        renderScoreCardExecution();
    }

    function renderScoreCardRating() {
        const tbody = document.getElementById('scorecard-rating-tbody');
        if (!tbody) return;

        // Highlight active stat row
        document.querySelectorAll('#scorecard-rating-pie-stats .scorecard-pie-stat-row').forEach(row => {
            if (row.getAttribute('data-rating') === currentRatingFilter) {
                row.classList.add('active');
            } else {
                row.classList.remove('active');
            }
        });

        if (scorecardRatingData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center" style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                        <div style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">
                            No data
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let filtered = scorecardRatingData.filter(r => matchesScorecardFilter(r, currentScorecardDeptFilter, currentScorecardSubDeptFilter));
        if (currentRatingFilter !== 'all') {
            filtered = filtered.filter(r => (r.rating || '').toLowerCase().replace(/\s+/g, '_') === currentRatingFilter);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center" style="padding: 2rem 0.5rem; color: #94a3b8;">
                        Tidak ada data yang sesuai dengan filter rating.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach((r, idx) => {
            const pctVal = r.pct !== undefined && r.pct !== null ? r.pct : r.m3_pct;
            html += `
                <tr>
                    <td class="scorecard-col-subdept" style="color: #475569;">${escapeHtml(r.sub_dept || '-')}</td>
                    <td class="scorecard-col-sitecode">${escapeHtml(r.sitecode)}</td>
                    <td class="scorecard-col-namesite" style="font-weight: 600; color: #1e293b;">${escapeHtml(r.name_site || '-')}</td>
                    <td class="scorecard-col-month">${formatPercent(pctVal)}</td>
                    <td class="scorecard-col-status">${renderRatingBadge(r.rating)}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    function renderScoreCardExecution() {
        const tbody = document.getElementById('scorecard-exec-tbody');
        if (!tbody) return;

        // Highlight active stat row
        document.querySelectorAll('#scorecard-exec-pie-stats .scorecard-pie-stat-row').forEach(row => {
            if (row.getAttribute('data-exec') === currentExecutionFilter) {
                row.classList.add('active');
            } else {
                row.classList.remove('active');
            }
        });

        if (scorecardExecutionData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center" style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                        <div style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">
                            No data
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let filtered = scorecardExecutionData.filter(e => matchesScorecardFilter(e, currentScorecardDeptFilter, currentScorecardSubDeptFilter));
        if (currentExecutionFilter !== 'all') {
            filtered = filtered.filter(e => (e.execution_status || '').toLowerCase().replace(/\s+/g, '_') === currentExecutionFilter);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center" style="padding: 2rem 0.5rem; color: #94a3b8;">
                        Tidak ada data yang sesuai dengan filter status.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach((e, idx) => {
            const pctVal = e.pct !== undefined && e.pct !== null ? e.pct : e.m3_pct;
            html += `
                <tr>
                    <td class="scorecard-col-subdept" style="color: #475569;">${escapeHtml(e.sub_dept || '-')}</td>
                    <td class="scorecard-col-sitecode">${escapeHtml(e.sitecode)}</td>
                    <td class="scorecard-col-namesite" style="font-weight: 600; color: #1e293b;">${escapeHtml(e.name_site || '-')}</td>
                    <td class="scorecard-col-month">${formatPercent(pctVal)}</td>
                    <td class="scorecard-col-status">${renderExecutionBadge(e.execution_status)}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    function renderRatingBadge(rating) {
        const r = String(rating || '').toLowerCase();
        if (r === 'very good' || r === 'very_good') return '<span class="badge-rating-very-good">Very Good</span>';
        if (r === 'good') return '<span class="badge-rating-good">Good</span>';
        if (r === 'moderate') return '<span class="badge-rating-moderate">Moderate</span>';
        if (r === 'poor') return '<span class="badge-rating-poor">Poor</span>';
        if (r === 'very poor' || r === 'very_poor') return '<span class="badge-rating-very-poor">Very Poor</span>';
        return `<span class="badge-rating-moderate">${escapeHtml(rating || '-')}</span>`;
    }

    function renderExecutionBadge(status) {
        const s = String(status || '').toLowerCase();
        if (s === 'executed') return '<span class="badge-exec-done">Executed</span>';
        if (s === 'not executed' || s === 'not_executed') return '<span class="badge-exec-not-done">Not Executed</span>';
        return `<span class="badge-exec-done">${escapeHtml(status || '-')}</span>`;
    }

    // ── Score Card Summary Pie Charts ───────────────────────────

    let scorecardRatingPieChart = null;
    let scorecardExecPieChart = null;

    function getOrCreateScorecardTooltip() {
        let tooltipEl = document.getElementById('scorecard-floating-tooltip');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'scorecard-floating-tooltip';
            tooltipEl.className = 'scorecard-floating-tooltip';
            document.body.appendChild(tooltipEl);
        }
        return tooltipEl;
    }

    function externalScorecardTooltip(context) {
        const { chart, tooltip } = context;
        const tooltipEl = getOrCreateScorecardTooltip();

        if (!tooltip || tooltip.opacity === 0) {
            tooltipEl.style.opacity = '0';
            tooltipEl.style.visibility = 'hidden';
            return;
        }

        if (tooltip.body) {
            const bodyLines = tooltip.body.map(b => b.lines).flat();
            let html = '';
            bodyLines.forEach((line, i) => {
                const colors = tooltip.labelColors && tooltip.labelColors[i] ? tooltip.labelColors[i] : null;
                const bg = (colors && colors.backgroundColor && colors.backgroundColor !== '#e2e8f0')
                    ? colors.backgroundColor
                    : '#38bdf8';
                const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background-color:${bg};margin-right:7px;vertical-align:middle;box-shadow:0 0 3px rgba(0,0,0,0.35);"></span>`;
                html += `<div style="display:flex;align-items:center;line-height:1.4;">${dot}<span style="font-weight:600;letter-spacing:0.2px;">${line.trim()}</span></div>`;
            });
            tooltipEl.innerHTML = html;
        }

        const rect = chart.canvas.getBoundingClientRect();
        const scrollX = window.pageXOffset || window.scrollX || 0;
        const scrollY = window.pageYOffset || window.scrollY || 0;
        const left = rect.left + scrollX + tooltip.caretX;
        const top = rect.top + scrollY + tooltip.caretY;

        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
        tooltipEl.style.opacity = '1';
        tooltipEl.style.visibility = 'visible';
    }

    function bindScorecardCanvasMouseLeave(canvas) {
        if (!canvas || canvas._scMouseLeaveBound) return;
        canvas.addEventListener('mouseleave', () => {
            const el = document.getElementById('scorecard-floating-tooltip');
            if (el) {
                el.style.opacity = '0';
                el.style.visibility = 'hidden';
            }
        }, { passive: true });
        canvas._scMouseLeaveBound = true;
    }

    function renderScoreCardRatingPieChart(counts = null) {
        const canvas = document.getElementById('chart-scorecard-rating-pie');
        if (!canvas) return;

        bindScorecardCanvasMouseLeave(canvas);

        if (scorecardRatingPieChart) {
            scorecardRatingPieChart.destroy();
            scorecardRatingPieChart = null;
        }

        const labels = ['Very Good', 'Good', 'Moderate', 'Poor', 'Very Poor'];
        const colors = ['#16a34a', '#0284c7', '#d97706', '#ea580c', '#dc2626'];
        const data = counts ? [
            counts.very_good || 0,
            counts.good || 0,
            counts.moderate || 0,
            counts.poor || 0,
            counts.very_poor || 0
        ] : [0, 0, 0, 0, 0];

        const total = data.reduce((a, b) => a + b, 0);

        const elVg = document.getElementById('sc-stat-vg');
        const elG = document.getElementById('sc-stat-g');
        const elM = document.getElementById('sc-stat-m');
        const elP = document.getElementById('sc-stat-p');
        const elVp = document.getElementById('sc-stat-vp');

        if (elVg) elVg.textContent = total > 0 ? `${data[0]} sites (${((data[0] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elG) elG.textContent = total > 0 ? `${data[1]} sites (${((data[1] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elM) elM.textContent = total > 0 ? `${data[2]} sites (${((data[2] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elP) elP.textContent = total > 0 ? `${data[3]} sites (${((data[3] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elVp) elVp.textContent = total > 0 ? `${data[4]} sites (${((data[4] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';

        const ctx = canvas.getContext('2d');
        if (total === 0) {
            scorecardRatingPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Belum Ada Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e2e8f0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: externalScorecardTooltip,
                            callbacks: {
                                title: () => '',
                                label: () => 'No data'
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
            return;
        }

        scorecardRatingPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 1.5,
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'],
                onClick: (evt, elements) => {
                    if (elements && elements.length > 0) {
                        const idx = elements[0].index;
                        const filterMap = ['very_good', 'good', 'moderate', 'poor', 'very_poor'];
                        const chosen = filterMap[idx];
                        if (chosen) {
                            toggleScorecardRatingFilter(chosen);
                        }
                    }
                },
                onHover: (event, chartElement) => {
                    event.native.target.style.cursor = (chartElement && chartElement.length > 0) ? 'pointer' : 'default';
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: externalScorecardTooltip,
                        callbacks: {
                            title: () => '',
                            label: (context) => {
                                const val = context.parsed;
                                const pct = total > 0 ? ((val / total) * 100).toFixed(2) : '0.00';
                                return `${context.label}: ${val} site (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    function renderScoreCardExecPieChart(counts = null) {
        const canvas = document.getElementById('chart-scorecard-exec-pie');
        if (!canvas) return;

        bindScorecardCanvasMouseLeave(canvas);

        if (scorecardExecPieChart) {
            scorecardExecPieChart.destroy();
            scorecardExecPieChart = null;
        }

        const labels = ['Executed', 'Not Executed'];
        const colors = ['#16a34a', '#dc2626'];
        const data = counts ? [
            counts.executed || 0,
            counts.not_executed || 0
        ] : [0, 0];

        const total = data.reduce((a, b) => a + b, 0);

        const elExec = document.getElementById('sc-stat-exec');
        const elNotExec = document.getElementById('sc-stat-not-exec');

        if (elExec) elExec.textContent = total > 0 ? `${data[0]} sites (${((data[0] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elNotExec) elNotExec.textContent = total > 0 ? `${data[1]} sites (${((data[1] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';

        const ctx = canvas.getContext('2d');
        if (total === 0) {
            scorecardExecPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Belum Ada Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e2e8f0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: externalScorecardTooltip,
                            callbacks: {
                                title: () => '',
                                label: () => 'Belum ada data eksekusi'
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
            return;
        }

        scorecardExecPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 1.5,
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'],
                onClick: (evt, elements) => {
                    if (elements && elements.length > 0) {
                        const idx = elements[0].index;
                        const filterMap = ['executed', 'not_executed'];
                        const chosen = filterMap[idx];
                        if (chosen) {
                            toggleScorecardExecutionFilter(chosen);
                        }
                    }
                },
                onHover: (event, chartElement) => {
                    event.native.target.style.cursor = (chartElement && chartElement.length > 0) ? 'pointer' : 'default';
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: externalScorecardTooltip,
                        callbacks: {
                            title: () => '',
                            label: (context) => {
                                const val = context.parsed;
                                const pct = total > 0 ? ((val / total) * 100).toFixed(2) : '0.00';
                                return `${context.label}: ${val} site (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    // ── Report SO Outlet Regional ──────────────────────────

    const DEPT_SUBDEPTS_MAP = {
        'CRO': ['CJDO', 'EKO', 'WJO', 'WKO'],
        'ERO': ['BNO', 'EJO', 'MPO', 'SMO'],
        'WRO': ['CSO', 'NSO', 'SSO'],
        'PMD': ['DNO', 'DSO']
    };

    function onDeptResultFilterChange() {
        const deptSelect = document.getElementById('dept-result-filter');
        const subDeptSelect = document.getElementById('subdept-result-filter');
        if (!deptSelect || !subDeptSelect) return;

        const dept = deptSelect.value;
        const previousSub = subDeptSelect.value;

        if (dept === 'all') {
            let html = '<option value="all">Semua Sub Dept</option>';
            const allowedDepts = (summaryCategory === 'pmd')
                ? ['PMD']
                : (summarySOType === 'quarterly' ? ['ERO', 'WRO'] : ['CRO', 'ERO', 'WRO']);
            allowedDepts.forEach(deptKey => {
                const list = DEPT_SUBDEPTS_MAP[deptKey] || [];
                html += `<optgroup label="${deptKey}">`;
                list.forEach(code => {
                    const isSelected = (code === previousSub);
                    html += `<option value="${code}" ${isSelected ? 'selected' : ''}>${code}</option>`;
                });
                html += `</optgroup>`;
            });
            subDeptSelect.innerHTML = html;
        } else if (DEPT_SUBDEPTS_MAP[dept]) {
            const list = DEPT_SUBDEPTS_MAP[dept];
            let html = '<option value="all">Semua Sub Dept</option>';
            list.forEach(code => {
                const isSelected = (code === previousSub);
                html += `<option value="${code}" ${isSelected ? 'selected' : ''}>${code}</option>`;
            });
            subDeptSelect.innerHTML = html;

            // If previously selected sub_dept is not in this dept and isn't 'all', choose the first one
            if (!list.includes(previousSub) && previousSub !== 'all') {
                subDeptSelect.value = list[0];
            }
        }

        loadSubDeptResults();
    }

    let subdeptSortCol = 'pct';
    let subdeptSortDir = 'asc';
    let subdeptCachedData = [];

    function toggleSubdeptResultsSort(col) {
        if (subdeptSortCol === col) {
            subdeptSortDir = subdeptSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            subdeptSortCol = col;
            subdeptSortDir = 'asc';
        }
        if (subdeptCachedData && subdeptCachedData.length > 0) {
            renderSubdeptCachedRows();
        } else {
            loadSubDeptResults();
        }
    }

    function updateSubdeptResultsSortIndicators() {
        document.querySelectorAll('.so-subdept-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('.so-subdept-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (subdeptSortCol) {
            const activeTh = document.querySelector(`.so-subdept-table th.sortable[onclick*="'${subdeptSortCol}'"]`);
            if (activeTh) {
                activeTh.classList.add(subdeptSortDir);
            }
            const activeInd = document.querySelector(`.so-subdept-table .sort-indicator[data-subdept-col="${subdeptSortCol}"]`);
            if (activeInd) {
                activeInd.textContent = subdeptSortDir === 'asc' ? '▲' : '▼';
            }
        }
    }

    async function loadSubDeptResults() {
        const deptSelect = document.getElementById('dept-result-filter');
        const subDeptSelect = document.getElementById('subdept-result-filter');
        const statusSelect = document.getElementById('status-result-filter');
        const monthSelect = document.getElementById('summary-filter-month');
        const yearSelect = document.getElementById('summary-filter-year');
        const tbody = document.getElementById('subdept-results-tbody');
        const tfoot = document.getElementById('subdept-results-tfoot');

        if (!tbody) return;

        const currentCategory = summaryCategory;
        const dept = (currentCategory === 'pmd') ? 'PMD' : (deptSelect ? deptSelect.value : 'all');
        const subDept = subDeptSelect ? subDeptSelect.value : 'all';
        const statusFilter = statusSelect ? statusSelect.value : 'all';
        const month = monthSelect ? monthSelect.value : '9';
        const year = yearSelect ? yearSelect.value : '2026';
        const isTarget98 = (
            currentCategory === 'pmd' ||
            dept === 'PMD' ||
            currentCategory === 'warehouse_tekno' ||
            currentCategory === 'it_coorporate' ||
            currentCategory === 'it_corporate'
        );

        // Update period badge next to title
        const periodBadge = document.getElementById('subdept-period-badge');
        if (periodBadge) {
            const monthText = monthSelect && monthSelect.selectedIndex >= 0 && monthSelect.options[monthSelect.selectedIndex]
                ? monthSelect.options[monthSelect.selectedIndex].text
                : (month ? `Bulan ${month}` : 'Semua Bulan');
            periodBadge.textContent = (summarySOType === 'quarterly')
                ? `${monthText} ${year} (Quarterly)`
                : `${monthText} ${year}`;
        }

        let catLabel = 'Outlet Regional';
        if (currentCategory === 'pmd') catLabel = 'PMD';
        else if (currentCategory === 'outlet_subarep') catLabel = 'Outlet Subarep';
        else if (currentCategory === 'warehouse_hub') catLabel = 'Warehouse HUB';
        else if (currentCategory === 'warehouse_tekno') catLabel = 'Warehouse Tekno';
        else if (currentCategory === 'it_coorporate') catLabel = 'IT Coorporate';

        function renderSubDeptJsonData(json) {
            if (!json || !json.success) return;
            const rows = json.data || [];
            if (rows.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 2rem; color: #64748b;">
                            No data.
                        </td>
                    </tr>
                `;
                renderSubDeptPieChart(0, 0, 0, isTarget98);
                return;
            }

            // Auto sort from pencapaian % lower to high (ascending)
            rows.sort((a, b) => {
                const pctA = (a.has_data && a.total_physic_pct !== null && a.total_physic_pct !== undefined)
                    ? parseFloat(a.total_physic_pct)
                    : -1;
                const pctB = (b.has_data && b.total_physic_pct !== null && b.total_physic_pct !== undefined)
                    ? parseFloat(b.total_physic_pct)
                    : -1;
                if (pctA !== pctB) {
                    return pctA - pctB;
                }
                return (a.sitecode || '').localeCompare(b.sitecode || '');
            });

            // Classify each row into Tercapai / Tidak Tercapai
            let countTercapai = 0;
            let countTidakTercapai = 0;

            rows.forEach((r) => {
                let isTercapai = false;
                if (r.has_data && r.total_physic_pct !== null && r.total_physic_pct !== undefined) {
                    const pct = parseFloat(r.total_physic_pct);
                    if (isTarget98) {
                        isTercapai = (pct >= 98);
                    } else {
                        isTercapai = (pct >= 85);
                    }
                }
                r._isTercapai = isTercapai;
                if (isTercapai) {
                    countTercapai++;
                } else {
                    countTidakTercapai++;
                }
            });

            // Filter rows by status if filter is selected
            let displayRows = rows;
            if (statusFilter === 'tercapai') {
                displayRows = rows.filter(r => r._isTercapai);
            } else if (statusFilter === 'tidak_tercapai') {
                displayRows = rows.filter(r => !r._isTercapai);
            }
            subdeptCachedData = displayRows;
            sortSubdeptRows(displayRows);

            // Update Pie Card Subtitle
            const pieSubtitle = document.getElementById('subdept-pie-subtitle');
            if (pieSubtitle) {
                let label = '';
                if (currentCategory === 'pmd') {
                    label = (subDept === 'all') ? 'Semua Dept' : `PMD - ${subDept}`;
                } else if (currentCategory === 'it_coorporate') {
                    label = 'IT Coorporate';
                } else if (currentCategory === 'warehouse_tekno') {
                    label = (summarySOType === 'quarterly') ? 'Warehouse Tekno (Quarterly)' : 'Warehouse Tekno';
                } else if (currentCategory === 'warehouse_hub') {
                    label = (summarySOType === 'quarterly') ? 'Warehouse HUB (Quarterly)' : 'Warehouse HUB';
                } else if (currentCategory === 'outlet_subarep') {
                    label = (dept === 'all' && subDept === 'all') ? 'Outlet Subarep (Semua DEPT)' : (subDept === 'all' ? `${dept} (Semua Sub Dept)` : `${dept} - ${subDept}`);
                } else {
                    if (dept === 'all' && subDept === 'all') {
                        label = 'Semua DEPT';
                    } else if (subDept === 'all') {
                        label = `${dept} (Semua Sub Dept)`;
                    } else {
                        label = dept !== 'all' ? `${dept} - ${subDept}` : subDept;
                    }
                }
                const filterSuffix = (statusFilter !== 'all')
                    ? ` [${statusFilter === 'tercapai' ? 'Tercapai' : 'Tidak Tercapai'}: ${displayRows.length} Sites]`
                    : ` (${rows.length} Sites)`;
                pieSubtitle.textContent = `${label}${filterSuffix}`;
            }

            if (displayRows.length === 0) {
                const filterLabel = statusFilter === 'tercapai' ? 'Tercapai' : 'Tidak Tercapai';
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 2.5rem; color: #64748b;">
                            Tidak ada data dengan status <strong>${escapeHtml(filterLabel)}</strong>.
                        </td>
                    </tr>
                `;
                if (tfoot) tfoot.innerHTML = '';
                renderSubDeptPieChart(countTercapai, countTidakTercapai, rows.length, isTarget98);
                return;
            }

            updateSubdeptResultsSortIndicators();
            let html = '';
            displayRows.forEach((r) => {
                const sitecode = escapeHtml(r.sitecode || '-');
                const nameSite = escapeHtml(r.name_site || '-');
                const matchQty = Number(r.match_physic_qty || 0).toLocaleString();
                const physicQty = Number(r.physic_physic_qty || 0).toLocaleString();
                const dbQty = Number(r.db_physic_qty || 0).toLocaleString();
                const targetQty = Number(r.total_physic_target || 0).toLocaleString();

                let pctDisplay = '-';
                let defisitDisplay = '-';
                let defisitColor = 'color: #64748b; font-weight: 600;';
                let statusHtml = '<span class="so-status-badge status-none">Belum Ada Data</span>';

                if (r.has_data && r.total_physic_pct !== null && r.total_physic_pct !== undefined) {
                    const pct = parseFloat(r.total_physic_pct);
                    pctDisplay = `${pct.toFixed(2)}%`;

                    const defisit = 100 - pct;
                    defisitDisplay = `${defisit.toFixed(2)}%`;
                    defisitColor = defisit > 0 ? 'color: #dc2626; font-weight: 700;' : 'color: #16a34a; font-weight: 700;';

                    let statusText = 'Tidak Tercapai';
                    let statusClass = 'status-red';
                    let progressClass = 'so-progress-red';
                    let color = '#dc2626';

                    if (isTarget98) {
                        if (pct >= 98) {
                            statusText = 'Tercapai';
                            statusClass = 'status-green';
                            progressClass = 'so-progress-green';
                            color = '#16a34a';
                        }
                    } else {
                        if (pct >= 85) {
                            statusText = 'Tercapai';
                            statusClass = 'status-green';
                            progressClass = 'so-progress-green';
                            color = '#16a34a';
                        } else if (pct >= 75) {
                            statusText = 'Tidak Tercapai';
                            statusClass = 'status-orange';
                            progressClass = 'so-progress-orange';
                            color = '#ea580c';
                        }
                    }

                    const clampedPct = Math.min(Math.max(pct, 0), 100);

                    statusHtml = `
                        <div class="so-progress-container">
                            <div class="so-progress-header">
                                <span class="so-status-badge ${statusClass}">${statusText}</span>
                                <span style="font-weight: 700; font-size: 12px; color: ${color};">${pctDisplay}</span>
                            </div>
                            <div class="so-progress-track">
                                <div class="so-progress-fill ${progressClass}" style="width: ${clampedPct}%;"></div>
                            </div>
                        </div>
                    `;
                }

                html += `
                    <tr>
                        <td class="text-center" style="font-weight: 600; color: #1e293b;">${sitecode}</td>
                        <td class="col-name-site" style="color: #334155; text-align: left;">${nameSite}</td>
                        <td class="text-center" style="color: #64748b;">${matchQty}</td>
                        <td class="text-center" style="color: #64748b;">${physicQty}</td>
                        <td class="text-center" style="color: #64748b;">${dbQty}</td>
                        <td class="text-center" style="color: #64748b; font-weight: 600;">${targetQty}</td>
                        <td class="text-center" style="font-weight: 600;">${pctDisplay}</td>
                        <td class="text-center" style="${defisitColor}">${defisitDisplay}</td>
                        <td class="col-status" style="text-align: initial;">${statusHtml}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;

            // Render Foot Summary Row
            if (tfoot) {
                let sMatch = 0, sPhysic = 0, sDb = 0, sTarget = 0, sPct = 0;
                let countWithData = 0;

                displayRows.forEach(r => {
                    sMatch += Number(r.match_physic_qty || 0);
                    sPhysic += Number(r.physic_physic_qty || 0);
                    sDb += Number(r.db_physic_qty || 0);
                    sTarget += Number(r.total_physic_target || 0);
                    if (r.has_data && r.total_physic_pct !== null && r.total_physic_pct !== undefined) {
                        sPct += parseFloat(r.total_physic_pct);
                        countWithData++;
                    }
                });

                // Fallback to json level totals if displayRows had no data
                if (statusFilter === 'all' && countWithData === 0) {
                    const fallbackTotals = json.totals || {};
                    sMatch = Number(fallbackTotals.total_match ?? json.total_match_qty ?? 0);
                    sPhysic = Number(fallbackTotals.total_physic ?? json.total_physic_qty ?? 0);
                    sDb = Number(fallbackTotals.total_db ?? json.total_db_qty ?? 0);
                    sTarget = Number(fallbackTotals.total_target ?? json.total_target_qty ?? 0);
                    countWithData = Number(fallbackTotals.count_with_data ?? json.count_with_data ?? 0);
                    if (countWithData > 0) {
                        sPct = Number(fallbackTotals.avg_pct ?? json.avg_pct ?? 0) * countWithData;
                    }
                }

                const totalMatch = sMatch.toLocaleString();
                const totalPhysic = sPhysic.toLocaleString();
                const totalDb = sDb.toLocaleString();
                const totalTarget = sTarget.toLocaleString();
                const avgPct = countWithData > 0 ? (sPct / countWithData) : 0;
                const avgDisplay = `${avgPct.toFixed(2)}%`;
                const avgDefisit = countWithData > 0 ? (100 - avgPct) : 0;
                const avgDefisitDisplay = countWithData > 0 ? `${avgDefisit.toFixed(2)}%` : '-';
                const avgDefisitColor = avgDefisit > 0 ? 'color: #dc2626;' : 'color: #16a34a;';

                let overallText = 'Belum Ada Data';
                let overallStatusClass = 'status-none';
                let overallProgressClass = '';
                let overallColor = '#64748b';

                if (countWithData > 0) {
                    if (isTarget98) {
                        if (avgPct >= 98) {
                            overallText = 'Tercapai';
                            overallStatusClass = 'status-green';
                            overallProgressClass = 'so-progress-green';
                            overallColor = '#16a34a';
                        } else {
                            overallText = 'Tidak Tercapai';
                            overallStatusClass = 'status-red';
                            overallProgressClass = 'so-progress-red';
                            overallColor = '#dc2626';
                        }
                    } else {
                        if (avgPct >= 85) {
                            overallText = 'Tercapai';
                            overallStatusClass = 'status-green';
                            overallProgressClass = 'so-progress-green';
                            overallColor = '#16a34a';
                        } else if (avgPct >= 75) {
                            overallText = 'Tidak Tercapai';
                            overallStatusClass = 'status-orange';
                            overallProgressClass = 'so-progress-orange';
                            overallColor = '#ea580c';
                        } else {
                            overallText = 'Tidak Tercapai';
                            overallStatusClass = 'status-red';
                            overallProgressClass = 'so-progress-red';
                            overallColor = '#dc2626';
                        }
                    }
                }

                const clampedAvg = Math.min(Math.max(avgPct, 0), 100);

                const overallStatusHtml = countWithData > 0 ? `
                    <div class="so-progress-container">
                        <div class="so-progress-header">
                            <span class="so-status-badge ${overallStatusClass}">${overallText}</span>
                            <span style="font-weight: 700; font-size: 12px; color: ${overallColor};">${avgDisplay}</span>
                        </div>
                        <div class="so-progress-track">
                            <div class="so-progress-fill ${overallProgressClass}" style="width: ${clampedAvg}%;"></div>
                        </div>
                    </div>
                ` : `<span class="so-status-badge status-none">Belum Ada Data</span>`;

                const filterNote = (statusFilter !== 'all')
                    ? ` - ${statusFilter === 'tercapai' ? 'Tercapai' : 'Tidak Tercapai'}`
                    : '';

                tfoot.innerHTML = `
                    <tr class="table-summary-row" style="background: #f8fafc; font-weight: 700;">
                        <td colspan="2" class="col-name-site" style="color: #0f172a; padding: 0.75rem 1rem; position: sticky; bottom: 0; background: #f8fafc; z-index: 5; border-top: 2px solid #cbd5e1; text-align: left;">
                            Grand Total (${displayRows.length} Sites${filterNote})
                        </td>
                        <td class="text-center" style="color: #0f172a; padding: 0.75rem 0.5rem; position: sticky; bottom: 0; background: #f8fafc; z-index: 5; border-top: 2px solid #cbd5e1;">${totalMatch}</td>
                        <td class="text-center" style="color: #0f172a; padding: 0.75rem 0.5rem; position: sticky; bottom: 0; background: #f8fafc; z-index: 5; border-top: 2px solid #cbd5e1;">${totalPhysic}</td>
                        <td class="text-center" style="color: #0f172a; padding: 0.75rem 0.5rem; position: sticky; bottom: 0; background: #f8fafc; z-index: 5; border-top: 2px solid #cbd5e1;">${totalDb}</td>
                        <td class="text-center" style="color: #0f172a; padding: 0.75rem 0.5rem; position: sticky; bottom: 0; background: #f8fafc; z-index: 5; border-top: 2px solid #cbd5e1;">${totalTarget}</td>
                        <td class="text-center" style="color: #0f172a; padding: 0.75rem 0.5rem; position: sticky; bottom: 0; background: #f8fafc; z-index: 5; border-top: 2px solid #cbd5e1;">${avgDisplay}</td>
                        <td class="text-center" style="${avgDefisitColor} font-weight: 700; padding: 0.75rem 0.5rem; position: sticky; bottom: 0; background: #f8fafc; z-index: 5; border-top: 2px solid #cbd5e1;">${avgDefisitDisplay}</td>
                        <td class="col-status" style="padding: 0.75rem 0.5rem; position: sticky; bottom: 0; background: #f8fafc; z-index: 5; border-top: 2px solid #cbd5e1; text-align: initial;">${overallStatusHtml}</td>
                    </tr>
                `;
            }

            // Update Pie Chart
            renderSubDeptPieChart(countTercapai, countTidakTercapai, rows.length, isTarget98);
        }

        const subdeptCacheKey = `${summarySOType}_${currentCategory}_${dept}_${subDept}_${month}_${year}`;

        // ── 0ms Instant Cache Render ──
        if (subdeptResultsCache.has(subdeptCacheKey)) {
            renderSubDeptJsonData(subdeptResultsCache.get(subdeptCacheKey));
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
                        <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
                            <span class="spinner" style="width: 16px; height: 16px;"></span>
                            <span>Memuat Hasil SO ${catLabel}...</span>
                        </div>
                    </td>
                </tr>
            `;
            if (tfoot) tfoot.innerHTML = '';
        }

        try {
            const params = new URLSearchParams({
                action: 'subdept_results',
                so_type: summarySOType,
                category: currentCategory,
                dept: dept,
                sub_dept: subDept,
                month: month,
                year: year
            });

            const res = await fetch(`api/reconciliation.php?${params.toString()}`);
            const json = await res.json();

            if (!json.success) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
                            Gagal memuat data: ${escapeHtml(json.message || 'Unknown error')}
                        </td>
                    </tr>
                `;
                return;
            }

            subdeptResultsCache.set(subdeptCacheKey, json);
            renderSubDeptJsonData(json);
        } catch (err) {
            console.error('Error loading subdept results:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
                        Kesalahan jaringan saat memuat data Hasil SO Outlet Regional.
                    </td>
                </tr>
            `;
            renderSubDeptPieChart(0, 0, 0, isTarget98);
        }
    }

    // ── Pie Chart: Tercapai vs Tidak Tercapai ─────────────────────

    let subDeptPieChart = null;

    function toggleSubDeptStatusFilter(targetStatus) {
        const sel = document.getElementById('status-result-filter');
        if (!sel) return;
        const current = sel.value || 'all';
        const nextVal = (current === targetStatus) ? 'all' : targetStatus;
        sel.value = nextVal;
        loadSubDeptResults();
    }

    function sortSubdeptRows(arr) {
        if (!subdeptSortCol) return;
        arr.sort((a, b) => {
            let valA, valB;
            if (subdeptSortCol === 'sitecode') {
                valA = (a.sitecode || '').toString();
                valB = (b.sitecode || '').toString();
                return subdeptSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (subdeptSortCol === 'name_site') {
                valA = (a.name_site || '').toString();
                valB = (b.name_site || '').toString();
                return subdeptSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (subdeptSortCol === 'match_qty') {
                valA = parseFloat(a.match_physic_qty) || 0;
                valB = parseFloat(b.match_physic_qty) || 0;
                return subdeptSortDir === 'asc' ? valA - valB : valB - valA;
            } else if (subdeptSortCol === 'physic_qty') {
                valA = parseFloat(a.physic_physic_qty) || 0;
                valB = parseFloat(b.physic_physic_qty) || 0;
                return subdeptSortDir === 'asc' ? valA - valB : valB - valA;
            } else if (subdeptSortCol === 'db_qty') {
                valA = parseFloat(a.db_physic_qty) || 0;
                valB = parseFloat(b.db_physic_qty) || 0;
                return subdeptSortDir === 'asc' ? valA - valB : valB - valA;
            } else if (subdeptSortCol === 'target_qty') {
                valA = parseFloat(a.total_physic_target) || 0;
                valB = parseFloat(b.total_physic_target) || 0;
                return subdeptSortDir === 'asc' ? valA - valB : valB - valA;
            } else if (subdeptSortCol === 'pct') {
                valA = (a.has_data && a.total_physic_pct !== null && a.total_physic_pct !== undefined) ? parseFloat(a.total_physic_pct) : -1;
                valB = (b.has_data && b.total_physic_pct !== null && b.total_physic_pct !== undefined) ? parseFloat(b.total_physic_pct) : -1;
                return subdeptSortDir === 'asc' ? valA - valB : valB - valA;
            } else if (subdeptSortCol === 'defisit') {
                valA = (a.has_data && a.total_physic_pct !== null && a.total_physic_pct !== undefined) ? (100 - parseFloat(a.total_physic_pct)) : 999;
                valB = (b.has_data && b.total_physic_pct !== null && b.total_physic_pct !== undefined) ? (100 - parseFloat(b.total_physic_pct)) : 999;
                return subdeptSortDir === 'asc' ? valA - valB : valB - valA;
            } else if (subdeptSortCol === 'status') {
                valA = a._isTercapai ? 1 : 0;
                valB = b._isTercapai ? 1 : 0;
                return subdeptSortDir === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }

    function renderSubdeptCachedRows() {
        loadSubDeptResults();
    }

    function renderSubDeptPieChart(tercapai, tidakTercapai, total, isTarget98 = null) {
        const canvas = document.getElementById('chart-subdept-pie');
        const statsContainer = document.getElementById('subdept-pie-stats');
        if (!canvas) return;

        if (subDeptPieChart) {
            subDeptPieChart.destroy();
            subDeptPieChart = null;
        }

        if (total === 0) {
            const ctx = canvas.getContext('2d');
            subDeptPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Belum Ada Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e2e8f0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    cutout: '68%'
                }
            });
            if (statsContainer) {
                statsContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 0.75rem 0.5rem;">Tidak ada data outlet</div>';
            }
            return;
        }

        const labels = ['Tercapai', 'Tidak Tercapai'];
        const data = [tercapai, tidakTercapai];
        const colors = ['#16a34a', '#dc2626'];

        const ctx = canvas.getContext('2d');
        subDeptPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'],
                onClick: (evt, elements) => {
                    if (elements && elements.length > 0) {
                        const idx = elements[0].index;
                        const target = (idx === 0) ? 'tercapai' : 'tidak_tercapai';
                        toggleSubDeptStatusFilter(target);
                    }
                },
                onHover: (event, chartElement) => {
                    event.native.target.style.cursor = (chartElement && chartElement.length > 0) ? 'pointer' : 'default';
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        onClick: (e, legendItem) => {
                            const text = legendItem.text;
                            const target = (text === 'Tercapai') ? 'tercapai' : 'tidak_tercapai';
                            toggleSubDeptStatusFilter(target);
                        },
                        onHover: (e, legendItem, legend) => {
                            legend.chart.canvas.style.cursor = 'pointer';
                        },
                        labels: {
                            boxWidth: 12,
                            padding: 12,
                            font: {
                                family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                                size: 11,
                                weight: '600'
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = context.raw || 0;
                                const pct = total > 0 ? ((val / total) * 100).toFixed(2) : '0.00';
                                return ` ${context.label}: ${val} sites (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '62%'
            }
        });

        if (statsContainer) {
            const pctTercapai = total > 0 ? ((tercapai / total) * 100).toFixed(2) : '0.00';
            const pctTidak = total > 0 ? ((tidakTercapai / total) * 100).toFixed(2) : '0.00';
            const isCat98 = (isTarget98 !== null)
                ? !!isTarget98
                : (summaryCategory === 'pmd' || summaryCategory === 'warehouse_tekno' || summaryCategory === 'it_coorporate' || summaryCategory === 'it_corporate');
            const thresholdLabel = isCat98 ? '98%' : '85%';
            const statusSel = document.getElementById('status-result-filter');
            const curStatus = statusSel ? statusSel.value : 'all';
            const activeTercapai = (curStatus === 'tercapai') ? ' active' : '';
            const activeTidak = (curStatus === 'tidak_tercapai') ? ' active' : '';
            const activeAll = (curStatus === 'all') ? ' active' : '';

            let statsHtml = `
                <div class="so-pie-stat-row${activeTercapai}" onclick="App.toggleSubDeptStatusFilter('tercapai')">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #16a34a;"></span>
                        Tercapai (≥${thresholdLabel})
                    </span>
                    <span class="so-pie-stat-val" style="color: #16a34a;">
                        ${tercapai} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTercapai}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row${activeTidak}" onclick="App.toggleSubDeptStatusFilter('tidak_tercapai')">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #dc2626;"></span>
                        Tidak Tercapai (<${thresholdLabel})
                    </span>
                    <span class="so-pie-stat-val" style="color: #dc2626;">
                        ${tidakTercapai} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTidak}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row${activeAll}" onclick="App.toggleSubDeptStatusFilter('all')" style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                    <span class="so-pie-stat-label" style="font-weight: 600; color: #1e293b;">
                        Total Sites
                    </span>
                    <span class="so-pie-stat-val" style="font-weight: 700; color: #0f172a;">${total} sites</span>
                </div>
            `;

            statsContainer.innerHTML = statsHtml;
        }
    }

    // ── Trend Line Graphics (DEPT, Sub DEPT, PMD Sub DEPT) ──────

    async function loadTrendCharts(year) {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded yet');
            return;
        }

        Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

        const deptCanvas = document.getElementById('chart-trend-dept');
        const subDeptCanvas = document.getElementById('chart-trend-subdept');
        const subDeptGrid = document.getElementById('trend-subdept-grid');
        const pmdCanvas = document.getElementById('chart-trend-pmd');

        if (!deptCanvas || (!subDeptCanvas && !subDeptGrid) || !pmdCanvas) return;

        const targetYear = year || (document.getElementById('summary-filter-year')?.value) || 2026;

        document.querySelectorAll('.trend-chart-subtitle').forEach(el => {
            el.textContent = (summarySOType === 'monthly')
                ? `Monthly Physical % (Jan - Dec ${targetYear})`
                : `Quarterly Physical % (Q1 - Q4 ${targetYear})`;
        });

        const trendCacheKey = `${summarySOType}_${targetYear}`;

        function applyTrendJsonData(json) {
            if (!json || !json.success) return;
            lastTrendJsonData = json;
            const rawMonths = json.months || (summarySOType === 'quarterly' ? ['Q1', 'Q2', 'Q3', 'Q4'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);

            // Find last month/quarter index that has actual data across all series
            const allSeriesArrays = [];
            if (json.national_trend) allSeriesArrays.push(json.national_trend);
            if (json.dept_trends) Object.values(json.dept_trends).forEach(v => allSeriesArrays.push(v));
            if (json.subdept_trends) Object.values(json.subdept_trends).forEach(v => allSeriesArrays.push(v?.values || v));
            if (json.pmd_subdept_trends) Object.values(json.pmd_subdept_trends).forEach(v => allSeriesArrays.push(v));
            if (json.it_corporate_trend) allSeriesArrays.push(json.it_corporate_trend);
            if (json.it_site_trends) Object.values(json.it_site_trends).forEach(v => allSeriesArrays.push(v));
            if (json.tekno_site_trends) Object.values(json.tekno_site_trends).forEach(v => allSeriesArrays.push(v));

            let maxDataIdx = -1;
            allSeriesArrays.forEach(arr => {
                if (Array.isArray(arr)) {
                    for (let i = arr.length - 1; i >= 0; i--) {
                        if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i])) {
                            if (i > maxDataIdx) maxDataIdx = i;
                            break;
                        }
                    }
                }
            });

            const months = (maxDataIdx >= 0)
                ? rawMonths.slice(0, maxDataIdx + 1)
                : rawMonths;

            const endMonthLabel = months[months.length - 1] || (summarySOType === 'quarterly' ? 'Q4' : 'Dec');
            const startMonthLabel = months[0] || (summarySOType === 'quarterly' ? 'Q1' : 'Jan');
            document.querySelectorAll('.trend-chart-subtitle').forEach(el => {
                el.textContent = (summarySOType === 'monthly')
                    ? `Monthly Physical % (${startMonthLabel} - ${endMonthLabel} ${targetYear})`
                    : `Quarterly Physical % (${startMonthLabel} - ${endMonthLabel} ${targetYear})`;
            });

            // Helper to convert hex color to rgba
            const hexToRgba = (hex, alpha = 0.2) => {
                if (!hex || typeof hex !== 'string') return `rgba(148, 163, 184, ${alpha})`;
                let clean = hex.replace('#', '');
                if (clean.length === 3) {
                    clean = clean.split('').map(c => c + c).join('');
                }
                const r = parseInt(clean.substring(0, 2), 16) || 0;
                const g = parseInt(clean.substring(2, 4), 16) || 0;
                const b = parseInt(clean.substring(4, 6), 16) || 0;
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };

            // Helper to create vertical area linear gradient (matches modern dashboard UI)
            const getAreaGradient = (ctx, chartArea, hexColor, topAlpha = 0.22, bottomAlpha = 0.0) => {
                if (!ctx || !chartArea) return hexToRgba(hexColor, topAlpha);
                try {
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, hexToRgba(hexColor, topAlpha));
                    gradient.addColorStop(1, hexToRgba(hexColor, bottomAlpha));
                    return gradient;
                } catch (e) {
                    return hexToRgba(hexColor, topAlpha);
                }
            };

            // Helper to apply highlight state to a chart
            const applyChartHighlight = (chart, targetIndex) => {
                chart._highlightedIndex = targetIndex;
                chart.data.datasets.forEach((ds, idx) => {
                    const origColor = ds._origBorderColor || ds.borderColor;
                    const meta = chart.getDatasetMeta ? chart.getDatasetMeta(idx) : null;

                    const isDeptChart = (chart === chartTrendDept);
                    if (targetIndex === null || targetIndex === undefined) {
                        // Restored state: all datasets visible with smooth area gradient & clean idle lines (no points)
                        ds.borderColor = origColor;
                        ds.fill = true;
                        ds.borderWidth = ds._origBorderWidth || 2.5;
                        ds.pointRadius = 0;
                        ds.radius = 0;
                        ds.pointHoverRadius = 6;
                        ds.hoverRadius = 6;
                        ds.pointHitRadius = 12;
                        ds.pointHoverBackgroundColor = origColor;
                        ds.pointHoverBorderColor = '#ffffff';
                        ds.pointHoverBorderWidth = 2.5;
                        ds.backgroundColor = function (context) {
                            const c = context.chart;
                            const { ctx, chartArea } = c || {};
                            return getAreaGradient(ctx, chartArea, origColor, isDeptChart ? 0.22 : 0.10, 0.0);
                        };

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = 0;
                                pt.options.hoverRadius = 6;
                                pt.options.hitRadius = 12;
                                pt.options.borderWidth = 2.5;
                                pt.options.backgroundColor = origColor;
                                pt.options.borderColor = '#ffffff';
                            });
                        }
                    } else if (idx === targetIndex) {
                        // Highlighted dataset: focused line with glowing gradient and hover dots
                        ds.borderColor = origColor;
                        ds.fill = true;
                        ds.borderWidth = 3.5;
                        ds.pointRadius = 0;
                        ds.radius = 0;
                        ds.pointHoverRadius = 7;
                        ds.hoverRadius = 7;
                        ds.pointHitRadius = 14;
                        ds.pointHoverBackgroundColor = origColor;
                        ds.pointHoverBorderColor = '#ffffff';
                        ds.pointHoverBorderWidth = 2.5;
                        ds.backgroundColor = function (context) {
                            const c = context.chart;
                            const { ctx, chartArea } = c || {};
                            return getAreaGradient(ctx, chartArea, origColor, 0.28, 0.0);
                        };

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = 0;
                                pt.options.hoverRadius = 7;
                                pt.options.hitRadius = 14;
                                pt.options.borderWidth = 2.5;
                                pt.options.backgroundColor = origColor;
                                pt.options.borderColor = '#ffffff';
                            });
                        }
                    } else {
                        // Other datasets: muted transparent line, no points
                        const dimColor = hexToRgba(origColor, 0.12);
                        ds.borderColor = dimColor;
                        ds.fill = false;
                        ds.backgroundColor = 'transparent';
                        ds.borderWidth = 1;
                        ds.pointRadius = 0;
                        ds.radius = 0;
                        ds.pointHoverRadius = 0;
                        ds.hoverRadius = 0;
                        ds.pointHitRadius = 0;
                        ds.pointBorderWidth = 0;
                        ds.pointBackgroundColor = 'transparent';
                        ds.pointBorderColor = 'transparent';

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = 0;
                                pt.options.hoverRadius = 0;
                                pt.options.hitRadius = 0;
                                pt.options.borderWidth = 0;
                                pt.options.backgroundColor = 'transparent';
                                pt.options.borderColor = 'transparent';
                            });
                        }
                    }
                });
                chart.update('none'); // Instant rendering without stutter
            };

            // Department to Sub-Department mapping for synchronizing line charts
            const DEPT_SUBDEPTS_MAP = {
                'CRO': ['CJDO', 'EKO', 'WJO', 'WKO'],
                'ERO': ['BNO', 'EJO', 'MPO', 'SMO'],
                'WRO': ['CSO', 'NSO', 'SSO'],
                'PMD': ['DNO', 'DSO'],
                'DNO': ['OUTLET BWA BANTEN', 'OUTLET BWA MERUYA', 'OUTLET CDA', 'OUTLET NEA'],
                'DSO': ['OUTLET BDA KELINKIT', 'OUTLET SAST', 'OUTLET SEOA']
            };

            // Helper to sync subdept chart with the selected DEPT group
            const applySubDeptGroupHighlight = (chart, deptKey) => {
                const allowedSubs = deptKey ? (DEPT_SUBDEPTS_MAP[deptKey] || []) : null;

                // Sync individual subdept cards in grid
                const subCards = document.querySelectorAll('.subdept-single-card');
                if (subCards && subCards.length > 0) {
                    subCards.forEach(card => {
                        const titleEl = card.querySelector('h4');
                        const cardText = titleEl ? titleEl.textContent : '';
                        if (!allowedSubs) {
                            card.style.opacity = '1';
                            card.style.borderColor = '#e2e8f0';
                            card.style.boxShadow = '0 1px 3px rgba(15,23,42,0.04)';
                        } else {
                            const isMatch = allowedSubs.some(sub => cardText.includes(sub));
                            if (isMatch) {
                                card.style.opacity = '1';
                                card.style.borderColor = '#2563eb';
                                card.style.boxShadow = '0 4px 12px rgba(37,99,235,0.18)';
                            } else {
                                card.style.opacity = '0.32';
                                card.style.borderColor = '#e2e8f0';
                                card.style.boxShadow = 'none';
                            }
                        }
                    });
                }

                if (chart && chart.data && chart.data.datasets) {
                    chart._activeDeptGroup = deptKey || null;
                const allowedSubs = deptKey ? (DEPT_SUBDEPTS_MAP[deptKey] || []) : null;

                chart.data.datasets.forEach((ds, idx) => {
                    const origColor = ds._origBorderColor || ds.borderColor;
                    const meta = chart.getDatasetMeta ? chart.getDatasetMeta(idx) : null;

                    if (!allowedSubs) {
                        // Restored state: all lines normal with subtle gradient and clean idle lines (no points)
                        ds.borderColor = origColor;
                        ds.fill = true;
                        ds.borderWidth = ds._origBorderWidth || 2;
                        ds.pointRadius = 0;
                        ds.radius = 0;
                        ds.pointHoverRadius = 6;
                        ds.hoverRadius = 6;
                        ds.pointHitRadius = 12;
                        ds.pointHoverBackgroundColor = origColor;
                        ds.pointHoverBorderColor = '#ffffff';
                        ds.pointHoverBorderWidth = 2.5;
                        ds.backgroundColor = function (context) {
                            const c = context.chart;
                            const { ctx, chartArea } = c || {};
                            return getAreaGradient(ctx, chartArea, origColor, 0.10, 0.0);
                        };

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = 0;
                                pt.options.hoverRadius = 6;
                                pt.options.hitRadius = 12;
                                pt.options.borderWidth = 2.5;
                                pt.options.backgroundColor = origColor;
                                pt.options.borderColor = '#ffffff';
                            });
                        }
                    } else if (allowedSubs.includes(ds.label)) {
                        // In the selected DEPT group: emphasized with glowing gradient!
                        ds.borderColor = origColor;
                        ds.fill = true;
                        ds.borderWidth = 3;
                        ds.pointRadius = 0;
                        ds.radius = 0;
                        ds.pointHoverRadius = 6.5;
                        ds.hoverRadius = 6.5;
                        ds.pointHitRadius = 14;
                        ds.pointHoverBackgroundColor = origColor;
                        ds.pointHoverBorderColor = '#ffffff';
                        ds.pointHoverBorderWidth = 2.5;
                        ds.backgroundColor = function (context) {
                            const c = context.chart;
                            const { ctx, chartArea } = c || {};
                            return getAreaGradient(ctx, chartArea, origColor, 0.22, 0.0);
                        };

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = 0;
                                pt.options.hoverRadius = 6.5;
                                pt.options.hitRadius = 14;
                                pt.options.borderWidth = 2.5;
                                pt.options.backgroundColor = origColor;
                                pt.options.borderColor = '#ffffff';
                            });
                        }
                    } else {
                        // Dimmed lines outside the selected DEPT group
                        const dimColor = hexToRgba(origColor, 0.12);
                        ds.borderColor = dimColor;
                        ds.fill = false;
                        ds.backgroundColor = 'transparent';
                        ds.borderWidth = 1;
                        ds.pointRadius = 0;
                        ds.radius = 0;
                        ds.pointHoverRadius = 0;
                        ds.hoverRadius = 0;
                        ds.pointHitRadius = 0;
                        ds.pointBorderWidth = 0;
                        ds.pointBackgroundColor = 'transparent';
                        ds.pointBorderColor = 'transparent';

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = 0;
                                pt.options.hoverRadius = 0;
                                pt.options.hitRadius = 0;
                                pt.options.borderWidth = 0;
                                pt.options.backgroundColor = 'transparent';
                                pt.options.borderColor = 'transparent';
                            });
                        }
                    }
                });

                    chart.update('none');
                }

                // Dynamic Header / Subtitle sync for Sub DEPT chart
                const subBadge = document.getElementById('trend-subdept-badge');
                const subSubtitle = document.getElementById('trend-subdept-subtitle');
                const yearVal = document.getElementById('summary-filter-year')?.value || 2026;
                const endMonthLabel = months[months.length - 1] || (summarySOType === 'quarterly' ? 'Q4' : 'Dec');
                const startMonthLabel = months[0] || (summarySOType === 'quarterly' ? 'Q1' : 'Jan');
                const defaultSubtitle = (summarySOType === 'monthly')
                    ? `Monthly Physical % (${startMonthLabel} - ${endMonthLabel} ${yearVal})`
                    : `Quarterly Physical % (${startMonthLabel} - ${endMonthLabel} ${yearVal})`;

                if (subBadge) {
                    if (deptKey) {
                        subBadge.textContent = `${deptKey} Group`;
                        subBadge.style.background = '#eff6ff';
                        subBadge.style.color = '#2563eb';
                    } else {
                        subBadge.textContent = 'Outlet Regional';
                        subBadge.style.background = '#f0fdf4';
                        subBadge.style.color = '#16a34a';
                    }
                }

                if (subSubtitle) {
                    if (deptKey && allowedSubs) {
                        subSubtitle.innerHTML = `<strong>Menampilkan Sub Dept ${deptKey} (${allowedSubs.join(', ')})</strong> &bull; ${defaultSubtitle}`;
                    } else {
                        subSubtitle.textContent = defaultSubtitle;
                    }
                }
            };

            // Custom Legend onClick for Line Charts: Pin/unpin line highlight
            const onLegendClick = (e, legendItem, legend) => {
                const chart = legend.chart;
                const clickedIndex = legendItem.datasetIndex;

                if (chart._pinnedIndex === clickedIndex) {
                    chart._pinnedIndex = null;
                    applyChartHighlight(chart, null);
                } else {
                    chart._pinnedIndex = clickedIndex;
                    applyChartHighlight(chart, clickedIndex);
                }
            };

            // Dedicated Legend onClick for DEPT Line Chart: Syncs Sub DEPT group!
            const onDeptLegendClick = (e, legendItem, legend) => {
                const chart = legend.chart;
                const clickedIndex = legendItem.datasetIndex;
                const deptLabel = chart.data.datasets[clickedIndex]?.label;

                if (chart._pinnedIndex === clickedIndex) {
                    chart._pinnedIndex = null;
                    applyChartHighlight(chart, null);
                    if (chartTrendSubDept) applySubDeptGroupHighlight(chartTrendSubDept, null);
                    if (chartTrendPmd) applySubDeptGroupHighlight(chartTrendPmd, null);
                } else {
                    chart._pinnedIndex = clickedIndex;
                    applyChartHighlight(chart, clickedIndex);
                    if (chartTrendSubDept) applySubDeptGroupHighlight(chartTrendSubDept, deptLabel);
                    if (chartTrendPmd) applySubDeptGroupHighlight(chartTrendPmd, deptLabel);
                }
            };

            const onDeptLegendHover = (e, legendItem, legend) => {
                legend.chart.canvas.style.cursor = 'pointer';
                const chart = legend.chart;
                if (chart._pinnedIndex === null || chart._pinnedIndex === undefined) {
                    if (chart._highlightedIndex !== legendItem.datasetIndex) {
                        applyChartHighlight(chart, legendItem.datasetIndex);
                        const deptLabel = chart.data.datasets[legendItem.datasetIndex]?.label;
                        if (chartTrendSubDept) applySubDeptGroupHighlight(chartTrendSubDept, deptLabel);
                        if (chartTrendPmd) applySubDeptGroupHighlight(chartTrendPmd, deptLabel);
                    }
                }
            };

            const onDeptLegendLeave = (e, legendItem, legend) => {
                legend.chart.canvas.style.cursor = 'default';
                const chart = legend.chart;
                if (chart._pinnedIndex === null || chart._pinnedIndex === undefined) {
                    applyChartHighlight(chart, null);
                    if (chartTrendSubDept) applySubDeptGroupHighlight(chartTrendSubDept, null);
                    if (chartTrendPmd) applySubDeptGroupHighlight(chartTrendPmd, null);
                }
            };

            // Common Chart Options Builder with Modern Area Gradients, Clean Idle Lines & Crosshair Guideline
            const createChartConfig = (datasets, targetVal = (isPmd ? 98 : 85), isDept = false) => {
                if (datasets && Array.isArray(datasets)) {
                    datasets.forEach(ds => {
                        if (Array.isArray(ds.data) && ds.data.length > months.length) {
                            ds.data = ds.data.slice(0, months.length);
                        }
                        ds.clip = false;
                        ds.fill = true;
                        ds.tension = 0.35;
                        ds.borderWidth = ds.borderWidth || 2.5;
                        ds.pointRadius = 0;
                        ds.radius = 0;
                        ds.pointHoverRadius = 6;
                        ds.hoverRadius = 6;
                        ds.pointHitRadius = 12;

                        const baseColor = ds._origBorderColor || ds.borderColor;
                        const fillAlpha = isDept ? 0.22 : 0.10;
                        ds._fillAlpha = fillAlpha;
                        ds._origBorderColor = baseColor;
                        ds._origBorderWidth = ds.borderWidth;
                        ds._origPointRadius = 0;
                        ds._origPointHoverRadius = 6;

                        ds.pointHoverBackgroundColor = baseColor;
                        ds.pointHoverBorderColor = '#ffffff';
                        ds.pointHoverBorderWidth = 2.5;

                        ds.backgroundColor = function (context) {
                            const c = context.chart;
                            const { ctx, chartArea } = c || {};
                            return getAreaGradient(ctx, chartArea, baseColor, ds._fillAlpha || fillAlpha, 0.0);
                        };
                        ds._origBackgroundColor = ds.backgroundColor;
                    });
                }
                return {
                    type: 'line',
                    data: {
                        labels: months,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'],
                        onClick: (e, elements, chart) => {
                            if (elements && elements.length > 0) {
                                const clickedIndex = elements[0].datasetIndex;
                                const deptLabel = chart.data.datasets[clickedIndex]?.label;
                                if (isDept) {
                                    if (chart._pinnedIndex === clickedIndex) {
                                        chart._pinnedIndex = null;
                                        applyChartHighlight(chart, null);
                                        if (chartTrendSubDept) applySubDeptGroupHighlight(chartTrendSubDept, null);
                                        if (chartTrendPmd) applySubDeptGroupHighlight(chartTrendPmd, null);
                                    } else {
                                        chart._pinnedIndex = clickedIndex;
                                        applyChartHighlight(chart, clickedIndex);
                                        if (chartTrendSubDept) applySubDeptGroupHighlight(chartTrendSubDept, deptLabel);
                                        if (chartTrendPmd) applySubDeptGroupHighlight(chartTrendPmd, deptLabel);
                                    }
                                } else {
                                    if (chart._pinnedIndex === clickedIndex) {
                                        chart._pinnedIndex = null;
                                        applyChartHighlight(chart, null);
                                    } else {
                                        chart._pinnedIndex = clickedIndex;
                                        applyChartHighlight(chart, clickedIndex);
                                    }
                                }
                                return;
                            }

                            // Check if an X-axis month label or tick was clicked
                            try {
                                const canvasPos = Chart.helpers?.getRelativePosition ? Chart.helpers.getRelativePosition(e, chart) : null;
                                if (canvasPos && chart.scales && chart.scales.x) {
                                    const dataX = chart.scales.x.getValueForPixel(canvasPos.x);
                                    if (dataX !== undefined && dataX >= 0 && dataX < months.length) {
                                        const monthIdx = dataX + 1;
                                        const monthSel = document.getElementById('summary-filter-month');
                                        if (monthSel && monthSel.value != monthIdx) {
                                            monthSel.value = String(monthIdx);
                                            loadSummaryData();
                                        }
                                    }
                                }
                            } catch (err) {
                                // Non-critical fallback
                            }
                        },
                        layout: {
                            padding: {
                                top: 12,
                                right: 14,
                                bottom: 6,
                                left: 6
                            }
                        },
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            trendTargetLine: {
                                value: targetVal
                            },
                            legend: {
                                position: 'bottom',
                                onClick: isDept ? onDeptLegendClick : onLegendClick,
                                onHover: isDept ? onDeptLegendHover : (e, legendItem, legend) => {
                                    legend.chart.canvas.style.cursor = 'pointer';
                                    const chart = legend.chart;
                                    if (chart._pinnedIndex === null || chart._pinnedIndex === undefined) {
                                        if (chart._highlightedIndex !== legendItem.datasetIndex) {
                                            applyChartHighlight(chart, legendItem.datasetIndex);
                                        }
                                    }
                                },
                                onLeave: isDept ? onDeptLegendLeave : (e, legendItem, legend) => {
                                    legend.chart.canvas.style.cursor = 'default';
                                    const chart = legend.chart;
                                    if (chart._pinnedIndex === null || chart._pinnedIndex === undefined) {
                                        applyChartHighlight(chart, null);
                                    }
                                },
                                labels: {
                                    boxWidth: 8,
                                    boxHeight: 8,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    padding: 14,
                                    font: { size: 11, weight: '600', family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
                                    generateLabels: function (chart) {
                                        const defaultLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                        defaultLabels.sort((a, b) => a.datasetIndex - b.datasetIndex);

                                        const highlighted = chart._highlightedIndex;
                                        const activeGroup = chart._activeDeptGroup;
                                        const allowedSubs = activeGroup ? (DEPT_SUBDEPTS_MAP[activeGroup] || []) : null;

                                        defaultLabels.forEach((item) => {
                                            item.hidden = false;
                                            const ds = chart.data.datasets[item.datasetIndex];
                                            const origColor = ds ? (ds._origBorderColor || ds.borderColor) : item.strokeStyle;

                                            if (highlighted !== null && highlighted !== undefined) {
                                                if (item.datasetIndex === highlighted) {
                                                    item.fontColor = '#0f172a';
                                                    item.fillStyle = origColor;
                                                    item.strokeStyle = origColor;
                                                } else {
                                                    item.fontColor = '#94a3b8';
                                                    item.fillStyle = hexToRgba(origColor, 0.3);
                                                    item.strokeStyle = hexToRgba(origColor, 0.3);
                                                }
                                            } else if (allowedSubs) {
                                                if (allowedSubs.includes(ds.label)) {
                                                    item.fontColor = '#0f172a';
                                                    item.fillStyle = origColor;
                                                    item.strokeStyle = origColor;
                                                } else {
                                                    item.fontColor = '#cbd5e1';
                                                    item.fillStyle = hexToRgba(origColor, 0.2);
                                                    item.strokeStyle = hexToRgba(origColor, 0.2);
                                                }
                                            } else {
                                                item.fontColor = '#475569';
                                                item.fillStyle = origColor;
                                                item.strokeStyle = origColor;
                                            }
                                        });
                                        return defaultLabels;
                                    }
                                }
                            },
                            tooltip: {
                                backgroundColor: '#ffffff',
                                titleColor: '#0f172a',
                                titleFont: { size: 12, weight: '700', family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
                                bodyColor: '#334155',
                                bodyFont: { size: 11.5, weight: '500', family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
                                borderColor: '#e2e8f0',
                                borderWidth: 1,
                                cornerRadius: 8,
                                padding: 10,
                                boxPadding: 4,
                                usePointStyle: true,
                                displayColors: true,
                                footerColor: '#dc2626',
                                footerFont: { size: 10.5, weight: '600', family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
                                footerMarginTop: 6,
                                filter: function (tooltipItem) {
                                    const chart = tooltipItem.chart;
                                    const highlighted = chart ? chart._highlightedIndex : null;
                                    if (highlighted !== null && highlighted !== undefined) {
                                        return tooltipItem.datasetIndex === highlighted;
                                    }
                                    const activeGroup = chart ? chart._activeDeptGroup : null;
                                    if (activeGroup && DEPT_SUBDEPTS_MAP[activeGroup]) {
                                        const ds = chart.data.datasets[tooltipItem.datasetIndex];
                                        return DEPT_SUBDEPTS_MAP[activeGroup].includes(ds.label);
                                    }
                                    return true;
                                },
                                itemSort: function (a, b) {
                                    const chart = a.chart;
                                    const highlighted = chart ? chart._highlightedIndex : null;
                                    if (highlighted !== null && highlighted !== undefined) {
                                        if (a.datasetIndex === highlighted) return -1;
                                        if (b.datasetIndex === highlighted) return 1;
                                    }
                                    return (b.parsed.y || 0) - (a.parsed.y || 0);
                                },
                                callbacks: {
                                    labelPointStyle: function () {
                                        return {
                                            pointStyle: 'circle',
                                            rotation: 0
                                        };
                                    },
                                    labelColor: function (context) {
                                        const color = context.dataset._origBorderColor || context.dataset.borderColor;
                                        return {
                                            borderColor: color,
                                            backgroundColor: color,
                                            borderWidth: 0
                                        };
                                    },
                                    label: function (context) {
                                        const chart = context.chart;
                                        const highlighted = chart ? chart._highlightedIndex : null;
                                        let label = context.dataset.label || '';
                                        if (label) label += ': ';
                                        if (context.parsed.y !== null && context.parsed.y !== undefined) {
                                            label += Number(context.parsed.y).toFixed(2) + '%';
                                        } else {
                                            label += '-';
                                        }
                                        if (highlighted !== null && highlighted !== undefined && context.datasetIndex === highlighted) {
                                            label = '● ' + label + ' (Focused)';
                                        }
                                        return ' ' + label;
                                    },
                                    footer: function () {
                                        return `Target: ${targetVal}%`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false,
                                    drawBorder: false
                                },
                                border: {
                                    display: false
                                },
                                ticks: {
                                    color: '#64748b',
                                    font: { size: 11, weight: '500', family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }
                                }
                            },
                            y: {
                                min: 0,
                                max: 100,
                                ticks: {
                                    stepSize: 25,
                                    color: '#94a3b8',
                                    font: { size: 10.5, family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
                                    callback: val => val + '%'
                                },
                                grid: {
                                    color: '#f1f5f9',
                                    drawBorder: false
                                },
                                border: {
                                    display: false
                                }
                            }
                        }
                    },
                    plugins: [
                        {
                            id: 'crosshairLinePlugin',
                            afterDatasetsDraw(chart) {
                                let activeElements = [];
                                if (chart.tooltip && typeof chart.tooltip.getActiveElements === 'function') {
                                    activeElements = chart.tooltip.getActiveElements();
                                } else if (typeof chart.getActiveElements === 'function') {
                                    activeElements = chart.getActiveElements();
                                }
                                if (!activeElements || activeElements.length === 0) return;

                                const activePoint = activeElements[0];
                                const { ctx, chartArea } = chart;
                                if (!activePoint || !chartArea) return;

                                const x = activePoint.element ? activePoint.element.x : null;
                                if (x === null || isNaN(x)) return;

                                ctx.save();
                                ctx.beginPath();
                                ctx.setLineDash([3, 3]);
                                ctx.strokeStyle = '#cbd5e1';
                                ctx.lineWidth = 1.2;
                                ctx.moveTo(x, chartArea.top);
                                ctx.lineTo(x, chartArea.bottom);
                                ctx.stroke();
                                ctx.restore();
                            }
                        },
                        {
                            id: 'trendTargetLinePlugin',
                            afterDraw(chart) {
                                const target = chart.config.options?.plugins?.trendTargetLine?.value;
                                if (target === undefined || target === null) return;

                                const { ctx, chartArea, scales: { x, y } } = chart;
                                if (!chartArea || !x || !y) return;

                                const yPixel = y.getPixelForValue(target);
                                if (isNaN(yPixel)) return;

                                ctx.save();

                                // Draw dashed line across the chart width
                                ctx.beginPath();
                                ctx.setLineDash([5, 4]);
                                ctx.strokeStyle = '#dc2626';
                                ctx.lineWidth = 1.5;
                                ctx.moveTo(chartArea.left, yPixel);
                                ctx.lineTo(chartArea.right, yPixel);
                                ctx.stroke();

                                ctx.restore();
                            }
                        }]
                };
            };

            // 1. Render Card 1: DEPT Trends
            const isPmd = (summaryCategory === 'pmd');
            const isIt = (summaryCategory === 'it_coorporate');
            const isTekno = (summaryCategory === 'warehouse_tekno');

            const deptDatasets = [];
            const deptTargetVal = (isPmd || isIt || isTekno) ? 98 : 85;

            if (isIt) {
                const values = json.it_corporate_trend || [];
                deptDatasets.push({
                    label: 'IT Coorporate',
                    data: values,
                    borderColor: '#2563eb',
                    backgroundColor: '#2563eb',
                    _origBorderColor: '#2563eb',
                    _origBackgroundColor: '#2563eb',
                    _origBorderWidth: 3,
                    _origPointRadius: 4,
                    _origPointHoverRadius: 6,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.3,
                    spanGaps: true
                });
            } else if (isTekno) {
                if (summarySOType === 'quarterly') {
                    const teknoQuarterlyColors = {
                        'BUFFER PERANGKAT RUSAK WAREHOUSE T TEKNO': '#2563eb',
                        'STORAGE END OF CYCLE LT.2 WAREHOUSE TEKNO': '#0ea5e9',
                        'STORAGE END OF CYCLE LT.1 WAREHOUSE TEKNO': '#6366f1',
                        'PERSIAPAN PENGUJIAN WAREHOUSE T TEKNO': '#64748b'
                    };
                    const siteData = json.tekno_site_trends || {};
                    for (const [siteLabel, color] of Object.entries(teknoQuarterlyColors)) {
                        const vals = siteData[siteLabel] || [];
                        deptDatasets.push({
                            label: siteLabel,
                            data: vals,
                            borderColor: color,
                            backgroundColor: color,
                            _origBorderColor: color,
                            _origBackgroundColor: color,
                            _origBorderWidth: 2.5,
                            _origPointRadius: 4,
                            _origPointHoverRadius: 6,
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            tension: 0.3,
                            spanGaps: true
                        });
                    }
                } else {
                    const gudangValues = (json.tekno_site_trends && json.tekno_site_trends['GUDANG WAREHOUSE TEKNO']) || [];
                    deptDatasets.push({
                        label: 'GUDANG WAREHOUSE TEKNO',
                        data: gudangValues,
                        borderColor: '#2563eb',
                        backgroundColor: '#2563eb',
                        _origBorderColor: '#2563eb',
                        _origBackgroundColor: '#2563eb',
                        _origBorderWidth: 3,
                        _origPointRadius: 4,
                        _origPointHoverRadius: 6,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.3,
                        spanGaps: true
                    });

                    const khususValues = (json.tekno_site_trends && json.tekno_site_trends['PENYIMPANAN PERANGKAT KHUSUS T TEKNO']) || [];
                    deptDatasets.push({
                        label: 'PENYIMPANAN PERANGKAT KHUSUS T TEKNO',
                        data: khususValues,
                        borderColor: '#6366f1',
                        backgroundColor: '#6366f1',
                        _origBorderColor: '#6366f1',
                        _origBackgroundColor: '#6366f1',
                        _origBorderWidth: 2.5,
                        _origPointRadius: 4,
                        _origPointHoverRadius: 6,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.3,
                        spanGaps: true
                    });
                }
            } else if (isPmd) {
                // Divisi PMD departments: DNO and DSO
                const pmdDeptColors = {
                    'DNO': '#2563eb', // Royal Blue
                    'DSO': '#60a5fa'  // Soft Sky Blue
                };
                for (const [deptKey, color] of Object.entries(pmdDeptColors)) {
                    const values = (json.pmd_subdept_trends && json.pmd_subdept_trends[deptKey])
                        || (json.dept_trends && json.dept_trends[deptKey])
                        || [];
                    deptDatasets.push({
                        label: deptKey,
                        data: values,
                        borderColor: color,
                        backgroundColor: color,
                        _origBorderColor: color,
                        _origBackgroundColor: color,
                        _origBorderWidth: 2.5,
                        _origPointRadius: 4,
                        _origPointHoverRadius: 6,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.3,
                        spanGaps: true
                    });
                }
            } else {
                const deptColors = (summarySOType === 'quarterly'
                    ? { 'ERO': '#6366f1', 'WRO': '#0ea5e9' }
                    : { 'CRO': '#2563eb', 'ERO': '#6366f1', 'WRO': '#0ea5e9' });

                for (const [deptKey, color] of Object.entries(deptColors)) {
                    const values = json.dept_trends ? (json.dept_trends[deptKey] || []) : [];
                    deptDatasets.push({
                        label: deptKey,
                        data: values,
                        borderColor: color,
                        backgroundColor: color,
                        _origBorderColor: color,
                        _origBackgroundColor: color,
                        _origBorderWidth: 2.5,
                        _origPointRadius: 4,
                        _origPointHoverRadius: 6,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.3,
                        spanGaps: true
                    });
                }
            }

            if (chartTrendDept) chartTrendDept.destroy();
            chartTrendDept = new Chart(deptCanvas.getContext('2d'), createChartConfig(deptDatasets, deptTargetVal, true));

            // 2. Render Sub DEPT / Site Trends
            const destroyAllSubDeptCharts = () => {
                if (chartTrendSubDeptList && chartTrendSubDeptList.length > 0) {
                    chartTrendSubDeptList.forEach(c => {
                        try { if (c) c.destroy(); } catch (e) {}
                    });
                    chartTrendSubDeptList = [];
                }
                if (chartTrendSubDept) {
                    try { chartTrendSubDept.destroy(); } catch (e) {}
                    chartTrendSubDept = null;
                }
            };

            if (isIt) {
                destroyAllSubDeptCharts();
                const itSitePalette = {
                    'OUTLET OPTI TBS': '#2563eb',
                    'IT CORPORATE - ARCADIA LT 4': '#60a5fa'
                };
                const gridContainer = document.getElementById('trend-subdept-grid');
                const siteData = json.it_site_trends || {};
                const siteEntries = Object.entries(siteData);

                if (gridContainer) {
                    gridContainer.innerHTML = '';
                    siteEntries.forEach(([siteLabel, values], idx) => {
                        const chartNumber = idx + 1;
                        const canvasId = `chart-subdept-it-${idx}`;
                        const cardDiv = document.createElement('div');
                        cardDiv.className = 'card subdept-single-card';
                        cardDiv.innerHTML = `
                            <h4 style="text-align: center; font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; letter-spacing: 0.2px;">
                                ${siteLabel}
                            </h4>
                            <div style="position: relative; height: 165px; width: 100%;">
                                <canvas id="${canvasId}"></canvas>
                            </div>
                        `;
                        gridContainer.appendChild(cardDiv);

                        const canvasEl = document.getElementById(canvasId);
                        if (canvasEl) {
                            const color = itSitePalette[siteLabel] || '#2563eb';
                            const slicedVals = (values || []).slice(0, months.length);
                            const singleConfig = {
                                type: 'line',
                                data: {
                                    labels: months,
                                    datasets: [{
                                        label: siteLabel,
                                        data: slicedVals,
                                        borderColor: color,
                                        borderWidth: 2.2,
                                        fill: true,
                                        tension: 0.35,
                                        pointRadius: 0,
                                        pointHoverRadius: 5.5,
                                        pointHoverBackgroundColor: color,
                                        pointHoverBorderColor: '#ffffff',
                                        pointHoverBorderWidth: 2,
                                        backgroundColor: function (context) {
                                            const { ctx, chartArea } = context.chart || {};
                                            if (!ctx || !chartArea) return 'rgba(37, 99, 235, 0.2)';
                                            return getAreaGradient(ctx, chartArea, color, 0.28, 0.02);
                                        },
                                        spanGaps: true
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    layout: { padding: { left: 2, right: 6, top: 6, bottom: 2 } },
                                    plugins: { legend: { display: false } },
                                    scales: {
                                        x: { grid: { display: false, drawBorder: false }, border: { display: false }, ticks: { color: '#64748b', font: { size: 9.5 } } },
                                        y: { min: 0, max: 100, ticks: { stepSize: 25, color: '#94a3b8', font: { size: 9 }, callback: v => v + '%' }, grid: { color: '#f1f5f9' }, border: { display: false } }
                                    }
                                }
                            };
                            chartTrendSubDeptList.push(new Chart(canvasEl.getContext('2d'), singleConfig));
                        }
                    });
                }
                if (chartTrendPmd) { chartTrendPmd.destroy(); chartTrendPmd = null; }
            } else if (isTekno) {
                destroyAllSubDeptCharts();
                if (chartTrendPmd) { chartTrendPmd.destroy(); chartTrendPmd = null; }
            } else if (!isPmd) {
                // Render Sub DEPT Trends (Outlet Regional)
                // All sub departments in separate standalone cards in a 4-column responsive grid
                destroyAllSubDeptCharts();

                const csoPaletteColor = '#2563eb'; // Royal Blue (CSO Palette Color)
                const gridContainer = document.getElementById('trend-subdept-grid');
                let subEntries = Object.entries(json.subdept_trends || {});
                if (summaryCategory === 'warehouse_hub') {
                    subEntries = subEntries.filter(([subKey]) => !['CSO', 'BNO', 'MPO', 'SMO'].includes(subKey));
                }

                // Subtitle update
                const subDeptSubtitle = document.getElementById('trend-subdept-subtitle');
                if (subDeptSubtitle) {
                    subDeptSubtitle.textContent = (summarySOType === 'monthly')
                        ? `Monthly Physical % (Jan - Dec ${targetYear}) — ${subEntries.length} Sub Depts`
                        : `Quarterly Physical % (${targetYear}) — ${subEntries.length} Sub Depts`;
                }

                if (gridContainer) {
                    gridContainer.innerHTML = '';
                    subEntries.forEach(([subKey, item], idx) => {
                        const chartNumber = idx + 1;
                        const canvasId = `chart-subdept-${subKey.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;

                        const cardDiv = document.createElement('div');
                        cardDiv.className = 'card subdept-single-card';
                        cardDiv.innerHTML = `
                            <h4 style="text-align: center; font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; letter-spacing: 0.2px;">
                                ${subKey}
                            </h4>
                            <div style="position: relative; height: 165px; width: 100%;">
                                <canvas id="${canvasId}"></canvas>
                            </div>
                        `;
                        gridContainer.appendChild(cardDiv);

                        const canvasEl = document.getElementById(canvasId);
                        if (canvasEl) {
                            const rawVals = item.values || [];
                            const slicedVals = rawVals.slice(0, months.length);

                            const singleConfig = {
                                type: 'line',
                                data: {
                                    labels: months,
                                    datasets: [{
                                        label: subKey,
                                        data: slicedVals,
                                        borderColor: csoPaletteColor,
                                        borderWidth: 2.2,
                                        fill: true,
                                        tension: 0.35,
                                        pointRadius: 0,
                                        pointHoverRadius: 5.5,
                                        pointHoverBackgroundColor: csoPaletteColor,
                                        pointHoverBorderColor: '#ffffff',
                                        pointHoverBorderWidth: 2,
                                        backgroundColor: function (context) {
                                            const { ctx, chartArea } = context.chart || {};
                                            if (!ctx || !chartArea) return 'rgba(37, 99, 235, 0.2)';
                                            return getAreaGradient(ctx, chartArea, csoPaletteColor, 0.28, 0.02);
                                        },
                                        spanGaps: true
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    animation: { duration: 250 },
                                    layout: {
                                        padding: {
                                            left: 2,
                                            right: 6,
                                            top: 6,
                                            bottom: 2
                                        }
                                    },
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            backgroundColor: '#0f172a',
                                            titleColor: '#94a3b8',
                                            bodyColor: '#ffffff',
                                            padding: 8,
                                            cornerRadius: 6,
                                            displayColors: false,
                                            callbacks: {
                                                title: (items) => items[0]?.label || '',
                                                label: (context) => {
                                                    const val = context.parsed.y;
                                                    return ` ${subKey}: ` + (val !== null && val !== undefined ? Number(val).toFixed(2) + '%' : '-');
                                                },
                                                footer: () => 'Target: 85%'
                                            }
                                        }
                                    },
                                    scales: {
                                        x: {
                                            grid: { display: false, drawBorder: false },
                                            border: { display: false },
                                            ticks: {
                                                color: '#64748b',
                                                font: { size: 9.5, weight: '500', family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }
                                            }
                                        },
                                        y: {
                                            min: 0,
                                            max: 100,
                                            ticks: {
                                                stepSize: 25,
                                                color: '#94a3b8',
                                                font: { size: 9, family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
                                                callback: (v) => v + '%'
                                            },
                                            grid: { color: '#f1f5f9', drawBorder: false },
                                            border: { display: false }
                                        }
                                    }
                                },
                                plugins: [
                                    {
                                        id: `subdeptTarget_${subKey}`,
                                        afterDraw(chart) {
                                            const target = 85;
                                            const { ctx, chartArea, scales: { x, y } } = chart;
                                            if (!chartArea || !x || !y) return;

                                            const yPixel = y.getPixelForValue(target);
                                            if (isNaN(yPixel)) return;

                                            ctx.save();
                                            // Red dashed line
                                            ctx.beginPath();
                                            ctx.setLineDash([4, 3]);
                                            ctx.strokeStyle = '#dc2626';
                                            ctx.lineWidth = 1.2;
                                            ctx.moveTo(chartArea.left, yPixel);
                                            ctx.lineTo(chartArea.right, yPixel);
                                            ctx.stroke();
                                            ctx.restore();
                                        }
                                    },
                                    {
                                        id: `subdeptCrosshair_${subKey}`,
                                        afterDatasetsDraw(chart) {
                                            let activeElements = [];
                                            if (chart.tooltip && typeof chart.tooltip.getActiveElements === 'function') {
                                                activeElements = chart.tooltip.getActiveElements();
                                            } else if (typeof chart.getActiveElements === 'function') {
                                                activeElements = chart.getActiveElements();
                                            }
                                            if (!activeElements || activeElements.length === 0) return;
                                            const activePoint = activeElements[0];
                                            const { ctx, chartArea } = chart;
                                            if (!activePoint || !chartArea) return;
                                            const x = activePoint.element ? activePoint.element.x : null;
                                            if (x === null || isNaN(x)) return;

                                            ctx.save();
                                            ctx.beginPath();
                                            ctx.setLineDash([3, 3]);
                                            ctx.strokeStyle = '#cbd5e1';
                                            ctx.lineWidth = 1;
                                            ctx.moveTo(x, chartArea.top);
                                            ctx.lineTo(x, chartArea.bottom);
                                            ctx.stroke();
                                            ctx.restore();
                                        }
                                    }
                                ]
                            };

                            const subChartInst = new Chart(canvasEl.getContext('2d'), singleConfig);
                            chartTrendSubDeptList.push(subChartInst);
                        }
                    });
                }

                if (chartTrendPmd) { chartTrendPmd.destroy(); chartTrendPmd = null; }
            } else {
                destroyAllSubDeptCharts();
                // Render Card 2: PMD Dept Trends (All 7 PMD Sites)
                const pmdSitePalette = {
                    'OUTLET BWA BANTEN': '#2563eb',   // Royal Blue (DNO)
                    'OUTLET BWA MERUYA': '#3b82f6',   // Vivid Blue (DNO)
                    'OUTLET CDA': '#60a5fa',          // Sky Blue (DNO)
                    'OUTLET NEA': '#0284c7',          // Ocean Blue (DNO)
                    'OUTLET BDA KELINKIT': '#4338ca', // Deep Indigo (DSO)
                    'OUTLET SAST': '#6366f1',         // Indigo (DSO)
                    'OUTLET SEOA': '#818cf8'          // Soft Indigo (DSO)
                };

                const pmdSiteSelect = document.getElementById('trend-pmd-site-filter');
                const siteData = json.pmd_site_trends || {};
                const siteEntries = Object.entries(siteData);

                if (pmdSiteSelect) {
                    const sel = currentTrendPmdSiteFilter || 'all';
                    let optHtml = `<option value="all"${sel === 'all' ? ' selected' : ''}>Semua Site (7 Sites)</option>`;
                    siteEntries.forEach(([siteName]) => {
                        optHtml += `<option value="${siteName}"${siteName === sel ? ' selected' : ''}>${siteName}</option>`;
                    });
                    pmdSiteSelect.innerHTML = optHtml;
                }

                // Subtitle update
                const pmdSubtitle = document.getElementById('trend-pmd-subtitle');
                if (pmdSubtitle) {
                    const isAll = (currentTrendPmdSiteFilter === 'all');
                    const siteLabel = isAll ? ' — 7 Sites' : ` — ${currentTrendPmdSiteFilter}`;
                    pmdSubtitle.textContent = `Monthly Physical % (Jan - Dec ${targetYear})${siteLabel}`;
                }

                let entriesToPlot = siteEntries;
                if (currentTrendPmdSiteFilter && currentTrendPmdSiteFilter !== 'all') {
                    entriesToPlot = siteEntries.filter(([name]) => name === currentTrendPmdSiteFilter);
                }

                const pmdDatasets = [];
                entriesToPlot.forEach(([siteLabel, values]) => {
                    const color = pmdSitePalette[siteLabel] || '#2563eb';
                    pmdDatasets.push({
                        label: siteLabel,
                        data: values || [],
                        borderColor: color,
                        backgroundColor: color,
                        _origBorderColor: color,
                        _origBackgroundColor: color,
                        _origBorderWidth: 2.4,
                        _origPointRadius: (entriesToPlot.length === 1 ? 4 : 2),
                        _origPointHoverRadius: 6,
                        borderWidth: 2.4,
                        pointRadius: (entriesToPlot.length === 1 ? 4 : 0),
                        pointHoverRadius: 6,
                        tension: 0.3,
                        spanGaps: true
                    });
                });

                if (chartTrendPmd) chartTrendPmd.destroy();
                chartTrendPmd = new Chart(pmdCanvas.getContext('2d'), createChartConfig(pmdDatasets, 98));
                if (chartTrendSubDept) { chartTrendSubDept.destroy(); chartTrendSubDept = null; }
            }

            setTimeout(() => {
                if (chartTrendDept) chartTrendDept.resize();
                if (chartTrendSubDept) chartTrendSubDept.resize();
                if (chartTrendSubDeptList && chartTrendSubDeptList.length > 0) {
                    chartTrendSubDeptList.forEach(c => { if (c) c.resize(); });
                }
                if (chartTrendPmd) chartTrendPmd.resize();
            }, 50);
        }

        // ── 0ms Instant Cache Render ──
        if (trendChartsCache.has(trendCacheKey)) {
            applyTrendJsonData(trendChartsCache.get(trendCacheKey));
        }

        try {
            const res = await fetch(`api/rekapitulasi.php?action=trends&year=${targetYear}&so_type=${summarySOType}`);
            const json = await res.json();
            if (!json.success) {
                console.error('Failed to load trend data:', json.message);
                return;
            }
            trendChartsCache.set(trendCacheKey, json);
            applyTrendJsonData(json);
        } catch (err) {
            console.error('Error rendering trend charts:', err);
        }
    }

    // ── Rekapitulasi 2026 Section ────────────────────────────────

    function getRekapCategory() {
        if (summarySOType === 'quarterly') {
            if (summaryCategory === 'warehouse_tekno') {
                return 'quarterly_tekno';
            }
            if (summaryCategory === 'warehouse_hub') {
                return 'quarterly_warehouse';
            }
            return 'quarterly_subarep';
        }
        if (summaryCategory === 'warehouse_tekno') {
            return 'monthly_tekno';
        }
        if (summaryCategory === 'warehouse_hub') {
            return 'monthly_warehouse';
        }
        if (summaryCategory === 'it_coorporate') {
            return 'monthly_it_coorporate';
        }
        return `monthly_${summaryCategory}`;
    }

    function switchRekapLevel1(level) {
        // Kept for backward compatibility
        rekapLevel1 = 'monthly';
        loadRekapitulasi();
    }

    function switchRekapLevel2(level) {
        rekapLevel2 = level;
        summaryCategory = level;

        try {
            sessionStorage.setItem('summary_category', level);
        } catch (e) { }

        document.querySelectorAll('.rekap-tab-l2').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-rekap-l2') === level);
        });

        const btnOutlet = document.getElementById('btn-summary-cat-outlet');
        const btnPmd = document.getElementById('btn-summary-cat-pmd');
        if (btnOutlet && btnPmd) {
            btnOutlet.classList.toggle('active', level === 'outlet');
            btnPmd.classList.toggle('active', level === 'pmd');
        }

        rekapSearchQuery = '';
        rekapDeptFilter = 'all';
        rekapSubDeptFilter = 'all';
        const searchInput = document.getElementById('rekap-search-input');
        if (searchInput) searchInput.value = '';
        rekapCurrentPage = 1;
        loadRekapitulasi();
    }

    async function loadRekapitulasi() {
        const yearSelect = document.getElementById('summary-filter-year');
        if (yearSelect && yearSelect.value) {
            rekapYear = parseInt(yearSelect.value, 10) || 2026;
        }

        const titleEl = document.getElementById('rekap-card-title');
        if (titleEl) {
            titleEl.textContent = `Rekapitulasi ${rekapYear}`;
        }
        const subtitleEl = document.getElementById('rekap-card-subtitle');
        if (subtitleEl) {
            let catLabel = 'Outlet Regional';
            if (summaryCategory === 'pmd') catLabel = 'PMD';
            else if (summaryCategory === 'outlet_subarep') catLabel = 'Outlet Subarep';
            else if (summaryCategory === 'warehouse_hub') catLabel = 'Warehouse HUB';
            else if (summaryCategory === 'warehouse_tekno') catLabel = 'Warehouse Tekno';
            else if (summaryCategory === 'it_coorporate') catLabel = 'IT Coorporate';
            const typeLabel = summarySOType === 'quarterly' ? 'Quarterly' : 'Monthly';
            subtitleEl.textContent = `Persentase ${typeLabel} Stock Opname ${catLabel}`;
        }

        const tbody = document.getElementById('rekap-table-body');
        if (!tbody) return;

        const category = getRekapCategory();
        const rekapCacheKey = `${category}_${rekapYear}`;

        function applyRekapJsonData(json) {
            allRekapRows = json.data || [];
            rekapMonthAverages = json.month_averages || {};
            populateRekapDeptAndSubDeptDropdowns();
            applyRekapFilterAndRender();
        }

        // ── 0ms Instant Cache Render ──
        if (rekapDataCache.has(rekapCacheKey)) {
            applyRekapJsonData(rekapDataCache.get(rekapCacheKey));
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="17" class="text-center" style="padding: 2.5rem; color: #64748b;">
                        Loading Rekapitulasi ${rekapYear} records...
                    </td>
                </tr>
            `;
        }

        try {
            const res = await fetch(`api/rekapitulasi.php?category=${category}&year=${rekapYear}`);
            const json = await res.json();

            if (!json.success) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="17" class="text-center" style="padding: 2rem; color: #dc2626;">
                            Failed to load Rekapitulasi data: ${escapeHtml(json.message || 'Unknown error')}
                        </td>
                    </tr>
                `;
                return;
            }

            rekapDataCache.set(rekapCacheKey, json);
            applyRekapJsonData(json);
            loadTrendCharts(rekapYear);

        } catch (err) {
            console.error('Error loading Rekapitulasi data:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="17" class="text-center" style="padding: 2rem; color: #dc2626;">
                        Network error while loading Rekapitulasi data.
                    </td>
                </tr>
            `;
        }
    }

    function populateRekapDeptAndSubDeptDropdowns() {
        const deptSelect = document.getElementById('rekap-dept-filter');
        const subDeptSelect = document.getElementById('rekap-subdept-filter');
        const deptLabel = document.getElementById('label-rekap-dept-filter');
        const subDeptLabel = document.getElementById('label-rekap-subdept-filter');
        const thDept = document.getElementById('rekap-th-dept');
        const thSubDept = document.getElementById('rekap-th-subdept');

        const isPmd = (summaryCategory === 'pmd');
        if (deptLabel) deptLabel.textContent = isPmd ? 'DIVISI' : 'DEPT';
        if (subDeptLabel) subDeptLabel.textContent = isPmd ? 'DEPT' : 'SUB DEPT';
        if (thDept) thDept.textContent = isPmd ? 'DIVISI' : 'DEPT';
        if (thSubDept) thSubDept.textContent = isPmd ? 'DEPT' : 'SUB DEPT';

        if (!deptSelect || !subDeptSelect) return;

        const deptSet = new Set();
        allRekapRows.forEach(r => {
            const d = (r.dept || '').trim().toUpperCase();
            if (d) deptSet.add(d);
        });

        const currentDept = deptSelect.value || rekapDeptFilter || 'all';
        const defaultAllDept = isPmd ? 'Semua Divisi' : 'Semua DEPT';
        let deptHtml = `<option value="all">${defaultAllDept}</option>`;
        Array.from(deptSet).sort().forEach(d => {
            deptHtml += `<option value="${d}">${d}</option>`;
        });
        deptSelect.innerHTML = deptHtml;

        if (deptSet.has(currentDept)) {
            deptSelect.value = currentDept;
            rekapDeptFilter = currentDept;
        } else {
            deptSelect.value = 'all';
            rekapDeptFilter = 'all';
        }

        updateRekapSubDeptOptions();
    }

    function updateRekapSubDeptOptions() {
        const deptSelect = document.getElementById('rekap-dept-filter');
        const subDeptSelect = document.getElementById('rekap-subdept-filter');
        if (!subDeptSelect) return;

        const isPmd = (summaryCategory === 'pmd');
        const selectedDept = deptSelect ? deptSelect.value : 'all';
        const currentSub = subDeptSelect.value || rekapSubDeptFilter || 'all';

        const subSet = new Set();
        allRekapRows.forEach(r => {
            const d = (r.dept || '').trim().toUpperCase();
            const s = (r.sub_dept || '').trim().toUpperCase();
            if (s) {
                if (selectedDept === 'all' || d === selectedDept) {
                    subSet.add(s);
                }
            }
        });

        const defaultAllSub = isPmd ? 'Semua Dept' : 'Semua Sub Dept';
        let subHtml = `<option value="all">${defaultAllSub}</option>`;
        Array.from(subSet).sort().forEach(s => {
            subHtml += `<option value="${s}">${s}</option>`;
        });
        subDeptSelect.innerHTML = subHtml;

        if (subSet.has(currentSub)) {
            subDeptSelect.value = currentSub;
            rekapSubDeptFilter = currentSub;
        } else {
            subDeptSelect.value = 'all';
            rekapSubDeptFilter = 'all';
        }
    }

    function onRekapDeptFilterChange() {
        const deptSelect = document.getElementById('rekap-dept-filter');
        rekapDeptFilter = deptSelect ? deptSelect.value : 'all';
        updateRekapSubDeptOptions();
        const subDeptSelect = document.getElementById('rekap-subdept-filter');
        rekapSubDeptFilter = subDeptSelect ? subDeptSelect.value : 'all';
        rekapCurrentPage = 1;
        applyRekapFilterAndRender();
    }

    function onRekapSubDeptFilterChange() {
        const subDeptSelect = document.getElementById('rekap-subdept-filter');
        rekapSubDeptFilter = subDeptSelect ? subDeptSelect.value : 'all';
        rekapCurrentPage = 1;
        applyRekapFilterAndRender();
    }

    function changeRekapPageSize(size) {
        rekapPageSize = size === 'all' ? 0 : parseInt(size, 10);
        rekapCurrentPage = 1;
        renderRekapTable();
    }

    function handleRekapSearch(val) {
        rekapSearchQuery = (val || '').toLowerCase().trim();
        rekapCurrentPage = 1;
        applyRekapFilterAndRender();
    }

    function toggleRekapSort(col) {
        if (rekapSortCol === col) {
            rekapSortDir = rekapSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            rekapSortCol = col;
            rekapSortDir = 'asc';
        }
        applyRekapFilterAndRender();
        updateRekapSortIndicators();
    }

    function updateRekapSortIndicators() {
        document.querySelectorAll('#rekap-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#rekap-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (rekapSortCol) {
            const activeTh = document.querySelector(`#rekap-table th.sortable[onclick*="'${rekapSortCol}'"]`);
            if (activeTh) {
                activeTh.classList.add(rekapSortDir);
            }
            const activeInd = document.querySelector(`#rekap-table .sort-indicator[data-rekap-col="${rekapSortCol}"]`);
            if (activeInd) {
                activeInd.textContent = rekapSortDir === 'asc' ? '▲' : '▼';
            }
        }
    }

    function applyRekapFilterAndRender() {
        let rows = [...allRekapRows];

        if (rekapDeptFilter && rekapDeptFilter !== 'all') {
            rows = rows.filter(r => (r.dept || '').trim().toUpperCase() === rekapDeptFilter.toUpperCase());
        }

        if (rekapSubDeptFilter && rekapSubDeptFilter !== 'all') {
            rows = rows.filter(r => (r.sub_dept || '').trim().toUpperCase() === rekapSubDeptFilter.toUpperCase());
        }

        if (rekapSearchQuery) {
            rows = rows.filter(r => {
                const reg = (r.regional || '').toLowerCase();
                const dept = (r.dept || '').toLowerCase();
                const sub = (r.sub_dept || '').toLowerCase();
                const code = (r.sitecode || '').toLowerCase();
                const name = (r.name_site || '').toLowerCase();
                return reg.includes(rekapSearchQuery) ||
                    dept.includes(rekapSearchQuery) ||
                    sub.includes(rekapSearchQuery) ||
                    code.includes(rekapSearchQuery) ||
                    name.includes(rekapSearchQuery);
            });
        }

        if (rekapSortCol) {
            rows.sort((a, b) => {
                let valA, valB;
                if (rekapSortCol.startsWith('m')) {
                    const mNum = parseInt(rekapSortCol.substring(1), 10);
                    valA = a.months && a.months[mNum] !== null && a.months[mNum] !== undefined ? parseFloat(a.months[mNum]) : -1;
                    valB = b.months && b.months[mNum] !== null && b.months[mNum] !== undefined ? parseFloat(b.months[mNum]) : -1;
                    return rekapSortDir === 'asc' ? valA - valB : valB - valA;
                } else {
                    valA = (a[rekapSortCol] || '').toString();
                    valB = (b[rekapSortCol] || '').toString();
                    return rekapSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                }
            });
        }

        filteredRekapRows = rows;
        renderRekapTable();
    }


    const REKAP_MONTH_NAMES = ['', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const REKAP_QUARTER_LABELS = { 3: 'Q1 (MAR)', 6: 'Q2 (JUN)', 9: 'Q3 (SEP)', 12: 'Q4 (DEC)' };

    // Show only the visible month columns in the Rekapitulasi header
    function updateRekapMonthHeaders(visibleMonths, isQuarterly) {
        for (let m = 1; m <= 12; m++) {
            const th = document.querySelector(`#rekap-table th.sortable[onclick*="'m${m}'"]`);
            if (!th) continue;
            const visible = visibleMonths.includes(m);
            th.style.display = visible ? '' : 'none';
            if (visible) {
                const label = isQuarterly ? REKAP_QUARTER_LABELS[m] : REKAP_MONTH_NAMES[m];
                const ind = th.querySelector('.sort-indicator');
                const indText = ind ? ind.textContent : '⇅';
                th.innerHTML = `${label} <span class="sort-indicator" data-rekap-col="m${m}">${indText}</span>`;
            }
        }
    }

    function formatPctBadge(val, isPmd = false) {
        if (val === null || val === undefined) {
            return '<span class="pct-none">-</span>';
        }
        const num = parseFloat(val);
        const cls = getPctClass(num, isPmd);
        return `<span class="pct-badge ${cls}">${num.toFixed(2)}%</span>`;
    }

    function renderRekapTable() {
        const tbody = document.getElementById('rekap-table-body');
        const tfoot = document.getElementById('rekap-table-foot');
        const infoEl = document.getElementById('rekap-pagination-info');
        const controlsEl = document.getElementById('rekap-pagination-controls');
        if (!tbody) return;

        const isQuarterlyRekap = (summarySOType === 'quarterly');
        const noDept = (summaryCategory === 'it_coorporate' || summaryCategory === 'warehouse_tekno');
        const thDeptCol = document.getElementById('rekap-th-dept-col');
        const thSubDeptCol = document.getElementById('rekap-th-subdept-col');
        if (thDeptCol) thDeptCol.style.display = noDept ? 'none' : '';
        if (thSubDeptCol) thSubDeptCol.style.display = noDept ? 'none' : '';

        const filterDeptCont = document.getElementById('rekap-dept-filter-container');
        const filterSubDeptCont = document.getElementById('rekap-subdept-filter-container');
        if (filterDeptCont) filterDeptCont.style.display = noDept ? 'none' : 'flex';
        if (filterSubDeptCont) filterSubDeptCont.style.display = noDept ? 'none' : 'flex';

        const totalItems = filteredRekapRows.length;

        if (totalItems === 0) {
            const emptyColspan = isQuarterlyRekap ? (noDept ? 6 : 8) : (noDept ? 14 : 16);
            tbody.innerHTML = `
                <tr>
                    <td colspan="${emptyColspan}" class="text-center" style="padding: 2.5rem; color: #64748b;">
                        ${allRekapRows.length === 0 ? "No data in this category." : "No matching data found."}
                    </td>
                </tr>
            `;
            if (tfoot) tfoot.innerHTML = '';
            renderRekapAverageChart([], isQuarterlyRekap, (summaryCategory === 'pmd' || rekapLevel2 === 'pmd'));
            if (infoEl) infoEl.textContent = 'Showing 0 to 0 of 0 entries';
            if (controlsEl) controlsEl.innerHTML = '';
            return;
        }

        const isPmdCategory = (summaryCategory === 'pmd' || rekapLevel2 === 'pmd');
        const effectiveSize = rekapPageSize > 0 ? rekapPageSize : totalItems;
        const totalPages = Math.ceil(totalItems / effectiveSize) || 1;
        if (rekapCurrentPage > totalPages) rekapCurrentPage = totalPages;

        const startIndex = (rekapCurrentPage - 1) * effectiveSize;
        const endIndex = Math.min(startIndex + effectiveSize, totalItems);
        const pageRows = filteredRekapRows.slice(startIndex, endIndex);

        const visibleMonths = isQuarterlyRekap ? [3, 6, 9, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        updateRekapMonthHeaders(visibleMonths, isQuarterlyRekap);

        let html = '';
        pageRows.forEach(row => {
            const monthCells = visibleMonths
                .map(m => `<td class="text-center">${formatPctBadge(row.months ? row.months[m] : null, isPmdCategory)}</td>`)
                .join('');
            const deptColsHtml = noDept ? '' : `
                <td class="text-left">${escapeHtml(row.dept)}</td>
                <td class="text-left">${escapeHtml(row.sub_dept)}</td>
            `;
            html += `
                <tr>
                    ${deptColsHtml}
                    <td class="text-center font-monospace">${escapeHtml(row.sitecode)}</td>
                    <td class="text-left" style="font-weight: 500; text-align: left;">${escapeHtml(row.name_site)}</td>
                    ${monthCells}
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // Render Footer (Average per month)
        const monthlyChartData = [];
        const MONTH_NAMES_SHORT = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
        if (tfoot) {
            let footHtml = `
                <tr>
                    <td colspan="${noDept ? 2 : 4}" class="text-left" style="padding: 8px 12px; font-size: 12px; letter-spacing: 0.03em;">
                        AVERAGE TOTAL PHYSICAL % (${totalItems} SITES)
                    </td>
            `;
            const isFiltered = (rekapDeptFilter !== 'all' || rekapSubDeptFilter !== 'all' || Boolean(rekapSearchQuery));
            for (const m of visibleMonths) {
                let avg = null;
                let count = 0;
                let sum = 0;
                if (isFiltered) {
                    filteredRekapRows.forEach(r => {
                        if (r.months && r.months[m] !== null && r.months[m] !== undefined && r.months[m] !== '') {
                            sum += parseFloat(r.months[m]);
                            count++;
                        }
                    });
                    avg = count > 0 ? (sum / count) : null;
                } else {
                    avg = rekapMonthAverages ? rekapMonthAverages[m] : null;
                    filteredRekapRows.forEach(r => {
                        if (r.months && r.months[m] !== null && r.months[m] !== undefined && r.months[m] !== '') {
                            count++;
                        }
                    });
                }
                const label = isQuarterlyRekap
                    ? ({ 3: 'Q1 (MAR)', 6: 'Q2 (JUN)', 9: 'Q3 (SEP)', 12: 'Q4 (DEC)' }[m] || `M${m}`)
                    : (MONTH_NAMES_SHORT[m] || `M${m}`);

                monthlyChartData.push({
                    month: m,
                    label: label,
                    avg: avg !== null ? parseFloat(avg) : null,
                    count: count,
                    total: totalItems
                });
                footHtml += `<td class="text-center" style="padding: 8px 6px;">${formatPctBadge(avg, isPmdCategory)}</td>`;
            }
            footHtml += '</tr>';
            tfoot.innerHTML = footHtml;
        }

        renderRekapAverageChart(monthlyChartData, isQuarterlyRekap, isPmdCategory);

        // Update info text
        if (infoEl) {
            infoEl.textContent = `Menampilkan ${totalItems > 0 ? (startIndex + 1).toLocaleString('id-ID') : 0} sampai ${endIndex.toLocaleString('id-ID')} dari ${totalItems.toLocaleString('id-ID')} data`;
        }

        // Generate pagination controls
        if (controlsEl) {
            if (totalPages <= 1 || rekapPageSize === 0) {
                controlsEl.innerHTML = '';
            } else {
                let btnsHtml = '';
                btnsHtml += `<button class="pagination-btn" ${rekapCurrentPage === 1 ? 'disabled' : ''} onclick="App.goToRekapPage(${rekapCurrentPage - 1})">&laquo; Prev</button>`;

                const maxButtons = 5;
                let startPage = Math.max(1, rekapCurrentPage - Math.floor(maxButtons / 2));
                let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                if (endPage - startPage + 1 < maxButtons) {
                    startPage = Math.max(1, endPage - maxButtons + 1);
                }

                if (startPage > 1) {
                    btnsHtml += `<button class="pagination-btn" onclick="App.goToRekapPage(1)">1</button>`;
                    if (startPage > 2) btnsHtml += `<span class="pagination-ellipsis">...</span>`;
                }

                for (let p = startPage; p <= endPage; p++) {
                    btnsHtml += `<button class="pagination-btn ${p === rekapCurrentPage ? 'active' : ''}" onclick="App.goToRekapPage(${p})">${p}</button>`;
                }

                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) btnsHtml += `<span class="pagination-ellipsis">...</span>`;
                    btnsHtml += `<button class="pagination-btn" onclick="App.goToRekapPage(${totalPages})">${totalPages}</button>`;
                }

                btnsHtml += `<button class="pagination-btn" ${rekapCurrentPage === totalPages ? 'disabled' : ''} onclick="App.goToRekapPage(${rekapCurrentPage + 1})">Next &raquo;</button>`;

                controlsEl.innerHTML = btnsHtml;
            }
        }
    }


    function renderRekapAverageChart(monthlyData, isQuarterly, isPmdCategory) {
        const canvas = document.getElementById('chart-rekap-average');
        if (!canvas) return;

        if (chartRekapAverage) {
            chartRekapAverage.destroy();
            chartRekapAverage = null;
        }

        const isTarget98 = (isPmdCategory || summaryCategory === 'pmd' || summaryCategory === 'warehouse_tekno' || summaryCategory === 'it_coorporate');
        const targetVal = isTarget98 ? 98 : 85;

        const chartTitleEl = document.getElementById('rekap-chart-title');
        const isQ = (isQuarterly || summarySOType === 'quarterly');
        const prefix = isQ ? 'Quarterly' : 'Monthly';
        if (chartTitleEl) chartTitleEl.textContent = `${prefix} Target Achievement ${rekapYear}`;

        const chartBadgeEl = document.getElementById('rekap-chart-badge');
        if (chartBadgeEl) {
            let badgeText = 'Outlet Regional';
            let badgeBg = '#f0fdf4';
            let badgeFg = '#16a34a';
            if (summaryCategory === 'pmd' || rekapLevel2 === 'pmd') {
                badgeText = 'PMD';
                badgeBg = '#faf5ff';
                badgeFg = '#9333ea';
            } else if (summaryCategory === 'outlet_subarep') {
                badgeText = 'Outlet Subarep';
                badgeBg = '#f0fdf4';
                badgeFg = '#16a34a';
            } else if (summaryCategory === 'warehouse_hub') {
                badgeText = 'Warehouse HUB';
                badgeBg = '#eff6ff';
                badgeFg = '#2563eb';
            } else if (summaryCategory === 'warehouse_tekno') {
                badgeText = 'Warehouse Tekno';
                badgeBg = '#fff7ed';
                badgeFg = '#c2410c';
            } else if (summaryCategory === 'it_coorporate') {
                badgeText = 'IT Corporate';
                badgeBg = '#f5f3ff';
                badgeFg = '#7c3aed';
            }
            chartBadgeEl.textContent = badgeText;
            chartBadgeEl.style.background = badgeBg;
            chartBadgeEl.style.color = badgeFg;
        }

        const chartSubtitleEl = document.getElementById('rekap-chart-subtitle');
        if (chartSubtitleEl) {
            const typeLabel = isQuarterly ? 'Quarter' : 'Bulan';
            const totalSites = (monthlyData && monthlyData[0]) ? monthlyData[0].total : filteredRekapRows.length;
            chartSubtitleEl.textContent = `Rata-rata persentase pencapaian fisik per ${typeLabel} (${totalSites.toLocaleString('id-ID')} Sites)`;
        }

        if (!monthlyData || monthlyData.length === 0) return;

        // Truncate future months/quarters with no data up to the last month/quarter that has data
        let lastDataIdx = -1;
        for (let i = monthlyData.length - 1; i >= 0; i--) {
            const d = monthlyData[i];
            if (d && d.avg !== null && d.avg !== undefined && !isNaN(d.avg) && d.count > 0) {
                lastDataIdx = i;
                break;
            }
        }
        const activeMonthlyData = (lastDataIdx >= 0) ? monthlyData.slice(0, lastDataIdx + 1) : monthlyData;

        const labels = activeMonthlyData.map(d => d.label);
        const dataValues = activeMonthlyData.map(d => d.avg !== null ? Number(d.avg.toFixed(2)) : null);

        const bgColors = activeMonthlyData.map(d => {
            if (d.avg === null) return 'rgba(203, 213, 225, 0.45)';
            if (isTarget98) {
                return d.avg >= 98 ? '#16a34a' : '#dc2626';
            } else {
                if (d.avg >= 85) return '#16a34a';
                if (d.avg >= 75) return '#ea580c';
                return '#dc2626';
            }
        });

        const borderColors = activeMonthlyData.map(d => {
            if (d.avg === null) return '#cbd5e1';
            if (isTarget98) {
                return d.avg >= 98 ? '#15803d' : '#b91c1c';
            } else {
                if (d.avg >= 85) return '#15803d';
                if (d.avg >= 75) return '#c2410c';
                return '#b91c1c';
            }
        });

        // Bottom value label plugin (crisp, solid font with 2 decimals anchored at bottom)
        const valueBottomPlugin = {
            id: 'rekapValueBottomPlugin',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (meta.hidden) return;

                    meta.data.forEach((barElement, index) => {
                        const rawVal = dataset.data[index];
                        if (rawVal === null || rawVal === undefined || isNaN(rawVal)) return;

                        const text = `${Number(rawVal).toFixed(2)}%`;
                        const { x, y, base } = barElement;
                        const barHeight = Math.abs(base - y);
                        const bWidth = barElement.width || 30;

                        ctx.save();
                        ctx.font = '700 10px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

                        const textWidth = ctx.measureText(text).width;

                        if (barHeight >= 20) {
                            ctx.fillStyle = '#ffffff';
                            if (bWidth >= textWidth - 2) {
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                ctx.fillText(text, x, base - 8);
                            } else {
                                ctx.translate(x, base - 8);
                                ctx.rotate(-Math.PI / 2);
                                ctx.textAlign = 'left';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(text, 0, 0);
                            }
                        } else if (barHeight > 0) {
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillStyle = '#475569';
                            ctx.fillText(text, x, y - 3);
                        } else {
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillStyle = '#94a3b8';
                            ctx.fillText(text, x, base - 3);
                        }
                        ctx.restore();
                    });
                });
            }
        };

        // Dashed Target Line Plugin
        const targetLinePlugin = {
            id: 'rekapTargetLinePlugin',
            afterDraw(chart) {
                const { ctx, chartArea, scales: { y } } = chart;
                if (!chartArea || !y) return;

                const yPixel = y.getPixelForValue(targetVal);
                if (isNaN(yPixel)) return;

                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([5, 4]);
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 1.5;
                ctx.moveTo(chartArea.left, yPixel);
                ctx.lineTo(chartArea.right, yPixel);
                ctx.stroke();

                const text = `TARGET ${targetVal}%`;
                ctx.setLineDash([]);
                ctx.font = '700 10px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                const textWidth = ctx.measureText(text).width;
                const padX = 6;
                const badgeWidth = textWidth + padX * 2;
                const badgeHeight = 17;
                const badgeX = Math.min(chartArea.right + 6, chart.width - badgeWidth - 4);
                const badgeY = yPixel - badgeHeight / 2;

                ctx.fillStyle = '#dc2626';
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
                    ctx.fill();
                } else {
                    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
                }

                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, badgeX + badgeWidth / 2, yPixel);
                ctx.restore();
            }
        };
                ctx.restore();
         
        const ctx = canvas.getContext('2d');
        chartRekapAverage = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rata-rata Fisik (%)',
                    data: dataValues,
                    backgroundColor: bgColors,
                    borderColor: 'transparent',
                    borderWidth: 0,
                    borderRadius: {
                        topLeft: 6,
                        topRight: 6,
                        bottomLeft: 0,
                        bottomRight: 0
                    },
                    borderSkipped: 'bottom',
                    barPercentage: 0.54,
                    categoryPercentage: 0.78,
                    maxBarThickness: 34
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 24,
                        right: 80,
                        bottom: 6,
                        left: 8
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            callback: val => `${val}%`,
                            color: '#94a3b8',
                            font: { size: 11, family: 'Inter, -apple-system, sans-serif' }
                        },
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        border: {
                            display: false
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 11, weight: '500', family: 'Inter, -apple-system, sans-serif' },
                            color: '#475569'
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        border: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleFont: { size: 12, weight: '700', family: 'Inter, -apple-system, sans-serif' },
                        bodyFont: { size: 11.5, weight: '500', family: 'Inter, -apple-system, sans-serif' },
                        padding: 10,
                        cornerRadius: 6,
                        callbacks: {
                            title: (items) => items[0]?.label || '',
                            label: (context) => {
                                const item = activeMonthlyData[context.dataIndex];
                                if (item && item.avg !== null) {
                                    return ` Rata-rata: ${item.avg.toFixed(2)}% (${item.count}/${item.total} Sites)`;
                                }
                                return ' Belum Ada Data';
                            }
                        }
                    }
                }
            },
            plugins: [valueBottomPlugin, targetLinePlugin]
        });
    }

    function goToRekapPage(p) {
        const effectiveSize = rekapPageSize > 0 ? rekapPageSize : filteredRekapRows.length;
        const totalPages = Math.ceil(filteredRekapRows.length / effectiveSize) || 1;
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;
        rekapCurrentPage = p;
        renderRekapTable();
    }

    async function exportRekapitulasiExcel() {
        if (!filteredRekapRows || filteredRekapRows.length === 0) {
            showToast('warning', 'Data Kosong', 'Tidak ada data Rekapitulasi yang dapat diekspor.');
            return;
        }

        const btn = document.getElementById('btn-rekap-export-excel');
        const origContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 0.8s linear infinite;">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                <span>Mengekspor...</span>
            `;
        }

        try {
            let catLabel = 'Outlet Regional';
            if (summaryCategory === 'pmd') catLabel = 'PMD';
            else if (summaryCategory === 'outlet_subarep') catLabel = 'Outlet Subarep';
            else if (summaryCategory === 'warehouse_hub') catLabel = 'Warehouse HUB';
            else if (summaryCategory === 'warehouse_tekno') catLabel = 'Warehouse Tekno';
            else if (summaryCategory === 'it_coorporate') catLabel = 'IT Corporate';

            const payload = {
                year: rekapYear,
                category: getRekapCategory(),
                category_label: catLabel,
                so_type: summarySOType,
                dept_filter: rekapDeptFilter,
                subdept_filter: rekapSubDeptFilter,
                search_query: rekapSearchQuery,
                rows: filteredRekapRows
            };

            const res = await fetch('api/export_rekapitulasi.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.message || `Export gagal dengan status HTTP ${res.status}`);
            }

            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;

            let downloadFilename = '';
            const disposition = res.headers.get('content-disposition');
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) {
                    downloadFilename = matches[1].replace(/['"]/g, '').trim();
                }
            }
            if (!downloadFilename) {
                const now = new Date();
                const d = String(now.getDate()).padStart(2, '0');
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const y = String(now.getFullYear());
                const H = String(now.getHours()).padStart(2, '0');
                const i = String(now.getMinutes()).padStart(2, '0');
                let catSlug = (catLabel || summaryCategory || 'outletregional').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (catSlug === 'outlet' || catSlug === 'monthlyoutlet') catSlug = 'outletregional';
                downloadFilename = `rekap_${catSlug}_${d}${m}${y}${H}${i}.xlsx`;
            }

            a.download = downloadFilename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);

            showToast('success', 'Export Berhasil', 'File Excel Rekapitulasi berhasil diunduh.');
        } catch (err) {
            console.error('Error exporting Rekapitulasi Excel:', err);
            showToast('error', 'Export Gagal', err.message || 'Terjadi kesalahan saat mengekspor Excel.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origContent;
            }
        }
    }

    // ── Import Modal & Drag-and-Drop ───────────────────────────

    function openImportModal() {
        clearSelectedFile();
        const statusDiv = document.getElementById('modal-import-status');
        if (statusDiv) statusDiv.style.display = 'none';

        // Pre-select current period from summary filter or master filter
        const currentMonth = document.getElementById('summary-filter-month')?.value || document.getElementById('filter-month')?.value;
        const currentYear = document.getElementById('summary-filter-year')?.value || document.getElementById('filter-year')?.value;
        const importMonth = document.getElementById('import-month');
        const importYear = document.getElementById('import-year');
        if (importMonth && currentMonth) importMonth.value = currentMonth;
        if (importYear && currentYear) importYear.value = currentYear;

        const modal = document.getElementById('import-modal');
        if (modal) modal.classList.add('active');
    }

    function closeImportModal() {
        const modal = document.getElementById('import-modal');
        if (modal) modal.classList.remove('active');
    }

    function setupDragAndDrop() {
        const dropZone = document.getElementById('drag-drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleFileSelect(dt.files);
            }
        });
    }

    async function handleFileSelect(files) {
        if (!files || files.length === 0) return;
        const file = files[0];

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            showToast('error', 'File Tidak Valid', 'Hanya file Excel (.xlsx, .xls) yang diperbolehkan.');
            return;
        }

        selectedFile = file;
        importFileToken = null;

        const displayEl = document.getElementById('selected-file-display');
        const nameEl = document.getElementById('selected-file-name');
        const sizeEl = document.getElementById('selected-file-size');

        if (displayEl && nameEl && sizeEl) {
            nameEl.textContent = file.name;
            const sizeKb = Math.round(file.size / 1024);
            sizeEl.textContent = `(${sizeKb.toLocaleString()} KB)`;
            displayEl.style.display = 'block';
        }

        // Show sheet selection and set loading state
        const sheetGroup = document.getElementById('import-sheet-group');
        const sheetSelect = document.getElementById('import-sheet-select');
        const sheetHint = document.getElementById('import-sheet-hint');
        const submitBtn = document.getElementById('modal-upload-btn');

        if (sheetGroup && sheetSelect) {
            sheetGroup.style.display = 'block';
            sheetSelect.innerHTML = '<option value="">Membaca sheet dari file...</option>';
            sheetSelect.disabled = true;
            if (sheetHint) sheetHint.textContent = 'Mohon tunggu saat membaca nama lembar kerja...';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Membaca sheet...';
        }

        try {
            const json = await fetchExcelSheets(file);
            if (json.success && json.sheets && json.sheets.length > 0) {
                importFileToken = json.file_token || null;
                sheetSelect.innerHTML = '';
                json.sheets.forEach((s) => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    sheetSelect.appendChild(opt);
                });
                sheetSelect.disabled = false;
                if (sheetHint) {
                    sheetHint.textContent = json.sheets.length === 1
                        ? '1 sheet terdeteksi pada file.'
                        : `${json.sheets.length} sheet ditemukan. Silakan pilih sheet untuk diimpor.`;
                }
            } else {
                sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
                sheetSelect.disabled = false;
                if (sheetHint) sheetHint.textContent = json.message || 'Tidak dapat membaca sheet; sheet default akan digunakan.';
            }
        } catch (err) {
            sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
            sheetSelect.disabled = false;
            if (sheetHint) sheetHint.textContent = 'Tidak dapat membaca sheet; sheet default akan digunakan.';
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah & Impor';
            }
        }
    }

    function clearSelectedFile() {
        selectedFile = null;
        importFileToken = null;
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) fileInput.value = '';

        const displayEl = document.getElementById('selected-file-display');
        if (displayEl) displayEl.style.display = 'none';

        const sheetGroup = document.getElementById('import-sheet-group');
        const sheetSelect = document.getElementById('import-sheet-select');
        const sheetHint = document.getElementById('import-sheet-hint');
        if (sheetGroup) sheetGroup.style.display = 'none';
        if (sheetSelect) {
            sheetSelect.innerHTML = '<option value="">Pilih Sheet...</option>';
            sheetSelect.disabled = false;
        }
        if (sheetHint) sheetHint.textContent = '';

        const submitBtn = document.getElementById('modal-upload-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unggah & Impor';
        }
    }

    async function submitImport() {
        if (!selectedFile) {
            showToast('error', 'File Belum Dipilih', 'Silakan pilih atau seret & lepas file Excel.');
            return;
        }

        const monthSelect = document.getElementById('import-month');
        const yearSelect = document.getElementById('import-year');
        const submitBtn = document.getElementById('modal-upload-btn');
        const statusDiv = document.getElementById('modal-import-status');

        const month = monthSelect ? monthSelect.value : '';
        const year = yearSelect ? yearSelect.value : '';

        const replaceExisting = document.getElementById('import-replace-existing')?.checked ? '1' : '0';

        const sheetSelect = document.getElementById('import-sheet-select');
        const sheetName = sheetSelect ? sheetSelect.value : '';

        const formData = new FormData();
        formData.append('month', month);
        formData.append('year', year);
        formData.append('replace_existing', replaceExisting);
        formData.append('sheet_name', sheetName);
        if (importFileToken) {
            formData.append('file_token', importFileToken);
        } else {
            formData.append('excel_file', selectedFile);
        }
        formData.append('csrf_token', csrfToken);

        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengunggah...';

        statusDiv.style.display = 'block';
        statusDiv.style.background = '#eff6ff';
        statusDiv.style.color = '#1d4ed8';
        statusDiv.style.border = '1px solid #bfdbfe';
        statusDiv.textContent = 'Mengunggah dan memproses data Excel...';

        try {
            const res = await fetch('api/import.php', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                },
                body: formData
            });

            const rawText = await res.text();
            let json;
            try {
                json = JSON.parse(rawText);
            } catch (parseErr) {
                console.error('Non-JSON server response:', rawText);
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = 'Kesalahan server: ' + (rawText.replace(/<[^>]*>?/gm, '').trim().substring(0, 150) || 'Respon server tidak valid');
                showToast('error', 'Kesalahan Server', 'Respon server tidak valid.');
                return;
            }

            if (json.success) {
                statusDiv.style.background = '#f0fdf4';
                statusDiv.style.color = '#15803d';
                statusDiv.style.border = '1px solid #bbf7d0';
                statusDiv.textContent = json.message || 'Impor berhasil!';

                showToast('success', 'Impor Selesai', json.message || 'Data berhasil diimpor.');

                // Reload master data table & summary (automatically switched to newly uploaded period)
                loadMasterData();
                loadSummaryData(month && year ? { month: parseInt(month, 10), year: parseInt(year, 10) } : null);

                setTimeout(() => {
                    closeImportModal();
                }, 1200);
            } else {
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = json.message || 'Impor gagal.';
                showToast('error', 'Impor Gagal', json.message || 'Gagal mengimpor file.');
            }
        } catch (err) {
            console.error('Upload fetch error:', err);
            statusDiv.style.background = '#fef2f2';
            statusDiv.style.color = '#b91c1c';
            statusDiv.style.border = '1px solid #fecaca';
            statusDiv.textContent = 'Kesalahan koneksi: ' + (err.message || 'Gagal terhubung');
            showToast('error', 'Kesalahan Server', err.message || 'Gagal terhubung ke server.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unggah & Impor';
        }
    }

    // ── Utilities ──────────────────────────────────────────────

    function showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <h4>${escapeHtml(title)}</h4>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        }, 4000);
    }

    function formatNumber(n) {
        return new Intl.NumberFormat('en-US').format(n || 0);
    }

    function formatPercent(n) {
        if (n === null || n === undefined || isNaN(parseFloat(n))) return '-';
        return `${parseFloat(n).toFixed(2)}%`;
    }

    function formatCurrency(n) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(n || 0);
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function clearAllData() {
        if (!confirm('Are you sure you want to clear all imported Stock Opname records from the database? This will allow you to do a clean re-import.')) {
            return;
        }

        try {
            const res = await fetch('api/reconciliation.php?action=clear_all', {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                }
            });
            const json = await res.json();
            if (json.success) {
                showToast('success', 'Cleared', 'All records cleared successfully.');
                loadMasterData();
                loadSummaryData();
            } else {
                showToast('error', 'Error', json.message || 'Failed to clear records.');
            }
        } catch (err) {
            showToast('error', 'Network Error', 'Failed to communicate with server.');
        }
    }

    // ── Bulk Delete by Period & Year ──────────────────────────

    function openBulkDeleteModal() {
        const modal = document.getElementById('bulk-delete-modal');
        if (!modal) return;

        // Pre-select month/year from toolbar if active
        const filterMonth = document.getElementById('filter-month')?.value;
        const filterYear = document.getElementById('filter-year')?.value;
        const modalMonth = document.getElementById('bulk-delete-month');
        const modalYear = document.getElementById('bulk-delete-year');

        if (modalMonth && filterMonth) modalMonth.value = filterMonth;
        if (modalYear && filterYear) modalYear.value = filterYear;

        modal.classList.add('active');
    }

    function closeBulkDeleteModal() {
        const modal = document.getElementById('bulk-delete-modal');
        if (modal) modal.classList.remove('active');
    }

    async function submitBulkDelete() {
        const monthSelect = document.getElementById('bulk-delete-month');
        const yearSelect = document.getElementById('bulk-delete-year');
        const submitBtn = document.getElementById('bulk-delete-submit-btn');

        const month = monthSelect ? monthSelect.value : '';
        const year = yearSelect ? yearSelect.value : '';

        if (!year && !month) {
            showToast('error', 'Selection Required', 'Please select at least a Year or Month to delete.');
            return;
        }

        const monthName = month ? monthSelect.options[monthSelect.selectedIndex].text : 'All Months';
        const confirmMsg = `Are you sure you want to permanently delete all Stock Opname records for:\nMonth: ${monthName}\nYear: ${year || 'All Years'}?\n\nThis cannot be undone!`;

        if (!confirm(confirmMsg)) {
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Deleting...';
        }

        try {
            const params = new URLSearchParams({
                action: 'bulk_delete'
            });
            if (month) params.append('month', month);
            if (year) params.append('year', year);

            const res = await fetch(`api/reconciliation.php?${params.toString()}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                }
            });
            const json = await res.json();

            if (json.success) {
                showToast('success', 'Bulk Delete Complete', json.message || 'Records deleted successfully.');
                closeBulkDeleteModal();
                loadMasterData();
                loadSummaryData();
            } else {
                showToast('error', 'Delete Failed', json.message || 'Failed to delete records.');
            }
        } catch (err) {
            showToast('error', 'Server Error', 'Failed to communicate with the server.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Delete Period Data';
            }
        }
    }

    // ── Catatan Executive Summary (Master Data & Summary Card) ────

    let masterCatatanData = [];
    let executiveNotesData = [];

    const DEPT_SUBDEPTS_OPTIONS = {
        'CRO': ['CJDO', 'EKO', 'WJO', 'WKO'],
        'ERO': ['BNO', 'EJO', 'MPO', 'SMO'],
        'WRO': ['CSO', 'NSO', 'SSO'],
        'PMD': ['DNO', 'DSO']
    };

    const REGION_OPTIONS = [
        'REGION CRO',
        'REGION ERO',
        'REGION WRO',
        'GJO'
    ];

    let execCatatanSortCol = null;
    let execCatatanSortDir = 'asc';

    function toggleExecCatatanSort(col) {
        if (execCatatanSortCol === col) {
            execCatatanSortDir = execCatatanSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            execCatatanSortCol = col;
            execCatatanSortDir = 'asc';
        }
        loadExecutiveNotes();
    }

    function updateExecCatatanSortIndicators() {
        document.querySelectorAll('#exec-catatan-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#exec-catatan-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (execCatatanSortCol) {
            const activeTh = document.querySelector(`#exec-catatan-table th.sortable[onclick*="'${execCatatanSortCol}'"]`);
            if (activeTh) {
                activeTh.classList.add(execCatatanSortDir);
            }
            const activeInd = document.querySelector(`#exec-catatan-table .sort-indicator[data-ecat-col="${execCatatanSortCol}"]`);
            if (activeInd) {
                activeInd.textContent = execCatatanSortDir === 'asc' ? '▲' : '▼';
            }
        }
    }

    async function loadExecutiveNotes(year, month) {
        const y = year || document.getElementById('summary-filter-year')?.value || 2026;
        const monthVal = (month !== undefined && month !== null)
            ? month
            : (document.getElementById('summary-filter-month')?.value ?? '');
        const m = (monthVal === 'all' || monthVal === '') ? '' : monthVal;

        const subtitleEl = document.getElementById('exec-catatan-subtitle');
        const tbody = document.getElementById('exec-catatan-tbody');
        const cardEl = document.getElementById('card-executive-catatan');
        const rowEl = document.getElementById('executive-bottom-row');

        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const mLabel = m ? (monthNames[parseInt(m, 10)] || `Bulan ${m}`) : 'Semua Bulan';
        const periodStr = `${mLabel} ${y}`;

        if (subtitleEl) subtitleEl.textContent = `Kesimpulan hasil evaluasi stock opname`;

        const thPeriod = document.getElementById('exec-catatan-th-period');
        if (thPeriod) {
            const curSoType = (summarySOType || 'monthly').trim().toLowerCase();
            thPeriod.textContent = (curSoType === 'quarterly') ? 'QUARTER' : 'BULAN';
        }

        const thDept = document.getElementById('exec-catatan-th-dept');
        const thSubDept = document.getElementById('exec-catatan-th-subdept');
        const isPmd = (summaryCategory === 'pmd');
        if (thDept) thDept.textContent = isPmd ? 'DIVISI' : 'DEPT';
        if (thSubDept) thSubDept.textContent = isPmd ? 'DEPT' : 'SUB DEPT';

        if (!tbody) return;

        try {
            const queryParams = [];
            if (y) queryParams.push(`year=${encodeURIComponent(y)}`);
            if (m) queryParams.push(`month=${encodeURIComponent(m)}`);
            const curSoType = (summarySOType || 'monthly').trim().toLowerCase();
            queryParams.push(`so_type=${encodeURIComponent(curSoType)}`);

            const res = await fetch(`api/executive_notes.php?${queryParams.join('&')}`);
            const json = await res.json();

            if (json.success && Array.isArray(json.data)) {
                executiveNotesData = json.data;
            } else {
                executiveNotesData = [];
            }

            // Map and filter notes based on SO Type and active category (Dept & Sub Dept):
            const mappedNotes = executiveNotesData.filter(note => {
                const noteSoType = (note.so_type || 'monthly').trim().toLowerCase();
                if (noteSoType !== curSoType) return false;

                const dept = (note.dept || '').trim().toUpperCase();
                const subDept = (note.sub_dept || '').trim().toUpperCase();

                const isAllDept = !dept || dept === 'SEMUA DEPT' || dept === '(SEMUA DEPT)';

                if (curSoType === 'monthly') {
                    if (summaryCategory === 'pmd') {
                        return isAllDept || dept === 'PMD' || subDept === 'DNO' || subDept === 'DSO';
                    } else if (summaryCategory === 'outlet') {
                        return (isAllDept || dept === 'CRO' || dept === 'ERO' || dept === 'WRO') && dept !== 'PMD' && subDept !== 'DNO' && subDept !== 'DSO';
                    } else if (summaryCategory === 'it_coorporate') {
                        return !isAllDept && (dept === 'IT COORPORATE' || dept === 'IT' || dept === 'TBS' || dept === 'ARCADIA' || subDept === 'TBS' || subDept === 'ARCADIA' || dept.includes('IT '));
                    } else if (summaryCategory === 'warehouse_tekno') {
                        return !isAllDept && (dept.includes('TEKNO') || subDept.includes('TEKNO'));
                    } else if (summaryCategory === 'warehouse_hub') {
                        return !isAllDept && (dept.includes('HUB') || subDept.includes('HUB'));
                    } else if (summaryCategory === 'outlet_subarep') {
                        return !isAllDept && (dept.includes('SUBAREP') || subDept.includes('SUBAREP'));
                    }
                    return false;
                }

                if (curSoType === 'quarterly') {
                    if (summaryCategory === 'warehouse_hub') {
                        return dept.includes('HUB') || subDept.includes('HUB');
                    } else if (summaryCategory === 'outlet_subarep') {
                        return dept.includes('SUBAREP') || subDept.includes('SUBAREP');
                    }
                    return true;
                }

                return true;
            });

            if (mappedNotes.length === 0) {
                if (cardEl) cardEl.style.display = 'none';
                if (rowEl) rowEl.style.display = 'none';
                return;
            }

            if (cardEl) cardEl.style.display = 'flex';
            if (rowEl) rowEl.style.display = 'block';

            if (execCatatanSortCol) {
                mappedNotes.sort((a, b) => {
                    let valA, valB;
                    if (execCatatanSortCol === 'period') {
                        valA = parseInt(a.month, 10) || 0;
                        valB = parseInt(b.month, 10) || 0;
                        return execCatatanSortDir === 'asc' ? valA - valB : valB - valA;
                    } else if (execCatatanSortCol === 'dept') {
                        valA = (a.dept || '').toLowerCase();
                        valB = (b.dept || '').toLowerCase();
                    } else if (execCatatanSortCol === 'sub_dept') {
                        valA = (a.sub_dept || '').toLowerCase();
                        valB = (b.sub_dept || '').toLowerCase();
                    } else if (execCatatanSortCol === 'keterangan') {
                        valA = (a.keterangan || '').toLowerCase();
                        valB = (b.keterangan || '').toLowerCase();
                    } else {
                        valA = ''; valB = '';
                    }
                    return execCatatanSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                });
            }
            updateExecCatatanSortIndicators();


            let html = '';
            mappedNotes.forEach((note, idx) => {
                const defaultDept = isPmd ? 'Semua Divisi' : 'Semua Dept';
                const defaultSubDept = isPmd ? 'Semua Dept' : 'Semua Sub Dept';
                const displayDept = (note.dept && !note.dept.toLowerCase().includes('semua')) ? note.dept : defaultDept;
                const displaySubDept = (note.sub_dept && !note.sub_dept.toLowerCase().includes('semua')) ? note.sub_dept : defaultSubDept;

                // Format mapped month from master data (just month, not year)
                let periodDisplay = '-';
                const nMonth = parseInt(note.month, 10);
                const noteSoType = (note.so_type || curSoType).toLowerCase();
                if (noteSoType === 'quarterly' && nMonth) {
                    const q = Math.ceil(nMonth / 3);
                    periodDisplay = `Q${q}`;
                } else if (nMonth && monthNames[nMonth]) {
                    periodDisplay = monthNames[nMonth];
                } else if (nMonth) {
                    periodDisplay = `Bulan ${nMonth}`;
                }

                html += `
                    <tr>
                        <td class="text-center" style="font-weight: 600; color: #334155; font-size: 11.5px; white-space: nowrap;">
                            <span class="badge" style="background: #f1f5f9; color: #1e293b; font-weight: 600; font-size: 11px; padding: 2.5px 8px; border-radius: 5px; border: 1px solid #cbd5e1;">
                                ${escapeHtml(periodDisplay)}
                            </span>
                        </td>
                        <td class="text-center" style="font-weight: 600; color: #1e293b;">${escapeHtml(displayDept)}</td>
                        <td class="text-center" style="font-weight: 600; color: #1e293b;">${escapeHtml(displaySubDept)}</td>
                        <td style="white-space: pre-line; line-height: 1.55; color: #1e293b; font-size: 12.5px; word-break: break-word;">${escapeHtml(note.keterangan || '')}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (err) {
            console.error('Error loading executive notes:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center" style="padding: 2rem; color: #ef4444;">
                        Gagal memuat catatan: ${escapeHtml(err.message || 'Terjadi kesalahan sistem')}
                    </td>
                </tr>
            `;
        }
    }

    let masterCatatanSortCol = null;
    let masterCatatanSortDir = 'asc';

    function toggleMasterCatatanSort(col) {
        if (masterCatatanSortCol === col) {
            masterCatatanSortDir = masterCatatanSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            masterCatatanSortCol = col;
            masterCatatanSortDir = 'asc';
        }
        loadMasterCatatan();
    }

    function updateMasterCatatanSortIndicators() {
        document.querySelectorAll('#master-catatan-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#master-catatan-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (masterCatatanSortCol) {
            const activeTh = document.querySelector(`#master-catatan-table th.sortable[onclick*="'${masterCatatanSortCol}'"]`);
            if (activeTh) {
                activeTh.classList.add(masterCatatanSortDir);
            }
            const activeInd = document.querySelector(`#master-catatan-table .sort-indicator[data-mcat-col="${masterCatatanSortCol}"]`);
            if (activeInd) {
                activeInd.textContent = masterCatatanSortDir === 'asc' ? '▲' : '▼';
            }
        }
    }

    async function loadMasterCatatan() {
        const y = document.getElementById('master-catatan-filter-year')?.value || '';
        const m = document.getElementById('master-catatan-filter-month')?.value || '';
        const soTypeFilter = document.getElementById('master-catatan-filter-sotype')?.value || '';
        const tbody = document.getElementById('master-catatan-tbody');
        const badge = document.getElementById('master-catatan-count-badge');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    Memuat data catatan...
                </td>
            </tr>
        `;

        try {
            const params = [];
            if (y) params.push(`year=${encodeURIComponent(y)}`);
            if (m && m !== 'all') params.push(`month=${encodeURIComponent(m)}`);
            if (soTypeFilter) params.push(`so_type=${encodeURIComponent(soTypeFilter)}`);
            const query = params.length > 0 ? `?${params.join('&')}` : '';

            const res = await fetch(`api/executive_notes.php${query}`);
            const json = await res.json();

            if (json.success && Array.isArray(json.data)) {
                masterCatatanData = json.data;
            } else {
                masterCatatanData = [];
            }

            if (badge) badge.textContent = `${masterCatatanData.length} Data`;

            if (masterCatatanSortCol) {
                masterCatatanData.sort((a, b) => {
                    let valA, valB;
                    if (masterCatatanSortCol === 'so_type') {
                        valA = (a.so_type || '').toLowerCase();
                        valB = (b.so_type || '').toLowerCase();
                    } else if (masterCatatanSortCol === 'period') {
                        valA = ((parseInt(a.year, 10) || 0) * 100) + (parseInt(a.month, 10) || 0);
                        valB = ((parseInt(b.year, 10) || 0) * 100) + (parseInt(b.month, 10) || 0);
                        return masterCatatanSortDir === 'asc' ? valA - valB : valB - valA;
                    } else if (masterCatatanSortCol === 'dept') {
                        valA = (a.dept || '').toLowerCase();
                        valB = (b.dept || '').toLowerCase();
                    } else if (masterCatatanSortCol === 'sub_dept') {
                        valA = (a.sub_dept || '').toLowerCase();
                        valB = (b.sub_dept || '').toLowerCase();
                    } else if (masterCatatanSortCol === 'keterangan') {
                        valA = (a.keterangan || '').toLowerCase();
                        valB = (b.keterangan || '').toLowerCase();
                    } else {
                        valA = ''; valB = '';
                    }
                    return masterCatatanSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                });
            }
            updateMasterCatatanSortIndicators();

            if (masterCatatanData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center" style="padding: 2.5rem; color: #94a3b8;">
                            Tidak ada data catatan.
                        </td>
                    </tr>
                `;
                return;
            }

            const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            let html = '';
            masterCatatanData.forEach((note, idx) => {
                const mName = monthNames[note.month] || note.month;
                const periodLabel = `${mName} ${note.year}`;
                const noteType = (note.so_type || 'monthly').toLowerCase();
                const typeBadge = noteType === 'quarterly'
                    ? `<span style="min-width: 72px; display: inline-block; padding: 3px 9px; font-size: 11px; font-weight: 700; border-radius: 6px; text-align: center; color: #0284c7; background: #e0f2fe; border: 1px solid #bae6fd; line-height: 15px;">Quarterly</span>`
                    : `<span style="min-width: 72px; display: inline-block; padding: 3px 9px; font-size: 11px; font-weight: 700; border-radius: 6px; text-align: center; color: #16a34a; background: #dcfce7; border: 1px solid #bbf7d0; line-height: 15px;">Monthly</span>`;

                const displayDept = (note.dept && note.dept !== 'Semua Dept' && note.dept !== '(Semua Dept)') ? note.dept : 'Semua Dept';
                const displaySubDept = (note.sub_dept && note.sub_dept !== 'Semua Sub Dept' && note.sub_dept !== '(Semua Sub Dept)') ? note.sub_dept : 'Semua Sub Dept';

                html += `
                    <tr>
                        <td class="text-center" style="color: #64748b;">${idx + 1}</td>
                        <td class="text-center">${typeBadge}</td>
                        <td class="text-center" style="font-weight: 600; color: #1e293b;">${escapeHtml(periodLabel)}</td>
                        <td class="text-center" style="font-weight: 600; color: #1e293b;">${escapeHtml(displayDept)}</td>
                        <td class="text-center" style="font-weight: 600; color: #1e293b;">${escapeHtml(displaySubDept)}</td>
                        <td style="max-width: 420px; white-space: normal; line-height: 1.45; word-break: break-word;">${escapeHtml(note.keterangan || '')}</td>
                        <td class="text-center">
                            <div style="display: inline-flex; gap: 4px;">
                                <button type="button" class="btn btn-outline-primary btn-sm" onclick="App.editExecutiveNote(${note.id})" style="padding: 2px 6px; font-size: 11px;">
                                    Edit
                                </button>
                                <button type="button" class="btn btn-danger btn-sm btn-delete" onclick="App.deleteExecutiveNote(${note.id})" style="padding: 2px 6px; font-size: 11px;">
                                    Hapus
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (err) {
            console.error('Error loading master catatan:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 2rem; color: #ef4444;">
                        Gagal memuat data: ${escapeHtml(err.message || 'Terjadi kesalahan')}
                    </td>
                </tr>
            `;
        }
    }

    function openAddExecutiveNoteModal(periodYear, periodMonth, soType) {
        const modal = document.getElementById('modal-executive-note');
        if (!modal) return;

        const titleEl = document.getElementById('modal-exec-note-title');
        const editIdEl = document.getElementById('modal-note-edit-id');
        const soTypeSel = document.getElementById('modal-note-so-type');
        const monthSel = document.getElementById('modal-note-month');
        const yearSel = document.getElementById('modal-note-year');
        const btnAddRow = document.getElementById('btn-add-note-row');
        const fabAddRow = document.getElementById('btn-add-note-row-fab');
        const container = document.getElementById('modal-note-rows-container');
        if (titleEl) titleEl.textContent = 'Tambah Catatan Executive Summary';
        if (editIdEl) editIdEl.value = '';

        const y = periodYear || document.getElementById('summary-filter-year')?.value || 2026;
        const m = periodMonth || document.getElementById('summary-filter-month')?.value || 9;
        const sType = soType || 'monthly';

        if (soTypeSel) soTypeSel.value = sType;
        if (yearSel) yearSel.value = String(y);
        if (monthSel) monthSel.value = String(m || 9);

        if (btnAddRow) btnAddRow.style.display = 'inline-flex';
        if (fabAddRow) fabAddRow.style.display = 'inline-flex';
        if (container) {
            container.innerHTML = '';
            addExecutiveNoteRow();
        }

        modal.classList.add('active');
    }

    function closeExecutiveNoteModal() {
        const modal = document.getElementById('modal-executive-note');
        if (modal) modal.classList.remove('active');
    }

    function addExecutiveNoteRow(data = null) {
        const container = document.getElementById('modal-note-rows-container');
        if (!container) return;

        const rowCount = container.children.length + 1;
        const rowId = `note-row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const rawDept = data ? (data.dept || '') : '';
        const rawSubDept = data ? (data.sub_dept || '') : '';
        const deptVal = (rawDept === 'Semua Dept' || rawDept === '(Semua Dept)') ? '' : rawDept;
        const subDeptVal = (rawSubDept === 'Semua Sub Dept' || rawSubDept === '(Semua Sub Dept)') ? '' : rawSubDept;
        const ketVal = data?.keterangan || '';

        const depts = ['', 'CRO', 'ERO', 'WRO', 'PMD'];
        const deptOptions = depts.map(d => {
            const label = d === '' ? 'Semua Dept' : d;
            const sel = (deptVal === d) ? 'selected' : '';
            return `<option value="${escapeHtml(d)}" ${sel}>${escapeHtml(label)}</option>`;
        }).join('');

        // Generate Sub Dept options based on initial dept
        const currentDeptSubs = deptVal && DEPT_SUBDEPTS_OPTIONS[deptVal]
            ? DEPT_SUBDEPTS_OPTIONS[deptVal]
            : Array.from(new Set(Object.values(DEPT_SUBDEPTS_OPTIONS).flat()));
        const subDeptList = ['', ...currentDeptSubs];
        const subDeptOptions = subDeptList.map(s => {
            const label = s === '' ? 'Semua Sub Dept' : s;
            const sel = (subDeptVal === s) ? 'selected' : '';
            return `<option value="${escapeHtml(s)}" ${sel}>${escapeHtml(label)}</option>`;
        }).join('');

        const card = document.createElement('div');
        card.className = 'modal-note-row-card';
        card.id = rowId;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                <span class="note-row-num" style="font-size: 11px; font-weight: 700; color: #2563eb; padding: 2px 7px; border-radius: 4px;">
                    Catatan No.${rowCount}
                </span>
                <button type="button" class="btn btn-outline-danger btn-sm btn-remove-row" onclick="App.removeExecutiveNoteRow(this)" style="font-size: 11px; padding: 2px 6px; line-height: 1;">
                    ✕
                </button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.6rem;">
                <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: #64748b; margin-bottom: 2px; display: block;">Dept</label>
                    <select class="form-control form-control-sm note-input-dept" onchange="App.onDeptChangeInNoteRow(this)" style="font-size: 11.5px; padding: 3px 6px; height: 30px;">
                        ${deptOptions}
                    </select>
                </div>
                <div>
                    <label style="font-size: 10.5px; font-weight: 600; color: #64748b; margin-bottom: 2px; display: block;">Sub Dept</label>
                    <select class="form-control form-control-sm note-input-subdept" style="font-size: 11.5px; padding: 3px 6px; height: 30px;">
                        ${subDeptOptions}
                    </select>
                </div>
            </div>
            <div>
                <label style="font-size: 10.5px; font-weight: 600; color: #64748b; margin-bottom: 2px; display: block;">Keterangan / Evaluasi Catatan <span style="color: #ef4444;">*</span></label>
                <textarea class="form-control note-input-keterangan" rows="2" style="font-size: 12px; line-height: 1.5; padding: 6px 8px;" required>${escapeHtml(ketVal)}</textarea>
            </div>
        `;

        container.appendChild(card);
        updateNoteRowCounters();

        // If newly added row beyond initial setup, smoothly scroll into view and focus textarea
        if (container.children.length > 1) {
            setTimeout(() => {
                card.scrollIntoView({ behavior: 'smooth', block: 'end' });
                const ta = card.querySelector('.note-input-keterangan');
                if (ta) ta.focus();
            }, 60);
        }
    }

    function removeExecutiveNoteRow(btn) {
        const card = btn.closest('.modal-note-row-card');
        const container = document.getElementById('modal-note-rows-container');
        if (card && container) {
            if (container.children.length <= 1) {
                showToast('warning', 'Peringatan', 'Minimal harus ada 1 baris catatan');
                return;
            }
            card.remove();
            updateNoteRowCounters();
        }
    }

    function updateNoteRowCounters() {
        const container = document.getElementById('modal-note-rows-container');
        if (!container) return;
        const rows = container.querySelectorAll('.modal-note-row-card');
        rows.forEach((row, idx) => {
            const numEl = row.querySelector('.note-row-num');
            if (numEl) numEl.textContent = `Catatan No.${idx + 1}`;
            const removeBtn = row.querySelector('.btn-remove-row');
            if (removeBtn) {
                removeBtn.style.visibility = (rows.length > 1) ? 'visible' : 'hidden';
            }
        });
    }

    function onDeptChangeInNoteRow(deptSelect) {
        const card = deptSelect.closest('.modal-note-row-card');
        if (!card) return;
        const subDeptSelect = card.querySelector('.note-input-subdept');
        if (!subDeptSelect) return;

        const chosenDept = deptSelect.value;
        const subs = chosenDept && DEPT_SUBDEPTS_OPTIONS[chosenDept]
            ? DEPT_SUBDEPTS_OPTIONS[chosenDept]
            : Array.from(new Set(Object.values(DEPT_SUBDEPTS_OPTIONS).flat()));

        let optsHtml = '<option value="" selected>Semua Sub Dept</option>';
        subs.forEach(s => {
            optsHtml += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
        });
        subDeptSelect.innerHTML = optsHtml;
    }

    function editExecutiveNote(id) {
        const note = masterCatatanData.find(n => n.id === id);
        if (!note) {
            showToast('error', 'Gagal', 'Data catatan tidak ditemukan');
            return;
        }

        const modal = document.getElementById('modal-executive-note');
        if (!modal) return;

        const titleEl = document.getElementById('modal-exec-note-title');
        const editIdEl = document.getElementById('modal-note-edit-id');
        const soTypeSel = document.getElementById('modal-note-so-type');
        const monthSel = document.getElementById('modal-note-month');
        const yearSel = document.getElementById('modal-note-year');
        const btnAddRow = document.getElementById('btn-add-note-row');
        const fabAddRow = document.getElementById('btn-add-note-row-fab');
        const container = document.getElementById('modal-note-rows-container');

        if (titleEl) titleEl.textContent = 'Edit Catatan Executive Summary';
        if (editIdEl) editIdEl.value = String(note.id);
        if (soTypeSel) soTypeSel.value = note.so_type || 'monthly';
        if (yearSel) yearSel.value = String(note.year);
        if (monthSel) monthSel.value = String(note.month);
        if (btnAddRow) btnAddRow.style.display = 'none';
        if (fabAddRow) fabAddRow.style.display = 'none';

        if (container) {
            container.innerHTML = '';
            addExecutiveNoteRow({
                dept: note.dept,
                sub_dept: note.sub_dept,
                keterangan: note.keterangan
            });
        }

        modal.classList.add('active');
    }

    async function deleteExecutiveNote(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus catatan ini?')) {
            return;
        }

        try {
            const res = await fetch(`api/executive_notes.php?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                }
            });
            const json = await res.json();

            if (json.success) {
                showToast('success', 'Berhasil', 'Catatan berhasil dihapus');
                loadMasterCatatan();
                const curY = document.getElementById('summary-filter-year')?.value || 2026;
                const curM = document.getElementById('summary-filter-month')?.value || 9;
                loadExecutiveNotes(curY, curM);
            } else {
                showToast('error', 'Gagal', json.message || 'Gagal menghapus catatan');
            }
        } catch (err) {
            console.error('Error deleting executive note:', err);
            showToast('error', 'Kesalahan', 'Gagal menghapus catatan: ' + err.message);
        }
    }

    async function submitExecutiveNote(e) {
        e.preventDefault();

        const editId = document.getElementById('modal-note-edit-id')?.value;
        const soType = document.getElementById('modal-note-so-type')?.value || 'monthly';
        const year = parseInt(document.getElementById('modal-note-year')?.value, 10);
        const month = parseInt(document.getElementById('modal-note-month')?.value, 10);
        const container = document.getElementById('modal-note-rows-container');
        const submitBtn = document.getElementById('btn-submit-exec-note');

        if (!year || !month) {
            showToast('warning', 'Peringatan', 'Pilih bulan dan tahun periode');
            return;
        }

        if (editId) {
            const row = container?.querySelector('.modal-note-row-card');
            const dept = row?.querySelector('.note-input-dept')?.value || '';
            const subDept = row?.querySelector('.note-input-subdept')?.value || '';
            const keterangan = row?.querySelector('.note-input-keterangan')?.value?.trim() || '';

            if (!keterangan) {
                showToast('warning', 'Peringatan', 'Keterangan catatan tidak boleh kosong');
                return;
            }

            try {
                if (submitBtn) submitBtn.disabled = true;
                const res = await fetch('api/executive_notes.php', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken
                    },
                    body: JSON.stringify({
                        id: parseInt(editId, 10),
                        year,
                        month,
                        so_type: soType,
                        dept,
                        sub_dept: subDept,
                        keterangan
                    })
                });
                const json = await res.json();
                if (json.success) {
                    showToast('success', 'Berhasil', 'Catatan berhasil diperbarui');
                    closeExecutiveNoteModal();
                    loadMasterCatatan();
                    loadExecutiveNotes(year, month);
                } else {
                    showToast('error', 'Gagal', json.message || 'Gagal memperbarui catatan');
                }
            } catch (err) {
                console.error('Error updating note:', err);
                showToast('error', 'Kesalahan', 'Terjadi kesalahan: ' + err.message);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }

        } else {
            const rows = container?.querySelectorAll('.modal-note-row-card') || [];
            const items = [];

            rows.forEach(r => {
                const dept = r.querySelector('.note-input-dept')?.value || '';
                const subDept = r.querySelector('.note-input-subdept')?.value || '';
                const keterangan = r.querySelector('.note-input-keterangan')?.value?.trim() || '';
                if (keterangan) {
                    items.push({
                        so_type: soType,
                        dept,
                        sub_dept: subDept,
                        keterangan
                    });
                }
            });

            if (items.length === 0) {
                showToast('warning', 'Peringatan', 'Masukkan minimal 1 keterangan catatan');
                return;
            }

            try {
                if (submitBtn) submitBtn.disabled = true;
                const res = await fetch('api/executive_notes.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken
                    },
                    body: JSON.stringify({
                        year,
                        month,
                        so_type: soType,
                        items
                    })
                });
                const json = await res.json();
                if (json.success) {
                    showToast('success', 'Berhasil', json.message || 'Catatan berhasil disimpan');
                    closeExecutiveNoteModal();
                    loadMasterCatatan();
                    loadExecutiveNotes(year, month);
                } else {
                    showToast('error', 'Gagal', json.message || 'Gagal menyimpan catatan');
                }
            } catch (err) {
                console.error('Error saving notes:', err);
                showToast('error', 'Kesalahan', 'Terjadi kesalahan: ' + err.message);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // ── PIC Sites Master Data ───────────────────────────────────────
    // ═════════════════════════════════════════════════════════════════
    let picSitesCurrentPage = 1;
    let picSitesPageSize = '10';
    let picSitesTotalPages = 1;
    let picSitesTotalItems = 0;
    let picSitesSearchQuery = '';
    let picSitesDeptFilter = 'all';
    let picSitesSubDeptFilter = 'all';
    let picSitesSortCol = 'dept';
    let picSitesSortDir = 'asc';
    let picSitesDebounceTimer = null;
    let picSitesCache = [];
    let siteOptionsCache = [];

    async function loadPicSites(page = picSitesCurrentPage) {
        const tbody = document.getElementById('pic-sites-tbody');
        const infoEl = document.getElementById('pic-sites-pagination-info');
        const controlsEl = document.getElementById('pic-sites-pagination-controls');
        if (!tbody) return;

        picSitesCurrentPage = page;
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 0.8s linear infinite;">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        </svg>
                        <span>Memuat data PIC Sites...</span>
                    </div>
                </td>
            </tr>
        `;

        try {
            const params = new URLSearchParams({
                action: 'list',
                page: picSitesCurrentPage,
                limit: picSitesPageSize,
                dept: picSitesDeptFilter,
                sub_dept: picSitesSubDeptFilter,
                search: picSitesSearchQuery,
                sort_col: picSitesSortCol,
                sort_dir: picSitesSortDir
            });

            const res = await fetch(`api/site_pics.php?${params.toString()}`);
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.message || 'Gagal memuat data');
            }

            picSitesCache = json.data || [];
            picSitesTotalItems = json.total || 0;
            picSitesTotalPages = json.total_pages || 1;

            populatePicSitesFilters(json.depts || [], json.sub_depts || []);
            renderPicSitesTable(json.data || []);
            updatePicSitesPagination(json.page, json.total, json.total_pages);
            updatePicSitesSortIndicators();

        } catch (err) {
            console.error('Error loading PIC sites:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center" style="padding: 2.5rem; color: #ef4444;">
                        Terjadi kesalahan saat memuat data: ${escapeHtml(err.message || 'Unknown error')}
                    </td>
                </tr>
            `;
            if (infoEl) infoEl.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            if (controlsEl) controlsEl.innerHTML = '';
        }
    }

    function renderPicSitesTable(rows) {
        const tbody = document.getElementById('pic-sites-tbody');
        if (!tbody) return;

        if (!rows || rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center" style="padding: 2.5rem; color: #94a3b8;">
                        Tidak ada data PIC Site yang ditemukan
                    </td>
                </tr>
            `;
            return;
        }

        const startIndex = picSitesPageSize === 'all' ? 0 : (picSitesCurrentPage - 1) * parseInt(picSitesPageSize, 10);
        let html = '';

        rows.forEach((r, idx) => {
            const no = startIndex + idx + 1;
            const picDisplay = r.pic && r.pic.trim()
                ? `<span style="font-weight: 600; color: #0f172a;">${escapeHtml(r.pic)}</span>`
                : '<span style="color: #94a3b8; font-style: italic;">No data.</span>';

            let phoneDisplay = '<span style="color: #94a3b8; font-style: italic;">-</span>';
            if (r.no_telp && r.no_telp.trim()) {
                const rawPhone = r.no_telp.trim();
                const cleanNum = rawPhone.replace(/[^0-9]/g, '');
                let waNum = cleanNum;
                if (waNum.startsWith('0')) {
                    waNum = '62' + waNum.substring(1);
                }
                phoneDisplay = `
                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                        <span style="font-weight: 500; color: #334155;">${escapeHtml(rawPhone)}</span>
                        ${cleanNum.length >= 8 ? `
                            <a href="https://wa.me/${waNum}" target="_blank" rel="noopener noreferrer"
                                style="color: #16a34a; display: inline-flex; align-items: center;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 18.06c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.134 8.134 0 0 1-1.25-4.29c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.23.85 5.77 2.39a8.118 8.118 0 0 1 2.4 5.77c-.01 4.51-3.67 8.15-8.17 8.15zm4.48-6.11c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z"/>
                                </svg>
                            </a>
                        ` : ''}
                    </div>
                `;
            }

            html += `
                <tr id="pic-site-row-${r.id}">
                    <td class="text-center" style="color: #64748b;">${no}</td>
                    <td class="text-center"><span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">${escapeHtml(r.dept || '-')}</span></td>
                    <td class="text-center" style="font-size: 11.5px; font-weight: 600; color: #475569;">${escapeHtml(r.sub_dept || '-')}</td>
                    <td class="text-center" style="font-weight: 700; color: #0284c7;">${escapeHtml(r.sitecode || '-')}</td>
                    <td style="font-weight: 600; color: #1e293b; text-align: left;">${escapeHtml(r.name_site || '-')}</td>
                    <td>${picDisplay}</td>
                    <td>${phoneDisplay}</td>
                    <td class="text-center">
                        <div style="display: inline-flex; align-items: center; gap: 4px;">
                            <button class="btn btn-outline-primary btn-sm" onclick="App.openEditPicSiteModal(${r.id})"
                                style="font-size: 11px; padding: 2px 7px;">
                                Edit
                            </button>
                            <button class="btn btn-danger btn-sm btn-delete" onclick="App.deletePicSite(${r.id})"
                                style="font-size: 11px; padding: 2px 7px;">
                                Hapus
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function updatePicSitesPagination(page, total, totalPages) {
        const infoEl = document.getElementById('pic-sites-pagination-info');
        const controlsEl = document.getElementById('pic-sites-pagination-controls');

        if (infoEl) {
            const start = total > 0 ? (page - 1) * (picSitesPageSize === 'all' ? total : parseInt(picSitesPageSize, 10)) + 1 : 0;
            const end = picSitesPageSize === 'all' ? total : Math.min(page * parseInt(picSitesPageSize, 10), total);
            infoEl.textContent = `Menampilkan ${start.toLocaleString('id-ID')} sampai ${end.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} data`;
        }

        if (controlsEl) {
            if (totalPages <= 1 || picSitesPageSize === 'all') {
                controlsEl.innerHTML = '';
                return;
            }

            let html = '';
            html += `<button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="App.goToPicSitesPage(${page - 1})">&laquo; Prev</button>`;

            const maxButtons = 5;
            let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }

            if (startPage > 1) {
                html += `<button class="pagination-btn" onclick="App.goToPicSitesPage(1)">1</button>`;
                if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
            }

            for (let p = startPage; p <= endPage; p++) {
                html += `<button class="pagination-btn ${p === page ? 'active' : ''}" onclick="App.goToPicSitesPage(${p})">${p}</button>`;
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
                html += `<button class="pagination-btn" onclick="App.goToPicSitesPage(${totalPages})">${totalPages}</button>`;
            }

            html += `<button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="App.goToPicSitesPage(${page + 1})">Next &raquo;</button>`;
            controlsEl.innerHTML = html;
        }
    }

    function goToPicSitesPage(p) {
        if (p < 1) p = 1;
        if (p > picSitesTotalPages) p = picSitesTotalPages;
        loadPicSites(p);
    }

    function changePicSitesPageSize(sz) {
        picSitesPageSize = sz;
        picSitesCurrentPage = 1;
        loadPicSites(1);
    }

    function handlePicSitesSearch(val) {
        clearTimeout(picSitesDebounceTimer);
        picSitesDebounceTimer = setTimeout(() => {
            picSitesSearchQuery = (val || '').trim();
            picSitesCurrentPage = 1;
            loadPicSites(1);
        }, 300);
    }

    function onPicSitesDeptFilterChange() {
        const el = document.getElementById('pic-sites-filter-dept');
        picSitesDeptFilter = el ? el.value : 'all';
        picSitesCurrentPage = 1;
        loadPicSites(1);
    }

    function onPicSitesSubDeptFilterChange() {
        const el = document.getElementById('pic-sites-filter-subdept');
        picSitesSubDeptFilter = el ? el.value : 'all';
        picSitesCurrentPage = 1;
        loadPicSites(1);
    }

    function populatePicSitesFilters(depts, subDepts) {
        const deptSelect = document.getElementById('pic-sites-filter-dept');
        const subDeptSelect = document.getElementById('pic-sites-filter-subdept');

        if (deptSelect && deptSelect.options.length <= 1 && Array.isArray(depts)) {
            const currentVal = deptSelect.value;
            deptSelect.innerHTML = '<option value="all">Semua Dept</option>';
            depts.forEach(d => {
                if (d && d.trim()) {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.textContent = d;
                    if (d === currentVal) opt.selected = true;
                    deptSelect.appendChild(opt);
                }
            });
        }

        if (subDeptSelect && subDeptSelect.options.length <= 1 && Array.isArray(subDepts)) {
            const currentVal = subDeptSelect.value;
            subDeptSelect.innerHTML = '<option value="all">Semua Sub Dept</option>';
            subDepts.forEach(s => {
                if (s && s.trim()) {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    if (s === currentVal) opt.selected = true;
                    subDeptSelect.appendChild(opt);
                }
            });
        }
    }

    function togglePicSitesSort(col) {
        if (picSitesSortCol === col) {
            picSitesSortDir = picSitesSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            picSitesSortCol = col;
            picSitesSortDir = 'asc';
        }
        loadPicSites(1);
    }

    function updatePicSitesSortIndicators() {
        document.querySelectorAll('#pic-sites-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#pic-sites-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (picSitesSortCol) {
            const activeTh = document.querySelector(`#pic-sites-table th.sortable[onclick*="'${picSitesSortCol}'"]`);
            if (activeTh) activeTh.classList.add(picSitesSortDir);
            const activeInd = document.querySelector(`#pic-sites-table .sort-indicator[data-pics-col="${picSitesSortCol}"]`);
            if (activeInd) activeInd.textContent = picSitesSortDir === 'asc' ? '▲' : '▼';
        }
    }

    function exportPicSitesExcel() {
        const params = new URLSearchParams({
            action: 'export',
            dept: picSitesDeptFilter,
            sub_dept: picSitesSubDeptFilter,
            search: picSitesSearchQuery
        });
        window.location.href = `api/site_pics.php?${params.toString()}`;
    }

    async function loadSiteOptionsForModal() {
        if (siteOptionsCache.length > 0) return siteOptionsCache;
        try {
            const res = await fetch('api/site_pics.php?action=site_options');
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                siteOptionsCache = json.data;
            }
        } catch (e) {
            console.error('Failed to load site options:', e);
        }
        return siteOptionsCache;
    }

    async function populateSiteSelectOptions(selectEl) {
        if (!selectEl) return;
        const sites = await loadSiteOptionsForModal();
        if (selectEl.options.length <= 1 && Array.isArray(sites)) {
            selectEl.innerHTML = '<option value="">Pilih Site atau Input Manual</option>';
            sites.forEach(s => {
                if (s.sitecode) {
                    const opt = document.createElement('option');
                    opt.value = s.sitecode;
                    opt.textContent = `${s.sitecode} - ${s.name_site || ''} (${s.dept || '-'}/${s.sub_dept || '-'})`;
                    selectEl.appendChild(opt);
                }
            });
        }
    }

    async function openAddPicSiteModal() {
        document.getElementById('pic-site-modal-title').textContent = 'Tambah PIC Site';
        document.getElementById('pic-site-id').value = '';
        document.getElementById('pic-site-sitecode').value = '';
        document.getElementById('pic-site-dept').value = '';
        document.getElementById('pic-site-subdept').value = '';
        document.getElementById('pic-site-name').value = '';
        document.getElementById('pic-site-pic').value = '';
        document.getElementById('pic-site-notelp').value = '';

        const selectEl = document.getElementById('pic-site-select-sitecode');
        if (selectEl) {
            selectEl.parentElement.style.display = 'block';
            await populateSiteSelectOptions(selectEl);
            selectEl.value = '';
        }

        const modal = document.getElementById('pic-site-modal');
        if (modal) modal.style.display = 'flex';
    }

    function openEditPicSiteModal(id) {
        const item = picSitesCache.find(x => x.id === id);
        if (!item) return;

        document.getElementById('pic-site-modal-title').textContent = 'Edit PIC Site';
        document.getElementById('pic-site-id').value = item.id;
        document.getElementById('pic-site-sitecode').value = item.sitecode || '';
        document.getElementById('pic-site-dept').value = item.dept || '';
        document.getElementById('pic-site-subdept').value = item.sub_dept || '';
        document.getElementById('pic-site-name').value = item.name_site || '';
        document.getElementById('pic-site-pic').value = item.pic || '';
        document.getElementById('pic-site-notelp').value = item.no_telp || '';

        const selectEl = document.getElementById('pic-site-select-sitecode');
        if (selectEl) {
            selectEl.parentElement.style.display = 'none';
        }

        const modal = document.getElementById('pic-site-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closePicSiteModal() {
        const modal = document.getElementById('pic-site-modal');
        if (modal) modal.style.display = 'none';
    }

    function onPicSitecodeSelected(sc) {
        if (!sc) return;
        const opt = siteOptionsCache.find(s => s.sitecode === sc);
        if (opt) {
            document.getElementById('pic-site-sitecode').value = opt.sitecode || '';
            document.getElementById('pic-site-name').value = opt.name_site || '';
            document.getElementById('pic-site-dept').value = opt.dept || '';
            document.getElementById('pic-site-subdept').value = opt.sub_dept || '';
        }
    }

    async function submitPicSiteForm(e) {
        if (e) e.preventDefault();
        const btn = document.getElementById('btn-save-pic-site');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';
        }

        try {
            const payload = {
                id: document.getElementById('pic-site-id').value || null,
                sitecode: document.getElementById('pic-site-sitecode').value.trim(),
                name_site: document.getElementById('pic-site-name').value.trim(),
                dept: document.getElementById('pic-site-dept').value.trim(),
                sub_dept: document.getElementById('pic-site-subdept').value.trim(),
                pic: document.getElementById('pic-site-pic').value.trim(),
                no_telp: document.getElementById('pic-site-notelp').value.trim()
            };

            const res = await fetch('api/site_pics.php?action=save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (!json.success) {
                alert(json.message || 'Gagal menyimpan data');
                return;
            }

            closePicSiteModal();
            loadPicSites(picSitesCurrentPage);
            if (typeof showToast === 'function') {
                showToast('success', 'Berhasil', json.message);
            } else {
                alert(json.message);
            }
        } catch (err) {
            console.error('Error saving PIC site:', err);
            alert('Terjadi kesalahan jaringan saat menyimpan data');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    }

    async function deletePicSite(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus data PIC site ini?')) return;
        try {
            const res = await fetch('api/site_pics.php?action=delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const json = await res.json();
            if (!json.success) {
                alert(json.message || 'Gagal menghapus data');
                return;
            }
            loadPicSites(picSitesCurrentPage);
            if (typeof showToast === 'function') {
                showToast('success', 'Berhasil', json.message);
            } else {
                alert(json.message);
            }
        } catch (err) {
            console.error('Error deleting PIC site:', err);
            alert('Gagal menghapus data');
        }
    }

    // ── PIC Sites Import Excel ───────────────────────────────────────
    let picSitesSelectedFile = null;
    let picSitesFileToken = null;

    function setupPicSitesDragAndDrop() {
        const dropZone = document.getElementById('pic-sites-drag-drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handlePicSitesFileSelect(dt.files);
            }
        });
    }

    function openPicSitesImportModal() {
        clearPicSitesSelectedFile();
        const statusDiv = document.getElementById('pic-sites-modal-import-status');
        if (statusDiv) {
            statusDiv.style.display = 'none';
            statusDiv.textContent = '';
        }
        const chk = document.getElementById('pic-sites-import-replace-existing');
        if (chk) chk.checked = false;

        const modal = document.getElementById('pic-sites-import-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closePicSitesImportModal() {
        const modal = document.getElementById('pic-sites-import-modal');
        if (modal) modal.style.display = 'none';
        clearPicSitesSelectedFile();
    }

    async function handlePicSitesFileSelect(files) {
        if (!files || files.length === 0) return;
        const file = files[0];
        const validExts = ['.xlsx', '.xls', '.csv'];
        const nameLower = file.name.toLowerCase();
        const isValid = validExts.some(ext => nameLower.endsWith(ext));

        if (!isValid) {
            if (typeof showToast === 'function') {
                showToast('error', 'Format File Salah', 'Hanya file .xlsx, .xls, atau .csv yang didukung.');
            } else {
                alert('Hanya file .xlsx, .xls, atau .csv yang didukung.');
            }
            return;
        }

        picSitesSelectedFile = file;

        // Update selected file display
        const displayEl = document.getElementById('pic-sites-selected-file-display');
        const nameEl = document.getElementById('pic-sites-selected-file-name');
        const sizeEl = document.getElementById('pic-sites-selected-file-size');
        if (displayEl && nameEl && sizeEl) {
            nameEl.textContent = file.name;
            sizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
            displayEl.style.display = 'block';
        }

        // Show sheet selection and set loading state
        const sheetGroup = document.getElementById('pic-sites-import-sheet-group');
        const sheetSelect = document.getElementById('pic-sites-import-sheet-select');
        const sheetHint = document.getElementById('pic-sites-import-sheet-hint');
        const submitBtn = document.getElementById('pic-sites-modal-import-btn');

        if (sheetGroup && sheetSelect) {
            sheetGroup.style.display = 'block';
            sheetSelect.innerHTML = '<option value="">Membaca sheet dari file...</option>';
            sheetSelect.disabled = true;
            if (sheetHint) sheetHint.textContent = 'Mohon tunggu saat membaca sheet...';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Membaca sheet...';
        }

        try {
            const json = await fetchExcelSheets(file);
            if (json.success && json.sheets && json.sheets.length > 0) {
                picSitesFileToken = json.file_token || null;
                sheetSelect.innerHTML = '';
                json.sheets.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    sheetSelect.appendChild(opt);
                });
                sheetSelect.selectedIndex = 0;
                sheetSelect.disabled = false;
                if (sheetHint) {
                    sheetHint.textContent = json.sheets.length === 1
                        ? '1 sheet terdeteksi pada file.'
                        : `${json.sheets.length} sheet ditemukan. Silakan pilih sheet untuk diimpor.`;
                }
            } else {
                sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
                sheetSelect.disabled = false;
                if (sheetHint) sheetHint.textContent = 'Sheet default akan digunakan.';
            }
        } catch (err) {
            if (sheetSelect) {
                sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
                sheetSelect.disabled = false;
            }
            if (sheetHint) sheetHint.textContent = 'Sheet default akan digunakan.';
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah & Impor';
            }
        }
    }

    function clearPicSitesSelectedFile() {
        picSitesSelectedFile = null;
        picSitesFileToken = null;
        const fileInput = document.getElementById('pic-sites-import-file-input');
        if (fileInput) fileInput.value = '';

        const displayEl = document.getElementById('pic-sites-selected-file-display');
        if (displayEl) displayEl.style.display = 'none';

        const sheetGroup = document.getElementById('pic-sites-import-sheet-group');
        const sheetSelect = document.getElementById('pic-sites-import-sheet-select');
        const sheetHint = document.getElementById('pic-sites-import-sheet-hint');
        if (sheetGroup) sheetGroup.style.display = 'none';
        if (sheetSelect) {
            sheetSelect.innerHTML = '<option value="">Pilih Sheet...</option>';
            sheetSelect.disabled = false;
        }
        if (sheetHint) sheetHint.textContent = '';

        const submitBtn = document.getElementById('pic-sites-modal-import-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unggah & Impor';
        }
    }

    async function submitPicSitesImport() {
        if (!picSitesSelectedFile) {
            if (typeof showToast === 'function') {
                showToast('error', 'File Belum Dipilih', 'Silakan pilih atau seret & lepas file Excel.');
            } else {
                alert('Silakan pilih atau seret & lepas file Excel.');
            }
            return;
        }

        const submitBtn = document.getElementById('pic-sites-modal-import-btn');
        const statusDiv = document.getElementById('pic-sites-modal-import-status');
        const replaceExisting = document.getElementById('pic-sites-import-replace-existing')?.checked ? '1' : '0';
        const sheetSelect = document.getElementById('pic-sites-import-sheet-select');
        const sheetName = sheetSelect ? sheetSelect.value : '';

        const formData = new FormData();
        formData.append('action', 'import');
        formData.append('replace_existing', replaceExisting);
        formData.append('sheet_name', sheetName);
        if (picSitesFileToken) {
            formData.append('file_token', picSitesFileToken);
        } else {
            formData.append('excel_file', picSitesSelectedFile);
        }
        formData.append('csrf_token', csrfToken);

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Mengunggah & Memproses...';
        }

        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#eff6ff';
            statusDiv.style.color = '#1d4ed8';
            statusDiv.style.border = '1px solid #bfdbfe';
            statusDiv.textContent = 'Mengunggah dan mengimpor data PIC Sites...';
        }

        try {
            const res = await fetch('api/site_pics.php?action=import', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                },
                body: formData
            });

            const json = await res.json();

            if (json.success) {
                if (statusDiv) {
                    statusDiv.style.background = '#f0fdf4';
                    statusDiv.style.color = '#15803d';
                    statusDiv.style.border = '1px solid #bbf7d0';
                    statusDiv.textContent = json.message || 'Impor berhasil!';
                }

                if (typeof showToast === 'function') {
                    showToast('success', 'Impor Selesai', json.message || 'Data berhasil diimpor.');
                }

                loadPicSites(1);

                setTimeout(() => {
                    closePicSitesImportModal();
                }, 1200);
            } else {
                if (statusDiv) {
                    statusDiv.style.background = '#fef2f2';
                    statusDiv.style.color = '#b91c1c';
                    statusDiv.style.border = '1px solid #fecaca';
                    statusDiv.textContent = json.message || 'Impor gagal.';
                }
                if (typeof showToast === 'function') {
                    showToast('error', 'Impor Gagal', json.message || 'Gagal mengimpor data.');
                } else {
                    alert(json.message || 'Gagal mengimpor data.');
                }
            }
        } catch (err) {
            console.error('Error importing PIC sites:', err);
            if (statusDiv) {
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = 'Kesalahan jaringan: ' + err.message;
            }
            if (typeof showToast === 'function') {
                showToast('error', 'Kesalahan Sistem', 'Terjadi kesalahan jaringan.');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah & Impor';
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // ── Circular Sign PIC Master Data ────────────────────────────────
    // ═════════════════════════════════════════════════════════════════
    let circularPicsCurrentPage = 1;
    let circularPicsPageSize = '10';
    let circularPicsTotalPages = 1;
    let circularPicsTotalItems = 0;
    let circularPicsSearchQuery = '';
    let circularPicsDeptFilter = 'all';
    let circularPicsSubDeptFilter = 'all';
    let circularPicsStatusFilter = 'all';
    let circularPicsSortCol = 'dept';
    let circularPicsSortDir = 'asc';
    let circularPicsDebounceTimer = null;
    let circularPicsCache = [];

    async function loadCircularPics(page = circularPicsCurrentPage) {
        const tbody = document.getElementById('circular-pics-tbody');
        const infoEl = document.getElementById('circular-pics-pagination-info');
        const controlsEl = document.getElementById('circular-pics-pagination-controls');
        if (!tbody) return;

        circularPicsCurrentPage = page;
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 0.8s linear infinite;">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        </svg>
                        <span>Memuat data Circular Sign PIC...</span>
                    </div>
                </td>
            </tr>
        `;

        try {
            const params = new URLSearchParams({
                action: 'list',
                page: circularPicsCurrentPage,
                limit: circularPicsPageSize,
                dept: circularPicsDeptFilter,
                sub_dept: circularPicsSubDeptFilter,
                status: circularPicsStatusFilter,
                search: circularPicsSearchQuery,
                sort_col: circularPicsSortCol,
                sort_dir: circularPicsSortDir
            });

            const res = await fetch(`api/circular_pics.php?${params.toString()}`);
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.message || 'Gagal memuat data');
            }

            circularPicsCache = json.data || [];
            circularPicsTotalItems = json.total || 0;
            circularPicsTotalPages = json.total_pages || 1;

            populateCircularPicsFilters(json.depts || [], json.sub_depts || []);
            renderCircularPicsTable(json.data || []);
            updateCircularPicsPagination(json.page, json.total, json.total_pages);
            updateCircularPicsSortIndicators();

        } catch (err) {
            console.error('Error loading Circular Sign PICs:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 2.5rem; color: #ef4444;">
                        Terjadi kesalahan saat memuat data: ${escapeHtml(err.message || 'Unknown error')}
                    </td>
                </tr>
            `;
            if (infoEl) infoEl.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            if (controlsEl) controlsEl.innerHTML = '';
        }
    }

    function renderCircularPicsTable(rows) {
        const tbody = document.getElementById('circular-pics-tbody');
        if (!tbody) return;

        if (!rows || rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 2.5rem; color: #94a3b8;">
                        Tidak ada data Circular Sign PIC yang ditemukan
                    </td>
                </tr>
            `;
            return;
        }

        const startIndex = circularPicsPageSize === 'all' ? 0 : (circularPicsCurrentPage - 1) * parseInt(circularPicsPageSize, 10);
        let html = '';

        rows.forEach((r, idx) => {
            const no = startIndex + idx + 1;
            const deptText = escapeHtml(r.dept || '-');
            const subDeptText = r.sub_dept ? escapeHtml(r.sub_dept) : '';
            const isActive = r.is_active === true || r.is_active === 1 || r.is_active === '1' || r.is_active === 't';

            html += `
                <tr id="circular-pic-row-${r.id}" class="${!isActive ? 'row-inactive' : ''}" style="${!isActive ? 'opacity: 0.65; background-color: #f8fafc;' : ''}">
                    <td class="text-center" style="color: #64748b; vertical-align: middle;">${no}</td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">${deptText}</span>
                            ${subDeptText ? `<span style="font-size: 11.5px; font-weight: 600; color: #475569;">/ ${subDeptText}</span>` : ''}
                        </div>
                    </td>
                    <td class="circular-pic-name-cell" style="vertical-align: middle;">
                        <div style="display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                            <span style="font-weight: 600; color: ${isActive ? '#0f172a' : '#64748b'};">${escapeHtml(r.pic || '-')}</span>
                            ${!isActive ? `<span class="badge circular-pic-inactive-badge" style="background: #f1f5f9; color: #64748b; font-size: 10px; font-weight: 600; border: 1px solid #cbd5e1; padding: 1px 5px; border-radius: 4px;">Inactive</span>` : ''}
                        </div>
                    </td>
                    <td style="vertical-align: middle;">
                        <span style="font-weight: 500; color: ${isActive ? '#334155' : '#64748b'};">${escapeHtml(r.job_title || '-')}</span>
                    </td>
                    <td class="text-center col-action-edit" style="vertical-align: middle; width: 50px;">
                        <button class="btn btn-outline-primary btn-sm" onclick="App.openEditCircularPicModal(${r.id})"
                            style="font-size: 11px; padding: 2px 7px;">
                            Edit
                        </button>
                    </td>
                    <td class="text-center col-action-delete" style="vertical-align: middle; width: 50px;">
                        <button class="btn btn-danger btn-sm btn-delete" onclick="App.deleteCircularPic(${r.id})"
                            style="font-size: 11px; padding: 2px 7px;">
                            Hapus
                        </button>
                    </td>
                    <td class="text-center col-action-active" style="vertical-align: middle; width: 44px;">
                        <input type="checkbox" class="circular-pic-active-checkbox"
                            ${isActive ? 'checked' : ''}
                            onchange="App.toggleCircularPicActive(${r.id}, this.checked, this)"
                            title="${isActive ? 'User aktif (klik untuk nonaktifkan)' : 'User nonaktif (klik untuk aktifkan)'}"
                            style="cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb; vertical-align: middle;">
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    async function toggleCircularPicActive(id, isActive, checkboxEl) {
        if (!id) return;
        const origChecked = !isActive;
        try {
            const res = await fetch('api/circular_pics.php?action=toggle_active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: isActive })
            });
            const json = await res.json();
            if (!json.success) {
                if (checkboxEl) checkboxEl.checked = origChecked;
                alert(json.message || 'Gagal mengubah status aktif');
                return;
            }

            const item = circularPicsCache.find(x => x.id === id);
            if (item) {
                item.is_active = isActive;
            }

            if (circularPicsStatusFilter !== 'all') {
                loadCircularPics(circularPicsCurrentPage);
            } else {
                const row = document.getElementById(`circular-pic-row-${id}`);
                if (row) {
                    if (isActive) {
                        row.classList.remove('row-inactive');
                        row.style.opacity = '1';
                        row.style.backgroundColor = '';
                        const badge = row.querySelector('.circular-pic-inactive-badge');
                        if (badge) badge.remove();
                    } else {
                        row.classList.add('row-inactive');
                        row.style.opacity = '0.65';
                        row.style.backgroundColor = '#f8fafc';
                        const picCell = row.querySelector('.circular-pic-name-cell div');
                        if (picCell && !picCell.querySelector('.circular-pic-inactive-badge')) {
                            const badge = document.createElement('span');
                            badge.className = 'badge circular-pic-inactive-badge';
                            badge.style.cssText = 'background: #f1f5f9; color: #64748b; font-size: 10px; font-weight: 600; border: 1px solid #cbd5e1; padding: 1px 5px; border-radius: 4px;';
                            badge.textContent = 'Inactive';
                            picCell.appendChild(badge);
                        }
                    }
                }
            }

            if (typeof showToast === 'function') {
                showToast('success', 'Status Diperbarui', isActive ? 'User Circular PIC diaktifkan' : 'User Circular PIC dinonaktifkan (inactive)');
            }
        } catch (err) {
            console.error('Error toggling circular pic status:', err);
            if (checkboxEl) checkboxEl.checked = origChecked;
            alert('Gagal mengubah status aktif');
        }
    }

    function updateCircularPicsPagination(page, total, totalPages) {
        const infoEl = document.getElementById('circular-pics-pagination-info');
        const controlsEl = document.getElementById('circular-pics-pagination-controls');

        if (infoEl) {
            const start = total > 0 ? (page - 1) * (circularPicsPageSize === 'all' ? total : parseInt(circularPicsPageSize, 10)) + 1 : 0;
            const end = circularPicsPageSize === 'all' ? total : Math.min(page * parseInt(circularPicsPageSize, 10), total);
            infoEl.textContent = `Menampilkan ${start.toLocaleString('id-ID')} sampai ${end.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} data`;
        }

        if (controlsEl) {
            if (totalPages <= 1 || circularPicsPageSize === 'all') {
                controlsEl.innerHTML = '';
                return;
            }

            let html = '';
            html += `<button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="App.goToCircularPicsPage(${page - 1})">&laquo; Prev</button>`;

            const maxButtons = 5;
            let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }

            if (startPage > 1) {
                html += `<button class="pagination-btn" onclick="App.goToCircularPicsPage(1)">1</button>`;
                if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
            }

            for (let p = startPage; p <= endPage; p++) {
                html += `<button class="pagination-btn ${p === page ? 'active' : ''}" onclick="App.goToCircularPicsPage(${p})">${p}</button>`;
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
                html += `<button class="pagination-btn" onclick="App.goToCircularPicsPage(${totalPages})">${totalPages}</button>`;
            }

            html += `<button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="App.goToCircularPicsPage(${page + 1})">Next &raquo;</button>`;
            controlsEl.innerHTML = html;
        }
    }

    function goToCircularPicsPage(p) {
        if (p < 1) p = 1;
        if (p > circularPicsTotalPages) p = circularPicsTotalPages;
        loadCircularPics(p);
    }

    function changeCircularPicsPageSize(sz) {
        circularPicsPageSize = sz;
        circularPicsCurrentPage = 1;
        loadCircularPics(1);
    }

    function handleCircularPicsSearch(val) {
        clearTimeout(circularPicsDebounceTimer);
        circularPicsDebounceTimer = setTimeout(() => {
            circularPicsSearchQuery = (val || '').trim();
            circularPicsCurrentPage = 1;
            loadCircularPics(1);
        }, 300);
    }

    function onCircularPicsDeptFilterChange() {
        const el = document.getElementById('circular-pics-filter-dept');
        circularPicsDeptFilter = el ? el.value : 'all';
        circularPicsCurrentPage = 1;
        loadCircularPics(1);
    }

    function onCircularPicsSubDeptFilterChange() {
        const el = document.getElementById('circular-pics-filter-subdept');
        circularPicsSubDeptFilter = el ? el.value : 'all';
        circularPicsCurrentPage = 1;
        loadCircularPics(1);
    }

    function onCircularPicsStatusFilterChange() {
        const el = document.getElementById('circular-pics-filter-status');
        circularPicsStatusFilter = el ? el.value : 'all';
        circularPicsCurrentPage = 1;
        loadCircularPics(1);
    }

    function populateCircularPicsFilters(depts, subDepts) {
        const deptSelect = document.getElementById('circular-pics-filter-dept');
        const subDeptSelect = document.getElementById('circular-pics-filter-subdept');

        if (deptSelect && deptSelect.options.length <= 1 && Array.isArray(depts)) {
            const currentVal = deptSelect.value;
            deptSelect.innerHTML = '<option value="all">Semua Dept</option>';
            depts.forEach(d => {
                if (d && d.trim()) {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.textContent = d;
                    if (d === currentVal) opt.selected = true;
                    deptSelect.appendChild(opt);
                }
            });
        }

        if (subDeptSelect && subDeptSelect.options.length <= 1 && Array.isArray(subDepts)) {
            const currentVal = subDeptSelect.value;
            subDeptSelect.innerHTML = '<option value="all">Semua Sub Dept</option>';
            subDepts.forEach(s => {
                if (s && s.trim()) {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    if (s === currentVal) opt.selected = true;
                    subDeptSelect.appendChild(opt);
                }
            });
        }
    }

    function toggleCircularPicsSort(col) {
        if (circularPicsSortCol === col) {
            circularPicsSortDir = circularPicsSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            circularPicsSortCol = col;
            circularPicsSortDir = 'asc';
        }
        loadCircularPics(1);
    }

    function updateCircularPicsSortIndicators() {
        document.querySelectorAll('#circular-pics-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#circular-pics-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (circularPicsSortCol) {
            const activeTh = document.querySelector(`#circular-pics-table th.sortable[onclick*="'${circularPicsSortCol}'"]`);
            if (activeTh) activeTh.classList.add(circularPicsSortDir);
            const activeInd = document.querySelector(`#circular-pics-table .sort-indicator[data-cpics-col="${circularPicsSortCol}"]`);
            if (activeInd) activeInd.textContent = circularPicsSortDir === 'asc' ? '▲' : '▼';
        }
    }

    function exportCircularPicsExcel() {
        const params = new URLSearchParams({
            action: 'export',
            dept: circularPicsDeptFilter,
            sub_dept: circularPicsSubDeptFilter,
            status: circularPicsStatusFilter,
            search: circularPicsSearchQuery
        });
        window.location.href = `api/circular_pics.php?${params.toString()}`;
    }

    function downloadCircularPicsTemplate() {
        window.location.href = 'api/circular_pics.php?action=template';
    }

    function openAddCircularPicModal() {
        document.getElementById('circular-pic-modal-title').textContent = 'Tambah Circular Sign PIC';
        document.getElementById('circular-pic-id').value = '';
        document.getElementById('circular-pic-dept').value = '';
        document.getElementById('circular-pic-subdept').value = '';
        document.getElementById('circular-pic-pic').value = '';
        document.getElementById('circular-pic-job-title').value = '';
        const activeChk = document.getElementById('circular-pic-is-active');
        if (activeChk) activeChk.checked = true;

        const modal = document.getElementById('circular-pic-modal');
        if (modal) modal.style.display = 'flex';
    }

    function openEditCircularPicModal(id) {
        const item = circularPicsCache.find(x => x.id === id);
        if (!item) return;

        document.getElementById('circular-pic-modal-title').textContent = 'Edit Circular Sign PIC';
        document.getElementById('circular-pic-id').value = item.id;
        document.getElementById('circular-pic-dept').value = item.dept || '';
        document.getElementById('circular-pic-subdept').value = item.sub_dept || '';
        document.getElementById('circular-pic-pic').value = item.pic || '';
        document.getElementById('circular-pic-job-title').value = item.job_title || '';
        const activeChk = document.getElementById('circular-pic-is-active');
        if (activeChk) {
            activeChk.checked = item.is_active !== false && item.is_active !== 0 && item.is_active !== '0' && item.is_active !== 'f';
        }

        const modal = document.getElementById('circular-pic-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeCircularPicModal() {
        const modal = document.getElementById('circular-pic-modal');
        if (modal) modal.style.display = 'none';
    }

    async function submitCircularPicForm(e) {
        if (e) e.preventDefault();
        const btn = document.getElementById('btn-save-circular-pic');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';
        }

        try {
            const activeChk = document.getElementById('circular-pic-is-active');
            const payload = {
                id: document.getElementById('circular-pic-id').value || null,
                dept: document.getElementById('circular-pic-dept').value.trim(),
                sub_dept: document.getElementById('circular-pic-subdept').value.trim(),
                pic: document.getElementById('circular-pic-pic').value.trim(),
                job_title: document.getElementById('circular-pic-job-title').value.trim(),
                is_active: activeChk ? activeChk.checked : true
            };

            const res = await fetch('api/circular_pics.php?action=save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (!json.success) {
                alert(json.message || 'Gagal menyimpan data');
                return;
            }

            closeCircularPicModal();
            loadCircularPics(circularPicsCurrentPage);
            if (typeof showToast === 'function') {
                showToast('success', 'Berhasil', json.message);
            } else {
                alert(json.message);
            }
        } catch (err) {
            console.error('Error saving Circular Sign PIC:', err);
            alert('Terjadi kesalahan jaringan saat menyimpan data');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    }

    async function deleteCircularPic(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus data Circular Sign PIC ini?')) return;
        try {
            const res = await fetch('api/circular_pics.php?action=delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const json = await res.json();
            if (!json.success) {
                alert(json.message || 'Gagal menghapus data');
                return;
            }
            loadCircularPics(circularPicsCurrentPage);
            if (typeof showToast === 'function') {
                showToast('success', 'Berhasil', json.message);
            } else {
                alert(json.message);
            }
        } catch (err) {
            console.error('Error deleting Circular Sign PIC:', err);
            alert('Gagal menghapus data');
        }
    }

    // ── Circular Sign PIC Import Excel ───────────────────────────────
    let circularPicsSelectedFile = null;
    let circularPicsFileToken = null;

    function setupCircularPicsDragAndDrop() {
        const dropZone = document.getElementById('circular-pics-drag-drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleCircularPicsFileSelect(dt.files);
            }
        });
    }

    function openCircularPicsImportModal() {
        clearCircularPicsSelectedFile();
        const statusDiv = document.getElementById('circular-pics-modal-import-status');
        if (statusDiv) {
            statusDiv.style.display = 'none';
            statusDiv.textContent = '';
        }
        const chk = document.getElementById('circular-pics-import-replace-existing');
        if (chk) chk.checked = false;

        const modal = document.getElementById('circular-pics-import-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeCircularPicsImportModal() {
        const modal = document.getElementById('circular-pics-import-modal');
        if (modal) modal.style.display = 'none';
        clearCircularPicsSelectedFile();
    }

    async function handleCircularPicsFileSelect(files) {
        if (!files || files.length === 0) return;
        const file = files[0];
        const validExts = ['.xlsx', '.xls', '.csv'];
        const nameLower = file.name.toLowerCase();
        const isValid = validExts.some(ext => nameLower.endsWith(ext));

        if (!isValid) {
            if (typeof showToast === 'function') {
                showToast('error', 'Format File Salah', 'Hanya file .xlsx, .xls, atau .csv yang didukung.');
            } else {
                alert('Hanya file .xlsx, .xls, atau .csv yang didukung.');
            }
            return;
        }

        circularPicsSelectedFile = file;

        // Update selected file display
        const displayEl = document.getElementById('circular-pics-selected-file-display');
        const nameEl = document.getElementById('circular-pics-selected-file-name');
        const sizeEl = document.getElementById('circular-pics-selected-file-size');
        if (displayEl && nameEl && sizeEl) {
            nameEl.textContent = file.name;
            sizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
            displayEl.style.display = 'block';
        }

        // Show sheet selection and set loading state
        const sheetGroup = document.getElementById('circular-pics-import-sheet-group');
        const sheetSelect = document.getElementById('circular-pics-import-sheet-select');
        const sheetHint = document.getElementById('circular-pics-import-sheet-hint');
        const submitBtn = document.getElementById('circular-pics-modal-import-btn');

        if (sheetGroup && sheetSelect) {
            sheetGroup.style.display = 'block';
            sheetSelect.innerHTML = '<option value="">Membaca sheet dari file...</option>';
            sheetSelect.disabled = true;
            if (sheetHint) sheetHint.textContent = 'Mohon tunggu saat membaca sheet...';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Membaca sheet...';
        }

        try {
            const json = await fetchExcelSheets(file);
            if (json.success && json.sheets && json.sheets.length > 0) {
                circularPicsFileToken = json.file_token || null;
                sheetSelect.innerHTML = '';
                json.sheets.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    sheetSelect.appendChild(opt);
                });
                sheetSelect.selectedIndex = 0;
                sheetSelect.disabled = false;
                if (sheetHint) {
                    sheetHint.textContent = json.sheets.length === 1
                        ? '1 sheet terdeteksi pada file.'
                        : `${json.sheets.length} sheet ditemukan. Silakan pilih sheet untuk diimpor.`;
                }
            } else {
                sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
                sheetSelect.disabled = false;
                if (sheetHint) sheetHint.textContent = 'Sheet default akan digunakan.';
            }
        } catch (err) {
            if (sheetSelect) {
                sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
                sheetSelect.disabled = false;
            }
            if (sheetHint) sheetHint.textContent = 'Sheet default akan digunakan.';
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah & Impor';
            }
        }
    }

    function clearCircularPicsSelectedFile() {
        circularPicsSelectedFile = null;
        circularPicsFileToken = null;
        const fileInput = document.getElementById('circular-pics-import-file-input');
        if (fileInput) fileInput.value = '';

        const displayEl = document.getElementById('circular-pics-selected-file-display');
        if (displayEl) displayEl.style.display = 'none';

        const sheetGroup = document.getElementById('circular-pics-import-sheet-group');
        const sheetSelect = document.getElementById('circular-pics-import-sheet-select');
        const sheetHint = document.getElementById('circular-pics-import-sheet-hint');
        if (sheetGroup) sheetGroup.style.display = 'none';
        if (sheetSelect) {
            sheetSelect.innerHTML = '<option value="">Pilih Sheet...</option>';
            sheetSelect.disabled = false;
        }
        if (sheetHint) sheetHint.textContent = '';

        const submitBtn = document.getElementById('circular-pics-modal-import-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unggah & Impor';
        }
    }

    async function submitCircularPicsImport() {
        if (!circularPicsSelectedFile) {
            if (typeof showToast === 'function') {
                showToast('error', 'File Belum Dipilih', 'Silakan pilih atau seret & lepas file Excel.');
            } else {
                alert('Silakan pilih atau seret & lepas file Excel.');
            }
            return;
        }

        const submitBtn = document.getElementById('circular-pics-modal-import-btn');
        const statusDiv = document.getElementById('circular-pics-modal-import-status');
        const replaceExisting = document.getElementById('circular-pics-import-replace-existing')?.checked ? '1' : '0';
        const sheetSelect = document.getElementById('circular-pics-import-sheet-select');
        const sheetName = sheetSelect ? sheetSelect.value : '';

        const formData = new FormData();
        formData.append('action', 'import');
        formData.append('replace_existing', replaceExisting);
        formData.append('sheet_name', sheetName);
        if (circularPicsFileToken) {
            formData.append('file_token', circularPicsFileToken);
        } else {
            formData.append('excel_file', circularPicsSelectedFile);
        }
        formData.append('csrf_token', csrfToken);

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Mengunggah & Memproses...';
        }

        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#eff6ff';
            statusDiv.style.color = '#1d4ed8';
            statusDiv.style.border = '1px solid #bfdbfe';
            statusDiv.textContent = 'Mengunggah dan mengimpor data Circular Sign PIC...';
        }

        try {
            const res = await fetch('api/circular_pics.php?action=import', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                },
                body: formData
            });

            const json = await res.json();

            if (json.success) {
                if (statusDiv) {
                    statusDiv.style.background = '#f0fdf4';
                    statusDiv.style.color = '#15803d';
                    statusDiv.style.border = '1px solid #bbf7d0';
                    statusDiv.textContent = json.message || 'Impor berhasil!';
                }

                if (typeof showToast === 'function') {
                    showToast('success', 'Impor Selesai', json.message || 'Data berhasil diimpor.');
                }

                loadCircularPics(1);

                setTimeout(() => {
                    closeCircularPicsImportModal();
                }, 1200);
            } else {
                if (statusDiv) {
                    statusDiv.style.background = '#fef2f2';
                    statusDiv.style.color = '#b91c1c';
                    statusDiv.style.border = '1px solid #fecaca';
                    statusDiv.textContent = json.message || 'Impor gagal.';
                }
                if (typeof showToast === 'function') {
                    showToast('error', 'Impor Gagal', json.message || 'Gagal mengimpor data.');
                } else {
                    alert(json.message || 'Gagal mengimpor data.');
                }
            }
        } catch (err) {
            console.error('Error importing Circular Sign PICs:', err);
            if (statusDiv) {
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = 'Kesalahan jaringan: ' + err.message;
            }
            if (typeof showToast === 'function') {
                showToast('error', 'Kesalahan Sistem', 'Terjadi kesalahan jaringan.');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah & Impor';
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // ── Template Report Master Data (Word & PDF) ─────────────────────
    // ═════════════════════════════════════════════════════════════════
    let templateReportsCurrentPage = 1;
    let templateReportsPageSize = '10';
    let templateReportsTotalPages = 1;
    let templateReportsTotalItems = 0;
    let templateReportsSearchQuery = '';
    let templateReportsTypeFilter = 'all';
    let templateReportsSortCol = 'created_at';
    let templateReportsSortDir = 'desc';
    let templateReportsDebounceTimer = null;
    let templateReportsCache = [];
    let templateReportSelectedFile = null;

    async function loadTemplateReports(page = templateReportsCurrentPage) {
        const tbody = document.getElementById('template-reports-tbody');
        const infoEl = document.getElementById('template-reports-pagination-info');
        const controlsEl = document.getElementById('template-reports-pagination-controls');
        if (!tbody) return;

        templateReportsCurrentPage = page;
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 0.8s linear infinite;">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        </svg>
                        <span>Memuat data Template Report...</span>
                    </div>
                </td>
            </tr>
        `;

        try {
            const params = new URLSearchParams({
                action: 'list',
                page: templateReportsCurrentPage,
                limit: templateReportsPageSize,
                type: templateReportsTypeFilter,
                search: templateReportsSearchQuery,
                sort_col: templateReportsSortCol,
                sort_dir: templateReportsSortDir
            });

            const res = await fetch(`api/template_reports.php?${params.toString()}`);
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.message || 'Gagal memuat template');
            }

            templateReportsCache = json.data || [];
            templateReportsTotalItems = json.total || 0;
            templateReportsTotalPages = json.total_pages || 1;

            renderTemplateReportsTable(json.data || []);
            updateTemplateReportsPagination(json.page, json.total, json.total_pages);
            updateTemplateReportsSortIndicators();

        } catch (err) {
            console.error('Error loading Template Reports:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 2.5rem; color: #ef4444;">
                        Terjadi kesalahan saat memuat data: ${escapeHtml(err.message || 'Unknown error')}
                    </td>
                </tr>
            `;
            if (infoEl) infoEl.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            if (controlsEl) controlsEl.innerHTML = '';
        }
    }

    function formatTemplateFileSize(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function renderTemplateReportsTable(rows) {
        const tbody = document.getElementById('template-reports-tbody');
        if (!tbody) return;

        if (!rows || rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 2.5rem; color: #94a3b8;">
                        Tidak ada data Template Report yang ditemukan
                    </td>
                </tr>
            `;
            return;
        }

        const startIndex = templateReportsPageSize === 'all' ? 0 : (templateReportsCurrentPage - 1) * parseInt(templateReportsPageSize, 10);
        let html = '';

        rows.forEach((r, idx) => {
            const no = startIndex + idx + 1;
            const isWord = r.file_type === 'word' || r.file_ext === 'docx' || r.file_ext === 'doc';
            const badgeType = isWord
                ? `<span class="badge" style="background: #eff6ff; color: #1d4ed8; font-weight: 700; border: 1px solid #bfdbfe; font-size: 11px;">Word (.${escapeHtml(r.file_ext || 'docx')})</span>`
                : `<span class="badge" style="background: #fef2f2; color: #b91c1c; font-weight: 700; border: 1px solid #fecaca; font-size: 11px;">PDF (.pdf)</span>`;

            const docIcon = isWord
                ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: #dbeafe; color: #1d4ed8; font-size: 13px; font-weight: 700;">W</span>`
                : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: #fee2e2; color: #b91c1c; font-size: 13px; font-weight: 700;">P</span>`;

            const dateStr = r.created_at ? r.created_at.substring(0, 16) : '-';

            html += `
                <tr id="template-report-row-${r.id}">
                    <td class="text-center" style="color: #64748b; vertical-align: middle;">${no}</td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${docIcon}
                            <div>
                                <div style="font-weight: 600; color: #0f172a;">${escapeHtml(r.title || '-')}</div>
                                <div style="font-size: 11px; color: #64748b; font-family: monospace;">${escapeHtml(r.file_name || '-')}</div>
                            </div>
                        </div>
                    </td>
                    <td class="text-center" style="vertical-align: middle;">${badgeType}</td>
                    <td style="vertical-align: middle; color: #475569; font-size: 12.5px;">${escapeHtml(r.description || '-')}</td>
                    <td class="text-center" style="vertical-align: middle; font-size: 12px; color: #64748b; font-family: monospace;">${formatTemplateFileSize(r.file_size)}</td>
                    <td class="text-center" style="vertical-align: middle; font-size: 12px; color: #64748b;">${escapeHtml(dateStr)}</td>
                    <td class="text-center" style="vertical-align: middle;">
                        <div style="display: inline-flex; align-items: center; gap: 4px;">
                            <a href="api/template_reports.php?action=download&id=${r.id}" class="btn btn-outline-primary btn-sm"
                                style="font-size: 11px; padding: 2px 7px; text-decoration: none;" title="Unduh File Template">
                                Download
                            </a>
                            <button class="btn btn-outline-secondary btn-sm" onclick="App.openTemplateReportEditModal(${r.id})"
                                style="font-size: 11px; padding: 2px 7px;">
                                Edit
                            </button>
                            <button class="btn btn-danger btn-sm btn-delete" onclick="App.deleteTemplateReport(${r.id})"
                                style="font-size: 11px; padding: 2px 7px;">
                                Hapus
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function updateTemplateReportsPagination(page, total, totalPages) {
        const infoEl = document.getElementById('template-reports-pagination-info');
        const controlsEl = document.getElementById('template-reports-pagination-controls');

        if (infoEl) {
            const start = total > 0 ? (page - 1) * (templateReportsPageSize === 'all' ? total : parseInt(templateReportsPageSize, 10)) + 1 : 0;
            const end = templateReportsPageSize === 'all' ? total : Math.min(page * parseInt(templateReportsPageSize, 10), total);
            infoEl.textContent = `Menampilkan ${start.toLocaleString('id-ID')} sampai ${end.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} data`;
        }

        if (controlsEl) {
            if (totalPages <= 1 || templateReportsPageSize === 'all') {
                controlsEl.innerHTML = '';
                return;
            }

            let html = '';
            html += `<button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="App.goToTemplateReportsPage(${page - 1})">&laquo; Prev</button>`;

            const maxButtons = 5;
            let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }

            if (startPage > 1) {
                html += `<button class="pagination-btn" onclick="App.goToTemplateReportsPage(1)">1</button>`;
                if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
            }

            for (let p = startPage; p <= endPage; p++) {
                html += `<button class="pagination-btn ${p === page ? 'active' : ''}" onclick="App.goToTemplateReportsPage(${p})">${p}</button>`;
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
                html += `<button class="pagination-btn" onclick="App.goToTemplateReportsPage(${totalPages})">${totalPages}</button>`;
            }

            html += `<button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="App.goToTemplateReportsPage(${page + 1})">Next &raquo;</button>`;
            controlsEl.innerHTML = html;
        }
    }

    function goToTemplateReportsPage(p) {
        if (p < 1) p = 1;
        if (p > templateReportsTotalPages) p = templateReportsTotalPages;
        loadTemplateReports(p);
    }

    function changeTemplateReportsPageSize(sz) {
        templateReportsPageSize = sz;
        templateReportsCurrentPage = 1;
        loadTemplateReports(1);
    }

    function handleTemplateReportsSearch(val) {
        clearTimeout(templateReportsDebounceTimer);
        templateReportsDebounceTimer = setTimeout(() => {
            templateReportsSearchQuery = (val || '').trim();
            templateReportsCurrentPage = 1;
            loadTemplateReports(1);
        }, 300);
    }

    function onTemplateReportsFilterTypeChange() {
        const el = document.getElementById('template-reports-filter-type');
        templateReportsTypeFilter = el ? el.value : 'all';
        templateReportsCurrentPage = 1;
        loadTemplateReports(1);
    }

    function toggleTemplateReportsSort(col) {
        if (templateReportsSortCol === col) {
            templateReportsSortDir = templateReportsSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            templateReportsSortCol = col;
            templateReportsSortDir = 'asc';
        }
        loadTemplateReports(1);
    }

    function updateTemplateReportsSortIndicators() {
        document.querySelectorAll('#template-reports-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#template-reports-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (templateReportsSortCol) {
            const activeTh = document.querySelector(`#template-reports-table th.sortable[onclick*="'${templateReportsSortCol}'"]`);
            if (activeTh) activeTh.classList.add(templateReportsSortDir);
            const activeInd = document.querySelector(`#template-reports-table .sort-indicator[data-tr-col="${templateReportsSortCol}"]`);
            if (activeInd) activeInd.textContent = templateReportsSortDir === 'asc' ? '▲' : '▼';
        }
    }

    // ── Template Report Upload / Import Modal ────────────────────────
    function setupTemplateReportDragAndDrop() {
        const dropZone = document.getElementById('template-report-drag-drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleTemplateReportFileSelect(dt.files);
            }
        });
    }

    function openTemplateReportUploadModal() {
        clearTemplateReportSelectedFile();
        const titleInput = document.getElementById('template-report-title');
        const descInput = document.getElementById('template-report-desc');
        const statusDiv = document.getElementById('template-report-modal-status');
        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (statusDiv) {
            statusDiv.style.display = 'none';
            statusDiv.textContent = '';
        }
        const modal = document.getElementById('template-report-upload-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeTemplateReportUploadModal() {
        const modal = document.getElementById('template-report-upload-modal');
        if (modal) modal.style.display = 'none';
        clearTemplateReportSelectedFile();
    }

    function handleTemplateReportFileSelect(files) {
        if (!files || files.length === 0) return;
        const file = files[0];
        const validExts = ['.docx', '.doc', '.pdf'];
        const nameLower = file.name.toLowerCase();
        const isValid = validExts.some(ext => nameLower.endsWith(ext));

        if (!isValid) {
            if (typeof showToast === 'function') {
                showToast('error', 'Format File Tidak Sesuai', 'Hanya file Word (.docx, .doc) dan PDF (.pdf) yang diperbolehkan.');
            } else {
                alert('Hanya file Word (.docx, .doc) dan PDF (.pdf) yang diperbolehkan.');
            }
            return;
        }

        templateReportSelectedFile = file;

        // Auto-fill title if empty
        const titleInput = document.getElementById('template-report-title');
        if (titleInput && !titleInput.value.trim()) {
            const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_.-]+/g, ' ');
            titleInput.value = cleanName;
        }

        const displayEl = document.getElementById('template-report-selected-file-display');
        const nameEl = document.getElementById('template-report-selected-file-name');
        const sizeEl = document.getElementById('template-report-selected-file-size');
        const iconEl = document.getElementById('template-report-selected-file-icon');
        if (displayEl && nameEl && sizeEl) {
            nameEl.textContent = file.name;
            sizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
            if (iconEl) {
                iconEl.textContent = nameLower.endsWith('.pdf') ? '📕' : '📘';
            }
            displayEl.style.display = 'block';
        }
    }

    function clearTemplateReportSelectedFile() {
        templateReportSelectedFile = null;
        const fileInput = document.getElementById('template-report-file-input');
        if (fileInput) fileInput.value = '';
        const displayEl = document.getElementById('template-report-selected-file-display');
        if (displayEl) displayEl.style.display = 'none';
    }

    async function submitTemplateReportUpload(e) {
        if (e) e.preventDefault();
        if (!templateReportSelectedFile) {
            alert('Silakan pilih file Word (.docx, .doc) atau PDF terlebih dahulu.');
            return;
        }

        const title = (document.getElementById('template-report-title')?.value || '').trim();
        const desc = (document.getElementById('template-report-desc')?.value || '').trim();
        const submitBtn = document.getElementById('btn-upload-template-report');
        const statusDiv = document.getElementById('template-report-modal-status');

        if (!title) {
            alert('Nama template wajib diisi.');
            return;
        }

        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('template_file', templateReportSelectedFile);
        formData.append('title', title);
        formData.append('description', desc);

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Mengunggah...';
        }
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#eff6ff';
            statusDiv.style.color = '#1d4ed8';
            statusDiv.style.border = '1px solid #bfdbfe';
            statusDiv.textContent = 'Sedang mengunggah template report...';
        }

        try {
            const res = await fetch('api/template_reports.php?action=upload', {
                method: 'POST',
                body: formData
            });
            const json = await res.json();

            if (json.success) {
                if (statusDiv) {
                    statusDiv.style.background = '#f0fdf4';
                    statusDiv.style.color = '#15803d';
                    statusDiv.style.border = '1px solid #bbf7d0';
                    statusDiv.textContent = json.message || 'Template berhasil diunggah!';
                }
                if (typeof showToast === 'function') {
                    showToast('success', 'Berhasil', json.message || 'Template report berhasil diunggah.');
                }
                loadTemplateReports(1);
                setTimeout(() => {
                    closeTemplateReportUploadModal();
                }, 1000);
            } else {
                if (statusDiv) {
                    statusDiv.style.background = '#fef2f2';
                    statusDiv.style.color = '#b91c1c';
                    statusDiv.style.border = '1px solid #fecaca';
                    statusDiv.textContent = json.message || 'Gagal mengunggah template.';
                }
                alert(json.message || 'Gagal mengunggah template.');
            }
        } catch (err) {
            console.error('Error uploading template report:', err);
            alert('Terjadi kesalahan jaringan saat mengunggah file.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah Template';
            }
        }
    }

    function openTemplateReportEditModal(id) {
        const item = templateReportsCache.find(x => x.id === id);
        if (!item) return;

        document.getElementById('edit-template-report-id').value = item.id;
        document.getElementById('edit-template-report-title').value = item.title || '';
        document.getElementById('edit-template-report-desc').value = item.description || '';

        const modal = document.getElementById('template-report-edit-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeTemplateReportEditModal() {
        const modal = document.getElementById('template-report-edit-modal');
        if (modal) modal.style.display = 'none';
    }

    async function submitTemplateReportEdit(e) {
        if (e) e.preventDefault();
        const id = document.getElementById('edit-template-report-id')?.value;
        const title = (document.getElementById('edit-template-report-title')?.value || '').trim();
        const desc = (document.getElementById('edit-template-report-desc')?.value || '').trim();

        if (!id || !title) {
            alert('Nama template wajib diisi.');
            return;
        }

        const btn = document.getElementById('btn-save-edit-template-report');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';
        }

        try {
            const res = await fetch('api/template_reports.php?action=edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, title, description: desc })
            });
            const json = await res.json();

            if (!json.success) {
                alert(json.message || 'Gagal memperbarui data.');
                return;
            }

            closeTemplateReportEditModal();
            loadTemplateReports(templateReportsCurrentPage);
            if (typeof showToast === 'function') {
                showToast('success', 'Berhasil', json.message);
            } else {
                alert(json.message);
            }
        } catch (err) {
            console.error('Error updating template report:', err);
            alert('Gagal memperbarui template report.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Simpan Perubahan';
            }
        }
    }

    async function deleteTemplateReport(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus file template report ini?')) return;
        try {
            const res = await fetch('api/template_reports.php?action=delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const json = await res.json();
            if (!json.success) {
                alert(json.message || 'Gagal menghapus template');
                return;
            }
            loadTemplateReports(templateReportsCurrentPage);
            if (typeof showToast === 'function') {
                showToast('success', 'Berhasil', json.message);
            } else {
                alert(json.message);
            }
        } catch (err) {
            console.error('Error deleting template report:', err);
            alert('Gagal menghapus template report');
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // ── Reports Page (Berita Acara & WhatsApp Delivery) ───────────────
    // ═════════════════════════════════════════════════════════════════
    function getUserReportsDepts() {
        if (!window.AUTH_USER || !window.AUTH_USER.permissions) {
            return ['ALL'];
        }
        const raw = window.AUTH_USER.permissions.reports_depts;
        if (!raw || raw === 'ALL') return ['ALL'];
        if (Array.isArray(raw)) return raw.map(d => d.toUpperCase().trim()).filter(Boolean);
        return raw.split(',').map(d => d.toUpperCase().trim()).filter(Boolean);
    }

    let reportsState = {
        page: 1,
        limit: 15,
        so_type: 'monthly',
        dept: 'all',
        sub_dept: 'all',
        status: 'all',
        search: '',
        total: 0,
        totalPages: 1,
        data: [],
        activeSitecode: '',
        activePdfUrl: '',
        activeWaPhone: '',
        generatingSites: {}
    };

    function switchReportsSOType(type) {
        reportsState.so_type = (type === 'quarterly') ? 'quarterly' : 'monthly';
        try {
            sessionStorage.setItem('reports_so_type', reportsState.so_type);
        } catch (e) { }

        const btnMonthly = document.getElementById('reports-btn-so-type-monthly');
        const btnQuarterly = document.getElementById('reports-btn-so-type-quarterly');
        if (btnMonthly && btnQuarterly) {
            btnMonthly.classList.toggle('active', reportsState.so_type === 'monthly');
            btnQuarterly.classList.toggle('active', reportsState.so_type === 'quarterly');
        }

        updateReportsMonthDropdown();
        reportsState.page = 1;
        reportsVerifState.page = 1;
        loadReportsData(1);
        loadReportsVerificationData(1);
    }

    function updateReportsMonthDropdown() {
        const monthSelect = document.getElementById('reports-filter-month');
        if (!monthSelect) return;

        const currentVal = monthSelect.value;
        const optionsList = (reportsState.so_type === 'quarterly') ? [
            { val: '3', label: 'Maret' },
            { val: '6', label: 'Juni' },
            { val: '9', label: 'September' },
            { val: '12', label: 'Desember' }
        ] : [
            { val: '1', label: 'Januari' },
            { val: '2', label: 'Februari' },
            { val: '3', label: 'Maret' },
            { val: '4', label: 'April' },
            { val: '5', label: 'Mei' },
            { val: '6', label: 'Juni' },
            { val: '7', label: 'Juli' },
            { val: '8', label: 'Agustus' },
            { val: '9', label: 'September' },
            { val: '10', label: 'Oktober' },
            { val: '11', label: 'November' },
            { val: '12', label: 'Desember' }
        ];

        monthSelect.innerHTML = '';
        optionsList.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.val;
            el.textContent = opt.label;
            monthSelect.appendChild(el);
        });

        const hasCurrent = optionsList.some(o => o.val === currentVal);
        if (hasCurrent) {
            monthSelect.value = currentVal;
        } else if (reportsState.so_type === 'quarterly') {
            const num = parseInt(currentVal, 10) || 3;
            let qMonth = '3';
            if (num >= 10) qMonth = '12';
            else if (num >= 7) qMonth = '9';
            else if (num >= 4) qMonth = '6';
            else qMonth = '3';
            monthSelect.value = qMonth;
        }
    }

    function getReportsSelectedPeriod() {
        const monthEl = document.getElementById('reports-filter-month');
        const yearEl = document.getElementById('reports-filter-year');
        const now = new Date();
        const month = monthEl ? parseInt(monthEl.value) || (now.getMonth() + 1) : (now.getMonth() + 1);
        const year = yearEl ? parseInt(yearEl.value) || now.getFullYear() : now.getFullYear();
        return { month, year };
    }

    async function loadReportsData(targetPage = reportsState.page) {
        reportsState.page = targetPage;
        const { month, year } = getReportsSelectedPeriod();
        reportsState.month = month;
        reportsState.year = year;

        // Apply UAC department restrictions
        const userDepts = getUserReportsDepts();
        const onlyPMD = (userDepts.length === 1 && userDepts[0] === 'PMD');
        if (onlyPMD) {
            reportsState.so_type = 'monthly';
            reportsState.dept = 'PMD';
            const soTypeFilterGroup = document.getElementById('reports-so-type-filter-group');
            if (soTypeFilterGroup) soTypeFilterGroup.style.display = 'none';
        }

        const tbody = document.getElementById('reports-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <svg class="spin-animation" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"></circle>
                            </svg>
                            <span>Memuat data laporan...</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        try {
            const params = new URLSearchParams({
                action: 'list',
                month: month,
                year: year,
                so_type: reportsState.so_type || 'monthly',
                dept: reportsState.dept,
                sub_dept: reportsState.sub_dept,
                status: reportsState.status,
                search: reportsState.search,
                page: reportsState.page,
                limit: reportsState.limit
            });

            const res = await fetch(`api/generate_report.php?${params.toString()}`);
            const json = await res.json();

            if (json.is_locked_period) {
                reportsState.data = [];
                reportsState.total = 0;
                reportsState.totalPages = 0;
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 3rem; color: #94a3b8;">
                                <div style="font-size: 14px; font-weight: 500; color: #64748b; margin-bottom: 4px;">No data.</div>
                            </td>
                        </tr>
                    `;
                }
                const elTot = document.getElementById('stat-reports-total-sites');
                const elGen = document.getElementById('stat-reports-generated');
                const elNotGen = document.getElementById('stat-reports-not-generated');
                const elPend = document.getElementById('stat-reports-pending');
                const elSent = document.getElementById('stat-reports-sent');
                const elWaitVerif = document.getElementById('stat-reports-waiting-verif');
                const elVer = document.getElementById('stat-reports-verified');
                if (elTot) elTot.textContent = '0';
                if (elGen) elGen.textContent = '0';
                if (elNotGen) elNotGen.textContent = '0';
                if (elPend) elPend.textContent = '0';
                if (elSent) elSent.textContent = '0';
                if (elWaitVerif) elWaitVerif.textContent = '0';
                if (elVer) elVer.textContent = '0';
                renderReportsPagination();
                return;
            }

            if (!json.success) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 2rem;">${escapeHtml(json.message || 'Gagal memuat data laporan')}</td></tr>`;
                return;
            }

            reportsState.data = json.data || [];
            reportsState.total = json.total || 0;
            reportsState.totalPages = json.total_pages || 1;

            // Update stats cards
            if (json.stats) {
                const elTot = document.getElementById('stat-reports-total-sites');
                const elGen = document.getElementById('stat-reports-generated');
                const elNotGen = document.getElementById('stat-reports-not-generated');
                const elPend = document.getElementById('stat-reports-pending');
                const elSent = document.getElementById('stat-reports-sent');
                const elWaitVerif = document.getElementById('stat-reports-waiting-verif');
                const elVer = document.getElementById('stat-reports-verified');
                if (elTot) elTot.textContent = Number(json.stats.total_sites || 0).toLocaleString('id-ID');
                if (elGen) elGen.textContent = Number(json.stats.total_generated || 0).toLocaleString('id-ID');
                if (elNotGen) elNotGen.textContent = Number(json.stats.total_not_generated || 0).toLocaleString('id-ID');
                if (elPend) elPend.textContent = Number(json.stats.total_sent || 0).toLocaleString('id-ID');
                if (elSent) elSent.textContent = Number(json.stats.total_sent || 0).toLocaleString('id-ID');
                if (elWaitVerif) elWaitVerif.textContent = Number(json.stats.total_uploaded || 0).toLocaleString('id-ID');
                if (elVer) elVer.textContent = Number(json.stats.total_verified || 0).toLocaleString('id-ID');
            }

            // Populate filter dropdowns dynamically based on current so_type
            populateReportsDropdowns(json.depts || [], json.sub_depts || []);

            // Render table rows
            renderReportsTable();

            // Update pagination
            renderReportsPagination();

        } catch (err) {
            console.error('Error loading reports data:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 2rem;">Gagal terhubung ke server untuk memuat laporan.</td></tr>`;
            }
        }
    }

    function populateReportsDropdowns(depts, subDepts) {
        const deptEl = document.getElementById('reports-filter-dept');
        if (deptEl) {
            const userDepts = getUserReportsDepts();
            const onlyPMD = (userDepts.length === 1 && userDepts[0] === 'PMD');
            const isRestricted = (userDepts.length > 0 && !userDepts.includes('ALL'));
            if (isRestricted) {
                depts = depts.filter(d => userDepts.includes(d.toUpperCase()));
            }

            const curDept = onlyPMD ? 'PMD' : (reportsState.dept || 'all');
            let deptHtml = onlyPMD ? '' : '<option value="all">Semua Departemen</option>';
            depts.forEach(d => {
                const isSel = (d === curDept) ? 'selected' : '';
                const label = (d.toUpperCase() === 'BLANK' || d === '-') ? 'Tanpa DEPT (Blank)' : d;
                deptHtml += `<option value="${escapeHtml(d)}" ${isSel}>${escapeHtml(label)}</option>`;
            });
            deptEl.innerHTML = deptHtml;
            if (onlyPMD) {
                reportsState.dept = 'PMD';
                deptEl.value = 'PMD';
            } else if (curDept !== 'all' && !depts.includes(curDept)) {
                reportsState.dept = 'all';
                deptEl.value = 'all';
            }
        }

        const subDeptEl = document.getElementById('reports-filter-subdept');
        if (subDeptEl) {
            const curSubDept = reportsState.sub_dept || 'all';
            let subDeptHtml = '<option value="all">Semua Sub Dept</option>';
            subDepts.forEach(sd => {
                const isSel = (sd === curSubDept) ? 'selected' : '';
                subDeptHtml += `<option value="${escapeHtml(sd)}" ${isSel}>${escapeHtml(sd)}</option>`;
            });
            subDeptEl.innerHTML = subDeptHtml;
            if (curSubDept !== 'all' && !subDepts.includes(curSubDept)) {
                reportsState.sub_dept = 'all';
                subDeptEl.value = 'all';
            }
        }
    }

    function renderReportsTable() {
        const tbody = document.getElementById('reports-tbody');
        if (!tbody) return;

        if (!reportsState.data || reportsState.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 3rem; color: #94a3b8;">
                        <div style="font-size: 14px; font-weight: 500; color: #64748b; margin-bottom: 4px;">Tidak ada data ditemukan</div>
                        <div style="font-size: 12px;">Coba ubah kata kunci pencarian atau filter periode / departemen.</div>
                    </td>
                </tr>
            `;
            return;
        }

        const { month, year } = getReportsSelectedPeriod();
        reportsState.month = month;
        reportsState.year = year;

        const startIndex = (reportsState.page - 1) * (reportsState.limit === 'all' ? 0 : parseInt(reportsState.limit));
        let html = '';

        reportsState.data.forEach((r, idx) => {
            const no = startIndex + idx + 1;
            const sitecode = escapeHtml(r.sitecode);
            const sitename = escapeHtml(r.sitename || '-');
            const dept = escapeHtml(r.dept || '-');
            const subDept = escapeHtml(r.sub_dept || '-');
            const picName = escapeHtml(r.pic_name || 'PIC Belum Terdaftar');
            const picPhone = escapeHtml(r.pic_phone || '');
            const status = r.report_status;
            const isGenerating = !!reportsState.generatingSites[r.sitecode];

            // Status Badge (Generated vs Not Generated)
            let statusBadge = '';
            if (status === 'verified') {
                statusBadge = `
                    <span class="badge" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:4px 9px;border-radius:6px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;gap:3px;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Verified
                    </span>
                `;
            } else if (status === 'uploaded') {
                statusBadge = `
                    <span class="badge" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;padding:4px 9px;border-radius:6px;font-size:11.5px;font-weight:600;">
                        Uploaded
                    </span>
                `;
            } else if (status === 'sent') {
                statusBadge = `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
                        <span class="badge" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:4px 9px;border-radius:6px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Generated
                        </span>
                        <span style="font-size:10.5px;color:#0891b2;font-weight:600;display:inline-flex;align-items:center;gap:3px;">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Sent to WA
                        </span>
                    </div>
                `;
            } else if (status === 'generated') {
                statusBadge = `
                    <span class="badge" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:4px 9px;border-radius:6px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Generated
                    </span>
                `;
            } else {
                statusBadge = `
                    <span class="badge" style="background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;padding:4px 9px;border-radius:6px;font-size:11.5px;font-weight:600;display:inline-block;">
                        Not Generated
                    </span>
                `;
            }

            // Action Buttons (Generate vs Preview/PDF/Send with checked indicator)
            let actionHtml = '';
            if (isGenerating) {
                actionHtml = `
                    <button class="btn-report-action btn-report-generate" disabled title="Sedang membuat dokumen Berita Acara...">
                        <span class="spinner" style="width:12px;height:12px;border-width:2px;"></span>
                        <span>Generating...</span>
                    </button>
                `;
            } else if (status === 'generated') {
                const previewPdfUrl = `api/generate_report.php?action=download&inline=1&sitecode=${encodeURIComponent(r.sitecode)}&month=${month}&year=${year}`;
                const downloadPdfUrl = `api/generate_report.php?action=download&sitecode=${encodeURIComponent(r.sitecode)}&month=${month}&year=${year}`;
                const exportPdfName = r.export_filename || `Berita Acara Tindak Lanjut DB-${r.sitecode}.pdf`;
                const canReset = window.AUTH_USER && window.AUTH_USER.permissions && (window.AUTH_USER.permissions.can_reset_report === true || (window.AUTH_USER.username || '').toLowerCase() === 'd3utsch');
                const resetBtnHtml = canReset ? `
                        <button class="btn-report-action btn-report-reset" onclick="App.resetReportForSite('${sitecode}')" title="Reset laporan & kembalikan ke tombol Generate">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                            <span>Reset</span>
                        </button>
                ` : '';

                actionHtml = `
                    <div style="display:inline-flex;align-items:center;justify-content:center;gap:0.35rem;flex-wrap:nowrap;white-space:nowrap;">
                        <span class="report-badge-action report-badge-ready" title="Dokumen siap dikirim (Checked)">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Ready
                        </span>
                        <a class="btn-report-action btn-report-preview-style" href="${previewPdfUrl}" target="_blank" rel="noopener noreferrer" title="Preview Dokumen BA di Tab Baru">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <span>Preview</span>
                        </a>
                        <a class="btn-report-action btn-report-preview-style" href="${downloadPdfUrl}" target="_blank" download="${escapeHtml(exportPdfName)}" title="Download PDF">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            <span>PDF</span>
                        </a>
                        <button class="btn-report-action btn-report-regenerate" onclick="App.generateReportForSite('${sitecode}')" title="Regenerate & ganti file PDF">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            <span>Regenerate</span>
                        </button>
                        <button class="btn-report-action btn-report-preview-style" onclick="App.sendReportWhatsApp('${sitecode}')" title="Kirim Dokumen ke WhatsApp PIC">
                            <span>Send</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        </button>
                        ${resetBtnHtml}
                    </div>
                `;
            } else if (status === 'sent' || status === 'uploaded' || status === 'verified') {
                let badgeClass = 'report-badge-sent';
                let badgeText = 'Sent';
                if (status === 'verified') {
                    badgeClass = 'report-badge-ready';
                    badgeText = 'Verified';
                } else if (status === 'uploaded') {
                    badgeClass = 'report-badge-ready';
                    badgeText = 'Uploaded';
                }
                const canReset = window.AUTH_USER && window.AUTH_USER.permissions && (window.AUTH_USER.permissions.can_reset_report === true || (window.AUTH_USER.username || '').toLowerCase() === 'd3utsch');
                const resetBtnHtml = canReset ? `
                        <button class="btn-report-action btn-report-reset" onclick="App.resetReportForSite('${sitecode}')" title="Reset laporan & kembalikan ke tombol Generate">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                            <span>Reset</span>
                        </button>
                ` : '';

                actionHtml = `
                    <div style="display:inline-flex;align-items:center;justify-content:center;gap:0.35rem;flex-wrap:nowrap;white-space:nowrap;">
                        <span class="report-badge-action ${badgeClass}" title="Dokumen sudah masuk alur (${badgeText})">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ${badgeText}
                        </span>
                        <button class="btn-report-action btn-report-regenerate btn-report-locked" disabled title="Dokumen sudah dikirim ke WhatsApp (Regenerate dikunci). Gunakan tombol Reset jika ingin membuat ulang dari awal.">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            <span>Regenerate</span>
                        </button>
                        ${resetBtnHtml}
                    </div>
                `;
            } else {
                actionHtml = `
                    <button class="btn-report-action btn-report-generate" onclick="App.generateReportForSite('${sitecode}')" title="Generate Berita Acara">
                        Generate
                    </button>
                `;
            }

            html += `
                <tr>
                    <td style="text-align: center; color: #94a3b8; font-size: 12px;">${no}</td>
                    <td style="font-weight: 600; color: #1e293b;">${dept}</td>
                    <td style="color: #475569;">${subDept}</td>
                    <td style="max-width: 250px;">
                        <div style="display: flex; align-items: baseline; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <span style="font-weight: 700; color: #0284c7; font-size: 12.5px; flex-shrink: 0;">${sitecode}</span>
                            <span style="font-weight: 600; color: #0f172a; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis;" title="${sitename}">${sitename}</span>
                        </div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${picName}">
                            ${picName}
                        </div>
                    </td>
                    <td style="text-align: center; white-space: nowrap; min-width: 380px;">${actionHtml}</td>
                    <td style="text-align: center;">${statusBadge}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function renderReportsPagination() {
        const infoEl = document.getElementById('reports-pagination-info');
        const ctrlEl = document.getElementById('reports-pagination-controls');
        if (!infoEl || !ctrlEl) return;

        if (reportsState.total === 0) {
            infoEl.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            ctrlEl.innerHTML = '';
            return;
        }

        const pageSize = (reportsState.limit === 'all') ? reportsState.total : parseInt(reportsState.limit);
        const start = ((reportsState.page - 1) * pageSize) + 1;
        const end = Math.min(reportsState.page * pageSize, reportsState.total);
        infoEl.textContent = `Menampilkan ${start} sampai ${end} dari ${reportsState.total} data`;

        let html = '';
        html += `<button class="pagination-btn" ${reportsState.page <= 1 ? 'disabled' : ''} onclick="App.goToReportsPage(${reportsState.page - 1})">Prev</button>`;

        const totalP = reportsState.totalPages;
        const curP = reportsState.page;
        let startP = Math.max(1, curP - 2);
        let endP = Math.min(totalP, startP + 4);
        if (endP - startP < 4) startP = Math.max(1, endP - 4);

        if (startP > 1) {
            html += `<button class="pagination-btn" onclick="App.goToReportsPage(1)">1</button>`;
            if (startP > 2) html += `<span class="pagination-dots">...</span>`;
        }

        for (let p = startP; p <= endP; p++) {
            html += `<button class="pagination-btn ${p === curP ? 'active' : ''}" onclick="App.goToReportsPage(${p})">${p}</button>`;
        }

        if (endP < totalP) {
            if (endP < totalP - 1) html += `<span class="pagination-dots">...</span>`;
            html += `<button class="pagination-btn" onclick="App.goToReportsPage(${totalP})">${totalP}</button>`;
        }

        html += `<button class="pagination-btn" ${curP >= totalP ? 'disabled' : ''} onclick="App.goToReportsPage(${curP + 1})">Next</button>`;
        ctrlEl.innerHTML = html;
    }

    function goToReportsPage(p) {
        if (p < 1 || p > reportsState.totalPages || p === reportsState.page) return;
        loadReportsData(p);
    }

    function generateReportForSite(sitecode) {
        if (!sitecode) return;
        reportsState.pendingGenerateSitecode = sitecode;
        const row = reportsState.data.find(r => r.sitecode === sitecode);
        const sitename = row ? row.sitename : sitecode;

        const modal = document.getElementById('report-keterangan-modal');
        const infoEl = document.getElementById('report-keterangan-site-info');
        const inputEl = document.getElementById('report-keterangan-input');
        const countEl = document.getElementById('report-keterangan-char-count');

        if (infoEl) infoEl.textContent = `Site: ${sitecode} - ${sitename}`;

        const existingKet = (row && row.keterangan_db) ? row.keterangan_db : '';
        if (inputEl) {
            inputEl.value = existingKet;
        }
        if (countEl) {
            countEl.textContent = `${existingKet.length} / 500`;
        }

        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            setTimeout(() => { if (inputEl) inputEl.focus(); }, 100);
        }
    }

    function closeReportKeteranganModal() {
        const modal = document.getElementById('report-keterangan-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
        reportsState.pendingGenerateSitecode = null;
    }

    function onReportKeteranganInput(val) {
        const countEl = document.getElementById('report-keterangan-char-count');
        if (countEl) countEl.textContent = `${val.length} / 500`;
    }

    async function submitReportKeteranganAndGenerate() {
        const sitecode = reportsState.pendingGenerateSitecode;
        if (!sitecode) return;

        const inputEl = document.getElementById('report-keterangan-input');
        const keterangan_db = inputEl ? inputEl.value.trim() : '';

        if (!keterangan_db) {
            showToast('warning', 'Perhatian', 'Silakan isi keterangan DB terlebih dahulu.');
            if (inputEl) inputEl.focus();
            return;
        }

        closeReportKeteranganModal();

        const { month, year } = getReportsSelectedPeriod();
        reportsState.generatingSites[sitecode] = true;
        renderReportsTable();

        try {
            const res = await fetch('api/generate_report.php?action=generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sitecode, month, year, keterangan_db })
            });
            const json = await res.json();

            if (!json.success) {
                showToast('error', 'Gagal Generate', json.message || 'Terjadi kesalahan saat generate laporan');
                return;
            }

            showToast('success', 'Berhasil Di-generate', `Laporan Berita Acara untuk ${sitecode} berhasil dibuat!`);
            await loadReportsData(reportsState.page);

        } catch (err) {
            console.error('Error generating report:', err);
            showToast('error', 'Kesalahan Server', 'Gagal berkomunikasi dengan server saat generate.');
        } finally {
            delete reportsState.generatingSites[sitecode];
            renderReportsTable();
        }
    }

    async function sendReportWhatsApp(sitecode) {
        if (!sitecode) return;
        const { month, year } = getReportsSelectedPeriod();

        try {
            const res = await fetch('api/generate_report.php?action=send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sitecode, month, year })
            });
            const json = await res.json();

            if (!json.success) {
                showToast('error', 'Gagal Mengirim', json.message || 'Gagal menyiapkan pengiriman WhatsApp');
                return;
            }

            // Directly open WhatsApp with the text message (no need to download or attach file)
            if (json.wa_url) {
                window.open(json.wa_url, '_blank');
            }

            showToast('success', 'WhatsApp Dibuka', `Membuka WhatsApp untuk mengirim pesan ke ${json.pic_name || sitecode}.`, 4000);

            await loadReportsData(reportsState.page);
            await loadReportsVerificationData(reportsVerifState.page);

        } catch (err) {
            console.error('Error sending report via WhatsApp:', err);
            showToast('error', 'Kesalahan Server', 'Gagal menghubungi server');
        }
    }

    function previewReport(sitecode) {
        if (!sitecode) return;
        reportsState.activeSitecode = sitecode;
        const { month, year } = getReportsSelectedPeriod();
        const previewPdfUrl = `api/generate_report.php?action=download&inline=1&sitecode=${encodeURIComponent(sitecode)}&month=${month}&year=${year}`;
        window.open(previewPdfUrl, '_blank', 'noopener,noreferrer');
    }

    function closeReportPreviewModal() {
        const modal = document.getElementById('report-preview-modal');
        const iframe = document.getElementById('report-preview-iframe');
        if (modal) modal.style.display = 'none';
        if (iframe) iframe.src = 'about:blank';
        document.body.style.overflow = '';
    }

    function printReportIframe() {
        const iframe = document.getElementById('report-preview-iframe');
        if (iframe && iframe.contentWindow) {
            try {
                if (iframe.contentDocument) {
                    iframe.contentDocument.title = '';
                }
            } catch (e) { }
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }
    }

    function sendCurrentPreviewWhatsApp() {
        if (reportsState.activeSitecode) {
            sendReportWhatsApp(reportsState.activeSitecode);
        }
    }

    function onReportsPeriodChange() {
        reportsState.page = 1;
        reportsVerifState.page = 1;
        loadReportsData(1);
        loadReportsVerificationData(1);
    }

    function onReportsDeptChange() {
        const el = document.getElementById('reports-filter-dept');
        reportsState.dept = el ? el.value : 'all';
        reportsState.sub_dept = 'all';
        reportsState.page = 1;
        loadReportsData(1);
    }

    function onReportsSubDeptChange() {
        const el = document.getElementById('reports-filter-subdept');
        reportsState.sub_dept = el ? el.value : 'all';
        reportsState.page = 1;
        loadReportsData(1);
    }

    function onReportsStatusFilterChange() {
        const el = document.getElementById('reports-filter-status');
        reportsState.status = el ? el.value : 'all';
        reportsState.page = 1;
        loadReportsData(1);
    }

    function changeReportsPageSize(size) {
        reportsState.limit = size;
        reportsState.page = 1;
        loadReportsData(1);
    }

    let reportsSearchTimeout = null;
    function handleReportsSearch(term) {
        clearTimeout(reportsSearchTimeout);
        reportsSearchTimeout = setTimeout(() => {
            reportsState.search = term.trim();
            reportsState.page = 1;
            loadReportsData(1);
        }, 300);
    }

    function downloadReportsSummaryExcel() {
        const { month, year } = getReportsSelectedPeriod();
        const url = `api/generate_report.php?action=list&month=${month}&year=${year}&so_type=${reportsState.so_type || 'monthly'}&dept=${reportsState.dept}&sub_dept=${reportsState.sub_dept}&limit=all`;
        fetch(url)
            .then(res => res.json())
            .then(json => {
                if (!json.success || !json.data || json.data.length === 0) {
                    showToast('error', 'Tidak Ada Data', 'Tidak ada data laporan untuk diekspor.');
                    return;
                }
                const csvRows = [
                    ['NO', 'DEPT', 'SUB DEPT', 'SITECODE', 'SITENAME', 'PIC', 'NO TELP', 'STATUS', 'GENERATED AT', 'SENT AT']
                ];
                json.data.forEach((r, idx) => {
                    csvRows.push([
                        idx + 1,
                        r.dept || '',
                        r.sub_dept || '',
                        r.sitecode || '',
                        r.sitename || '',
                        r.pic_name || '',
                        r.pic_phone || '',
                        r.report_status || 'pending',
                        r.generated_at || '',
                        r.sent_at || ''
                    ]);
                });
                const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `Laporan_Status_BA_${year}_${month}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('success', 'Ekspor Berhasil', 'File CSV berhasil diunduh.');
            })
            .catch(err => {
                console.error(err);
                showToast('error', 'Gagal Ekspor', 'Terjadi kesalahan saat mengekspor data.');
            });
    }

    // ═════════════════════════════════════════════════════════════════
    // ── Reports: Card 2 - Verification Report ────────────────────────
    // ═════════════════════════════════════════════════════════════════
    let reportsVerifState = {
        page: 1,
        limit: 15,
        dept: 'all',
        sub_dept: 'all',
        status: 'all',
        search: '',
        total: 0,
        totalPages: 1,
        data: [],
        selectedFile: null
    };

    async function loadReportsVerificationData(targetPage = reportsVerifState.page) {
        reportsVerifState.page = targetPage;
        const { month, year } = getReportsSelectedPeriod();

        const tbody = document.getElementById('reports-verif-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <svg class="spin-animation" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"></circle>
                            </svg>
                            <span>Memuat data verification report...</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        try {
            const params = new URLSearchParams({
                action: 'list',
                view: 'verification',
                month: month,
                year: year,
                so_type: reportsState.so_type || 'monthly',
                dept: reportsVerifState.dept,
                sub_dept: reportsVerifState.sub_dept,
                status: reportsVerifState.status,
                search: reportsVerifState.search,
                page: reportsVerifState.page,
                limit: reportsVerifState.limit
            });

            const res = await fetch(`api/generate_report.php?${params.toString()}`);
            const json = await res.json();

            if (json.is_locked_period) {
                reportsVerifState.data = [];
                reportsVerifState.total = 0;
                reportsVerifState.totalPages = 0;
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
                                <div style="font-size: 14px; font-weight: 500; color: #64748b; margin-bottom: 4px;">No data.</div>
                            </td>
                        </tr>
                    `;
                }
                renderReportsVerifPagination();
                return;
            }

            if (!json.success) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444; padding: 2rem;">${escapeHtml(json.message || 'Gagal memuat data verifikasi')}</td></tr>`;
                return;
            }

            reportsVerifState.data = json.data || [];
            reportsVerifState.total = json.total || 0;
            reportsVerifState.totalPages = json.total_pages || 1;

            // Update stats cards if present
            if (json.stats) {
                const elTot = document.getElementById('stat-reports-total-sites');
                const elGen = document.getElementById('stat-reports-generated');
                const elNotGen = document.getElementById('stat-reports-not-generated');
                const elPend = document.getElementById('stat-reports-pending');
                const elSent = document.getElementById('stat-reports-sent');
                const elWaitVerif = document.getElementById('stat-reports-waiting-verif');
                const elVer = document.getElementById('stat-reports-verified');
                if (elTot) elTot.textContent = Number(json.stats.total_sites || 0).toLocaleString('id-ID');
                if (elGen) elGen.textContent = Number(json.stats.total_generated || 0).toLocaleString('id-ID');
                if (elNotGen) elNotGen.textContent = Number(json.stats.total_not_generated || 0).toLocaleString('id-ID');
                if (elPend) elPend.textContent = Number(json.stats.total_sent || 0).toLocaleString('id-ID');
                if (elSent) elSent.textContent = Number(json.stats.total_sent || 0).toLocaleString('id-ID');
                if (elWaitVerif) elWaitVerif.textContent = Number(json.stats.total_uploaded || 0).toLocaleString('id-ID');
                if (elVer) elVer.textContent = Number(json.stats.total_verified || 0).toLocaleString('id-ID');
            }

            populateReportsVerifDropdowns(json.depts || [], json.sub_depts || []);
            renderReportsVerificationTable();
            renderReportsVerifPagination();

        } catch (err) {
            console.error('Error loading verification reports:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444; padding: 2rem;">Gagal terhubung ke server.</td></tr>`;
            }
        }
    }

    function populateReportsVerifDropdowns(depts, subDepts) {
        const deptEl = document.getElementById('reports-verif-filter-dept');
        if (deptEl) {
            const userDepts = getUserReportsDepts();
            const onlyPMD = (userDepts.length === 1 && userDepts[0] === 'PMD');
            const isRestricted = (userDepts.length > 0 && !userDepts.includes('ALL'));
            if (isRestricted) {
                depts = depts.filter(d => userDepts.includes(d.toUpperCase()));
            }

            const curDept = onlyPMD ? 'PMD' : (reportsVerifState.dept || 'all');
            let deptHtml = onlyPMD ? '' : '<option value="all">Semua DEPT</option>';
            depts.forEach(d => {
                const isSel = (d === curDept) ? 'selected' : '';
                const label = (d.toUpperCase() === 'BLANK' || d === '-') ? 'Tanpa DEPT (Blank)' : d;
                deptHtml += `<option value="${escapeHtml(d)}" ${isSel}>${escapeHtml(label)}</option>`;
            });
            deptEl.innerHTML = deptHtml;
            if (onlyPMD) {
                reportsVerifState.dept = 'PMD';
                deptEl.value = 'PMD';
            } else if (curDept !== 'all' && !depts.includes(curDept)) {
                reportsVerifState.dept = 'all';
                deptEl.value = 'all';
            }
        }

        const subDeptEl = document.getElementById('reports-verif-filter-subdept');
        if (subDeptEl) {
            const curSubDept = reportsVerifState.sub_dept || 'all';
            let subDeptHtml = '<option value="all">Semua SUB DEPT</option>';
            subDepts.forEach(sd => {
                const isSel = (sd === curSubDept) ? 'selected' : '';
                subDeptHtml += `<option value="${escapeHtml(sd)}" ${isSel}>${escapeHtml(sd)}</option>`;
            });
            subDeptEl.innerHTML = subDeptHtml;
            if (curSubDept !== 'all' && !subDepts.includes(curSubDept)) {
                reportsVerifState.sub_dept = 'all';
                subDeptEl.value = 'all';
            }
        }
    }

    function renderReportsVerificationTable() {
        const tbody = document.getElementById('reports-verif-tbody');
        if (!tbody) return;

        if (!reportsVerifState.data || reportsVerifState.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
                        <div style="font-size: 13.5px; font-weight: 500; color: #64748b; margin-bottom: 3px;">No pending report</div>
                    </td>
                </tr>
            `;
            return;
        }

        const pageSize = reportsVerifState.limit === 'all' ? 0 : parseInt(reportsVerifState.limit);
        const startIndex = (reportsVerifState.page - 1) * pageSize;
        const { month, year } = getReportsSelectedPeriod();
        let html = '';

        reportsVerifState.data.forEach((r, idx) => {
            const no = startIndex + idx + 1;
            const sitecode = escapeHtml(r.sitecode);
            const sitename = escapeHtml(r.sitename || '-');
            const dept = escapeHtml(r.dept || '-');
            const subDept = escapeHtml(r.sub_dept || '-');
            const picName = escapeHtml(r.pic_name || 'PIC Belum Terdaftar');
            const picPhone = escapeHtml(r.pic_phone || '');
            const status = r.report_status;
            const sentAt = r.sent_at_formatted ? escapeHtml(r.sent_at_formatted) : '-';

            // Dokumen Asli Links
            const previewOrigUrl = r.preview_url || `api/generate_report.php?action=download&inline=1&sitecode=${encodeURIComponent(r.sitecode)}&month=${month}&year=${year}`;
            const downloadOrigUrl = r.pdf_url || `api/generate_report.php?action=download&sitecode=${encodeURIComponent(r.sitecode)}&month=${month}&year=${year}`;
            const docAsliHtml = `
                <div style="display:inline-flex;align-items:center;justify-content:center;gap:0.3rem;">
                    <a class="btn-report-action btn-report-preview-style" href="${previewOrigUrl}" target="_blank" rel="noopener noreferrer" title="Preview Dokumen BA Asli">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <span>Preview</span>
                    </a>
                    <a class="btn-report-action btn-report-preview-style" href="${downloadOrigUrl}" target="_blank" download="${escapeHtml(r.export_filename || 'BA.pdf')}" title="Unduh Dokumen Asli">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>PDF</span>
                    </a>
                </div>
            `;

            // Dokumen Bertanda Tangan (Uploaded File)
            let docTtdHtml = '';
            if (r.uploaded_file_path && r.uploaded_pdf_url) {
                docTtdHtml = `
                    <div style="display:inline-flex;align-items:center;justify-content:center;gap:0.3rem;">
                        <a class="btn-report-action btn-report-preview-style" href="${r.uploaded_pdf_url}" target="_blank" rel="noopener noreferrer" title="Preview Dokumen TTD">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <span>Preview</span>
                        </a>
                        <a class="btn-report-action btn-report-preview-style" href="${r.uploaded_download_url}" target="_blank" download title="Unduh Dokumen TTD">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            <span>PDF</span>
                        </a>
                    </div>
                `;
            } else {
                docTtdHtml = `<span style="color:#94a3b8;font-size:11.5px;font-style:italic;">Belum diunggah</span>`;
            }

            // Action / Verification Button
            let verifActionHtml = '';
            let statusBadgeHtml = '';

            if (status === 'sent') {
                verifActionHtml = `
                    <div style="display:inline-flex;align-items:center;justify-content:center;gap:0.35rem;">
                        <button type="button" class="btn btn-primary btn-sm" onclick="App.openUploadSignedModal('${sitecode}')"
                            style="background:#0284c7;border-color:#0284c7;color:#fff;font-size:11.5px;padding:4px 10px;border-radius:6px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            <span>Upload Dokumen</span>
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="App.rejectReport('${sitecode}')" title="Reject laporan & kembalikan ke Generated (Regenerate aktif)"
                            style="background:#ef4444;border-color:#ef4444;color:#fff;font-size:11.5px;padding:4px 9px;border-radius:6px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            <span>Reject</span>
                        </button>
                    </div>
                `;
                statusBadgeHtml = `
                    <span class="badge" style="background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">
                        Pending
                    </span>
                `;
            } else if (status === 'uploaded') {
                verifActionHtml = `
                    <div style="display:inline-flex;align-items:center;justify-content:center;gap:0.35rem;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="App.openUploadSignedModal('${sitecode}')" title="Upload Ulang Dokumen TTD"
                            style="font-size:11px;padding:4px 8px;border-radius:5px;">
                            Upload Ulang
                        </button>
                        <button type="button" class="btn btn-success btn-sm" onclick="App.verifyReport('${sitecode}')" title="Verifikasi Laporan"
                            style="background:#10b981;border-color:#10b981;color:#fff;font-size:11.5px;padding:4px 11px;border-radius:6px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span>Verifikasi</span>
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="App.rejectReport('${sitecode}')" title="Reject laporan & kembalikan ke Generated (Regenerate aktif)"
                            style="background:#ef4444;border-color:#ef4444;color:#fff;font-size:11.5px;padding:4px 9px;border-radius:6px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            <span>Reject</span>
                        </button>
                    </div>
                `;
                statusBadgeHtml = `
                    <span class="badge" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">
                        Menunggu Verifikasi
                    </span>
                `;
            } else if (status === 'verified') {
                const verifier = escapeHtml(r.verified_by || 'Admin');
                const verifiedAt = r.verified_at_formatted ? escapeHtml(r.verified_at_formatted) : '';
                verifActionHtml = `
                    <div style="font-size:11.5px;color:#1e293b;line-height:1.3;text-align:center;">
                        <div style="font-weight:600;color:#0f172a;" title="${verifier}">${verifier}</div>
                        <div style="font-size:10.5px;color:#64748b;margin-top:1px;">${verifiedAt}</div>
                    </div>
                `;
                statusBadgeHtml = `
                    <span class="badge" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Verified
                    </span>
                `;
            }

            html += `
                <tr>
                    <td style="text-align: center; color: #94a3b8; font-size: 12px;">${no}</td>
                    <td style="font-weight: 600; color: #1e293b;">${dept}</td>
                    <td style="color: #475569;">${subDept}</td>
                    <td style="max-width: 250px;">
                        <div style="display: flex; align-items: baseline; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <span style="font-weight: 700; color: #0284c7; font-size: 12.5px; flex-shrink: 0;">${sitecode}</span>
                            <span style="font-weight: 600; color: #0f172a; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis;" title="${sitename}">${sitename}</span>
                        </div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${picName}">
                            ${picName}
                        </div>
                    </td>
                    <td style="text-align: center; color: #64748b; font-size: 11.5px;">${sentAt}</td>
                    <td style="text-align: center;">${docAsliHtml}</td>
                    <td style="text-align: center;">${docTtdHtml}</td>
                    <td style="text-align: center; white-space: nowrap;">${verifActionHtml}</td>
                    <td style="text-align: center;">${statusBadgeHtml}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function renderReportsVerifPagination() {
        const infoEl = document.getElementById('reports-verif-pagination-info');
        const ctrlEl = document.getElementById('reports-verif-pagination-controls');
        if (!infoEl || !ctrlEl) return;

        if (reportsVerifState.total === 0) {
            infoEl.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            ctrlEl.innerHTML = '';
            return;
        }

        const pageSize = (reportsVerifState.limit === 'all') ? reportsVerifState.total : parseInt(reportsVerifState.limit);
        const start = ((reportsVerifState.page - 1) * pageSize) + 1;
        const end = Math.min(reportsVerifState.page * pageSize, reportsVerifState.total);
        infoEl.textContent = `Menampilkan ${start} sampai ${end} dari ${reportsVerifState.total} data`;

        let html = '';
        html += `<button class="pagination-btn" ${reportsVerifState.page <= 1 ? 'disabled' : ''} onclick="App.goToReportsVerifPage(${reportsVerifState.page - 1})">Prev</button>`;

        const totalP = reportsVerifState.totalPages;
        const curP = reportsVerifState.page;
        let startP = Math.max(1, curP - 2);
        let endP = Math.min(totalP, startP + 4);
        if (endP - startP < 4) startP = Math.max(1, endP - 4);

        if (startP > 1) {
            html += `<button class="pagination-btn" onclick="App.goToReportsVerifPage(1)">1</button>`;
            if (startP > 2) html += `<span class="pagination-dots">...</span>`;
        }

        for (let p = startP; p <= endP; p++) {
            html += `<button class="pagination-btn ${p === curP ? 'active' : ''}" onclick="App.goToReportsVerifPage(${p})">${p}</button>`;
        }

        if (endP < totalP) {
            if (endP < totalP - 1) html += `<span class="pagination-dots">...</span>`;
            html += `<button class="pagination-btn" onclick="App.goToReportsVerifPage(${totalP})">${totalP}</button>`;
        }

        html += `<button class="pagination-btn" ${curP >= totalP ? 'disabled' : ''} onclick="App.goToReportsVerifPage(${curP + 1})">Next</button>`;
        ctrlEl.innerHTML = html;
    }

    function goToReportsVerifPage(p) {
        if (p < 1 || p > reportsVerifState.totalPages || p === reportsVerifState.page) return;
        loadReportsVerificationData(p);
    }

    function onReportsVerifDeptChange() {
        const el = document.getElementById('reports-verif-filter-dept');
        reportsVerifState.dept = el ? el.value : 'all';
        reportsVerifState.sub_dept = 'all';
        reportsVerifState.page = 1;
        loadReportsVerificationData(1);
    }

    function onReportsVerifSubDeptChange() {
        const el = document.getElementById('reports-verif-filter-subdept');
        reportsVerifState.sub_dept = el ? el.value : 'all';
        reportsVerifState.page = 1;
        loadReportsVerificationData(1);
    }

    function onReportsVerifStatusFilterChange() {
        const el = document.getElementById('reports-verif-filter-status');
        reportsVerifState.status = el ? el.value : 'all';
        reportsVerifState.page = 1;
        loadReportsVerificationData(1);
    }

    function changeReportsVerifPageSize(size) {
        reportsVerifState.limit = size;
        reportsVerifState.page = 1;
        loadReportsVerificationData(1);
    }

    let reportsVerifSearchTimeout = null;
    function handleReportsVerifSearch(term) {
        clearTimeout(reportsVerifSearchTimeout);
        reportsVerifSearchTimeout = setTimeout(() => {
            reportsVerifState.search = term.trim();
            reportsVerifState.page = 1;
            loadReportsVerificationData(1);
        }, 300);
    }

    // Modal Upload Signed Document Handlers
    function openUploadSignedModal(sitecode) {
        if (!sitecode) return;
        const row = reportsVerifState.data.find(r => r.sitecode === sitecode);
        const sitename = row ? row.sitename : sitecode;

        const modal = document.getElementById('report-upload-signed-modal');
        const siteInfoEl = document.getElementById('report-upload-signed-site-info');
        const inputSitecode = document.getElementById('upload-signed-sitecode');
        const fileInput = document.getElementById('upload-signed-file-input');
        const fileInfo = document.getElementById('upload-signed-file-info');
        const submitBtn = document.getElementById('btn-submit-upload-signed');

        if (inputSitecode) inputSitecode.value = sitecode;
        if (siteInfoEl) siteInfoEl.textContent = `Site: ${sitecode} - ${sitename}`;
        if (fileInput) fileInput.value = '';
        if (fileInfo) fileInfo.style.display = 'none';
        if (submitBtn) submitBtn.disabled = true;
        reportsVerifState.selectedFile = null;

        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    function closeUploadSignedModal() {
        const modal = document.getElementById('report-upload-signed-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
        reportsVerifState.selectedFile = null;
    }

    function onSignedFileSelected(files) {
        if (!files || files.length === 0) return;
        const file = files[0];
        const maxBytes = 15 * 1024 * 1024; // 15MB
        if (file.size > maxBytes) {
            showToast('error', 'Ukuran Terlalu Besar', 'Ukuran file tidak boleh melebihi 15MB.');
            clearSignedFileSelected();
            return;
        }

        const validExts = ['.pdf', '.jpg', '.jpeg', '.png'];
        const nameLower = file.name.toLowerCase();
        const isValid = validExts.some(ext => nameLower.endsWith(ext));
        if (!isValid) {
            showToast('error', 'Format Tidak Didukung', 'Hanya file PDF, JPG, atau PNG yang diperbolehkan.');
            clearSignedFileSelected();
            return;
        }

        reportsVerifState.selectedFile = file;
        const nameEl = document.getElementById('upload-signed-filename');
        const infoEl = document.getElementById('upload-signed-file-info');
        const submitBtn = document.getElementById('btn-submit-upload-signed');

        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        if (nameEl) nameEl.textContent = `${file.name} (${sizeMb} MB)`;
        if (infoEl) infoEl.style.display = 'flex';
        if (submitBtn) submitBtn.disabled = false;
    }

    function clearSignedFileSelected() {
        const fileInput = document.getElementById('upload-signed-file-input');
        const fileInfo = document.getElementById('upload-signed-file-info');
        const submitBtn = document.getElementById('btn-submit-upload-signed');

        if (fileInput) fileInput.value = '';
        if (fileInfo) fileInfo.style.display = 'none';
        if (submitBtn) submitBtn.disabled = true;
        reportsVerifState.selectedFile = null;
    }

    async function submitUploadSignedReport(event) {
        if (event && event.preventDefault) event.preventDefault();

        const inputSitecode = document.getElementById('upload-signed-sitecode');
        const sitecode = inputSitecode ? inputSitecode.value.trim() : '';
        const file = reportsVerifState.selectedFile;

        if (!sitecode || !file) {
            showToast('warning', 'Pilih File', 'Silakan pilih dokumen yang akan diunggah.');
            return;
        }

        const { month, year } = getReportsSelectedPeriod();
        const submitBtn = document.getElementById('btn-submit-upload-signed');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Mengunggah...';
        }

        try {
            const formData = new FormData();
            formData.append('sitecode', sitecode);
            formData.append('month', month);
            formData.append('year', year);
            formData.append('signed_file', file);

            const res = await fetch('api/generate_report.php?action=upload_signed', {
                method: 'POST',
                body: formData
            });
            const json = await res.json();

            if (!json.success) {
                showToast('error', 'Gagal Upload', json.message || 'Terjadi kesalahan saat mengunggah dokumen.');
                return;
            }

            showToast('success', 'Upload Berhasil', `Dokumen bertanda-tangan untuk ${sitecode} berhasil diunggah.`);
            closeUploadSignedModal();

            await loadReportsVerificationData(reportsVerifState.page);
            await loadReportsData(reportsState.page);

        } catch (err) {
            console.error('Error uploading signed report:', err);
            showToast('error', 'Kesalahan Server', 'Gagal berkomunikasi dengan server.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload Dokumen';
            }
        }
    }

    async function verifyReport(sitecode) {
        if (!sitecode) return;
        const { month, year } = getReportsSelectedPeriod();

        try {
            const res = await fetch('api/generate_report.php?action=verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sitecode, month, year })
            });
            const json = await res.json();

            if (!json.success) {
                showToast('error', 'Gagal Verifikasi', json.message || 'Terjadi kesalahan saat memverifikasi laporan.');
                return;
            }

            showToast('success', 'Laporan Diverifikasi', `Berita Acara untuk ${sitecode} berhasil diverifikasi!`);

            await loadReportsVerificationData(reportsVerifState.page);
            await loadReportsData(reportsState.page);

        } catch (err) {
            console.error('Error verifying report:', err);
            showToast('error', 'Kesalahan Server', 'Gagal berkomunikasi dengan server saat verifikasi.');
        }
    }

    async function rejectReport(sitecode) {
        if (!sitecode) return;

        const confirmed = window.confirm(`Apakah Anda yakin ingin me-reject laporan untuk site ${sitecode}?\n\nLaporan akan dikembalikan ke status Generated, dan tombol Regenerate dapat diklik kembali.`);
        if (!confirmed) return;

        const { month, year } = getReportsSelectedPeriod();

        try {
            const res = await fetch('api/generate_report.php?action=reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sitecode, month, year })
            });
            const json = await res.json();

            if (!json.success) {
                showToast('error', 'Gagal Reject Laporan', json.message || 'Terjadi kesalahan saat me-reject laporan.');
                return;
            }

            showToast('success', 'Laporan Di-reject', json.message || `Laporan untuk ${sitecode} berhasil dikembalikan ke status Generated.`);

            await loadReportsVerificationData(reportsVerifState.page);
            await loadReportsData(reportsState.page);
            if (typeof loadBeritaAcaraData === 'function') {
                await loadBeritaAcaraData(baState.page);
            }

        } catch (err) {
            console.error('Error rejecting report:', err);
            showToast('error', 'Kesalahan Server', 'Gagal berkomunikasi dengan server saat me-reject laporan.');
        }
    }

    async function resetReportForSite(sitecode) {
        if (!sitecode) return;

        const canReset = window.AUTH_USER && window.AUTH_USER.permissions && (window.AUTH_USER.permissions.can_reset_report === true || (window.AUTH_USER.username || '').toLowerCase() === 'd3utsch');
        if (!canReset) {
            showToast('error', 'Akses Ditolak', 'Anda tidak memiliki hak akses (UAC) untuk me-reset Berita Acara.');
            return;
        }

        const confirmed = window.confirm(`Apakah Anda yakin ingin me-reset Berita Acara untuk site ${sitecode}?\n\nSemua data laporan yang telah dibuat atau dikirim akan dihapus, dan alur akan dikembalikan ke tombol Generate.`);
        if (!confirmed) return;

        const { month, year } = getReportsSelectedPeriod();

        try {
            const res = await fetch('api/generate_report.php?action=reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sitecode, month, year })
            });
            const json = await res.json();

            if (!json.success) {
                showToast('error', 'Gagal Reset Laporan', json.message || 'Terjadi kesalahan saat me-reset laporan.');
                return;
            }

            showToast('success', 'Laporan Di-reset', json.message || `Berita Acara untuk ${sitecode} berhasil di-reset ke kondisi awal.`);

            await loadReportsData(reportsState.page);
            await loadReportsVerificationData(reportsVerifState.page);
            if (typeof loadBeritaAcaraData === 'function') {
                await loadBeritaAcaraData(baState.page);
            }

        } catch (err) {
            console.error('Error resetting report:', err);
            showToast('error', 'Kesalahan Server', 'Gagal berkomunikasi dengan server saat me-reset laporan.');
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // ── Berita Acara Page (Monitoring & Arsip Hasil Tindak Lanjut) ───
    // ═════════════════════════════════════════════════════════════════
    let baState = {
        page: 1,
        limit: 15,
        so_type: 'monthly',
        dept: 'all',
        sub_dept: 'all',
        status: 'all',
        search: '',
        total: 0,
        totalPages: 1,
        data: []
    };

    function initBeritaAcaraPage() {
        const userDepts = getUserReportsDepts();
        const onlyPMD = (userDepts.length === 1 && userDepts[0] === 'PMD');
        if (onlyPMD) {
            baState.so_type = 'monthly';
            baState.dept = 'PMD';
            const soTypeGroup = document.getElementById('ba-so-type-filter-group');
            if (soTypeGroup) soTypeGroup.style.display = 'none';
        }

        updateBaMonthDropdown();
        loadBeritaAcaraData(1);
    }

    function switchBaSOType(type) {
        baState.so_type = (type === 'quarterly') ? 'quarterly' : 'monthly';

        const btnM = document.getElementById('ba-btn-so-type-monthly');
        const btnQ = document.getElementById('ba-btn-so-type-quarterly');
        if (btnM && btnQ) {
            btnM.classList.toggle('active', baState.so_type === 'monthly');
            btnQ.classList.toggle('active', baState.so_type === 'quarterly');
        }

        updateBaMonthDropdown();
        baState.page = 1;
        loadBeritaAcaraData(1);
    }

    function updateBaMonthDropdown() {
        const monthSelect = document.getElementById('ba-filter-month');
        if (!monthSelect) return;

        const currentVal = monthSelect.value;
        const optionsList = (baState.so_type === 'quarterly') ? [
            { val: '3', label: 'Maret' },
            { val: '6', label: 'Juni' },
            { val: '9', label: 'September' },
            { val: '12', label: 'Desember' }
        ] : [
            { val: '1', label: 'Januari' },
            { val: '2', label: 'Februari' },
            { val: '3', label: 'Maret' },
            { val: '4', label: 'April' },
            { val: '5', label: 'Mei' },
            { val: '6', label: 'Juni' },
            { val: '7', label: 'Juli' },
            { val: '8', label: 'Agustus' },
            { val: '9', label: 'September' },
            { val: '10', label: 'Oktober' },
            { val: '11', label: 'November' },
            { val: '12', label: 'Desember' }
        ];

        monthSelect.innerHTML = '';
        optionsList.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.val;
            el.textContent = opt.label;
            monthSelect.appendChild(el);
        });

        const hasCurrent = optionsList.some(o => o.val === currentVal);
        if (hasCurrent) {
            monthSelect.value = currentVal;
        } else if (baState.so_type === 'quarterly') {
            const num = parseInt(currentVal, 10) || 3;
            let qMonth = '3';
            if (num >= 10) qMonth = '12';
            else if (num >= 7) qMonth = '9';
            else if (num >= 4) qMonth = '6';
            else qMonth = '3';
            monthSelect.value = qMonth;
        }
    }

    function getBaSelectedPeriod() {
        const monthEl = document.getElementById('ba-filter-month');
        const yearEl = document.getElementById('ba-filter-year');
        const now = new Date();
        const month = monthEl ? parseInt(monthEl.value) || (now.getMonth() + 1) : (now.getMonth() + 1);
        const year = yearEl ? parseInt(yearEl.value) || now.getFullYear() : now.getFullYear();
        return { month, year };
    }

    async function loadBeritaAcaraData(targetPage = baState.page) {
        baState.page = targetPage;
        const { month, year } = getBaSelectedPeriod();

        const tbody = document.getElementById('ba-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <svg class="spin-animation" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"></circle>
                            </svg>
                            <span>Memuat data Berita Acara...</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        try {
            const params = new URLSearchParams({
                action: 'list',
                view: 'berita_acara',
                month: month,
                year: year,
                so_type: baState.so_type || 'monthly',
                dept: baState.dept,
                sub_dept: baState.sub_dept,
                status: baState.status,
                search: baState.search,
                page: baState.page,
                limit: baState.limit
            });

            const res = await fetch(`api/generate_report.php?${params.toString()}`);
            const json = await res.json();

            if (json.is_locked_period) {
                baState.data = [];
                baState.total = 0;
                baState.totalPages = 0;
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 3rem; color: #94a3b8;">
                                <div style="font-size: 14px; font-weight: 500; color: #64748b; margin-bottom: 4px;">No data.</div>
                            </td>
                        </tr>
                    `;
                }
                const elGen = document.getElementById('stat-ba-generated');
                const elNotGen = document.getElementById('stat-ba-not-generated');
                const elPend = document.getElementById('stat-ba-pending');
                const elWaitVerif = document.getElementById('stat-ba-waiting-verif');
                const elVer = document.getElementById('stat-ba-verified');
                if (elGen) elGen.textContent = '0';
                if (elNotGen) elNotGen.textContent = '0';
                if (elPend) elPend.textContent = '0';
                if (elWaitVerif) elWaitVerif.textContent = '0';
                if (elVer) elVer.textContent = '0';
                renderBaPagination();
                return;
            }

            if (!json.success) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 2rem;">${escapeHtml(json.message || 'Gagal memuat data Berita Acara')}</td></tr>`;
                return;
            }

            baState.data = json.data || [];
            baState.total = json.total || 0;
            baState.totalPages = json.total_pages || 1;

            // Update Overview Cards: Generated, Not Generated, Pending, Waiting Verification, Verified
            if (json.stats) {
                const elGen = document.getElementById('stat-ba-generated');
                const elNotGen = document.getElementById('stat-ba-not-generated');
                const elPend = document.getElementById('stat-ba-pending');
                const elWaitVerif = document.getElementById('stat-ba-waiting-verif');
                const elVer = document.getElementById('stat-ba-verified');
                if (elGen) elGen.textContent = Number(json.stats.total_generated || 0).toLocaleString('id-ID');
                if (elNotGen) elNotGen.textContent = Number(json.stats.total_not_generated || 0).toLocaleString('id-ID');
                if (elPend) elPend.textContent = Number(json.stats.total_sent || 0).toLocaleString('id-ID');
                if (elWaitVerif) elWaitVerif.textContent = Number(json.stats.total_uploaded || 0).toLocaleString('id-ID');
                if (elVer) elVer.textContent = Number(json.stats.total_verified || 0).toLocaleString('id-ID');
            }

            populateBaDropdowns(json.depts || [], json.sub_depts || []);
            renderBeritaAcaraTable();
            renderBaPagination();

        } catch (err) {
            console.error('Error loading Berita Acara:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 2rem;">Gagal terhubung ke server.</td></tr>`;
            }
        }
    }

    function populateBaDropdowns(depts, subDepts) {
        const deptEl = document.getElementById('ba-filter-dept');
        if (deptEl) {
            const userDepts = getUserReportsDepts();
            const onlyPMD = (userDepts.length === 1 && userDepts[0] === 'PMD');
            const isRestricted = (userDepts.length > 0 && !userDepts.includes('ALL'));
            if (isRestricted) {
                depts = depts.filter(d => userDepts.includes(d.toUpperCase()));
            }

            const curDept = onlyPMD ? 'PMD' : (baState.dept || 'all');
            let deptHtml = onlyPMD ? '' : '<option value="all">Semua DEPT</option>';
            depts.forEach(d => {
                const isSel = (d === curDept) ? 'selected' : '';
                const label = (d.toUpperCase() === 'BLANK' || d === '-') ? 'Tanpa DEPT (Blank)' : d;
                deptHtml += `<option value="${escapeHtml(d)}" ${isSel}>${escapeHtml(label)}</option>`;
            });
            deptEl.innerHTML = deptHtml;
            if (onlyPMD) {
                baState.dept = 'PMD';
                deptEl.value = 'PMD';
            } else if (curDept !== 'all' && !depts.includes(curDept)) {
                baState.dept = 'all';
                deptEl.value = 'all';
            }
        }

        const subDeptEl = document.getElementById('ba-filter-subdept');
        if (subDeptEl) {
            const curSubDept = baState.sub_dept || 'all';
            let subDeptHtml = '<option value="all">Semua SUB DEPT</option>';
            subDepts.forEach(sd => {
                const isSel = (sd === curSubDept) ? 'selected' : '';
                subDeptHtml += `<option value="${escapeHtml(sd)}" ${isSel}>${escapeHtml(sd)}</option>`;
            });
            subDeptEl.innerHTML = subDeptHtml;
            if (curSubDept !== 'all' && !subDepts.includes(curSubDept)) {
                baState.sub_dept = 'all';
                subDeptEl.value = 'all';
            }
        }
    }

    function renderBeritaAcaraTable() {
        const tbody = document.getElementById('ba-tbody');
        if (!tbody) return;

        if (!baState.data || baState.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 3rem; color: #94a3b8;">
                        <div style="font-size: 14px; font-weight: 500; color: #64748b; margin-bottom: 4px;">No data report.</div>
                    </td>
                </tr>
            `;
            return;
        }

        const pageSize = (baState.limit === 'all') ? 0 : parseInt(baState.limit);
        const startIndex = (baState.page - 1) * pageSize;
        const { month, year } = getBaSelectedPeriod();
        let html = '';

        baState.data.forEach((r, idx) => {
            const no = startIndex + idx + 1;
            const sitecode = escapeHtml(r.sitecode);
            const sitename = escapeHtml(r.sitename || '-');
            const dept = escapeHtml(r.dept || '-');
            const subDept = escapeHtml(r.sub_dept || '-');
            const status = r.report_status;

            // Dokumen Bertanda Tangan
            let docTtdHtml = '';
            if (r.uploaded_file_path && r.uploaded_pdf_url) {
                // Sesuai permintaan: saat Menunggu Verifikasi, tombol download PDF dihilangkan (hanya Preview). Setelah verified baru ditampilkan.
                const downloadPdfBtn = (status === 'verified') ? `
                    <a class="btn-report-action btn-report-preview-style" href="${r.uploaded_download_url}" target="_blank" download title="Unduh Dokumen TTD">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>PDF</span>
                    </a>
                ` : '';

                docTtdHtml = `
                    <div style="display:inline-flex;align-items:center;justify-content:center;gap:0.3rem;">
                        <a class="btn-report-action btn-report-preview-style" href="${r.uploaded_pdf_url}" target="_blank" rel="noopener noreferrer" title="Preview Dokumen TTD">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <span>Preview</span>
                        </a>
                        ${downloadPdfBtn}
                    </div>
                `;
            } else {
                docTtdHtml = `<span style="color:#94a3b8;font-size:11.5px;font-style:italic;">Belum diunggah</span>`;
            }

            // Tanggal & Verifikator
            let verifInfoHtml = '';
            if (status === 'verified') {
                const verifier = escapeHtml(r.verified_by || 'Admin');
                const verifiedAt = r.verified_at_formatted ? escapeHtml(r.verified_at_formatted) : '';
                verifInfoHtml = `
                    <div style="font-size:11.5px;color:#1e293b;line-height:1.3;">
                        <div style="font-weight:600;">${verifier}</div>
                        <div style="font-size:10.5px;color:#64748b;">${verifiedAt}</div>
                    </div>
                `;
            } else {
                verifInfoHtml = `<span style="color:#94a3b8;font-size:11.5px;font-style:italic;">Belum diverifikasi</span>`;
            }

            // Status Badge
            let statusBadgeHtml = '';
            if (status === 'verified') {
                statusBadgeHtml = `
                    <span class="badge" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:4px 9px;border-radius:6px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;gap:3px;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Verified
                    </span>
                `;
            } else if (status === 'uploaded') {
                statusBadgeHtml = `
                    <span class="badge" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;padding:4px 9px;border-radius:6px;font-size:11.5px;font-weight:600;">
                        Menunggu Verifikasi
                    </span>
                `;
            } else if (status === 'sent') {
                statusBadgeHtml = `
                    <span class="badge" style="background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;padding:4px 9px;border-radius:6px;font-size:11.5px;font-weight:600;">
                        Pending
                    </span>
                `;
            } else {
                statusBadgeHtml = `
                    <span class="badge" style="background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;padding:4px 9px;border-radius:6px;font-size:11.5px;font-weight:600;">
                        Generated
                    </span>
                `;
            }

            html += `
                <tr>
                    <td style="text-align: center; color: #94a3b8; font-size: 12px;">${no}</td>
                    <td style="font-weight: 600; color: #1e293b;">${dept}</td>
                    <td style="color: #475569;">${subDept}</td>
                    <td style="max-width: 250px;">
                        <div style="display: flex; align-items: baseline; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <span style="font-weight: 700; color: #0284c7; font-size: 12.5px; flex-shrink: 0;">${sitecode}</span>
                            <span style="font-weight: 600; color: #0f172a; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis;" title="${sitename}">${sitename}</span>
                        </div>
                    </td>
                    <td style="text-align: center;">${docTtdHtml}</td>
                    <td style="text-align: center;">${verifInfoHtml}</td>
                    <td style="text-align: center;">${statusBadgeHtml}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function renderBaPagination() {
        const infoEl = document.getElementById('ba-pagination-info');
        const ctrlEl = document.getElementById('ba-pagination-controls');
        if (!infoEl || !ctrlEl) return;

        if (baState.total === 0) {
            infoEl.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            ctrlEl.innerHTML = '';
            return;
        }

        const pageSize = (baState.limit === 'all') ? baState.total : parseInt(baState.limit);
        const start = ((baState.page - 1) * pageSize) + 1;
        const end = Math.min(baState.page * pageSize, baState.total);
        infoEl.textContent = `Menampilkan ${start} sampai ${end} dari ${baState.total} data`;

        let html = '';
        html += `<button class="pagination-btn" ${baState.page <= 1 ? 'disabled' : ''} onclick="App.goToBaPage(${baState.page - 1})">Prev</button>`;

        const totalP = baState.totalPages;
        const curP = baState.page;
        let startP = Math.max(1, curP - 2);
        let endP = Math.min(totalP, startP + 4);
        if (endP - startP < 4) startP = Math.max(1, endP - 4);

        if (startP > 1) {
            html += `<button class="pagination-btn" onclick="App.goToBaPage(1)">1</button>`;
            if (startP > 2) html += `<span class="pagination-dots">...</span>`;
        }

        for (let p = startP; p <= endP; p++) {
            html += `<button class="pagination-btn ${p === curP ? 'active' : ''}" onclick="App.goToBaPage(${p})">${p}</button>`;
        }

        if (endP < totalP) {
            if (endP < totalP - 1) html += `<span class="pagination-dots">...</span>`;
            html += `<button class="pagination-btn" onclick="App.goToBaPage(${totalP})">${totalP}</button>`;
        }

        html += `<button class="pagination-btn" ${curP >= totalP ? 'disabled' : ''} onclick="App.goToBaPage(${curP + 1})">Next</button>`;
        ctrlEl.innerHTML = html;
    }

    function goToBaPage(p) {
        if (p < 1 || p > baState.totalPages || p === baState.page) return;
        loadBeritaAcaraData(p);
    }

    function onBaPeriodChange() {
        baState.page = 1;
        loadBeritaAcaraData(1);
    }

    function onBaDeptChange() {
        const el = document.getElementById('ba-filter-dept');
        baState.dept = el ? el.value : 'all';
        baState.sub_dept = 'all';
        baState.page = 1;
        loadBeritaAcaraData(1);
    }

    function onBaSubDeptChange() {
        const el = document.getElementById('ba-filter-subdept');
        baState.sub_dept = el ? el.value : 'all';
        baState.page = 1;
        loadBeritaAcaraData(1);
    }

    function onBaStatusFilterChange() {
        const el = document.getElementById('ba-filter-status');
        baState.status = el ? el.value : 'all';
        baState.page = 1;
        loadBeritaAcaraData(1);
    }

    function changeBaPageSize(size) {
        baState.limit = size;
        baState.page = 1;
        loadBeritaAcaraData(1);
    }

    let baSearchTimeout = null;
    function handleBaSearch(term) {
        clearTimeout(baSearchTimeout);
        baSearchTimeout = setTimeout(() => {
            baState.search = term.trim();
            baState.page = 1;
            loadBeritaAcaraData(1);
        }, 300);
    }

    // ═════════════════════════════════════════════════════════════════
    // ── Chat Room PIC Sites (WhatsApp Direct) ────────────────────────
    // ═════════════════════════════════════════════════════════════════
    let chatRoomSitesData = [];
    let chatRoomLoaded = false;
    let chatRoomLoadingPromise = null;

    async function loadChatRoomSites() {
        if (chatRoomLoaded) return chatRoomSitesData;
        if (chatRoomLoadingPromise) return chatRoomLoadingPromise;

        chatRoomLoadingPromise = (async () => {
            try {
                const res = await fetch('api/site_pics.php?action=chat_sites');
                const json = await res.json();
                if (json.success && Array.isArray(json.data)) {
                    chatRoomSitesData = json.data;
                    chatRoomLoaded = true;
                }
            } catch (err) {
                console.error('Failed to load chat room sites:', err);
            } finally {
                chatRoomLoadingPromise = null;
            }
            return chatRoomSitesData;
        })();

        return chatRoomLoadingPromise;
    }

    async function openChatRoomModal() {
        const modal = document.getElementById('chat-room-modal');
        if (!modal) return;

        // Reset inputs
        const deptSelect = document.getElementById('chat-room-dept');
        const subDeptSelect = document.getElementById('chat-room-subdept');
        const siteSelect = document.getElementById('chat-room-sitecode');
        const picInput = document.getElementById('chat-room-pic');
        const phoneInput = document.getElementById('chat-room-notelp');
        const alertEl = document.getElementById('chat-room-no-phone-alert');
        const msgInput = document.getElementById('chat-room-message');
        const sendBtn = document.getElementById('btn-chat-room-send');

        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">Memuat Dept...</option>';
            deptSelect.disabled = true;
        }
        if (subDeptSelect) {
            subDeptSelect.innerHTML = '<option value="">Pilih Dept </option>';
            subDeptSelect.disabled = true;
        }
        if (siteSelect) {
            siteSelect.innerHTML = '<option value="">Pilih Sub Dept </option>';
            siteSelect.disabled = true;
        }
        if (picInput) picInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (alertEl) alertEl.style.display = 'none';
        if (msgInput) msgInput.value = '';
        if (sendBtn) sendBtn.disabled = false;

        modal.style.display = 'flex';

        // Load data and populate DEPTs
        const sites = await loadChatRoomSites();
        if (deptSelect) {
            const depts = [...new Set(sites.map(s => (s.dept || '').trim()).filter(Boolean))].sort();
            deptSelect.innerHTML = '<option value="">Pilih Dept</option>';
            depts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                deptSelect.appendChild(opt);
            });
            deptSelect.disabled = false;
        }
    }

    function closeChatRoomModal() {
        const modal = document.getElementById('chat-room-modal');
        if (modal) modal.style.display = 'none';
    }

    function onChatRoomDeptChange(selectedDept) {
        const subDeptSelect = document.getElementById('chat-room-subdept');
        const siteSelect = document.getElementById('chat-room-sitecode');
        const picInput = document.getElementById('chat-room-pic');
        const phoneInput = document.getElementById('chat-room-notelp');
        const alertEl = document.getElementById('chat-room-no-phone-alert');
        const sendBtn = document.getElementById('btn-chat-room-send');

        if (picInput) picInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (alertEl) alertEl.style.display = 'none';
        if (sendBtn) sendBtn.disabled = false;

        if (!selectedDept) {
            if (subDeptSelect) {
                subDeptSelect.innerHTML = '<option value="">Pilih Sub Dept</option>';
                subDeptSelect.disabled = true;
            }
            if (siteSelect) {
                siteSelect.innerHTML = '<option value="">Pilih Sub Dept </option>';
                siteSelect.disabled = true;
            }
            return;
        }

        const filtered = chatRoomSitesData.filter(s => (s.dept || '').trim() === selectedDept);
        const subDepts = [...new Set(filtered.map(s => (s.sub_dept || '').trim()).filter(Boolean))].sort();

        if (subDeptSelect) {
            subDeptSelect.innerHTML = '<option value="">Pilih Sub Dept</option>';
            subDepts.forEach(sd => {
                const opt = document.createElement('option');
                opt.value = sd;
                opt.textContent = sd;
                subDeptSelect.appendChild(opt);
            });
            subDeptSelect.disabled = false;
        }

        if (siteSelect) {
            siteSelect.innerHTML = '<option value="">Pilih Sub Dept </option>';
            siteSelect.disabled = true;
        }
    }

    function onChatRoomSubDeptChange(selectedSubDept) {
        const deptSelect = document.getElementById('chat-room-dept');
        const siteSelect = document.getElementById('chat-room-sitecode');
        const picInput = document.getElementById('chat-room-pic');
        const phoneInput = document.getElementById('chat-room-notelp');
        const alertEl = document.getElementById('chat-room-no-phone-alert');
        const sendBtn = document.getElementById('btn-chat-room-send');

        if (picInput) picInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (alertEl) alertEl.style.display = 'none';
        if (sendBtn) sendBtn.disabled = false;

        if (!selectedSubDept) {
            if (siteSelect) {
                siteSelect.innerHTML = '<option value="">Pilih Sub Dept </option>';
                siteSelect.disabled = true;
            }
            return;
        }

        const selectedDept = deptSelect ? deptSelect.value : '';
        const filtered = chatRoomSitesData.filter(s =>
            (s.dept || '').trim() === selectedDept &&
            (s.sub_dept || '').trim() === selectedSubDept
        );

        if (siteSelect) {
            siteSelect.innerHTML = '<option value="">Pilih Sitecode</option>';
            filtered.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.sitecode;
                opt.textContent = `${s.sitecode} - ${s.name_site || ''}`;
                siteSelect.appendChild(opt);
            });
            siteSelect.disabled = false;
        }
    }

    function onChatRoomSitecodeChange(selectedSitecode) {
        const picInput = document.getElementById('chat-room-pic');
        const phoneInput = document.getElementById('chat-room-notelp');
        const alertEl = document.getElementById('chat-room-no-phone-alert');
        const sendBtn = document.getElementById('btn-chat-room-send');

        if (!selectedSitecode) {
            if (picInput) picInput.value = '';
            if (phoneInput) phoneInput.value = '';
            if (alertEl) alertEl.style.display = 'none';
            if (sendBtn) sendBtn.disabled = false;
            return;
        }

        const site = chatRoomSitesData.find(s => s.sitecode === selectedSitecode);
        if (!site) return;

        if (picInput) {
            picInput.value = site.pic && site.pic.trim() ? site.pic.trim() : 'No data PIC.';
        }

        const rawPhone = (site.no_telp || '').trim();
        if (phoneInput) {
            phoneInput.value = rawPhone;
        }

        const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
        if (!cleanDigits || cleanDigits.length < 8) {
            if (alertEl) alertEl.style.display = 'block';
            if (sendBtn) sendBtn.disabled = true;
        } else {
            if (alertEl) alertEl.style.display = 'none';
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    function submitChatRoomMessage() {
        const siteSelect = document.getElementById('chat-room-sitecode');
        const sitecode = siteSelect ? siteSelect.value : '';
        if (!sitecode) {
            if (typeof showToast === 'function') {
                showToast('warning', 'Peringatan', 'Silakan pilih DEPT, SUB DEPT, dan SITECODE .');
            } else {
                alert('Silakan pilih DEPT, SUB DEPT, dan SITECODE .');
            }
            return;
        }

        const phoneInput = document.getElementById('chat-room-notelp');
        const rawPhone = phoneInput ? phoneInput.value.trim() : '';
        let cleanNum = rawPhone.replace(/[^0-9]/g, '');

        if (!cleanNum || cleanNum.length < 8) {
            if (typeof showToast === 'function') {
                showToast('error', 'Nomor Tidak Tersedia', 'Site ini belum memiliki nomor WhatsApp PIC terdaftar.');
            } else {
                alert('Site ini belum memiliki nomor WhatsApp PIC terdaftar.');
            }
            return;
        }

        const msgInput = document.getElementById('chat-room-message');
        const message = msgInput ? msgInput.value.trim() : '';
        if (!message) {
            if (typeof showToast === 'function') {
                showToast('warning', 'Pesan Kosong', 'Silakan tuliskan pesan yang ingin dikirimkan.');
            } else {
                alert('Silakan tuliskan pesan yang ingin dikirimkan.');
            }
            if (msgInput) msgInput.focus();
            return;
        }

        // Format into international WhatsApp number
        if (cleanNum.startsWith('0')) {
            cleanNum = '62' + cleanNum.substring(1);
        } else if (cleanNum.startsWith('8')) {
            cleanNum = '62' + cleanNum;
        }

        const waUrl = `https://api.whatsapp.com/send?phone=${cleanNum}&text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');

        closeChatRoomModal();

        if (typeof showToast === 'function') {
            showToast('success', 'WhatsApp Dibuka', 'Mengalihkan pesan ke WhatsApp...');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // USER MANAGEMENT & USER ACCESS CONTROL (UAC) MODULE
    // ═══════════════════════════════════════════════════════════════

    let allUsersList = [];
    let userSearchQuery = '';
    let deleteUserTargetId = null;

    async function loadUsers() {
        const tbody = document.getElementById('user-table-tbody');
        const badge = document.getElementById('user-count-badge');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2.5rem; color: #64748b;">
                    Memuat data user administrator...
                </td>
            </tr>
        `;

        try {
            const res = await fetch('api/users.php?action=list');
            const json = await res.json();

            if (!json.success) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 2rem; color: #dc2626;">
                            ${escapeHtml(json.message || 'Gagal memuat data user')}
                        </td>
                    </tr>
                `;
                return;
            }

            allUsersList = json.data || [];
            if (badge) {
                badge.textContent = `Total: ${allUsersList.length} user`;
            }
            renderUsersTable();
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #dc2626;">
                        Network error: ${escapeHtml(err.message || 'Gagal terhubung')}
                    </td>
                </tr>
            `;
        }
    }

    function handleUserSearch(val) {
        userSearchQuery = (val || '').toLowerCase().trim();
        renderUsersTable();
    }

    function renderUsersTable() {
        const tbody = document.getElementById('user-table-tbody');
        const badge = document.getElementById('user-count-badge');
        if (!tbody) return;

        let filtered = allUsersList;
        if (userSearchQuery) {
            filtered = allUsersList.filter(u => {
                const name = (u.name || '').toLowerCase();
                const username = (u.username || '').toLowerCase();
                return name.includes(userSearchQuery) || username.includes(userSearchQuery);
            });
        }

        if (badge) {
            badge.textContent = `Total: ${filtered.length} user${userSearchQuery ? ' (difilter)' : ''}`;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2.5rem; color: #64748b;">
                        ${allUsersList.length === 0 ? 'Belum ada data user administrator.' : 'Data user tidak ditemukan.'}
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach((u, idx) => {
            const isSuperadmin = (u.username || '').toLowerCase() === 'd3utsch';
            const isSelf = window.AUTH_USER && (window.AUTH_USER.id === u.id);

            // Badges for UAC
            const uacBadges = [];
            if (u.can_access_all_summary !== false) {
                uacBadges.push(`<span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">All Summary</span>`);
            } else {
                uacBadges.push(`<span class="badge" style="background: #f1f5f9; color: #94a3b8; font-size: 11px; padding: 2px 7px; border-radius: 6px; text-decoration: line-through;">All Summary</span>`);
            }

            if (u.can_access_weekly_summary !== false) {
                uacBadges.push(`<span class="badge" style="background: #f5f3ff; color: #6b21a8; border: 1px solid #ddd6fe; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Weekly Summary</span>`);
            } else {
                uacBadges.push(`<span class="badge" style="background: #f1f5f9; color: #94a3b8; font-size: 11px; padding: 2px 7px; border-radius: 6px; text-decoration: line-through;">Weekly Summary</span>`);
            }

            if (u.can_access_reports !== false) {
                const deptsLabel = (!u.reports_depts || u.reports_depts === 'ALL') ? 'Reports: All Depts' : `Reports: ${escapeHtml(u.reports_depts)}`;
                uacBadges.push(`<span class="badge" style="background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">${deptsLabel}</span>`);
            } else {
                uacBadges.push(`<span class="badge" style="background: #f1f5f9; color: #94a3b8; font-size: 11px; padding: 2px 7px; border-radius: 6px; text-decoration: line-through;">Reports</span>`);
            }

            if (u.can_reset_report === true || isSuperadmin) {
                uacBadges.push(`<span class="badge" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Reset Report</span>`);
            }

            if (u.can_access_berita_acara !== false) {
                uacBadges.push(`<span class="badge" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Berita Acara</span>`);
            } else {
                uacBadges.push(`<span class="badge" style="background: #f1f5f9; color: #94a3b8; font-size: 11px; padding: 2px 7px; border-radius: 6px; text-decoration: line-through;">Berita Acara</span>`);
            }

            if (u.can_access_master_data !== false) {
                uacBadges.push(`<span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Master Data</span>`);
            } else {
                uacBadges.push(`<span class="badge" style="background: #f1f5f9; color: #94a3b8; font-size: 11px; padding: 2px 7px; border-radius: 6px; text-decoration: line-through;">Master Data</span>`);
            }

            if (u.can_access_master_data_weekly !== false) {
                uacBadges.push(`<span class="badge" style="background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Master Weekly</span>`);
            } else {
                uacBadges.push(`<span class="badge" style="background: #f1f5f9; color: #94a3b8; font-size: 11px; padding: 2px 7px; border-radius: 6px; text-decoration: line-through;">Master Weekly</span>`);
            }

            if (u.can_access_user_management !== false) {
                uacBadges.push(`<span class="badge" style="background: #fdf4ff; color: #a21caf; border: 1px solid #f0abfc; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">User Mgmt</span>`);
            } else {
                uacBadges.push(`<span class="badge" style="background: #f1f5f9; color: #94a3b8; font-size: 11px; padding: 2px 7px; border-radius: 6px; text-decoration: line-through;">User Mgmt</span>`);
            }

            if (u.can_master_add_import !== false) {
                uacBadges.push(`<span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Master: Add</span>`);
            }
            if (u.can_master_edit !== false) {
                uacBadges.push(`<span class="badge" style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Master: Edit</span>`);
            }
            if (u.can_master_delete !== false) {
                uacBadges.push(`<span class="badge" style="background: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Master: Del</span>`);
            }

            if (u.can_master_weekly_add_import !== false) {
                uacBadges.push(`<span class="badge" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Mst Wk: Add</span>`);
            }
            if (u.can_master_weekly_delete !== false) {
                uacBadges.push(`<span class="badge" style="background: #fdf2f8; color: #db2777; border: 1px solid #fbcfe8; font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 600;">Mst Wk: Del</span>`);
            }

            const updatedAt = u.updated_at ? new Date(u.updated_at).toLocaleString('id-ID', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '-';

            html += `
                <tr>
                    <td class="text-center" style="font-weight: 600; color: #64748b; vertical-align: middle;">${idx + 1}</td>
                    <td style="font-weight: 600; color: #1e293b; vertical-align: middle;">
                        ${escapeHtml(u.name || '-')}
                        ${isSelf ? '<span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 10px; margin-left: 6px; padding: 1px 6px; border-radius: 4px;">Anda</span>' : ''}
                    </td>
                    <td style="font-family: monospace; font-size: 12.5px; color: #334155; vertical-align: middle;">
                        ${escapeHtml(u.username || '-')}
                        ${isSuperadmin ? '<span class="badge" style="background: #fef3c7; color: #92400e; font-size: 10px; margin-left: 6px; padding: 1px 6px; border-radius: 4px; font-weight: 700;">Superadmin</span>' : ''}
                    </td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                            ${uacBadges.join('')}
                        </div>
                    </td>
                    <td class="text-center" style="font-size: 12px; color: #64748b; vertical-align: middle;">${updatedAt}</td>
                    <td class="text-center" style="vertical-align: middle;">
                        <div style="display: inline-flex; align-items: center; gap: 6px;">
                            <button type="button" class="btn btn-outline-primary btn-sm" onclick="App.openEditUserModal(${u.id})"
                                style="padding: 2px 8px; font-size: 11.5px; font-weight: 600;">
                                Edit
                            </button>
                            ${!isSuperadmin ? `
                                <button type="button" class="btn btn-outline-danger btn-sm" onclick="App.openDeleteUserModal(${u.id}, '${escapeHtml(u.username)}')"
                                    style="padding: 2px 8px; font-size: 11.5px; font-weight: 600;">
                                    Hapus
                                </button>
                            ` : `
                                <button type="button" class="btn btn-outline-secondary btn-sm" disabled title="Superadmin tidak dapat dihapus"
                                    style="padding: 2px 8px; font-size: 11.5px; opacity: 0.5; cursor: not-allowed;">
                                    Hapus
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function openAddUserModal() {
        const form = document.getElementById('user-management-form');
        if (form) form.reset();

        document.getElementById('user-form-id').value = '';
        document.getElementById('user-form-name').value = '';
        document.getElementById('user-form-username').value = '';
        document.getElementById('user-form-password').value = '';
        document.getElementById('user-form-password').required = true;
        document.getElementById('user-form-password-required').style.display = 'inline';
        document.getElementById('user-form-password-hint').style.display = 'none';

        document.getElementById('user-uac-all-summary').checked = true;
        document.getElementById('user-uac-weekly-summary').checked = true;
        const uacReportsAdd = document.getElementById('user-uac-reports');
        if (uacReportsAdd) uacReportsAdd.checked = true;
        const deptsContainer = document.getElementById('user-uac-reports-depts-container');
        if (deptsContainer) deptsContainer.style.display = 'block';
        document.querySelectorAll('.user-uac-dept-checkbox').forEach(cb => { cb.checked = true; });
        const uacReportsResetAdd = document.getElementById('user-uac-reports-reset');
        if (uacReportsResetAdd) uacReportsResetAdd.checked = false;
        const uacBaAdd = document.getElementById('user-uac-berita-acara');
        if (uacBaAdd) uacBaAdd.checked = true;
        document.getElementById('user-uac-master-data').checked = true;
        document.getElementById('user-uac-master-data-weekly').checked = true;
        const uacUserMgmtAdd = document.getElementById('user-uac-user-management');
        if (uacUserMgmtAdd) uacUserMgmtAdd.checked = true;
        document.getElementById('user-uac-master-add-import').checked = true;
        document.getElementById('user-uac-master-edit').checked = true;
        document.getElementById('user-uac-master-delete').checked = true;
        document.getElementById('user-uac-master-weekly-add-import').checked = true;
        document.getElementById('user-uac-master-weekly-delete').checked = true;

        document.getElementById('user-form-modal-title').textContent = 'Tambah User Administrator';
        document.getElementById('btn-submit-user').textContent = 'Simpan User';
        document.getElementById('user-form-modal').style.display = 'flex';
    }

    function openEditUserModal(id) {
        const user = allUsersList.find(u => u.id === id);
        if (!user) {
            showToast('error', 'Error', 'Data user tidak ditemukan.');
            return;
        }

        const isSuperadmin = (user.username || '').toLowerCase() === 'd3utsch';

        document.getElementById('user-form-id').value = user.id;
        document.getElementById('user-form-name').value = user.name || '';
        document.getElementById('user-form-username').value = user.username || '';
        document.getElementById('user-form-password').value = '';
        document.getElementById('user-form-password').required = false;
        document.getElementById('user-form-password-required').style.display = 'none';
        document.getElementById('user-form-password-hint').style.display = 'block';

        document.getElementById('user-uac-all-summary').checked = user.can_access_all_summary !== false;
        document.getElementById('user-uac-weekly-summary').checked = user.can_access_weekly_summary !== false;
        const uacReportsEdit = document.getElementById('user-uac-reports');
        if (uacReportsEdit) uacReportsEdit.checked = user.can_access_reports !== false;
        const deptsContainer = document.getElementById('user-uac-reports-depts-container');
        if (deptsContainer) deptsContainer.style.display = (user.can_access_reports !== false) ? 'block' : 'none';
        const rawDepts = user.reports_depts || 'ALL';
        const userDeptsArr = (rawDepts === 'ALL') ? ['PMD', 'CRO', 'ERO', 'WRO', 'BLANK', 'BLANKS'] : rawDepts.split(',').map(d => d.trim().toUpperCase());
        document.querySelectorAll('.user-uac-dept-checkbox').forEach(cb => {
            cb.checked = (rawDepts === 'ALL') || userDeptsArr.includes(cb.value.toUpperCase());
        });
        const uacReportsResetEdit = document.getElementById('user-uac-reports-reset');
        if (uacReportsResetEdit) uacReportsResetEdit.checked = (user.can_reset_report === true || isSuperadmin);
        const uacBaEdit = document.getElementById('user-uac-berita-acara');
        if (uacBaEdit) uacBaEdit.checked = user.can_access_berita_acara !== false;
        document.getElementById('user-uac-master-data').checked = user.can_access_master_data !== false;
        document.getElementById('user-uac-master-data-weekly').checked = user.can_access_master_data_weekly !== false;
        const uacUserMgmtEdit = document.getElementById('user-uac-user-management');
        if (uacUserMgmtEdit) uacUserMgmtEdit.checked = user.can_access_user_management !== false;
        document.getElementById('user-uac-master-add-import').checked = user.can_master_add_import !== false;
        document.getElementById('user-uac-master-edit').checked = user.can_master_edit !== false;
        document.getElementById('user-uac-master-delete').checked = user.can_master_delete !== false;
        document.getElementById('user-uac-master-weekly-add-import').checked = user.can_master_weekly_add_import !== false;
        document.getElementById('user-uac-master-weekly-delete').checked = user.can_master_weekly_delete !== false;

        document.getElementById('user-form-modal-title').textContent = isSuperadmin ? 'Edit Superadmin: D3utsch' : `Edit User: ${user.username}`;
        document.getElementById('btn-submit-user').textContent = 'Perbarui User';
        document.getElementById('user-form-modal').style.display = 'flex';
    }

    function closeUserModal() {
        const modal = document.getElementById('user-form-modal');
        if (modal) modal.style.display = 'none';
    }

    async function submitUserForm(event) {
        if (event) event.preventDefault();

        const id = document.getElementById('user-form-id').value;
        const name = document.getElementById('user-form-name').value.trim();
        const username = document.getElementById('user-form-username').value.trim();
        const password = document.getElementById('user-form-password').value;

        if (!name || !username) {
            showToast('error', 'Validasi Gagal', 'Nama User dan Username wajib diisi.');
            return;
        }

        if (!id && !password) {
            showToast('error', 'Validasi Gagal', 'Password wajib diisi untuk user baru.');
            return;
        }

        const selectedDepts = Array.from(document.querySelectorAll('.user-uac-dept-checkbox:checked')).map(cb => cb.value.toUpperCase());
        const allCheckboxes = Array.from(document.querySelectorAll('.user-uac-dept-checkbox'));
        const reportsDepts = (selectedDepts.length === 0 || selectedDepts.length === allCheckboxes.length) ? 'ALL' : selectedDepts.join(',');

        const payload = {
            id: id ? parseInt(id, 10) : null,
            name: name,
            username: username,
            password: password,
            can_access_all_summary: document.getElementById('user-uac-all-summary').checked,
            can_access_weekly_summary: document.getElementById('user-uac-weekly-summary').checked,
            can_access_reports: document.getElementById('user-uac-reports') ? document.getElementById('user-uac-reports').checked : true,
            reports_depts: reportsDepts,
            can_reset_report: document.getElementById('user-uac-reports-reset') ? document.getElementById('user-uac-reports-reset').checked : false,
            can_access_berita_acara: document.getElementById('user-uac-berita-acara') ? document.getElementById('user-uac-berita-acara').checked : true,
            can_access_master_data: document.getElementById('user-uac-master-data').checked,
            can_access_master_data_weekly: document.getElementById('user-uac-master-data-weekly').checked,
            can_access_user_management: document.getElementById('user-uac-user-management') ? document.getElementById('user-uac-user-management').checked : true,
            can_master_add_import: document.getElementById('user-uac-master-add-import').checked,
            can_master_edit: document.getElementById('user-uac-master-edit').checked,
            can_master_delete: document.getElementById('user-uac-master-delete').checked,
            can_master_weekly_add_import: document.getElementById('user-uac-master-weekly-add-import').checked,
            can_master_weekly_delete: document.getElementById('user-uac-master-weekly-delete').checked,
        };

        const submitBtn = document.getElementById('btn-submit-user');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Menyimpan...';
        }

        const action = id ? 'update' : 'create';

        try {
            const res = await fetch(`api/users.php?action=${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (json.success) {
                showToast('success', 'Berhasil', json.message || 'User berhasil disimpan.');
                closeUserModal();

                // If editing self, update local session permissions and apply immediately
                if (window.AUTH_USER && id && parseInt(id, 10) === window.AUTH_USER.id) {
                    window.AUTH_USER.name = name;
                    window.AUTH_USER.username = username;
                    window.AUTH_USER.permissions = {
                        can_access_all_summary: payload.can_access_all_summary,
                        can_access_weekly_summary: payload.can_access_weekly_summary,
                        can_access_reports: payload.can_access_reports,
                        reports_depts: payload.reports_depts,
                        can_access_master_data: payload.can_access_master_data,
                        can_access_master_data_weekly: payload.can_access_master_data_weekly,
                        can_master_add_import: payload.can_master_add_import,
                        can_master_edit: payload.can_master_edit,
                        can_master_delete: payload.can_master_delete,
                        can_master_weekly_add_import: payload.can_master_weekly_add_import,
                        can_master_weekly_delete: payload.can_master_weekly_delete,
                    };
                    applyUacPermissions();
                }

                loadUsers();
            } else {
                showToast('error', 'Gagal', json.message || 'Gagal menyimpan user.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan', err.message || 'Terjadi kesalahan sistem.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = id ? 'Perbarui User' : 'Simpan User';
            }
        }
    }

    function openDeleteUserModal(id, username) {
        deleteUserTargetId = id;
        const displayEl = document.getElementById('delete-user-username-display');
        if (displayEl) displayEl.textContent = `"${username}"`;
        const modal = document.getElementById('user-delete-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeUserDeleteModal() {
        deleteUserTargetId = null;
        const modal = document.getElementById('user-delete-modal');
        if (modal) modal.style.display = 'none';
    }

    async function confirmDeleteUser() {
        if (!deleteUserTargetId) return;

        const btn = document.getElementById('btn-confirm-delete-user');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Menghapus...';
        }

        try {
            const res = await fetch('api/users.php?action=delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({ id: deleteUserTargetId })
            });

            const json = await res.json();
            if (json.success) {
                showToast('success', 'Berhasil', json.message || 'User berhasil dihapus.');
                closeUserDeleteModal();
                loadUsers();
            } else {
                showToast('error', 'Gagal', json.message || 'Gagal menghapus user.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan', err.message || 'Terjadi kesalahan sistem.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Hapus User';
            }
        }
    }

    function onUserUacReportsChange(checked) {
        const container = document.getElementById('user-uac-reports-depts-container');
        if (container) {
            container.style.display = checked ? 'block' : 'none';
        }
    }

    function toggleAllUserUacDepts() {
        const checkboxes = document.querySelectorAll('.user-uac-dept-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // MASTER DATA: SO PROFILE WEEKLY (21 COLUMNS)
    // ═══════════════════════════════════════════════════════════════

    let allMasterWeeklyRows = [];
    let filteredMasterWeeklyRows = [];
    let currentMasterWeeklyPage = 1;
    let masterWeeklyPageSize = 10;
    let masterWeeklySearchQuery = '';
    let masterWeeklySortColumn = null;
    let masterWeeklySortDirection = 'asc';
    let selectedFileWeekly = null;
    let importFileTokenWeekly = null;

    async function loadMasterDataWeekly() {
        const tbody = document.getElementById('master-opname-weekly-tbody');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="21" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    Memuat data SO Profile Weekly...
                </td>
            </tr>
        `;

        try {
            const res = await fetch('api/reconciliation_weekly.php?action=list&page=1&page_size=all');
            const json = await res.json();

            if (!json.success) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="21" class="text-center" style="padding: 2rem; color: #dc2626;">
                            ${json.message || 'Gagal memuat data dari database'}
                        </td>
                    </tr>
                `;
                return;
            }

            allMasterWeeklyRows = json.data || [];
            applyFilterWeeklyAndRender();
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="21" class="text-center" style="padding: 2rem; color: #dc2626;">
                        Network error: ${escapeHtml(err.message || 'Unknown error')}
                    </td>
                </tr>
            `;
        }
    }

    function handleSearchWeekly(query) {
        masterWeeklySearchQuery = (query || '').toLowerCase().trim();
        currentMasterWeeklyPage = 1;
        applyFilterWeeklyAndRender();
    }

    function changePageSizeWeekly(size) {
        masterWeeklyPageSize = size === 'all' ? allMasterWeeklyRows.length : parseInt(size, 10);
        currentMasterWeeklyPage = 1;
        applyFilterWeeklyAndRender();
    }

    function goToPageWeekly(page) {
        const totalPages = Math.ceil(filteredMasterWeeklyRows.length / masterWeeklyPageSize) || 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentMasterWeeklyPage = page;
        renderMasterTableWeekly();
    }

    function applyFilterWeeklyAndRender() {
        let rows = allMasterWeeklyRows.slice();

        // Month filter
        const mFilter = document.getElementById('filter-weekly-month');
        if (mFilter && mFilter.value) {
            const m = parseInt(mFilter.value, 10);
            rows = rows.filter(r => parseInt(r.period_month, 10) === m);
        }

        // Week filter (Week 1, Week 2, Week 3, Week 4)
        const wFilter = document.getElementById('filter-weekly-week');
        if (wFilter && wFilter.value) {
            const w = parseInt(wFilter.value, 10);
            rows = rows.filter(r => parseInt(r.period_week, 10) === w);
        }

        // Year filter
        const yFilter = document.getElementById('filter-weekly-year');
        if (yFilter && yFilter.value) {
            const y = parseInt(yFilter.value, 10);
            rows = rows.filter(r => parseInt(r.period_year, 10) === y);
        }

        // Search query
        if (masterWeeklySearchQuery) {
            rows = rows.filter(r => (r.profile || '').toLowerCase().includes(masterWeeklySearchQuery));
        }

        // Sort
        if (masterWeeklySortColumn) {
            const isNumeric = [
                'match_physic_qty', 'match_physic_pct', 'match_nbv_value', 'match_nbv_pct',
                'physic_physic_qty', 'physic_physic_pct', 'physic_nbv_value', 'physic_nbv_pct',
                'db_physic_qty', 'db_physic_pct', 'db_nbv_value', 'db_nbv_pct',
                'total_physic_actual', 'total_physic_target', 'total_physic_pct',
                'total_nbv_actual', 'total_nbv_target', 'total_nbv_pct'
            ].includes(masterWeeklySortColumn);

            rows.sort((a, b) => {
                let valA = a[masterWeeklySortColumn];
                let valB = b[masterWeeklySortColumn];

                if (isNumeric) {
                    valA = parseFloat(valA) || 0;
                    valB = parseFloat(valB) || 0;
                    return masterWeeklySortDirection === 'asc' ? valA - valB : valB - valA;
                } else {
                    valA = (valA || '').toString();
                    valB = (valB || '').toString();
                    return masterWeeklySortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                }
            });
        }

        filteredMasterWeeklyRows = rows;
        currentMasterWeeklyPage = 1;
        renderMasterTableWeekly();
    }

    function toggleSortWeekly(col) {
        if (masterWeeklySortColumn === col) {
            masterWeeklySortDirection = masterWeeklySortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            masterWeeklySortColumn = col;
            masterWeeklySortDirection = 'asc';
        }
        applyFilterWeeklyAndRender();
        updateSortIndicatorsWeekly();
    }

    function updateSortIndicatorsWeekly() {
        document.querySelectorAll('#master-opname-weekly-table th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        document.querySelectorAll('#master-opname-weekly-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });

        if (masterWeeklySortColumn) {
            const activeTh = document.querySelector(`#master-opname-weekly-table th.sortable[onclick*="'${masterWeeklySortColumn}'"]`);
            if (activeTh) {
                activeTh.classList.add(masterWeeklySortDirection);
            }
            const activeInd = document.querySelector(`#master-opname-weekly-table .sort-indicator[data-col-weekly="${masterWeeklySortColumn}"]`);
            if (activeInd) {
                activeInd.textContent = masterWeeklySortDirection === 'asc' ? '▲' : '▼';
            }
        }
    }

    function renderMasterTableWeekly() {
        const tbody = document.getElementById('master-opname-weekly-tbody');
        const infoEl = document.getElementById('master-weekly-pagination-info');
        const controlsEl = document.getElementById('master-weekly-pagination-controls');
        if (!tbody) return;

        const totalItems = filteredMasterWeeklyRows.length;

        if (totalItems === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="21" class="text-center" style="padding: 2.5rem; color: #64748b;">
                        ${allMasterWeeklyRows.length === 0 ? "Tidak ada data SO Profile Weekly." : "Data SO Profile Weekly tidak ditemukan."}
                    </td>
                </tr>
            `;
            if (infoEl) infoEl.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            if (controlsEl) controlsEl.innerHTML = '';
            return;
        }

        const effectivePageSize = masterWeeklyPageSize > 0 ? masterWeeklyPageSize : totalItems;
        const totalPages = Math.ceil(totalItems / effectivePageSize) || 1;
        if (currentMasterWeeklyPage > totalPages) currentMasterWeeklyPage = totalPages;

        const startIndex = (currentMasterWeeklyPage - 1) * effectivePageSize;
        const endIndex = Math.min(startIndex + effectivePageSize, totalItems);
        const pageRows = filteredMasterWeeklyRows.slice(startIndex, endIndex);

        let html = '';
        pageRows.forEach(row => {
            html += `
                <tr>
                    <td class="text-left" style="font-weight: 500; max-width: 320px; white-space: normal;">
                        ${escapeHtml(row.profile)}
                    </td>
                    <td class="text-center">${escapeHtml(row.period_start)}</td>
                    <td class="text-center">${escapeHtml(row.period_end)}</td>

                    <!-- RESULT MATCH -->
                    <td class="text-right">${formatNumber(row.match_physic_qty)}</td>
                    <td class="text-right">${formatPercent(row.match_physic_pct)}</td>
                    <td class="text-right">${formatNumber(row.match_nbv_value)}</td>
                    <td class="text-right">${formatPercent(row.match_nbv_pct)}</td>

                    <!-- RESULT PHYSIC -->
                    <td class="text-right">${formatNumber(row.physic_physic_qty)}</td>
                    <td class="text-right">${formatPercent(row.physic_physic_pct)}</td>
                    <td class="text-right">${formatNumber(row.physic_nbv_value)}</td>
                    <td class="text-right">${formatPercent(row.physic_nbv_pct)}</td>

                    <!-- RESULT DB -->
                    <td class="text-right">${formatNumber(row.db_physic_qty)}</td>
                    <td class="text-right">${formatPercent(row.db_physic_pct)}</td>
                    <td class="text-right">${formatNumber(row.db_nbv_value)}</td>
                    <td class="text-right">${formatPercent(row.db_nbv_pct)}</td>

                    <!-- TOTAL -->
                    <td class="text-right" style="font-weight: 600;">${formatNumber(row.total_physic_actual)}</td>
                    <td class="text-right">${formatNumber(row.total_physic_target)}</td>
                    <td class="text-right" style="font-weight: 600;">${formatPercent(row.total_physic_pct)}</td>
                    <td class="text-right" style="font-weight: 600;">${formatNumber(row.total_nbv_actual)}</td>
                    <td class="text-right">${formatNumber(row.total_nbv_target)}</td>
                    <td class="text-right" style="font-weight: 600;">${formatPercent(row.total_nbv_pct)}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        if (infoEl) {
            infoEl.textContent = `Menampilkan ${totalItems > 0 ? (startIndex + 1).toLocaleString('id-ID') : 0} sampai ${endIndex.toLocaleString('id-ID')} dari ${totalItems.toLocaleString('id-ID')} data`;
        }

        if (controlsEl) {
            if (totalPages <= 1 || masterWeeklyPageSize === 'all') {
                controlsEl.innerHTML = '';
            } else {
                let btnsHtml = '';
                btnsHtml += `<button class="pagination-btn" ${currentMasterWeeklyPage === 1 ? 'disabled' : ''} onclick="App.goToPageWeekly(${currentMasterWeeklyPage - 1})">&laquo; Prev</button>`;

                const maxButtons = 5;
                let startPage = Math.max(1, currentMasterWeeklyPage - Math.floor(maxButtons / 2));
                let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                if (endPage - startPage + 1 < maxButtons) {
                    startPage = Math.max(1, endPage - maxButtons + 1);
                }

                if (startPage > 1) {
                    btnsHtml += `<button class="pagination-btn" onclick="App.goToPageWeekly(1)">1</button>`;
                    if (startPage > 2) btnsHtml += `<span class="pagination-ellipsis">...</span>`;
                }

                for (let p = startPage; p <= endPage; p++) {
                    btnsHtml += `<button class="pagination-btn ${p === currentMasterWeeklyPage ? 'active' : ''}" onclick="App.goToPageWeekly(${p})">${p}</button>`;
                }

                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) btnsHtml += `<span class="pagination-ellipsis">...</span>`;
                    btnsHtml += `<button class="pagination-btn" onclick="App.goToPageWeekly(${totalPages})">${totalPages}</button>`;
                }

                btnsHtml += `<button class="pagination-btn" ${currentMasterWeeklyPage === totalPages ? 'disabled' : ''} onclick="App.goToPageWeekly(${currentMasterWeeklyPage + 1})">Next &raquo;</button>`;

                controlsEl.innerHTML = btnsHtml;
            }
        }

        // Apply UAC permissions to dynamic buttons if any
        applyUacPermissions();
    }

    // Weekly Drag and Drop Setup
    function setupWeeklyDragAndDrop() {
        const dropZone = document.getElementById('drag-drop-zone-weekly');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleFileSelectWeekly(dt.files);
            }
        });
    }

    function openImportModalWeekly() {
        clearSelectedFileWeekly();
        const statusDiv = document.getElementById('modal-import-weekly-status');
        if (statusDiv) statusDiv.style.display = 'none';
        const modal = document.getElementById('import-weekly-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeImportModalWeekly() {
        const modal = document.getElementById('import-weekly-modal');
        if (modal) modal.style.display = 'none';
        clearSelectedFileWeekly();
    }

    async function handleFileSelectWeekly(files) {
        if (!files || files.length === 0) return;
        const file = files[0];

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            showToast('error', 'File Tidak Valid', 'Hanya file Excel (.xlsx, .xls) yang diperbolehkan.');
            return;
        }

        selectedFileWeekly = file;
        importFileTokenWeekly = null;

        const displayEl = document.getElementById('selected-weekly-file-display');
        const nameEl = document.getElementById('selected-weekly-file-name');
        const sizeEl = document.getElementById('selected-weekly-file-size');

        if (displayEl && nameEl && sizeEl) {
            nameEl.textContent = file.name;
            const sizeKb = Math.round(file.size / 1024);
            sizeEl.textContent = `(${sizeKb.toLocaleString()} KB)`;
            displayEl.style.display = 'block';
        }

        const sheetGroup = document.getElementById('import-weekly-sheet-group');
        const sheetSelect = document.getElementById('import-weekly-sheet-select');
        const sheetHint = document.getElementById('import-weekly-sheet-hint');
        const submitBtn = document.getElementById('modal-weekly-upload-btn');

        if (sheetGroup && sheetSelect) {
            sheetGroup.style.display = 'block';
            sheetSelect.innerHTML = '<option value="">Membaca sheet dari file...</option>';
            sheetSelect.disabled = true;
            if (sheetHint) sheetHint.textContent = 'Mohon tunggu saat membaca nama lembar kerja...';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Membaca sheet...';
        }

        try {
            const json = await fetchExcelSheets(file);
            if (json.success && json.sheets && json.sheets.length > 0) {
                importFileTokenWeekly = json.file_token || null;
                sheetSelect.innerHTML = '';
                let bestSheetVal = '';
                json.sheets.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    sheetSelect.appendChild(opt);

                    const sLower = s.toLowerCase();
                    if (!bestSheetVal && (sLower.includes('reconcil') || sLower.includes('weekly') || sLower.includes('profile') || sLower.includes('so'))) {
                        bestSheetVal = s;
                    }
                });
                if (bestSheetVal) {
                    sheetSelect.value = bestSheetVal;
                }
                sheetSelect.disabled = false;
                if (sheetHint) {
                    sheetHint.textContent = json.sheets.length === 1
                        ? '1 sheet terdeteksi pada file.'
                        : `${json.sheets.length} sheet ditemukan. Silakan pilih sheet untuk diimpor.`;
                }
            } else {
                sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
                sheetSelect.disabled = false;
                if (sheetHint) sheetHint.textContent = json.message || 'Tidak dapat membaca sheet; sheet default akan digunakan.';
            }
        } catch (err) {
            sheetSelect.innerHTML = '<option value="">Sheet Default</option>';
            sheetSelect.disabled = false;
            if (sheetHint) sheetHint.textContent = 'Tidak dapat membaca sheet; sheet default akan digunakan.';
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Unggah & Impor';
            }
        }
    }

    function clearSelectedFileWeekly() {
        selectedFileWeekly = null;
        importFileTokenWeekly = null;
        const fileInput = document.getElementById('import-weekly-file-input');
        if (fileInput) fileInput.value = '';

        const displayEl = document.getElementById('selected-weekly-file-display');
        if (displayEl) displayEl.style.display = 'none';

        const sheetGroup = document.getElementById('import-weekly-sheet-group');
        const sheetSelect = document.getElementById('import-weekly-sheet-select');
        const sheetHint = document.getElementById('import-weekly-sheet-hint');
        if (sheetGroup) sheetGroup.style.display = 'none';
        if (sheetSelect) {
            sheetSelect.innerHTML = '<option value="">Pilih Sheet...</option>';
            sheetSelect.disabled = false;
        }
        if (sheetHint) sheetHint.textContent = '';

        const submitBtn = document.getElementById('modal-weekly-upload-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unggah & Impor';
        }
    }

    async function submitImportWeekly() {
        if (!selectedFileWeekly) {
            showToast('error', 'File Belum Dipilih', 'Silakan pilih atau seret & lepas file Excel.');
            return;
        }

        const monthSelect = document.getElementById('import-weekly-month');
        const weekSelect = document.getElementById('import-weekly-week');
        const yearSelect = document.getElementById('import-weekly-year');
        const submitBtn = document.getElementById('modal-weekly-upload-btn');
        const statusDiv = document.getElementById('modal-import-weekly-status');

        const month = monthSelect ? monthSelect.value : '';
        const week = weekSelect ? weekSelect.value : '1';
        const year = yearSelect ? yearSelect.value : '';

        const replaceExisting = document.getElementById('import-weekly-replace-existing')?.checked ? '1' : '0';
        const sheetSelect = document.getElementById('import-weekly-sheet-select');
        const sheetName = sheetSelect ? sheetSelect.value : '';

        const formData = new FormData();
        formData.append('month', month);
        formData.append('week', week);
        formData.append('year', year);
        formData.append('replace_existing', replaceExisting);
        formData.append('sheet_name', sheetName);
        if (importFileTokenWeekly) {
            formData.append('file_token', importFileTokenWeekly);
        } else {
            formData.append('excel_file', selectedFileWeekly);
        }
        formData.append('csrf_token', csrfToken);

        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengunggah...';

        statusDiv.style.display = 'block';
        statusDiv.style.background = '#eff6ff';
        statusDiv.style.color = '#1d4ed8';
        statusDiv.style.border = '1px solid #bfdbfe';
        statusDiv.textContent = 'Mengunggah dan memproses data SO Weekly...';

        try {
            const res = await fetch('api/import_weekly.php', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                },
                body: formData
            });

            const rawText = await res.text();
            let json;
            try {
                json = JSON.parse(rawText);
            } catch (parseErr) {
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = 'Kesalahan server: ' + (rawText.replace(/<[^>]*>?/gm, '').trim().substring(0, 150) || 'Respon tidak valid');
                showToast('error', 'Kesalahan Server', 'Respon server tidak valid.');
                return;
            }

            if (json.success) {
                statusDiv.style.background = '#f0fdf4';
                statusDiv.style.color = '#15803d';
                statusDiv.style.border = '1px solid #bbf7d0';
                statusDiv.textContent = json.message || 'Impor SO Weekly berhasil!';

                showToast('success', 'Impor Selesai', json.message || 'Data SO Weekly berhasil diimpor.');

                if (json.detected_period) {
                    const mFilter = document.getElementById('filter-weekly-month');
                    const wFilter = document.getElementById('filter-weekly-week');
                    const yFilter = document.getElementById('filter-weekly-year');
                    if (mFilter && json.detected_period.month) mFilter.value = String(json.detected_period.month);
                    if (wFilter && json.detected_period.week) wFilter.value = String(json.detected_period.week);
                    if (yFilter && json.detected_period.year) yFilter.value = String(json.detected_period.year);
                }

                loadMasterDataWeekly();
                loadWeeklySummary(true);

                setTimeout(() => {
                    closeImportModalWeekly();
                }, 1200);
            } else {
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = json.message || 'Impor gagal.';
                showToast('error', 'Impor Gagal', json.message || 'Gagal mengimpor file.');
            }
        } catch (err) {
            statusDiv.style.background = '#fef2f2';
            statusDiv.style.color = '#b91c1c';
            statusDiv.style.border = '1px solid #fecaca';
            statusDiv.textContent = 'Kesalahan koneksi: ' + (err.message || 'Gagal terhubung');
            showToast('error', 'Kesalahan Server', err.message || 'Gagal terhubung ke server.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unggah & Impor';
        }
    }

    function openBulkDeleteModalWeekly() {
        const statusDiv = document.getElementById('bulk-delete-weekly-status');
        if (statusDiv) statusDiv.style.display = 'none';
        const modal = document.getElementById('bulk-delete-weekly-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeBulkDeleteModalWeekly() {
        const modal = document.getElementById('bulk-delete-weekly-modal');
        if (modal) modal.style.display = 'none';
    }

    async function submitBulkDeleteWeekly() {
        const month = document.getElementById('bulk-delete-weekly-month')?.value || '';
        const week = document.getElementById('bulk-delete-weekly-week')?.value || '';
        const year = document.getElementById('bulk-delete-weekly-year')?.value || '';
        const btn = document.getElementById('bulk-delete-weekly-submit-btn');
        const statusDiv = document.getElementById('bulk-delete-weekly-status');

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Menghapus...';
        }

        try {
            const res = await fetch('api/reconciliation_weekly.php?action=bulk_delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken
                },
                body: JSON.stringify({
                    month: month ? parseInt(month, 10) : '',
                    week: week ? parseInt(week, 10) : '',
                    year: year ? parseInt(year, 10) : ''
                })
            });

            const json = await res.json();
            if (json.success) {
                showToast('success', 'Berhasil', json.message || 'Data SO Weekly berhasil dihapus.');
                closeBulkDeleteModalWeekly();
                loadMasterDataWeekly();
                loadWeeklySummary(true);
            } else {
                if (statusDiv) {
                    statusDiv.style.display = 'block';
                    statusDiv.style.background = '#fef2f2';
                    statusDiv.style.color = '#b91c1c';
                    statusDiv.style.border = '1px solid #fecaca';
                    statusDiv.textContent = json.message || 'Gagal menghapus data.';
                }
                showToast('error', 'Gagal', json.message || 'Gagal menghapus data.');
            }
        } catch (err) {
            showToast('error', 'Kesalahan', err.message || 'Gagal terhubung ke server.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Ya, Hapus Data';
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // WEEKLY SUMMARY MODULE
    // Only displays:
    // 1. Achievements Cards (with vs previous period trend comparison ▲/▼ +/- %)
    // 2. Score Card Summary (Rating & Execution pie charts & tables)
    // 3. Report SO (data table)
    // Controls: ONLY switch of PMD and Outlet Regional, Bulan, Week, Tahun
    // ═══════════════════════════════════════════════════════════════

    let currentWeeklyCategory = 'pmd';
    let weeklySummaryData = null;
    let currentWeeklyRatingFilter = 'very_poor';
    let currentWeeklyExecutionFilter = 'not_executed';
    let currentWeeklyScorecardDeptFilter = 'all';
    let currentWeeklyScorecardSubDeptFilter = 'all';
    let weeklyReportSortColumn = null;
    let weeklyReportSortDirection = 'asc';
    let weeklyScorecardRatingPieChart = null;
    let weeklyScorecardExecPieChart = null;
    let weeklyReportPageSize = 10;
    let currentWeeklyReportPage = 1;
    let filteredWeeklyReportRows = [];
    let weeklySummaryInitialized = false;
    let weeklyAvailablePeriods = [];
    let weeklyLatestPeriod = null;

    function switchWeeklyCategory(cat) {
        currentWeeklyCategory = cat === 'outlet' ? 'outlet' : 'pmd';
        currentWeeklyReportPage = 1;
        currentWeeklyScorecardDeptFilter = 'all';
        currentWeeklyScorecardSubDeptFilter = 'all';

        try {
            sessionStorage.setItem('weekly_category', currentWeeklyCategory);
        } catch (e) { }

        // Update slider button states
        const btnPmd = document.getElementById('btn-weekly-cat-pmd');
        const btnOutlet = document.getElementById('btn-weekly-cat-outlet');
        if (btnPmd) btnPmd.classList.toggle('active', currentWeeklyCategory === 'pmd');
        if (btnOutlet) btnOutlet.classList.toggle('active', currentWeeklyCategory === 'outlet');

        // Update category status label
        const statusEl = document.getElementById('weekly-cat-status');
        if (statusEl) {
            if (currentWeeklyCategory === 'pmd') {
                statusEl.innerHTML = `(<strong style="color: #9333ea;">PMD</strong> Target 98%)`;
            } else {
                statusEl.innerHTML = `(<strong style="color: #2563eb;">Outlet Regional</strong> Target 85%)`;
            }
        }

        // Update card titles
        const execTitle = document.getElementById('weekly-executive-title');
        if (execTitle) {
            execTitle.textContent = 'Executive Summary';
        }

        const reportTitle = document.getElementById('weekly-hasil-so-title');
        if (reportTitle) {
            reportTitle.textContent = currentWeeklyCategory === 'pmd' ? 'Report Stock Opname PMD (Weekly)' : 'Report Stock Opname Outlet Regional (Weekly)';
        }

        const pieTitle = document.getElementById('weekly-pie-title');
        if (pieTitle) {
            pieTitle.textContent = currentWeeklyCategory === 'pmd' ? 'Status Pencapaian PMD' : 'Status Pencapaian Outlet Regional';
        }

        // Toggle card groups in achievements
        const isPmd = (currentWeeklyCategory === 'pmd');
        const pmdCard = document.getElementById('weekly-kpi-card-pmd');
        const dnoCard = document.getElementById('weekly-kpi-card-dno');
        const dsoCard = document.getElementById('weekly-kpi-card-dso');

        if (pmdCard) pmdCard.style.display = isPmd ? '' : 'none';
        if (dnoCard) dnoCard.style.display = isPmd ? '' : 'none';
        if (dsoCard) dsoCard.style.display = isPmd ? '' : 'none';

        const outletCard = document.getElementById('weekly-kpi-card-outlet-national');
        const wroGroup = document.getElementById('weekly-kpi-group-wro');
        const croGroup = document.getElementById('weekly-kpi-group-cro');
        const eroGroup = document.getElementById('weekly-kpi-group-ero');

        if (outletCard) outletCard.style.display = !isPmd ? '' : 'none';
        if (wroGroup) wroGroup.style.display = !isPmd ? '' : 'none';
        if (croGroup) croGroup.style.display = !isPmd ? '' : 'none';
        if (eroGroup) eroGroup.style.display = !isPmd ? '' : 'none';

        loadWeeklySummary();
    }

    async function loadWeeklySummary(forceLatest = false) {
        const monthEl = document.getElementById('weekly-filter-month');
        const weekEl = document.getElementById('weekly-filter-week');
        const yearEl = document.getElementById('weekly-filter-year');

        const isInitial = !weeklySummaryInitialized || forceLatest;

        // If not initial, read selected values from dropdowns
        const m = (!isInitial && monthEl && monthEl.value) ? monthEl.value : '';
        const w = (!isInitial && weekEl && weekEl.value) ? weekEl.value : '';
        const y = (!isInitial && yearEl && yearEl.value) ? yearEl.value : '';

        const monthNames = {
            1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
            5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
            9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'
        };

        const updateBadges = (monthVal, weekVal, yearVal) => {
            const periodStr = `${monthNames[parseInt(monthVal, 10)] || 'Bulan ' + monthVal} - Week ${weekVal} ${yearVal}`;
            const badges = [
                'weekly-executive-period-badge',
                'weekly-scorecard-rating-period-badge',
                'weekly-scorecard-exec-period-badge',
                'weekly-report-period-badge'
            ];
            badges.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = periodStr;
            });
        };

        if (m && w && y) {
            updateBadges(m, w, y);
        }

        try {
            let url = `api/reconciliation_weekly.php?action=summary&category=${currentWeeklyCategory}`;
            if (m && w && y) {
                url += `&month=${encodeURIComponent(m)}&week=${encodeURIComponent(w)}&year=${encodeURIComponent(y)}`;
            }

            const res = await fetch(url);
            const json = await res.json();

            if (!json.success) {
                showToast('error', 'Error', json.message || 'Gagal memuat data Weekly Summary.');
                return;
            }

            weeklySummaryData = json;
            weeklyAvailablePeriods = json.available_periods || [];
            weeklyLatestPeriod = json.latest_period || null;

            // Automatically sync dropdowns to the returned (latest or active) period
            if (json.period) {
                const resM = String(json.period.month);
                const resW = String(json.period.week);
                const resY = String(json.period.year);

                if (monthEl && resM) monthEl.value = resM;
                if (weekEl && resW) weekEl.value = resW;
                if (yearEl && resY) {
                    if (!Array.from(yearEl.options).some(o => o.value === resY)) {
                        const opt = document.createElement('option');
                        opt.value = resY;
                        opt.textContent = resY;
                        yearEl.appendChild(opt);
                    }
                    yearEl.value = resY;
                }

                updateBadges(resM, resW, resY);

                try {
                    sessionStorage.setItem('weekly_filter_month', resM);
                    sessionStorage.setItem('weekly_filter_week', resW);
                    sessionStorage.setItem('weekly_filter_year', resY);
                } catch (e) { }
            }

            weeklySummaryInitialized = true;

            // 1. Render Achievements Cards
            renderWeeklyAchievements(json.achievements);

            // 2. Render Score Card Summary
            renderWeeklyScorecard(json.scorecard);

            // 3. Populate Dept filter and render Report SO
            populateWeeklyDeptFilter(json.report_so || []);
            applyWeeklyReportSoFilter();

        } catch (err) {
            console.error('loadWeeklySummary error:', err);
            showToast('error', 'Error', 'Gagal memuat data Weekly Summary.');
        }
    }

    function onWeeklyMonthChange() {
        const monthEl = document.getElementById('weekly-filter-month');
        const weekEl = document.getElementById('weekly-filter-week');
        const yearEl = document.getElementById('weekly-filter-year');

        const m = parseInt(monthEl?.value, 10);
        const y = parseInt(yearEl?.value, 10) || (new Date()).getFullYear();

        if (m && weeklyAvailablePeriods.length > 0) {
            const matching = weeklyAvailablePeriods.filter(p => p.month === m && (!y || p.year === y));
            if (matching.length > 0) {
                // Automatically choose latest available week for this month
                const maxWeek = Math.max(...matching.map(p => p.week));
                if (weekEl) weekEl.value = String(maxWeek);
            }
        }
        loadWeeklySummary();
    }

    function onWeeklyYearChange() {
        const monthEl = document.getElementById('weekly-filter-month');
        const weekEl = document.getElementById('weekly-filter-week');
        const yearEl = document.getElementById('weekly-filter-year');

        const y = parseInt(yearEl?.value, 10);
        if (y && weeklyAvailablePeriods.length > 0) {
            const matching = weeklyAvailablePeriods.filter(p => p.year === y);
            if (matching.length > 0) {
                const maxMonth = Math.max(...matching.map(p => p.month));
                const monthWeeks = matching.filter(p => p.month === maxMonth);
                const maxWeek = Math.max(...monthWeeks.map(p => p.week));
                if (monthEl) monthEl.value = String(maxMonth);
                if (weekEl) weekEl.value = String(maxWeek);
            }
        }
        loadWeeklySummary();
    }

    function renderWeeklyAchievements(achievements) {
        if (!achievements) return;

        const isPmd = (currentWeeklyCategory === 'pmd');

        // Shared helper matching monthly summary page updateAchCard
        const updateWeeklyAchCard = (valId, subId, trendId, statusId, item, defaultLabel, isPmdCard = false, customTarget = null) => {
            const rawPct = item && item.pct !== null && item.pct !== undefined ? parseFloat(item.pct) : 0;
            const pct = rawPct;
            const count = item?.sites_counted !== undefined ? item.sites_counted : (item?.count || 0);
            const total = item?.total_sites !== undefined ? item.total_sites : (item?.total || 0);
            let threshold = isPmdCard ? 98 : 85;
            if (customTarget !== null) {
                threshold = customTarget;
            }
            const color = (total === 0 || count === 0) ? '#94a3b8' : getPctColor(pct, threshold === 98);

            const valEl = document.getElementById(valId);
            if (valEl) {
                valEl.textContent = `${pct.toFixed(2)}%`;
                valEl.style.color = color;
            }

            const subEl = document.getElementById(subId);
            if (subEl) {
                subEl.textContent = `${defaultLabel} (${count}/${total} Sites)`;
            }

            const statusEl = document.getElementById(statusId);
            if (statusEl) {
                if (total === 0 || count === 0) {
                    statusEl.innerHTML = '<span class="so-status-badge status-none">Belum Ada Data</span>';
                } else if (pct >= threshold) {
                    statusEl.innerHTML = '<span class="so-status-badge status-green">Tercapai</span>';
                } else {
                    statusEl.innerHTML = '<span class="so-status-badge status-red">Tidak Tercapai</span>';
                }
            }

            const trendEl = document.getElementById(trendId);
            if (trendEl) {
                if (total === 0 || count === 0) {
                    trendEl.innerHTML = '';
                } else {
                    let diff = null;
                    if (item && item.diff_pct !== undefined && item.diff_pct !== null) {
                        diff = Number(item.diff_pct);
                    } else if (item && item.prev_pct !== undefined && item.prev_pct !== null && item.pct !== null && item.pct !== undefined) {
                        diff = Number(item.pct) - Number(item.prev_pct);
                    }

                    if (diff === null) {
                        trendEl.innerHTML = '<span class="kpi-target-indicator target-neutral"><span>-</span></span>';
                    } else {
                        const isUp = diff > 0;
                        const isDown = diff < 0;
                        const sign = isUp ? '+' : '';
                        const trendClass = isUp ? 'target-up' : (isDown ? 'target-down' : 'target-neutral');
                        const formattedDiff = `${sign}${diff.toFixed(2)}%`;

                        // Solid triangle style: up (green) if > 0, down (red) if < 0
                        const triangleSvg = isUp
                            ? `<svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"/></svg>`
                            : (isDown ? `<svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"/></svg>` : '');

                        trendEl.innerHTML = `
                            <span class="kpi-target-indicator ${trendClass}">
                                ${triangleSvg}
                                <span>${formattedDiff}</span>
                            </span>
                        `;
                    }
                }
            }
        };

        // Shared helper matching monthly summary page updateSubDeptCard
        const updateWeeklySubDeptCard = (subKey) => {
            const sKey = subKey.toLowerCase();
            const upperKey = subKey.toUpperCase();
            const subDeptsData = achievements.sub_depts || {};
            const sData = subDeptsData[upperKey] || subDeptsData[sKey] || {};
            const rawPct = sData.pct !== undefined && sData.pct !== null ? parseFloat(sData.pct) : 0;
            const pct = rawPct;
            const count = sData.sites_counted !== undefined ? sData.sites_counted : (sData.count || 0);
            const total = sData.total_sites !== undefined ? sData.total_sites : (sData.total || 0);
            const threshold = isPmd ? 98 : 85;
            const color = (total === 0 || count === 0) ? '#94a3b8' : getPctColor(pct, threshold === 98);

            const valEl = document.getElementById(`weekly-kpi-subdept-val-${sKey}`);
            if (valEl) {
                valEl.textContent = `${pct.toFixed(2)}%`;
                valEl.style.color = color;
            }

            const metaEl = document.getElementById(`weekly-kpi-subdept-meta-${sKey}`);
            if (metaEl) {
                metaEl.textContent = `${count}/${total} Sites`;
            }

            const trendEl = document.getElementById(`weekly-kpi-subdept-trend-${sKey}`);
            if (trendEl) {
                if (total === 0 || count === 0) {
                    trendEl.innerHTML = '';
                } else {
                    let diff = null;
                    if (sData && sData.diff_pct !== undefined && sData.diff_pct !== null) {
                        diff = Number(sData.diff_pct);
                    } else if (sData && sData.prev_pct !== undefined && sData.prev_pct !== null && sData.pct !== null && sData.pct !== undefined) {
                        diff = Number(sData.pct) - Number(sData.prev_pct);
                    }

                    if (diff === null) {
                        trendEl.innerHTML = '<span class="kpi-target-indicator target-neutral"><span>-</span></span>';
                    } else {
                        const isUp = diff > 0;
                        const isDown = diff < 0;
                        const sign = isUp ? '+' : '';
                        const trendClass = isUp ? 'target-up' : (isDown ? 'target-down' : 'target-neutral');
                        const formattedDiff = `${sign}${diff.toFixed(2)}%`;
                        const triangleSvg = isUp
                            ? `<svg width="5.5" height="5.5" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"/></svg>`
                            : (isDown ? `<svg width="5.5" height="5.5" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"/></svg>` : '');

                        trendEl.innerHTML = `
                            <span class="kpi-target-indicator ${trendClass}">
                                ${triangleSvg}
                                <span>${formattedDiff}</span>
                            </span>
                        `;
                    }
                }
            }

            const statusEl = document.getElementById(`weekly-kpi-subdept-status-${sKey}`);
            if (statusEl) {
                if (total === 0 || count === 0) {
                    statusEl.innerHTML = '<span class="so-status-badge status-none">Belum Ada Data</span>';
                } else if (pct >= threshold) {
                    statusEl.innerHTML = '<span class="so-status-badge status-green">Tercapai</span>';
                } else {
                    statusEl.innerHTML = '<span class="so-status-badge status-red">Tidak Tercapai</span>';
                }
            }
        };

        if (isPmd) {
            const main = achievements.main || {};
            const subDepts = achievements.sub_depts || {};
            const dno = subDepts['DNO'] || subDepts['dno'] || {};
            const dso = subDepts['DSO'] || subDepts['dso'] || {};

            updateWeeklyAchCard('weekly-kpi-pmd-achievement', 'weekly-kpi-pmd-subtext', 'weekly-kpi-pmd-trend', 'weekly-kpi-pmd-status', main, 'Avg PMD Divisi', true);
            updateWeeklyAchCard('weekly-kpi-dno-achievement', 'weekly-kpi-dno-subtext', 'weekly-kpi-dno-trend', 'weekly-kpi-dno-status', dno, 'Avg DEPT DNO', true);
            updateWeeklyAchCard('weekly-kpi-dso-achievement', 'weekly-kpi-dso-subtext', 'weekly-kpi-dso-trend', 'weekly-kpi-dso-status', dso, 'Avg DEPT DSO', true);
        } else {
            const main = achievements.main || {};
            const depts = achievements.depts || {};
            const cro = depts['CRO'] || depts['cro'] || {};
            const ero = depts['ERO'] || depts['ero'] || {};
            const wro = depts['WRO'] || depts['wro'] || {};

            updateWeeklyAchCard('weekly-kpi-outlet-achievement', 'weekly-kpi-outlet-subtext', 'weekly-kpi-outlet-trend', 'weekly-kpi-outlet-status', main, 'Avg Outlet Regional', false, 85);
            updateWeeklyAchCard('weekly-kpi-cro-achievement', 'weekly-kpi-cro-subtext', 'weekly-kpi-cro-trend', 'weekly-kpi-cro-status', cro, 'Avg DEPT CRO', false, 85);
            updateWeeklyAchCard('weekly-kpi-ero-achievement', 'weekly-kpi-ero-subtext', 'weekly-kpi-ero-trend', 'weekly-kpi-ero-status', ero, 'Avg DEPT ERO', false, 85);
            updateWeeklyAchCard('weekly-kpi-wro-achievement', 'weekly-kpi-wro-subtext', 'weekly-kpi-wro-trend', 'weekly-kpi-wro-status', wro, 'Avg DEPT WRO', false, 85);

            ['cso', 'nso', 'sso', 'cjdo', 'eko', 'wjo', 'wko', 'bno', 'ejo', 'mpo', 'smo'].forEach(updateWeeklySubDeptCard);
        }
    }

    function renderWeeklyScorecard(scorecard) {
        if (!scorecard) return;

        populateWeeklyScorecardFilters(scorecard.sites || []);
        applyWeeklyScorecardFiltersAndRender();
    }

    function populateWeeklyScorecardFilters(sites) {
        const deptSelect = document.getElementById('weekly-scorecard-dept-filter');
        const subdeptSelect = document.getElementById('weekly-scorecard-subdept-filter');
        if (!deptSelect || !subdeptSelect) return;

        const isPmd = (currentWeeklyCategory === 'pmd');

        let deptHtml = '<option value="all">Semua DEPT</option>';
        if (isPmd) {
            deptHtml += '<option value="PMD">PMD</option>';
            deptHtml += '<option value="DNO">DNO</option>';
            deptHtml += '<option value="DSO">DSO</option>';
        } else {
            const depts = ['CRO', 'ERO', 'WRO'];
            depts.forEach(d => {
                deptHtml += `<option value="${d}">${d}</option>`;
            });
        }
        deptSelect.innerHTML = deptHtml;

        if (currentWeeklyScorecardDeptFilter !== 'all' && deptSelect.querySelector(`option[value="${currentWeeklyScorecardDeptFilter}"]`)) {
            deptSelect.value = currentWeeklyScorecardDeptFilter;
        } else {
            deptSelect.value = 'all';
            currentWeeklyScorecardDeptFilter = 'all';
        }

        updateWeeklyScorecardSubdeptOptions();
    }

    function updateWeeklyScorecardSubdeptOptions() {
        const deptSelect = document.getElementById('weekly-scorecard-dept-filter');
        const subdeptSelect = document.getElementById('weekly-scorecard-subdept-filter');
        if (!subdeptSelect) return;

        const selectedDept = deptSelect ? deptSelect.value : 'all';
        const isPmd = (currentWeeklyCategory === 'pmd');

        let html = '<option value="all">Semua Sub Dept</option>';

        if (isPmd) {
            html += '<option value="DNO">DNO</option>';
            html += '<option value="DSO">DSO</option>';
        } else {
            if (selectedDept === 'all') {
                const depts = ['CRO', 'ERO', 'WRO'];
                depts.forEach(d => {
                    const subs = DEPT_SUBDEPTS_MAP[d] || [];
                    if (subs.length > 0) {
                        html += `<optgroup label="${d}">`;
                        subs.forEach(s => {
                            html += `<option value="${s}">${s}</option>`;
                        });
                        html += `</optgroup>`;
                    }
                });
            } else if (DEPT_SUBDEPTS_MAP[selectedDept]) {
                const subs = DEPT_SUBDEPTS_MAP[selectedDept] || [];
                subs.forEach(s => {
                    html += `<option value="${s}">${s}</option>`;
                });
            }
        }

        subdeptSelect.innerHTML = html;
        if (currentWeeklyScorecardSubDeptFilter !== 'all' && subdeptSelect.querySelector(`option[value="${currentWeeklyScorecardSubDeptFilter}"]`)) {
            subdeptSelect.value = currentWeeklyScorecardSubDeptFilter;
        } else {
            subdeptSelect.value = 'all';
            currentWeeklyScorecardSubDeptFilter = 'all';
        }
    }

    function onWeeklyScorecardDeptFilterChange() {
        const deptSelect = document.getElementById('weekly-scorecard-dept-filter');
        currentWeeklyScorecardDeptFilter = deptSelect ? deptSelect.value : 'all';
        updateWeeklyScorecardSubdeptOptions();
        const subdeptSelect = document.getElementById('weekly-scorecard-subdept-filter');
        currentWeeklyScorecardSubDeptFilter = subdeptSelect ? subdeptSelect.value : 'all';

        applyWeeklyScorecardFiltersAndRender();
    }

    function onWeeklyScorecardSubDeptFilterChange() {
        const subdeptSelect = document.getElementById('weekly-scorecard-subdept-filter');
        currentWeeklyScorecardSubDeptFilter = subdeptSelect ? subdeptSelect.value : 'all';

        applyWeeklyScorecardFiltersAndRender();
    }

    function applyWeeklyScorecardFiltersAndRender() {
        if (!weeklySummaryData || !weeklySummaryData.scorecard) return;
        const sites = weeklySummaryData.scorecard.sites || [];
        const filtered = sites.filter(s => matchesScorecardFilter(s, currentWeeklyScorecardDeptFilter, currentWeeklyScorecardSubDeptFilter));

        const rCounts = {
            very_good: 0,
            good: 0,
            moderate: 0,
            poor: 0,
            very_poor: 0
        };
        const eCounts = {
            executed: 0,
            not_executed: 0
        };

        filtered.forEach(s => {
            const rCode = s.rating_code || 'very_poor';
            if (rCounts[rCode] !== undefined) rCounts[rCode]++;

            if (s.executed) {
                eCounts.executed++;
            } else {
                eCounts.not_executed++;
            }
        });

        renderWeeklyScorecardRatingPieChart(rCounts);
        renderWeeklyScorecardExecPieChart(eCounts);
        renderWeeklyScorecardRatingTable();
        renderWeeklyScorecardExecTable();
    }

    function renderWeeklyScorecardRatingPieChart(counts) {
        const canvas = document.getElementById('chart-weekly-scorecard-rating-pie');
        if (!canvas) return;

        if (weeklyScorecardRatingPieChart) {
            weeklyScorecardRatingPieChart.destroy();
            weeklyScorecardRatingPieChart = null;
        }

        const labels = ['Very Good', 'Good', 'Moderate', 'Poor', 'Very Poor'];
        const colors = ['#16a34a', '#0284c7', '#d97706', '#ea580c', '#dc2626'];
        const data = counts ? [
            counts.very_good || 0,
            counts.good || 0,
            counts.moderate || 0,
            counts.poor || 0,
            counts.very_poor || 0
        ] : [0, 0, 0, 0, 0];

        const total = data.reduce((a, b) => a + b, 0);

        const elVg = document.getElementById('weekly-sc-stat-vg');
        const elG = document.getElementById('weekly-sc-stat-g');
        const elM = document.getElementById('weekly-sc-stat-m');
        const elP = document.getElementById('weekly-sc-stat-p');
        const elVp = document.getElementById('weekly-sc-stat-vp');

        if (elVg) elVg.textContent = total > 0 ? `${data[0]} sites (${((data[0] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elG) elG.textContent = total > 0 ? `${data[1]} sites (${((data[1] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elM) elM.textContent = total > 0 ? `${data[2]} sites (${((data[2] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elP) elP.textContent = total > 0 ? `${data[3]} sites (${((data[3] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elVp) elVp.textContent = total > 0 ? `${data[4]} sites (${((data[4] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';

        const ctx = canvas.getContext('2d');
        if (total === 0) {
            weeklyScorecardRatingPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Belum Ada Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e2e8f0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    cutout: '60%'
                }
            });
            return;
        }

        weeklyScorecardRatingPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                cutout: '60%'
            }
        });
    }

    function renderWeeklyScorecardExecPieChart(counts) {
        const canvas = document.getElementById('chart-weekly-scorecard-exec-pie');
        if (!canvas) return;

        if (weeklyScorecardExecPieChart) {
            weeklyScorecardExecPieChart.destroy();
            weeklyScorecardExecPieChart = null;
        }

        const labels = ['Executed', 'Not Executed'];
        const colors = ['#16a34a', '#dc2626'];
        const data = counts ? [
            counts.executed || 0,
            counts.not_executed || 0
        ] : [0, 0];

        const total = data.reduce((a, b) => a + b, 0);

        const elExec = document.getElementById('weekly-sc-stat-exec');
        const elNotExec = document.getElementById('weekly-sc-stat-not-exec');

        if (elExec) elExec.textContent = total > 0 ? `${data[0]} sites (${((data[0] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';
        if (elNotExec) elNotExec.textContent = total > 0 ? `${data[1]} sites (${((data[1] / total) * 100).toFixed(2)}%)` : '0 sites (0.00%)';

        const ctx = canvas.getContext('2d');
        if (total === 0) {
            weeklyScorecardExecPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Belum Ada Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e2e8f0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    cutout: '60%'
                }
            });
            return;
        }

        weeklyScorecardExecPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                cutout: '60%'
            }
        });
    }

    function onWeeklyScorecardRatingFilterChange(val) {
        currentWeeklyRatingFilter = val;
        renderWeeklyScorecardRatingTable();
    }

    function toggleWeeklyScorecardRatingFilter(rating) {
        const select = document.getElementById('weekly-scorecard-rating-filter');
        if (currentWeeklyRatingFilter === rating) {
            currentWeeklyRatingFilter = 'all';
        } else {
            currentWeeklyRatingFilter = rating;
        }
        if (select) select.value = currentWeeklyRatingFilter;
        renderWeeklyScorecardRatingTable();
    }

    function renderWeeklyScorecardRatingTable() {
        const tbody = document.getElementById('weekly-scorecard-rating-tbody');
        if (!tbody || !weeklySummaryData || !weeklySummaryData.scorecard) return;

        const sites = weeklySummaryData.scorecard.sites || [];
        let filtered = sites.filter(s => matchesScorecardFilter(s, currentWeeklyScorecardDeptFilter, currentWeeklyScorecardSubDeptFilter));
        if (currentWeeklyRatingFilter && currentWeeklyRatingFilter !== 'all') {
            filtered = filtered.filter(s => s.rating_code === currentWeeklyRatingFilter);
        }

        // Highlight selected stat row
        document.querySelectorAll('#weekly-scorecard-rating-pie-stats .scorecard-pie-stat-row').forEach(row => {
            const r = row.getAttribute('data-rating');
            row.classList.toggle('active', r === currentWeeklyRatingFilter);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center" style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                        <div style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">Tidak Ada Data</div>
                        <div style="font-size: 11px;">Tidak ditemukan site dengan kriteria rating ini.</div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach((s, idx) => {
            const ratingBadge = renderRatingBadge(s.rating);
            html += `
                <tr>
                    <td class="scorecard-col-subdept" style="color: #475569;">${escapeHtml(s.sub_dept || s.dept || '-')}</td>
                    <td class="scorecard-col-sitecode">${escapeHtml(s.sitecode)}</td>
                    <td class="scorecard-col-namesite" style="font-weight: 600; color: #1e293b;">${escapeHtml(s.name_site || '-')}</td>
                    <td class="scorecard-col-month">${formatPercent(s.pct)}</td>
                    <td class="scorecard-col-status">${ratingBadge}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    function onWeeklyScorecardExecutionFilterChange(val) {
        currentWeeklyExecutionFilter = val;
        renderWeeklyScorecardExecTable();
    }

    function toggleWeeklyScorecardExecutionFilter(status) {
        const select = document.getElementById('weekly-scorecard-execution-filter');
        if (currentWeeklyExecutionFilter === status) {
            currentWeeklyExecutionFilter = 'all';
        } else {
            currentWeeklyExecutionFilter = status;
        }
        if (select) select.value = currentWeeklyExecutionFilter;
        renderWeeklyScorecardExecTable();
    }

    function renderWeeklyScorecardExecTable() {
        const tbody = document.getElementById('weekly-scorecard-exec-tbody');
        if (!tbody || !weeklySummaryData || !weeklySummaryData.scorecard) return;

        const sites = weeklySummaryData.scorecard.sites || [];
        let filtered = sites.filter(s => matchesScorecardFilter(s, currentWeeklyScorecardDeptFilter, currentWeeklyScorecardSubDeptFilter));
        if (currentWeeklyExecutionFilter && currentWeeklyExecutionFilter !== 'all') {
            if (currentWeeklyExecutionFilter === 'executed') {
                filtered = filtered.filter(s => s.executed);
            } else {
                filtered = filtered.filter(s => !s.executed);
            }
        }

        // Highlight selected stat row
        document.querySelectorAll('#weekly-scorecard-exec-pie-stats .scorecard-pie-stat-row').forEach(row => {
            const e = row.getAttribute('data-exec');
            row.classList.toggle('active', e === currentWeeklyExecutionFilter);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center" style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                        <div style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">Tidak Ada Data</div>
                        <div style="font-size: 11px;">Tidak ditemukan site dengan status eksekusi ini.</div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach((s, idx) => {
            const execBadge = renderExecutionBadge(s.execution_status);
            html += `
                <tr>
                    <td class="scorecard-col-subdept" style="color: #475569;">${escapeHtml(s.sub_dept || s.dept || '-')}</td>
                    <td class="scorecard-col-sitecode">${escapeHtml(s.sitecode)}</td>
                    <td class="scorecard-col-namesite" style="font-weight: 600; color: #1e293b;">${escapeHtml(s.name_site || '-')}</td>
                    <td class="scorecard-col-month">${formatPercent(s.pct)}</td>
                    <td class="scorecard-col-status">${execBadge}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    // Report SO Weekly Data Table
    function populateWeeklyDeptFilter(reportData) {
        const deptSelect = document.getElementById('weekly-report-so-dept-filter');
        const deptLabel = document.getElementById('label-weekly-dept-filter');
        const subdeptContainer = document.getElementById('weekly-subdept-filter-container');
        const subdeptSelect = document.getElementById('weekly-report-so-subdept-filter');

        if (!deptSelect) return;

        if (currentWeeklyCategory === 'pmd') {
            if (deptLabel) deptLabel.textContent = 'DEPT';
            if (subdeptContainer) subdeptContainer.style.display = 'none';
            if (subdeptSelect) subdeptSelect.value = 'all';

            deptSelect.innerHTML = `
                <option value="all" selected>Semua Dept</option>
                <option value="DNO">DNO</option>
                <option value="DSO">DSO</option>
            `;
        } else {
            // Outlet Regional
            if (deptLabel) deptLabel.textContent = 'DEPT';
            if (subdeptContainer) subdeptContainer.style.display = 'flex';

            deptSelect.innerHTML = `
                <option value="all" selected>Semua DEPT</option>
                <option value="CRO">CRO</option>
                <option value="ERO">ERO</option>
                <option value="WRO">WRO</option>
            `;

            updateWeeklySubdeptOptions('all');
        }
    }

    function updateWeeklySubdeptOptions(selectedDept) {
        const subdeptSelect = document.getElementById('weekly-report-so-subdept-filter');
        if (!subdeptSelect) return;

        const previousVal = subdeptSelect.value;
        let html = '<option value="all">Semua Sub Dept</option>';

        if (selectedDept === 'all') {
            const depts = ['CRO', 'ERO', 'WRO'];
            depts.forEach(d => {
                const subs = DEPT_SUBDEPTS_MAP[d] || [];
                html += `<optgroup label="${d}">`;
                subs.forEach(s => {
                    html += `<option value="${s}">${s}</option>`;
                });
                html += `</optgroup>`;
            });
        } else if (DEPT_SUBDEPTS_MAP[selectedDept]) {
            const subs = DEPT_SUBDEPTS_MAP[selectedDept] || [];
            subs.forEach(s => {
                html += `<option value="${s}">${s}</option>`;
            });
        }
        subdeptSelect.innerHTML = html;
        if (previousVal && subdeptSelect.querySelector(`option[value="${previousVal}"]`)) {
            subdeptSelect.value = previousVal;
        } else {
            subdeptSelect.value = 'all';
        }
    }

    function onWeeklyDeptFilterChange() {
        const deptSelect = document.getElementById('weekly-report-so-dept-filter');
        if (!deptSelect) return;

        if (currentWeeklyCategory !== 'pmd') {
            updateWeeklySubdeptOptions(deptSelect.value);
        }
        currentWeeklyReportPage = 1;
        applyWeeklyReportSoFilter();
    }

    function changeWeeklyReportPageSize(size) {
        weeklyReportPageSize = (size === 'all') ? 'all' : (parseInt(size, 10) || 10);
        currentWeeklyReportPage = 1;
        renderWeeklyReportTable();
    }

    function goToWeeklyReportPage(page) {
        const total = filteredWeeklyReportRows.length;
        const pageSize = (weeklyReportPageSize === 'all') ? total : parseInt(weeklyReportPageSize, 10);
        const totalPages = (pageSize > 0) ? Math.ceil(total / pageSize) : 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentWeeklyReportPage = page;
        renderWeeklyReportTable();
    }

    function toggleWeeklyReportSort(col) {
        if (weeklyReportSortColumn === col) {
            weeklyReportSortDirection = weeklyReportSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            weeklyReportSortColumn = col;
            weeklyReportSortDirection = 'asc';
        }

        document.querySelectorAll('#weekly-report-so-table .sort-indicator').forEach(ind => {
            ind.textContent = '⇅';
        });
        const activeInd = document.querySelector(`#weekly-report-so-table .sort-indicator[data-weekly-col="${col}"]`);
        if (activeInd) {
            activeInd.textContent = weeklyReportSortDirection === 'asc' ? '▲' : '▼';
        }

        applyWeeklyReportSoFilter();
    }

    // ── Weekly Report SO: Pie Chart & Filter Logic ──────────────────

    let weeklyReportPieChart = null;

    function toggleWeeklyReportStatusFilter(targetStatus) {
        const sel = document.getElementById('weekly-report-so-status-filter');
        if (!sel) return;
        const current = sel.value || 'all';
        const nextVal = (current === targetStatus) ? 'all' : targetStatus;
        sel.value = nextVal;
        currentWeeklyReportPage = 1;
        applyWeeklyReportSoFilter();
    }

    function renderWeeklyReportPieChart(tercapai, tidakTercapai, noData, total) {
        const canvas = document.getElementById('chart-weekly-report-pie');
        const statsContainer = document.getElementById('weekly-report-pie-stats');
        if (!canvas) return;

        if (weeklyReportPieChart) {
            weeklyReportPieChart.destroy();
            weeklyReportPieChart = null;
        }

        if (total === 0) {
            if (typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                weeklyReportPieChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Belum Ada Data'],
                        datasets: [{
                            data: [1],
                            backgroundColor: ['#e2e8f0'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false }
                        },
                        cutout: '68%'
                    }
                });
            }
            if (statsContainer) {
                statsContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 0.75rem 0.5rem;">Tidak ada data site</div>';
            }
            return;
        }

        const labels = ['Tercapai', 'Tidak Tercapai', 'Belum Ada Data'];
        const data = [tercapai, tidakTercapai, noData];
        const colors = ['#16a34a', '#dc2626', '#94a3b8'];

        if (typeof Chart !== 'undefined') {
            const ctx = canvas.getContext('2d');
            weeklyReportPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors,
                        borderColor: '#ffffff',
                        borderWidth: 2,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'],
                    onClick: (evt, elements) => {
                        if (elements && elements.length > 0) {
                            const idx = elements[0].index;
                            let target = 'all';
                            if (idx === 0) target = 'tercapai';
                            else if (idx === 1) target = 'tidak_tercapai';
                            else if (idx === 2) target = 'no_data';
                            toggleWeeklyReportStatusFilter(target);
                        }
                    },
                    onHover: (event, chartElement) => {
                        event.native.target.style.cursor = (chartElement && chartElement.length > 0) ? 'pointer' : 'default';
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            onClick: (e, legendItem) => {
                                const text = legendItem.text;
                                let target = 'all';
                                if (text === 'Tercapai') target = 'tercapai';
                                else if (text === 'Tidak Tercapai') target = 'tidak_tercapai';
                                else if (text === 'Belum Ada Data') target = 'no_data';
                                toggleWeeklyReportStatusFilter(target);
                            },
                            onHover: (e, legendItem, legend) => {
                                legend.chart.canvas.style.cursor = 'pointer';
                            },
                            labels: {
                                boxWidth: 12,
                                padding: 12,
                                font: {
                                    family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                                    size: 11,
                                    weight: '600'
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const val = context.raw || 0;
                                    const pct = total > 0 ? ((val / total) * 100).toFixed(2) : '0.00';
                                    return ` ${context.label}: ${val} sites (${pct}%)`;
                                }
                            }
                        }
                    },
                    cutout: '62%'
                }
            });
        }

        if (statsContainer) {
            const pctTercapai = total > 0 ? ((tercapai / total) * 100).toFixed(2) : '0.00';
            const pctTidak = total > 0 ? ((tidakTercapai / total) * 100).toFixed(2) : '0.00';
            const pctNoData = total > 0 ? ((noData / total) * 100).toFixed(2) : '0.00';
            const targetPctNum = weeklySummaryData?.achievements?.target_pct !== undefined
                ? Number(weeklySummaryData.achievements.target_pct)
                : (currentWeeklyCategory === 'pmd' ? 98.0 : 85.0);
            const thresholdLabel = `${Math.round(targetPctNum)}%`;
            const statusSel = document.getElementById('weekly-report-so-status-filter');
            const curStatus = statusSel ? statusSel.value : 'all';
            const activeTercapai = (curStatus === 'tercapai') ? ' active' : '';
            const activeTidak = (curStatus === 'tidak_tercapai') ? ' active' : '';
            const activeNoData = (curStatus === 'no_data') ? ' active' : '';
            const activeAll = (curStatus === 'all') ? ' active' : '';

            let statsHtml = `
                <div class="so-pie-stat-row${activeTercapai}" onclick="App.toggleWeeklyReportStatusFilter('tercapai')" style="cursor: pointer; padding: 4px 6px; border-radius: 6px;">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #16a34a;"></span>
                        Tercapai (≥${thresholdLabel})
                    </span>
                    <span class="so-pie-stat-val" style="color: #16a34a;">
                        ${tercapai} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTercapai}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row${activeTidak}" onclick="App.toggleWeeklyReportStatusFilter('tidak_tercapai')" style="cursor: pointer; padding: 4px 6px; border-radius: 6px;">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #dc2626;"></span>
                        Tidak Tercapai (<${thresholdLabel})
                    </span>
                    <span class="so-pie-stat-val" style="color: #dc2626;">
                        ${tidakTercapai} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTidak}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row${activeNoData}" onclick="App.toggleWeeklyReportStatusFilter('no_data')" style="cursor: pointer; padding: 4px 6px; border-radius: 6px;">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #94a3b8;"></span>
                        Belum Ada Data
                    </span>
                    <span class="so-pie-stat-val" style="color: #64748b;">
                        ${noData} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctNoData}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row${activeAll}" onclick="App.toggleWeeklyReportStatusFilter('all')" style="cursor: pointer; margin-top: 4px; padding: 6px 6px 3px; border-top: 1px dashed #e2e8f0; border-radius: 6px;">
                    <span class="so-pie-stat-label" style="font-weight: 600; color: #1e293b;">
                        Total Sites
                    </span>
                    <span class="so-pie-stat-val" style="font-weight: 700; color: #0f172a;">${total} sites</span>
                </div>
            `;

            statsContainer.innerHTML = statsHtml;
        }
    }

    function applyWeeklyReportSoFilter() {
        if (!weeklySummaryData) return;

        const reportData = weeklySummaryData.report_so || [];
        const deptFilter = document.getElementById('weekly-report-so-dept-filter')?.value || 'all';
        const subdeptFilter = document.getElementById('weekly-report-so-subdept-filter')?.value || 'all';
        const statusFilter = document.getElementById('weekly-report-so-status-filter')?.value || 'all';
        const searchInput = document.getElementById('weekly-report-so-search');
        const query = (searchInput?.value || '').toLowerCase().trim();

        const targetPct = weeklySummaryData?.achievements?.target_pct || (currentWeeklyCategory === 'pmd' ? 98.0 : 85.0);

        // Base rows filtered by Dept/Subdept & Search query (used for pie chart calculations)
        let baseRows = reportData.slice();

        if (currentWeeklyCategory === 'pmd') {
            if (deptFilter !== 'all') {
                baseRows = baseRows.filter(r => (r.sub_dept || '').toUpperCase() === deptFilter.toUpperCase());
            }
        } else {
            // Outlet Regional
            if (deptFilter !== 'all') {
                baseRows = baseRows.filter(r => (r.dept || '').toUpperCase() === deptFilter.toUpperCase());
            }
            if (subdeptFilter !== 'all') {
                baseRows = baseRows.filter(r => (r.sub_dept || '').toUpperCase() === subdeptFilter.toUpperCase());
            }
        }

        if (query) {
            baseRows = baseRows.filter(r => {
                const sc = (r.sitecode || '').toLowerCase();
                const ns = (r.name_site || '').toLowerCase();
                const dp = (r.dept || '').toLowerCase();
                const sd = (r.sub_dept || '').toLowerCase();
                return sc.includes(query) || ns.includes(query) || dp.includes(query) || sd.includes(query);
            });
        }

        // Count for Pie Chart: Tercapai vs Tidak Tercapai vs Belum Ada Data
        let countTercapai = 0;
        let countTidakTercapai = 0;
        let countNoData = 0;
        baseRows.forEach(r => {
            if (r.has_data && r.pct !== null && r.pct !== undefined) {
                const rounded = parseFloat(r.pct);
                if (rounded >= targetPct) {
                    countTercapai++;
                } else {
                    countTidakTercapai++;
                }
            } else {
                countNoData++;
            }
        });

        // Render Pie Chart
        renderWeeklyReportPieChart(countTercapai, countTidakTercapai, countNoData, baseRows.length);

        // Filter by Status for Table Display
        let filtered = baseRows.slice();
        if (statusFilter !== 'all') {
            if (statusFilter === 'tercapai') {
                filtered = filtered.filter(r => r.has_data && r.pct !== null && r.pct !== undefined && parseFloat(r.pct) >= targetPct);
            } else if (statusFilter === 'tidak_tercapai') {
                filtered = filtered.filter(r => r.has_data && r.pct !== null && r.pct !== undefined && parseFloat(r.pct) < targetPct);
            } else if (statusFilter === 'no_data') {
                filtered = filtered.filter(r => !r.has_data || r.pct === null || r.pct === undefined);
            }
        }

        // Sorting
        if (weeklyReportSortColumn) {
            const isNumeric = ['match_qty', 'physic_qty', 'db_qty', 'target_qty', 'pct', 'defisit'].includes(weeklyReportSortColumn);
            filtered.sort((a, b) => {
                if (weeklyReportSortColumn === 'defisit') {
                    const valA = (a.has_data && a.pct !== null && a.pct !== undefined) ? (100 - parseFloat(a.pct)) : 999999;
                    const valB = (b.has_data && b.pct !== null && b.pct !== undefined) ? (100 - parseFloat(b.pct)) : 999999;
                    return weeklyReportSortDirection === 'asc' ? valA - valB : valB - valA;
                }

                let valA = a[weeklyReportSortColumn];
                let valB = b[weeklyReportSortColumn];

                if (isNumeric) {
                    valA = (valA !== null && valA !== undefined) ? parseFloat(valA) : -999999;
                    valB = (valB !== null && valB !== undefined) ? parseFloat(valB) : -999999;
                    return weeklyReportSortDirection === 'asc' ? valA - valB : valB - valA;
                } else {
                    valA = (valA || '').toString();
                    valB = (valB || '').toString();
                    return weeklyReportSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                }
            });
        }

        filteredWeeklyReportRows = filtered;
        renderWeeklyReportTable();
    }

    function renderWeeklyReportTable() {
        const tbody = document.getElementById('weekly-report-so-tbody');
        const tfoot = document.getElementById('weekly-report-so-tfoot');
        const info = document.getElementById('weekly-report-so-table-info');
        const controls = document.getElementById('weekly-report-so-pagination-controls');

        if (!tbody) return;

        const total = filteredWeeklyReportRows.length;
        const targetPct = weeklySummaryData?.achievements?.target_pct || (currentWeeklyCategory === 'pmd' ? 98.0 : 85.0);
        const statusFilter = document.getElementById('weekly-report-so-status-filter')?.value || 'all';

        const pageSize = (weeklyReportPageSize === 'all') ? total : parseInt(weeklyReportPageSize, 10);
        const totalPages = (pageSize > 0) ? Math.ceil(total / pageSize) : 1;

        if (currentWeeklyReportPage < 1) currentWeeklyReportPage = 1;
        if (currentWeeklyReportPage > totalPages) currentWeeklyReportPage = totalPages;

        const startIndex = total > 0 ? (currentWeeklyReportPage - 1) * pageSize : 0;
        const endIndex = (weeklyReportPageSize === 'all') ? total : Math.min(startIndex + pageSize, total);
        const pageRows = (total > 0) ? ((weeklyReportPageSize === 'all') ? filteredWeeklyReportRows : filteredWeeklyReportRows.slice(startIndex, endIndex)) : [];

        // Update pagination info
        if (info) {
            const startDisplay = total > 0 ? (startIndex + 1) : 0;
            info.textContent = `Menampilkan ${startDisplay.toLocaleString('id-ID')} sampai ${endIndex.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} data`;
        }

        // Render pagination controls
        renderWeeklyPaginationControls(controls, currentWeeklyReportPage, totalPages, 'App.goToWeeklyReportPage');

        if (total === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 2.5rem; color: #64748b;">
                        Data Report Stock Opname Weekly tidak ditemukan.
                    </td>
                </tr>
            `;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        let html = '';
        pageRows.forEach(r => {
            const hasData = r.has_data && r.pct !== null && r.pct !== undefined;
            const roundedPct = hasData ? parseFloat(r.pct) : null;
            const isTercapai = hasData && (roundedPct >= targetPct);

            let statusBadge = '';
            if (hasData) {
                statusBadge = isTercapai
                    ? `<span class="badge badge-success" style="background: #dcfce7; color: #166534; font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 700;">Tercapai</span>`
                    : `<span class="badge badge-danger" style="background: #fee2e2; color: #991b1b; font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 700;">Tidak Tercapai</span>`;
            } else {
                statusBadge = `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 600;">Belum Ada Data</span>`;
            }

            const deptDisplay = currentWeeklyCategory === 'pmd'
                ? escapeHtml(r.sub_dept || r.dept || '-')
                : `${escapeHtml(r.dept || '-')}${r.sub_dept ? ' / ' + escapeHtml(r.sub_dept) : ''}`;

            const pctDisplay = hasData
                ? `<span style="font-weight: 700; color: ${isTercapai ? '#16a34a' : '#dc2626'};">${formatPercent(r.pct)}</span>`
                : `<span style="color: #94a3b8; font-weight: 500;">-</span>`;

            let defisitDisplay = `<span style="color: #94a3b8; font-weight: 500;">-</span>`;
            if (hasData) {
                const defisitVal = 100 - parseFloat(r.pct);
                const dColor = defisitVal > 0 ? '#dc2626' : '#16a34a';
                defisitDisplay = `<span style="font-weight: 700; color: ${dColor};">${defisitVal.toFixed(2)}%</span>`;
            }

            html += `
                <tr>
                    <td class="text-center font-mono" style="font-weight: 600; font-size: 12px; color: #1e293b;">
                        ${escapeHtml(r.sitecode)}
                    </td>
                    <td class="text-left col-name-site" style="font-weight: 500; color: #0f172a; max-width: 260px; white-space: normal; text-align: left;">
                        ${escapeHtml(r.name_site || '-')}
                    </td>
                    <td class="text-center" style="font-size: 12px; font-weight: 600; color: #475569;">
                        ${deptDisplay}
                    </td>
                    <td class="text-center">${hasData ? formatNumber(r.match_qty) : '-'}</td>
                    <td class="text-center">${hasData ? formatNumber(r.physic_qty) : '-'}</td>
                    <td class="text-center">${hasData ? formatNumber(r.db_qty) : '-'}</td>
                    <td class="text-center" style="font-weight: 600;">${hasData ? formatNumber(r.target_qty) : '-'}</td>
                    <td class="text-center">${pctDisplay}</td>
                    <td class="text-center">${defisitDisplay}</td>
                    <td class="text-center">${statusBadge}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Render Grand Total row across all filtered rows
        if (tfoot) {
            let sumMatch = 0, sumPhysic = 0, sumDb = 0, sumTarget = 0, sumPct = 0, countWithData = 0;
            filteredWeeklyReportRows.forEach(r => {
                if (r.has_data && r.pct !== null && r.pct !== undefined) {
                    sumMatch += (parseFloat(r.match_qty) || 0);
                    sumPhysic += (parseFloat(r.physic_qty) || 0);
                    sumDb += (parseFloat(r.db_qty) || 0);
                    sumTarget += (parseFloat(r.target_qty) || 0);
                    sumPct += (parseFloat(r.pct) || 0);
                    countWithData++;
                }
            });

            const avgPct = countWithData > 0 ? (sumPct / countWithData) : 0;
            const avgDefisit = countWithData > 0 ? (100 - avgPct) : 0;
            const avgDefisitDisplay = countWithData > 0 ? `<span style="font-weight: 700; color: ${avgDefisit > 0 ? '#dc2626' : '#16a34a'};">${avgDefisit.toFixed(2)}%</span>` : '-';
            const isOverallTercapai = avgPct >= targetPct;
            let filterNote = '';
            if (statusFilter === 'tercapai') filterNote = ' - Tercapai';
            else if (statusFilter === 'tidak_tercapai') filterNote = ' - Tidak Tercapai';
            else if (statusFilter === 'no_data') filterNote = ' - Belum Ada Data';

            tfoot.innerHTML = `
                <tr class="table-summary-row" style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1;">
                    <td colspan="3" style="color: #0f172a; padding: 0.75rem 1rem; text-align: left;">
                        Grand Total (${total} Sites${filterNote})
                    </td>
                    <td class="text-center" style="color: #0f172a; padding: 0.75rem 0.5rem;">${formatNumber(sumMatch)}</td>
                    <td class="text-center" style="color: #0f172a; padding: 0.75rem 0.5rem;">${formatNumber(sumPhysic)}</td>
                    <td class="text-center" style="color: #0f172a; padding: 0.75rem 0.5rem;">${formatNumber(sumDb)}</td>
                    <td class="text-center" style="color: #0f172a; padding: 0.75rem 0.5rem;">${formatNumber(sumTarget)}</td>
                    <td class="text-center" style="font-weight: 700; color: ${countWithData > 0 ? (isOverallTercapai ? '#16a34a' : '#dc2626') : '#64748b'}; padding: 0.75rem 0.5rem;">
                        ${countWithData > 0 ? formatPercent(avgPct) : '-'}
                    </td>
                    <td class="text-center" style="padding: 0.75rem 0.5rem;">
                        ${avgDefisitDisplay}
                    </td>
                    <td class="text-center" style="padding: 0.75rem 0.5rem;">
                        ${countWithData > 0 ? `
                        <span class="badge ${isOverallTercapai ? 'badge-success' : 'badge-danger'}"
                            style="background: ${isOverallTercapai ? '#dcfce7' : '#fee2e2'}; color: ${isOverallTercapai ? '#166534' : '#991b1b'}; font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 700;">
                            ${isOverallTercapai ? 'Tercapai' : 'Tidak Tercapai'}
                        </span>
                        ` : `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 600;">-</span>`}
                    </td>
                </tr>
            `;
        }
    }

    function renderWeeklyPaginationControls(container, currentPage, totalPages, clickHandler) {
        if (!container) return;
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${clickHandler}(${currentPage - 1})">&laquo; Prev</button>`;

        const maxButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        if (startPage > 1) {
            html += `<button class="pagination-btn" onclick="${clickHandler}(1)">1</button>`;
            if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
        }

        for (let p = startPage; p <= endPage; p++) {
            html += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="${clickHandler}(${p})">${p}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
            html += `<button class="pagination-btn" onclick="${clickHandler}(${totalPages})">${totalPages}</button>`;
        }

        html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${clickHandler}(${currentPage + 1})">Next &raquo;</button>`;
        container.innerHTML = html;
    }

    async function generateExecutiveSummaryPng(cardId = 'card-executive-summary') {
        let cardEl = document.getElementById(cardId);
        if (!cardEl) {
            cardEl = document.getElementById('card-executive-summary') ||
                     document.getElementById('all-card-executive-summary') ||
                     document.getElementById('weekly-card-executive-summary');
        }
        if (!cardEl) {
            if (typeof showToast === 'function') {
                showToast('error', 'Error', 'Elemen Executive Summary tidak ditemukan.');
            }
            return;
        }

        const btn = cardEl.querySelector('.btn-generate-png') ||
                    document.getElementById('btn-generate-executive-summary') ||
                    document.getElementById('btn-generate-all-executive-summary') ||
                    document.getElementById('btn-generate-all-executive-summary-page') ||
                    document.getElementById('btn-generate-weekly-executive-summary');

        let originalBtnHtml = '';
        if (btn) {
            originalBtnHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `
                <span class="spinner-border spinner-border-sm" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;"></span>
                <span>Generating...</span>
            `;
        }

        try {
            if (typeof html2canvas === 'undefined') {
                throw new Error('Library html2canvas belum dimuat.');
            }

            const html2canvasOpts = {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                ignoreElements: (el) => {
                    return el.classList.contains('btn-generate-png') ||
                           el.id === 'btn-generate-executive-summary' ||
                           el.id === 'btn-generate-all-executive-summary' ||
                           el.id === 'btn-generate-all-executive-summary-page' ||
                           el.id === 'btn-generate-weekly-executive-summary' ||
                           el.getAttribute('data-html2canvas-ignore') === 'true';
                }
            };

            // 1. Capture the main Executive Summary card
            const canvas1 = await html2canvas(cardEl, html2canvasOpts);

            // 2. Identify and capture the associated trend chart
            // For All Summary: "Grafik Achievement SO" (#card-trend-div-wh-wrapper or #all-card-trend-div-wh-wrapper)
            // For Executive Summary: Trend Charts Container (#trend-charts-container or .trend-charts-container)
            const isAllSummary = (cardId && cardId.includes('all')) ||
                                 (cardEl && cardEl.id && cardEl.id.includes('all')) ||
                                 (window.location.pathname.includes('all-summary')) ||
                                 (document.getElementById('section-all-summary') && window.getComputedStyle(document.getElementById('section-all-summary')).display !== 'none');

            let trendEl = null;
            if (isAllSummary) {
                trendEl = document.getElementById('all-card-trend-div-wh-wrapper') ||
                          document.getElementById('card-trend-div-wh-wrapper');
            } else if (!cardId.includes('weekly')) {
                trendEl = document.getElementById('trend-charts-container') ||
                          cardEl.parentElement?.querySelector('.trend-charts-container') ||
                          document.querySelector('.trend-charts-container');
            }

            let finalCanvas = canvas1;

            const isElementVisible = (el) => {
                if (!el) return false;
                try {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
                } catch (e) {
                    return el.offsetParent !== null;
                }
            };

            if (trendEl && isElementVisible(trendEl)) {
                const canvas2 = await html2canvas(trendEl, html2canvasOpts);

                const scale = html2canvasOpts.scale || 2;
                const gap = 24 * scale; // Clean 24px gap between cards
                const combinedWidth = Math.max(canvas1.width, canvas2.width);
                const combinedHeight = canvas1.height + gap + canvas2.height;

                const combinedCanvas = document.createElement('canvas');
                combinedCanvas.width = combinedWidth;
                combinedCanvas.height = combinedHeight;
                const ctx = combinedCanvas.getContext('2d');

                // Clean enterprise white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, combinedWidth, combinedHeight);

                // Draw Card 1: Executive Summary
                const x1 = Math.round((combinedWidth - canvas1.width) / 2);
                ctx.drawImage(canvas1, x1, 0);

                // Draw Card 2: Trend Chart / Grafik Achievement SO
                const x2 = Math.round((combinedWidth - canvas2.width) / 2);
                ctx.drawImage(canvas2, x2, canvas1.height + gap);

                finalCanvas = combinedCanvas;
            }

            // Format clean filename based on current period badge
            const badgeEl = cardEl.querySelector('#executive-period-badge') ||
                            cardEl.querySelector('#all-executive-period-badge') ||
                            cardEl.querySelector('#weekly-executive-period-badge') ||
                            cardEl.querySelector('.badge');
            let periodName = badgeEl ? badgeEl.textContent.trim().replace(/[^a-zA-Z0-9_\-]+/g, '_') : '';
            if (!periodName) {
                const now = new Date();
                periodName = `${now.getFullYear()}_${now.getMonth() + 1}`;
            }

            let cardPrefix = 'Executive_Summary';
            if (isAllSummary || cardId.includes('all')) cardPrefix = 'Executive_Summary_All';
            if (cardId.includes('weekly')) cardPrefix = 'Executive_Summary_Weekly';

            const filename = `${cardPrefix}_${periodName}.png`;

            // Download as PNG
            const dataUrl = finalCanvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = dataUrl;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            if (typeof showToast === 'function') {
                showToast('success', 'Berhasil', `Capture ${filename} berhasil diunduh.`);
            }
        } catch (err) {
            console.error('Error generating executive summary PNG:', err);
            if (typeof showToast === 'function') {
                showToast('error', 'Gagal', 'Terjadi kesalahan saat membuat capture PNG: ' + (err.message || 'Error'));
            } else {
                alert('Gagal membuat capture PNG: ' + (err.message || 'Error'));
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
        }
    }

    // ── Public Interface ───────────────────────────────────────

    function onTrendSubDeptFilterChange(val) {
        currentTrendSubDeptFilter = val;
        if (lastTrendJsonData) {
            applyTrendJsonData(lastTrendJsonData);
        } else {
            renderTrendCharts();
        }
    }

    function onTrendPmdSiteFilterChange(val) {
        currentTrendPmdSiteFilter = val;
        if (lastTrendJsonData) {
            applyTrendJsonData(lastTrendJsonData);
        } else {
            renderTrendCharts();
        }
    }

    return {
        init,
        onTrendSubDeptFilterChange,
        onTrendPmdSiteFilterChange,
        generateExecutiveSummaryPng,
        toggleDbBreakdownPanel,
        navigateTo,
        loadMasterData,
        loadSummaryData,
        changePageSize,
        goToPage,
        handleSearch,
        applyFilterAndRender,
        deleteRecord,
        clearAllData,
        toggleSort,
        openBulkDeleteModal,
        closeBulkDeleteModal,
        submitBulkDelete,
        openImportModal,
        closeImportModal,
        handleFileSelect,
        clearSelectedFile,
        submitImport,
        // Site Regional exports
        loadSiteRegional,
        switchSRLevel1,
        switchSRLevel2,
        changeSRPageSize,
        goToSRPage,
        handleSRSearch,
        toggleSRSort,
        onSRRegionalFilterChange,
        onSRDeptFilterChange,
        onSRSubDeptFilterChange,
        onSRInfoFilterChange,
        onSRGroupTypeFilterChange,
        onSRStatusFilterChange,
        deleteSRRecord,
        toggleSRSelection,
        toggleSelectAllSR,
        bulkDeleteSiteRegional,
        updateSRInfo,
        updateSRGroupType,
        toggleSRActive,
        toggleSRCounted,
        toggleSRCountedWeekly,
        syncSiteProfile,
        syncAllSiteProfiles,
        openSRHistoryModal,
        closeSRHistoryModal,
        loadSRHistory,
        addSRHistoryRule,
        deleteSRHistoryRule,
        openSiteRegionalImportModal,
        closeSiteRegionalImportModal,
        handleSRFileSelect,
        clearSRSelectedFile,
        submitSRImport,
        // Rekapitulasi exports
        loadRekapitulasi,
        exportRekapitulasiExcel,
        onRekapDeptFilterChange,
        onRekapSubDeptFilterChange,
        loadTrendCharts,
        loadSubDeptResults,
        onDeptResultFilterChange,
        switchSOType,
        switchSummaryCategory,
        switchRekapLevel1,
        switchRekapLevel2,
        changeRekapPageSize,
        goToRekapPage,
        handleRekapSearch,
        toggleRekapSort,
        // Site Movements exports
        loadSiteMovements,
        renderMovementsTable,
        filterMovementsTable,
        toggleMovementDetails,
        viewAllYearMovements,
        openMovementsFromSR,
        // Score Card Summary exports
        loadScoreCardSummary,
        updateScoreCardPeriod,
        onNationalRatingFilterChange,
        onScorecardRatingFilterChange,
        toggleScorecardRatingFilter,
        onScorecardExecutionFilterChange,
        toggleScorecardExecutionFilter,
        toggleSubDeptStatusFilter,
        renderNationalScoreCardRating,
        renderScoreCardRating,
        renderScoreCardExecution,
        renderScoreCardRatingPieChart,
        renderScoreCardExecPieChart,
        onScorecardDeptFilterChange,
        onScorecardSubDeptFilterChange,
        // Score Card KPI Master Data exports
        loadScorecardKpi,
        renderScorecardKpiTable,
        toggleEditScorecardKpi,
        onKpiInputChange,
        saveScorecardKpi,
        resetScorecardKpi,
        renderScorecardExecKpiTable,
        toggleEditScorecardExecKpi,
        onKpiExecInputChange,
        saveScorecardExecKpi,
        resetScorecardExecKpi,
        // DB Analysis exports
        setDbAnalysisDept,
        renderResultDbChart,
        onResultDbChartFilterChange,
        // Catatan Executive Summary exports
        loadExecutiveNotes,
        loadMasterCatatan,
        openAddExecutiveNoteModal,
        closeExecutiveNoteModal,
        addExecutiveNoteRow,
        removeExecutiveNoteRow,
        onDeptChangeInNoteRow,
        editExecutiveNote,
        deleteExecutiveNote,
        submitExecutiveNote,
        // Rekap DB Master Data exports
        loadRekapDbData,
        changeRekapDbPageSize,
        applyRekapDbFilter,
        handleRekapDbSearch,
        toggleRekapDbSort,
        goToRekapDbPage,
        openRekapDbImportModal,
        closeRekapDbImportModal,
        handleRekapDbFileSelect,
        clearRekapDbSelectedFile,
        submitRekapDbImport,
        openRekapDbBulkDeleteModal,
        closeRekapDbBulkDeleteModal,
        submitRekapDbBulkDelete,
        deleteRekapDbItem,
        // Rekapitulasi Status Penyelesaian DB exports
        loadRekapDbStatusData,
        switchRekapDbStatusView,
        toggleRekapDbSiteAccordion,
        toggleAllRekapDbStatusSites,
        filterRekapDbStatus,
        onRekapDbStatusPeriodChange,
        onRekapDbStatusDeptChange,
        onRekapDbStatusSubDeptChange,
        onRekapDbStatusFilterChange,
        changeRekapDbStatusPageSize,
        goToRekapDbStatusPage,
        handleRekapDbStatusSearch,
        exportRekapDbStatusExcel,
        onRekapDbStatusSitecodeChange,
        toggleRekapDbStatusSort,
        toggleSubdeptResultsSort,
        toggleMasterCatatanSort,
        toggleExecCatatanSort,
        renderResultDbChart,
        onResultDbChartFilterChange,
        renderDbResolutionGauge,
        // PIC Sites Master Data exports
        loadPicSites,
        renderPicSitesTable,
        updatePicSitesPagination,
        goToPicSitesPage,
        changePicSitesPageSize,
        handlePicSitesSearch,
        onPicSitesDeptFilterChange,
        onPicSitesSubDeptFilterChange,
        togglePicSitesSort,
        exportPicSitesExcel,
        openAddPicSiteModal,
        openEditPicSiteModal,
        closePicSiteModal,
        onPicSitecodeSelected,
        submitPicSiteForm,
        deletePicSite,
        openPicSitesImportModal,
        closePicSitesImportModal,
        handlePicSitesFileSelect,
        clearPicSitesSelectedFile,
        submitPicSitesImport,
        // Circular Sign PIC Master Data exports
        loadCircularPics,
        renderCircularPicsTable,
        updateCircularPicsPagination,
        goToCircularPicsPage,
        changeCircularPicsPageSize,
        handleCircularPicsSearch,
        onCircularPicsDeptFilterChange,
        onCircularPicsSubDeptFilterChange,
        onCircularPicsStatusFilterChange,
        toggleCircularPicActive,
        toggleCircularPicsSort,
        exportCircularPicsExcel,
        downloadCircularPicsTemplate,
        openAddCircularPicModal,
        openEditCircularPicModal,
        closeCircularPicModal,
        submitCircularPicForm,
        deleteCircularPic,
        openCircularPicsImportModal,
        closeCircularPicsImportModal,
        handleCircularPicsFileSelect,
        clearCircularPicsSelectedFile,
        submitCircularPicsImport,
        // Template Reports exports
        loadTemplateReports,
        renderTemplateReportsTable,
        updateTemplateReportsPagination,
        goToTemplateReportsPage,
        changeTemplateReportsPageSize,
        handleTemplateReportsSearch,
        onTemplateReportsFilterTypeChange,
        toggleTemplateReportsSort,
        openTemplateReportUploadModal,
        closeTemplateReportUploadModal,
        handleTemplateReportFileSelect,
        clearTemplateReportSelectedFile,
        submitTemplateReportUpload,
        openTemplateReportEditModal,
        closeTemplateReportEditModal,
        submitTemplateReportEdit,
        deleteTemplateReport,
        // Reports Page exports
        getUserReportsDepts,
        switchReportsSOType,
        updateReportsMonthDropdown,
        loadReportsData,
        renderReportsTable,
        renderReportsPagination,
        goToReportsPage,
        generateReportForSite,
        sendReportWhatsApp,
        previewReport,
        closeReportPreviewModal,
        printReportIframe,
        sendCurrentPreviewWhatsApp,
        onReportsPeriodChange,
        onReportsDeptChange,
        onReportsSubDeptChange,
        onReportsStatusFilterChange,
        changeReportsPageSize,
        handleReportsSearch,
        downloadReportsSummaryExcel,
        closeReportKeteranganModal,
        onReportKeteranganInput,
        submitReportKeteranganAndGenerate,
        // Reports: Verification Card exports
        reportsVerifState,
        loadReportsVerificationData,
        renderReportsVerificationTable,
        renderReportsVerifPagination,
        goToReportsVerifPage,
        onReportsVerifDeptChange,
        onReportsVerifSubDeptChange,
        onReportsVerifStatusFilterChange,
        changeReportsVerifPageSize,
        handleReportsVerifSearch,
        openUploadSignedModal,
        closeUploadSignedModal,
        onSignedFileSelected,
        clearSignedFileSelected,
        submitUploadSignedReport,
        verifyReport,
        rejectReport,
        resetReportForSite,
        // Berita Acara Page exports
        baState,
        initBeritaAcaraPage,
        switchBaSOType,
        updateBaMonthDropdown,
        loadBeritaAcaraData,
        renderBeritaAcaraTable,
        renderBaPagination,
        goToBaPage,
        onBaPeriodChange,
        onBaDeptChange,
        onBaSubDeptChange,
        onBaStatusFilterChange,
        changeBaPageSize,
        handleBaSearch,
        // Chat Room PIC Sites exports
        openChatRoomModal,
        closeChatRoomModal,
        onChatRoomDeptChange,
        onChatRoomSubDeptChange,
        onChatRoomSitecodeChange,
        submitChatRoomMessage,
        // Quick Access & User Dropdown exports
        toggleQuickAccess,
        openQuickAccess,
        closeQuickAccess,
        scrollToCard,
        openLoginModal,
        closeLoginModal,
        toggleLoginPassword,
        toggleLoginModalPassword,
        submitLogin,
        logout,
        updateCsrfToken,
        refreshCsrfToken,
        toggleUserDropdown,
        closeUserDropdown,
        navigateTo,
        keepCleanUrl,
        applyUacPermissions,
        // User Management exports
        loadUsers,
        renderUsersTable,
        handleUserSearch,
        openAddUserModal,
        openEditUserModal,
        closeUserModal,
        submitUserForm,
        openDeleteUserModal,
        closeUserDeleteModal,
        confirmDeleteUser,
        onUserUacReportsChange,
        toggleAllUserUacDepts,
        // Master Data SO Profile Weekly exports
        loadMasterDataWeekly,
        applyFilterWeeklyAndRender,
        renderMasterTableWeekly,
        changePageSizeWeekly,
        goToPageWeekly,
        handleSearchWeekly,
        toggleSortWeekly,
        openImportModalWeekly,
        closeImportModalWeekly,
        handleFileSelectWeekly,
        clearSelectedFileWeekly,
        submitImportWeekly,
        openBulkDeleteModalWeekly,
        closeBulkDeleteModalWeekly,
        submitBulkDeleteWeekly,
        // Weekly Summary exports
        switchWeeklyCategory,
        loadWeeklySummary,
        onWeeklyMonthChange,
        onWeeklyYearChange,
        renderWeeklyAchievements,
        renderWeeklyScorecard,
        onWeeklyScorecardRatingFilterChange,
        toggleWeeklyScorecardRatingFilter,
        onWeeklyScorecardExecutionFilterChange,
        toggleWeeklyScorecardExecutionFilter,
        onWeeklyScorecardDeptFilterChange,
        onWeeklyScorecardSubDeptFilterChange,
        applyWeeklyReportSoFilter,
        renderWeeklyReportTable,
        changeWeeklyReportPageSize,
        goToWeeklyReportPage,
        onWeeklyDeptFilterChange,
        toggleWeeklyReportSort,
        toggleWeeklyReportStatusFilter,
        renderWeeklyReportPieChart,
    };
})();

window.generateExecutiveSummaryPng = App.generateExecutiveSummaryPng;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
} else {
    App.init();
}
