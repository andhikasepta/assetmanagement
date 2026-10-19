/**
 * All Summary Page JavaScript
 * Admin View: Shows consolidated data for ALL sites (no category breakdown)
 * Supports Monthly and Quarterly SO types.
 */
const AllSummaryApp = (function () {
    let summarySOType = 'monthly';
    const summaryCategory = 'all';
    let chartTrendAll = null;
    let ratingPieChart = null;
    let execPieChart = null;
    let hasilPieChart = null;
    let hasilStats = { tercapai: 0, tidakTercapai: 0, noData: 0, total: 0 };

    let allHasilRows = [];
    let filteredHasilRows = [];
    let currentHasilPage = 1;
    let hasilPageSize = 10;

    let allRekapRows = [];
    let filteredRekapRows = [];
    let currentRekapPage = 1;
    let rekapPageSize = 10;

    let movementsData = [];

    let isInitialized = false;

    // ── Initialization ──
    function init() {
        const pageEl = document.getElementById('page-all-summary') || document.getElementById('card-executive-summary');
        if (!pageEl) return;

        // Set default month to 9 (September) on initial load if unset
        const monthSel = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        if (monthSel && !isInitialized && monthSel.value === '') {
            monthSel.value = '9';
        }
        const yearSel = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
        if (yearSel && !yearSel.value) {
            yearSel.value = '2026';
        }
        isInitialized = true;

        loadAllSummary();
    }

    // ── SO Type Switch ──
    function switchSOType(type) {
        if (type !== 'monthly' && type !== 'quarterly') type = 'monthly';
        summarySOType = type;

        const btnMonthly = document.getElementById('all-btn-so-type-monthly');
        const btnQuarterly = document.getElementById('all-btn-so-type-quarterly');
        if (btnMonthly) btnMonthly.classList.toggle('active', type === 'monthly');
        if (btnQuarterly) btnQuarterly.classList.toggle('active', type === 'quarterly');

        loadAllSummary();
    }

    // ── Master Loader ──
    async function loadAllSummary() {
        const monthEl = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const month = monthEl ? monthEl.value : '';
        const yearEl = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
        const year = yearEl ? yearEl.value : '2026';

        // Update period badge
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const badge = document.getElementById('all-executive-period-badge') || document.getElementById('executive-period-badge');
        if (badge) {
            badge.textContent = month ? `${monthNames[parseInt(month)] || ''} ${year}` : `Semua Bulan ${year}`;
        }

        // Run data loaders in parallel
        await Promise.allSettled([
            loadSummaryKPIs(month, year),
            loadTrendChart(year),
            loadScorecard(month, year),
            loadHasilSO(month, year),
            loadRekapDbStatus(month, year),
            loadRekapitulasi(year),
            loadSiteMovements(year, month)
        ]);
    }

    // ── 1. Summary KPIs & DB Analysis ──
    async function loadSummaryKPIs(month, year) {
        try {
            const url = `api/reconciliation.php?action=summary&category=all&so_type=${summarySOType}&month=${month}&year=${year}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) return;

            const ach = json.achievements || {};
            const nat = ach.national || ach.outlet_national || {};
            const pct = (nat.pct !== null && nat.pct !== undefined)
                ? Math.round(Number(nat.pct))
                : ((ach.summary_achievement !== null && ach.summary_achievement !== undefined) ? Math.round(Number(ach.summary_achievement)) : 0);
            const target = 85;

            // Overall Achievement Card (No Target, Compare vs Previous Period)
            const achEl = document.getElementById('kpi-all-achievement');
            if (achEl) achEl.textContent = `${pct}%`;

            const statusEl = document.getElementById('kpi-all-status');
            if (statusEl) {
                statusEl.style.display = 'none';
            }

            const trendEl = document.getElementById('kpi-all-trend');
            if (trendEl) {
                const diffPct = (nat.diff_pct !== undefined && nat.diff_pct !== null) ? Number(nat.diff_pct) : null;
                const prevPct = (nat.prev_pct !== undefined && nat.prev_pct !== null) ? Number(nat.prev_pct) : null;
                if (diffPct !== null) {
                    const isUp = diffPct > 0;
                    const isDown = diffPct < 0;
                    const sign = isUp ? '+' : '';
                    const trendClass = isUp ? 'target-up' : (isDown ? 'target-down' : 'target-neutral');
                    const svg = isUp
                        ? `<svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle;"><polygon points="12,4 21,20 3,20"/></svg>`
                        : (isDown ? `<svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle;"><polygon points="12,20 3,4 21,4"/></svg>` : '');
                    trendEl.innerHTML = `
                        <span class="kpi-target-indicator ${trendClass}" title="Periode Sebelumnya: ${prevPct}% (Selisih: ${sign}${diffPct}%)">
                            ${svg}
                            <span>${sign}${diffPct}% vs Prev</span>
                        </span>
                    `;
                } else {
                    trendEl.innerHTML = `
                        <span class="kpi-target-indicator target-neutral" title="Tidak ada data perbandingan periode sebelumnya">
                            <span>-</span>
                        </span>
                    `;
                }
            }

            const subtextEl = document.getElementById('kpi-all-subtext');
            if (subtextEl) {
                const totalSites = nat.total_sites || nat.count || ach.total_sites || 0;
                subtextEl.textContent = `Avg All Sites (${totalSites} Sites)`;
            }

            // DB Analysis Summary (No Target, Compare vs Previous Period with arrow + or -)
            const dbA = ach.db_analysis || json.db_analysis || {};
            const dbNat = dbA.national || dbA.outlet_national || {};
            const grandTotal = (dbNat.qty !== undefined) ? dbNat.qty : (dbA.grand_total || 0);

            ['all-db-analysis-grand-total', 'db-analysis-grand-total', 'all-db-val-total', 'all-db-status-grand-total', 'db-status-grand-total'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = Number(grandTotal).toLocaleString('id-ID');
            });

            const diffQty = (dbNat.diff_qty !== undefined && dbNat.diff_qty !== null) ? Number(dbNat.diff_qty) : (dbA.diff_grand_total !== undefined ? Number(dbA.diff_grand_total) : null);
            const prevQty = (dbNat.prev_qty !== undefined && dbNat.prev_qty !== null) ? Number(dbNat.prev_qty) : null;
            const hasPrev = dbA.has_previous || (diffQty !== null);

            const renderDbTrend = () => {
                if (!hasPrev || diffQty === null) {
                    return `<span class="db-trend-indicator db-trend-neutral" title="Tidak ada data perbandingan periode sebelumnya"><span>-</span></span>`;
                }
                const sign = diffQty > 0 ? '+' : '';
                const isPos = diffQty > 0;
                const isNeg = diffQty < 0;
                const trendClass = isNeg ? 'db-trend-good-down' : (isPos ? 'db-trend-bad-up' : 'db-trend-neutral');
                const svg = isPos
                    ? `<svg width="7.5" height="7.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,4 21,20 3,20"/></svg>`
                    : (isNeg ? `<svg width="7.5" height="7.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,20 3,4 21,4"/></svg>` : '');
                const formatted = `${sign}${Number(diffQty).toLocaleString('id-ID')}`;
                return `
                    <span class="db-trend-indicator ${trendClass}" title="${formatted} vs Periode Sebelumnya (Prev: ${Number(prevQty || 0).toLocaleString('id-ID')})">
                        ${svg}
                        <span>${formatted} vs Prev</span>
                    </span>
                `;
            };

            const trendHtml = renderDbTrend();
            ['all-db-grand-trend', 'db-grand-trend', 'all-db-card-trend', 'all-db-status-grand-trend', 'db-status-grand-trend'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = trendHtml;
            });

            // Status DB Counts
            const solved = dbNat.solved !== undefined ? dbNat.solved : (dbA.outlet_national?.solved || 0);
            const unsolved = dbNat.unsolved !== undefined ? dbNat.unsolved : (dbA.outlet_national?.unsolved || 0);
            const newDb = dbNat.new_db !== undefined ? dbNat.new_db : (dbA.outlet_national?.new_db || 0);

            ['all-db-status-val-solved', 'db-status-val-solved'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = Number(solved).toLocaleString('id-ID');
            });
            ['all-db-status-val-unsolved', 'db-status-val-unsolved'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = Number(unsolved).toLocaleString('id-ID');
            });
            ['all-db-status-val-new', 'db-status-val-new'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = Number(newDb).toLocaleString('id-ID');
            });

        } catch (err) {
            console.error('Error loading summary KPIs:', err);
        }
    }

    // ── 2. Trend Line Chart (Count All) ──
    async function loadTrendChart(year) {
        if (typeof Chart === 'undefined') return;

        const canvas = document.getElementById('all-chart-trend-all');
        if (!canvas) return;

        const subtitleEl = document.getElementById('all-trend-all-subtitle');
        if (subtitleEl) {
            subtitleEl.textContent = (summarySOType === 'monthly')
                ? `Monthly Physical % Jan - Dec ${year} (All Sites)`
                : `Quarterly Physical % Q1 - Q4 ${year} (All Sites)`;
        }

        try {
            const url = `api/rekapitulasi.php?action=trends&year=${year}&so_type=${summarySOType}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) return;

            const labels = json.months || (summarySOType === 'quarterly' ? ['Q1', 'Q2', 'Q3', 'Q4'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
            const data = json.national_trend || [];

            const primaryColor = '#0284c7'; // Corporate blue

            if (chartTrendAll) {
                chartTrendAll.destroy();
            }

            const ctx = canvas.getContext('2d');
            chartTrendAll = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'All Sites Physical %',
                        data: data,
                        borderColor: primaryColor,
                        backgroundColor: 'rgba(2, 132, 199, 0.08)',
                        borderWidth: 3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: primaryColor,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        spanGaps: true,
                        clip: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 26,
                            right: 14,
                            bottom: 6,
                            left: 6
                        }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: {
                                stepSize: 20,
                                callback: val => `${val}%`,
                                font: { size: 11 }
                            },
                            grid: { color: '#f1f5f9' }
                        },
                        x: {
                            ticks: { font: { size: 11 } },
                            grid: { display: false }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                usePointStyle: true,
                                font: { size: 12, weight: '600' }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => ` All Sites: ${ctx.parsed.y !== null ? ctx.parsed.y + '%' : 'Tidak Ada Data'}`
                            }
                        }
                    }
                }
            });
        } catch (err) {
            console.error('Error loading trend chart:', err);
        }
    }

    // ── 3. Score Card Summary (All Sites) ──
    async function loadScorecard(month, year) {
        try {
            const url = `api/scorecard_summary.php?category=all&so_type=${summarySOType}&month=${month}&year=${year}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) return;

            // Rating Pie Chart
            renderRatingPie(json.rating_counts || json.rating_summary || {});
            // Execution Pie Chart
            renderExecPie(json.execution_counts || json.execution_summary || {});

            // Update Total Sites Badge
            const totalSites = (json.total_sites !== undefined) ? json.total_sites : ((json.scorecard_details || []).length || 0);
            const badge = document.getElementById('all-scorecard-total-sites-badge');
            if (badge) badge.textContent = `${totalSites} Sites Total`;

        } catch (err) {
            console.error('Error loading scorecard:', err);
        }
    }

    function renderRatingPie(data) {
        const canvas = document.getElementById('all-chart-scorecard-rating');
        if (!canvas || typeof Chart === 'undefined') return;

        const counts = [
            data.very_good || 0,
            data.good || 0,
            data.moderate || 0,
            data.poor || 0,
            data.very_poor || 0
        ];

        const setStat = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setStat('all-stat-rating-vg', counts[0]);
        setStat('all-stat-rating-g', counts[1]);
        setStat('all-stat-rating-m', counts[2]);
        setStat('all-stat-rating-p', counts[3]);
        setStat('all-stat-rating-vp', counts[4]);

        if (ratingPieChart) ratingPieChart.destroy();

        ratingPieChart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Very Good', 'Good', 'Moderate', 'Poor', 'Very Poor'],
                datasets: [{
                    data: counts,
                    backgroundColor: ['#16a34a', '#3b82f6', '#f59e0b', '#f97316', '#dc2626'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                cutout: '68%'
            }
        });
    }

    function renderExecPie(data) {
        const canvas = document.getElementById('all-chart-scorecard-exec');
        if (!canvas || typeof Chart === 'undefined') return;

        const counts = [
            data.executed || 0,
            data.not_executed || 0
        ];

        const setStat = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setStat('all-stat-exec-yes', counts[0]);
        setStat('all-stat-exec-no', counts[1]);

        if (execPieChart) execPieChart.destroy();

        execPieChart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Executed', 'Not Executed'],
                datasets: [{
                    data: counts,
                    backgroundColor: ['#16a34a', '#dc2626'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                cutout: '68%'
            }
        });
    }

    // ── 4. Hasil Stock Opname Table & Pie Chart (All Data) ──
    function getRowStatus(r) {
        if (r.status) {
            const s = r.status.toLowerCase();
            if (s.includes('tercapai') && !s.includes('tidak')) return 'tercapai';
            if (s.includes('tidak') || r.status_class === 'red' || r.status_class === 'orange') return 'tidak_tercapai';
            if (s.includes('belum') || r.status_class === 'none') return 'no_data';
        }
        const pct = (r.total_physic_pct !== null && r.total_physic_pct !== undefined)
            ? Number(r.total_physic_pct)
            : (r.pct_physic !== null && r.pct_physic !== undefined ? Number(r.pct_physic) : null);
        if (pct === null) return 'no_data';
        const isPmd = (r.dept && r.dept.toUpperCase() === 'PMD');
        const threshold = isPmd ? 98 : 85;
        return pct >= threshold ? 'tercapai' : 'tidak_tercapai';
    }

    function toggleHasilStatusFilter(target) {
        const sel = document.getElementById('hasil-so-filter-status');
        if (!sel) return;
        if (sel.value === target) {
            sel.value = 'all';
        } else {
            sel.value = target;
        }
        applyHasilFilter();
    }

    function renderHasilPieChart(tercapai, tidakTercapai, noData, total) {
        const canvas = document.getElementById('all-chart-hasil-so-pie');
        const statsContainer = document.getElementById('all-hasil-pie-stats');
        if (!canvas) return;

        if (hasilPieChart) {
            hasilPieChart.destroy();
            hasilPieChart = null;
        }

        if (total === 0) {
            if (typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                hasilPieChart = new Chart(ctx, {
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

        const labels = ['Tercapai', 'Tidak Tercapai'];
        const data = [tercapai, tidakTercapai];
        const colors = ['#16a34a', '#dc2626'];
        const statusKeys = ['tercapai', 'tidak_tercapai'];

        if (noData > 0) {
            labels.push('Belum Ada Data');
            data.push(noData);
            colors.push('#94a3b8');
            statusKeys.push('no_data');
        }

        if (typeof Chart !== 'undefined') {
            const ctx = canvas.getContext('2d');
            hasilPieChart = new Chart(ctx, {
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
                            const target = statusKeys[idx] || 'all';
                            toggleHasilStatusFilter(target);
                        }
                    },
                    onHover: (event, chartElement) => {
                        event.native.target.style.cursor = (chartElement && chartElement.length > 0) ? 'pointer' : 'default';
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            onClick: (e, legendItem) => {
                                const idx = legendItem.index;
                                const target = statusKeys[idx] || 'all';
                                toggleHasilStatusFilter(target);
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
        }

        updateHasilPieStatsView();
    }

    function updateHasilPieStatsView() {
        const statsContainer = document.getElementById('all-hasil-pie-stats');
        const pieSubtitle = document.getElementById('all-hasil-pie-subtitle');
        const { tercapai, tidakTercapai, noData, total } = hasilStats;

        const statusSel = document.getElementById('hasil-so-filter-status');
        const curStatus = statusSel ? statusSel.value : 'all';

        if (pieSubtitle) {
            let filterSuffix = ` (${total} Sites)`;
            if (curStatus === 'tercapai') filterSuffix = ` [Tercapai: ${tercapai} Sites]`;
            else if (curStatus === 'tidak_tercapai') filterSuffix = ` [Tidak Tercapai: ${tidakTercapai} Sites]`;
            else if (curStatus === 'no_data') filterSuffix = ` [Belum Ada Data: ${noData} Sites]`;
            pieSubtitle.textContent = `Tercapai vs Tidak Tercapai${filterSuffix}`;
        }

        if (!statsContainer || total === 0) return;

        const pctTercapai = total > 0 ? Math.round((tercapai / total) * 100) : 0;
        const pctTidak = total > 0 ? Math.round((tidakTercapai / total) * 100) : 0;
        const pctNoData = total > 0 ? Math.round((noData / total) * 100) : 0;

        const activeTercapai = (curStatus === 'tercapai') ? ' active' : '';
        const activeTidak = (curStatus === 'tidak_tercapai') ? ' active' : '';
        const activeNoData = (curStatus === 'no_data') ? ' active' : '';
        const activeAll = (curStatus === 'all') ? ' active' : '';

        let statsHtml = `
            <div class="so-pie-stat-row${activeTercapai}" onclick="AllSummaryApp.toggleHasilStatusFilter('tercapai')" title="Klik untuk filter status Tercapai">
                <span class="so-pie-stat-label">
                    <span class="so-pie-stat-dot" style="background-color: #16a34a;"></span>
                    Tercapai
                </span>
                <span class="so-pie-stat-val" style="color: #16a34a;">
                    ${tercapai} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTercapai}%)</span>
                </span>
            </div>
            <div class="so-pie-stat-row${activeTidak}" onclick="AllSummaryApp.toggleHasilStatusFilter('tidak_tercapai')" title="Klik untuk filter status Tidak Tercapai">
                <span class="so-pie-stat-label">
                    <span class="so-pie-stat-dot" style="background-color: #dc2626;"></span>
                    Tidak Tercapai
                </span>
                <span class="so-pie-stat-val" style="color: #dc2626;">
                    ${tidakTercapai} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTidak}%)</span>
                </span>
            </div>
        `;

        if (noData > 0) {
            statsHtml += `
                <div class="so-pie-stat-row${activeNoData}" onclick="AllSummaryApp.toggleHasilStatusFilter('no_data')" title="Klik untuk filter Belum Ada Data">
                    <span class="so-pie-stat-label">
                        <span class="so-pie-stat-dot" style="background-color: #94a3b8;"></span>
                        Belum Ada Data
                    </span>
                    <span class="so-pie-stat-val" style="color: #64748b;">
                        ${noData} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctNoData}%)</span>
                    </span>
                </div>
            `;
        }

        statsHtml += `
            <div class="so-pie-stat-row${activeAll}" onclick="AllSummaryApp.toggleHasilStatusFilter('all')" title="Klik untuk tampilkan Semua Status" style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                <span class="so-pie-stat-label" style="font-weight: 600; color: #1e293b;">
                    Total Sites
                </span>
                <span class="so-pie-stat-val" style="font-weight: 700; color: #0f172a;">${total} sites</span>
            </div>
        `;

        statsContainer.innerHTML = statsHtml;
    }

    async function loadHasilSO(month, year) {
        const tbody = document.getElementById('hasil-so-table-body');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #94a3b8;">Memuat data Report SO...</td></tr>`;

        try {
            const url = `api/reconciliation.php?action=subdept_results&category=all&so_type=${summarySOType}&month=${month}&year=${year}&dept=all&sub_dept=all`;
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #ef4444;">Gagal memuat data</td></tr>`;
                renderHasilPieChart(0, 0, 0, 0);
                return;
            }

            allHasilRows = json.data || [];

            let countTercapai = 0;
            let countTidakTercapai = 0;
            let countNoData = 0;
            allHasilRows.forEach(r => {
                const st = getRowStatus(r);
                if (st === 'tercapai') countTercapai++;
                else if (st === 'tidak_tercapai') countTidakTercapai++;
                else countNoData++;
            });

            hasilStats = {
                tercapai: countTercapai,
                tidakTercapai: countTidakTercapai,
                noData: countNoData,
                total: allHasilRows.length
            };

            renderHasilPieChart(countTercapai, countTidakTercapai, countNoData, allHasilRows.length);
            applyHasilFilter();
        } catch (err) {
            console.error('Error loading hasil SO:', err);
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #ef4444;">Kesalahan jaringan</td></tr>`;
            renderHasilPieChart(0, 0, 0, 0);
        }
    }

    function applyHasilFilter() {
        const query = (document.getElementById('hasil-so-search')?.value || '').toLowerCase().trim();
        const status = document.getElementById('hasil-so-filter-status')?.value || 'all';

        filteredHasilRows = allHasilRows.filter(r => {
            if (query) {
                const matchQuery = (r.sitecode && r.sitecode.toLowerCase().includes(query)) ||
                    (r.name_site && r.name_site.toLowerCase().includes(query)) ||
                    (r.dept && r.dept.toLowerCase().includes(query)) ||
                    (r.sub_dept && r.sub_dept.toLowerCase().includes(query));
                if (!matchQuery) return false;
            }

            if (status !== 'all') {
                const rowStatus = getRowStatus(r);
                if (rowStatus !== status) return false;
            }

            return true;
        });

        currentHasilPage = 1;
        renderHasilTable();
        updateHasilPieStatsView();
    }

    function renderHasilTable() {
        const tbody = document.getElementById('hasil-so-table-body');
        if (!tbody) return;

        if (filteredHasilRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #94a3b8;">Tidak ada data yang cocok.</td></tr>`;
            updateHasilPagination(0);
            return;
        }

        const startIdx = (currentHasilPage - 1) * hasilPageSize;
        const pageRows = filteredHasilRows.slice(startIdx, startIdx + hasilPageSize);

        let html = '';
        pageRows.forEach((r, idx) => {
            const no = startIdx + idx + 1;
            const pct = (r.total_physic_pct !== null && r.total_physic_pct !== undefined)
                ? Number(r.total_physic_pct)
                : (r.pct_physic !== null && r.pct_physic !== undefined ? Number(r.pct_physic) : null);

            let statusBadge = '<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 11px;">Belum Ada Data</span>';
            if (r.status) {
                const s = r.status.toLowerCase();
                const isTidak = r.status_class === 'red' || s.includes('tidak');
                const isOrange = r.status_class === 'orange';
                const isGreen = !isTidak && (r.status_class === 'green' || s.includes('tercapai'));
                const bg = isGreen ? '#dcfce7' : (isOrange ? '#ffedd5' : '#fee2e2');
                const col = isGreen ? '#15803d' : (isOrange ? '#c2410c' : '#b91c1c');
                statusBadge = `<span class="badge" style="background: ${bg}; color: ${col}; font-weight: 700; font-size: 11px;">${r.status}</span>`;
            } else if (pct !== null) {
                if (pct >= 85) {
                    statusBadge = '<span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; font-size: 11px;">Tercapai</span>';
                } else {
                    statusBadge = '<span class="badge" style="background: #fee2e2; color: #b91c1c; font-weight: 700; font-size: 11px;">Tidak Tercapai</span>';
                }
            }

            const pctText = pct !== null ? `${pct}%` : '-';
            const pctColor = pct !== null ? (pct >= 85 ? 'color: #16a34a; font-weight: 700;' : 'color: #dc2626; font-weight: 700;') : 'color: #94a3b8;';

            const qtyMatch = r.match_physic_qty !== undefined ? r.match_physic_qty : (r.qty_match || 0);
            const qtyPhysic = r.physic_physic_qty !== undefined ? r.physic_physic_qty : (r.qty_physic || 0);
            const qtyDb = r.db_physic_qty !== undefined ? r.db_physic_qty : (r.qty_db || 0);
            const qtyActual = r.total_physic_actual !== undefined ? r.total_physic_actual : (r.qty_actual || 0);

            html += `
                <tr>
                    <td style="text-align: center; color: #64748b;">${no}</td>
                    <td style="font-weight: 700; color: #0284c7; text-align: center;">${r.sitecode || '-'}</td>
                    <td style="font-weight: 500; color: #1e293b;">${r.name_site || '-'}</td>
                    <td style="font-size: 11.5px; color: #475569;">${r.dept || '-'} / ${r.sub_dept || '-'}</td>
                    <td style="text-align: right; font-variant-numeric: tabular-nums;">${Number(qtyMatch).toLocaleString('id-ID')}</td>
                    <td style="text-align: right; font-variant-numeric: tabular-nums;">${Number(qtyPhysic).toLocaleString('id-ID')}</td>
                    <td style="text-align: right; font-variant-numeric: tabular-nums;">${Number(qtyDb).toLocaleString('id-ID')}</td>
                    <td style="text-align: right; font-variant-numeric: tabular-nums;">${Number(qtyActual).toLocaleString('id-ID')}</td>
                    <td style="text-align: center; ${pctColor}">${pctText}</td>
                    <td style="text-align: center;">${statusBadge}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        updateHasilPagination(filteredHasilRows.length);
    }

    function renderPaginationControls(container, currentPage, totalPages, clickHandler) {
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

    function updateHasilPagination(total) {
        const info = document.getElementById('hasil-so-table-info');
        const controls = document.getElementById('hasil-so-pagination-controls');
        const totalPages = Math.ceil(total / hasilPageSize) || 1;
        if (info) {
            const start = total > 0 ? (currentHasilPage - 1) * hasilPageSize + 1 : 0;
            const end = Math.min(currentHasilPage * hasilPageSize, total);
            info.textContent = `Menampilkan ${start.toLocaleString('id-ID')} sampai ${end.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} data`;
        }

        renderPaginationControls(controls, currentHasilPage, totalPages, 'AllSummaryApp.goToHasilPage');

        const prevBtn = document.getElementById('hasil-so-prev-btn');
        const nextBtn = document.getElementById('hasil-so-next-btn');
        const pageSpan = document.getElementById('hasil-so-current-page');

        if (prevBtn) prevBtn.disabled = (currentHasilPage <= 1);
        if (nextBtn) nextBtn.disabled = (currentHasilPage >= totalPages);
        if (pageSpan) pageSpan.textContent = `Hal ${currentHasilPage} / ${totalPages}`;
    }

    function goToHasilPage(p) {
        const totalPages = Math.ceil(filteredHasilRows.length / hasilPageSize) || 1;
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;
        currentHasilPage = p;
        renderHasilTable();
    }

    function prevHasilPage() {
        if (currentHasilPage > 1) {
            goToHasilPage(currentHasilPage - 1);
        }
    }

    function nextHasilPage() {
        const totalPages = Math.ceil(filteredHasilRows.length / hasilPageSize) || 1;
        if (currentHasilPage < totalPages) {
            goToHasilPage(currentHasilPage + 1);
        }
    }

    function changeHasilPageSize(size) {
        hasilPageSize = (size === 'all') ? 999999 : (parseInt(size) || 10);
        currentHasilPage = 1;
        renderHasilTable();
    }

    // ── 5. Rekap DB Status Table ──
    let allRdbStatusPage = 1;
    let allRdbStatusPageSize = 10;
    let allRdbStatusTotalPages = 1;

    async function loadRekapDbStatus(month, year, page = 1) {
        const tbody = document.getElementById('rekap-db-status-tbody');
        const info = document.getElementById('all-rdb-status-pagination-info');
        const controls = document.getElementById('all-rdb-status-pagination-controls');
        if (!tbody) return;

        allRdbStatusPage = page;
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">Memuat data status DB...</td></tr>`;

        try {
            const url = `api/rekap_db_status.php?category=all&month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}&page=${allRdbStatusPage}&limit=${allRdbStatusPageSize}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">Gagal memuat data</td></tr>`;
                if (info) info.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
                if (controls) controls.innerHTML = '';
                return;
            }

            const rows = json.data || [];
            const total = json.total !== undefined ? json.total : rows.length;
            allRdbStatusTotalPages = json.total_pages || (Math.ceil(total / allRdbStatusPageSize) || 1);

            if (info) {
                const start = total > 0 ? (allRdbStatusPage - 1) * allRdbStatusPageSize + 1 : 0;
                const end = Math.min(allRdbStatusPage * allRdbStatusPageSize, total);
                info.textContent = `Menampilkan ${start.toLocaleString('id-ID')} sampai ${end.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} data`;
            }
            renderPaginationControls(controls, allRdbStatusPage, allRdbStatusTotalPages, 'AllSummaryApp.goToAllRekapDbStatusPage');

            if (rows.length === 0) {
                const emptyMsg = json.message || 'Tidak ada data status DB pada periode ini.';
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">${escapeHtml(emptyMsg)}</td></tr>`;
                return;
            }

            let html = '';
            rows.forEach((r, idx) => {
                const no = (allRdbStatusPage - 1) * allRdbStatusPageSize + idx + 1;
                const status = (r.status || '').toUpperCase();
                let badgeClass = 'badge ';
                if (status === 'SOLVED') badgeClass += 'badge-success';
                else if (status === 'UNSOLVED') badgeClass += 'badge-warning';
                else badgeClass += 'badge-primary';

                html += `
                    <tr>
                        <td style="text-align: center; color: #64748b;">${no}</td>
                        <td style="font-weight: 700; color: #0284c7; text-align: center;">${r.sitecode || '-'}</td>
                        <td style="font-weight: 500;">${r.name_site || '-'}</td>
                        <td style="font-size: 11.5px; color: #475569;">${r.dept || '-'} / ${r.sub_dept || '-'}</td>
                        <td style="font-size: 11.5px; font-weight: 600;">${r.reg_no || '-'}</td>
                        <td style="font-size: 11.5px; color: #64748b;">${r.name || r.description || '-'}</td>
                        <td style="text-align: center;"><span class="${badgeClass}" style="font-size: 11px;">${status}</span></td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (err) {
            console.error('Error loading rekap db status:', err);
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">Gagal memuat status DB</td></tr>`;
            if (info) info.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
            if (controls) controls.innerHTML = '';
        }
    }

    function goToAllRekapDbStatusPage(p) {
        if (p < 1) p = 1;
        if (allRdbStatusTotalPages > 0 && p > allRdbStatusTotalPages) p = allRdbStatusTotalPages;
        const monthEl = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const month = monthEl ? monthEl.value : '';
        const yearEl = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
        const year = yearEl ? yearEl.value : '2026';
        loadRekapDbStatus(month, year, p);
    }

    // ── 6. Rekapitulasi Table (All Sites) ──
    async function loadRekapitulasi(year) {
        const tbody = document.getElementById('all-rekap-table-body');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 2rem; color: #94a3b8;">Memuat data Rekapitulasi...</td></tr>`;

        try {
            const url = `api/rekapitulasi.php?category=all&so_type=${summarySOType}&year=${year}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) {
                tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 2rem; color: #ef4444;">Gagal memuat Rekapitulasi</td></tr>`;
                return;
            }

            allRekapRows = json.data || json.rows || [];
            applyRekapFilter();
        } catch (err) {
            console.error('Error loading rekapitulasi:', err);
            tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 2rem; color: #ef4444;">Kesalahan jaringan</td></tr>`;
        }
    }

    function applyRekapFilter() {
        const query = (document.getElementById('all-rekap-search')?.value || '').toLowerCase().trim();

        filteredRekapRows = allRekapRows.filter(r => {
            if (!query) return true;
            return (r.sitecode && r.sitecode.toLowerCase().includes(query)) ||
                (r.name_site && r.name_site.toLowerCase().includes(query)) ||
                (r.dept && r.dept.toLowerCase().includes(query)) ||
                (r.sub_dept && r.sub_dept.toLowerCase().includes(query));
        });

        currentRekapPage = 1;
        renderRekapTable();
    }

    function renderRekapTable() {
        const tbody = document.getElementById('all-rekap-table-body');
        if (!tbody) return;

        if (filteredRekapRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 2rem; color: #94a3b8;">Tidak ada data yang cocok.</td></tr>`;
            updateRekapPagination(0);
            return;
        }

        const startIdx = (currentRekapPage - 1) * rekapPageSize;
        const pageRows = filteredRekapRows.slice(startIdx, startIdx + rekapPageSize);

        let html = '';
        pageRows.forEach((r, idx) => {
            const no = startIdx + idx + 1;
            const months = r.months || {};

            let monthCols = '';
            for (let m = 1; m <= 12; m++) {
                const val = months[m];
                const pct = (val !== null && val !== undefined) ? `${val}%` : '-';
                const cellBg = (val !== null && val !== undefined) ? (val >= 85 ? 'background: #f0fdf4; color: #16a34a; font-weight: 700;' : 'background: #fef2f2; color: #dc2626; font-weight: 700;') : 'color: #94a3b8;';
                monthCols += `<td style="text-align: center; font-size: 11.5px; ${cellBg}">${pct}</td>`;
            }

            html += `
                <tr>
                    <td style="text-align: center; color: #64748b;">${no}</td>
                    <td style="font-weight: 700; color: #0284c7;">${r.sitecode || '-'}</td>
                    <td style="font-weight: 500; color: #1e293b;">${r.name_site || '-'}</td>
                    <td style="font-size: 11.5px; color: #475569;">${r.dept || '-'} / ${r.sub_dept || '-'}</td>
                    ${monthCols}
                </tr>
            `;
        });

        tbody.innerHTML = html;
        updateRekapPagination(filteredRekapRows.length);
    }

    function updateRekapPagination(total) {
        const info = document.getElementById('all-rekap-table-info') || document.getElementById('rekap-table-info');
        const controls = document.getElementById('all-rekap-pagination-controls') || document.getElementById('rekap-pagination-controls');
        const totalPages = Math.ceil(total / rekapPageSize) || 1;
        if (info) {
            const start = total > 0 ? (currentRekapPage - 1) * rekapPageSize + 1 : 0;
            const end = Math.min(currentRekapPage * rekapPageSize, total);
            info.textContent = `Menampilkan ${start.toLocaleString('id-ID')} sampai ${end.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} data`;
        }

        renderPaginationControls(controls, currentRekapPage, totalPages, 'AllSummaryApp.goToAllRekapPage');

        const prevBtn = document.getElementById('all-rekap-prev-btn') || document.getElementById('rekap-prev-btn');
        const nextBtn = document.getElementById('all-rekap-next-btn') || document.getElementById('rekap-next-btn');
        const pageSpan = document.getElementById('all-rekap-current-page') || document.getElementById('rekap-current-page');

        if (prevBtn) prevBtn.disabled = (currentRekapPage <= 1);
        if (nextBtn) nextBtn.disabled = (currentRekapPage >= totalPages);
        if (pageSpan) pageSpan.textContent = `Hal ${currentRekapPage} / ${totalPages}`;
    }

    function goToAllRekapPage(p) {
        const totalPages = Math.ceil(filteredRekapRows.length / rekapPageSize) || 1;
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;
        currentRekapPage = p;
        renderRekapTable();
    }

    function prevRekapPage() {
        if (currentRekapPage > 1) {
            goToAllRekapPage(currentRekapPage - 1);
        }
    }

    function nextRekapPage() {
        const totalPages = Math.ceil(filteredRekapRows.length / rekapPageSize) || 1;
        if (currentRekapPage < totalPages) {
            goToAllRekapPage(currentRekapPage + 1);
        }
    }

    function changeRekapPageSize(size) {
        rekapPageSize = (size === 'all') ? 999999 : (parseInt(size) || 10);
        currentRekapPage = 1;
        renderRekapTable();
    }

    function exportRekapExcel() {
        const year = document.getElementById('all-summary-filter-year')?.value || '2026';
        window.location.href = `api/export_rekapitulasi.php?category=all&so_type=${summarySOType}&year=${year}`;
    }

    // ── 7. Site Movements (History & Log) ──
    let allMovementsData = [];
    let filteredMovementsData = [];
    let isMovementDetailsVisible = false;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function loadSiteMovements(year, month) {
        const badgeTotal = document.getElementById('all-sm-badge-total');
        const periodSub = document.getElementById('all-sm-period-subtitle');
        const tbody = document.getElementById('all-sm-table-body');

        const curYear = year || (document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year'))?.value || 2026;
        const curMonth = (month !== undefined && month !== null) ? month : ((document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month'))?.value ?? '');

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
            const statMovements = document.getElementById('all-sm-stat-movements');
            if (statMovements) statMovements.textContent = summary.total_movements || 0;

            const renderDiffBadge = (diff, invertColors = false) => {
                if (diff === null || diff === undefined || diff === 0) {
                    return `<span class="kpi-target-indicator target-neutral" title="Tidak ada perubahan"><span>-</span></span>`;
                }
                const isGood = invertColors ? (diff < 0) : (diff > 0);
                const cls = isGood ? 'target-up' : 'target-down';
                const formatted = diff > 0 ? `+${diff}` : `${diff}`;
                const arrowSvg = diff > 0
                    ? `<svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,4 21,20 3,20"></polygon></svg>`
                    : `<svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;"><polygon points="12,20 3,4 21,4"></polygon></svg>`;
                return `
                    <span class="kpi-target-indicator ${cls}" title="${formatted} vs bulan sebelumnya">
                        ${arrowSvg}
                        <span>${formatted}</span>
                    </span>
                `;
            };

            const statActive = document.getElementById('all-sm-stat-active');
            const statActiveDiff = document.getElementById('all-sm-stat-active-diff');
            if (statActive) statActive.textContent = summary.current_active || 0;
            if (statActiveDiff) {
                statActiveDiff.innerHTML = renderDiffBadge(summary.active_diff, false);
            }

            const statMonthly = document.getElementById('all-sm-stat-monthly');
            const statMonthlyDiff = document.getElementById('all-sm-stat-monthly-diff');
            if (statMonthly) statMonthly.textContent = summary.current_monthly || 0;
            if (statMonthlyDiff) {
                statMonthlyDiff.innerHTML = renderDiffBadge(summary.monthly_diff, false);
            }

            const statQuarterly = document.getElementById('all-sm-stat-quarterly');
            const statQuarterlyDiff = document.getElementById('all-sm-stat-quarterly-diff');
            if (statQuarterly) statQuarterly.textContent = summary.current_quarterly || 0;
            if (statQuarterlyDiff) {
                statQuarterlyDiff.innerHTML = renderDiffBadge(summary.quarterly_diff, false);
            }

            const statInactive = document.getElementById('all-sm-stat-inactive');
            const statInactiveDiff = document.getElementById('all-sm-stat-inactive-diff');
            if (statInactive) statInactive.textContent = summary.current_inactive || 0;
            if (statInactiveDiff) {
                statInactiveDiff.innerHTML = renderDiffBadge(summary.inactive_diff, true);
            }

            // 3. Render Table (respect active search filter)
            const searchInput = document.getElementById('all-sm-search-input');
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
        const tbody = document.getElementById('all-sm-table-body');
        const infoEl = document.getElementById('all-sm-table-info');
        if (!tbody) return;

        const curYear = (document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year'))?.value || 2026;
        const monthSelect = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const monthText = (monthSelect && monthSelect.value) ? monthSelect.options[monthSelect.selectedIndex].text : 'Tahun Ini';
        const hasSearch = Boolean(document.getElementById('all-sm-search-input')?.value?.trim());

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
                            <button type="button" class="btn btn-outline-primary btn-sm" onclick="AllSummaryApp.viewAllYearMovements()" style="margin-top: 12px; font-size: 12px; padding: 4px 12px;">
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
        const query = (document.getElementById('all-sm-search-input')?.value || '').toLowerCase().trim();
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
        const container = document.getElementById('all-sm-card-body-wrapper') || document.getElementById('all-sm-table-container');
        const textEl = document.getElementById('all-sm-toggle-text');
        const arrowEl = document.getElementById('all-sm-toggle-arrow');
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
        const year = (document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year'))?.value || 2026;
        const monthSel = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        if (monthSel) monthSel.value = '';
        loadSiteMovements(year, '');
    }

    return {
        init,
        switchSOType,
        loadAllSummary,
        applyHasilFilter,
        goToHasilPage,
        prevHasilPage,
        nextHasilPage,
        changeHasilPageSize,
        applyRekapFilter,
        goToAllRekapPage,
        prevRekapPage,
        nextRekapPage,
        changeRekapPageSize,
        exportRekapExcel,
        loadRekapDbStatus,
        goToAllRekapDbStatusPage,
        filterMovementsTable,
        toggleMovementDetails,
        viewAllYearMovements,
        loadSiteMovements,
        toggleHasilStatusFilter
    };
})();

// Auto-run if page-all-summary is active
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const sec = document.getElementById('page-all-summary');
        if (sec && (sec.classList.contains('active') || sec.style.display !== 'none')) {
            AllSummaryApp.init();
        }
    });
} else {
    const sec = document.getElementById('page-all-summary');
    if (sec && (sec.classList.contains('active') || sec.style.display !== 'none')) {
        AllSummaryApp.init();
    }
}
