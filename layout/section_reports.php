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
            <p style="font-size: 12.5px; color: #64748b; margin: 2px 0 0 0;">Berita Acara Hasil Asset Opname dan Tindak Lanjut Data DB</p>
        </div>

        <!-- Periode Month & Year Filters -->
        <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
                <label for="reports-filter-month"
                    style="font-size: 12px; font-weight: 600; color: #475569;">BULAN</label>
                <select id="reports-filter-month" class="form-control unified-filter-select" style="width: auto;"
                    onchange="App.onReportsPeriodChange()">
                    <?php
                    $reportsMonthNames = [
                        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
                        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
                        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
                    ];
                    $defaultReportsMonth = (int)date('n');
                    $defaultReportsYear = (int)date('Y');
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
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card" style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border-left: 4px solid #3b82f6;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: #2563eb;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Sites</div>
                <div id="stat-reports-total-sites" style="font-size: 20px; font-weight: 700; color: #0f172a;">-</div>
            </div>
        </div>

        <div class="card" style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border-left: 4px solid #10b981;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #ecfdf5; display: flex; align-items: center; justify-content: center; color: #059669;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Generated</div>
                <div id="stat-reports-generated" style="font-size: 20px; font-weight: 700; color: #059669;">-</div>
            </div>
        </div>

        <div class="card" style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border-left: 4px solid #06b6d4;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #ecfeff; display: flex; align-items: center; justify-content: center; color: #0891b2;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Sent to WhatsApp</div>
                <div id="stat-reports-sent" style="font-size: 20px; font-weight: 700; color: #0891b2;">-</div>
            </div>
        </div>

        <div class="card" style="margin: 0; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem; border-left: 4px solid #f59e0b;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #fffbeb; display: flex; align-items: center; justify-content: center; color: #d97706;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            </div>
            <div>
                <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase;">Not Generated</div>
                <div id="stat-reports-pending" style="font-size: 20px; font-weight: 700; color: #d97706;">-</div>
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
                <h2 class="card-title" style="font-size: 15px; margin: 0; color: #0f172a; font-weight: 700;">Generate Report</h2>
                <p class="card-subtitle" style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">
                    Tarik data periode terbaru, buat dokumen Berita Acara, dan kirimkan ke WhatsApp PIC Sites
                </p>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button class="btn btn-outline-primary btn-sm" onclick="App.downloadReportsSummaryExcel()" title="Export Ringkasan Status">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Ekspor Excel</span>
                </button>
            </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="table-toolbar"
            style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.85rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
                <!-- Page size -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-page-size" style="font-size: 12px; font-weight: 600; color: #475569;">Tampilkan</label>
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
                    <label for="reports-filter-dept" style="font-size: 12px; font-weight: 600; color: #475569;">DEPT</label>
                    <select id="reports-filter-dept" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onReportsDeptChange()">
                        <option value="all">Semua DEPT</option>
                    </select>
                </div>

                <!-- Subdept filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-filter-subdept" style="font-size: 12px; font-weight: 600; color: #475569;">SUB DEPT</label>
                    <select id="reports-filter-subdept" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onReportsSubDeptChange()">
                        <option value="all">Semua SUB DEPT</option>
                    </select>
                </div>

                <!-- Status filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="reports-filter-status" style="font-size: 12px; font-weight: 600; color: #475569;">STATUS</label>
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
                        <th style="width: 110px;">DEPT</th>
                        <th style="width: 120px;">SUB DEPT</th>
                        <th>SITE CODE / SITE NAME</th>
                        <th style="width: 290px; text-align: center;">ACTION</th>
                        <th style="width: 150px; text-align: center;">STATUS</th>
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
    <!-- PREVIEW MODAL: Berita Acara BA Document                     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="report-preview-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); z-index: 9999; align-items: center; justify-content: center; padding: 1.5rem; backdrop-filter: blur(2px);">
        <div class="modal-card" style="background: #fff; width: 100%; max-width: 960px; max-height: 92vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <!-- Modal Header -->
            <div style="padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <div>
                    <h3 id="report-preview-title" style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Preview Berita Acara</h3>
                    <p id="report-preview-sub" style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Pratinjau dokumen BA 2 Halaman</p>
                </div>
                <button type="button" class="modal-close-btn" onclick="App.closeReportPreviewModal()"
                    style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>

            <!-- Modal Body (Iframe for pixel-perfect print layout) -->
            <div style="flex: 1; padding: 0; background: #e2e8f0; overflow: hidden; position: relative; min-height: 520px;">
                <iframe id="report-preview-iframe" src="about:blank"
                    style="width: 100%; height: 100%; min-height: 520px; border: none; background: #fff;"></iframe>
            </div>

            <!-- Modal Footer -->
            <div style="padding: 0.85rem 1.5rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; flex-wrap: wrap; gap: 0.5rem;">
                <div style="font-size: 12px; color: #64748b;">
                    <span id="report-preview-meta">Dokumen Berita Acara v1.2</span>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="App.printReportIframe()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                        <span>Cetak / Print</span>
                    </button>
                    <a id="report-preview-download-pdf" href="#" target="_blank" class="btn btn-outline-primary btn-sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>Unduh PDF</span>
                    </a>
                    <button type="button" id="report-preview-btn-wa" class="btn btn-success btn-sm" onclick="App.sendCurrentPreviewWhatsApp()" style="display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-arrow-right fa-arrow-right" style="font-size: 12px;"></i>
                        <span>Kirim WhatsApp</span>
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="App.closeReportPreviewModal()">Tutup</button>
                </div>
            </div>
        </div>
    </div>

</section>