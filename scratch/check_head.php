<?php
$c = shell_exec('git show HEAD:index.php');
$lines = explode("\n", $c);
for ($i = 1640; $i <= 1675; $i++) {
    if (isset($lines[$i])) {
        echo ($i + 1) . ': ' . $lines[$i] . "\n";
    }
}
