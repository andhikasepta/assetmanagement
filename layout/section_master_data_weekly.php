<?php
/**
 * Master Data Weekly Section (SPA Component)
 * Dedicated Page for SO Profile Weekly (Weekly Raw Stock Opname Data)
 */
if (!isset($currentMonth)) {
    $currentMonth = (int) date('n');
}
if (!isset($currentYear)) {
    $currentYear = (int) date('Y');
}
if (!isset($monthNames)) {
    $monthNames = [
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
}
?>
<section id="page-master-data-weekly" class="page-section" style="display: none;">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CARD: SO Profile Weekly                                    -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="card" id="card-master-opname-weekly">
        <div class="card-header">
            <div>
                <h2 class="card-title">SO Profile Weekly</h2>
                <p class="card-subtitle">Weekly Raw Stock Opname Data</p>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <button class="btn btn-refresh" onclick="App.loadMasterDataWeekly()">
                    Refresh
                </button>
                <button class="btn btn-danger" data-uac="master-weekly-delete" onclick="App.openBulkDeleteModalWeekly()">
                    Hapus Data
                </button>
                <button class="btn btn-primary" data-uac="master-weekly-add-import" onclick="App.openImportModalWeekly()">
                    Impor Data SO
                </button>
            </div>
        </div>

        <!-- Table Toolbar: Page Size & Search & Period Filters -->
        <div class="table-toolbar">
            <div class="table-toolbar-left">
                <label for="master-weekly-page-size">Tampilkan</label>
                <select id="master-weekly-page-size" class="form-control unified-filter-select" style="width: auto;"
                    autocomplete="off" onchange="App.changePageSizeWeekly(this.value)">
                    <option value="10" selected>10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="all">Semua</option>
                </select>
                <span>baris per halaman</span>

                <span style="margin-left: 1rem; border-left: 1px solid #e2e8f0; padding-left: 1rem;"></span>

                <label for="filter-weekly-month">BULAN</label>
                <select id="filter-weekly-month" class="form-control unified-filter-select" style="width: auto;"
                    autocomplete="off" onchange="App.applyFilterWeeklyAndRender()">
                    <option value="" selected>Semua Bulan</option>
                    <?php foreach ($monthNames as $num => $name): ?>
                        <option value="<?= $num ?>"><?= $name ?></option>
                    <?php endforeach; ?>
                </select>

                <label for="filter-weekly-week">WEEK</label>
                <select id="filter-weekly-week" class="form-control unified-filter-select" style="width: auto;"
                    autocomplete="off" onchange="App.applyFilterWeeklyAndRender()">
                    <option value="" selected>Semua Week</option>
                    <option value="1">Week 1</option>
                    <option value="2">Week 2</option>
                    <option value="3">Week 3</option>
                    <option value="4">Week 4</option>
                </select>

                <label for="filter-weekly-year">TAHUN</label>
                <select id="filter-weekly-year" class="form-control unified-filter-select" style="width: auto;"
                    autocomplete="off" onchange="App.applyFilterWeeklyAndRender()">
                    <option value="" selected>Semua Tahun</option>
                    <?php for ($y = $currentYear; $y <= $currentYear + 5; $y++): ?>
                        <option value="<?= $y ?>"><?= $y ?></option>
                    <?php endfor; ?>
                </select>
            </div>
            <div class="table-toolbar-right">
                <input type="text" id="master-weekly-search-input" class="table-search-input unified-search-input"
                    placeholder="Search..." autocomplete="off" value="" oninput="App.handleSearchWeekly(this.value)">
            </div>
        </div>

        <!-- 21-Column Stock Opname Weekly Table -->
        <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
                <table class="reconciliation-table" id="master-opname-weekly-table">
                    <thead>
                        <!-- Level 1 Header -->
                        <tr>
                            <th rowspan="3" class="text-center align-middle sortable" style="min-width: 280px;"
                                onclick="App.toggleSortWeekly('profile')">
                                Profile <span class="sort-indicator" data-col-weekly="profile">⇅</span>
                            </th>
                            <th colspan="2" class="text-center">Periode</th>
                            <th colspan="4" class="text-center">RESULT MATCH</th>
                            <th colspan="4" class="text-center">RESULT PHYSIC</th>
                            <th colspan="4" class="text-center">RESULT DB</th>
                            <th colspan="6" class="text-center">TOTAL</th>
                        </tr>

                        <!-- Level 2 Sub-Header -->
                        <tr>
                            <th rowspan="2" class="text-center align-middle sortable"
                                onclick="App.toggleSortWeekly('period_start')">
                                Start <span class="sort-indicator" data-col-weekly="period_start">⇅</span>
                            </th>
                            <th rowspan="2" class="text-center align-middle sortable"
                                onclick="App.toggleSortWeekly('period_end')">
                                End <span class="sort-indicator" data-col-weekly="period_end">⇅</span>
                            </th>
                            <th colspan="2" class="text-center">Physical</th>
                            <th colspan="2" class="text-center">NBV</th>
                            <th colspan="2" class="text-center">Physical</th>
                            <th colspan="2" class="text-center">NBV</th>
                            <th colspan="2" class="text-center">Physical</th>
                            <th colspan="2" class="text-center">NBV</th>
                            <th colspan="3" class="text-center">Physical</th>
                            <th colspan="3" class="text-center">NBV</th>
                        </tr>

                        <!-- Level 3 Leaf Column Headers -->
                        <tr>
                            <!-- Match Physic & NBV -->
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('match_physic_qty')">Qty
                                <span class="sort-indicator" data-col-weekly="match_physic_qty">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('match_physic_pct')">%
                                <span class="sort-indicator" data-col-weekly="match_physic_pct">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('match_nbv_value')">Value
                                <span class="sort-indicator" data-col-weekly="match_nbv_value">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('match_nbv_pct')">% <span
                                    class="sort-indicator" data-col-weekly="match_nbv_pct">⇅</span></th>

                            <!-- Physic Physic & NBV -->
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('physic_physic_qty')">Qty
                                <span class="sort-indicator" data-col-weekly="physic_physic_qty">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('physic_physic_pct')">%
                                <span class="sort-indicator" data-col-weekly="physic_physic_pct">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('physic_nbv_value')">Value
                                <span class="sort-indicator" data-col-weekly="physic_nbv_value">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('physic_nbv_pct')">%
                                <span class="sort-indicator" data-col-weekly="physic_nbv_pct">⇅</span>
                            </th>

                            <!-- DB Physic & NBV -->
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('db_physic_qty')">Qty
                                <span class="sort-indicator" data-col-weekly="db_physic_qty">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('db_physic_pct')">% <span
                                    class="sort-indicator" data-col-weekly="db_physic_pct">⇅</span></th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('db_nbv_value')">Value
                                <span class="sort-indicator" data-col-weekly="db_nbv_value">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('db_nbv_pct')">% <span
                                    class="sort-indicator" data-col-weekly="db_nbv_pct">⇅</span></th>

                            <!-- Total Physic: Actual, Target, % -->
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('total_physic_actual')">
                                Actual <span class="sort-indicator" data-col-weekly="total_physic_actual">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('total_physic_target')">
                                Target <span class="sort-indicator" data-col-weekly="total_physic_target">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('total_physic_pct')">%
                                <span class="sort-indicator" data-col-weekly="total_physic_pct">⇅</span>
                            </th>

                            <!-- Total NBV: Actual, Target, % -->
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('total_nbv_actual')">
                                Actual <span class="sort-indicator" data-col-weekly="total_nbv_actual">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('total_nbv_target')">
                                Target <span class="sort-indicator" data-col-weekly="total_nbv_target">⇅</span>
                            </th>
                            <th class="text-center sortable" onclick="App.toggleSortWeekly('total_nbv_pct')">% <span
                                    class="sort-indicator" data-col-weekly="total_nbv_pct">⇅</span></th>
                        </tr>
                    </thead>
                    <tbody id="master-opname-weekly-tbody">
                        <tr>
                            <td colspan="21" class="text-center" style="padding: 2.5rem; color: #64748b;">
                                Memuat data SO Profile Weekly...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Table Pagination Footer -->
        <div class="table-pagination-footer">
            <div id="master-weekly-pagination-info">Menampilkan 0 sampai 0 dari 0 data</div>
            <div class="pagination-controls" id="master-weekly-pagination-controls"></div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Import Excel SO Profile Weekly                       -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="import-weekly-modal" class="modal-backdrop" style="display: none;">
        <div class="modal-dialog">
            <div class="modal-header">
                <h3 class="modal-title">Impor Data SO Profile Weekly</h3>
                <button class="modal-close-btn" onclick="App.closeImportModalWeekly()">&times;</button>
            </div>
            <div class="modal-body">
                <!-- Period Selection: Month, Week & Year -->
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.65rem;">
                    <!-- Periode Bulan -->
                    <div class="form-group">
                        <label class="form-label" for="import-weekly-month">Periode Bulan</label>
                        <select id="import-weekly-month" class="form-control unified-filter-select">
                            <option value="auto" selected>Otomatis (Sesuai File Excel)</option>
                            <?php foreach ($monthNames as $num => $name): ?>
                                <option value="<?= $num ?>">
                                    <?= $name ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <!-- Week (Week 1, Week 2, until week 4) -->
                    <div class="form-group">
                        <label class="form-label" for="import-weekly-week">Week</label>
                        <select id="import-weekly-week" class="form-control unified-filter-select">
                            <option value="auto" selected>Otomatis (Sesuai File Excel)</option>
                            <option value="1">Week 1</option>
                            <option value="2">Week 2</option>
                            <option value="3">Week 3</option>
                            <option value="4">Week 4</option>
                        </select>
                    </div>

                    <!-- Periode Tahun -->
                    <div class="form-group">
                        <label class="form-label" for="import-weekly-year">Periode Tahun</label>
                        <select id="import-weekly-year" class="form-control unified-filter-select">
                            <option value="auto" selected>Otomatis (Sesuai File Excel)</option>
                            <?php for ($y = 2024; $y <= 2030; $y++): ?>
                                <option value="<?= $y ?>">
                                    <?= $y ?>
                                </option>
                            <?php endfor; ?>
                        </select>
                    </div>
                </div>

                <!-- Drag and Drop Upload Area -->
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Unggah File (.xlsx, .xls)</label>
                    <div id="drag-drop-zone-weekly" class="drag-drop-zone"
                        onclick="document.getElementById('import-weekly-file-input').click()">
                        <div class="drag-drop-text">Tarik &amp; lepas file Excel di sini</div>
                        <div class="drag-drop-subtext">atau klik untuk memilih dari komputer</div>
                    </div>
                    <input type="file" id="import-weekly-file-input" accept=".xlsx,.xls" style="display: none;"
                        onchange="App.handleFileSelectWeekly(this.files)">

                    <!-- Selected File Display -->
                    <div id="selected-weekly-file-display" style="display: none;">
                        <div class="selected-file-badge">
                            <div class="selected-file-info">
                                <span id="selected-weekly-file-name">file.xlsx</span>
                                <span id="selected-weekly-file-size" style="color: #64748b; font-size: 11px;">(0 KB)</span>
                            </div>
                            <button type="button" class="selected-file-remove"
                                onclick="App.clearSelectedFileWeekly()">&times;</button>
                        </div>
                    </div>
                </div>

                <!-- Sheet Selection Group -->
                <div class="form-group" id="import-weekly-sheet-group" style="display: none; margin-top: 1rem;">
                    <label class="form-label" for="import-weekly-sheet-select">Pilih Sheet</label>
                    <select id="import-weekly-sheet-select" class="form-control unified-filter-select" style="cursor: pointer; width: 100%;">
                        <option value="">Membaca sheet...</option>
                    </select>
                    <div id="import-weekly-sheet-hint" style="font-size: 11px; color: #64748b; margin-top: 4px;"></div>
                </div>

                <!-- Overwrite Option -->
                <div class="form-group" style="margin-top: 1rem; margin-bottom: 0.5rem;">
                    <label
                        style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 13px; color: #475569;">
                        <input type="checkbox" id="import-weekly-replace-existing" checked
                            style="width: 16px; height: 16px; cursor: pointer;">
                        <span><strong>Ganti data yang ada</strong> pada periode &amp; week ini</span>
                    </label>
                </div>

                <!-- Status message in modal -->
                <div id="modal-import-weekly-status"
                    style="display: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin-top: 12px;">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeImportModalWeekly()">Batal</button>
                <button class="btn btn-primary" id="modal-weekly-upload-btn" onclick="App.submitImportWeekly()">Unggah &amp;
                    Impor</button>
            </div>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: Bulk Delete SO Profile Weekly                        -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div id="bulk-delete-weekly-modal" class="modal-backdrop" style="display: none;">
        <div class="modal-dialog" style="max-width: 440px;">
            <div class="modal-header">
                <h3 class="modal-title" style="color: #ef4444;">Hapus Data SO Profile Weekly</h3>
                <button class="modal-close-btn" onclick="App.closeBulkDeleteModalWeekly()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 1rem;">
                    Pilih periode dan week data SO Weekly yang ingin dihapus dari database.
                </p>

                <div class="form-group">
                    <label class="form-label" for="bulk-delete-weekly-month">Periode Bulan</label>
                    <select id="bulk-delete-weekly-month" class="form-control unified-filter-select">
                        <option value="" selected>Semua Bulan</option>
                        <?php foreach ($monthNames as $num => $name): ?>
                            <option value="<?= $num ?>"><?= $name ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label" for="bulk-delete-weekly-week">Week</label>
                    <select id="bulk-delete-weekly-week" class="form-control unified-filter-select">
                        <option value="" selected>Semua Week</option>
                        <option value="1">Week 1</option>
                        <option value="2">Week 2</option>
                        <option value="3">Week 3</option>
                        <option value="4">Week 4</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label" for="bulk-delete-weekly-year">Periode Tahun</label>
                    <select id="bulk-delete-weekly-year" class="form-control unified-filter-select">
                        <option value="" selected>Semua Tahun</option>
                        <?php for ($y = 2024; $y <= 2030; $y++): ?>
                            <option value="<?= $y ?>" <?= ($y === $currentYear) ? 'selected' : '' ?>>
                                <?= $y ?>
                            </option>
                        <?php endfor; ?>
                    </select>
                </div>

                <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 10px; margin-top: 1rem;">
                    <div style="display: flex; gap: 8px;">
                        <span style="color: #ef4444; font-weight: bold;">⚠️</span>
                        <span style="font-size: 12px; color: #991b1b;">
                            Data yang dihapus tidak dapat dipulihkan kembali.
                        </span>
                    </div>
                </div>

                <div id="bulk-delete-weekly-status"
                    style="display: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin-top: 12px;">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.closeBulkDeleteModalWeekly()">Batal</button>
                <button class="btn btn-danger" id="bulk-delete-weekly-submit-btn" onclick="App.submitBulkDeleteWeekly()">
                    Ya, Hapus Data
                </button>
            </div>
        </div>
    </div>
</section>
