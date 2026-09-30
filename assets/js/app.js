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
    let csrfToken = '';

    // Column keys matching the filter dropdowns
    const filterColumns = [
        'profile', 'period_start', 'period_end',
        'match_physic_qty', 'match_physic_pct', 'match_nbv_value', 'match_nbv_pct',
        'physic_physic_qty', 'physic_physic_pct', 'physic_nbv_value', 'physic_nbv_pct',
        'db_physic_qty', 'db_physic_pct', 'db_nbv_value', 'db_nbv_pct',
        'total_physic_actual', 'total_physic_target', 'total_physic_pct',
        'total_nbv_actual', 'total_nbv_target', 'total_nbv_pct'
    ];

    // ── Initialization ─────────────────────────────────────────

    function init() {
        const metaCsrf = document.querySelector('meta[name="csrf-token"]');
        if (metaCsrf) {
            csrfToken = metaCsrf.getAttribute('content');
        }

        setupDragAndDrop();

        // Default landing page is Master Data
        navigateTo('master-data');
    }

    // ── Navigation (Master Data vs Summary) ─────────────────────

    function navigateTo(page) {
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
        } else if (page === 'summary') {
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
            populateColumnFilters();
            applyFilterAndRender();
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="22" class="text-center" style="padding: 2rem; color: #dc2626;">
                        Network or server error while connecting to PostgreSQL.
                    </td>
                </tr>
            `;
        }
    }

    // ── Column Filter Dropdowns ────────────────────────────────

    function populateColumnFilters() {
        filterColumns.forEach(col => {
            const select = document.querySelector(`.col-filter[data-col="${col}"]`);
            if (!select) return;

            // Remember current selection
            const currentVal = select.value;

            // Get unique values for this column
            const uniqueVals = new Set();
            allMasterRows.forEach(row => {
                const val = row[col];
                if (val !== null && val !== undefined && val !== '') {
                    uniqueVals.add(String(val));
                }
            });

            // Sort values
            const sorted = Array.from(uniqueVals).sort((a, b) => {
                const numA = parseFloat(a);
                const numB = parseFloat(b);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            });

            // Rebuild options
            let html = '<option value="">All</option>';
            sorted.forEach(v => {
                html += `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`;
            });
            select.innerHTML = html;

            // Restore selection if still valid
            if (currentVal && sorted.includes(currentVal)) {
                select.value = currentVal;
            }
        });
    }

    function getColumnFilters() {
        const filters = {};
        filterColumns.forEach(col => {
            const select = document.querySelector(`.col-filter[data-col="${col}"]`);
            if (select && select.value) {
                filters[col] = select.value;
            }
        });
        return filters;
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
                const startDate = r.period_start || '';
                if (!startDate) return false;
                // period_start is YYYY-MM-DD format
                const parts = startDate.split('-');
                if (parts.length >= 2) {
                    return parseInt(parts[1], 10) === m;
                }
                return false;
            });
        }

        // Apply Year filter
        const yearFilter = document.getElementById('filter-year');
        if (yearFilter && yearFilter.value) {
            const y = parseInt(yearFilter.value, 10);
            rows = rows.filter(r => {
                const startDate = r.period_start || '';
                if (!startDate) return false;
                const parts = startDate.split('-');
                if (parts.length >= 1) {
                    return parseInt(parts[0], 10) === y;
                }
                return false;
            });
        }

        // Apply per-column filters
        const colFilters = getColumnFilters();
        Object.keys(colFilters).forEach(col => {
            const filterVal = colFilters[col];
            rows = rows.filter(r => String(r[col] ?? '') === filterVal);
        });

        // Apply text search
        if (searchQuery) {
            rows = rows.filter(r => {
                const profile = (r.profile || '').toLowerCase();
                const start = (r.period_start || '').toLowerCase();
                const end = (r.period_end || '').toLowerCase();
                return profile.includes(searchQuery) || start.includes(searchQuery) || end.includes(searchQuery);
            });
        }

        filteredMasterRows = rows;
        currentPage = 1;
        renderMasterTable();
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
                        ${allMasterRows.length === 0 ? "No records found in database. Click 'Import Excel' to upload your data." : "No matching records data found."}
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
                            🗑️
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
                populateColumnFilters();
                applyFilterAndRender();
            } else {
                showToast('error', 'Delete Failed', json.message || 'Failed to delete record.');
            }
        } catch (err) {
            showToast('error', 'Server Error', 'Failed to connect to the server.');
        }
    }

    // ── Page 2: Stock Opname Summary (KPI & Overview) ───────────

    async function loadSummaryData() {
        const bodyEl = document.getElementById('summary-overview-body');
        if (!bodyEl) return;

        try {
            const res = await fetch('api/reconciliation.php');
            const json = await res.json();

            if (!json.success) return;

            const t = json.totals || {};
            const totalProfiles = parseInt(t.total_profiles || 0, 10);
            const totalMatchQty = parseInt(t.total_match_qty || 0, 10);
            const totalMatchNbv = parseFloat(t.total_match_nbv || 0);
            const totalPhysicQty = parseInt(t.total_physic_qty || 0, 10);
            const totalPhysicNbv = parseFloat(t.total_physic_nbv || 0);
            const totalDbQty = parseInt(t.total_db_qty || 0, 10);
            const totalDbNbv = parseFloat(t.total_db_nbv || 0);
            const totalPhysicActual = parseInt(t.total_physic_actual || 0, 10);
            const totalPhysicTarget = parseInt(t.total_physic_target || 0, 10);
            const totalNbvActual = parseFloat(t.total_nbv_actual || 0);
            const totalNbvTarget = parseFloat(t.total_nbv_target || 0);

            // Update KPI cards
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };

            setVal('kpi-total-profiles', totalProfiles.toLocaleString());
            setVal('kpi-match-qty', totalMatchQty.toLocaleString());
            setVal('kpi-match-nbv', formatCurrency(totalMatchNbv));
            setVal('kpi-physic-qty', totalPhysicQty.toLocaleString());
            setVal('kpi-db-qty', totalDbQty.toLocaleString());

            // Render Overview Table Row
            bodyEl.innerHTML = `
                <tr style="font-weight: 600;">
                    <td class="text-left">Grand Total (${totalProfiles.toLocaleString()} Outlets)</td>
                    <td class="text-right">${totalMatchQty.toLocaleString()}</td>
                    <td class="text-right">${formatCurrency(totalMatchNbv)}</td>
                    <td class="text-right">${totalPhysicQty.toLocaleString()}</td>
                    <td class="text-right">${formatCurrency(totalPhysicNbv)}</td>
                    <td class="text-right">${totalDbQty.toLocaleString()}</td>
                    <td class="text-right">${formatCurrency(totalDbNbv)}</td>
                    <td class="text-right">${totalPhysicTarget.toLocaleString()}</td>
                    <td class="text-right">${formatCurrency(totalNbvTarget)}</td>
                </tr>
            `;
        } catch (err) {
            console.error('Error loading summary totals:', err);
        }
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

    function handleFileSelect(files) {
        if (!files || files.length === 0) return;
        const file = files[0];

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            showToast('error', 'Invalid File', 'Only Excel files (.xlsx, .xls) are allowed.');
            return;
        }

        selectedFile = file;

        const displayEl = document.getElementById('selected-file-display');
        const nameEl = document.getElementById('selected-file-name');
        const sizeEl = document.getElementById('selected-file-size');

        if (displayEl && nameEl && sizeEl) {
            nameEl.textContent = file.name;
            const sizeKb = Math.round(file.size / 1024);
            sizeEl.textContent = `(${sizeKb.toLocaleString()} KB)`;
            displayEl.style.display = 'block';
        }
    }

    function clearSelectedFile() {
        selectedFile = null;
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) fileInput.value = '';

        const displayEl = document.getElementById('selected-file-display');
        if (displayEl) displayEl.style.display = 'none';
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

        const formData = new FormData();
        formData.append('month', month);
        formData.append('year', year);
        formData.append('excel_file', selectedFile);
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

            const json = await res.json();

            if (json.success) {
                statusDiv.style.background = '#f0fdf4';
                statusDiv.style.color = '#15803d';
                statusDiv.style.border = '1px solid #bbf7d0';
                statusDiv.textContent = `✓ ${json.message || 'Import successful!'}`;

                showToast('success', 'Import Complete', json.message || 'Data imported successfully.');

                // Reload master data table & summary
                loadMasterData();
                loadSummaryData();

                setTimeout(() => {
                    closeImportModal();
                }, 1200);
            } else {
                statusDiv.style.background = '#fef2f2';
                statusDiv.style.color = '#b91c1c';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.textContent = `✗ ${json.message || 'Import failed.'}`;
                showToast('error', 'Import Failed', json.message || 'Failed to import file.');
            }
        } catch (err) {
            statusDiv.style.background = '#fef2f2';
            statusDiv.style.color = '#b91c1c';
            statusDiv.style.border = '1px solid #fecaca';
            statusDiv.textContent = '✗ Connection error during file upload.';
            showToast('error', 'Server Error', 'Failed to connect to the server.');
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
        openImportModal,
        closeImportModal,
        handleFileSelect,
        clearSelectedFile,
        submitImport,
    };
})();

document.addEventListener('DOMContentLoaded', App.init);

