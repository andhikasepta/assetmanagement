<?php
/**
 * Section: Reports Page (SPA)
 * Contains 3 Cards: Generate Report, Pending Report, Closed Report
 * Clean empty structure without dummy data as requested
 */
?>
<section id="page-reports" class="page-section" style="display: none;">

    <!-- Page Header & Period Controls -->
    <div class="reports-page-header"
        style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
            <h1 style="font-size: 19px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.2;">Reports</h1>
            <p style="font-size: 12.5px; color: #64748b; margin: 2px 0 0 0;">Berita Acara Hasil Asset Opname dan Tindak Lanjut Data DB</p>
        </div>

        <!-- Periode Month & Year Filters -->
        <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
                <label for="reports-filter-month"
                    style="font-size: 12px; font-weight: 600; color: #475569;">BULAN</label>
                <select id="reports-filter-month" class="form-control unified-filter-select" style="width: auto;">
                    <option value="">Semua Bulan</option>
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
                    $defaultReportsMonth = 9;
                    $defaultReportsYear = 2026;
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
                <select id="reports-filter-year" class="form-control unified-filter-select" style="width: auto;">
                    <?php
                    for ($y = 2025; $y <= 2028; $y++): ?>
                        <option value="<?= $y ?>" <?= ($y === $defaultReportsYear) ? 'selected' : '' ?>><?= $y ?></option>
                    <?php endfor; ?>
                </select>
            </div>
        </div>
    </div>

    <!-- 3 Cards Grid / Container -->
    <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem;">

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!-- CARD 1: Generate Report                                     -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        <div class="card" id="card-generate-report" style="margin: 0;">
            <div class="card-header"
                style="display: flex; justify-content: space-between; align-items: center; padding: 0.95rem 1.25rem;">
                <div>
                    <h2 class="card-title" style="font-size: 15px; margin: 0; color: #0f172a;">Generate Report</h2>
                </div>
            </div>
            <div class="card-body" style="padding: 3rem 1.5rem; text-align: center;">
                <div style="display: inline-flex; flex-direction: column; align-items: center; max-width: 420px;">
                    <div
                        style="width: 52px; height: 52px; border-radius: 50%; background: #f8fafc; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #94a3b8; margin-bottom: 0.85rem;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="12" y1="18" x2="12" y2="12"></line>
                            <line x1="9" y1="15" x2="15" y2="15"></line>
                        </svg>
                    </div>
                    <h4 style="font-size: 14px; font-weight: 600; color: #334155; margin: 0 0 4px 0;">Generate Report
                    </h4>
                    <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.45;">No Data.</p>
                </div>
            </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!-- CARD 2: Pending Report                                      -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        <div class="card" id="card-pending-report" style="margin: 0;">
            <div class="card-header"
                style="display: flex; justify-content: space-between; align-items: center; padding: 0.95rem 1.25rem;">
                <div>
                    <h2 class="card-title" style="font-size: 15px; margin: 0; color: #0f172a;">Pending Report</h2>
                </div>
            </div>
            <div class="card-body" style="padding: 3rem 1.5rem; text-align: center;">
                <div style="display: inline-flex; flex-direction: column; align-items: center; max-width: 420px;">
                    <div
                        style="width: 52px; height: 52px; border-radius: 50%; background: #f8fafc; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #94a3b8; margin-bottom: 0.85rem;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </div>
                    <h4 style="font-size: 14px; font-weight: 600; color: #334155; margin: 0 0 4px 0;">Pending Report
                    </h4>
                    <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.45;">No data.</p>
                </div>
            </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!-- CARD 3: Closed Report                                       -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        <div class="card" id="card-closed-report" style="margin: 0;">
            <div class="card-header"
                style="display: flex; justify-content: space-between; align-items: center; padding: 0.95rem 1.25rem;">
                <div>
                    <h2 class="card-title" style="font-size: 15px; margin: 0; color: #0f172a;">Closed Report</h2>
                </div>
            </div>
            <div class="card-body" style="padding: 3rem 1.5rem; text-align: center;">
                <div style="display: inline-flex; flex-direction: column; align-items: center; max-width: 420px;">
                    <div
                        style="width: 52px; height: 52px; border-radius: 50%; background: #f8fafc; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #94a3b8; margin-bottom: 0.85rem;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <h4 style="font-size: 14px; font-weight: 600; color: #334155; margin: 0 0 4px 0;">Closed Report</h4>
                    <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.45;">No data.</p>
                </div>
            </div>
        </div>

    </div>
</section>