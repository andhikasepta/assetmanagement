<?php
/**
 * Clean Corporate In-Page Login View (SPA)
 * Styled exactly like login.php (not a modal popup), maintaining clean URL (wmsdev.my.id/amora/)
 */
$csrfToken = getCsrfToken();
?>
<section id="page-login" class="page-section"
    style="display: none; min-height: calc(100vh - 120px); align-items: center; justify-content: center;">
    <div class="login-main-wrapper"
        style="width: 100%; display: flex; align-items: center; justify-content: center; padding: 2.5rem 1rem;">
        <div class="login-card-container" style="width: 100%; max-width: 440px;">
            <div class="login-card"
                style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03); overflow: hidden;">
                <!-- Login Card Header -->
                <div class="login-header"
                    style="padding: 2rem 2rem 1.25rem 2rem; text-align: center; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #f1f5f9;">
                    <h1 class="login-title"
                        style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 0.35rem 0; letter-spacing: -0.01em;">
                        LOGIN
                    </h1>
                </div>

                <!-- Login Card Body -->
                <div class="login-body" style="padding: 1.75rem 2rem 2rem 2rem;">
                    <!-- Error Alert -->
                    <div id="login-page-alert"
                        style="display: none; padding: 0.75rem 0.95rem; border-radius: 8px; font-size: 12.5px; margin-bottom: 1.25rem; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2.2" style="flex-shrink: 0;">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <span id="login-page-alert-msg">Username atau Password salah.</span>
                        </div>
                    </div>

                    <form id="form-login-page" onsubmit="App.submitLogin(event)">
                        <input type="hidden" id="login-page-csrf" name="csrf_token"
                            value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">

                        <!-- Username Field -->
                        <div class="form-group" style="margin-bottom: 1.15rem;">
                            <label class="form-label" for="login-page-username"
                                style="display: block; font-size: 12.5px; font-weight: 600; color: #334155; margin-bottom: 0.4rem;">
                                Username
                            </label>
                            <input type="text" id="login-page-username" name="username" class="form-control"
                                placeholder="Masukkan username" required autocomplete="username"
                                style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; font-size: 13.5px; border-radius: 8px; border: 1px solid #cbd5e1; height: 42px;">
                        </div>

                        <!-- Password Field -->
                        <div class="form-group" style="margin-bottom: 1.35rem;">
                            <label class="form-label" for="login-page-password"
                                style="display: block; font-size: 12.5px; font-weight: 600; color: #334155; margin-bottom: 0.4rem;">
                                Password
                            </label>
                            <div style="position: relative;">
                                <input type="password" id="login-page-password" name="password" class="form-control"
                                    placeholder="Masukkan password" required autocomplete="current-password"
                                    style="width: 100%; box-sizing: border-box; padding: 0.65rem 2.5rem 0.65rem 0.85rem; font-size: 13.5px; border-radius: 8px; border: 1px solid #cbd5e1; height: 42px;">
                                <button type="button" onclick="App.toggleLoginPassword()"
                                    title="Tampilkan / Sembunyikan Password"
                                    style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: flex; align-items: center;">
                                    <svg id="login-page-eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <!-- Submit Button -->
                        <button type="submit" id="login-page-submit-btn" class="btn-login-submit"
                            style="width: 100%; padding: 0.7rem 1rem; font-size: 14px; font-weight: 600; border-radius: 8px; background: #2563eb; color: #ffffff; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35); transition: all 0.15s ease; display: flex; align-items: center; justify-content: center; gap: 0.5rem; height: 42px;">
                            <span id="login-page-spinner"
                                style="display: none; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;"></span>
                            <span id="login-page-submit-text">LOGIN</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</section>