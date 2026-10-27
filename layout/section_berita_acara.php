<?php
/**
 * Section: Berita Acara Page (SPA)
 * Monitoring & Arsip Berita Acara Hasil Asset Opname dan Tindak Lanjut Data DB
 * Contains:
 * - Period Controls (SO Type, Month, Year)
 * - 3 KPI Metric Overview Cards:
 *     1. Value Generated Report
 *     2. Pending Report (Status hanya sent to whatsapp)
 *     3. Report Verified (Report yang sudah di-upload ulang dan verified oleh admin)
 * - Table: Daftar Berita Acara (Preview/Download Dokumen Asli & Dokumen TTD, Verifikator, Status)
 */
?>
<section id="page-berita-acara" class="page-section" style="display: none;">

    <!-- Page Header & Period Controls -->
    <div class="reports-page-header"
        style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
            <h1 style="font-size: 19px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.2;">Berita Acara
            </h1>
            <p style="font-size: 12.5px; color: #64748b; margin: 2px 0 0 0;">Monitoring Berita Acara Hasil Asset Opname
                dan Tindak Lanjut Data DB</p>
        </div>

        <!-- Periode Month & Year Filters -->
        <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.5rem;" id="ba-so-type-filter-group">
                <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">SO TYPE:</span>
                <div class="summary-type-slider-wrapper">
                    <button type="button" class="summary-type-slider-btn active" id="ba-btn-so-type-monthly"
                        onclick="App.switchBaSOType('monthly')">
                        <span>Monthly</span>
                    </button>
                    <button type="button" class="summary-type-slider-btn" id="ba-btn-so-type-quarterly"
                        onclick="App.switchBaSOType('quarterly')">
                        <span>Quarterly</span>
                    </button>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
                <label for="ba-filter-month" style="font-size: 12px; font-weight: 600; color: #475569;">BULAN</label>
                <select id="ba-filter-month" class="form-control unified-filter-select" style="width: auto;"
                    onchange="App.onBaPeriodChange()">
                    <?php
                    $baMonthNames = [
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
                    $defaultBaMonth = (int) date('n');
                    $defaultBaYear = (int) date('Y');
                    foreach ($baMonthNames as $num => $name): ?>
                        <option value="<?= $num ?>" <?= ($num === $defaultBaMonth) ? 'selected' : '' ?>>
                            <?= $name ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
                <label for="ba-filter-year" style="font-size: 12px; font-weight: 600; color: #475569;">TAHUN</label>
                <select id="ba-filter-year" class="form-control unified-filter-select" style="width: auto;"
                    onchange="App.onBaPeriodChange()">
                    <?php
                    for ($y = 2025; $y <= 2028; $y++): ?>
                        <option value="<?= $y ?>" <?= ($y === $defaultBaYear) ? 'selected' : '' ?>><?= $y ?></option>
                    <?php endfor; ?>
                </select>
            </div>
            <button class="btn btn-refresh" onclick="App.loadBeritaAcaraData()" title="Muat Ulang Data">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            </button>
        </div>
    </div>

    <!-- 3 Overview Stats Cards as requested: Generated, Pending, Verified -->
    <div
        style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <!-- Card 1: Value Generated Report -->
        <div class="card"
            style="margin: 0; padding: 1.15rem 1.35rem; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <div
                style="width: 46px; height: 46px; border-radius: 10px; background: #eff6ff; border: 1px solid #bfdbfe; display: flex; align-items: center; justify-content: center; color: #2563eb;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            </div>
            <div>
                <div
                    style="font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                    Generated Report</div>
                <div id="stat-ba-generated"
                    style="font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-top: 2px;">-
                </div>
            </div>
        </div>

        <!-- Card 2: Pending Report (Status hanya sent to whatsapp) -->
        <div class="card"
            style="margin: 0; padding: 1.15rem 1.35rem; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <div
                style="width: 46px; height: 46px; border-radius: 10px; background: #fff7ed; border: 1px solid #fed7aa; display: flex; align-items: center; justify-content: center; color: #ea580c;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            </div>
            <div>
                <div
                    style="font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                    Pending Report</div>
                <div id="stat-ba-pending"
                    style="font-size: 22px; font-weight: 800; color: #ea580c; line-height: 1.2; margin-top: 2px;">-
                </div>
            </div>
        </div>

        <!-- Card 3: Report Verified (Report yang sudah di upload ulang dan verified) -->
        <div class="card"
            style="margin: 0; padding: 1.15rem 1.35rem; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <div
                style="width: 46px; height: 46px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; color: #16a34a;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <polyline points="9 12 11 14 15 10"></polyline>
                </svg>
            </div>
            <div>
                <div
                    style="font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
                    Report Verified</div>
                <div id="stat-ba-verified"
                    style="font-size: 22px; font-weight: 800; color: #16a34a; line-height: 1.2; margin-top: 2px;">-
                </div>
            </div>
        </div>
    </div>

    <!-- Table Card: Daftar Berita Acara -->
    <div class="card" id="card-berita-acara-table" style="margin-bottom: 1.5rem;">
        <div class="card-header"
            style="display: flex; justify-content: space-between; align-items: center; padding: 0.95rem 1.25rem; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <h2 class="card-title" style="font-size: 15px; margin: 0; color: #0f172a; font-weight: 700;">Daftar
                    Berita Acara Tindak Lanjut DB</h2>
            </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="table-toolbar"
            style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.85rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
                <!-- Page size -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="ba-page-size"
                        style="font-size: 12px; font-weight: 600; color: #475569;">Tampilkan</label>
                    <select id="ba-page-size" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.changeBaPageSize(this.value)">
                        <option value="10">10</option>
                        <option value="15" selected>15</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="all">Semua</option>
                    </select>
                </div>

                <!-- Dept filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="ba-filter-dept" style="font-size: 12px; font-weight: 600; color: #475569;">DEPT</label>
                    <select id="ba-filter-dept" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onBaDeptChange()">
                        <option value="all">Semua DEPT</option>
                    </select>
                </div>

                <!-- Subdept filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="ba-filter-subdept" style="font-size: 12px; font-weight: 600; color: #475569;">SUB
                        DEPT</label>
                    <select id="ba-filter-subdept" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onBaSubDeptChange()">
                        <option value="all">Semua SUB DEPT</option>
                    </select>
                </div>

                <!-- Status filter -->
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <label for="ba-filter-status"
                        style="font-size: 12px; font-weight: 600; color: #475569;">STATUS</label>
                    <select id="ba-filter-status" class="form-control unified-filter-select" style="width: auto;"
                        onchange="App.onBaStatusFilterChange()">
                        <option value="all">Semua Status</option>
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                    </select>
                </div>
            </div>

            <!-- Search input strictly follows AGENTS.md rule 1 -->
            <div style="min-width: 240px;">
                <input type="text" id="ba-search-input" class="table-search-input unified-search-input"
                    placeholder="Search..." oninput="App.handleBaSearch(this.value)">
            </div>
        </div>

        <!-- Table Container -->
        <div class="table-container" style="overflow-x: auto;">
            <table class="reconciliation-table" id="ba-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="width: 45px; text-align: center;">NO</th>
                        <th style="width: 105px;">DEPT</th>
                        <th style="width: 115px;">SUB DEPT</th>
                        <th style="width: 240px; max-width: 260px;">SITE CODE / SITE NAME</th>
                        <th style="width: 150px; text-align: center;">DOKUMEN</th>
                        <th style="width: 180px; text-align: center;">TANGGAL & VERIFICATOR</th>
                        <th style="width: 125px; text-align: center;">STATUS</th>
                    </tr>
                </thead>
                <tbody id="ba-tbody">
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
                            Memuat data Berita Acara...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Table Pagination -->
        <div class="table-footer"
            style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.25rem; border-top: 1px solid #e2e8f0; flex-wrap: wrap; gap: 0.75rem;">
            <div id="ba-pagination-info" style="font-size: 12px; color: #64748b;">
                Menampilkan 0 sampai 0 dari 0 data
            </div>
            <div class="pagination-controls" id="ba-pagination-controls">
                <!-- Injected via JS -->
            </div>
        </div>
    </div>

</section>