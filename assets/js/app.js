/**
 * Asset Management - Core Application JS
 * Stock Opname Master Data with Pagination, Column Filters & Delete
 */

const App = (() => {
    let allMasterRows = [];
    let filteredMasterRows = [];
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

    // Trend Charts state
    let chartTrendDept = null;
    let chartTrendSubDept = null;
    let chartTrendPmd = null;

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

        // Clean legacy localStorage to prevent stale storage hijacking default landing page
        try {
            localStorage.removeItem('active_page');
        } catch (e) { }

        // Restore active page: default remains now condition page ('master-data')
        const rawHash = (window.location.hash || '').replace('#', '').trim();
        const hashPage = rawHash.split('?')[0].split('/')[0];
        const sessionPage = sessionStorage.getItem('active_page');
        const isReload = Boolean(
            (window.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0]?.type === 'reload')
            || (window.performance && performance.navigation && performance.navigation.type === 1)
        );

        let initialPage = 'summary';

        if (window.AUTH_USER) {
            // When admin session: strictly Master Data page only
            initialPage = 'master-data';
        } else {
            // When guest session: strictly Summary page only
            initialPage = 'summary';
        }

        // Restore active SO Type & Category from sessionStorage (or URL query params in hash)
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
            if (savedCategory === 'pmd' || savedCategory === 'outlet') {
                summaryCategory = savedCategory;
            } else {
                summaryCategory = 'pmd';
            }
        } else {
            // Default condition: monthly PMD
            summarySOType = 'monthly';
            summaryCategory = 'pmd';
        }

        // Parse optional query params in hash if provided (e.g. #summary?so_type=quarterly&cat=warehouse_hub)
        if (rawHash.includes('?')) {
            const queryStr = rawHash.split('?')[1];
            const params = new URLSearchParams(queryStr);
            const qType = params.get('type') || params.get('so_type');
            const qCat = params.get('cat') || params.get('category');
            if (qType === 'quarterly' || qType === 'monthly') summarySOType = qType;
            if (qCat) summaryCategory = qCat;
        }

        navigateTo(initialPage, true);

        // Listen for popstate / hashchange when user uses browser Back/Forward
        window.addEventListener('hashchange', () => {
            const raw = (window.location.hash || '').replace('#', '').trim();
            const currentHash = raw.split('?')[0].split('/')[0];
            if (window.AUTH_USER) {
                navigateTo('master-data', false);
            } else {
                if (currentHash === 'master-data') {
                    window.location.href = 'login.php?redirect=master-data';
                } else {
                    navigateTo('summary', false);
                }
            }
        });
    }

    // ── Navigation (Master Data vs Summary) ─────────────────────

    function navigateTo(page, updateHash = true) {
        if (window.AUTH_USER) {
            // Logged-in admin only has Master Data page
            page = 'master-data';
        } else {
            // Guest only has Summary page; Master Data redirects to login
            if (page === 'master-data') {
                window.location.href = 'login.php?redirect=master-data';
                return;
            }
            page = 'summary';
        }

        // Persist page in sessionStorage for tab session / reload
        try {
            sessionStorage.setItem('active_page', page);
        } catch (e) {
            // Ignore storage quota or security errors
        }

        // Update URL hash
        if (updateHash && window.location.hash !== `#${page}`) {
            history.replaceState(null, '', `#${page}`);
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            const linkPage = link.getAttribute('data-page');
            link.classList.toggle('active', linkPage === page);
        });

        document.querySelectorAll('.page-section').forEach(sec => {
            sec.classList.remove('active');
        });

        const activeSec = document.getElementById(`page-${page}`);
        if (activeSec) {
            activeSec.classList.add('active');
        }

        if (page === 'master-data') {
            loadMasterData();
            loadSiteRegional();
            loadScorecardKpi();
            loadMasterCatatan();
        } else if (page === 'summary') {
            switchSOType(summarySOType || 'monthly', summaryCategory || 'pmd');
        }
    }

    // ── Quick Access Sidebar & Smooth Scroll Navigation ────────
    const QUICK_ACCESS_ITEMS = [
        { id: 'card-executive-summary', title: 'Executive Summary' },
        { id: 'card-executive-catatan', title: 'Catatan Dan Evaluasi' },
        { id: 'card-scorecard-summary', title: 'Score Card Summary' },
        { id: 'card-trend-dept-wrapper', title: 'Trend Chart' },
        { id: 'card-hasil-so-subdept', title: 'Report SO' },
        { id: 'card-rekapitulasi', title: 'Rekapitulasi' },
        { id: 'card-site-movements', title: 'History & Log' }
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
        renderQuickAccessList();
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

    function renderQuickAccessList() {
        const container = document.getElementById('quick-access-nav-list');
        if (!container) return;

        let html = '';
        QUICK_ACCESS_ITEMS.forEach(item => {
            html += `
                <a class="quick-access-item" href="#${item.id}" onclick="event.preventDefault(); App.scrollToCard('${item.id}');">
                    <span>${escapeHtml(item.title)}</span>
                </a>
            `;
        });
        container.innerHTML = html;
    }

    function scrollToCard(cardId) {
        closeQuickAccess();

        // Ensure we are on summary page where these cards reside
        const currentPage = document.getElementById('page-summary')?.classList.contains('active')
            ? 'summary'
            : 'master-data';
        if (currentPage !== 'summary') {
            navigateTo('summary');
        }

        setTimeout(() => {
            const el = document.getElementById(cardId);
            if (!el) return;

            // Scroll with offset for sticky navbar (height: 56px + margin)
            const yOffset = -72;
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }, 120);
    }

    function handleQuickAccessLogin(e) {
        if (e) e.preventDefault();
        window.location.href = 'login.php';
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
                <td colspan="22" class="text-center" style="padding: 2.5rem; color: #64748b;">
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
                        <td colspan="22" class="text-center" style="padding: 2rem; color: #dc2626;">
                            ${json.message || 'Error loading records from database'}
                        </td>
                    </tr>
                `;
                return;
            }

            allMasterRows = json.data || [];
            applyFilterAndRender();
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="22" class="text-center" style="padding: 2rem; color: #dc2626;">
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
        renderMasterTable();
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
                    <td colspan="22" class="text-center" style="padding: 2.5rem; color: #64748b;">
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
                    <td class="text-center col-action">
                        <button class="btn btn-danger btn-sm btn-delete" onclick="App.deleteRecord(${row.id})" title="Hapus data ini">
                            Hapus
                        </button>
                    </td>
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
            infoEl.textContent = `Menampilkan ${(startIndex + 1).toLocaleString()} sampai ${endIndex.toLocaleString()} dari ${totalItems.toLocaleString()} data`;
        }

        // Generate pagination buttons
        if (controlsEl) {
            let btnsHtml = '';

            // First & Prev buttons
            btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>« Awal</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ Sebelumnya</button>`;

            // Window of page numbers
            const maxButtons = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }

            for (let p = startPage; p <= endPage; p++) {
                btnsHtml += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="App.goToPage(${p})">${p}</button>`;
            }

            // Next & Last buttons
            btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Berikutnya ›</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>Akhir »</button>`;

            controlsEl.innerHTML = btnsHtml;
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
                <td colspan="9" class="text-center" style="padding: 2.5rem; color: #64748b;">
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
                        <td colspan="9" class="text-center" style="padding: 2rem; color: #dc2626;">
                            ${escapeHtml(json.message || 'Error loading records')}
                        </td>
                    </tr>
                `;
                return;
            }

            allSRRows = json.data || [];
            applySRFilterAndRender();
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center" style="padding: 2rem; color: #dc2626;">
                        Network error: ${escapeHtml(err.message || 'Unknown error')}
                    </td>
                </tr>
            `;
        }
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
                    <td colspan="11" class="text-center" style="padding: 2.5rem; color: #64748b;">
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
            const isActive = row.is_active !== false && row.is_active !== 0 && row.is_active !== '0';
            const isCounted = row.is_counted !== false && row.is_counted !== 0 && row.is_counted !== '0';
            html += `
                <tr class="${isChecked ? 'row-selected' : ''}">
                    <td class="text-center col-action-select">
                        <input type="checkbox" class="sr-row-checkbox" value="${row.id}" ${isChecked ? 'checked' : ''}
                            onchange="App.toggleSRSelection(${row.id}, this.checked)" title="Pilih baris">
                    </td>
                    <td class="text-center col-action-delete">
                        <button class="btn btn-danger btn-sm btn-delete" onclick="App.deleteSRRecord(${row.id})" title="Hapus data ini">
                            Hapus
                        </button>
                    </td>
                    <td class="text-center col-action-active" style="padding: 4px;">
                        <input type="checkbox" class="sr-active-checkbox" ${isActive ? 'checked' : ''}
                            onchange="App.toggleSRActive(${row.id}, this.checked, this)"
                            title="${isActive ? 'Aktif' : 'Nonaktif'}"
                            style="cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb;">
                    </td>
                    <td class="text-center col-action-counted" style="padding: 4px;">
                        <input type="checkbox" class="sr-counted-checkbox" id="sr-counted-${row.id}"
                            ${isActive && isCounted ? 'checked' : ''}
                            ${!isActive ? 'disabled' : ''}
                            onchange="App.toggleSRCounted(${row.id}, this.checked, this)"
                            title="${!isActive ? 'Site harus aktif terlebih dahulu' : (isCounted ? 'Dihitung dalam Ringkasan & Grafik' : 'Tidak Dihitung dalam Ringkasan & Grafik')}"
                            style="cursor: ${!isActive ? 'not-allowed' : 'pointer'}; width: 16px; height: 16px; accent-color: #16a34a; opacity: ${!isActive ? '0.45' : '1'};">
                    </td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.regional || '')}</td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.dept || '')}</td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.sub_dept || '')}</td>
                    <td class="text-center" style="white-space: nowrap;">
                        ${escapeHtml(row.sitecode || '')}
                    </td>
                    <td class="text-left" style="min-width: 180px;">${escapeHtml(row.name_site || '')}</td>
                    <td class="text-center" style="white-space: nowrap;">
                        <select class="form-control form-control-sm sr-table-select"
                            onchange="App.updateSRInfo(${row.id}, this.value, this)"
                            style="min-width: 125px;">
                            <option value="Outlet" ${currentInfo === 'Outlet' ? 'selected' : ''}>Outlet</option>
                            <option value="Subarep" ${currentInfo === 'Subarep' ? 'selected' : ''}>Subarep</option>
                            <option value="HUB" ${currentInfo === 'HUB' ? 'selected' : ''}>HUB</option>
                            <option value="Under Warehouse" ${currentInfo === 'Under Warehouse' ? 'selected' : ''}>Under Warehouse</option>
                        </select>
                    </td>
                    <td class="text-center" style="white-space: nowrap;">
                        <div style="display: inline-flex; align-items: center; gap: 6px;">
                            <span title="Tipe grup terbaru dari aturan edit (${histCount} aturan aktif)"
                                style="min-width: 82px; display: inline-block; padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 6px; text-align: center; color: ${currentGt === 'quarterly' ? '#0284c7' : '#16a34a'}; background: ${currentGt === 'quarterly' ? '#e0f2fe' : '#dcfce7'}; border: 1px solid ${currentGt === 'quarterly' ? '#bae6fd' : '#bbf7d0'}; line-height: 16px;">
                                ${currentGt === 'quarterly' ? 'Quarterly' : 'Monthly'}
                            </span>
                            <button class="btn btn-outline-secondary btn-sm"
                                onclick="App.openSRHistoryModal('${escapeHtml(row.sitecode || '')}', '${escapeHtml(row.name_site || '')}')"
                                title="Atur Aturan Periode Dinamis (${histCount} aturan aktif)"
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
            infoEl.textContent = `Menampilkan ${(startIndex + 1).toLocaleString()} sampai ${endIndex.toLocaleString()} dari ${totalItems.toLocaleString()} data`;
        }

        if (controlsEl) {
            let btnsHtml = '';
            btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(1)" ${srCurrentPage === 1 ? 'disabled' : ''}>« Awal</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(${srCurrentPage - 1})" ${srCurrentPage === 1 ? 'disabled' : ''}>‹ Sebelumnya</button>`;

            const maxButtons = 5;
            let startPage = Math.max(1, srCurrentPage - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }

            for (let p = startPage; p <= endPage; p++) {
                btnsHtml += `<button class="pagination-btn ${p === srCurrentPage ? 'active' : ''}" onclick="App.goToSRPage(${p})">${p}</button>`;
            }

            btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(${srCurrentPage + 1})" ${srCurrentPage === totalPages ? 'disabled' : ''}>Berikutnya ›</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(${totalPages})" ${srCurrentPage === totalPages ? 'disabled' : ''}>Akhir »</button>`;

            controlsEl.innerHTML = btnsHtml;
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
                if (row) row.info = info;
                if (selectEl) {
                    selectEl.classList.add('is-saved');
                    setTimeout(() => selectEl.classList.remove('is-saved'), 1200);
                }
                showToast('success', 'Info Diperbarui', `Diperbarui menjadi ${info}`);
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
                if (checkboxEl) checkboxEl.title = isActive ? 'Aktif' : 'Nonaktif';

                // Update Count checkbox state for this row
                const countCb = document.getElementById(`sr-counted-${id}`) || checkboxEl?.closest('tr')?.querySelector('.sr-counted-checkbox');
                if (countCb) {
                    countCb.disabled = !isActive;
                    countCb.style.cursor = !isActive ? 'not-allowed' : 'pointer';
                    countCb.style.opacity = !isActive ? '0.45' : '1';
                    const isCounted = row ? (row.is_counted !== false && row.is_counted !== 0 && row.is_counted !== '0') : countCb.checked;
                    countCb.checked = isActive && isCounted;
                    countCb.title = !isActive ? 'Site harus aktif terlebih dahulu' : (isCounted ? 'Dihitung dalam Ringkasan & Grafik' : 'Tidak Dihitung dalam Ringkasan & Grafik');
                }

                showToast('success', 'Status Diperbarui', `Status site diatur menjadi ${isActive ? 'Aktif' : 'Nonaktif'}`);
                if (typeof loadSummaryData === 'function') loadSummaryData();
                if (typeof loadRekapitulasi === 'function') loadRekapitulasi();
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
                if (checkboxEl) {
                    checkboxEl.title = isCounted ? 'Dihitung dalam Ringkasan & Grafik' : 'Tidak Dihitung dalam Ringkasan & Grafik';
                }
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
                const badgeColor = isInactive ? '#64748b' : (isQ ? '#0284c7' : '#16a34a');
                const badgeBg = isInactive ? '#f1f5f9' : (isQ ? '#e0f2fe' : '#dcfce7');
                const border = isInactive ? 'border: 1px solid #cbd5e1;' : '';

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
        const num = Math.round(parseFloat(val));
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
        const num = Math.round(parseFloat(val));
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
            if (!nextCat || (nextCat !== 'outlet_subarep' && nextCat !== 'warehouse_hub')) {
                const savedQCat = sessionStorage.getItem('summary_category_quarterly');
                nextCat = (savedQCat === 'warehouse_hub') ? 'warehouse_hub' : 'outlet_subarep';
            }
        } else {
            if (catSliderMonthly) catSliderMonthly.style.display = 'inline-flex';
            if (catSliderQuarterly) catSliderQuarterly.style.display = 'none';
            if (!nextCat || (nextCat !== 'pmd' && nextCat !== 'outlet')) {
                const savedMCat = sessionStorage.getItem('summary_category_monthly');
                nextCat = (savedMCat === 'outlet') ? 'outlet' : 'pmd';
            }
        }

        switchSummaryCategory(nextCat);
    }

    function switchSummaryCategory(cat) {
        if (cat === 'outlet_subarep' || cat === 'warehouse_hub') {
            summarySOType = 'quarterly';
            try { sessionStorage.setItem('summary_category_quarterly', cat); } catch (e) { }
        } else if (cat === 'pmd' || cat === 'outlet') {
            summarySOType = 'monthly';
            try { sessionStorage.setItem('summary_category_monthly', cat); } catch (e) { }
        }
        summaryCategory = cat;

        try {
            sessionStorage.setItem('summary_so_type', summarySOType);
            sessionStorage.setItem('summary_category', summaryCategory);
        } catch (e) { }

        // 1. Sync button states for Monthly Category tabs
        const btnOutlet = document.getElementById('btn-summary-cat-outlet');
        const btnPmd = document.getElementById('btn-summary-cat-pmd');
        if (btnOutlet && btnPmd) {
            btnOutlet.classList.toggle('active', cat === 'outlet');
            btnPmd.classList.toggle('active', cat === 'pmd');
        }

        // 2. Sync button states for Quarterly Category tabs
        const btnSubarep = document.getElementById('btn-summary-cat-subarep');
        const btnWarehouse = document.getElementById('btn-summary-cat-warehouse');
        if (btnSubarep && btnWarehouse) {
            btnSubarep.classList.toggle('active', cat === 'outlet_subarep');
            btnWarehouse.classList.toggle('active', cat === 'warehouse_hub');
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
            }

            catStatus.innerHTML = `(<strong style="color: ${color};">${label}</strong> Target ${threshold})`;
        }

        // Toggle KPI cards & groups
        const isQuarterly = (summarySOType === 'quarterly');
        const outletKpiCards = isQuarterly
            ? ['kpi-card-national', 'kpi-group-wro', 'kpi-group-ero']
            : ['kpi-card-national', 'kpi-group-wro', 'kpi-group-cro', 'kpi-group-ero'];
        const pmdKpiCards = ['kpi-card-pmd', 'kpi-card-dno', 'kpi-card-dso'];

        // In quarterly summary, ensure CRO group is completely hidden
        const croGroup = document.getElementById('kpi-group-cro');
        if (croGroup && isQuarterly) {
            croGroup.style.display = 'none';
        }

        const showOutletKpis = (cat === 'outlet' || cat === 'outlet_subarep' || cat === 'warehouse_hub');

        // Update National / Category KPI card title
        const natTitleEl = document.getElementById('kpi-national-title');
        if (natTitleEl) {
            if (cat === 'outlet_subarep') {
                natTitleEl.textContent = 'Summary Outlet Subarep Achievement';
            } else if (cat === 'warehouse_hub') {
                natTitleEl.textContent = 'Summary Warehouse HUB Achievement';
            } else {
                natTitleEl.textContent = 'Summary Outlet Regional Achievement';
            }
        }

        outletKpiCards.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = showOutletKpis ? 'flex' : 'none';
        });

        pmdKpiCards.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (cat === 'pmd') ? 'flex' : 'none';
        });

        // Ensure Catatan Executive Summary card is always displayed across all categories
        const execCatatanCard = document.getElementById('card-executive-catatan');
        if (execCatatanCard) {
            execCatatanCard.style.display = 'block';
        }

        // Toggle Trend chart cards
        const pmdTrendCard = document.getElementById('card-trend-pmd-wrapper');
        const subDeptTrendCard = document.getElementById('card-trend-subdept-wrapper');
        const trendRow2 = document.getElementById('trend-charts-row-sub');
        const deptTrendTitle = document.getElementById('trend-dept-title');
        const deptTrendBadge = document.getElementById('trend-dept-badge');

        if (trendRow2) {
            trendRow2.classList.add('single-chart');
        }

        if (showOutletKpis) {
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
        } else {
            if (pmdTrendCard) pmdTrendCard.style.display = 'block';
            if (subDeptTrendCard) subDeptTrendCard.style.display = 'none';
            if (deptTrendTitle) deptTrendTitle.textContent = 'Trend Achievement SO Dept (PMD)';
            if (deptTrendBadge) {
                deptTrendBadge.textContent = 'PMD';
                deptTrendBadge.style.background = '#faf5ff';
                deptTrendBadge.style.color = '#9333ea';
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

            rekapSubtitle.textContent = summarySOType === 'monthly'
                ? `Monthly Stock Opname - ${catDisplayName}`
                : `Quarterly Stock Opname - ${catDisplayName}`;
        }

        rekapDeptFilter = 'all';
        rekapSubDeptFilter = 'all';
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
        const statusFilterContainer = document.getElementById('status-result-filter-container');
        const deptSelect = document.getElementById('dept-result-filter');
        const subDeptSelect = document.getElementById('subdept-result-filter');
        const statusSelect = document.getElementById('status-result-filter');

        if (summaryCategory === 'pmd') {
            if (titleEl) titleEl.textContent = 'Report SO PMD';
            if (subtitleEl) subtitleEl.textContent = 'Pencapaian dan Hasil Stock Opname PMD';
            if (deptFilterContainer) deptFilterContainer.style.display = 'none';
            if (statusFilterContainer) statusFilterContainer.style.display = 'flex';
            if (statusSelect) statusSelect.value = 'all';

            if (subDeptSelect) {
                subDeptSelect.innerHTML = `
                    <option value="all" selected>Semua Sub Dept</option>
                    <option value="DNO">DNO</option>
                    <option value="DSO">DSO</option>
                `;
            }
        } else {
            if (titleEl) titleEl.textContent = (summarySOType === 'quarterly')
                ? 'Report SO Outlet Regional (Quarterly)'
                : 'Report SO Outlet Regional';
            if (subtitleEl) subtitleEl.textContent = (summarySOType === 'quarterly')
                ? 'Pencapaian dan Hasil Stock Opname Outlet Regional Quarterly'
                : 'Pencapaian dan Hasil Stock Opname Outlet Regional';
            if (deptFilterContainer) deptFilterContainer.style.display = 'flex';
            if (statusFilterContainer) statusFilterContainer.style.display = 'flex';

            if (deptSelect) {
                if (summarySOType === 'quarterly') {
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
                const allowedDepts = (summarySOType === 'quarterly' ? ['ERO', 'WRO'] : ['CRO', 'ERO', 'WRO']);
                allowedDepts.forEach(deptKey => {
                    const list = DEPT_SUBDEPTS_MAP[deptKey] || [];
                    html += `<optgroup label="${deptKey}">`;
                    list.forEach(code => {
                        html += `<option value="${code}">${code}</option>`;
                    });
                    html += `</optgroup>`;
                });
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

            if (savedMonth && savedYear && monthSelect && yearSelect) {
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
            if (month) sessionStorage.setItem('summary_filter_month', month);
            if (year) sessionStorage.setItem('summary_filter_year', year);
        } catch (e) { }

        // Update achievement card helper
        const updateAchCard = (valId, subId, trendId, statusId, item, defaultLabel, isPmd = false) => {
            const rawPct = item && item.pct !== null && item.pct !== undefined ? parseFloat(item.pct) : 0;
            const pct = Math.round(rawPct);
            const count = item?.count || 0;
            const total = item?.total_sites || 0;
            const color = total === 0 ? '#94a3b8' : getPctColor(pct, isPmd);
            const targetThreshold = isPmd ? 98 : 85;

            const valEl = document.getElementById(valId);
            if (valEl) {
                valEl.textContent = `${pct}%`;
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
                    const roundedPct = Math.round(pct);
                    const roundedTarget = Math.round(targetThreshold);
                    const isAbove = (roundedPct >= roundedTarget);
                    const diff = roundedPct - roundedTarget;
                    const formattedDiff = (diff >= 0 ? '+' : '') + diff + '%';

                    // Solid triangle style: up (green) if >= threshold, down (red) if < threshold
                    const triangleSvg = isAbove
                        ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"/></svg>`
                        : `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"/></svg>`;

                    trendEl.innerHTML = `
                        <span class="kpi-target-indicator ${isAbove ? 'target-up' : 'target-down'}" title="Target: ${roundedTarget}% (Gap: ${formattedDiff})">
                            ${triangleSvg}
                            <span>${formattedDiff}</span>
                        </span>
                    `;
                }
            }
        };

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

            const t = json.totals || {};
            const ach = json.achievements || {};

            const nat = ach.outlet_national || ach.national || {};
            const cro = ach.cro || {};
            const ero = ach.ero || {};
            const wro = ach.wro || {};
            const pmd = ach.pmd || {};
            const dno = ach.dno || {};
            const dso = ach.dso || {};

            let natTitle = 'Summary Outlet Regional Achievement';
            let natDefaultLabel = 'Avg Outlet Regional';
            if (summarySOType === 'quarterly') {
                if (summaryCategory === 'outlet_subarep') {
                    natTitle = 'Summary Outlet Subarep Achievement';
                    natDefaultLabel = 'Avg Outlet Subarep';
                } else if (summaryCategory === 'warehouse_hub') {
                    natTitle = 'Summary Warehouse HUB Achievement';
                    natDefaultLabel = 'Avg Warehouse HUB';
                }
            }

            const natTitleEl = document.getElementById('kpi-national-title');
            if (natTitleEl) natTitleEl.textContent = natTitle;

            updateAchCard('kpi-national-achievement', 'kpi-national-subtext', 'kpi-national-trend', 'kpi-national-status', nat, natDefaultLabel, false);
            updateAchCard('kpi-cro-achievement', 'kpi-cro-subtext', 'kpi-cro-trend', 'kpi-cro-status', cro, 'Avg DEPT CRO', false);
            updateAchCard('kpi-ero-achievement', 'kpi-ero-subtext', 'kpi-ero-trend', 'kpi-ero-status', ero, 'Avg DEPT ERO', false);
            updateAchCard('kpi-wro-achievement', 'kpi-wro-subtext', 'kpi-wro-trend', 'kpi-wro-status', wro, 'Avg DEPT WRO', false);
            updateAchCard('kpi-pmd-achievement', 'kpi-pmd-subtext', 'kpi-pmd-trend', 'kpi-pmd-status', pmd, 'Avg PMD Departement', true);
            updateAchCard('kpi-dno-achievement', 'kpi-dno-subtext', 'kpi-dno-trend', 'kpi-dno-status', dno, 'Avg Sub DEPT DNO', true);
            updateAchCard('kpi-dso-achievement', 'kpi-dso-subtext', 'kpi-dso-trend', 'kpi-dso-status', dso, 'Avg Sub DEPT DSO', true);

            // Populate Subdept Average Value Cards under each group (WRO, CRO, ERO)
            const subDeptsData = ach.sub_depts || {};
            const updateSubDeptCard = (subKey) => {
                const sKey = subKey.toLowerCase();
                const sData = subDeptsData[sKey] || {};
                const rawPct = sData.pct !== undefined && sData.pct !== null ? parseFloat(sData.pct) : 0;
                const pct = Math.round(rawPct);
                const count = sData.count || 0;
                const total = sData.total_sites || 0;
                const color = total === 0 ? '#94a3b8' : getPctColor(pct, false);

                const valEl = document.getElementById(`kpi-subdept-val-${sKey}`);
                if (valEl) {
                    valEl.textContent = `${pct}%`;
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
                        const targetThreshold = 85;
                        const isAbove = (pct >= targetThreshold);
                        const diff = pct - targetThreshold;
                        const formattedDiff = (diff >= 0 ? '+' : '') + diff + '%';
                        const triangleSvg = isAbove
                            ? `<svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"/></svg>`
                            : `<svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"/></svg>`;

                        trendEl.innerHTML = `
                            <span class="kpi-target-indicator ${isAbove ? 'target-up' : 'target-down'}" style="font-size: 9.5px; padding: 1.5px 5px;" title="Target: 85% (Gap: ${formattedDiff})">
                                ${triangleSvg}
                                <span>${formattedDiff}</span>
                            </span>
                        `;
                    }
                }

                const statusEl = document.getElementById(`kpi-subdept-status-${sKey}`);
                if (statusEl) {
                    if (total === 0) {
                        statusEl.innerHTML = '<span class="so-status-badge status-none">Belum Ada Data</span>';
                    } else if (pct >= 85) {
                        statusEl.innerHTML = '<span class="so-status-badge status-green">Tercapai</span>';
                    } else {
                        statusEl.innerHTML = '<span class="so-status-badge status-red">Tidak Tercapai</span>';
                    }
                }
            };

            ['cso', 'nso', 'sso', 'cjdo', 'eko', 'wjo', 'wko', 'bno', 'ejo', 'mpo', 'smo'].forEach(updateSubDeptCard);

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

        } catch (err) {
            console.error('Error loading summary totals:', err);
        }
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
                    return `<span class="kpi-target-indicator target-neutral" title="Tidak ada perubahan"><span>-</span></span>`;
                }
                const isGood = invertColors ? (diff < 0) : (diff > 0);
                const cls = isGood ? 'target-up' : 'target-down';
                const formatted = diff > 0 ? `+${diff}` : `${diff}`;
                const arrowSvg = diff > 0
                    ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"></polygon></svg>`
                    : `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"></polygon></svg>`;
                return `
                    <span class="kpi-target-indicator ${cls}" title="${formatted} vs bulan sebelumnya">
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
            } else {
                prevBadge = '<span class="badge-status-monthly">Monthly</span>';
            }

            let currBadge = '';
            if (m.curr_status === 'quarterly') {
                currBadge = '<span class="badge-status-quarterly">Quarterly</span>';
            } else if (m.curr_status === 'inactive') {
                currBadge = '<span class="badge-status-inactive">Inactive</span>';
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
                        <strong>${escapeHtml(m.regional || '-')}</strong>
                        <div style="font-size: 11px; color: #64748b;">${escapeHtml(m.dept || '')}${m.sub_dept ? ' - ' + escapeHtml(m.sub_dept) : ''}</div>
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

    // ── Score Card Summary (Rating & SO Execution - Rolling 3 Months) ──

    let scorecardRatingData = [];
    let scorecardExecutionData = [];
    let scorecardPeriod = null;
    let currentRatingFilter = 'very_poor';
    let currentExecutionFilter = 'not_executed';
    let currentNationalRatingFilter = 'very_poor';

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
        for (let i = 2; i >= 0; i--) {
            let targetM = m - i;
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

        try {
            const res = await fetch(`api/scorecard_summary.php?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}&category=${encodeURIComponent(category)}&so_type=${encodeURIComponent(soType)}`);
            const json = await res.json();

            if (json.success) {
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

                renderNationalScoreCardRating();
                renderScoreCardRating();
                renderScoreCardExecution();
                renderScoreCardRatingPieChart(json.rating_counts);
                renderScoreCardExecPieChart(json.execution_counts);
            } else {
                console.warn('Scorecard summary failed:', json.message);
                scorecardRatingData = [];
                scorecardExecutionData = [];
                scorecardPeriod = null;
                renderNationalScoreCardRating();
                renderScoreCardRating();
                renderScoreCardExecution();
                renderScoreCardRatingPieChart(null);
                renderScoreCardExecPieChart(null);
            }
        } catch (err) {
            console.error('Error fetching scorecard summary:', err);
            scorecardRatingData = [];
            scorecardExecutionData = [];
            scorecardPeriod = null;
            renderNationalScoreCardRating();
            renderScoreCardRating();
            renderScoreCardExecution();
            renderScoreCardRatingPieChart(null);
            renderScoreCardExecPieChart(null);
        }
    }

    function updateScoreCardPeriod(year, month) {
        return loadScoreCardSummary(year, month);
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
            let filtered = scorecardRatingData;
            if (currentNationalRatingFilter !== 'all') {
                filtered = scorecardRatingData.filter(r => {
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
                        <td colspan="6" class="text-center" style="padding: 1.5rem 0.5rem; color: #94a3b8; font-size: 11px;">
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
                        <td class="scorecard-col-no" style="color: #64748b;">${idx + 1}</td>
                        <td class="scorecard-col-subdept" style="color: #475569;" title="${escapeHtml(r.sub_dept || '-')}">${escapeHtml(r.sub_dept || '-')}</td>
                        <td class="scorecard-col-sitecode">${escapeHtml(r.sitecode)}</td>
                        <td class="scorecard-col-namesite" style="font-weight: 600; color: #1e293b;" title="${escapeHtml(r.name_site || '-')}">${escapeHtml(r.name_site || '-')}</td>
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

        const isNegativeMetric = (currentNationalRatingFilter === 'very_poor' || currentNationalRatingFilter === 'poor');

        const renderCountTrendBadge = (diff, prevLabel, isBaseline = false) => {
            if (isBaseline) {
                return `<span class="kpi-target-indicator target-neutral" style="font-size: 10px; padding: 2.5px 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; vertical-align: middle;" title="Bulan acuan (baseline)"><span style="display: inline-flex; align-items: center; justify-content: center; line-height: 1;">-</span></span>`;
            }
            if (diff === null || diff === undefined || diff === 0) {
                return `<span class="kpi-target-indicator target-neutral" style="font-size: 10px; padding: 2.5px 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; vertical-align: middle;" title="Tidak ada perubahan vs ${prevLabel}"><span style="display: inline-flex; align-items: center; justify-content: center; line-height: 1;">0</span></span>`;
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
                <span class="kpi-target-indicator ${cls}" style="font-size: 10px; padding: 2.5px 6px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; vertical-align: middle;" title="${formatted} Sites vs ${prevLabel}">
                    ${triangleSvg}
                    <span style="display: inline-flex; align-items: center; justify-content: center; line-height: 1;">${formatted}</span>
                </span>
            `;
        };

        if (trendEl1) {
            trendEl1.innerHTML = renderCountTrendBadge(null, title1, true);
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
                    <td colspan="6" class="text-center" style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                        <div style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">
                            No data
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let filtered = scorecardRatingData;
        if (currentRatingFilter !== 'all') {
            filtered = scorecardRatingData.filter(r => (r.rating || '').toLowerCase().replace(/\s+/g, '_') === currentRatingFilter);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="padding: 2rem 0.5rem; color: #94a3b8;">
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
                    <td class="scorecard-col-no" style="color: #64748b;">${idx + 1}</td>
                    <td class="scorecard-col-subdept" style="color: #475569;" title="${escapeHtml(r.sub_dept || '-')}">${escapeHtml(r.sub_dept || '-')}</td>
                    <td class="scorecard-col-sitecode">${escapeHtml(r.sitecode)}</td>
                    <td class="scorecard-col-namesite" style="font-weight: 600; color: #1e293b;" title="${escapeHtml(r.name_site || '-')}">${escapeHtml(r.name_site || '-')}</td>
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
                    <td colspan="6" class="text-center" style="padding: 2.2rem 0.5rem; color: #94a3b8;">
                        <div style="font-size: 12.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">
                            No data
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let filtered = scorecardExecutionData;
        if (currentExecutionFilter !== 'all') {
            filtered = scorecardExecutionData.filter(e => (e.execution_status || '').toLowerCase().replace(/\s+/g, '_') === currentExecutionFilter);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="padding: 2rem 0.5rem; color: #94a3b8;">
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
                    <td class="scorecard-col-no" style="color: #64748b;">${idx + 1}</td>
                    <td class="scorecard-col-subdept" style="color: #475569;" title="${escapeHtml(e.sub_dept || '-')}">${escapeHtml(e.sub_dept || '-')}</td>
                    <td class="scorecard-col-sitecode">${escapeHtml(e.sitecode)}</td>
                    <td class="scorecard-col-namesite" style="font-weight: 600; color: #1e293b;" title="${escapeHtml(e.name_site || '-')}">${escapeHtml(e.name_site || '-')}</td>
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
        const colors = ['#047857', '#0284c7', '#d97706', '#ea580c', '#b91c1c'];
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

        if (elVg) elVg.textContent = total > 0 ? `${data[0]} sites (${Math.round((data[0] / total) * 100)}%)` : '0 sites (0%)';
        if (elG) elG.textContent = total > 0 ? `${data[1]} sites (${Math.round((data[1] / total) * 100)}%)` : '0 sites (0%)';
        if (elM) elM.textContent = total > 0 ? `${data[2]} sites (${Math.round((data[2] / total) * 100)}%)` : '0 sites (0%)';
        if (elP) elP.textContent = total > 0 ? `${data[3]} sites (${Math.round((data[3] / total) * 100)}%)` : '0 sites (0%)';
        if (elVp) elVp.textContent = total > 0 ? `${data[4]} sites (${Math.round((data[4] / total) * 100)}%)` : '0 sites (0%)';

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
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
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
        const colors = ['#047857', '#b91c1c'];
        const data = counts ? [
            counts.executed || 0,
            counts.not_executed || 0
        ] : [0, 0];

        const total = data.reduce((a, b) => a + b, 0);

        const elExec = document.getElementById('sc-stat-exec');
        const elNotExec = document.getElementById('sc-stat-not-exec');

        if (elExec) elExec.textContent = total > 0 ? `${data[0]} sites (${Math.round((data[0] / total) * 100)}%)` : '0 sites (0%)';
        if (elNotExec) elNotExec.textContent = total > 0 ? `${data[1]} sites (${Math.round((data[1] / total) * 100)}%)` : '0 sites (0%)';

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
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
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
        const isPmdMode = (currentCategory === 'pmd' || dept === 'PMD');

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

        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
                    <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
                        <span class="spinner" style="width: 16px; height: 16px;"></span>
                        <span>Memuat Hasil SO ${catLabel}...</span>
                    </div>
                </td>
            </tr>
        `;
        if (tfoot) tfoot.innerHTML = '';

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
                        <td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">
                            Gagal memuat data: ${escapeHtml(json.message || 'Unknown error')}
                        </td>
                    </tr>
                `;
                return;
            }

            const rows = json.data || [];
            if (rows.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
                            No data.
                        </td>
                    </tr>
                `;
                renderSubDeptPieChart(0, 0, 0);
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
                    const pct = Math.round(parseFloat(r.total_physic_pct));
                    if (isPmdMode) {
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

            // Update Pie Card Subtitle
            const pieSubtitle = document.getElementById('subdept-pie-subtitle');
            if (pieSubtitle) {
                let label = '';
                if (currentCategory === 'pmd') {
                    label = (subDept === 'all') ? 'Semua Sub Dept' : `PMD - ${subDept}`;
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
                        <td colspan="7" style="text-align: center; padding: 2.5rem; color: #64748b;">
                            Tidak ada data dengan status <strong>${escapeHtml(filterLabel)}</strong>.
                        </td>
                    </tr>
                `;
                if (tfoot) tfoot.innerHTML = '';
                renderSubDeptPieChart(countTercapai, countTidakTercapai, rows.length);
                return;
            }

            let html = '';
            displayRows.forEach((r) => {
                const sitecode = escapeHtml(r.sitecode || '-');
                const nameSite = escapeHtml(r.name_site || '-');
                const matchQty = Number(r.match_physic_qty || 0).toLocaleString();
                const physicQty = Number(r.physic_physic_qty || 0).toLocaleString();
                const dbQty = Number(r.db_physic_qty || 0).toLocaleString();

                let pctDisplay = '-';
                let statusHtml = '<span class="so-status-badge status-none">Belum Ada Data</span>';

                if (r.has_data && r.total_physic_pct !== null && r.total_physic_pct !== undefined) {
                    const pct = Math.round(parseFloat(r.total_physic_pct));
                    pctDisplay = `${pct}%`;

                    let statusText = 'Tidak Tercapai';
                    let statusClass = 'status-red';
                    let progressClass = 'so-progress-red';
                    let color = '#dc2626';

                    if (isPmdMode) {
                        if (pct >= 98) {
                            statusText = 'Tercapai';
                            statusClass = 'status-green';
                            progressClass = 'so-progress-green';
                            color = '#16a34a';
                        } else {
                            statusText = 'Tidak Tercapai';
                            statusClass = 'status-red';
                            progressClass = 'so-progress-red';
                            color = '#dc2626';
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
                        } else {
                            statusText = 'Tidak Tercapai';
                            statusClass = 'status-red';
                            progressClass = 'so-progress-red';
                            color = '#dc2626';
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

                const cellColor = r.has_data ? (isPmdMode ? (pctDisplay !== '-' && parseInt(pctDisplay) >= 98 ? '#16a34a' : '#dc2626') : (pctDisplay !== '-' && parseInt(pctDisplay) >= 85 ? '#16a34a' : (pctDisplay !== '-' && parseInt(pctDisplay) >= 75 ? '#ea580c' : '#dc2626'))) : '#64748b';

                html += `
                    <tr>
                        <td style="text-align: center; font-weight: 600; color: #1e293b;">${sitecode}</td>
                        <td style="text-align: left; font-weight: 500; color: #334155;">${nameSite}</td>
                        <td style="text-align: center; font-weight: 600; color: #0f172a;">${matchQty}</td>
                        <td style="text-align: center; font-weight: 600; color: #0f172a;">${physicQty}</td>
                        <td style="text-align: center; font-weight: 600; color: #0f172a;">${dbQty}</td>
                        <td style="text-align: center; font-weight: 700; color: ${cellColor};">
                            ${pctDisplay}
                        </td>
                        <td>${statusHtml}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;

            // Render Footer with Totals & Average
            if (tfoot) {
                let totalMatch, totalPhysic, totalDb, avgPct, countWithData;
                if (statusFilter === 'all') {
                    totalMatch = Number(json.total_match_qty || 0).toLocaleString();
                    totalPhysic = Number(json.total_physic_qty || 0).toLocaleString();
                    totalDb = Number(json.total_db_qty || 0).toLocaleString();
                    avgPct = Math.round(parseFloat(json.avg_pct || 0));
                    countWithData = json.count_with_data || 0;
                } else {
                    let sMatch = 0, sPhysic = 0, sDb = 0, sPct = 0;
                    countWithData = 0;
                    displayRows.forEach(r => {
                        sMatch += Number(r.match_physic_qty || 0);
                        sPhysic += Number(r.physic_physic_qty || 0);
                        sDb += Number(r.db_physic_qty || 0);
                        if (r.has_data && r.total_physic_pct !== null && r.total_physic_pct !== undefined) {
                            sPct += parseFloat(r.total_physic_pct);
                            countWithData++;
                        }
                    });
                    totalMatch = sMatch.toLocaleString();
                    totalPhysic = sPhysic.toLocaleString();
                    totalDb = sDb.toLocaleString();
                    avgPct = countWithData > 0 ? Math.round(sPct / countWithData) : 0;
                }
                const avgDisplay = `${avgPct}%`;

                let overallText = 'Belum Ada Data';
                let overallStatusClass = 'status-none';
                let overallProgressClass = '';
                let overallColor = '#64748b';

                if (countWithData > 0) {
                    if (isPmdMode) {
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
                    <tr style="background: #f8fafc; position: sticky; bottom: 0; z-index: 5;">
                        <td colspan="2" style="position: sticky; bottom: 0; background: #f8fafc; z-index: 5; text-align: left; padding: 0.85rem 1rem; color: #1e293b; border-top: 2px solid #cbd5e1; box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);">
                            Total (${displayRows.length} Sites${filterNote})
                        </td>
                        <td style="position: sticky; bottom: 0; background: #f8fafc; z-index: 5; text-align: center; padding: 0.85rem 1rem; color: #0f172a; font-size: 13.5px; border-top: 2px solid #cbd5e1; box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);">${totalMatch}</td>
                        <td style="position: sticky; bottom: 0; background: #f8fafc; z-index: 5; text-align: center; padding: 0.85rem 1rem; color: #0f172a; font-size: 13.5px; border-top: 2px solid #cbd5e1; box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);">${totalPhysic}</td>
                        <td style="position: sticky; bottom: 0; background: #f8fafc; z-index: 5; text-align: center; padding: 0.85rem 1rem; color: #0f172a; font-size: 13.5px; border-top: 2px solid #cbd5e1; box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);">${totalDb}</td>
                        <td style="position: sticky; bottom: 0; background: #f8fafc; z-index: 5; text-align: center; padding: 0.85rem 1rem; font-size: 13.5px; color: ${overallColor}; font-weight: 800; border-top: 2px solid #cbd5e1; box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);">
                            ${countWithData > 0 ? avgDisplay : '-'}
                        </td>
                        <td style="position: sticky; bottom: 0; background: #f8fafc; z-index: 5; padding: 0.85rem 1rem; border-top: 2px solid #cbd5e1; box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);">${overallStatusHtml}</td>
                    </tr>
                `;
            }

            // Render Right-Side Pie / Doughnut Chart
            renderSubDeptPieChart(countTercapai, countTidakTercapai, rows.length);

        } catch (err) {
            console.error('Error loading subdept results:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">
                        Kesalahan jaringan saat memuat data Hasil SO Outlet Regional.
                    </td>
                </tr>
            `;
            renderSubDeptPieChart(0, 0, 0);
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

    function renderSubDeptPieChart(tercapai, tidakTercapai, total) {
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
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                return ` ${context.label}: ${val} sites (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '62%'
            }
        });

        if (statsContainer) {
            const pctTercapai = total > 0 ? Math.round((tercapai / total) * 100) : 0;
            const pctTidak = total > 0 ? Math.round((tidakTercapai / total) * 100) : 0;
            const thresholdLabel = (summaryCategory === 'pmd') ? '98%' : '85%';
            const statusSel = document.getElementById('status-result-filter');
            const curStatus = statusSel ? statusSel.value : 'all';
            const activeTercapai = (curStatus === 'tercapai') ? ' active' : '';
            const activeTidak = (curStatus === 'tidak_tercapai') ? ' active' : '';
            const activeAll = (curStatus === 'all') ? ' active' : '';

            let statsHtml = `
                <div class="so-pie-stat-row${activeTercapai}" onclick="App.toggleSubDeptStatusFilter('tercapai')" title="Klik untuk filter status Tercapai">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #16a34a;"></span>
                        Tercapai (≥${thresholdLabel})
                    </span>
                    <span class="so-pie-stat-val" style="color: #16a34a;">
                        ${tercapai} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTercapai}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row${activeTidak}" onclick="App.toggleSubDeptStatusFilter('tidak_tercapai')" title="Klik untuk filter status Tidak Tercapai">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #dc2626;"></span>
                        Tidak Tercapai (<${thresholdLabel})
                    </span>
                    <span class="so-pie-stat-val" style="color: #dc2626;">
                        ${tidakTercapai} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTidak}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row${activeAll}" onclick="App.toggleSubDeptStatusFilter('all')" title="Klik untuk tampilkan Semua Status" style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
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
        const pmdCanvas = document.getElementById('chart-trend-pmd');

        if (!deptCanvas || !subDeptCanvas || !pmdCanvas) return;

        const targetYear = year || (document.getElementById('summary-filter-year')?.value) || 2026;

        document.querySelectorAll('.trend-chart-subtitle').forEach(el => {
            el.textContent = (summarySOType === 'monthly')
                ? `Monthly Physical % (Jan - Dec ${targetYear})`
                : `Quarterly Physical % (Q1 - Q4 ${targetYear})`;
        });

        try {
            const res = await fetch(`api/rekapitulasi.php?action=trends&year=${targetYear}&so_type=${summarySOType}`);
            const json = await res.json();
            if (!json.success) {
                console.error('Failed to load trend data:', json.message);
                return;
            }

            const months = json.months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

            // Helper to apply highlight state to a chart
            const applyChartHighlight = (chart, targetIndex) => {
                chart._highlightedIndex = targetIndex;
                chart.data.datasets.forEach((ds, idx) => {
                    const origColor = ds._origBorderColor || ds.borderColor;
                    const meta = chart.getDatasetMeta ? chart.getDatasetMeta(idx) : null;

                    if (targetIndex === null || targetIndex === undefined) {
                        // Restored state: all datasets visible with normal points
                        ds.borderColor = origColor;
                        ds.backgroundColor = origColor;
                        ds.borderWidth = ds._origBorderWidth || 2;
                        ds.pointRadius = ds._origPointRadius || 2;
                        ds.radius = ds._origPointRadius || 2;
                        ds.pointHoverRadius = ds._origPointHoverRadius || 5;
                        ds.hoverRadius = ds._origPointHoverRadius || 5;
                        ds.pointHitRadius = 5;
                        ds.pointBackgroundColor = origColor;
                        ds.pointBorderColor = origColor;
                        ds.pointBorderWidth = 1;

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = ds._origPointRadius || 2;
                                pt.options.hoverRadius = ds._origPointHoverRadius || 5;
                                pt.options.hitRadius = 5;
                                pt.options.borderWidth = 1;
                                pt.options.backgroundColor = origColor;
                                pt.options.borderColor = origColor;
                            });
                        }
                    } else if (idx === targetIndex) {
                        // Highlighted dataset: focused line with its dots still appearing!
                        const focusRadius = ds._origPointRadius ? Math.max(ds._origPointRadius, 4) : 4;
                        const focusHoverRadius = ds._origPointHoverRadius ? Math.max(ds._origPointHoverRadius, 6) : 6;
                        ds.borderColor = origColor;
                        ds.backgroundColor = origColor;
                        ds.borderWidth = 3.6;
                        ds.pointRadius = focusRadius;
                        ds.radius = focusRadius;
                        ds.pointHoverRadius = focusHoverRadius;
                        ds.hoverRadius = focusHoverRadius;
                        ds.pointHitRadius = 8;
                        ds.pointBackgroundColor = origColor;
                        ds.pointBorderColor = '#ffffff';
                        ds.pointBorderWidth = 1.5;

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = focusRadius;
                                pt.options.hoverRadius = focusHoverRadius;
                                pt.options.hitRadius = 8;
                                pt.options.borderWidth = 1.5;
                                pt.options.backgroundColor = origColor;
                                pt.options.borderColor = '#ffffff';
                            });
                        }
                    } else {
                        // Other datasets: invisible grey line, dots completely invisible!
                        const dimColor = hexToRgba(origColor, 0.12);
                        ds.borderColor = dimColor;
                        ds.backgroundColor = dimColor;
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
                'PMD': ['DNO', 'DSO']
            };

            // Helper to sync subdept chart with the selected DEPT group
            const applySubDeptGroupHighlight = (chart, deptKey) => {
                if (!chart || !chart.data || !chart.data.datasets) return;
                chart._activeDeptGroup = deptKey || null;
                const allowedSubs = deptKey ? (DEPT_SUBDEPTS_MAP[deptKey] || []) : null;

                chart.data.datasets.forEach((ds, idx) => {
                    const origColor = ds._origBorderColor || ds.borderColor;
                    const meta = chart.getDatasetMeta ? chart.getDatasetMeta(idx) : null;

                    if (!allowedSubs) {
                        // Restored state: all lines normal
                        ds.borderColor = origColor;
                        ds.backgroundColor = origColor;
                        ds.borderWidth = ds._origBorderWidth || 2;
                        ds.pointRadius = ds._origPointRadius || 2;
                        ds.radius = ds._origPointRadius || 2;
                        ds.pointHoverRadius = ds._origPointHoverRadius || 5;
                        ds.hoverRadius = ds._origPointHoverRadius || 5;
                        ds.pointHitRadius = 5;
                        ds.pointBackgroundColor = origColor;
                        ds.pointBorderColor = origColor;
                        ds.pointBorderWidth = 1;

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = ds._origPointRadius || 2;
                                pt.options.hoverRadius = ds._origPointHoverRadius || 5;
                                pt.options.hitRadius = 5;
                                pt.options.borderWidth = 1;
                                pt.options.backgroundColor = origColor;
                                pt.options.borderColor = origColor;
                            });
                        }
                    } else if (allowedSubs.includes(ds.label)) {
                        // In the selected DEPT group: emphasized!
                        const focusRadius = 4;
                        const focusHoverRadius = 6;
                        ds.borderColor = origColor;
                        ds.backgroundColor = origColor;
                        ds.borderWidth = 3.2;
                        ds.pointRadius = focusRadius;
                        ds.radius = focusRadius;
                        ds.pointHoverRadius = focusHoverRadius;
                        ds.hoverRadius = focusHoverRadius;
                        ds.pointHitRadius = 8;
                        ds.pointBackgroundColor = origColor;
                        ds.pointBorderColor = '#ffffff';
                        ds.pointBorderWidth = 1.5;

                        if (meta && meta.data) {
                            meta.data.forEach(pt => {
                                if (!pt.options) pt.options = {};
                                pt.options.radius = focusRadius;
                                pt.options.hoverRadius = focusHoverRadius;
                                pt.options.hitRadius = 8;
                                pt.options.borderWidth = 1.5;
                                pt.options.backgroundColor = origColor;
                                pt.options.borderColor = '#ffffff';
                            });
                        }
                    } else {
                        // Dimmed lines outside the selected DEPT group
                        const dimColor = hexToRgba(origColor, 0.12);
                        ds.borderColor = dimColor;
                        ds.backgroundColor = dimColor;
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

                // Dynamic Header / Subtitle sync for Sub DEPT chart
                const subBadge = document.getElementById('trend-subdept-badge');
                const subSubtitle = document.getElementById('trend-subdept-subtitle');
                const yearVal = document.getElementById('summary-filter-year')?.value || 2026;
                const defaultSubtitle = (summarySOType === 'monthly')
                    ? `Monthly Physical % (Jan - Dec ${yearVal})`
                    : `Quarterly Physical % (Q1 - Q4 ${yearVal})`;

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

            // Common Chart Options Builder with Dashed Target Line
            const createChartConfig = (datasets, targetVal = (isPmd ? 98 : 85), isDept = false) => ({
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
                            top: 14,
                            right: 8
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
                                boxWidth: 12,
                                boxHeight: 12,
                                usePointStyle: true,
                                padding: 12,
                                font: { size: 11, weight: '600' },
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
                            backgroundColor: 'rgba(15, 23, 42, 0.94)',
                            titleColor: '#fff',
                            bodyColor: '#e2e8f0',
                            borderColor: '#334155',
                            borderWidth: 1,
                            padding: 10,
                            boxPadding: 4,
                            usePointStyle: true,
                            footerColor: '#fca5a5',
                            footerFont: { size: 10, weight: '600' },
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
                                label: function (context) {
                                    const chart = context.chart;
                                    const highlighted = chart ? chart._highlightedIndex : null;
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed.y !== null && context.parsed.y !== undefined) {
                                        label += Math.round(context.parsed.y) + '%';
                                    } else {
                                        label += '-';
                                    }
                                    if (highlighted !== null && highlighted !== undefined && context.datasetIndex === highlighted) {
                                        label = '● ' + label + ' (Focused)';
                                    }
                                    return label;
                                },
                                footer: function () {
                                    return `Target: ${targetVal}%`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#64748b',
                                font: { size: 10, weight: '500' }
                            }
                        },
                        y: {
                            min: 0,
                            suggestedMax: targetVal >= 95 ? 105 : 100,
                            ticks: {
                                stepSize: 25,
                                color: '#64748b',
                                font: { size: 10 },
                                callback: val => val + '%'
                            },
                            grid: {
                                color: '#f1f5f9'
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'trendTargetLinePlugin',
                    afterDraw(chart) {
                        const target = chart.config.options?.plugins?.trendTargetLine?.value;
                        if (target === undefined || target === null) return;

                        const { ctx, chartArea, scales: { x, y } } = chart;
                        if (!chartArea || !x || !y) return;

                        const yPixel = y.getPixelForValue(target);
                        if (isNaN(yPixel)) return;

                        ctx.save();

                        // 1. Draw dashed line across the chart width
                        ctx.beginPath();
                        ctx.setLineDash([5, 4]);
                        ctx.strokeStyle = '#dc2626';
                        ctx.lineWidth = 1.5;
                        ctx.moveTo(chartArea.left, yPixel);
                        ctx.lineTo(chartArea.right, yPixel);
                        ctx.stroke();

                        // 2. Target Label Badge on the right
                        const text = `Target ${target}%`;
                        ctx.font = '600 10px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
                        const textMetrics = ctx.measureText(text);
                        const textWidth = textMetrics.width;
                        const padX = 6;
                        const badgeHeight = 17;
                        const badgeWidth = textWidth + padX * 2;
                        const badgeX = chartArea.right - badgeWidth - 2;

                        let badgeY = yPixel - badgeHeight / 2;
                        if (badgeY < chartArea.top - 2) {
                            badgeY = chartArea.top - 2;
                        } else if (badgeY + badgeHeight > chartArea.bottom + 2) {
                            badgeY = chartArea.bottom - badgeHeight;
                        }

                        // Soft pill background (white with crisp red border)
                        ctx.setLineDash([]);
                        ctx.fillStyle = '#ffffff';
                        ctx.strokeStyle = '#dc2626';
                        ctx.lineWidth = 1;

                        const r = 3;
                        ctx.beginPath();
                        if (ctx.roundRect) {
                            ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, r);
                        } else {
                            ctx.moveTo(badgeX + r, badgeY);
                            ctx.lineTo(badgeX + badgeWidth - r, badgeY);
                            ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + r);
                            ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - r);
                            ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - r, badgeY + badgeHeight);
                            ctx.lineTo(badgeX + r, badgeY + badgeHeight);
                            ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - r);
                            ctx.lineTo(badgeX, badgeY + r);
                            ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
                        }
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();

                        // Badge text
                        ctx.fillStyle = '#dc2626';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 0.5);

                        ctx.restore();
                    }
                }]
            });

            // 1. Render Card 1: DEPT Trends
            const isPmd = (summaryCategory === 'pmd');
            const deptColors = isPmd
                ? { 'PMD': '#8b5cf6' }
                : (summarySOType === 'quarterly' ? { 'ERO': '#3b82f6', 'WRO': '#10b981' } : { 'CRO': '#f59e0b', 'ERO': '#3b82f6', 'WRO': '#10b981' });

            const deptDatasets = [];
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

            if (chartTrendDept) chartTrendDept.destroy();
            chartTrendDept = new Chart(deptCanvas.getContext('2d'), createChartConfig(deptDatasets, isPmd ? 98 : 85, true));

            if (!isPmd) {
                // 2. Render Card 2: Sub DEPT Trends (Outlet Regional)
                const subDeptPalette = [
                    '#ef4444', // CJDO (red)
                    '#f97316', // EKO (orange)
                    '#f59e0b', // WJO (amber)
                    '#84cc16', // WKO (lime)
                    '#10b981', // BNO (emerald)
                    '#06b6d4', // EJO (cyan)
                    '#0284c7', // MPO (sky)
                    '#3b82f6', // SMO (blue)
                    '#6366f1', // CSO (indigo)
                    '#a855f7', // NSO (purple)
                    '#ec4899', // SSO (pink)
                ];

                const subDeptDatasets = [];
                const subEntries = Object.entries(json.subdept_trends || {});
                subEntries.forEach(([subKey, item], idx) => {
                    const color = subDeptPalette[idx % subDeptPalette.length];
                    subDeptDatasets.push({
                        label: subKey,
                        data: item.values || [],
                        borderColor: color,
                        backgroundColor: color,
                        _origBorderColor: color,
                        _origBackgroundColor: color,
                        _origBorderWidth: 2,
                        _origPointRadius: 2,
                        _origPointHoverRadius: 5,
                        borderWidth: 2,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        tension: 0.3,
                        spanGaps: true
                    });
                });

                if (chartTrendSubDept) chartTrendSubDept.destroy();
                chartTrendSubDept = new Chart(subDeptCanvas.getContext('2d'), createChartConfig(subDeptDatasets, 85));
                if (chartTrendPmd) { chartTrendPmd.destroy(); chartTrendPmd = null; }
            } else {
                // 3. Render Card 3: PMD Sub DEPT Trends
                const pmdColors = {
                    'DNO': '#8b5cf6', // Purple
                    'DSO': '#06b6d4', // Cyan
                };

                const pmdDatasets = [];
                for (const [subKey, values] of Object.entries(json.pmd_subdept_trends || {})) {
                    const color = pmdColors[subKey] || '#3b82f6';
                    pmdDatasets.push({
                        label: subKey,
                        data: values || [],
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

                if (chartTrendPmd) chartTrendPmd.destroy();
                chartTrendPmd = new Chart(pmdCanvas.getContext('2d'), createChartConfig(pmdDatasets, 98));
                if (chartTrendSubDept) { chartTrendSubDept.destroy(); chartTrendSubDept = null; }
            }

            setTimeout(() => {
                if (chartTrendDept) chartTrendDept.resize();
                if (chartTrendSubDept) chartTrendSubDept.resize();
                if (chartTrendPmd) chartTrendPmd.resize();
            }, 50);

        } catch (err) {
            console.error('Error rendering trend charts:', err);
        }
    }

    // ── Rekapitulasi 2026 Section ────────────────────────────────

    function getRekapCategory() {
        if (summarySOType === 'quarterly') {
            if (summaryCategory === 'warehouse_hub') {
                return 'quarterly_warehouse';
            }
            return 'quarterly_subarep';
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
            const catLabel = summaryCategory === 'pmd' ? 'PMD' : 'Outlet Regional';
            const typeLabel = summarySOType === 'quarterly' ? 'Quarterly' : 'Monthly';
            subtitleEl.textContent = `Persentase ${typeLabel} Stock Opname ${catLabel}`;
        }

        const tbody = document.getElementById('rekap-table-body');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="17" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    Loading Rekapitulasi ${rekapYear} records...
                </td>
            </tr>
        `;

        try {
            const category = getRekapCategory();
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

            allRekapRows = json.data || [];
            rekapMonthAverages = json.month_averages || {};
            populateRekapDeptAndSubDeptDropdowns();
            applyRekapFilterAndRender();
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
        if (!deptSelect || !subDeptSelect) return;

        const deptSet = new Set();
        allRekapRows.forEach(r => {
            const d = (r.dept || '').trim().toUpperCase();
            if (d) deptSet.add(d);
        });

        const currentDept = deptSelect.value || rekapDeptFilter || 'all';
        let deptHtml = '<option value="all">Semua DEPT</option>';
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

        let subHtml = '<option value="all">Semua Sub Dept</option>';
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
        return `<span class="pct-badge ${cls}">${Math.round(num)}%</span>`;
    }

    function renderRekapTable() {
        const tbody = document.getElementById('rekap-table-body');
        const tfoot = document.getElementById('rekap-table-foot');
        const infoEl = document.getElementById('rekap-pagination-info');
        const controlsEl = document.getElementById('rekap-pagination-controls');
        if (!tbody) return;

        const totalItems = filteredRekapRows.length;

        if (totalItems === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="17" class="text-center" style="padding: 2.5rem; color: #64748b;">
                        ${allRekapRows.length === 0 ? "No data in this category." : "No matching data found."}
                    </td>
                </tr>
            `;
            if (tfoot) tfoot.innerHTML = '';
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

        const isQuarterlyRekap = (summarySOType === 'quarterly');
        const visibleMonths = isQuarterlyRekap ? [3, 6, 9, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        updateRekapMonthHeaders(visibleMonths, isQuarterlyRekap);

        let html = '';
        pageRows.forEach(row => {
            const monthCells = visibleMonths
                .map(m => `<td class="text-center">${formatPctBadge(row.months ? row.months[m] : null, isPmdCategory)}</td>`)
                .join('');
            html += `
                <tr>
                    <td class="text-left" style="font-weight: 500;">${escapeHtml(row.regional)}</td>
                    <td class="text-left">${escapeHtml(row.dept)}</td>
                    <td class="text-left">${escapeHtml(row.sub_dept)}</td>
                    <td class="text-center font-monospace">${escapeHtml(row.sitecode)}</td>
                    <td class="text-left" style="font-weight: 500;">${escapeHtml(row.name_site)}</td>
                    ${monthCells}
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // Render Footer (Average per month)
        if (tfoot) {
            let footHtml = `
                <tr>
                    <td colspan="5" class="text-left" style="padding: 8px 12px; font-size: 12px; letter-spacing: 0.03em;">
                        AVERAGE TOTAL PHYSICAL % (${totalItems} SITES)
                    </td>
            `;
            const isFiltered = (rekapDeptFilter !== 'all' || rekapSubDeptFilter !== 'all' || Boolean(rekapSearchQuery));
            for (const m of visibleMonths) {
                let avg = null;
                if (isFiltered) {
                    let sum = 0, count = 0;
                    filteredRekapRows.forEach(r => {
                        if (r.months && r.months[m] !== null && r.months[m] !== undefined && r.months[m] !== '') {
                            sum += parseFloat(r.months[m]);
                            count++;
                        }
                    });
                    avg = count > 0 ? (sum / count) : null;
                } else {
                    avg = rekapMonthAverages ? rekapMonthAverages[m] : null;
                }
                footHtml += `<td class="text-center" style="padding: 8px 6px;">${formatPctBadge(avg, isPmdCategory)}</td>`;
            }
            footHtml += '</tr>';
            tfoot.innerHTML = footHtml;
        }

        // Update info text
        if (infoEl) {
            infoEl.textContent = `Showing ${(startIndex + 1).toLocaleString()} to ${endIndex.toLocaleString()} of ${totalItems.toLocaleString()} entries`;
        }

        // Generate pagination controls
        if (controlsEl) {
            let btnsHtml = '';
            btnsHtml += `<button class="pagination-btn" onclick="App.goToRekapPage(1)" ${rekapCurrentPage === 1 ? 'disabled' : ''}>« First</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToRekapPage(${rekapCurrentPage - 1})" ${rekapCurrentPage === 1 ? 'disabled' : ''}>‹ Prev</button>`;

            const maxButtons = 5;
            let startPage = Math.max(1, rekapCurrentPage - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }

            for (let p = startPage; p <= endPage; p++) {
                btnsHtml += `<button class="pagination-btn ${p === rekapCurrentPage ? 'active' : ''}" onclick="App.goToRekapPage(${p})">${p}</button>`;
            }

            btnsHtml += `<button class="pagination-btn" onclick="App.goToRekapPage(${rekapCurrentPage + 1})" ${rekapCurrentPage === totalPages ? 'disabled' : ''}>Next ›</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToRekapPage(${totalPages})" ${rekapCurrentPage === totalPages ? 'disabled' : ''}>Last »</button>`;

            controlsEl.innerHTML = btnsHtml;
        }
    }

    function goToRekapPage(p) {
        const effectiveSize = rekapPageSize > 0 ? rekapPageSize : filteredRekapRows.length;
        const totalPages = Math.ceil(filteredRekapRows.length / effectiveSize) || 1;
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;
        rekapCurrentPage = p;
        renderRekapTable();
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
        return `${Math.round(parseFloat(n))}%`;
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

    async function loadExecutiveNotes(year, month) {
        const y = year || document.getElementById('summary-filter-year')?.value || 2026;
        const m = month || document.getElementById('summary-filter-month')?.value || 9;

        const subtitleEl = document.getElementById('exec-catatan-subtitle');
        const tbody = document.getElementById('exec-catatan-tbody');
        const cardEl = document.getElementById('card-executive-catatan');

        // Always show the Catatan card across all SO Types & categories
        if (cardEl) cardEl.style.display = 'block';

        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const mLabel = m ? (monthNames[parseInt(m, 10)] || `Bulan ${m}`) : 'Semua Bulan';
        const periodStr = `${mLabel} ${y}`;

        if (subtitleEl) subtitleEl.textContent = `Catatan dan evaluasi analisa performa Stock Opname`;

        if (!tbody) return;

        try {
            const queryParams = [];
            if (y) queryParams.push(`year=${encodeURIComponent(y)}`);
            if (m && m !== 'all') queryParams.push(`month=${encodeURIComponent(m)}`);
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
                        // PMD view: show PMD notes, DNO/DSO notes, or notes for all departments
                        return isAllDept || dept === 'PMD' || subDept === 'DNO' || subDept === 'DSO';
                    } else {
                        // Outlet Regional view: show CRO, ERO, WRO, or notes for all departments (exclude specifically PMD-only notes)
                        if (dept === 'PMD' || subDept === 'DNO' || subDept === 'DSO') {
                            return false;
                        }
                        return true;
                    }
                }

                // In Quarterly: all quarterly notes are mapped for the quarterly view
                return true;
            });

            if (mappedNotes.length === 0) {
                const contextName = curSoType === 'quarterly'
                    ? (summaryCategory === 'warehouse_hub' ? 'Warehouse HUB (Quarterly)' : 'Outlet Subarep (Quarterly)')
                    : (summaryCategory === 'pmd' ? 'PMD' : 'Outlet Regional');

                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center" style="padding: 2.2rem 1rem; color: #94a3b8;">
                            <div style="font-size: 12.5px; font-weight: 600; color: #64748b;">
                                Tidak ada catatan ${escapeHtml(contextName)} untuk periode ${escapeHtml(periodStr)}
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            let html = '';
            mappedNotes.forEach((note, idx) => {
                const displayDept = (note.dept && note.dept !== 'Semua Dept' && note.dept !== '(Semua Dept)') ? note.dept : 'Semua Dept';
                const displaySubDept = (note.sub_dept && note.sub_dept !== 'Semua Sub Dept' && note.sub_dept !== '(Semua Sub Dept)') ? note.sub_dept : 'Semua Sub Dept';
                html += `
                    <tr>
                        <td class="text-center" style="color: #64748b; font-weight: 600;">${idx + 1}</td>
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
                    <td colspan="4" class="text-center" style="padding: 2rem; color: #ef4444;">
                        Gagal memuat catatan: ${escapeHtml(err.message || 'Terjadi kesalahan sistem')}
                    </td>
                </tr>
            `;
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
                                <button type="button" class="btn btn-outline-primary btn-sm" onclick="App.editExecutiveNote(${note.id})" title="Edit" style="padding: 2px 6px; font-size: 11px;">
                                    Edit
                                </button>
                                <button type="button" class="btn btn-outline-danger btn-sm" onclick="App.deleteExecutiveNote(${note.id})" title="Hapus" style="padding: 2px 6px; font-size: 11px;">
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
                <button type="button" class="btn btn-outline-danger btn-sm btn-remove-row" onclick="App.removeExecutiveNoteRow(this)" style="font-size: 11px; padding: 2px 6px; line-height: 1;" title="Hapus baris ini">
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
                method: 'DELETE'
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
                    headers: { 'Content-Type': 'application/json' },
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
                    headers: { 'Content-Type': 'application/json' },
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

    // ── Public Interface ───────────────────────────────────────

    return {
        init,
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
        deleteSRRecord,
        toggleSRSelection,
        toggleSelectAllSR,
        bulkDeleteSiteRegional,
        updateSRInfo,
        updateSRGroupType,
        toggleSRActive,
        toggleSRCounted,
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
        // Quick Access & User Dropdown exports
        toggleQuickAccess,
        openQuickAccess,
        closeQuickAccess,
        scrollToCard,
        handleQuickAccessLogin,
        toggleUserDropdown,
        closeUserDropdown,
    };
})();

document.addEventListener('DOMContentLoaded', App.init);

