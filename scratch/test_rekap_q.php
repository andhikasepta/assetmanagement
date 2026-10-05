<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['category'] = 'quarterly';
$_GET['year'] = '2026';
ob_start();
require 'C:/laragon/www/assetmanagement/api/rekapitulasi.php';
$out = ob_get_clean();
$json = json_decode($out, true);
foreach ($json['data'] ?? [] as $row) {
    if ($row['sitecode'] === '0BANKLA001') {
        echo "0BANKLA001 on category=quarterly:\n";
        print_r($row['months']);
    }
}
