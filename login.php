<?php
/**
 * Simple Admin Login Form
 * Clean Corporate White Layout
 */

require_once __DIR__ . '/includes/auth.php';

// If already logged in, redirect to master-data
if (isLoggedIn()) {
    $redirect = $_GET['redirect'] ?? 'master-data';
    header('Location: index.php#' . urlencode($redirect));
    exit;
}

$error = '';
$usernameVal = '';
$passwordVal = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    $usernameVal = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');

    $result = attemptLogin($username, $password);
    if ($result['success']) {
        $redirect = $_POST['redirect'] ?? $_GET['redirect'] ?? 'master-data';
        header('Location: index.php#' . urlencode($redirect));
        exit;
    } else {
        $error = $result['message'] ?? 'Username atau Password salah.';
        $passwordVal = '';
    }
}

$redirectTarget = htmlspecialchars($_GET['redirect'] ?? 'master-data', ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Admin - Asset Management</title>
    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..800;1,14..32,400..700&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css?v=<?= filemtime(__DIR__ . '/assets/css/style.css') ?>">
    <link rel="stylesheet" href="layout/footer.css?v=<?= filemtime(__DIR__ . '/layout/footer.css') ?>">
    <style>
        body.login-page-body {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background: #f8fafc;
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .login-main-wrapper {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2.5rem 1.25rem;
        }

        .login-card-container {
            width: 100%;
            max-width: 440px;
        }

        .login-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03);
            overflow: hidden;
        }

        .login-header {
            padding: 2rem 2rem 1.25rem 2rem;
            text-align: center;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            border-bottom: 1px solid #f1f5f9;
        }

        .login-brand-icon {
            width: 48px;
            height: 48px;
            background: #eff6ff;
            color: #2563eb;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 0.85rem;
            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);
        }

        .login-title {
            font-size: 19px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 0.35rem;
            letter-spacing: -0.01em;
        }

        .login-subtitle {
            font-size: 12.5px;
            color: #64748b;
            line-height: 1.45;
        }

        .login-body {
            padding: 1.75rem 2rem 2rem 2rem;
        }

        .login-default-hint {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 0.75rem 0.9rem;
            margin-bottom: 1.35rem;
            font-size: 12px;
            color: #166534;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 0.75rem;
        }

        .login-default-hint strong {
            font-weight: 700;
            color: #14532d;
        }

        .btn-fill-default {
            background: #dcfce7;
            border: 1px solid #86efac;
            color: #166534;
            font-size: 11px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 5px;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.15s ease;
        }

        .btn-fill-default:hover {
            background: #bbf7d0;
        }

        .form-group {
            margin-bottom: 1.15rem;
        }

        .form-label {
            display: block;
            font-size: 12.5px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 0.4rem;
        }

        .input-password-wrapper {
            position: relative;
        }

        .btn-toggle-pwd {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .btn-toggle-pwd:hover {
            color: #475569;
        }

        .btn-login-submit {
            width: 100%;
            padding: 0.65rem 1rem;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            background: #2563eb;
            color: #ffffff;
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
            transition: all 0.15s ease;
            margin-top: 0.5rem;
        }

        .btn-login-submit:hover {
            background: #1d4ed8;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45);
        }

        .btn-login-submit:active {
            transform: translateY(1px);
        }

        .login-back-link {
            display: block;
            text-align: center;
            margin-top: 1.25rem;
            font-size: 12.5px;
            font-weight: 500;
            color: #64748b;
            text-decoration: none;
            transition: color 0.15s ease;
        }

        .login-back-link:hover {
            color: #2563eb;
            text-decoration: underline;
        }

        .login-alert-danger {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #b91c1c;
            padding: 0.65rem 0.85rem;
            border-radius: 8px;
            font-size: 12.5px;
            margin-bottom: 1.15rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
    </style>
</head>

<body class="login-page-body">

    <!-- Top Navigation Bar on Login Page -->
    <header class="navbar" style="position: sticky; top: 0; z-index: 100;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <!-- Hamburger Button for Quick Access -->
            <button type="button" class="quick-access-btn" id="btn-quick-access-toggle"
                onclick="toggleQuickAccess()" title="Quick Access" aria-label="Toggle Quick Access">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <a href="index.php" class="navbar-brand">
                Asset Management
            </a>
        </div>
    </header>

    <!-- Quick Access Drawer & Backdrop on Login Page -->
    <div id="quick-access-backdrop" class="quick-access-backdrop" onclick="toggleQuickAccess()"></div>
    <aside id="quick-access-drawer" class="quick-access-drawer" aria-label="Quick Access">
        <div class="quick-access-header">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
                <h3 class="quick-access-title">Quick Access</h3>
            </div>
            <button type="button" class="quick-access-close" onclick="toggleQuickAccess()" title="Tutup"
                aria-label="Close">
                &times;
            </button>
        </div>
        <div class="quick-access-body" id="quick-access-nav-list">
            <a class="quick-access-item" href="index.php#card-executive-summary"><span>Executive Summary</span></a>
            <a class="quick-access-item" href="index.php#card-executive-catatan"><span>Catatan Dan Evaluasi</span></a>
            <a class="quick-access-item" href="index.php#card-scorecard-summary"><span>Score Card Summary</span></a>
            <a class="quick-access-item" href="index.php#card-trend-dept-wrapper"><span>Trend Chart</span></a>
            <a class="quick-access-item" href="index.php#card-hasil-so-subdept"><span>Report SO</span></a>
            <a class="quick-access-item" href="index.php#card-rekapitulasi"><span>Rekapitulasi</span></a>
            <a class="quick-access-item" href="index.php#card-site-movements"><span>History &amp; Log</span></a>
        </div>
    </aside>

    <div class="login-main-wrapper">
        <div class="login-card-container">
            <div class="login-card">
                <div class="login-header">
                    <h1 class="login-title">LOGIN</h1>
                </div>

                <div class="login-body">
                    <?php if ($error !== ''): ?>
                        <div class="login-alert-danger">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2.2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <span><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></span>
                        </div>
                    <?php endif; ?>

                    <form method="POST" action="login.php" autocomplete="on">
                        <input type="hidden" name="redirect" value="<?= $redirectTarget ?>">

                        <div class="form-group">
                            <label class="form-label" for="input-username">Username</label>
                            <input type="text" id="input-username" name="username" class="form-control"
                                value="<?= $usernameVal ?>" placeholder="Masukkan username" required autofocus
                                style="padding: 0.6rem 0.8rem; font-size: 13.5px;">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="input-password">Password</label>
                            <div class="input-password-wrapper">
                                <input type="password" id="input-password" name="password" class="form-control"
                                    value="" placeholder="Masukkan password" required
                                    style="padding: 0.6rem 2.4rem 0.6rem 0.8rem; font-size: 13.5px;">
                                <button type="button" class="btn-toggle-pwd" onclick="togglePasswordVisibility()"
                                    title="Lihat/Sembunyikan Password">
                                    <svg id="eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <button type="submit" class="btn-login-submit">
                            LOGIN
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- App Layout Footer -->
    <?php require_once __DIR__ . '/layout/footer.php'; ?>

    <script>
        function toggleQuickAccess() {
            const drawer = document.getElementById('quick-access-drawer');
            const backdrop = document.getElementById('quick-access-backdrop');
            if (!drawer) return;
            const isOpen = drawer.classList.toggle('open');
            if (backdrop) backdrop.classList.toggle('open', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        }

        function togglePasswordVisibility() {
            const pwd = document.getElementById('input-password');
            const icon = document.getElementById('eye-icon');
            if (pwd.type === 'password') {
                pwd.type = 'text';
                icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
            } else {
                pwd.type = 'password';
                icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            }
        }
    </script>
</body>

</html>