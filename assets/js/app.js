/**
 * Dashboard Asset Management — Main Application
 * 
 * Handles navigation, CSRF tokens, DataTables initialization,
 * Excel import, period management, and migration controls.
 */

'use strict';

const App = (() => {
    /** @type {string} CSRF token for state-changing requests */
    let csrfToken = '';

    /** @type {DataTable|null} DataTables instance */
    let assetsTable = null;

    /** @type {Chart|null} Chart.js instances */
    let categoryChart = null;
    let periodChart = null;

    // ── Initialization ─────────────────────────────────────────

    async function init() {
        await fetchCsrfToken();
        setupNavigation();
        setupModals();
        setupImportForm();
        navigateTo('dashboard');
    }

    // ── CSRF Token ─────────────────────────────────────────────

    async function fetchCsrfToken() {
        try {
            const res = await fetch('api/csrf.php');
            const data = await res.json();
            if (data.success) {
                csrfToken = data.token;
            }
        } catch (err) {
            showToast('error', 'Connection Error', 'Could not connect to the server.');
        }
    }

    // ── Navigation ─────────────────────────────────────────────

    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item[data-page]');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const page = item.getAttribute('data-page');
                navigateTo(page);
            });
        });

        // Mobile menu
        const menuBtn = document.getElementById('mobile-menu-btn');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');

        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('active');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }
    }

    function navigateTo(page) {
        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Show page section
        document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
        const section = document.getElementById(`page-${page}`);
        if (section) section.classList.add('active');

        // Update header title
        const titles = {
            'dashboard': 'Dashboard Overview',
            'master-data': 'Master Data',
            'import': 'Import Excel',
            'migrations': 'Database Migrations',
        };
        const headerTitle = document.getElementById('header-title');
        if (headerTitle) headerTitle.textContent = titles[page] || 'Dashboard';

        // Close mobile sidebar
        document.querySelector('.sidebar')?.classList.remove('open');
        document.querySelector('.sidebar-overlay')?.classList.remove('active');

        // Load page data
        switch (page) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'master-data':
                loadMasterData();
                break;
            case 'import':
                loadImportPage();
                break;
            case 'migrations':
                loadMigrations();
                break;
        }
    }

    // ── Dashboard ──────────────────────────────────────────────

    async function loadDashboard() {
        try {
            const res = await fetch('api/dashboard.php');
            const json = await res.json();

            if (!json.success) {
                showToast('error', 'Error', json.message || 'Failed to load dashboard');
                return;
            }

            const d = json.data;

            // Update stat cards
            updateStatCard('stat-total-assets', formatNumber(d.total_assets));
            updateStatCard('stat-total-periods', formatNumber(d.total_periods));
            updateStatCard('stat-total-value', formatCurrency(d.total_value));
            updateStatCard('stat-book-value', formatCurrency(d.total_book_value));

            // Render charts
            renderCategoryChart(d.by_category);
            renderPeriodChart(d.by_period);

            // Recent imports
            renderRecentImports(d.recent_imports);

        } catch (err) {
            showToast('error', 'Connection Error', 'Could not load dashboard data.');
        }
    }

    function updateStatCard(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function renderCategoryChart(data) {
        const ctx = document.getElementById('category-chart');
        if (!ctx) return;

        if (categoryChart) categoryChart.destroy();

        const colors = [
            'rgba(99, 128, 255, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(52, 211, 153, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(248, 113, 113, 0.8)',
            'rgba(96, 165, 250, 0.8)',
            'rgba(244, 114, 182, 0.8)',
            'rgba(192, 132, 252, 0.8)',
        ];

        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.category || 'Uncategorized'),
                datasets: [{
                    data: data.map(d => parseInt(d.count, 10)),
                    backgroundColor: colors.slice(0, data.length),
                    borderColor: 'rgba(28, 31, 46, 1)',
                    borderWidth: 3,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#8b8fa7',
                            font: { family: "'Inter', sans-serif", size: 12 },
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                        },
                    },
                    tooltip: {
                        backgroundColor: '#252a3a',
                        titleColor: '#e8eaf0',
                        bodyColor: '#8b8fa7',
                        borderColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        titleFont: { family: "'Inter', sans-serif", weight: '600' },
                        bodyFont: { family: "'Inter', sans-serif" },
                    },
                },
            },
        });
    }

    function renderPeriodChart(data) {
        const ctx = document.getElementById('period-chart');
        if (!ctx) return;

        if (periodChart) periodChart.destroy();

        periodChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    label: 'Number of Assets',
                    data: data.map(d => parseInt(d.asset_count, 10)),
                    backgroundColor: 'rgba(99, 128, 255, 0.6)',
                    borderColor: 'rgba(99, 128, 255, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                }, {
                    label: 'Total Value (Millions)',
                    data: data.map(d => parseFloat(d.total_value) / 1000000),
                    backgroundColor: 'rgba(168, 85, 247, 0.4)',
                    borderColor: 'rgba(168, 85, 247, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                    type: 'line',
                    yAxisID: 'y1',
                    tension: 0.3,
                    pointBackgroundColor: 'rgba(168, 85, 247, 1)',
                    fill: false,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: '#8b8fa7', font: { family: "'Inter', sans-serif", size: 11 } },
                    },
                    y: {
                        position: 'left',
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: '#8b8fa7', font: { family: "'Inter', sans-serif", size: 11 } },
                        title: { display: true, text: 'Assets Count', color: '#8b8fa7', font: { family: "'Inter', sans-serif" } },
                    },
                    y1: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#8b8fa7', font: { family: "'Inter', sans-serif", size: 11 } },
                        title: { display: true, text: 'Value (M)', color: '#8b8fa7', font: { family: "'Inter', sans-serif" } },
                    },
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#8b8fa7',
                            font: { family: "'Inter', sans-serif", size: 12 },
                            usePointStyle: true,
                            pointStyleWidth: 10,
                        },
                    },
                    tooltip: {
                        backgroundColor: '#252a3a',
                        titleColor: '#e8eaf0',
                        bodyColor: '#8b8fa7',
                        borderColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                    },
                },
            },
        });
    }

    function renderRecentImports(imports) {
        const tbody = document.getElementById('recent-imports-body');
        if (!tbody) return;

        tbody.replaceChildren();

        if (!imports || imports.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.setAttribute('colspan', '5');
            td.style.textAlign = 'center';
            td.style.padding = '2rem';
            td.style.color = 'var(--color-text-muted)';
            td.textContent = 'No imports yet';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        imports.forEach(imp => {
            const tr = document.createElement('tr');

            const tdFile = document.createElement('td');
            tdFile.textContent = imp.original_filename;

            const tdPeriod = document.createElement('td');
            tdPeriod.textContent = imp.period_label;

            const tdRows = document.createElement('td');
            tdRows.textContent = imp.rows_imported;

            const tdStatus = document.createElement('td');
            const badge = document.createElement('span');
            badge.classList.add('badge');
            if (imp.status === 'completed') {
                badge.classList.add('badge-success');
                badge.textContent = 'Completed';
            } else {
                badge.classList.add('badge-warning');
                badge.textContent = 'Partial';
            }
            tdStatus.appendChild(badge);

            const tdDate = document.createElement('td');
            tdDate.textContent = formatDate(imp.imported_at);

            tr.append(tdFile, tdPeriod, tdRows, tdStatus, tdDate);
            tbody.appendChild(tr);
        });
    }

    // ── Master Data ────────────────────────────────────────────

    async function loadMasterData() {
        await loadPeriodsDropdown('master-period-filter');
        initDataTable();
    }

    async function loadPeriodsDropdown(selectId) {
        try {
            const res = await fetch('api/periods.php');
            const json = await res.json();

            if (!json.success) return;

            const select = document.getElementById(selectId);
            if (!select) return;

            // Keep the first "All Periods" option
            const firstOption = select.querySelector('option');
            select.replaceChildren();
            if (firstOption) select.appendChild(firstOption);

            json.data.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.label} (${p.asset_count} assets)`;
                select.appendChild(opt);
            });
        } catch (err) {
            // Silently fail — dropdown will just not populate
        }
    }

    function initDataTable() {
        if (assetsTable) {
            assetsTable.ajax.reload();
            return;
        }

        assetsTable = new DataTable('#assets-table', {
            processing: true,
            serverSide: true,
            ajax: {
                url: 'api/assets.php',
                data: function (d) {
                    const periodFilter = document.getElementById('master-period-filter');
                    if (periodFilter && periodFilter.value) {
                        d.period_id = periodFilter.value;
                    }
                },
            },
            columns: [
                { data: 'id', visible: false },
                { data: 'asset_number', title: 'Asset No.' },
                { data: 'asset_name', title: 'Asset Name' },
                { data: 'category', title: 'Category' },
                { data: 'location', title: 'Location' },
                {
                    data: 'condition', title: 'Condition',
                    render: function (data) {
                        if (!data) return '-';
                        const cls = data.toLowerCase() === 'good' || data.toLowerCase() === 'baik'
                            ? 'badge-success'
                            : data.toLowerCase() === 'poor' || data.toLowerCase() === 'rusak'
                                ? 'badge-danger'
                                : 'badge-warning';
                        const span = document.createElement('span');
                        span.className = `badge ${cls}`;
                        span.textContent = data;
                        const tmp = document.createElement('div');
                        tmp.appendChild(span);
                        return tmp.firstChild.outerHTML;
                    },
                },
                {
                    data: 'acquisition_value', title: 'Acq. Value',
                    render: function (data) { return formatCurrency(parseFloat(data) || 0); },
                },
                {
                    data: 'book_value', title: 'Book Value',
                    render: function (data) { return formatCurrency(parseFloat(data) || 0); },
                },
                { data: 'period_label', title: 'Period' },
                {
                    data: null, title: 'Actions', orderable: false, searchable: false,
                    render: function (data, type, row) {
                        const editBtn = document.createElement('button');
                        editBtn.className = 'btn btn-sm btn-secondary';
                        editBtn.setAttribute('onclick', `App.editAsset(${row.id})`);
                        editBtn.textContent = '✎ Edit';

                        const delBtn = document.createElement('button');
                        delBtn.className = 'btn btn-sm btn-danger';
                        delBtn.setAttribute('onclick', `App.deleteAsset(${row.id})`);
                        delBtn.textContent = '✕';
                        delBtn.style.marginLeft = '4px';

                        const wrapper = document.createElement('div');
                        wrapper.className = 'action-btns';
                        wrapper.appendChild(editBtn);
                        wrapper.appendChild(delBtn);

                        const tmp = document.createElement('div');
                        tmp.appendChild(wrapper);
                        return tmp.firstChild.outerHTML;
                    },
                },
            ],
            order: [[1, 'asc']],
            pageLength: 25,
            lengthMenu: [10, 25, 50, 100],
            language: {
                search: 'Search:',
                lengthMenu: 'Show _MENU_ entries',
                info: 'Showing _START_ to _END_ of _TOTAL_ assets',
                emptyTable: 'No asset data available. Import an Excel file to get started.',
                processing: '<div class="spinner"></div> Loading...',
            },
            dom: '<"dataTables_top"lf>rt<"dataTables_bottom"ip>',
        });

        // Period filter change
        const periodFilter = document.getElementById('master-period-filter');
        if (periodFilter) {
            periodFilter.addEventListener('change', () => {
                if (assetsTable) assetsTable.ajax.reload();
            });
        }
    }

    // ── Asset CRUD ────────────────────────────────────────────

    async function editAsset(id) {
        // Fetch asset data from current DataTable
        if (!assetsTable) return;

        const data = assetsTable.rows().data().toArray();
        const asset = data.find(a => parseInt(a.id, 10) === id);
        if (!asset) return;

        // Populate edit modal
        document.getElementById('edit-asset-id').value = asset.id;
        document.getElementById('edit-asset-number').value = asset.asset_number || '';
        document.getElementById('edit-asset-name').value = asset.asset_name || '';
        document.getElementById('edit-category').value = asset.category || '';
        document.getElementById('edit-location').value = asset.location || '';
        document.getElementById('edit-condition').value = asset.condition || '';
        document.getElementById('edit-acq-date').value = asset.acquisition_date || '';
        document.getElementById('edit-acq-value').value = asset.acquisition_value || '';
        document.getElementById('edit-book-value').value = asset.book_value || '';
        document.getElementById('edit-useful-life').value = asset.useful_life || '';
        document.getElementById('edit-description').value = asset.description || '';

        openModal('edit-asset-modal');
    }

    async function saveAsset() {
        const data = {
            id: document.getElementById('edit-asset-id').value,
            asset_number: document.getElementById('edit-asset-number').value,
            asset_name: document.getElementById('edit-asset-name').value,
            category: document.getElementById('edit-category').value,
            location: document.getElementById('edit-location').value,
            condition: document.getElementById('edit-condition').value,
            acquisition_date: document.getElementById('edit-acq-date').value || null,
            acquisition_value: document.getElementById('edit-acq-value').value || 0,
            book_value: document.getElementById('edit-book-value').value || 0,
            useful_life: document.getElementById('edit-useful-life').value || null,
            description: document.getElementById('edit-description').value,
        };

        try {
            const res = await fetch('api/assets.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify(data),
            });
            const json = await res.json();

            if (json.success) {
                showToast('success', 'Updated', 'Asset updated successfully.');
                closeModal('edit-asset-modal');
                if (assetsTable) assetsTable.ajax.reload(null, false);
            } else {
                showToast('error', 'Error', json.message || 'Failed to update asset.');
            }
        } catch (err) {
            showToast('error', 'Error', 'Could not update asset.');
        }
    }

    async function deleteAsset(id) {
        if (!window.confirm('Are you sure you want to delete this asset?')) return;

        try {
            const res = await fetch('api/assets.php', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({ id }),
            });
            const json = await res.json();

            if (json.success) {
                showToast('success', 'Deleted', 'Asset deleted successfully.');
                if (assetsTable) assetsTable.ajax.reload(null, false);
            } else {
                showToast('error', 'Error', json.message || 'Failed to delete asset.');
            }
        } catch (err) {
            showToast('error', 'Error', 'Could not delete asset.');
        }
    }

    // ── Import ─────────────────────────────────────────────────

    async function loadImportPage() {
        await loadPeriodsDropdown('import-period-select');
        loadImportPeriodsForCreate();
    }

    function loadImportPeriodsForCreate() {
        // Populate month/year selectors for creating new periods
        const monthSelect = document.getElementById('new-period-month');
        const yearSelect = document.getElementById('new-period-year');

        if (!monthSelect || !yearSelect) return;

        // Only populate if empty
        if (monthSelect.options.length <= 1) {
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December',
            ];
            months.forEach((name, i) => {
                const opt = document.createElement('option');
                opt.value = i + 1;
                opt.textContent = name;
                monthSelect.appendChild(opt);
            });
        }

        if (yearSelect.options.length <= 1) {
            const currentYear = new Date().getFullYear();
            for (let y = currentYear + 2; y >= 2020; y--) {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                yearSelect.appendChild(opt);
            }
        }
    }

    async function createPeriod() {
        const month = document.getElementById('new-period-month').value;
        const year = document.getElementById('new-period-year').value;

        if (!month || !year) {
            showToast('warning', 'Missing Fields', 'Please select both month and year.');
            return;
        }

        try {
            const res = await fetch('api/periods.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({ month: parseInt(month, 10), year: parseInt(year, 10) }),
            });
            const json = await res.json();

            if (json.success) {
                showToast('success', 'Period Created', `Period "${json.data.label}" is ready.`);
                await loadPeriodsDropdown('import-period-select');
                // Auto-select the new period
                const select = document.getElementById('import-period-select');
                if (select) select.value = json.data.id;
            } else {
                showToast('error', 'Error', json.message || 'Failed to create period.');
            }
        } catch (err) {
            showToast('error', 'Error', 'Could not create period.');
        }
    }

    function setupImportForm() {
        const uploadZone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('excel-file-input');
        const fileNameDisplay = document.getElementById('file-name-display');

        if (!uploadZone || !fileInput) return;

        // Drag and drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                showSelectedFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                showSelectedFile(fileInput.files[0]);
            }
        });
    }

    function showSelectedFile(file) {
        const display = document.getElementById('file-name-display');
        if (!display) return;

        display.style.display = 'flex';
        const nameSpan = display.querySelector('.file-text');
        if (nameSpan) nameSpan.textContent = file.name;
    }

    function removeSelectedFile() {
        const fileInput = document.getElementById('excel-file-input');
        const display = document.getElementById('file-name-display');

        if (fileInput) fileInput.value = '';
        if (display) display.style.display = 'none';
    }

    async function importExcel() {
        const fileInput = document.getElementById('excel-file-input');
        const periodSelect = document.getElementById('import-period-select');
        const importBtn = document.getElementById('import-btn');

        if (!periodSelect || !periodSelect.value) {
            showToast('warning', 'Select Period', 'Please select a period before importing.');
            return;
        }

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            showToast('warning', 'Select File', 'Please select an Excel file to import.');
            return;
        }

        const file = fileInput.files[0];
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls'].includes(ext)) {
            showToast('error', 'Invalid File', 'Only .xlsx and .xls files are supported.');
            return;
        }

        // Size check (10MB)
        if (file.size > 10 * 1024 * 1024) {
            showToast('error', 'File Too Large', 'Maximum file size is 10MB.');
            return;
        }

        const formData = new FormData();
        formData.append('excel_file', file);
        formData.append('period_id', periodSelect.value);
        formData.append('csrf_token', csrfToken);

        // Disable button
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.textContent = '⏳ Importing...';
        }

        try {
            const res = await fetch('api/import.php', {
                method: 'POST',
                body: formData,
            });
            const json = await res.json();

            if (json.success) {
                showToast('success', 'Import Complete', json.message);
                removeSelectedFile();
            } else {
                showToast('error', 'Import Failed', json.message || 'An error occurred.');
            }
        } catch (err) {
            showToast('error', 'Connection Error', 'Could not upload file.');
        } finally {
            if (importBtn) {
                importBtn.disabled = false;
                importBtn.textContent = '📥 Import Data';
            }
        }
    }

    // ── Migrations ─────────────────────────────────────────────

    async function loadMigrations() {
        try {
            const res = await fetch('api/migrate.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({ action: 'status' }),
            });
            const json = await res.json();

            if (!json.success) {
                showToast('error', 'Error', json.message || 'Failed to load migration status.');
                return;
            }

            renderMigrationList(json.migrations);
        } catch (err) {
            showToast('error', 'Connection Error', 'Could not load migration status.');
        }
    }

    function renderMigrationList(migrations) {
        const list = document.getElementById('migration-list');
        if (!list) return;

        list.replaceChildren();

        if (!migrations || migrations.length === 0) {
            const li = document.createElement('li');
            li.className = 'migration-item';
            li.style.justifyContent = 'center';
            li.style.color = 'var(--color-text-muted)';
            li.textContent = 'No migration files found';
            list.appendChild(li);
            return;
        }

        migrations.forEach(m => {
            const li = document.createElement('li');
            li.className = 'migration-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'migration-name';
            nameSpan.textContent = m.name;

            const badge = document.createElement('span');
            badge.className = `badge ${m.status === 'Applied' ? 'badge-success' : 'badge-warning'}`;
            badge.textContent = m.status === 'Applied' ? `✓ Batch ${m.batch}` : '⏳ Pending';

            li.appendChild(nameSpan);
            li.appendChild(badge);
            list.appendChild(li);
        });
    }

    async function runMigration(action) {
        const btn = document.querySelector(`[data-migrate-action="${action}"]`);
        if (btn) {
            btn.disabled = true;
            const origText = btn.textContent;
            btn.textContent = '⏳ Running...';
        }

        try {
            const res = await fetch('api/migrate.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({ action }),
            });
            const json = await res.json();

            if (json.success) {
                const count = (json.applied || json.rolledBack || []).length;
                const verb = action === 'rollback' ? 'rolled back' : 'applied';
                showToast('success', 'Migration', `${count} migration(s) ${verb}.`);
                loadMigrations();
            } else {
                const errors = json.errors || [];
                showToast('error', 'Migration Error', errors.join(', ') || json.message || 'Failed');
            }
        } catch (err) {
            showToast('error', 'Connection Error', 'Could not run migration.');
        } finally {
            if (btn) {
                btn.disabled = false;
            }
        }
    }

    // ── Modals ────────────────────────────────────────────────

    function setupModals() {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const overlay = btn.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('active');
            });
        });
    }

    function openModal(id) {
        const overlay = document.getElementById(id);
        if (overlay) overlay.classList.add('active');
    }

    function closeModal(id) {
        const overlay = document.getElementById(id);
        if (overlay) overlay.classList.remove('active');
    }

    // ── Toast Notifications ───────────────────────────────────

    function showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'toast-icon';
        iconSpan.textContent = icons[type] || 'ℹ';

        const content = document.createElement('div');
        content.className = 'toast-content';

        const titleEl = document.createElement('div');
        titleEl.className = 'toast-title';
        titleEl.textContent = title;

        const msgEl = document.createElement('div');
        msgEl.className = 'toast-message';
        msgEl.textContent = message;

        content.appendChild(titleEl);
        content.appendChild(msgEl);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => toast.remove());

        toast.appendChild(iconSpan);
        toast.appendChild(content);
        toast.appendChild(closeBtn);
        container.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.transition = 'opacity 0.3s, transform 0.3s';
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    // ── Utilities ──────────────────────────────────────────────

    function formatNumber(n) {
        return new Intl.NumberFormat('en-US').format(n || 0);
    }

    function formatCurrency(n) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(n || 0);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    // ── Public API ─────────────────────────────────────────────

    return {
        init,
        navigateTo,
        editAsset,
        saveAsset,
        deleteAsset,
        createPeriod,
        importExcel,
        removeSelectedFile,
        runMigration,
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
