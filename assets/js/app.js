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
    let rekapLevel2 = 'outlet';  // 'outlet' or 'pmd'
    let allRekapRows = [];
    let filteredRekapRows = [];
    let rekapMonthAverages = {};
    let rekapCurrentPage = 1;
    let rekapPageSize = 10;
    let rekapSearchQuery = '';
    let rekapSortCol = 'regional';
    let rekapSortDir = 'asc';

    // Summary SO Type state (Monthly / Quarterly)
    let summarySOType = 'monthly';
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

        // Restore active page from URL hash or localStorage, default to 'master-data'
        const hashPage = window.location.hash.replace('#', '').trim();
        const savedPage = localStorage.getItem('active_page');
        const allowedPages = ['master-data', 'summary'];

        let initialPage = 'master-data';
        if (allowedPages.includes(hashPage)) {
            initialPage = hashPage;
        } else if (savedPage && allowedPages.includes(savedPage)) {
            initialPage = savedPage;
        }

        navigateTo(initialPage, true);

        // Listen for popstate / hashchange when user uses browser Back/Forward
        window.addEventListener('hashchange', () => {
            const currentHash = window.location.hash.replace('#', '').trim();
            if (allowedPages.includes(currentHash)) {
                navigateTo(currentHash, false);
            }
        });
    }

    // ── Navigation (Master Data vs Summary) ─────────────────────

    function navigateTo(page, updateHash = true) {
        const allowedPages = ['master-data', 'summary'];
        if (!allowedPages.includes(page)) {
            page = 'master-data';
        }

        // Persist page in localStorage
        try {
            localStorage.setItem('active_page', page);
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
        } else if (page === 'summary') {
            loadSummaryData();
            loadRekapitulasi();
        }
    }

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
                        ${allMasterRows.length === 0 ? "No Stock Opname data." : "No Stock Opname data found."}
                    </td>
                </tr>
            `;
            if (infoEl) infoEl.textContent = 'Showing 0 to 0 of 0 entries';
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
                        <button class="btn btn-danger btn-sm btn-delete" onclick="App.deleteRecord(${row.id})" title="Delete this record">
                            Delete
                        </button>
                    </td>
                    <td class="text-left" style="font-weight: 500; max-width: 320px; white-space: normal;">
                        ${escapeHtml(row.profile)}
                    </td>
                    <td class="text-center">${escapeHtml(row.period_start)}</td>
                    <td class="text-center">${escapeHtml(row.period_end)}</td>

                    <!-- RESULT MATCH -->
                    <td class="text-right">${formatNumber(row.match_physic_qty)}</td>
                    <td class="text-right">${parseFloat(row.match_physic_pct).toFixed(2)}%</td>
                    <td class="text-right">${formatNumber(row.match_nbv_value)}</td>
                    <td class="text-right">${parseFloat(row.match_nbv_pct).toFixed(2)}%</td>

                    <!-- RESULT PHYSIC -->
                    <td class="text-right">${formatNumber(row.physic_physic_qty)}</td>
                    <td class="text-right">${parseFloat(row.physic_physic_pct).toFixed(2)}%</td>
                    <td class="text-right">${formatNumber(row.physic_nbv_value)}</td>
                    <td class="text-right">${parseFloat(row.physic_nbv_pct).toFixed(2)}%</td>

                    <!-- RESULT DB -->
                    <td class="text-right">${formatNumber(row.db_physic_qty)}</td>
                    <td class="text-right">${parseFloat(row.db_physic_pct).toFixed(2)}%</td>
                    <td class="text-right">${formatNumber(row.db_nbv_value)}</td>
                    <td class="text-right">${parseFloat(row.db_nbv_pct).toFixed(2)}%</td>

                    <!-- TOTAL -->
                    <td class="text-right" style="font-weight: 600;">${formatNumber(row.total_physic_actual)}</td>
                    <td class="text-right">${formatNumber(row.total_physic_target)}</td>
                    <td class="text-right" style="font-weight: 600;">${parseFloat(row.total_physic_pct).toFixed(2)}%</td>
                    <td class="text-right" style="font-weight: 600;">${formatNumber(row.total_nbv_actual)}</td>
                    <td class="text-right">${formatNumber(row.total_nbv_target)}</td>
                    <td class="text-right" style="font-weight: 600;">${parseFloat(row.total_nbv_pct).toFixed(2)}%</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // Update info text
        if (infoEl) {
            infoEl.textContent = `Showing ${(startIndex + 1).toLocaleString()} to ${endIndex.toLocaleString()} of ${totalItems.toLocaleString()} entries`;
        }

        // Generate pagination buttons
        if (controlsEl) {
            let btnsHtml = '';

            // First & Prev buttons
            btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>« First</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ Prev</button>`;

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
            btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next ›</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>Last »</button>`;

            controlsEl.innerHTML = btnsHtml;
        }
    }

    // ── Delete Record ──────────────────────────────────────────

    async function deleteRecord(id) {
        if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
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
                showToast('success', 'Deleted', json.message || 'Record deleted successfully.');
                // Remove from local data and re-render
                allMasterRows = allMasterRows.filter(r => r.id != id);
                applyFilterAndRender();
            } else {
                showToast('error', 'Delete Failed', json.message || 'Failed to delete record.');
            }
        } catch (err) {
            showToast('error', 'Server Error', 'Failed to connect to the server.');
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
            'quarterly': 'Quarterly',
            'quarterly_outlet': 'Quarterly - Outlet Regional',
            'quarterly_pmd': 'Quarterly - PMD',
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
                <td colspan="7" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    Loading ${escapeHtml(getSRCategoryLabel())} records...
                </td>
            </tr>
        `;

        try {
            const category = getSRCategory();
            const res = await fetch(`api/site_regional.php?category=${category}`);
            const json = await res.json();

            if (!json.success) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center" style="padding: 2rem; color: #dc2626;">
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
                    <td colspan="7" class="text-center" style="padding: 2rem; color: #dc2626;">
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
                const fields = [r.regional, r.dept, r.sub_dept, r.sitecode, r.name_site];
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
                    <td colspan="7" class="text-center" style="padding: 2.5rem; color: #64748b;">
                        ${allSRRows.length === 0 ? `No data ${escapeHtml(getSRCategoryLabel())}.` : "No matching records found."}
                    </td>
                </tr>
            `;
            if (infoEl) infoEl.textContent = 'Showing 0 to 0 of 0 entries';
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
            html += `
                <tr class="${isChecked ? 'row-selected' : ''}">
                    <td class="text-center col-action-select">
                        <input type="checkbox" class="sr-row-checkbox" value="${row.id}" ${isChecked ? 'checked' : ''}
                            onchange="App.toggleSRSelection(${row.id}, this.checked)" title="Select record">
                    </td>
                    <td class="text-center col-action-delete">
                        <button class="btn btn-danger btn-sm btn-delete" onclick="App.deleteSRRecord(${row.id})" title="Delete this record">
                            Delete
                        </button>
                    </td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.regional || '')}</td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.dept || '')}</td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.sub_dept || '')}</td>
                    <td class="text-center" style="white-space: nowrap;">
                        <span class="badge-sitecode">${escapeHtml(row.sitecode || '')}</span>
                    </td>
                    <td class="text-left" style="min-width: 200px;">${escapeHtml(row.name_site || '')}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        updateSRSelectAllCheckbox();
        updateSRBulkDeleteButton();

        if (infoEl) {
            infoEl.textContent = `Showing ${(startIndex + 1).toLocaleString()} to ${endIndex.toLocaleString()} of ${totalItems.toLocaleString()} entries`;
        }

        if (controlsEl) {
            let btnsHtml = '';
            btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(1)" ${srCurrentPage === 1 ? 'disabled' : ''}>« First</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(${srCurrentPage - 1})" ${srCurrentPage === 1 ? 'disabled' : ''}>‹ Prev</button>`;

            const maxButtons = 5;
            let startPage = Math.max(1, srCurrentPage - Math.floor(maxButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
            if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }

            for (let p = startPage; p <= endPage; p++) {
                btnsHtml += `<button class="pagination-btn ${p === srCurrentPage ? 'active' : ''}" onclick="App.goToSRPage(${p})">${p}</button>`;
            }

            btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(${srCurrentPage + 1})" ${srCurrentPage === totalPages ? 'disabled' : ''}>Next ›</button>`;
            btnsHtml += `<button class="pagination-btn" onclick="App.goToSRPage(${totalPages})" ${srCurrentPage === totalPages ? 'disabled' : ''}>Last »</button>`;

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
            showToast('error', 'No Selection', 'Please select at least one record to delete.');
            return;
        }

        const confirmMsg = `Are you sure you want to permanently delete ${ids.length} selected record(s)? This action cannot be undone.`;
        if (!confirm(confirmMsg)) {
            return;
        }

        const bulkBtn = document.getElementById('sr-bulk-delete-btn');
        if (bulkBtn) {
            bulkBtn.disabled = true;
            bulkBtn.textContent = 'Deleting...';
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
                showToast('success', 'Bulk Delete Successful', json.message || `${ids.length} record(s) deleted.`);
                allSRRows = allSRRows.filter(r => !selectedSRIds.has(Number(r.id)));
                selectedSRIds.clear();
                updateSRBulkDeleteButton();
                applySRFilterAndRender();
            } else {
                showToast('error', 'Bulk Delete Failed', json.message || 'Failed to delete selected records.');
            }
        } catch (err) {
            showToast('error', 'Server Error', 'Failed to communicate with the server.');
        } finally {
            if (bulkBtn) {
                bulkBtn.disabled = false;
                updateSRBulkDeleteButton();
            }
        }
    }

    async function deleteSRRecord(id) {
        if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
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
                showToast('success', 'Record Deleted', json.message || 'Record deleted successfully.');
                selectedSRIds.delete(Number(id));
                allSRRows = allSRRows.filter(r => r.id != id);
                applySRFilterAndRender();
                updateSRBulkDeleteButton();
            } else {
                showToast('error', 'Delete Failed', json.message || 'Failed to delete record.');
            }
        } catch (err) {
            showToast('error', 'Server Error', 'Failed to connect to the server.');
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
            if (labelEl) labelEl.textContent = getSRCategoryLabel();

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
            showToast('error', 'Invalid File', 'Only Excel files (.xlsx, .xls) are allowed.');
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
            sheetSelect.innerHTML = '<option value="">Reading sheets from file...</option>';
            sheetSelect.disabled = true;
            if (sheetHint) sheetHint.textContent = 'Please wait while reading worksheet names...';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Reading sheets...';
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
                        ? '1 sheet detected in workbook.'
                        : `${json.sheets.length} sheets found. Select the sheet to import.`;
                }
            } else {
                sheetSelect.innerHTML = '<option value="">Default Sheet</option>';
                sheetSelect.disabled = false;
                if (sheetHint) sheetHint.textContent = json.message || 'Could not list sheets; default sheet will be used.';
            }
        } catch (err) {
            sheetSelect.innerHTML = '<option value="">Default Sheet</option>';
            sheetSelect.disabled = false;
            if (sheetHint) sheetHint.textContent = 'Could not inspect sheets; default sheet will be used.';
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload & Import';
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
            sheetSelect.innerHTML = '<option value="">Select a sheet...</option>';
            sheetSelect.disabled = false;
        }
        if (sheetHint) sheetHint.textContent = '';

        const submitBtn = document.getElementById('sr-modal-import-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload & Import';
        }
    }

    async function submitSRImport() {
        if (!selectedSRFile) {
            showToast('error', 'File Missing', 'Please select or drag & drop an Excel file.');
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
            submitBtn.textContent = 'Uploading...';
        }

        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#eff6ff';
            statusDiv.style.color = '#1d4ed8';
            statusDiv.style.border = '1px solid #bfdbfe';
            statusDiv.textContent = `Uploading and importing ${getSRCategoryLabel()} records...`;
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
                    statusDiv.textContent = json.message || 'Import successful!';
                }

                showToast('success', 'Import Complete', json.message || 'Data imported successfully.');

                loadSiteRegional();

                setTimeout(() => {
                    closeSiteRegionalImportModal();
                }, 1200);
            } else {
                if (statusDiv) {
                    statusDiv.style.background = '#fef2f2';
                    statusDiv.style.color = '#b91c1c';
                    statusDiv.style.border = '1px solid #fecaca';
                    statusDiv.textContent = json.message || 'Import failed.';
                }
                showToast('error', 'Import Failed', json.message || 'Failed to import data.');
            }
        } catch (err) {
            if (statusDiv) {
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = 'Connection error during file upload.';
            }
            showToast('error', 'Server Error', 'Failed to connect to the server.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload & Import';
            }
        }
    }


    // ── Color Helpers for Percentage ───────────────────────────

    function getPctColor(val) {
        if (val === null || val === undefined || isNaN(val)) return '#64748b';
        const num = parseFloat(val);
        if (num >= 85) {
            return '#16a34a'; // Green (above 84%)
        } else if (num >= 75) {
            return '#ea580c'; // Orange (below 85% - 75%)
        } else {
            return '#dc2626'; // Red (below 75%)
        }
    }

    function getPctClass(val) {
        if (val === null || val === undefined || isNaN(val)) return 'pct-none';
        const num = parseFloat(val);
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
        { val: '1', label: 'Januari' },
        { val: '4', label: 'April' },
        { val: '7', label: 'Juli' },
        { val: '10', label: 'Oktober' }
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
            // Find closest quarterly month (1, 4, 7, 10)
            const num = parseInt(currentVal, 10) || 1;
            let qMonth = '1';
            if (num >= 10) qMonth = '10';
            else if (num >= 7) qMonth = '7';
            else if (num >= 4) qMonth = '4';
            monthSelect.value = qMonth;
        }
    }

    function switchSOType(type) {
        summarySOType = type;

        const btnMonthly = document.getElementById('btn-so-type-monthly');
        const btnQuarterly = document.getElementById('btn-so-type-quarterly');
        const statusText = document.getElementById('summary-so-type-status');

        if (btnMonthly && btnQuarterly) {
            btnMonthly.classList.toggle('active', type === 'monthly');
            btnQuarterly.classList.toggle('active', type === 'quarterly');
        }

        if (statusText) {
            statusText.innerHTML = `<strong style="color: #2563eb;">${type === 'monthly' ? 'Monthly' : 'Quarterly'}</strong> Stock Opname Summary`;
        }

        // Update BULAN dropdown based on SO Type (Monthly = 12 months, Quarterly = per 3 months)
        updateSummaryMonthDropdown();

        // Toggle Rekapitulasi sub-tabs (Outlet Regional / PMD only apply to Monthly)
        const rekapSubTabs = document.getElementById('rekap-tabs-level2');
        if (rekapSubTabs) {
            rekapSubTabs.style.display = (type === 'monthly') ? 'flex' : 'none';
        }

        const rekapSubtitle = document.querySelector('#card-rekapitulasi .card-subtitle');
        if (rekapSubtitle) {
            rekapSubtitle.textContent = type === 'monthly'
                ? 'Monthly Stock Opname'
                : 'Quarterly Stock Opname';
        }

        // Update Trend Chart Subtitles
        document.querySelectorAll('.trend-chart-subtitle').forEach(el => {
            el.textContent = (type === 'monthly')
                ? 'Monthly Physical % (Jan - Dec 2026)'
                : 'Quarterly Physical % (Q1 - Q4 2026)';
        });

        loadSummaryData();
        loadRekapitulasi();
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

        // On first initial page load, if not initialized yet, fetch the latest period first
        if (!summaryInitialized) {
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

        const month = monthSelect ? monthSelect.value : '';
        const year = yearSelect ? yearSelect.value : '';

        // Update achievement card helper
        const updateAchCard = (valId, subId, trendId, statusId, item, defaultLabel) => {
            const pct = item && item.pct !== null && item.pct !== undefined ? parseFloat(item.pct) : 0;
            const count = item?.count || 0;
            const total = item?.total_sites || 0;
            const color = total === 0 ? '#94a3b8' : getPctColor(pct);

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
                } else if (pct >= 85.0) {
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
                    const isAbove = (pct >= 85.0);
                    const diff = pct - 85.0;
                    const diffVal = Number(diff.toFixed(2));
                    const formattedDiff = (diffVal >= 0 ? '+' : '') + (diffVal % 1 === 0 ? diffVal.toFixed(0) : diffVal.toFixed(2)) + '%';

                    // Solid triangle style: up (green) if >= 85%, down (red) if < 85%
                    const triangleSvg = isAbove
                        ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"/></svg>`
                        : `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"/></svg>`;

                    trendEl.innerHTML = `
                        <span class="kpi-target-indicator ${isAbove ? 'target-up' : 'target-down'}" title="Target: 85% (Gap: ${formattedDiff})">
                            ${triangleSvg}
                            <span>${formattedDiff}</span>
                        </span>
                    `;
                }
            }
        };

        try {
            const params = new URLSearchParams({ action: 'summary', so_type: summarySOType });
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

            const nat = ach.national || {};
            const cro = ach.cro || {};
            const ero = ach.ero || {};
            const wro = ach.wro || {};
            const pmd = ach.pmd || {};

            updateAchCard('kpi-national-achievement', 'kpi-national-subtext', 'kpi-national-trend', 'kpi-national-status', nat, 'Outlet Regional & PMD');
            updateAchCard('kpi-cro-achievement', 'kpi-cro-subtext', 'kpi-cro-trend', 'kpi-cro-status', cro, 'Avg DEPT CRO');
            updateAchCard('kpi-ero-achievement', 'kpi-ero-subtext', 'kpi-ero-trend', 'kpi-ero-status', ero, 'Avg DEPT ERO');
            updateAchCard('kpi-wro-achievement', 'kpi-wro-subtext', 'kpi-wro-trend', 'kpi-wro-status', wro, 'Avg DEPT WRO');
            updateAchCard('kpi-pmd-achievement', 'kpi-pmd-subtext', 'kpi-pmd-trend', 'kpi-pmd-status', pmd, 'Avg DEPT PMD');

            // Load Trend Line Graphics (DEPT, Sub DEPT, PMD Sub DEPT)
            loadTrendCharts(year);

            // Load Chart Hasil SO Outlet Regional
            loadSubDeptResults();

        } catch (err) {
            console.error('Error loading summary totals:', err);
        }
    }

    // ── Chart Hasil SO Outlet Regional ──────────────────────────

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
            for (const [deptKey, list] of Object.entries(DEPT_SUBDEPTS_MAP)) {
                html += `<optgroup label="${deptKey}">`;
                list.forEach(code => {
                    const isSelected = (code === previousSub);
                    html += `<option value="${code}" ${isSelected ? 'selected' : ''}>${code}</option>`;
                });
                html += `</optgroup>`;
            }
            subDeptSelect.innerHTML = html;
        } else if (DEPT_SUBDEPTS_MAP[dept]) {
            const list = DEPT_SUBDEPTS_MAP[dept];
            let html = `<option value="all">Semua Sub Dept (${dept})</option>`;
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
        const monthSelect = document.getElementById('summary-filter-month');
        const yearSelect = document.getElementById('summary-filter-year');
        const tbody = document.getElementById('subdept-results-tbody');
        const tfoot = document.getElementById('subdept-results-tfoot');

        if (!tbody) return;

        if (summarySOType === 'quarterly') {
            const periodBadge = document.getElementById('subdept-period-badge');
            if (periodBadge) {
                const year = yearSelect ? yearSelect.value : '2026';
                periodBadge.textContent = `Quarterly ${year}`;
            }
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2.5rem; color: #64748b;">
                        Tidak ada data outlet untuk Quarterly.
                    </td>
                </tr>
            `;
            if (tfoot) tfoot.innerHTML = '';
            const pieSubtitle = document.getElementById('subdept-pie-subtitle');
            if (pieSubtitle) {
                pieSubtitle.textContent = 'Quarterly (0 Sites)';
            }
            renderSubDeptPieChart(0, 0, 0);
            return;
        }

        const dept = deptSelect ? deptSelect.value : 'all';
        const subDept = subDeptSelect ? subDeptSelect.value : 'CJDO';
        const month = monthSelect ? monthSelect.value : '9';
        const year = yearSelect ? yearSelect.value : '2026';

        // Update period badge next to title
        const periodBadge = document.getElementById('subdept-period-badge');
        if (periodBadge) {
            const monthText = monthSelect && monthSelect.selectedIndex >= 0 && monthSelect.options[monthSelect.selectedIndex]
                ? monthSelect.options[monthSelect.selectedIndex].text
                : (month ? `Bulan ${month}` : 'Semua Bulan');
            periodBadge.textContent = `${monthText} ${year}`;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
                    <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
                        <span class="spinner" style="width: 16px; height: 16px;"></span>
                        <span>Memuat Hasil SO Outlet Regional...</span>
                    </div>
                </td>
            </tr>
        `;
        if (tfoot) tfoot.innerHTML = '';

        try {
            const params = new URLSearchParams({
                action: 'subdept_results',
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

            // Update Pie Card Subtitle
            const pieSubtitle = document.getElementById('subdept-pie-subtitle');
            if (pieSubtitle) {
                let label = '';
                if (dept === 'all' && subDept === 'all') {
                    label = 'Semua DEPT';
                } else if (subDept === 'all') {
                    label = `${dept} (Semua Sub Dept)`;
                } else {
                    label = dept !== 'all' ? `${dept} - ${subDept}` : subDept;
                }
                pieSubtitle.textContent = `${label} (${rows.length} Sites)`;
            }

            let countTercapai = 0;
            let countTidakTercapai = 0;

            let html = '';
            rows.forEach((r) => {
                const sitecode = escapeHtml(r.sitecode || '-');
                const nameSite = escapeHtml(r.name_site || '-');
                const matchQty = Number(r.match_physic_qty || 0).toLocaleString();
                const physicQty = Number(r.physic_physic_qty || 0).toLocaleString();
                const dbQty = Number(r.db_physic_qty || 0).toLocaleString();

                let pctDisplay = '-';
                let statusHtml = '<span class="so-status-badge status-none">Belum Ada Data</span>';

                if (r.has_data && r.total_physic_pct !== null && r.total_physic_pct !== undefined) {
                    const pct = parseFloat(r.total_physic_pct);
                    pctDisplay = `${pct.toFixed(2)}%`;

                    let statusText = 'Tidak Tercapai';
                    let statusClass = 'status-red';
                    let progressClass = 'so-progress-red';
                    let color = '#dc2626';

                    if (pct >= 85.0) {
                        statusText = 'Tercapai';
                        statusClass = 'status-green';
                        progressClass = 'so-progress-green';
                        color = '#16a34a';
                        countTercapai++;
                    } else if (pct >= 75.0) {
                        statusText = 'Tidak Tercapai';
                        statusClass = 'status-orange';
                        progressClass = 'so-progress-orange';
                        color = '#ea580c';
                        countTidakTercapai++;
                    } else {
                        statusText = 'Tidak Tercapai';
                        statusClass = 'status-red';
                        progressClass = 'so-progress-red';
                        color = '#dc2626';
                        countTidakTercapai++;
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
                } else {
                    countTidakTercapai++;
                }

                html += `
                    <tr>
                        <td style="text-align: center; font-weight: 600; color: #1e293b;">${sitecode}</td>
                        <td style="text-align: center; font-weight: 500; color: #334155;">${nameSite}</td>
                        <td style="text-align: right; font-weight: 600; color: #0f172a;">${matchQty}</td>
                        <td style="text-align: right; font-weight: 600; color: #0f172a;">${physicQty}</td>
                        <td style="text-align: right; font-weight: 600; color: #0f172a;">${dbQty}</td>
                        <td style="text-align: center; font-weight: 700; color: ${r.status_class === 'green' ? '#16a34a' : (r.status_class === 'orange' ? '#ea580c' : (r.status_class === 'red' ? '#dc2626' : '#64748b'))};">
                            ${pctDisplay}
                        </td>
                        <td>${statusHtml}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;

            // Render Footer with Totals & Average
            if (tfoot) {
                const totalMatch = Number(json.total_match_qty || 0).toLocaleString();
                const totalPhysic = Number(json.total_physic_qty || 0).toLocaleString();
                const totalDb = Number(json.total_db_qty || 0).toLocaleString();
                const avgPct = parseFloat(json.avg_pct || 0);
                const avgDisplay = `${avgPct.toFixed(2)}%`;

                let overallText = 'Belum Ada Data';
                let overallStatusClass = 'status-none';
                let overallProgressClass = '';
                let overallColor = '#64748b';

                if (json.count_with_data > 0) {
                    if (avgPct >= 85.0) {
                        overallText = 'Tercapai';
                        overallStatusClass = 'status-green';
                        overallProgressClass = 'so-progress-green';
                        overallColor = '#16a34a';
                    } else if (avgPct >= 75.0) {
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

                const clampedAvg = Math.min(Math.max(avgPct, 0), 100);

                const overallStatusHtml = json.count_with_data > 0 ? `
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

                tfoot.innerHTML = `
                    <tr style="background: #f8fafc; border-top: 2px solid #cbd5e1;">
                        <td colspan="2" style="padding: 0.85rem 1rem; color: #1e293b;">
                            Total (${json.total_sites} Sites)
                        </td>
                        <td style="text-align: right; padding: 0.85rem 1rem; color: #0f172a; font-size: 13.5px;">${totalMatch}</td>
                        <td style="text-align: right; padding: 0.85rem 1rem; color: #0f172a; font-size: 13.5px;">${totalPhysic}</td>
                        <td style="text-align: right; padding: 0.85rem 1rem; color: #0f172a; font-size: 13.5px;">${totalDb}</td>
                        <td style="text-align: center; padding: 0.85rem 1rem; font-size: 13.5px; color: ${overallColor}; font-weight: 800;">
                            ${json.count_with_data > 0 ? avgDisplay : '-'}
                        </td>
                        <td style="padding: 0.85rem 1rem;">${overallStatusHtml}</td>
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
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: {
                                family: "'Poppins', sans-serif",
                                size: 11,
                                weight: '500'
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = context.raw || 0;
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                return ` ${context.label}: ${val} Outlet (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '62%'
            }
        });

        if (statsContainer) {
            const pctTercapai = total > 0 ? ((tercapai / total) * 100).toFixed(1) : '0.0';
            const pctTidak = total > 0 ? ((tidakTercapai / total) * 100).toFixed(1) : '0.0';

            let statsHtml = `
                <div class="so-pie-stat-row">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #16a34a;"></span>
                        Tercapai (≥85%)
                    </span>
                    <span class="so-pie-stat-val" style="color: #16a34a;">
                        ${tercapai} <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTercapai}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #dc2626;"></span>
                        Tidak Tercapai (<85%)
                    </span>
                    <span class="so-pie-stat-val" style="color: #dc2626;">
                        ${tidakTercapai} <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTidak}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row" style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                    <span class="so-pie-stat-label" style="font-weight: 600; color: #1e293b;">
                        Total Sites
                    </span>
                    <span class="so-pie-stat-val" style="font-weight: 700; color: #0f172a;">${total} Sites</span>
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

        Chart.defaults.font.family = "'Poppins', sans-serif";

        const deptCanvas = document.getElementById('chart-trend-dept');
        const subDeptCanvas = document.getElementById('chart-trend-subdept');
        const pmdCanvas = document.getElementById('chart-trend-pmd');

        if (!deptCanvas || !subDeptCanvas || !pmdCanvas) return;

        if (summarySOType === 'quarterly') {
            if (chartTrendDept) { chartTrendDept.destroy(); chartTrendDept = null; }
            if (chartTrendSubDept) { chartTrendSubDept.destroy(); chartTrendSubDept = null; }
            if (chartTrendPmd) { chartTrendPmd.destroy(); chartTrendPmd = null; }

            const emptyChartConfig = () => ({
                type: 'line',
                data: {
                    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10, weight: '500' } } },
                        y: { min: 0, max: 100, ticks: { callback: val => val + '%', font: { size: 10 } }, grid: { color: '#f1f5f9' } }
                    }
                }
            });

            chartTrendDept = new Chart(deptCanvas.getContext('2d'), emptyChartConfig());
            chartTrendSubDept = new Chart(subDeptCanvas.getContext('2d'), emptyChartConfig());
            chartTrendPmd = new Chart(pmdCanvas.getContext('2d'), emptyChartConfig());
            return;
        }

        const targetYear = year || (document.getElementById('summary-filter-year')?.value) || 2026;

        try {
            const res = await fetch(`api/rekapitulasi.php?action=trends&year=${targetYear}`);
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

            // Custom Legend onClick for Line Charts: Highlight line without moving or shifting legend positions
            const onLegendClick = (e, legendItem, legend) => {
                const chart = legend.chart;
                const clickedIndex = legendItem.datasetIndex;
                const currentHighlighted = chart._highlightedIndex !== undefined ? chart._highlightedIndex : null;

                if (currentHighlighted === clickedIndex) {
                    // Clicking the active line resets back to all lines visible equally
                    chart._highlightedIndex = null;
                    chart.data.datasets.forEach((ds) => {
                        ds.borderColor = ds._origBorderColor || ds.borderColor;
                        ds.backgroundColor = ds._origBackgroundColor || ds.backgroundColor;
                        ds.borderWidth = ds._origBorderWidth || 2.5;
                        ds.pointRadius = ds._origPointRadius || 3.5;
                        ds.pointHoverRadius = ds._origPointHoverRadius || 6;
                    });
                } else {
                    // Highlight the clicked line, dim the others for comparison (order remains unchanged!)
                    chart._highlightedIndex = clickedIndex;
                    chart.data.datasets.forEach((ds, idx) => {
                        const isTarget = (idx === clickedIndex);
                        const origColor = ds._origBorderColor || ds.borderColor;

                        if (isTarget) {
                            ds.borderColor = origColor;
                            ds.backgroundColor = origColor;
                            ds.borderWidth = 3.6;
                            ds.pointRadius = 5;
                            ds.pointHoverRadius = 7;
                        } else {
                            const dimColor = hexToRgba(origColor, 0.16);
                            ds.borderColor = dimColor;
                            ds.backgroundColor = dimColor;
                            ds.borderWidth = 1.4;
                            ds.pointRadius = 0;
                            ds.pointHoverRadius = 3;
                        }
                    });
                }

                chart.update();
            };

            // Common Chart Options Builder
            const createChartConfig = (datasets) => ({
                type: 'line',
                data: {
                    labels: months,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            onClick: onLegendClick,
                            onHover: (e, legendItem, legend) => {
                                legend.chart.canvas.style.cursor = 'pointer';
                            },
                            onLeave: (e, legendItem, legend) => {
                                legend.chart.canvas.style.cursor = 'default';
                            },
                            labels: {
                                boxWidth: 9,
                                boxHeight: 9,
                                usePointStyle: true,
                                padding: 8,
                                font: { size: 10, weight: '600' },
                                generateLabels: function (chart) {
                                    const defaultLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                    // Strictly sort by datasetIndex to ensure legend items NEVER shift or change position!
                                    defaultLabels.sort((a, b) => a.datasetIndex - b.datasetIndex);

                                    const highlighted = chart._highlightedIndex;
                                    defaultLabels.forEach((item) => {
                                        item.hidden = false; // Never hide or strike through
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
                                        label += context.parsed.y.toFixed(2) + '%';
                                    } else {
                                        label += '-';
                                    }
                                    if (highlighted !== null && highlighted !== undefined && context.datasetIndex === highlighted) {
                                        label = '● ' + label + ' (Focused)';
                                    }
                                    return label;
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
                            suggestedMax: 100,
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
                }
            });

            // 1. Render Card 1: DEPT Trends
            const deptColors = {
                'CRO': '#f59e0b',      // Amber
                'ERO': '#3b82f6',      // Blue
                'WRO': '#10b981',      // Emerald
                'PMD': '#8b5cf6',      // Purple
            };

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
            chartTrendDept = new Chart(deptCanvas.getContext('2d'), createChartConfig(deptDatasets));

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
                    _origPointRadius: 3,
                    _origPointHoverRadius: 5,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    spanGaps: true
                });
            });

            if (chartTrendSubDept) chartTrendSubDept.destroy();
            chartTrendSubDept = new Chart(subDeptCanvas.getContext('2d'), createChartConfig(subDeptDatasets));

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
            chartTrendPmd = new Chart(pmdCanvas.getContext('2d'), createChartConfig(pmdDatasets));

        } catch (err) {
            console.error('Error rendering trend charts:', err);
        }
    }

    // ── Rekapitulasi 2026 Section ────────────────────────────────

    function getRekapCategory() {
        if (summarySOType === 'quarterly') {
            return 'quarterly';
        }
        return `monthly_${rekapLevel2}`;
    }

    function switchRekapLevel1(level) {
        // Kept for backward compatibility
        rekapLevel1 = 'monthly';
        loadRekapitulasi();
    }

    function switchRekapLevel2(level) {
        rekapLevel2 = level;
        document.querySelectorAll('.rekap-tab-l2').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-rekap-l2') === level);
        });

        rekapSearchQuery = '';
        const searchInput = document.getElementById('rekap-search-input');
        if (searchInput) searchInput.value = '';
        rekapCurrentPage = 1;
        loadRekapitulasi();
    }

    async function loadRekapitulasi() {
        const tbody = document.getElementById('rekap-table-body');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="17" class="text-center" style="padding: 2.5rem; color: #64748b;">
                    Loading Rekapitulasi 2026 records...
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


    function formatPctBadge(val) {
        if (val === null || val === undefined) {
            return '<span class="pct-none">-</span>';
        }
        const num = parseFloat(val);
        const cls = getPctClass(num);
        return `<span class="pct-badge ${cls}">${num.toFixed(2)}%</span>`;
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

        const effectiveSize = rekapPageSize > 0 ? rekapPageSize : totalItems;
        const totalPages = Math.ceil(totalItems / effectiveSize) || 1;
        if (rekapCurrentPage > totalPages) rekapCurrentPage = totalPages;

        const startIndex = (rekapCurrentPage - 1) * effectiveSize;
        const endIndex = Math.min(startIndex + effectiveSize, totalItems);
        const pageRows = filteredRekapRows.slice(startIndex, endIndex);

        let html = '';
        pageRows.forEach(row => {
            html += `
                <tr>
                    <td class="text-left" style="font-weight: 500;">${escapeHtml(row.regional)}</td>
                    <td class="text-left">${escapeHtml(row.dept)}</td>
                    <td class="text-left">${escapeHtml(row.sub_dept)}</td>
                    <td class="text-center"><span class="badge-sitecode">${escapeHtml(row.sitecode)}</span></td>
                    <td class="text-left" style="font-weight: 500;">${escapeHtml(row.name_site)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[1] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[2] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[3] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[4] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[5] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[6] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[7] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[8] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[9] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[10] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[11] : null)}</td>
                    <td class="text-center">${formatPctBadge(row.months ? row.months[12] : null)}</td>
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
            for (let m = 1; m <= 12; m++) {
                const avg = rekapMonthAverages ? rekapMonthAverages[m] : null;
                footHtml += `<td class="text-center" style="padding: 8px 6px;">${formatPctBadge(avg)}</td>`;
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
            showToast('error', 'Invalid File', 'Only Excel files (.xlsx, .xls) are allowed.');
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
            sheetSelect.innerHTML = '<option value="">Reading sheets from file...</option>';
            sheetSelect.disabled = true;
            if (sheetHint) sheetHint.textContent = 'Please wait while reading worksheet names...';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Reading sheets...';
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
                        ? '1 sheet detected in workbook.'
                        : `${json.sheets.length} sheets found. Select the sheet to import.`;
                }
            } else {
                sheetSelect.innerHTML = '<option value="">Default Sheet</option>';
                sheetSelect.disabled = false;
                if (sheetHint) sheetHint.textContent = json.message || 'Could not list sheets; default sheet will be used.';
            }
        } catch (err) {
            sheetSelect.innerHTML = '<option value="">Default Sheet</option>';
            sheetSelect.disabled = false;
            if (sheetHint) sheetHint.textContent = 'Could not inspect sheets; default sheet will be used.';
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload & Import';
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
            sheetSelect.innerHTML = '<option value="">Select a sheet...</option>';
            sheetSelect.disabled = false;
        }
        if (sheetHint) sheetHint.textContent = '';

        const submitBtn = document.getElementById('modal-upload-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload & Import';
        }
    }

    async function submitImport() {
        if (!selectedFile) {
            showToast('error', 'File Missing', 'Please select or drag & drop an Excel file.');
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
        submitBtn.textContent = 'Uploading...';

        statusDiv.style.display = 'block';
        statusDiv.style.background = '#eff6ff';
        statusDiv.style.color = '#1d4ed8';
        statusDiv.style.border = '1px solid #bfdbfe';
        statusDiv.textContent = 'Uploading and processing Excel records...';

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
                statusDiv.textContent = 'Server error: ' + (rawText.replace(/<[^>]*>?/gm, '').trim().substring(0, 150) || 'Invalid server response');
                showToast('error', 'Server Error', 'Invalid server response received.');
                return;
            }

            if (json.success) {
                statusDiv.style.background = '#f0fdf4';
                statusDiv.style.color = '#15803d';
                statusDiv.style.border = '1px solid #bbf7d0';
                statusDiv.textContent = json.message || 'Import successful!';

                showToast('success', 'Import Complete', json.message || 'Data imported successfully.');

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
                statusDiv.textContent = json.message || 'Import failed.';
                showToast('error', 'Import Failed', json.message || 'Failed to import file.');
            }
        } catch (err) {
            console.error('Upload fetch error:', err);
            statusDiv.style.background = '#fef2f2';
            statusDiv.style.color = '#b91c1c';
            statusDiv.style.border = '1px solid #fecaca';
            statusDiv.textContent = 'Connection error: ' + (err.message || 'Failed to connect');
            showToast('error', 'Server Error', err.message || 'Failed to connect to the server.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload & Import';
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
        openSiteRegionalImportModal,
        closeSiteRegionalImportModal,
        handleSRFileSelect,
        clearSRSelectedFile,
        submitSRImport,
        // Rekapitulasi exports
        loadRekapitulasi,
        loadTrendCharts,
        loadSubDeptResults,
        onDeptResultFilterChange,
        switchSOType,
        switchRekapLevel1,
        switchRekapLevel2,
        changeRekapPageSize,
        goToRekapPage,
        handleRekapSearch,
        toggleRekapSort,
    };
})();

document.addEventListener('DOMContentLoaded', App.init);

