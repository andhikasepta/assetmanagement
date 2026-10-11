<?php
$res = file_get_contents('http://localhost/assetmanagement/api/reconciliation.php?action=summary&year=2026&month=9&category=all');
$json = json_decode($res, true);
$dbA = $json['db_analysis'] ?? [];
echo json_encode([
    'outlet' => $dbA['outlet_national'] ?? null,
    'wro' => $dbA['wro'] ?? null,
    'cro' => $dbA['cro'] ?? null,
    'pmd' => $dbA['pmd'] ?? null,
    'dno' => $dbA['dno'] ?? null,
], JSON_PRETTY_PRINT);
