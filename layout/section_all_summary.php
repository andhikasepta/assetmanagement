<?php
/**
 * All Summary Page Section (SPA Component)
 * Consolidated opname analytics for ALL sites
 */
?>
<section id="page-all-summary" class="page-section" style="display: none;">

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
                        <button type="button" class="summary-type-slider-btn active" id="all-btn-so-type-monthly"
                            onclick="AllSummaryApp.switchSOType('monthly')">
                            <span>Monthly</span>
                        </button>
                        <button type="button" class="summary-type-slider-btn" id="all-btn-so-type-quarterly"
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
                        style="width: auto;" onchange="AllSummaryApp.loadAllSummary()">
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
                    <select id="all-summary-filter-year" class="form-control unified-filter-select" style="width: auto;"
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
    <div class="card" id="all-card-executive-summary" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                    <h2 class="card-title" style="margin: 0;">Executive Summary (All Sites)</h2>
                    <span id="all-executive-period-badge" class="badge"
                        style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11.5px; padding: 3px 9px; border-radius: 6px; letter-spacing: 0.2px;">
                        September 2026
                    </span>
                </div>
            </div>
        </div>
        <div class="card-body" style="padding: 1.25rem;">
            <!-- ── Achievement Card: Count All (No Dept or Subdept Cards) ── -->
            <div class="kpi-grid" id="all-achievement-cards" style="margin-bottom: 1.25rem;">
                <div class="kpi-card kpi-card-split" id="kpi-card-all" style="width: 100%;">
                    <div class="kpi-title">Summary Achievement (All Sites)</div>
                    <div class="kpi-card-main">
                        <div class="kpi-split-value" id="kpi-all-achievement">0%</div>
                        <div class="kpi-split-badges">
                            <div class="kpi-split-trend" id="kpi-all-trend"></div>
                        </div>
                    </div>
                    <div class="kpi-card-meta">
                        <div class="kpi-subtext" id="kpi-all-subtext">Avg All Sites (0 Sites)</div>
                    </div>
                </div>
            </div>

            <!-- ── Result DB Analysis & Status Penyelesaian DB (Grand Totals for All Sites) ── -->
            <div class="executive-db-row" id="all-card-executive-db-analysis">
                <!-- Left Column: Result DB Analysis Total -->
                <div class="executive-db-col" id="all-col-result-db-analysis">
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
                            <span class="db-grand-trend" id="all-db-grand-trend"></span>
                            <span class="so-status-badge"
                                style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 6px;">
                                Total DB: <span id="all-db-analysis-grand-total">0</span> QTY
                            </span>
                        </div>
                    </div>
                    <div class="db-status-card"
                        style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.03em;">
                                TOTAL RESULT DB</div>
                            <span class="db-trend-indicator" id="all-db-card-trend"></span>
                        </div>
                        <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px;"
                            id="all-db-val-total">0</div>
                    </div>
                </div>

                <!-- Right Column: Status Penyelesaian DB Summary -->
                <div class="executive-db-col" id="all-col-status-db-analysis">
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
                        style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem;">
                        <div class="db-status-card"
                            style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.75rem 1rem;">
                            <div style="font-size: 11px; font-weight: 700; color: #16a34a; letter-spacing: 0.03em;">
                                SOLVED</div>
                            <div style="font-size: 22px; font-weight: 800; color: #15803d; margin-top: 4px;"
                                id="all-db-status-val-solved">0</div>
                        </div>
                        <div class="db-status-card"
                            style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.75rem 1rem;">
                            <div style="font-size: 11px; font-weight: 700; color: #d97706; letter-spacing: 0.03em;">
                                UNSOLVED</div>
                            <div style="font-size: 22px; font-weight: 800; color: #b45309; margin-top: 4px;"
                                id="all-db-status-val-unsolved">0</div>
                        </div>
                        <div class="db-status-card"
                            style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.75rem 1rem;">
                            <div style="font-size: 11px; font-weight: 700; color: #2563eb; letter-spacing: 0.03em;">NEW
                                DB</div>
                            <div style="font-size: 22px; font-weight: 800; color: #1d4ed8; margin-top: 4px;"
                                id="all-db-status-val-new">0</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ── Card: Score Card Summary (All Sites) ── -->
    <div class="card" id="all-card-scorecard-summary" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
        <div class="card-header"
            style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
                <h2 class="card-title">Score Card Summary (All Sites)</h2>
                <p class="card-subtitle">Evaluasi Rating & SO Execution seluruh site</p>
            </div>
            <span id="all-scorecard-total-sites-badge" class="badge"
                style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 11.5px; padding: 4px 10px; border-radius: 6px;">
                0 Sites Total
            </span>
        </div>
        <div class="card-body" style="padding: 1.25rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
                <!-- Rating Pie Card -->
                <div class="scorecard-subcard" id="all-scorecard-rating-card"
                    style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
                    <h4
                        style="margin: 0 0 0.75rem 0; font-size: 13px; font-weight: 700; color: #334155; text-align: center;">
                        Rating</h4>
                    <div style="position: relative; height: 180px;">
                        <canvas id="all-chart-scorecard-rating"></canvas>
                    </div>
                    <div
                        style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem; font-size: 11px;">
                        <span><strong style="color: #16a34a;">Very Good:</strong> <span
                                id="all-stat-rating-vg">0</span></span>
                        <span><strong style="color: #3b82f6;">Good:</strong> <span
                                id="all-stat-rating-g">0</span></span>
                        <span><strong style="color: #f59e0b;">Moderate:</strong> <span
                                id="all-stat-rating-m">0</span></span>
                        <span><strong style="color: #f97316;">Poor:</strong> <span
                                id="all-stat-rating-p">0</span></span>
                        <span><strong style="color: #dc2626;">Very Poor:</strong> <span
                                id="all-stat-rating-vp">0</span></span>
                    </div>
                </div>

                <!-- Execution Pie Card -->
                <div class="scorecard-subcard" id="all-scorecard-exec-card"
                    style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
                    <h4
                        style="margin: 0 0 0.75rem 0; font-size: 13px; font-weight: 700; color: #334155; text-align: center;">
                        SO Execution</h4>
                    <div style="position: relative; height: 180px;">
                        <canvas id="all-chart-scorecard-exec"></canvas>
                    </div>
                    <div
                        style="display: flex; justify-content: center; gap: 1.25rem; margin-top: 0.75rem; font-size: 11.5px;">
                        <span><strong style="color: #16a34a;">Executed:</strong> <span
                                id="all-stat-exec-yes">0</span></span>
                        <span><strong style="color: #dc2626;">Not Executed:</strong> <span
                                id="all-stat-exec-no">0</span></span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ── Card: Trend Line Graphics (Count All - Not Per Dept or Subdept) ── -->
    <div class="card" id="all-card-trend-all-wrapper" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
        <div class="card-header"
            style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
                <h3 class="card-title"
                    style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                    Trend Achievement SO (All Sites)
                </h3>
                <p class="card-subtitle" id="all-trend-all-subtitle"
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
            <div style="position: relative; height: 340px; width: 100%;">
                <canvas id="all-chart-trend-all"></canvas>
            </div>
        </div>
    </div>

    <!-- ── Card: Report Hasil Stock Opname (All Data) ─────────── -->
    <div class="card" id="card-hasil-so-all" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <h2 class="card-title">Report Hasil Stock Opname (All Sites)</h2>
                <p class="card-subtitle">Hasil pencapaian Stock Opname untuk seluruh site</p>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <input type="search" id="hasil-so-search" class="table-search-input unified-search-input"
                    placeholder="Search..." oninput="AllSummaryApp.applyHasilFilter()" style="max-width: 250px;">
                <select id="hasil-so-filter-status" class="form-control unified-filter-select"
                    onchange="AllSummaryApp.applyHasilFilter()" style="width: auto;">
                    <option value="all">Semua Status</option>
                    <option value="tercapai">Tercapai</option>
                    <option value="tidak_tercapai">Tidak Tercapai</option>
                    <option value="no_data">Belum Ada Data</option>
                </select>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
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
                                        style="width: 45px; text-align: center; vertical-align: middle; padding: 0.6rem 0.5rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        NO</th>
                                    <th rowspan="2"
                                        style="width: 110px; text-align: center; vertical-align: middle; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        SITE CODE</th>
                                    <th rowspan="2"
                                        style="vertical-align: middle; text-align: left; padding: 0.6rem 0.75rem; font-weight: 700; color: #475569; position: sticky; top: 0; background: #f8fafc; z-index: 2;">
                                        NAMA SITE</th>
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
                                    <td colspan="10" style="text-align: center; padding: 2rem; color: #94a3b8;">
                                        Memuat data Report SO...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!-- Table Pagination Footer -->
                    <div class="table-pagination-footer" style="margin-top: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <div id="hasil-so-table-info">Menampilkan 0 sampai 0 dari 0 data</div>
                        <div class="pagination-controls" id="hasil-so-pagination-controls"></div>
                    </div>
                </div>

                <!-- Right: Pie / Donut Chart for Tercapai vs Tidak Tercapai -->
                <div class="so-subdept-chart-wrapper">
                    <div class="so-pie-card">
                        <div class="so-pie-header">
                            <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                                Status Pencapaian (All Sites)</h3>
                            <p style="font-size: 11px; color: #64748b; margin: 0;" id="all-hasil-pie-subtitle">
                                Tercapai vs Tidak Tercapai</p>
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
    <div class="card" id="all-card-rekap-status-db" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <h2 class="card-title">Rekapitulasi Status Penyelesaian DB (All Sites)</h2>
                <p class="card-subtitle">Perbandingan status DB (Solved / Unsolved / New DB) seluruh site</p>
            </div>
        </div>
        <div class="card-body" style="padding: 1rem;">
            <div class="table-responsive"
                style="max-height: 400px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                <table class="reconciliation-table" style="margin: 0; font-size: 12px; width: 100%;">
                    <thead>
                        <tr>
                            <th style="width: 45px; text-align: center;">NO</th>
                            <th style="width: 120px; text-align: center;">SITE CODE</th>
                            <th>NAMA SITE</th>
                            <th>DEPT / SUB DEPT</th>
                            <th style="width: 130px;">REG NO</th>
                            <th>DESKRIPSI</th>
                            <th style="width: 100px; text-align: center;">STATUS</th>
                        </tr>
                    </thead>
                    <tbody id="rekap-db-status-tbody">
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">
                                Memuat data status DB...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <!-- Table Pagination Footer -->
            <div class="table-pagination-footer" style="margin-top: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
                <div id="all-rdb-status-pagination-info">Menampilkan 0 sampai 0 dari 0 data</div>
                <div class="pagination-controls" id="all-rdb-status-pagination-controls"></div>
            </div>
        </div>
    </div>

    <!-- ── Card: Rekapitulasi 2026 (All Sites) ──────────────── -->
    <div class="card" id="all-card-rekapitulasi" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <h2 class="card-title">Rekapitulasi Stock Opname (All Sites)</h2>
                <p class="card-subtitle">Rekapitulasi persentase fisik seluruh site per bulan</p>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <input type="search" id="all-rekap-search" class="table-search-input unified-search-input"
                    placeholder="Search..." oninput="AllSummaryApp.applyRekapFilter()" style="max-width: 240px;">
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
                            <th style="width: 40px; text-align: center;">NO</th>
                            <th style="width: 110px; text-align: center;">SITE CODE</th>
                            <th>NAMA SITE</th>
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
                    <tbody id="all-rekap-table-body">
                        <tr>
                            <td colspan="16" style="text-align: center; padding: 2rem; color: #94a3b8;">
                                Memuat data Rekapitulasi...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <!-- Table Pagination Footer -->
            <div class="table-pagination-footer" style="margin-top: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;">
                <div id="all-rekap-table-info">Menampilkan 0 sampai 0 dari 0 data</div>
                <div class="pagination-controls" id="all-rekap-pagination-controls"></div>
            </div>
        </div>
    </div>

    <!-- ── History Card Movement (Log Pergerakan & Perbandingan Site) ── -->
    <div class="card" id="all-card-site-movements"
        style="margin-top: 1.5rem; margin-bottom: 2rem; transition: all 0.3s ease;">
        <div class="card-header"
            style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding: 0.85rem 1.25rem; cursor: pointer;"
            onclick="AllSummaryApp.toggleMovementDetails()">
            <div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <h3 class="card-title" style="margin: 0; font-size: 1rem; font-weight: 700; color: #0f172a;">History
                        &amp; Log</h3>
                    <span id="all-sm-badge-total" class="badge"
                        style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 9999px;">
                        0 Perubahan
                    </span>
                </div>
                <p id="all-sm-period-subtitle" class="card-subtitle"
                    style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">
                    Memuat data perbandingan...
                </p>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;" onclick="event.stopPropagation()">
                <button type="button" class="btn btn-outline-secondary btn-sm" id="all-sm-btn-toggle"
                    onclick="AllSummaryApp.toggleMovementDetails()"
                    style="font-size: 12px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px;">
                    <span id="all-sm-toggle-text">Show</span>
                    <span id="all-sm-toggle-arrow" style="font-size: 11px; font-weight: bold;">▼</span>
                </button>
            </div>
        </div>

        <!-- Minimizable Body Wrapper (Hidden by default) -->
        <div id="all-sm-card-body-wrapper" style="display: none;">
            <!-- Comparison KPI Strip -->
            <div class="card-body"
                style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem;">
                    <!-- Card 1: Perubahan Status -->
                    <div
                        style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <div
                            style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                            Perubahan Status</div>
                        <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                            <span id="all-sm-stat-movements"
                                style="font-size: 1.35rem; font-weight: 800; color: #0284c7;">0</span>
                            <span style="font-size: 12px; color: #64748b;">Site berpindah</span>
                        </div>
                        <div id="all-sm-stat-movements-desc" style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                            Pada periode ini</div>
                    </div>

                    <!-- Card 2: Sites Aktif -->
                    <div
                        style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <div
                            style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                            Sites Aktif</div>
                        <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                            <span id="all-sm-stat-active"
                                style="font-size: 1.35rem; font-weight: 800; color: #0f172a;">0</span>
                            <span id="all-sm-stat-active-diff"><span
                                    class="kpi-target-indicator target-neutral"><span>-</span></span></span>
                        </div>
                        <div id="all-sm-stat-active-desc" style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                            vs bulan sebelumnya</div>
                    </div>

                    <!-- Card 3: Monthly Sites -->
                    <div
                        style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <div
                            style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                            Monthly Sites</div>
                        <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                            <span id="all-sm-stat-monthly"
                                style="font-size: 1.35rem; font-weight: 800; color: #16a34a;">0</span>
                            <span id="all-sm-stat-monthly-diff"><span
                                    class="kpi-target-indicator target-neutral"><span>-</span></span></span>
                        </div>
                        <div id="all-sm-stat-monthly-desc" style="font-size: 11px; color: #94a3b8; margin-top: 2px;">vs
                            bulan sebelumnya</div>
                    </div>

                    <!-- Card 4: Quarterly Sites -->
                    <div
                        style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <div
                            style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                            Quarterly Sites</div>
                        <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                            <span id="all-sm-stat-quarterly"
                                style="font-size: 1.35rem; font-weight: 800; color: #0284c7;">0</span>
                            <span id="all-sm-stat-quarterly-diff"><span
                                    class="kpi-target-indicator target-neutral"><span>-</span></span></span>
                        </div>
                        <div id="all-sm-stat-quarterly-desc" style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                            vs bulan sebelumnya</div>
                    </div>

                    <!-- Card 5: Inactive Sites -->
                    <div
                        style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <div
                            style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                            Inactive Sites</div>
                        <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 3px;">
                            <span id="all-sm-stat-inactive"
                                style="font-size: 1.35rem; font-weight: 800; color: #64748b;">0</span>
                            <span id="all-sm-stat-inactive-diff"><span
                                    class="kpi-target-indicator target-neutral"><span>-</span></span></span>
                        </div>
                        <div id="all-sm-stat-inactive-desc" style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                            Site nonaktif</div>
                    </div>
                </div>
            </div>

            <!-- Movement Logs Table Container -->
            <div id="all-sm-table-container" style="padding: 1.25rem;">
                <div
                    style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                    <input type="search" id="all-sm-search-input" class="table-search-input unified-search-input"
                        placeholder="Search..." oninput="AllSummaryApp.filterMovementsTable()"
                        onkeyup="AllSummaryApp.filterMovementsTable()" onsearch="AllSummaryApp.filterMovementsTable()">
                    <div style="font-size: 12px; color: #64748b;" id="all-sm-table-info">
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
                                <th style="padding: 8px 10px; text-align: center; min-width: 175px;">LOG HISTORY</th>
                                <th style="padding: 8px 10px; text-align: center; width: 120px;">PERIODE EFEKTIF</th>
                                <th style="padding: 8px 10px;">KETERANGAN</th>
                            </tr>
                        </thead>
                        <tbody id="all-sm-table-body">
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
    <button type="button" class="floating-chat-room-btn" id="btn-chat-room-fab-all"
        onclick="App.openChatRoomModal()"
        aria-label="Buka Chat Room PIC Sites">
        <svg viewBox="0 0 24 24">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 18.06c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.134 8.134 0 0 1-1.25-4.29c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.23.85 5.77 2.39a8.118 8.118 0 0 1 2.4 5.77c-.01 4.51-3.67 8.15-8.17 8.15zm4.48-6.11c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z"/>
        </svg>
    </button>
</section>