<?php
$lines = file('assets/js/app.js');
foreach ($lines as $idx => $line) {
    if (preg_match('/(loadSummary|initSummary|window\.addEventListener|document\.addEventListener)/i', $line)) {
        echo ($idx + 1) . ': ' . trim($line) . "\n";
    }
}
