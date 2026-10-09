<?php
// 1. Check Login Page
$_SESSION = [];
ob_start();
include __DIR__ . '/../login.php';
$loginHtml = ob_get_clean();

$loginHasNavbar = strpos($loginHtml, '<header class="navbar') !== false;
$loginHasSummaryNav = strpos($loginHtml, '<nav class="navbar-menu"') !== false || (strpos($loginHtml, 'Summary') !== false && strpos($loginHtml, 'navbar-brand') !== false && strpos($loginHtml, 'nav-link') !== false);
$loginHasHamburger = strpos($loginHtml, 'id="btn-quick-access-toggle"') !== false;
$loginHasDrawer = strpos($loginHtml, 'id="quick-access-drawer"') !== false;
$loginHasEmptyUsername = strpos($loginHtml, 'id="input-username" name="username" class="form-control"') !== false && strpos($loginHtml, 'value=""') !== false;
$loginHasAutofillVal = strpos($loginHtml, 'value="D3utsch"') !== false || strpos($loginHtml, 'value="S3pt4@##!@#"') !== false;

echo "=== LOGIN PAGE CHECK ===" . PHP_EOL;
echo "Navbar rendered: " . ($loginHasNavbar ? "YES (Correct)" : "NO") . PHP_EOL;
echo "Summary nav link in navbar: " . ($loginHasSummaryNav ? "YES (Wrong - should be removed)" : "NO (Correct - removed)") . PHP_EOL;
echo "Hamburger button rendered: " . ($loginHasHamburger ? "YES (Correct)" : "NO") . PHP_EOL;
echo "Quick access drawer rendered: " . ($loginHasDrawer ? "YES (Correct)" : "NO") . PHP_EOL;
echo "Autofilled credentials in HTML: " . ($loginHasAutofillVal ? "YES (Wrong - should be empty)" : "NO (Correct - empty)") . PHP_EOL;

// 2. Check Admin Session on index.php
$_SESSION['user'] = [
    'id' => 2,
    'username' => 'D3utsch',
    'name' => 'Asset Management Administrator',
    'role' => 'admin'
];
ob_start();
include __DIR__ . '/../index.php';
$adminHtml = ob_get_clean();

$dropdownHasFullNameTrigger = strpos($adminHtml, '<span class="user-name-text">') !== false && strpos($adminHtml, 'Asset Management Administrator') !== false;
$dropdownMenuHasHeader = strpos($adminHtml, 'user-dropdown-header') !== false;
$dropdownMenuHasUsernameSpan = strpos($adminHtml, '@D3utsch') !== false;
$dropdownMenuHasAdminBadge = strpos($adminHtml, 'badge-role') !== false;
$dropdownMenuHasLogout = strpos($adminHtml, 'href="logout.php"') !== false;

echo PHP_EOL . "=== ADMIN DROPDOWN CHECK ===" . PHP_EOL;
echo "Dropdown trigger shows full name: " . ($dropdownHasFullNameTrigger ? "YES (Correct)" : "NO") . PHP_EOL;
echo "Dropdown menu has header / user-dropdown-header: " . ($dropdownMenuHasHeader ? "YES (Wrong - should be removed)" : "NO (Correct - removed)") . PHP_EOL;
echo "Dropdown menu has @D3utsch: " . ($dropdownMenuHasUsernameSpan ? "YES (Wrong - should be removed)" : "NO (Correct - removed)") . PHP_EOL;
echo "Dropdown menu has Admin span / badge: " . ($dropdownMenuHasAdminBadge ? "YES (Wrong - should be removed)" : "NO (Correct - removed)") . PHP_EOL;
echo "Dropdown menu has Logout: " . ($dropdownMenuHasLogout ? "YES (Correct)" : "NO") . PHP_EOL;
