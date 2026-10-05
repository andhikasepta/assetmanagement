<?php
$_GET = ['action' => 'summary', 'month' => '9', 'year' => '2026', 'so_type' => 'monthly'];
$_SERVER['REQUEST_METHOD'] = 'GET';
ob_start();
require 'api/reconciliation.php';
$output = ob_get_clean();
$json = json_decode($output, true);
echo "achievements:\n";
print_r($json['achievements'] ?? []);
echo "sub_dept_results for ERO:\n";
foreach ($json['sub_dept_results'] ?? [] as $sub) {
    if (($sub['dept'] ?? '') === 'ERO') {
        echo "SubDept {$sub['sub_dept']}: Total Sites = {$sub['total_sites']}, Done = {$sub['done_count']}\n";
    }
}
unlink(__FILE__);
