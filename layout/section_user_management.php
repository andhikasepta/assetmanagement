<?php
/**
 * User Management Section (SPA Component)
 * Administrator accounts and User Access Control (UAC) management
 */
?>
<section id="page-user-management" class="page-section" style="display: none;">
    <div class="card" id="card-user-management" style="margin-top: 1.5rem; margin-bottom: 2rem;">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
            <div>
                <h2 class="card-title" style="margin: 0;">User Management</h2>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <button class="btn btn-refresh" onclick="App.loadUsers()">
                    Refresh
                </button>
                <button class="btn btn-primary" onclick="App.openAddUserModal()"
                    style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Tambah User</span>
                </button>
            </div>
        </div>

        <!-- Toolbar: Search -->
        <div class="table-toolbar">
            <div class="table-toolbar-left">
                <span id="user-count-badge" style="font-size: 13px; font-weight: 600; color: #475569;">
                    Total: 0 user
                </span>
            </div>
            <div class="table-toolbar-right">
                <!-- Search strictly placeholder="Search..." with .table-search-input.unified-search-input -->
                <input type="text" id="user-search-input" class="table-search-input unified-search-input"
                    placeholder="Search..." autocomplete="off" oninput="App.handleUserSearch(this.value)">
            </div>
        </div>

        <!-- Users Table -->
        <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
                <table class="reconciliation-table" id="user-management-table" style="width: 100%;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <th style="width: 50px; text-align: center; vertical-align: middle;">NO</th>
                            <th style="min-width: 180px; text-align: left; vertical-align: middle;">NAMA USER</th>
                            <th style="min-width: 140px; text-align: left; vertical-align: middle;">USERNAME</th>
                            <th style="min-width: 320px; text-align: left; vertical-align: middle;">HAK AKSES (UAC)</th>
                            <th style="width: 150px; text-align: center; vertical-align: middle;">TERAKHIR DIPERBARUI
                            </th>
                            <th style="width: 140px; text-align: center; vertical-align: middle;">AKSI</th>
                        </tr>
                    </thead>
                    <tbody id="user-table-tbody">
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 2.5rem; color: #64748b;">
                                Memuat data user...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- MODAL: Tambah / Edit User (UAC)                                 -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div id="user-form-modal" class="modal-backdrop" style="display: none;">
    <div class="modal-dialog" style="max-width: 540px;">
        <div class="modal-header" style="align-items: center; border-bottom: 1px solid #e2e8f0; padding: 1rem 1.25rem;">
            <h3 class="modal-title" id="user-form-modal-title"
                style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">
                Tambah User Administrator
            </h3>
            <button type="button" class="modal-close-btn" onclick="App.closeUserModal()">&times;</button>
        </div>
        <form id="user-management-form" onsubmit="App.submitUserForm(event)">
            <input type="hidden" id="user-form-id" value="">
            <div class="modal-body" style="padding: 1.25rem;">

                <!-- Nama User -->
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label class="form-label" for="user-form-name"
                        style="font-size: 12px; font-weight: 600; color: #334155;">
                        Nama User <span style="color: #ef4444;">*</span>
                    </label>
                    <input type="text" id="user-form-name" class="form-control" required
                        placeholder="Masukkan nama user..." style="width: 100%; font-size: 13px;">
                </div>

                <!-- Username -->
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label class="form-label" for="user-form-username"
                        style="font-size: 12px; font-weight: 600; color: #334155;">
                        Username <span style="color: #ef4444;">*</span>
                    </label>
                    <input type="text" id="user-form-username" class="form-control" required
                        placeholder="Masukkan username..." style="width: 100%; font-size: 13px;">
                </div>

                <!-- Password -->
                <div class="form-group" style="margin-bottom: 1.25rem;">
                    <label class="form-label" for="user-form-password"
                        style="font-size: 12px; font-weight: 600; color: #334155;">
                        Password <span id="user-form-password-required" style="color: #ef4444;">*</span>
                    </label>
                    <input type="password" id="user-form-password" class="form-control"
                        placeholder="Masukkan password..." style="width: 100%; font-size: 13px;">
                    <span id="user-form-password-hint"
                        style="display: none; font-size: 11px; color: #64748b; margin-top: 4px;">
                        * Kosongkan jika tidak ingin mengubah password.
                    </span>
                </div>

                <!-- Divider -->
                <div style="border-top: 1px solid #e2e8f0; margin-bottom: 1rem;"></div>

                <!-- User Access Control (UAC) Section -->
                <div style="margin-bottom: 0.5rem;">
                    <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">
                        User Access Control (UAC)
                    </h4>

                    <!-- Group 1: Page Access -->
                    <div
                        style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.85rem;">
                        <span
                            style="display: block; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">
                            Akses Menu
                        </span>

                        <label
                            style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-all-summary" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">All
                                    Summary</span>
                            </div>
                        </label>

                        <label
                            style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-weekly-summary" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">Weekly
                                    Summary</span>
                            </div>
                        </label>

                        <label
                            style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-reports" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">Reports</span>
                            </div>
                        </label>

                        <label
                            style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-master-data" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">Master Data
                                    (SO Profile Monthly)</span>
                            </div>
                        </label>

                        <label
                            style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-master-data-weekly" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">Master Data Weekly
                                    (SO Profile)</span>
                            </div>
                        </label>

                        <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-user-management" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">User
                                    Management</span>
                            </div>
                        </label>
                    </div>

                    <!-- Group 2: Master Data Actions -->
                    <div
                        style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.85rem;">
                        <span
                            style="display: block; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">
                            Hak Akses Master Data
                        </span>

                        <label
                            style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-master-add-import" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">Add / Import Master
                                    Data</span>
                            </div>
                        </label>

                        <label
                            style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-master-edit" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">Edit Master
                                    Data</span>
                            </div>
                        </label>

                        <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-master-delete" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">Delete Master
                                    Data</span>
                            </div>
                        </label>
                    </div>

                    <!-- Group 3: Master Data Weekly Actions -->
                    <div
                        style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">
                        <span
                            style="display: block; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">
                            Hak Master Data Weekly
                        </span>

                        <label
                            style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-master-weekly-add-import" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">Add / Import SO
                                    Profile Weekly</span>
                            </div>
                        </label>

                        <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer;">
                            <input type="checkbox" id="user-uac-master-weekly-delete" checked
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <div>
                                <span style="font-size: 12.5px; font-weight: 600; color: #1e293b;">Delete SO Profile
                                    Weekly</span>
                            </div>
                        </label>
                    </div>

                </div>

            </div>
            <div class="modal-footer"
                style="padding: 0.85rem 1.25rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.6rem;">
                <button type="button" class="btn btn-secondary" onclick="App.closeUserModal()">Batal</button>
                <button type="submit" class="btn btn-primary" id="btn-submit-user">Simpan User</button>
            </div>
        </form>
    </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- MODAL: Konfirmasi Hapus User                                     -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div id="user-delete-modal" class="modal-backdrop" style="display: none;">
    <div class="modal-dialog" style="max-width: 420px;">
        <div class="modal-header" style="align-items: center; border-bottom: 1px solid #e2e8f0; padding: 1rem 1.25rem;">
            <h3 class="modal-title" style="margin: 0; font-size: 15px; font-weight: 700; color: #991b1b;">
                Hapus User Administrator
            </h3>
            <button type="button" class="modal-close-btn" onclick="App.closeUserDeleteModal()">&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.25rem;">
            <p style="margin: 0 0 0.5rem 0; font-size: 13px; color: #334155;">
                Apakah Anda yakin ingin menghapus user <strong id="delete-user-username-display"
                    style="color: #0f172a;"></strong>?
            </p>
            <p style="margin: 0; font-size: 11.5px; color: #64748b;">
                Tindakan ini tidak dapat dibatalkan. User yang telah dihapus tidak akan dapat masuk kembali ke sistem.
            </p>
        </div>
        <div class="modal-footer"
            style="padding: 0.85rem 1.25rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.6rem;">
            <button type="button" class="btn btn-secondary" onclick="App.closeUserDeleteModal()">Batal</button>
            <button type="button" class="btn btn-danger" id="btn-confirm-delete-user" onclick="App.confirmDeleteUser()">
                Hapus User
            </button>
        </div>
    </div>
</div>