/**
 * All Summary Page JavaScript
 * Admin View: Shows consolidated data for ALL sites (no category breakdown)
 * Supports Monthly and Quarterly SO types.
 */
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
            if (el.hasAttribute('title')) el.removeAttribute('title');
            el = el.parentElement;
        }
    }, true);

    document.addEventListener('pointerover', function (e) {
        let el = e.target;
        while (el && el !== document && el.nodeType === 1) {
            if (el.hasAttribute('title')) el.removeAttribute('title');
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

const AllSummaryApp = (function () {
    let summarySOType = 'monthly';
    const summaryCategory = 'all';
    let chartTrendAll = null;
    let chartTrendDivWh = null;
    let ratingPieChart = null;
    let execPieChart = null;
    let hasilPieChart = null;
    let allRekapAverageChart = null;
    let hasilStats = { tercapai: 0, tidakTercapai: 0, noData: 0, total: 0 };

    let allHasilRows = [];
    let filteredHasilRows = [];
    let currentHasilPage = 1;
    let hasilPageSize = 10;
    let hasilDeptFilter = 'all';
    let hasilSubDeptFilter = 'all';
    let hasilDeptSubDeptMap = {};

    let allRekapRows = [];
    let filteredRekapRows = [];
    let currentRekapPage = 1;
    let rekapPageSize = 10;
    let allRekapDeptFilter = 'all';
    let allRekapSubDeptFilter = 'all';
    let allRekapDeptSubDeptMap = {};

    let movementsData = [];

    let isInitialized = false;

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
        const monthSelect = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
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

    // ── Initialization ──
    function init() {
        const pageEl = document.getElementById('page-all-summary') || document.getElementById('card-executive-summary');
        if (!pageEl) return;

        // Restore SO Type from sessionStorage
        const savedSOType = sessionStorage.getItem('all_summary_so_type');
        if (savedSOType === 'quarterly' || savedSOType === 'monthly') {
            summarySOType = savedSOType;
            const btnMonthly = document.getElementById('all-btn-so-type-monthly');
            const btnQuarterly = document.getElementById('all-btn-so-type-quarterly');
            if (btnMonthly) btnMonthly.classList.toggle('active', summarySOType === 'monthly');
            if (btnQuarterly) btnQuarterly.classList.toggle('active', summarySOType === 'quarterly');

            const titleEl = document.getElementById('all-rekap-chart-title');
            if (titleEl) {
                const prefix = (summarySOType === 'quarterly') ? 'Quarterly' : 'Monthly';
                titleEl.textContent = `${prefix} Target Achievement (All Sites)`;
            }
        }

        // Update BULAN dropdown options to match SO Type (Monthly = 12 months, Quarterly = per 3 months)
        updateSummaryMonthDropdown();

        const monthSel = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const yearSel = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');

        const savedMonth = sessionStorage.getItem('all_summary_filter_month');
        const savedYear = sessionStorage.getItem('all_summary_filter_year');

        if (savedMonth !== null && savedMonth !== undefined && monthSel) {
            const optionsList = summarySOType === 'quarterly' ? MONTHS_QUARTERLY : MONTHS_MONTHLY;
            if (optionsList.some(o => o.val === savedMonth)) {
                monthSel.value = savedMonth;
            }
        } else if (monthSel && !isInitialized && monthSel.value === '') {
            monthSel.value = '9';
        }

        if (savedYear && yearSel) {
            yearSel.value = savedYear;
        } else if (yearSel && !yearSel.value) {
            yearSel.value = '2026';
        }
        isInitialized = true;

        loadAllSummary();
    }

    // ── SO Type Switch ──
    function switchSOType(type) {
        if (type !== 'monthly' && type !== 'quarterly') type = 'monthly';
        summarySOType = type;

        try {
            sessionStorage.setItem('all_summary_so_type', summarySOType);
        } catch (e) { }

        const btnMonthly = document.getElementById('all-btn-so-type-monthly');
        const btnQuarterly = document.getElementById('all-btn-so-type-quarterly');
        if (btnMonthly) btnMonthly.classList.toggle('active', type === 'monthly');
        if (btnQuarterly) btnQuarterly.classList.toggle('active', type === 'quarterly');

        const titleEl = document.getElementById('all-rekap-chart-title');
        if (titleEl) {
            const prefix = (type === 'quarterly') ? 'Quarterly' : 'Monthly';
            titleEl.textContent = `${prefix} Target Achievement (All Sites)`;
        }

        // Update BULAN dropdown based on SO Type (Monthly = 12 months, Quarterly = per 3 months)
        updateSummaryMonthDropdown();

        loadAllSummary();
    }

    // ── Master Loader ──
    async function loadAllSummary() {
        const monthEl = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const month = monthEl ? monthEl.value : '';
        const yearEl = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
        const year = yearEl ? yearEl.value : '2026';

        try {
            if (month !== undefined && month !== null) sessionStorage.setItem('all_summary_filter_month', month);
            if (year) sessionStorage.setItem('all_summary_filter_year', year);
        } catch (e) { }

        // Update period badge
        const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const badge = document.getElementById('all-executive-period-badge') || document.getElementById('executive-period-badge');
        if (badge) {
            const mText = month ? `${monthNames[parseInt(month)] || ''}` : 'Semua Bulan';
            const pLabel = (summarySOType === 'quarterly')
                ? `${mText} ${year} (Quarterly)`
                : `${mText} ${year}`;
            badge.textContent = pLabel;
        }

        // Run data loaders in parallel
        await Promise.allSettled([
            loadSummaryKPIs(month, year),
            loadTrendChart(year, month),
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
                ? Number(nat.pct).toFixed(2)
                : ((ach.summary_achievement !== null && ach.summary_achievement !== undefined) ? Number(ach.summary_achievement).toFixed(2) : '0.00');
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
                let diffPct = null;
                if (nat.diff_pct !== undefined && nat.diff_pct !== null) {
                    diffPct = Number(nat.diff_pct);
                } else if (nat.prev_pct !== undefined && nat.prev_pct !== null && nat.pct !== null && nat.pct !== undefined) {
                    diffPct = Number(nat.pct) - Number(nat.prev_pct);
                }

                if (diffPct !== null) {
                    const isUp = diffPct > 0;
                    const isDown = diffPct < 0;
                    const sign = isUp ? '+' : '';
                    const trendClass = isUp ? 'target-up' : (isDown ? 'target-down' : 'target-neutral');
                    const svg = isUp
                        ? `<svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle;"><polygon points="12,4 21,20 3,20"/></svg>`
                        : (isDown ? `<svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle;"><polygon points="12,20 3,4 21,4"/></svg>` : '');
                    trendEl.innerHTML = `
                        <span class="kpi-target-indicator ${trendClass}">
                            ${svg}
                            <span>${sign}${diffPct.toFixed(2)}%</span>
                        </span>
                    `;
                } else {
                    trendEl.innerHTML = `
                        <span class="kpi-target-indicator target-neutral">
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

            // Result DB Analysis Grand Total
            ['all-db-analysis-grand-total', 'db-analysis-grand-total', 'all-db-val-total', 'all-strip-db-val-total'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = Number(grandTotal).toLocaleString('id-ID');
            });

            const diffQty = (dbNat.diff_qty !== undefined && dbNat.diff_qty !== null) ? Number(dbNat.diff_qty) : (dbA.diff_grand_total !== undefined ? Number(dbA.diff_grand_total) : null);
            const prevQty = (dbNat.prev_qty !== undefined && dbNat.prev_qty !== null) ? Number(dbNat.prev_qty) : null;
            const hasPrev = dbA.has_previous || (diffQty !== null);

            const renderDbTrend = () => {
                if (!hasPrev || diffQty === null) {
                    return `<span class="db-trend-indicator db-trend-neutral"><span>-</span></span>`;
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
                    <span class="db-trend-indicator ${trendClass}">
                        ${svg}
                        <span>${formatted} vs Prev</span>
                    </span>
                `;
            };

            const trendHtml = renderDbTrend();
            ['all-db-grand-trend', 'db-grand-trend', 'all-db-card-trend', 'all-strip-db-grand-trend', 'all-strip-db-card-trend'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = trendHtml;
            });

            // Status DB Counts
            const solved = dbNat.solved !== undefined ? dbNat.solved : (dbA.outlet_national?.solved || 0);
            const unsolved = dbNat.unsolved !== undefined ? dbNat.unsolved : (dbA.outlet_national?.unsolved || 0);
            const newDb = dbNat.new_db !== undefined ? dbNat.new_db : (dbA.outlet_national?.new_db || 0);

            // Status Penyelesaian DB: Total DB is counted Solved DB, Unsolved DB and New DB
            const totalStatusDb = (dbNat.total_status !== undefined && dbNat.total_status !== null)
                ? Number(dbNat.total_status)
                : (Number(solved || 0) + Number(unsolved || 0) + Number(newDb || 0));

            ['all-db-status-grand-total', 'db-status-grand-total'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = Number(totalStatusDb).toLocaleString('id-ID');
            });

            // Status Total Trend (Solved + Unsolved + New DB vs previous period)
            let prevStatusTotal = null;
            if (dbNat.prev_total_status !== undefined && dbNat.prev_total_status !== null) {
                prevStatusTotal = Number(dbNat.prev_total_status);
            } else if (dbNat.prev_solved !== undefined && dbNat.prev_solved !== null &&
                dbNat.prev_unsolved !== undefined && dbNat.prev_unsolved !== null &&
                dbNat.prev_new_db !== undefined && dbNat.prev_new_db !== null) {
                prevStatusTotal = Number(dbNat.prev_solved) + Number(dbNat.prev_unsolved) + Number(dbNat.prev_new_db);
            }
            let diffStatusTotal = null;
            if (dbNat.diff_total_status !== undefined && dbNat.diff_total_status !== null) {
                diffStatusTotal = Number(dbNat.diff_total_status);
            } else if (prevStatusTotal !== null) {
                diffStatusTotal = totalStatusDb - prevStatusTotal;
            }

            const renderStatusTotalTrend = () => {
                if (diffStatusTotal === null || !hasPrev) {
                    return `<span class="db-trend-indicator db-trend-neutral"><span>-</span></span>`;
                }
                const sign = diffStatusTotal > 0 ? '+' : '';
                const isPos = diffStatusTotal > 0;
                const isNeg = diffStatusTotal < 0;
                const trendClass = isNeg ? 'db-trend-good-down' : (isPos ? 'db-trend-bad-up' : 'db-trend-neutral');
                const svg = isPos
                    ? `<svg width="7.5" height="7.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,4 21,20 3,20"/></svg>`
                    : (isNeg ? `<svg width="7.5" height="7.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,20 3,4 21,4"/></svg>` : '');
                const formatted = `${sign}${Number(diffStatusTotal).toLocaleString('id-ID')}`;
                return `
                    <span class="db-trend-indicator ${trendClass}">
                        ${svg}
                        <span>${formatted} vs Prev</span>
                    </span>
                `;
            };

            const statusTrendHtml = renderStatusTotalTrend();
            ['all-db-status-grand-trend', 'db-status-grand-trend', 'all-strip-db-status-grand-trend'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = statusTrendHtml;
            });

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

            // Update Column 3: Ringkasan DB Analysis (All Sites)
            const solvedRate = totalStatusDb > 0 ? ((Number(solved || 0) / totalStatusDb) * 100) : 0;
            const unsolvedRate = totalStatusDb > 0 ? ((Number(unsolved || 0) / totalStatusDb) * 100) : 0;
            const newDbRate = totalStatusDb > 0 ? ((Number(newDb || 0) / totalStatusDb) * 100) : 0;

            const elAllRateBadge = document.getElementById('all-db-summary-rate-badge');
            if (elAllRateBadge) elAllRateBadge.textContent = `${solvedRate.toFixed(2)}% Solved`;

            const elAllRateText = document.getElementById('all-db-summary-rate-text');
            if (elAllRateText) elAllRateText.textContent = `${solvedRate.toFixed(2)}%`;

            const elAllBarSolved = document.getElementById('all-db-summary-bar-solved');
            if (elAllBarSolved) elAllBarSolved.style.width = `${Math.min(100, solvedRate)}%`;

            const elAllBarUnsolved = document.getElementById('all-db-summary-bar-unsolved');
            if (elAllBarUnsolved) elAllBarUnsolved.style.width = `${Math.min(100, unsolvedRate)}%`;

            const elAllBarNew = document.getElementById('all-db-summary-bar-new');
            if (elAllBarNew) elAllBarNew.style.width = `${Math.min(100, newDbRate)}%`;

            const elAllSumSolved = document.getElementById('all-db-summary-val-solved');
            if (elAllSumSolved) elAllSumSolved.textContent = Number(solved || 0).toLocaleString('id-ID');
            const elAllSumPctSolved = document.getElementById('all-db-summary-pct-solved');
            if (elAllSumPctSolved) elAllSumPctSolved.textContent = `(${solvedRate.toFixed(2)}%)`;

            const elAllSumUnsolved = document.getElementById('all-db-summary-val-unsolved');
            if (elAllSumUnsolved) elAllSumUnsolved.textContent = Number(unsolved || 0).toLocaleString('id-ID');
            const elAllSumPctUnsolved = document.getElementById('all-db-summary-pct-unsolved');
            if (elAllSumPctUnsolved) elAllSumPctUnsolved.textContent = `(${unsolvedRate.toFixed(2)}%)`;

            const elAllSumNew = document.getElementById('all-db-summary-val-new');
            if (elAllSumNew) elAllSumNew.textContent = Number(newDb || 0).toLocaleString('id-ID');
            const elAllSumPctNew = document.getElementById('all-db-summary-pct-new');
            if (elAllSumPctNew) elAllSumPctNew.textContent = `(${newDbRate.toFixed(2)}%)`;

            const elAllSumStatTotal = document.getElementById('all-db-summary-stat-status-total');
            if (elAllSumStatTotal) elAllSumStatTotal.textContent = Number(totalStatusDb).toLocaleString('id-ID');

            const elAllDbPeriodBadge = document.getElementById('all-db-analysis-period-badge');
            const elAllExecBadge = document.getElementById('all-executive-period-badge');
            if (elAllDbPeriodBadge && elAllExecBadge) elAllDbPeriodBadge.textContent = elAllExecBadge.textContent;

        } catch (err) {
            console.error('Error loading summary KPIs:', err);
        }
    }

    function toggleDbBreakdownPanel() {
        const panel = document.getElementById('all-db-breakdown-panel');
        const text = document.getElementById('all-db-breakdown-toggle-text');
        if (!panel) return;
        const isHidden = (panel.style.display === 'none' || panel.style.display === '' || window.getComputedStyle(panel).display === 'none');
        panel.style.display = isHidden ? 'block' : 'none';
        if (text) {
            text.textContent = isHidden ? 'Sembunyikan Breakdown ▲' : 'Tampilkan Breakdown ▼';
        }
    }
    window.AllSummaryApp_toggleDbBreakdownPanel = toggleDbBreakdownPanel;

    // ── 2. Trend Line Chart (Count All) ──
    async function loadTrendChart(year, month) {
        if (typeof Chart === 'undefined') return;

        // Support either argument order (month, year) or (year, month)
        if (typeof year === 'string' && year.length <= 2 && month && String(month).length === 4) {
            const temp = year;
            year = month;
            month = temp;
        }
        if (!month) {
            const monthEl = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
            month = monthEl ? monthEl.value : '';
        }

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

            const fullLabels = json.months || (summarySOType === 'quarterly' ? ['Q1', 'Q2', 'Q3', 'Q4'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
            const fullData = json.national_trend || [];

            let maxIdx = -1;
            for (let i = fullData.length - 1; i >= 0; i--) {
                if (fullData[i] !== null && fullData[i] !== undefined && !isNaN(fullData[i])) {
                    maxIdx = i;
                    break;
                }
            }
            if (maxIdx === -1 && json.dept_trends) {
                Object.values(json.dept_trends).forEach(arr => {
                    if (Array.isArray(arr)) {
                        for (let i = arr.length - 1; i >= 0; i--) {
                            if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i]) && i > maxIdx) {
                                maxIdx = i;
                            }
                        }
                    }
                });
            }

            const labels = (maxIdx >= 0) ? fullLabels.slice(0, maxIdx + 1) : fullLabels;
            const data = (maxIdx >= 0) ? fullData.slice(0, maxIdx + 1) : fullData;

            if (subtitleEl) {
                const endLabel = labels[labels.length - 1] || (summarySOType === 'quarterly' ? 'Q4' : 'Dec');
                const startLabel = labels[0] || (summarySOType === 'quarterly' ? 'Q1' : 'Jan');
                subtitleEl.textContent = (summarySOType === 'monthly')
                    ? `Monthly Physical % ${startLabel} - ${endLabel} ${year} (All Sites)`
                    : `Quarterly Physical % ${startLabel} - ${endLabel} ${year} (All Sites)`;
            }

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
                                label: ctx => ` All Sites: ${ctx.parsed.y !== null ? (typeof ctx.parsed.y === 'number' ? ctx.parsed.y.toFixed(2) : ctx.parsed.y) + '%' : 'Tidak Ada Data'}`
                            }
                        }
                    }
                }
            });

            // ── 2b. Trend Achievement SO: Division & Warehouse (3 Months Backdate) ──
            renderTrendDivWhChart(json, month, year);

        } catch (err) {
            console.error('Error loading trend chart:', err);
        }
    }

    // Helper: 3 Months Backdate calculation (identical to Stock Opname Rating in app.js)
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
                    quarter: tq,
                    year: ty,
                    label: `Q${tq}`,
                    fullName: `Q${tq} ${ty}`,
                    monthName: `Q${tq}`
                });
            }
            return quarters;
        }

        const months = [];
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

    // ── 2b. Vertical Bar Chart: Each Month Grouping (PMD, CRO, WRO, etc.) ──
    function renderTrendDivWhChart(json, month, year) {
        if (typeof Chart === 'undefined') return;

        const canvas = document.getElementById('all-chart-trend-div-wh') || document.getElementById('chart-trend-div-wh');
        if (!canvas) return;

        if (chartTrendDivWh) {
            chartTrendDivWh.destroy();
            chartTrendDivWh = null;
        }

        if (!json || !json.success) return;

        const isQuarterly = (summarySOType === 'quarterly');
        const divWhTrends = json.division_warehouse_trends || {};

        // Calculate the exact 3 backdate periods (Stock Opname Rating style)
        const periods = getThreeMonthsBack(year, month);
        if (!periods || periods.length === 0) return;

        // X-Axis: Grouped by each of the 3 backdate months/quarters (Capitalized)
        const chartLabels = periods.map(p => (p.fullName || `${p.label} ${p.year}`).toUpperCase());

        // The 9 entities with slightly lighter, fresher enterprise colors (warna sedikit lebih muda)
        const entitiesConfig = [
            { key: 'PMD', label: 'PMD', fullName: 'DIVISI PMD', color: '#6366f1' },
            { key: 'CRO', label: 'CRO', fullName: 'OUTLET REGIONAL CRO', color: '#3b82f6' },
            { key: 'WRO', label: 'WRO', fullName: 'OUTLET REGIONAL WRO', color: '#0ea5e9' },
            { key: 'ERO', label: 'ERO', fullName: 'OUTLET REGIONAL ERO', color: '#14b8a6' },
            { key: 'Warehouse HUB BALIKPAPAN', label: 'HUB BALIKPAPAN', fullName: 'WAREHOUSE HUB BALIKPAPAN', color: '#f97316' },
            { key: 'Warehouse HUB MEDAN', label: 'HUB MEDAN', fullName: 'WAREHOUSE HUB MEDAN', color: '#8b5cf6' },
            { key: 'Warehouse HUB PALEMBANG', label: 'HUB PALEMBANG', fullName: 'WAREHOUSE HUB PALEMBANG', color: '#f59e0b' },
            { key: 'Warehouse HUB SURABAYA', label: 'HUB SURABAYA', fullName: 'WAREHOUSE HUB SURABAYA', color: '#10b981' },
            { key: 'Warehouse TEKNO (50002003289)', label: 'WAREHOUSE TEKNO', fullName: 'WAREHOUSE TEKNO (50002003289)', color: '#64748b' }
        ];

        // 9 datasets (1 per entity), each has 3 data points corresponding to the 3 months/quarters on X-axis
        let datasets = entitiesConfig.map(e => {
            const series = divWhTrends[e.key] || [];
            const data = periods.map(p => {
                const dataIdx = isQuarterly ? (p.quarter - 1) : (p.month - 1);
                const val = (dataIdx >= 0 && dataIdx < series.length) ? series[dataIdx] : null;
                return (val !== null && val !== undefined) ? Number(val) : null;
            });

            return {
                label: e.label,
                fullName: e.fullName,
                data: data,
                backgroundColor: e.color,
                borderWidth: 0,
                borderRadius: { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 },
                barPercentage: 0.9,
                categoryPercentage: 0.82
            };
        });

        // Filter out entities whose bar chart has no data (all null/undefined across the periods)
        // Di quarterly, entitas seperti PMD, CRO, dan Warehouse Tekno tidak ada di bar chart, maka dihapus dari label/legend dan chart
        if (isQuarterly) {
            datasets = datasets.filter(ds => ds.data.some(val => val !== null && val !== undefined));
        }

        // Subtitle & Badge
        const subtitleEl = document.getElementById('all-trend-div-wh-subtitle') || document.getElementById('trend-div-wh-subtitle');
        const badgeEl = document.getElementById('all-trend-div-wh-badge') || document.getElementById('trend-div-wh-badge');

        const firstP = periods[0];
        const lastP = periods[periods.length - 1];
        let periodBadgeText = '';
        if (firstP.year === lastP.year) {
            periodBadgeText = `${firstP.monthName} - ${lastP.monthName} ${lastP.year}`;
        } else {
            periodBadgeText = `${firstP.monthName} ${firstP.year} - ${lastP.monthName} ${lastP.year}`;
        }

        if (subtitleEl) {
            if (isQuarterly) {
                const activeNames = datasets.map(d => d.label).join(', ');
                subtitleEl.textContent = `Pencapaian Fisik (%) per Quarter - ${activeNames || 'WRO, ERO & Warehouse HUB'}`;
            } else {
                subtitleEl.textContent = `Pencapaian Fisik (%) per Bulan - PMD, CRO, WRO, ERO, HUB & Warehouse Tekno`;
            }
        }
        if (badgeEl) {
            badgeEl.textContent = periodBadgeText;
        }

        // Vertical percentage text inside each bar - crisp, solid, no shadow
        const verticalValuePlugin = {
            id: 'trendDivWhVerticalValuePlugin',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (meta.hidden) return;

                    meta.data.forEach((barElement, index) => {
                        const rawVal = dataset.data[index];
                        if (rawVal === null || rawVal === undefined || isNaN(rawVal)) return;

                        const val = Number(rawVal).toFixed(2);
                        const text = `${val}%`;
                        const { x, y, base } = barElement;
                        const barHeight = Math.abs(base - y);
                        const bWidth = barElement.width || 24;
                        const fontSize = Math.min(13.5, Math.max(11, Math.round(bWidth * 0.58)));

                        ctx.save();
                        ctx.font = `700 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                        ctx.textBaseline = 'middle';

                        const minInsideHeight = fontSize * 2.5;
                        if (barHeight >= minInsideHeight) {
                            // Position vertically inside the bar with generous size
                            const textHalfLen = (text.length >= 4) ? (fontSize * 1.5) : (fontSize * 1.2);
                            const topPadding = 10;
                            const posY = (barHeight >= textHalfLen * 2 + topPadding * 2)
                                ? (y + topPadding + textHalfLen)
                                : (y + barHeight / 2);
                            ctx.translate(x, posY);
                            ctx.rotate(-Math.PI / 2);
                            ctx.textAlign = 'center';
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText(text, 0, 0);
                        } else if (barHeight > 0) {
                            // Short bar, place cleanly starting above the bar pointing upwards
                            ctx.translate(x, y - 5);
                            ctx.rotate(-Math.PI / 2);
                            ctx.textAlign = 'left';
                            ctx.fillStyle = '#1e293b';
                            ctx.fillText(text, 0, 0);
                        } else {
                            // 0% bar
                            ctx.translate(x, base - 5);
                            ctx.rotate(-Math.PI / 2);
                            ctx.textAlign = 'left';
                            ctx.fillStyle = '#94a3b8';
                            ctx.fillText(text, 0, 0);
                        }
                        ctx.restore();
                    });
                });
            }
        };

        // Target 98% dashed line plugin (positioned in the far right padding so bar charts are never covered)
        const targetLinePlugin = {
            id: 'trendDivWhTargetLinePlugin',
            afterDraw(chart) {
                const target = 98;
                const { ctx, chartArea, scales: { y } } = chart;
                if (!chartArea || !y) return;

                const yPixel = y.getPixelForValue(target);
                if (isNaN(yPixel)) return;

                ctx.save();

                // Target Label Badge parameters
                const text = `TARGET ${target}%`;
                ctx.font = '600 10px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                const textMetrics = ctx.measureText(text);
                const textWidth = textMetrics.width;
                const padX = 6;
                const badgeHeight = 17;
                const badgeWidth = textWidth + padX * 2;

                // Place badge in the right padding area (at the far right edge of the chart)
                // so it never covers the bars
                const badgeX = Math.min(chartArea.right + 8, chart.width - badgeWidth - 4);
                let badgeY = yPixel - badgeHeight / 2;
                if (badgeY < chartArea.top - 2) {
                    badgeY = chartArea.top - 2;
                } else if (badgeY + badgeHeight > chartArea.bottom + 2) {
                    badgeY = chartArea.bottom - badgeHeight;
                }

                // 1. Draw dashed line across the chart width and extending up to the badge
                ctx.beginPath();
                ctx.setLineDash([5, 4]);
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 1.5;
                ctx.moveTo(chartArea.left, yPixel);
                ctx.lineTo(badgeX - 3, yPixel);
                ctx.stroke();

                // 2. Pill background on the far right (white with crisp red border)
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
                    ctx.quadraticCurveTo(badgeX, badgeY + r, badgeX + r, badgeY);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // 3. Badge text
                ctx.fillStyle = '#dc2626';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 0.5);

                ctx.restore();
            }
        };

        const ctx = canvas.getContext('2d');
        chartTrendDivWh = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 26, right: 88, bottom: 6, left: 6 }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            callback: val => `${val}%`,
                            font: { size: 10.5, family: 'Inter' },
                            color: '#64748b'
                        },
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 12, family: 'Inter', weight: '700' },
                            color: '#0f172a',
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            pointStyle: 'rectRounded',
                            font: { size: 11, family: 'Inter', weight: '600' },
                            color: '#334155',
                            padding: 14
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleFont: { size: 11, weight: '700', family: 'Inter' },
                        bodyFont: { size: 11, family: 'Inter' },
                        padding: 10,
                        cornerRadius: 6,
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        callbacks: {
                            title: function (items) {
                                if (!items.length) return '';
                                return items[0].label;
                            },
                            label: function (context) {
                                const ds = context.dataset;
                                const name = ds.fullName || ds.label;
                                const val = context.parsed.y;
                                return ` ${name}: ${val !== null && val !== undefined ? (typeof val === 'number' ? Number(val).toFixed(2) : val) + '%' : 'Tidak Ada Data'}`;
                            }
                        }
                    }
                }
            },
            plugins: [verticalValuePlugin, targetLinePlugin]
        });
    }

    // ── 3. Score Card Summary (All Sites) ──
    let scorecardRawData = null;
    let scorecardDeptFilter = 'all';
    let scorecardSubDeptFilter = 'all';

    async function loadScorecard(month, year) {
        try {
            const url = `api/scorecard_summary.php?category=all&so_type=${summarySOType}&month=${month}&year=${year}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) return;

            scorecardRawData = json;
            populateScorecardFilters();
            applyScorecardFilterAndRender();

        } catch (err) {
            console.error('Error loading scorecard:', err);
        }
    }

    function populateScorecardFilters() {
        const deptSelect = document.getElementById('all-scorecard-filter-dept') || document.getElementById('scorecard-filter-dept');
        const subdeptSelect = document.getElementById('all-scorecard-filter-subdept') || document.getElementById('scorecard-filter-subdept');
        if (!deptSelect || !subdeptSelect) return;

        let deptHtml = '<option value="all">Semua DEPT</option>';
        deptHtml += '<option value="PMD">PMD</option>';
        deptHtml += '<option value="CRO">CRO</option>';
        deptHtml += '<option value="ERO">ERO</option>';
        deptHtml += '<option value="WRO">WRO</option>';
        deptHtml += '<option value="IT Corporate">IT Corporate</option>';
        deptHtml += '<option value="Warehouse Tekno">Warehouse Tekno</option>';
        deptSelect.innerHTML = deptHtml;

        if (scorecardDeptFilter !== 'all' && deptSelect.querySelector(`option[value="${scorecardDeptFilter}"]`)) {
            deptSelect.value = scorecardDeptFilter;
        } else {
            deptSelect.value = 'all';
            scorecardDeptFilter = 'all';
        }

        updateScorecardSubdeptOptions();
    }

    function updateScorecardSubdeptOptions() {
        const deptSelect = document.getElementById('all-scorecard-filter-dept') || document.getElementById('scorecard-filter-dept');
        const subdeptSelect = document.getElementById('all-scorecard-filter-subdept') || document.getElementById('scorecard-filter-subdept');
        if (!subdeptSelect) return;

        const selectedDept = deptSelect ? deptSelect.value : 'all';
        const DEPT_MAP = {
            'PMD': ['DNO', 'DSO'],
            'CRO': ['CJDO', 'EKO', 'WJO', 'WKO'],
            'ERO': ['BNO', 'EJO', 'MPO', 'SMO'],
            'WRO': ['CSO', 'NSO', 'SSO'],
            'IT Corporate': ['IT Corporate'],
            'Warehouse Tekno': ['Warehouse Tekno']
        };

        let html = '<option value="all">Semua Sub Dept</option>';
        if (selectedDept === 'all') {
            Object.keys(DEPT_MAP).forEach(d => {
                html += `<optgroup label="${d}">`;
                DEPT_MAP[d].forEach(s => {
                    html += `<option value="${s}">${s}</option>`;
                });
                html += `</optgroup>`;
            });
        } else if (DEPT_MAP[selectedDept]) {
            DEPT_MAP[selectedDept].forEach(s => {
                html += `<option value="${s}">${s}</option>`;
            });
        }

        subdeptSelect.innerHTML = html;
        if (scorecardSubDeptFilter !== 'all' && subdeptSelect.querySelector(`option[value="${scorecardSubDeptFilter}"]`)) {
            subdeptSelect.value = scorecardSubDeptFilter;
        } else {
            subdeptSelect.value = 'all';
            scorecardSubDeptFilter = 'all';
        }
    }

    function onScorecardDeptChange() {
        const deptSelect = document.getElementById('all-scorecard-filter-dept') || document.getElementById('scorecard-filter-dept');
        scorecardDeptFilter = deptSelect ? deptSelect.value : 'all';
        updateScorecardSubdeptOptions();
        const subdeptSelect = document.getElementById('all-scorecard-filter-subdept') || document.getElementById('scorecard-filter-subdept');
        scorecardSubDeptFilter = subdeptSelect ? subdeptSelect.value : 'all';
        applyScorecardFilterAndRender();
    }

    function onScorecardSubDeptChange() {
        const subdeptSelect = document.getElementById('all-scorecard-filter-subdept') || document.getElementById('scorecard-filter-subdept');
        scorecardSubDeptFilter = subdeptSelect ? subdeptSelect.value : 'all';
        applyScorecardFilterAndRender();
    }

    function applyScorecardFilterAndRender() {
        if (!scorecardRawData) return;
        const ratingList = scorecardRawData.rating || [];
        const execList = scorecardRawData.execution || [];

        const matchesFilter = (item) => {
            if (!item) return false;
            const itemDept = (item.dept || '').trim().toUpperCase();
            const itemSub = (item.sub_dept || '').trim().toUpperCase();

            if (scorecardDeptFilter && scorecardDeptFilter !== 'all') {
                const d = scorecardDeptFilter.trim().toUpperCase();
                if (d === 'DNO' || d === 'DSO') {
                    if (itemSub !== d && itemDept !== d) return false;
                } else {
                    if (itemDept !== d && itemSub !== d) return false;
                }
            }

            if (scorecardSubDeptFilter && scorecardSubDeptFilter !== 'all') {
                const s = scorecardSubDeptFilter.trim().toUpperCase();
                if (itemSub !== s) return false;
            }

            return true;
        };

        const filteredRating = ratingList.filter(matchesFilter);
        const filteredExec = execList.filter(matchesFilter);

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

        const eCounts = {
            executed: 0,
            not_executed: 0
        };
        filteredExec.forEach(e => {
            const k = (e.execution_status || '').toLowerCase().replace(/\s+/g, '_');
            if (eCounts[k] !== undefined) eCounts[k]++;
        });

        renderRatingPie(rCounts);
        renderExecPie(eCounts);

        const badge = document.getElementById('all-scorecard-total-sites-badge') || document.getElementById('scorecard-total-sites-badge');
        if (badge) badge.textContent = `${filteredRating.length} Sites Total`;
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
        }

        if (!statsContainer || total === 0) return;

        const pctTercapai = total > 0 ? ((tercapai / total) * 100).toFixed(2) : '0.00';
        const pctTidak = total > 0 ? ((tidakTercapai / total) * 100).toFixed(2) : '0.00';
        const pctNoData = total > 0 ? ((noData / total) * 100).toFixed(2) : '0.00';

        const activeTercapai = (curStatus === 'tercapai') ? ' active' : '';
        const activeTidak = (curStatus === 'tidak_tercapai') ? ' active' : '';
        const activeNoData = (curStatus === 'no_data') ? ' active' : '';
        const activeAll = (curStatus === 'all') ? ' active' : '';

        let statsHtml = `
            <div class="so-pie-stat-row${activeTercapai}" onclick="AllSummaryApp.toggleHasilStatusFilter('tercapai')">
                <span class="so-pie-stat-label">
                    <span class="so-pie-stat-dot" style="background-color: #16a34a;"></span>
                    Tercapai
                </span>
                <span class="so-pie-stat-val" style="color: #16a34a;">
                    ${tercapai} sites <span style="font-weight: 500; font-size: 11px; color: #64748b;">(${pctTercapai}%)</span>
                </span>
            </div>
            <div class="so-pie-stat-row${activeTidak}" onclick="AllSummaryApp.toggleHasilStatusFilter('tidak_tercapai')">
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
                <div class="so-pie-stat-row${activeNoData}" onclick="AllSummaryApp.toggleHasilStatusFilter('no_data')">
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
            <div class="so-pie-stat-row${activeAll}" onclick="AllSummaryApp.toggleHasilStatusFilter('all')" style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                <span class="so-pie-stat-label" style="font-weight: 600; color: #1e293b;">
                    Total Sites
                </span>
                <span class="so-pie-stat-val" style="font-weight: 700; color: #0f172a;">${total} sites</span>
            </div>
        `;

        statsContainer.innerHTML = statsHtml;
    }

    function updateHasilFilterDropdowns() {
        const deptSel = document.getElementById('all-hasil-filter-dept');
        if (!deptSel) return;

        hasilDeptSubDeptMap = {};
        const deptsSet = new Set();

        allHasilRows.forEach(r => {
            const d = (r.dept || '').trim();
            const s = (r.sub_dept || '').trim();
            if (d) {
                deptsSet.add(d);
                if (!hasilDeptSubDeptMap[d]) hasilDeptSubDeptMap[d] = new Set();
                if (s) hasilDeptSubDeptMap[d].add(s);
            }
        });

        const depts = Array.from(deptsSet).sort();
        let dHtml = '<option value="all">Semua DEPT</option>';
        depts.forEach(d => {
            dHtml += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
        });
        deptSel.innerHTML = dHtml;
        if (hasilDeptFilter && depts.includes(hasilDeptFilter)) {
            deptSel.value = hasilDeptFilter;
        } else {
            deptSel.value = 'all';
            hasilDeptFilter = 'all';
        }

        updateHasilSubDeptOptions();
    }

    function updateHasilSubDeptOptions() {
        const subdeptSel = document.getElementById('all-hasil-filter-subdept');
        if (!subdeptSel) return;

        let subdepts = [];
        if (hasilDeptFilter !== 'all' && hasilDeptSubDeptMap[hasilDeptFilter]) {
            subdepts = Array.from(hasilDeptSubDeptMap[hasilDeptFilter]).sort();
        } else {
            const allSubs = new Set();
            Object.values(hasilDeptSubDeptMap).forEach(set => {
                set.forEach(s => allSubs.add(s));
            });
            subdepts = Array.from(allSubs).sort();
        }

        let sHtml = '<option value="all">Semua Sub Dept</option>';
        subdepts.forEach(s => {
            sHtml += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
        });
        subdeptSel.innerHTML = sHtml;
        if (hasilSubDeptFilter && subdepts.includes(hasilSubDeptFilter)) {
            subdeptSel.value = hasilSubDeptFilter;
        } else {
            subdeptSel.value = 'all';
            hasilSubDeptFilter = 'all';
        }
    }

    function onAllHasilDeptChange() {
        const deptSel = document.getElementById('all-hasil-filter-dept');
        hasilDeptFilter = deptSel ? deptSel.value : 'all';
        updateHasilSubDeptOptions();
        hasilSubDeptFilter = 'all';
        applyHasilFilter();
    }

    function onAllHasilSubDeptChange() {
        const subdeptSel = document.getElementById('all-hasil-filter-subdept');
        hasilSubDeptFilter = subdeptSel ? subdeptSel.value : 'all';
        applyHasilFilter();
    }

    async function loadHasilSO(month, year) {
        const tbody = document.getElementById('hasil-so-table-body');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #94a3b8;">Memuat data Report Stock Opname...</td></tr>`;

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
            updateHasilFilterDropdowns();

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

            if (hasilDeptFilter !== 'all') {
                const rDept = (r.dept || '').trim().toUpperCase();
                const rSub = (r.sub_dept || '').trim().toUpperCase();
                const fDept = hasilDeptFilter.trim().toUpperCase();
                if (rDept !== fDept && rSub !== fDept) return false;
            }

            if (hasilSubDeptFilter !== 'all') {
                const rSub = (r.sub_dept || '').trim().toUpperCase();
                const fSub = hasilSubDeptFilter.trim().toUpperCase();
                if (rSub !== fSub) return false;
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

            const isPmd = (r.dept && r.dept.toUpperCase() === 'PMD');
            const isTekno = (r.name_site && r.name_site.toUpperCase().includes('TEKNO'));
            const isTarget98 = isPmd || isTekno;
            const targetThreshold = isTarget98 ? 98 : 85;

            let statusText = 'Belum Ada Data';
            let statusClass = 'status-none';

            if (r.has_data !== false && pct !== null && !isNaN(pct)) {
                const roundedPct = parseFloat(pct);
                if (isTarget98) {
                    if (roundedPct >= 98) {
                        statusText = 'Tercapai';
                        statusClass = 'status-green';
                    } else {
                        statusText = 'Tidak Tercapai';
                        statusClass = 'status-red';
                    }
                } else {
                    if (roundedPct >= 85) {
                        statusText = 'Tercapai';
                        statusClass = 'status-green';
                    } else if (roundedPct >= 75) {
                        statusText = 'Tidak Tercapai';
                        statusClass = 'status-orange';
                    } else {
                        statusText = 'Tidak Tercapai';
                        statusClass = 'status-red';
                    }
                }

                // If backend provided status_class or status, align with it
                if (r.status_class && ['green', 'orange', 'red', 'none'].includes(r.status_class)) {
                    statusClass = `status-${r.status_class}`;
                    if (r.status) statusText = r.status;
                } else if (r.status && !r.status.toLowerCase().includes('belum')) {
                    statusText = r.status;
                }
            } else if (r.status) {
                statusText = r.status;
                const s = r.status.toLowerCase();
                if (s.includes('tercapai') && !s.includes('tidak')) {
                    statusClass = 'status-green';
                } else if (s.includes('tidak')) {
                    statusClass = (r.status_class === 'orange') ? 'status-orange' : 'status-red';
                } else {
                    statusClass = 'status-none';
                }
            }

            const statusBadge = `<span class="so-status-badge ${statusClass}">${statusText}</span>`;

            const pctText = pct !== null ? `${pct.toFixed(2)}%` : '-';
            const pctColor = pct !== null ? (pct >= targetThreshold ? 'color: #16a34a; font-weight: 700;' : 'color: #dc2626; font-weight: 700;') : 'color: #94a3b8;';

            let defisitText = '-';
            let defisitColor = 'color: #94a3b8;';
            if (r.has_data !== false && pct !== null && !isNaN(pct)) {
                const defisit = 100 - parseFloat(pct);
                defisitText = `${defisit.toFixed(2)}%`;
                defisitColor = defisit > 0 ? 'color: #dc2626; font-weight: 700;' : 'color: #16a34a; font-weight: 700;';
            }

            const qtyMatch = r.match_physic_qty !== undefined ? r.match_physic_qty : (r.qty_match || 0);
            const qtyPhysic = r.physic_physic_qty !== undefined ? r.physic_physic_qty : (r.qty_physic || 0);
            const qtyDb = r.db_physic_qty !== undefined ? r.db_physic_qty : (r.qty_db || 0);
            const qtyActual = r.total_physic_actual !== undefined ? r.total_physic_actual : (r.qty_actual || 0);

            html += `
                <tr>
                    <td style="font-weight: 700; color: #0284c7; text-align: center;">${r.sitecode || '-'}</td>
                    <td style="font-weight: 500; color: #1e293b; text-align: left;">${r.name_site || '-'}</td>
                    <td style="font-size: 11.5px; color: #475569; text-align: left;">${r.dept || '-'} / ${r.sub_dept || '-'}</td>
                    <td style="text-align: center; font-variant-numeric: tabular-nums;">${Number(qtyMatch).toLocaleString('id-ID')}</td>
                    <td style="text-align: center; font-variant-numeric: tabular-nums;">${Number(qtyPhysic).toLocaleString('id-ID')}</td>
                    <td style="text-align: center; font-variant-numeric: tabular-nums;">${Number(qtyDb).toLocaleString('id-ID')}</td>
                    <td style="text-align: center; font-variant-numeric: tabular-nums;">${Number(qtyActual).toLocaleString('id-ID')}</td>
                    <td style="text-align: center; ${pctColor}">${pctText}</td>
                    <td style="text-align: center; ${defisitColor}">${defisitText}</td>
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
    let allRdbFilterDept = 'all';
    let allRdbFilterSubDept = 'all';
    let allRdbFilterStatus = 'all';
    let allRdbSearch = '';
    let allRdbDeptSubDeptMap = {};
    let allRdbSearchTimeout = null;

    function updateAllRdbFilterDropdowns(filterOptions) {
        if (!filterOptions) return;
        if (filterOptions.dept_subdept_map) {
            allRdbDeptSubDeptMap = filterOptions.dept_subdept_map;
        }
        const deptSel = document.getElementById('all-rdb-filter-dept');
        if (deptSel && deptSel.options.length <= 1) {
            const depts = filterOptions.depts || Object.keys(allRdbDeptSubDeptMap);
            let dHtml = '<option value="all">Semua DEPT</option>';
            depts.forEach(d => {
                dHtml += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
            });
            deptSel.innerHTML = dHtml;
            deptSel.value = allRdbFilterDept;
        }
        updateAllRdbSubDeptOptions();
    }

    function updateAllRdbSubDeptOptions() {
        const subdeptSel = document.getElementById('all-rdb-filter-subdept');
        if (!subdeptSel) return;

        let subdepts = [];
        if (allRdbFilterDept !== 'all' && allRdbDeptSubDeptMap[allRdbFilterDept]) {
            subdepts = allRdbDeptSubDeptMap[allRdbFilterDept];
        } else {
            const allSubs = new Set();
            Object.values(allRdbDeptSubDeptMap).forEach(arr => {
                if (Array.isArray(arr)) arr.forEach(s => allSubs.add(s));
            });
            subdepts = Array.from(allSubs).sort();
        }

        let sHtml = '<option value="all">Semua Sub Dept</option>';
        subdepts.forEach(s => {
            sHtml += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
        });
        subdeptSel.innerHTML = sHtml;
        if (allRdbFilterSubDept && subdepts.includes(allRdbFilterSubDept)) {
            subdeptSel.value = allRdbFilterSubDept;
        } else {
            subdeptSel.value = 'all';
            allRdbFilterSubDept = 'all';
        }
    }

    function onAllRdbDeptChange() {
        const deptSel = document.getElementById('all-rdb-filter-dept');
        allRdbFilterDept = deptSel ? deptSel.value : 'all';
        updateAllRdbSubDeptOptions();
        allRdbFilterSubDept = 'all';
        allRdbStatusPage = 1;
        const monthEl = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const yearEl = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
        loadRekapDbStatus(monthEl?.value ?? '', yearEl?.value || '2026', 1);
    }

    function onAllRdbSubDeptChange() {
        const subdeptSel = document.getElementById('all-rdb-filter-subdept');
        allRdbFilterSubDept = subdeptSel ? subdeptSel.value : 'all';
        allRdbStatusPage = 1;
        const monthEl = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const yearEl = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
        loadRekapDbStatus(monthEl?.value ?? '', yearEl?.value || '2026', 1);
    }

    function onAllRdbStatusChange() {
        const statusSel = document.getElementById('all-rdb-filter-status');
        allRdbFilterStatus = statusSel ? statusSel.value : 'all';
        allRdbStatusPage = 1;
        const monthEl = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const yearEl = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
        loadRekapDbStatus(monthEl?.value ?? '', yearEl?.value || '2026', 1);
    }

    function changeAllRekapDbStatusPageSize(size) {
        allRdbStatusPageSize = (size === 'all') ? 999999 : (parseInt(size) || 10);
        allRdbStatusPage = 1;
        const monthEl = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const yearEl = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
        loadRekapDbStatus(monthEl?.value ?? '', yearEl?.value || '2026', 1);
    }

    function handleAllRdbSearch(val) {
        allRdbSearch = (val || '').trim();
        allRdbStatusPage = 1;
        if (allRdbSearchTimeout) clearTimeout(allRdbSearchTimeout);
        allRdbSearchTimeout = setTimeout(() => {
            const monthEl = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
            const yearEl = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
            loadRekapDbStatus(monthEl?.value ?? '', yearEl?.value || '2026', 1);
        }, 300);
    }

    async function loadRekapDbStatus(month, year, page = 1) {
        const tbody = document.getElementById('rekap-db-status-tbody');
        const info = document.getElementById('all-rdb-status-pagination-info');
        const controls = document.getElementById('all-rdb-status-pagination-controls');
        if (!tbody) return;

        allRdbStatusPage = page;
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Memuat data status DB...</td></tr>`;

        try {
            const limitVal = (allRdbStatusPageSize === 999999) ? 'all' : allRdbStatusPageSize;
            let url = `api/rekap_db_status.php?category=all&month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}&page=${allRdbStatusPage}&limit=${limitVal}`;
            if (allRdbFilterDept && allRdbFilterDept !== 'all') {
                url += `&dept=${encodeURIComponent(allRdbFilterDept)}`;
            }
            if (allRdbFilterSubDept && allRdbFilterSubDept !== 'all') {
                url += `&sub_dept=${encodeURIComponent(allRdbFilterSubDept)}`;
            }
            if (allRdbFilterStatus && allRdbFilterStatus !== 'all') {
                url += `&status=${encodeURIComponent(allRdbFilterStatus)}`;
            }
            if (allRdbSearch) {
                url += `&search=${encodeURIComponent(allRdbSearch)}`;
            }

            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #ef4444;">Gagal memuat data</td></tr>`;
                if (info) info.textContent = 'Menampilkan 0 sampai 0 dari 0 data';
                if (controls) controls.innerHTML = '';
                return;
            }

            if (json.filter_options) {
                updateAllRdbFilterDropdowns(json.filter_options);
            }

            if (json.stats) {
                const s = json.stats;
                const totalItems = parseInt(s.total_items || 0, 10);
                const solvedCount = parseInt(s.solved_count || 0, 10);
                const unsolvedCount = parseInt(s.unsolved_count || 0, 10);
                const newDbCount = parseInt(s.new_db_count || 0, 10);

                const solvedPct = totalItems > 0 ? ((solvedCount / totalItems) * 100).toFixed(2) : '0.00';
                const unsolvedPct = totalItems > 0 ? ((unsolvedCount / totalItems) * 100).toFixed(2) : '0.00';
                const newDbPct = totalItems > 0 ? ((newDbCount / totalItems) * 100).toFixed(2) : '0.00';

                const elRateText = document.getElementById('all-db-summary-rate-text');
                if (elRateText) elRateText.textContent = `${solvedPct}%`;
                const elRateBadge = document.getElementById('all-db-summary-rate-badge');
                if (elRateBadge) elRateBadge.textContent = `${solvedPct}% Solved`;

                const elBarSolved = document.getElementById('all-db-summary-bar-solved');
                if (elBarSolved) elBarSolved.style.width = `${Math.min(100, parseFloat(solvedPct))}%`;
                const elBarUnsolved = document.getElementById('all-db-summary-bar-unsolved');
                if (elBarUnsolved) elBarUnsolved.style.width = `${Math.min(100, parseFloat(unsolvedPct))}%`;
                const elBarNew = document.getElementById('all-db-summary-bar-new');
                if (elBarNew) elBarNew.style.width = `${Math.min(100, parseFloat(newDbPct))}%`;

                const elSolvedVal = document.getElementById('all-db-summary-val-solved');
                if (elSolvedVal) elSolvedVal.textContent = solvedCount.toLocaleString('id-ID');
                const elSolvedPct = document.getElementById('all-db-summary-pct-solved');
                if (elSolvedPct) elSolvedPct.textContent = `(${solvedPct}%)`;

                const elUnsolvedVal = document.getElementById('all-db-summary-val-unsolved');
                if (elUnsolvedVal) elUnsolvedVal.textContent = unsolvedCount.toLocaleString('id-ID');
                const elUnsolvedPct = document.getElementById('all-db-summary-pct-unsolved');
                if (elUnsolvedPct) elUnsolvedPct.textContent = `(${unsolvedPct}%)`;

                const elNewVal = document.getElementById('all-db-summary-val-new');
                if (elNewVal) elNewVal.textContent = newDbCount.toLocaleString('id-ID');
                const elNewPct = document.getElementById('all-db-summary-pct-new');
                if (elNewPct) elNewPct.textContent = `(${newDbPct}%)`;

                const elStatTotal = document.getElementById('all-db-summary-stat-status-total');
                if (elStatTotal) elStatTotal.textContent = totalItems.toLocaleString('id-ID');
            }

            const rows = json.data || [];
            const total = json.total !== undefined ? json.total : rows.length;
            const pageSizeNum = (allRdbStatusPageSize === 999999) ? (total || 1) : allRdbStatusPageSize;
            allRdbStatusTotalPages = json.total_pages || (Math.ceil(total / pageSizeNum) || 1);

            if (info) {
                const start = total > 0 ? (allRdbStatusPage - 1) * pageSizeNum + 1 : 0;
                const end = Math.min(allRdbStatusPage * pageSizeNum, total);
                info.textContent = `Menampilkan ${start.toLocaleString('id-ID')} sampai ${end.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} data`;
            }
            renderPaginationControls(controls, allRdbStatusPage, allRdbStatusTotalPages, 'AllSummaryApp.goToAllRekapDbStatusPage');

            if (rows.length === 0) {
                const emptyMsg = json.message || 'Tidak ada data status DB yang cocok dengan filter.';
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">${escapeHtml(emptyMsg)}</td></tr>`;
                return;
            }

            let html = '';
            rows.forEach((r, idx) => {
                const status = (r.status || '').toUpperCase();
                let badgeClass = 'badge ';
                if (status === 'SOLVED') badgeClass += 'badge-success';
                else if (status === 'UNSOLVED') badgeClass += 'badge-warning';
                else badgeClass += 'badge-primary';

                html += `
                    <tr>
                        <td style="font-weight: 700; color: #0284c7; text-align: center;">${escapeHtml(r.sitecode || '-')}</td>
                        <td style="font-weight: 500; text-align: left;">${escapeHtml(r.name_site || '-')}</td>
                        <td style="font-size: 11.5px; color: #475569;">${escapeHtml(r.dept || '-')} / ${escapeHtml(r.sub_dept || '-')}</td>
                        <td style="font-size: 11.5px; font-weight: 600;">${escapeHtml(r.reg_no || '-')}</td>
                        <td style="font-size: 11.5px; color: #64748b;">${escapeHtml(r.name || r.description || '-')}</td>
                        <td style="text-align: center;"><span class="${badgeClass}" style="font-size: 11px;">${escapeHtml(status)}</span></td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (err) {
            console.error('Error loading rekap db status:', err);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #ef4444;">Gagal memuat status DB</td></tr>`;
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
    function updateAllRekapFilterDropdowns() {
        const deptSel = document.getElementById('all-rekap-filter-dept');
        if (!deptSel) return;

        allRekapDeptSubDeptMap = {};
        const deptsSet = new Set();

        allRekapRows.forEach(r => {
            const d = (r.dept || '').trim();
            const s = (r.sub_dept || '').trim();
            if (d) {
                deptsSet.add(d);
                if (!allRekapDeptSubDeptMap[d]) allRekapDeptSubDeptMap[d] = new Set();
                if (s) allRekapDeptSubDeptMap[d].add(s);
            }
        });

        const depts = Array.from(deptsSet).sort();
        let dHtml = '<option value="all">Semua DEPT</option>';
        depts.forEach(d => {
            dHtml += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
        });
        deptSel.innerHTML = dHtml;
        if (allRekapDeptFilter && depts.includes(allRekapDeptFilter)) {
            deptSel.value = allRekapDeptFilter;
        } else {
            deptSel.value = 'all';
            allRekapDeptFilter = 'all';
        }

        updateAllRekapSubDeptOptions();
    }

    function updateAllRekapSubDeptOptions() {
        const subdeptSel = document.getElementById('all-rekap-filter-subdept');
        if (!subdeptSel) return;

        let subdepts = [];
        if (allRekapDeptFilter !== 'all' && allRekapDeptSubDeptMap[allRekapDeptFilter]) {
            subdepts = Array.from(allRekapDeptSubDeptMap[allRekapDeptFilter]).sort();
        } else {
            const allSubs = new Set();
            Object.values(allRekapDeptSubDeptMap).forEach(set => {
                set.forEach(s => allSubs.add(s));
            });
            subdepts = Array.from(allSubs).sort();
        }

        let sHtml = '<option value="all">Semua Sub Dept</option>';
        subdepts.forEach(s => {
            sHtml += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
        });
        subdeptSel.innerHTML = sHtml;
        if (allRekapSubDeptFilter && subdepts.includes(allRekapSubDeptFilter)) {
            subdeptSel.value = allRekapSubDeptFilter;
        } else {
            subdeptSel.value = 'all';
            allRekapSubDeptFilter = 'all';
        }
    }

    function onAllRekapDeptChange() {
        const deptSel = document.getElementById('all-rekap-filter-dept');
        allRekapDeptFilter = deptSel ? deptSel.value : 'all';
        updateAllRekapSubDeptOptions();
        allRekapSubDeptFilter = 'all';
        applyRekapFilter();
    }

    function onAllRekapSubDeptChange() {
        const subdeptSel = document.getElementById('all-rekap-filter-subdept');
        allRekapSubDeptFilter = subdeptSel ? subdeptSel.value : 'all';
        applyRekapFilter();
    }

    async function loadRekapitulasi(year) {
        const tbody = document.getElementById('all-rekap-table-body') || document.getElementById('rekap-table-body');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 2rem; color: #94a3b8;">Memuat data Rekapitulasi...</td></tr>`;

        try {
            const url = `api/rekapitulasi.php?category=all&so_type=${summarySOType}&year=${year}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) {
                tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 2rem; color: #ef4444;">Gagal memuat Rekapitulasi</td></tr>`;
                return;
            }

            allRekapRows = json.data || json.rows || [];
            updateAllRekapFilterDropdowns();
            applyRekapFilter();
        } catch (err) {
            console.error('Error loading rekapitulasi:', err);
            tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 2rem; color: #ef4444;">Kesalahan jaringan</td></tr>`;
        }
    }

    function applyRekapFilter() {
        const query = (document.getElementById('all-rekap-search')?.value || document.getElementById('rekap-search')?.value || '').toLowerCase().trim();

        filteredRekapRows = allRekapRows.filter(r => {
            if (query) {
                const matchQuery = (r.sitecode && r.sitecode.toLowerCase().includes(query)) ||
                    (r.name_site && r.name_site.toLowerCase().includes(query)) ||
                    (r.dept && r.dept.toLowerCase().includes(query)) ||
                    (r.sub_dept && r.sub_dept.toLowerCase().includes(query));
                if (!matchQuery) return false;
            }

            if (allRekapDeptFilter !== 'all') {
                const rDept = (r.dept || '').trim().toUpperCase();
                const rSub = (r.sub_dept || '').trim().toUpperCase();
                const fDept = allRekapDeptFilter.trim().toUpperCase();
                if (rDept !== fDept && rSub !== fDept) return false;
            }

            if (allRekapSubDeptFilter !== 'all') {
                const rSub = (r.sub_dept || '').trim().toUpperCase();
                const fSub = allRekapSubDeptFilter.trim().toUpperCase();
                if (rSub !== fSub) return false;
            }

            return true;
        });

        currentRekapPage = 1;
        renderRekapTable();
    }

    const REKAP_MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
    const REKAP_QUARTER_LABELS = { 3: 'Q1 (MAR)', 6: 'Q2 (JUN)', 9: 'Q3 (SEP)', 12: 'Q4 (DEC)' };

    function getRekapPctClass(val, isPmd = false) {
        if (val === null || val === undefined || isNaN(val) || val === '') return 'pct-none';
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

    function formatRekapPctBadge(val, isPmd = false) {
        if (val === null || val === undefined || isNaN(val) || val === '') {
            return '<span class="pct-none">-</span>';
        }
        const num = parseFloat(val);
        const cls = getRekapPctClass(num, isPmd);
        return `<span class="pct-badge ${cls}">${num.toFixed(2)}%</span>`;
    }

    function updateRekapMonthHeaders(visibleMonths, isQuarterly) {
        const thead = document.querySelector('#all-card-rekapitulasi table thead') || document.querySelector('#card-rekapitulasi table thead');
        if (!thead) return;
        const ths = thead.querySelectorAll('tr:first-child th');
        if (ths.length < 15) return;

        for (let m = 1; m <= 12; m++) {
            const th = ths[m + 2];
            if (!th) continue;
            const isVisible = visibleMonths.includes(m);
            th.style.display = isVisible ? '' : 'none';
            if (isVisible) {
                th.textContent = isQuarterly ? (REKAP_QUARTER_LABELS[m] || REKAP_MONTH_NAMES[m]) : REKAP_MONTH_NAMES[m];
            }
        }
    }

    function renderRekapTable() {
        const tbody = document.getElementById('all-rekap-table-body') || document.getElementById('rekap-table-body');
        const tfoot = document.getElementById('all-rekap-table-foot') || document.getElementById('rekap-table-foot');
        if (!tbody) return;

        const isQuarterlyRekap = (summarySOType === 'quarterly');
        const visibleMonths = isQuarterlyRekap ? [3, 6, 9, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        updateRekapMonthHeaders(visibleMonths, isQuarterlyRekap);

        if (filteredRekapRows.length === 0) {
            const emptyColspan = isQuarterlyRekap ? 7 : 15;
            tbody.innerHTML = `<tr><td colspan="${emptyColspan}" style="text-align: center; padding: 2.5rem; color: #94a3b8;">Tidak ada data yang cocok.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            renderAllRekapAverageChart([], isQuarterlyRekap);
            updateRekapPagination(0);
            return;
        }

        const startIdx = (currentRekapPage - 1) * rekapPageSize;
        const pageRows = filteredRekapRows.slice(startIdx, startIdx + rekapPageSize);

        let html = '';
        pageRows.forEach((r, idx) => {
            const no = startIdx + idx + 1;
            const months = r.months || {};
            const isPmd = (r.dept && r.dept.toUpperCase() === 'PMD') ||
                (r.sub_dept && r.sub_dept.toUpperCase() === 'PMD') ||
                (r.name_site && r.name_site.toUpperCase().includes('TEKNO'));

            let monthCols = '';
            visibleMonths.forEach(m => {
                const val = months[m];
                monthCols += `<td style="text-align: center; vertical-align: middle;">${formatRekapPctBadge(val, isPmd)}</td>`;
            });

            html += `
                <tr>
                    <td style="font-weight: 700; color: #0284c7; text-align: center;">${escapeHtml(r.sitecode || '-')}</td>
                    <td style="font-weight: 500; color: #1e293b; text-align: left;">${escapeHtml(r.name_site || '-')}</td>
                    <td style="font-size: 11.5px; color: #475569; text-align: left;">${escapeHtml(r.dept || '-')} / ${escapeHtml(r.sub_dept || '-')}</td>
                    ${monthCols}
                </tr>
            `;
        }
        );

        tbody.innerHTML = html;

        // Render Footer (Average total physical % per month, matching Rekapitulasi summary page)
        const monthlyChartData = [];
        if (tfoot) {
            let footHtml = `
                <tr class="table-summary-row" style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1;">
                    <td colspan="3" style="text-align: left; padding: 8px 12px; font-size: 12px; letter-spacing: 0.03em; color: #0f172a;">
                        AVERAGE TOTAL PHYSICAL % (${filteredRekapRows.length} SITES)
                    </td>
            `;
            visibleMonths.forEach(m => {
                let sum = 0, count = 0;
                filteredRekapRows.forEach(r => {
                    if (r.months && r.months[m] !== null && r.months[m] !== undefined && r.months[m] !== '') {
                        sum += parseFloat(r.months[m]);
                        count++;
                    }
                });
                const avg = count > 0 ? (sum / count) : null;
                const label = isQuarterlyRekap ? (REKAP_QUARTER_LABELS[m] || REKAP_MONTH_NAMES[m]) : REKAP_MONTH_NAMES[m];
                monthlyChartData.push({
                    month: m,
                    label: label,
                    avg: avg,
                    count: count,
                    total: filteredRekapRows.length
                });
                footHtml += `<td style="text-align: center; padding: 8px 6px; vertical-align: middle;">${formatRekapPctBadge(avg, false)}</td>`;
            });
            footHtml += '</tr>';
            tfoot.innerHTML = footHtml;
        }

        renderAllRekapAverageChart(monthlyChartData, isQuarterlyRekap);
        updateRekapPagination(filteredRekapRows.length);
    }

    function renderAllRekapAverageChart(monthlyData, isQuarterly) {
        const canvas = document.getElementById('all-chart-rekap-average');
        if (!canvas) return;

        if (allRekapAverageChart) {
            allRekapAverageChart.destroy();
            allRekapAverageChart = null;
        }

        const titleEl = document.getElementById('all-rekap-chart-title');
        if (titleEl) {
            const prefix = (isQuarterly || summarySOType === 'quarterly') ? 'Quarterly' : 'Monthly';
            titleEl.textContent = `${prefix} Target Achievement (All Sites)`;
        }

        const subtitleEl = document.getElementById('all-rekap-chart-subtitle');
        if (subtitleEl) {
            const totalSites = (monthlyData && monthlyData[0]) ? monthlyData[0].total : filteredRekapRows.length;
            const typeLabel = isQuarterly ? 'Quarter' : 'Bulan';
            subtitleEl.textContent = `Rata-rata persentase pencapaian fisik per ${typeLabel} (${totalSites.toLocaleString('id-ID')} Sites)`;
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
            if (d.avg >= 85) return '#16a34a';
            if (d.avg >= 75) return '#ea580c';
            return '#dc2626';
        });

        const borderColors = activeMonthlyData.map(d => {
            if (d.avg === null) return '#cbd5e1';
            if (d.avg >= 85) return '#15803d';
            if (d.avg >= 75) return '#c2410c';
            return '#b91c1c';
        });

        // Bottom value label plugin (crisp, solid font with 2 decimals anchored at bottom)
        const valueBottomPlugin = {
            id: 'allRekapValueBottomPlugin',
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

        // Dashed Target Line Plugin (Target 85%)
        const targetLinePlugin = {
            id: 'allRekapTargetLinePlugin',
            afterDraw(chart) {
                const target = 85;
                const { ctx, chartArea, scales: { y } } = chart;
                if (!chartArea || !y) return;

                const yPixel = y.getPixelForValue(target);
                if (isNaN(yPixel)) return;

                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([5, 4]);
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 1.5;
                ctx.moveTo(chartArea.left, yPixel);
                ctx.lineTo(chartArea.right, yPixel);
                ctx.stroke();

                const text = `TARGET ${target}%`;
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

        const ctx = canvas.getContext('2d');
        allRekapAverageChart = new Chart(ctx, {
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

    function showToast(type, title, message) {
        if (typeof window.showToast === 'function') {
            window.showToast(type, title, message);
            return;
        }
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

    async function exportRekapExcel() {
        if (!filteredRekapRows || filteredRekapRows.length === 0) {
            showToast('warning', 'Data Kosong', 'Tidak ada data rekapitulasi untuk diexport.');
            return;
        }

        const btn = document.getElementById('btn-all-rekap-export-excel') || document.getElementById('btn-rekap-export-excel');
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
            const yearEl = document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year');
            const year = parseInt(yearEl?.value) || 2026;
            const searchEl = document.getElementById('all-rekap-search') || document.getElementById('rekap-search');
            const searchQuery = searchEl ? searchEl.value.trim() : '';

            const payload = {
                year: year,
                category: 'all',
                category_label: 'All Sites',
                so_type: summarySOType || 'monthly',
                search_query: searchQuery,
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
                downloadFilename = `rekap_allsites_${d}${m}${y}${H}${i}.xlsx`;
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

    // ── 7. Site Movements (History & Log) ──
    let allMovementsData = [];
    let filteredMovementsData = [];
    let isMovementDetailsVisible = false;
    let allSmDeptFilter = 'all';
    let allSmStatusFilter = 'all';
    let allSmPage = 1;
    let allSmPageSize = 10;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function updateAllSmFilterDropdowns() {
        const deptSel = document.getElementById('all-sm-filter-dept');
        if (!deptSel) return;

        const deptsSet = new Set();
        allMovementsData.forEach(m => {
            const d = (m.dept || '').trim();
            if (d) deptsSet.add(d);
        });

        const depts = Array.from(deptsSet).sort();
        let dHtml = '<option value="all">Semua DEPT</option>';
        depts.forEach(d => {
            dHtml += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
        });
        deptSel.innerHTML = dHtml;
        if (allSmDeptFilter && depts.includes(allSmDeptFilter)) {
            deptSel.value = allSmDeptFilter;
        } else {
            deptSel.value = 'all';
            allSmDeptFilter = 'all';
        }
    }

    function onAllSmDeptChange() {
        const deptSel = document.getElementById('all-sm-filter-dept');
        allSmDeptFilter = deptSel ? deptSel.value : 'all';
        filterMovementsTable();
    }

    function onAllSmStatusChange() {
        const statusSel = document.getElementById('all-sm-filter-status');
        allSmStatusFilter = statusSel ? statusSel.value : 'all';
        filterMovementsTable();
    }

    function changeAllSmPageSize(size) {
        allSmPageSize = (size === 'all') ? 999999 : (parseInt(size) || 10);
        allSmPage = 1;
        renderMovementsTable();
    }

    function goToAllSmPage(p) {
        const totalPages = Math.ceil(filteredMovementsData.length / allSmPageSize) || 1;
        if (p < 1) p = 1;
        if (p > totalPages) p = totalPages;
        allSmPage = p;
        renderMovementsTable();
    }

    async function loadSiteMovements(year, month) {
        const badgeTotal = document.getElementById('all-sm-badge-total');
        const periodSub = document.getElementById('all-sm-period-subtitle');
        const tbody = document.getElementById('all-sm-table-body') || document.getElementById('sm-table-body');

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
            updateAllSmFilterDropdowns();

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
            const searchInput = document.getElementById('all-sm-search-input') || document.getElementById('sm-search-input');
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
        const tbody = document.getElementById('all-sm-table-body') || document.getElementById('sm-table-body');
        const infoEl = document.getElementById('all-sm-table-info');
        const paginationInfo = document.getElementById('all-sm-pagination-info');
        const paginationControls = document.getElementById('all-sm-pagination-controls');
        if (!tbody) return;

        const curYear = (document.getElementById('all-summary-filter-year') || document.getElementById('summary-filter-year'))?.value || 2026;
        const monthSelect = document.getElementById('all-summary-filter-month') || document.getElementById('summary-filter-month');
        const monthText = (monthSelect && monthSelect.value) ? monthSelect.options[monthSelect.selectedIndex].text : 'Tahun Ini';
        const hasSearch = Boolean(document.getElementById('all-sm-search-input')?.value?.trim() || document.getElementById('sm-search-input')?.value?.trim());

        const totalItems = filteredMovementsData.length;
        const pageSizeNum = (allSmPageSize === 999999) ? (totalItems || 1) : allSmPageSize;
        const totalPages = Math.ceil(totalItems / pageSizeNum) || 1;
        if (allSmPage > totalPages) allSmPage = totalPages;

        const startIdx = (allSmPage - 1) * pageSizeNum;
        const pageRows = filteredMovementsData.slice(startIdx, startIdx + pageSizeNum);

        if (infoEl) {
            infoEl.textContent = hasSearch
                ? `Menampilkan ${totalItems} dari ${allMovementsData.length} perubahan (difilter)`
                : `Menampilkan ${totalItems} dari ${allMovementsData.length} perubahan`;
        }

        if (paginationInfo) {
            const start = totalItems > 0 ? startIdx + 1 : 0;
            const end = Math.min(startIdx + pageSizeNum, totalItems);
            paginationInfo.textContent = `Menampilkan ${start.toLocaleString('id-ID')} sampai ${end.toLocaleString('id-ID')} dari ${totalItems.toLocaleString('id-ID')} data`;
        }

        if (paginationControls) {
            renderPaginationControls(paginationControls, allSmPage, totalPages, 'AllSummaryApp.goToAllSmPage');
        }

        if (totalItems === 0) {
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
        pageRows.forEach((m, idx) => {
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
                    <td style="text-align: center; font-weight: 600; color: #64748b; padding: 8px 10px;">${startIdx + idx + 1}</td>
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
        const query = (document.getElementById('all-sm-search-input')?.value || document.getElementById('sm-search-input')?.value || '').toLowerCase().trim();

        filteredMovementsData = allMovementsData.filter(m => {
            if (query) {
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

                const matchQuery = sc.includes(query) ||
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
                if (!matchQuery) return false;
            }

            if (allSmDeptFilter !== 'all') {
                const mDept = String(m.dept ?? '').trim().toUpperCase();
                const mSub = String(m.sub_dept ?? '').trim().toUpperCase();
                const fDept = allSmDeptFilter.trim().toUpperCase();
                if (mDept !== fDept && mSub !== fDept) return false;
            }

            if (allSmStatusFilter !== 'all') {
                const curr = String(m.curr_status ?? '').toLowerCase();
                const prev = String(m.prev_status ?? '').toLowerCase();
                const f = allSmStatusFilter.toLowerCase();
                if (curr !== f && prev !== f) return false;
            }

            return true;
        });

        allSmPage = 1;
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

    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-dropdown-container');
        if (dropdown && dropdown.classList.contains('active')) {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        }
    });

    return {
        init,
        switchSOType,
        loadAllSummary,
        onAllHasilDeptChange,
        onAllHasilSubDeptChange,
        applyHasilFilter,
        goToHasilPage,
        prevHasilPage,
        nextHasilPage,
        changeHasilPageSize,
        onAllRekapDeptChange,
        onAllRekapSubDeptChange,
        applyRekapFilter,
        goToAllRekapPage,
        prevRekapPage,
        nextRekapPage,
        changeRekapPageSize,
        exportRekapExcel,
        loadRekapDbStatus,
        onAllRdbDeptChange,
        onAllRdbSubDeptChange,
        onAllRdbStatusChange,
        changeAllRekapDbStatusPageSize,
        handleAllRdbSearch,
        goToAllRekapDbStatusPage,
        onAllSmDeptChange,
        onAllSmStatusChange,
        changeAllSmPageSize,
        goToAllSmPage,
        filterMovementsTable,
        toggleMovementDetails,
        viewAllYearMovements,
        loadSiteMovements,
        toggleHasilStatusFilter,
        onScorecardDeptChange,
        onScorecardSubDeptChange,
        renderTrendDivWhChart,
        updateSummaryMonthDropdown,
        toggleDbBreakdownPanel,
        toggleUserDropdown,
        closeUserDropdown
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
