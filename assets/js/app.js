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
            switchSummaryCategory(summaryCategory || 'pmd');
            loadSummaryData();
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
                    <td colspan="10" class="text-center" style="padding: 2.5rem; color: #64748b;">
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
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.regional || '')}</td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.dept || '')}</td>
                    <td class="text-left" style="white-space: nowrap;">${escapeHtml(row.sub_dept || '')}</td>
                    <td class="text-center" style="white-space: nowrap;">
                        <span class="badge-sitecode">${escapeHtml(row.sitecode || '')}</span>
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

    function switchSOType(type) {
        summarySOType = type;

        const btnMonthly = document.getElementById('btn-so-type-monthly');
        const btnQuarterly = document.getElementById('btn-so-type-quarterly');
        const statusText = document.getElementById('summary-so-type-status');

        if (btnMonthly && btnQuarterly) {
            btnMonthly.classList.toggle('active', type === 'monthly');
            btnQuarterly.classList.toggle('active', type === 'quarterly');
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
        const curYear = document.getElementById('summary-filter-year')?.value || 2026;
        document.querySelectorAll('.trend-chart-subtitle').forEach(el => {
            el.textContent = (type === 'monthly')
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

        if (type === 'quarterly') {
            if (catSliderMonthly) catSliderMonthly.style.display = 'none';
            if (catSliderQuarterly) catSliderQuarterly.style.display = 'inline-flex';
            switchSummaryCategory('outlet_subarep');
        } else {
            if (catSliderMonthly) catSliderMonthly.style.display = 'inline-flex';
            if (catSliderQuarterly) catSliderQuarterly.style.display = 'none';
            switchSummaryCategory('pmd');
        }

        loadSummaryData();
        loadRekapitulasi();
    }

    function switchSummaryCategory(cat) {
        summaryCategory = cat;

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

        // Toggle KPI cards
        const isQuarterly = (summarySOType === 'quarterly');
        const outletKpiCards = isQuarterly
            ? ['kpi-card-national', 'kpi-card-wro', 'kpi-card-ero']
            : ['kpi-card-national', 'kpi-card-wro', 'kpi-card-cro', 'kpi-card-ero'];
        const pmdKpiCards = ['kpi-card-pmd', 'kpi-card-dno', 'kpi-card-dso'];

        // In quarterly summary, ensure CRO card is completely hidden
        const croCard = document.getElementById('kpi-card-cro');
        if (croCard && isQuarterly) {
            croCard.style.display = 'none';
        }

        const showOutletKpis = (cat === 'outlet' || cat === 'outlet_subarep' || cat === 'warehouse_hub');

        outletKpiCards.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = showOutletKpis ? 'flex' : 'none';
        });

        pmdKpiCards.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (cat === 'pmd') ? 'flex' : 'none';
        });

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

        loadRekapitulasi();
        loadSubDeptResults();

        const yearSelect = document.getElementById('summary-filter-year');
        loadTrendCharts(yearSelect ? yearSelect.value : 2026);
    }

    function updateHasilSOCardUI() {
        const titleEl = document.getElementById('hasil-so-title');
        const subtitleEl = document.getElementById('hasil-so-subtitle');
        const deptFilterContainer = document.getElementById('dept-result-filter-container');
        const deptSelect = document.getElementById('dept-result-filter');
        const subDeptSelect = document.getElementById('subdept-result-filter');

        if (summaryCategory === 'pmd') {
            if (titleEl) titleEl.textContent = 'Chart Hasil SO PMD';
            if (subtitleEl) subtitleEl.textContent = 'Pencapaian dan Hasil Stock Opname PMD';
            if (deptFilterContainer) deptFilterContainer.style.display = 'none';

            if (subDeptSelect) {
                subDeptSelect.innerHTML = `
                    <option value="all" selected>Semua Sub Dept (PMD)</option>
                    <option value="DNO">DNO</option>
                    <option value="DSO">DSO</option>
                `;
            }
        } else {
            if (titleEl) titleEl.textContent = (summarySOType === 'quarterly')
                ? 'Chart Hasil SO Outlet Regional (Quarterly)'
                : 'Chart Hasil SO Outlet Regional';
            if (subtitleEl) subtitleEl.textContent = (summarySOType === 'quarterly')
                ? 'Pencapaian dan Hasil Stock Opname Outlet Regional Quarterly'
                : 'Pencapaian dan Hasil Stock Opname Outlet Regional';
            if (deptFilterContainer) deptFilterContainer.style.display = 'flex';

            if (deptSelect) {
                if (summarySOType === 'quarterly') {
                    deptSelect.innerHTML = `
                        <option value="all" selected>Semua DEPT (Outlet Regional)</option>
                        <option value="ERO">ERO</option>
                        <option value="WRO">WRO</option>
                    `;
                    deptSelect.value = 'all';
                } else {
                    const defaultDept = 'CRO';
                    deptSelect.innerHTML = `
                        <option value="all">Semua DEPT (Outlet Regional)</option>
                        <option value="CRO" selected>CRO</option>
                        <option value="ERO">ERO</option>
                        <option value="WRO">WRO</option>
                    `;
                    deptSelect.value = defaultDept;
                }
            }

            if (subDeptSelect) {
                if (summarySOType === 'quarterly') {
                    subDeptSelect.innerHTML = '<option value="all" selected>Semua Sub Dept</option>';
                } else {
                    const list = DEPT_SUBDEPTS_MAP['CRO'] || [];
                    let html = '<option value="all">Semua Sub Dept (CRO)</option>';
                    list.forEach((code, idx) => {
                        html += `<option value="${code}" ${idx === 0 ? 'selected' : ''}>${code}</option>`;
                    });
                    subDeptSelect.innerHTML = html;
                }
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

            const nat = ach.outlet_national || ach.national || {};
            const cro = ach.cro || {};
            const ero = ach.ero || {};
            const wro = ach.wro || {};
            const pmd = ach.pmd || {};
            const dno = ach.dno || {};
            const dso = ach.dso || {};

            updateAchCard('kpi-national-achievement', 'kpi-national-subtext', 'kpi-national-trend', 'kpi-national-status', nat, 'Avg Outlet Regional', false);
            updateAchCard('kpi-cro-achievement', 'kpi-cro-subtext', 'kpi-cro-trend', 'kpi-cro-status', cro, 'Avg DEPT CRO', false);
            updateAchCard('kpi-ero-achievement', 'kpi-ero-subtext', 'kpi-ero-trend', 'kpi-ero-status', ero, 'Avg DEPT ERO', false);
            updateAchCard('kpi-wro-achievement', 'kpi-wro-subtext', 'kpi-wro-trend', 'kpi-wro-status', wro, 'Avg DEPT WRO', false);
            updateAchCard('kpi-pmd-achievement', 'kpi-pmd-subtext', 'kpi-pmd-trend', 'kpi-pmd-status', pmd, 'Avg PMD Departement', true);
            updateAchCard('kpi-dno-achievement', 'kpi-dno-subtext', 'kpi-dno-trend', 'kpi-dno-status', dno, 'Avg Sub DEPT DNO', true);
            updateAchCard('kpi-dso-achievement', 'kpi-dso-subtext', 'kpi-dso-trend', 'kpi-dso-status', dso, 'Avg Sub DEPT DSO', true);

            // Load Trend Line Graphics (DEPT, Sub DEPT, PMD Sub DEPT)
            loadTrendCharts(year);

            // Load Chart Hasil SO Outlet Regional / PMD
            loadSubDeptResults();

            // Reload Rekapitulasi for the selected year
            loadRekapitulasi();

            // Load Site Movement History & Comparison Logs
            loadSiteMovements(year, month);

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

            // 3. Render Table
            renderMovementsTable();

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

        if (infoEl) {
            infoEl.textContent = `Menampilkan ${filteredMovementsData.length} dari ${allMovementsData.length} perubahan`;
        }

        if (filteredMovementsData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2.25rem 1rem; color: #64748b;">
                        <div style="font-weight: 700; color: #334155; font-size: 13.5px;">
                            ${allMovementsData.length === 0 ? `No data ${escapeHtml(monthText)} ${curYear}` : 'No data.'}
                        </div>
                        ${allMovementsData.length === 0 && monthSelect && monthSelect.value ? `
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
                    <td style="text-align: center; white-space: nowrap; padding: 8px 10px;">
                        <span class="badge-sitecode" style="font-weight: 700;">${escapeHtml(m.sitecode)}</span>
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
                return (m.sitecode && m.sitecode.toLowerCase().includes(query)) ||
                    (m.name_site && m.name_site.toLowerCase().includes(query)) ||
                    (m.regional && m.regional.toLowerCase().includes(query)) ||
                    (m.dept && m.dept.toLowerCase().includes(query)) ||
                    (m.sub_dept && m.sub_dept.toLowerCase().includes(query)) ||
                    (m.notes && m.notes.toLowerCase().includes(query)) ||
                    (m.effective_period && m.effective_period.toLowerCase().includes(query));
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

        const currentCategory = summaryCategory;
        const dept = (currentCategory === 'pmd') ? 'PMD' : (deptSelect ? deptSelect.value : 'all');
        const subDept = subDeptSelect ? subDeptSelect.value : (currentCategory === 'pmd' ? 'all' : (summarySOType === 'quarterly' ? 'all' : 'CJDO'));
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

            // Update Pie Card Subtitle
            const pieSubtitle = document.getElementById('subdept-pie-subtitle');
            if (pieSubtitle) {
                let label = '';
                if (currentCategory === 'pmd') {
                    label = (subDept === 'all') ? 'PMD (Semua Sub Dept)' : `PMD - ${subDept}`;
                } else {
                    if (dept === 'all' && subDept === 'all') {
                        label = 'Semua DEPT (Outlet Regional)';
                    } else if (subDept === 'all') {
                        label = `${dept} (Semua Sub Dept)`;
                    } else {
                        label = dept !== 'all' ? `${dept} - ${subDept}` : subDept;
                    }
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
                            countTercapai++;
                        } else {
                            statusText = 'Tidak Tercapai';
                            statusClass = 'status-red';
                            progressClass = 'so-progress-red';
                            color = '#dc2626';
                            countTidakTercapai++;
                        }
                    } else {
                        if (pct >= 85) {
                            statusText = 'Tercapai';
                            statusClass = 'status-green';
                            progressClass = 'so-progress-green';
                            color = '#16a34a';
                            countTercapai++;
                        } else if (pct >= 75) {
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

                const cellColor = r.has_data ? (isPmdMode ? (pctDisplay !== '-' && parseInt(pctDisplay) >= 98 ? '#16a34a' : '#dc2626') : (pctDisplay !== '-' && parseInt(pctDisplay) >= 85 ? '#16a34a' : (pctDisplay !== '-' && parseInt(pctDisplay) >= 75 ? '#ea580c' : '#dc2626'))) : '#64748b';

                html += `
                    <tr>
                        <td style="text-align: center; font-weight: 600; color: #1e293b;">${sitecode}</td>
                        <td style="text-align: center; font-weight: 500; color: #334155;">${nameSite}</td>
                        <td style="text-align: right; font-weight: 600; color: #0f172a;">${matchQty}</td>
                        <td style="text-align: right; font-weight: 600; color: #0f172a;">${physicQty}</td>
                        <td style="text-align: right; font-weight: 600; color: #0f172a;">${dbQty}</td>
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
                const totalMatch = Number(json.total_match_qty || 0).toLocaleString();
                const totalPhysic = Number(json.total_physic_qty || 0).toLocaleString();
                const totalDb = Number(json.total_db_qty || 0).toLocaleString();
                const avgPct = Math.round(parseFloat(json.avg_pct || 0));
                const avgDisplay = `${avgPct}%`;

                let overallText = 'Belum Ada Data';
                let overallStatusClass = 'status-none';
                let overallProgressClass = '';
                let overallColor = '#64748b';

                if (json.count_with_data > 0) {
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
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                return ` ${context.label}: ${val} Outlet (${pct}%)`;
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

            let statsHtml = `
                <div class="so-pie-stat-row">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #16a34a;"></span>
                        Tercapai (≥${thresholdLabel})
                    </span>
                    <span class="so-pie-stat-val" style="color: #16a34a;">
                        ${tercapai} <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTercapai}%)</span>
                    </span>
                </div>
                <div class="so-pie-stat-row">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #dc2626;"></span>
                        Tidak Tercapai (<${thresholdLabel})
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
                                        label += Math.round(context.parsed.y) + '%';
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
            chartTrendDept = new Chart(deptCanvas.getContext('2d'), createChartConfig(deptDatasets));

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
                chartTrendPmd = new Chart(pmdCanvas.getContext('2d'), createChartConfig(pmdDatasets));
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
                    <td class="text-center"><span class="badge-sitecode">${escapeHtml(row.sitecode)}</span></td>
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
            for (const m of visibleMonths) {
                const avg = rekapMonthAverages ? rekapMonthAverages[m] : null;
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
    };
})();

document.addEventListener('DOMContentLoaded', App.init);

