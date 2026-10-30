<?php
/**
 * Section: Reports Page (SPA)
 * Berita Acara Hasil Asset Opname dan Tindak Lanjut Data DB
 * Contains:
 * - Period Controls (Month & Year)
 * - Metrics KPI Overview (Total Sites, Generated, Sent, Pending)
 * - Card 1: Generate Report (Dynamic table with Generate, Checklist status, Send WhatsApp to PIC)
 * - Card 2: Pending Report
 * - Card 3: Closed / Sent Report
 * - Preview Modal for 2-page BA Report
 */
?>
<section id="page-reports" class="page-section" style="display: none;">

    <!-- Page Header & Period Controls -->
    <div class="reports-page-header"
        style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
            <h1 style="font-size: 19px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.2;">Reports</h1>
            <p style="font-size: 12.5px; color: #64748b; margin: 2px 0 0 0;">Berita Acara Hasil Asset Opname dan Tindak
                Lanjut Data DB</p>
        </div>

        <!-- Periode Month & Year Filters -->
        <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.5rem;" id="reports-so-type-filter-group">
                <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">SO TYPE:</span>
                <div class="summary-type-slider-wrapper">
                    <button type="button" class="summary-type-slider-btn active" id="reports-btn-so-type-monthly"
                        onclick="App.switchReportsSOType('monthly')">
                        <span>Monthly</span>
                    </button>
                    <button type="button" class="summary-type-slider-btn" id="reports-btn-so-type-quarterly"
                        onclick="App.switchReportsSOType('quarterly')">
                        <span>Quarterly</span>
                    </button>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
                <label for="reports-filter-month"
                    style="font-size: 12px; font-weight: 600; color: #475569;">BULAN</label>
                <select id="reports-filter-month" class="form-control unified-filter-select" style="width: auto;"
                    onchange="App.onReportsPeriodChange()">
                    <?php
                    $reportsMonthNames = [
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
                    $defaultReportsMonth = (int) date('n');
                    $defaultReportsYear = (int) date('Y');
                    foreach ($reportsMonthNames as $num => $name): ?>
                        <option value="<?= $num ?>" <?= ($num === $defaultReportsMonth) ? 'selected' : '' ?>>
                            <?= $name ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
                <label for="reports-filter-year"
                    style="font-size: 12px; font-weight: 600; color: #475569;">TAHUN</label>
                <select id="reports-filter-year" class="form-control unified-filter-select" style="width: auto;"
                    onchange="App.onReportsPeriodChange()">
                    <?php
                    for ($y = 2025; $y <= 2028; $y++): ?>
                        <option value="<?= $y ?>" <?= ($y === $defaultReportsYear) ? 'selected' : '' ?>><?= $y ?></option>
                    <?php endfor; ?>
                </select>
            </div>
            <button class="btn btn-refresh" onclick="App.loadReportsData()" title="Muat Ulang Data">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            </button>
        </div>
    </div>

    <!-- Overview Stats Cards -->
    <div
        style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <!-- Card 1: Total Sites -->
        <div class="card"
            style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
            <div
                style="width: 42px; height: 42px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Sites
                </div>
                <div id="stat-reports-total-sites" style="font-size: 20px; font-weight: 700; color: #0f172a;">-</div>
            </div>
        </div>

        <!-- Card 2: Generated -->
        <div class="card"
            style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
            <div
                style="width: 42px; height: 42px; border-radius: 8px; background: #eff6ff; border: 1px solid #bfdbfe; display: flex; align-items: center; justify-content: center; color: #2563eb;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Generated
                </div>
                <div id="stat-reports-generated" style="font-size: 20px; font-weight: 700; color: #0f172a;">-</div>
            </div>
        </div>

        <!-- Card 3: Not Generated -->
        <div class="card"
            style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
            <div
                style="width: 42px; height: 42px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Not Generated
                </div>
                <div id="stat-reports-not-generated" style="font-size: 20px; font-weight: 700; color: #64748b;">-</div>
            </div>
        </div>

        <!-- Card 4: Pending (Sent to WA) -->
        <div class="card"
            style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
            <div
                style="width: 42px; height: 42px; border-radius: 8px; background: #fff7ed; border: 1px solid #fed7aa; display: flex; align-items: center; justify-content: center; color: #ea580c;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Pending
                </div>
                <div id="stat-reports-pending" style="font-size: 20px; font-weight: 700; color: #ea580c;">-</div>
            </div>
        </div>

        <!-- Card 5: Waiting Verification -->
        <div class="card"
            style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
            <div
                style="width: 42px; height: 42px; border-radius: 8px; background: #eff6ff; border: 1px solid #bfdbfe; display: flex; align-items: center; justify-content: center; color: #0284c7;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Waiting Verification
                </div>
                <div id="stat-reports-waiting-verif" style="font-size: 20px; font-weight: 700; color: #0284c7;">-</div>
            </div>
        </div>

        <!-- Card 6: Verified -->
        <div class="card"
            style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
            <div
                style="width: 42px; height: 42px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; color: #16a34a;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <polyline points="9 12 11 14 15 10"></polyline>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Verified
                </div>
                <div id="stat-reports-verified" style="font-size: 20px; font-weight: 700; color: #16a34a;">-</div>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CARD 1: Generate Report Table                               -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="card" id="card-generate-report" style="margin-bottom: 1.5rem;">
        <div class="card-header"
            style="display: flex; justify-content: space-between; align-items: center; padding: 0.95rem 1.25rem; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <h2 class="card-title" style="font-size: 15px; margin: 0; color: #0f172a; font-weight: 700;">Generate
                    Report</h2>
            </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="table-toolbar"
            style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.85rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
                <!-- Page size -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-page-size"
                        style="font-size: 12px; font-weight: 600; color: #475569;">Tampilkan</label>
                    <select id="reports-page-size" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.changeReportsPageSize(this.value)">
                        <option value="10">10</option>
                        <option value="15" selected>15</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="all">Semua</option>
                    </select>
                </div>

                <!-- Dept filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-filter-dept"
                        style="font-size: 12px; font-weight: 600; color: #475569;">DEPT</label>
                    <select id="reports-filter-dept" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onReportsDeptChange()">
                        <option value="all">Semua DEPT</option>
                    </select>
                </div>

                <!-- Subdept filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-filter-subdept" style="font-size: 12px; font-weight: 600; color: #475569;">SUB
                        DEPT</label>
                    <select id="reports-filter-subdept" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onReportsSubDeptChange()">
                        <option value="all">Semua SUB DEPT</option>
                    </select>
                </div>

                <!-- Status filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-filter-status"
                        style="font-size: 12px; font-weight: 600; color: #475569;">STATUS</label>
                    <select id="reports-filter-status" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onReportsStatusFilterChange()">
                        <option value="all">Semua Status</option>
                        <option value="generated">Generated</option>
                        <option value="not_generated">Not Generated</option>
                        <option value="sent">Sent</option>
                    </select>
                </div>
            </div>

            <!-- Search input (Rule 1: strictly placeholder="Search..." and required CSS classes) -->
            <div style="min-width: 240px;">
                <input type="text" id="reports-search-input" class="table-search-input unified-search-input"
                    placeholder="Search..." oninput="App.handleReportsSearch(this.value)">
            </div>
        </div>

        <!-- Table Container -->
        <div class="table-container" style="overflow-x: auto;">
            <table class="reconciliation-table" id="reports-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="width: 45px; text-align: center;">NO</th>
                        <th style="width: 105px;">DEPT</th>
                        <th style="width: 115px;">SUB DEPT</th>
                        <th style="width: 250px; max-width: 270px;">SITE CODE / SITE NAME</th>
                        <th style="width: 440px; min-width: 440px; text-align: center; white-space: nowrap;">ACTION</th>
                        <th style="width: 130px; text-align: center;">STATUS</th>
                    </tr>
                </thead>
                <tbody id="reports-tbody">
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
                            Memuat data laporan...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Table Pagination -->
        <div class="table-footer"
            style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.25rem; border-top: 1px solid #e2e8f0; flex-wrap: wrap; gap: 0.75rem;">
            <div id="reports-pagination-info" style="font-size: 12px; color: #64748b;">
                Menampilkan 0 sampai 0 dari 0 data
            </div>
            <div class="pagination-controls" id="reports-pagination-controls">
                <!-- Injected via JS -->
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CARD 2: Verification Report Table                           -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="card" id="card-verification-report" style="margin-bottom: 1.5rem;">
        <div class="card-header"
            style="display: flex; justify-content: space-between; align-items: center; padding: 0.95rem 1.25rem; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <h2 class="card-title" style="font-size: 15px; margin: 0; color: #0f172a; font-weight: 700;">
                    Verification Report</h2>
            </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="table-toolbar"
            style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.85rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
                <!-- Page size -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-verif-page-size"
                        style="font-size: 12px; font-weight: 600; color: #475569;">Tampilkan</label>
                    <select id="reports-verif-page-size" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.changeReportsVerifPageSize(this.value)">
                        <option value="10">10</option>
                        <option value="15" selected>15</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="all">Semua</option>
                    </select>
                </div>

                <!-- Dept filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-verif-filter-dept"
                        style="font-size: 12px; font-weight: 600; color: #475569;">DEPT</label>
                    <select id="reports-verif-filter-dept" class="form-control unified-filter-select"
                        style="width: auto;" onchange="App.onReportsVerifDeptChange()">
                        <option value="all">Semua DEPT</option>
                    </select>
                </div>

                <!-- Subdept filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-verif-filter-subdept"
                        style="font-size: 12px; font-weight: 600; color: #475569;">SUB DEPT</label>
                    <select id="reports-verif-filter-subdept" class="form-control unified-filter-select"
                        style="width: auto;" onchange="App.onReportsVerifSubDeptChange()">
                        <option value="all">Semua SUB DEPT</option>
                    </select>
                </div>

                <!-- Status filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-verif-filter-status"
                        style="font-size: 12px; font-weight: 600; color: #475569;">STATUS</label>
                    <select id="reports-verif-filter-status" class="form-control unified-filter-select"
                        style="width: auto;" onchange="App.onReportsVerifStatusFilterChange()">
                        <option value="all">Semua Status</option>
                        <option value="sent">Pending</option>
                        <option value="uploaded">Menunggu Verifikasi</option>
                        <option value="verified">Verified</option>
                    </select>
                </div>
            </div>

            <!-- Search input strictly follows AGENTS.md rule 1 -->
            <div style="min-width: 240px;">
                <input type="text" id="reports-verif-search-input" class="table-search-input unified-search-input"
                    placeholder="Search..." oninput="App.handleReportsVerifSearch(this.value)">
            </div>
        </div>

        <!-- Table Container -->
        <div class="table-container" style="overflow-x: auto;">
            <table class="reconciliation-table" id="reports-verif-table"
                style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="width: 45px; text-align: center;">NO</th>
                        <th style="width: 105px;">DEPT</th>
                        <th style="width: 115px;">SUB DEPT</th>
                        <th style="width: 240px; max-width: 260px;">SITE CODE / SITE NAME</th>
                        <th style="width: 130px; text-align: center;">SENT AT</th>
                        <th style="width: 130px; text-align: center;">DOKUMEN ASLI</th>
                        <th style="width: 150px; text-align: center;">DOKUMEN TTD</th>
                        <th style="width: 210px; text-align: center;">VERIFIKASI</th>
                        <th style="width: 125px; text-align: center;">STATUS</th>
                    </tr>
                </thead>
                <tbody id="reports-verif-tbody">
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
                            Memuat data verification report...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Table Pagination -->
        <div class="table-footer"
            style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.25rem; border-top: 1px solid #e2e8f0; flex-wrap: wrap; gap: 0.75rem;">
            <div id="reports-verif-pagination-info" style="font-size: 12px; color: #64748b;">
                Menampilkan 0 sampai 0 dari 0 data
            </div>
            <div class="pagination-controls" id="reports-verif-pagination-controls">
                <!-- Injected via JS -->
            </div>
        </div>
    </div>


    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Input Keterangan DB Sebelum Generate Berita Acara     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="report-keterangan-modal" class="modal-backdrop"
        style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); z-index: 10000; align-items: center; justify-content: center; padding: 1.5rem; backdrop-filter: blur(2px);">
        <div class="modal-card"
            style="background: #fff; width: 100%; max-width: 520px; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <!-- Modal Header -->
            <div
                style="padding: 1.1rem 1.4rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <div>
                    <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">Input Keterangan DB</h3>
                    <p id="report-keterangan-site-info" style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">
                        Site: -</p>
                </div>
                <button type="button" class="modal-close-btn" onclick="App.closeReportKeteranganModal()"
                    style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>

            <!-- Modal Body -->
            <div style="padding: 1.25rem 1.4rem;">
                <label for="report-keterangan-input"
                    style="display: block; font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">
                    Keterangan DB
                </label>
                <textarea id="report-keterangan-input" class="form-control" rows="3"
                    style="width: 100%; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; resize: vertical;"
                    placeholder="Isi Keterangan..." oninput="App.onReportKeteranganInput(this.value)"></textarea>
                <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 6px;">
                    <span id="report-keterangan-char-count" style="font-size: 11px; color: #94a3b8;">0 / 500</span>
                </div>
            </div>

            <!-- Modal Footer -->
            <div
                style="padding: 0.85rem 1.4rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.5rem; background: #f8fafc;">
                <button type="button" class="btn btn-secondary btn-sm"
                    onclick="App.closeReportKeteranganModal()">Batal</button>
                <button type="button" id="btn-submit-report-keterangan" class="btn btn-success btn-sm"
                    onclick="App.submitReportKeteranganAndGenerate()"
                    style="background: #10b981; border-color: #10b981; color: #fff; font-weight: 600; padding: 6px 16px; border-radius: 6px;">
                    Generate BA
                </button>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Upload Dokumen Berita Acara Bertanda-Tangan          -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="report-upload-signed-modal" class="modal-backdrop"
        style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); z-index: 10000; align-items: center; justify-content: center; padding: 1.5rem; backdrop-filter: blur(2px);">
        <div class="modal-card"
            style="background: #fff; width: 100%; max-width: 500px; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <!-- Modal Header -->
            <div
                style="padding: 1.1rem 1.4rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <div>
                    <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">Upload Dokumen BA
                        Bertanda-Tangan</h3>
                    <p id="report-upload-signed-site-info" style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">
                        Site: -</p>
                </div>
                <button type="button" class="modal-close-btn" onclick="App.closeUploadSignedModal()"
                    style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>

            <!-- Modal Body -->
            <form id="form-upload-signed-report" onsubmit="App.submitUploadSignedReport(event)" style="margin: 0;">
                <input type="hidden" id="upload-signed-sitecode" value="">
                <div style="padding: 1.35rem 1.4rem;">

                    <div id="upload-signed-dropzone"
                        onclick="document.getElementById('upload-signed-file-input').click()"
                        style="border: 2px dashed #cbd5e1; border-radius: 10px; padding: 1.5rem; text-align: center; background: #f8fafc; cursor: pointer; transition: all 0.2s ease;">
                        <input type="file" id="upload-signed-file-input" accept=".pdf,image/jpeg,image/png"
                            style="display: none;" onchange="App.onSignedFileSelected(this.files)">
                        <div style="color: #64748b;">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="1.8" style="margin: 0 auto 8px auto; display: block; color: #0284c7;">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <div style="font-size: 13px; font-weight: 600; color: #1e293b;">Pilih file atau drag and
                                drop file</div>
                        </div>
                    </div>

                    <div id="upload-signed-file-info"
                        style="display: none; margin-top: 0.85rem; padding: 0.65rem 0.85rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a"
                                stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span id="upload-signed-filename"
                                style="font-size: 12.5px; font-weight: 600; color: #15803d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">-</span>
                        </div>
                        <button type="button" onclick="App.clearSignedFileSelected()"
                            style="background: none; border: none; color: #ef4444; font-size: 16px; cursor: pointer; padding: 2px 6px;">&times;</button>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div
                    style="padding: 0.85rem 1.4rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.5rem; background: #f8fafc;">
                    <button type="button" class="btn btn-secondary btn-sm"
                        onclick="App.closeUploadSignedModal()">Batal</button>
                    <button type="submit" id="btn-submit-upload-signed" class="btn btn-primary btn-sm" disabled
                        style="background: #0284c7; border-color: #0284c7; color: #fff; font-weight: 600; padding: 6px 18px; border-radius: 6px;">
                        Upload Dokumen
                    </button>
                </div>
            </form>
        </div>
    </div>

</section>