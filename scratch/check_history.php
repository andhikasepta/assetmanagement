<?php
$file = 'C:/Users/User/.gemini/antigravity-ide/brain/01749c07-7788-45eb-9266-30f0c77768c8/.system_generated/logs/transcript.jsonl';
$lines = file($file);
foreach ($lines as $line) {
    $j = json_decode($line, true);
    if (!$j) continue;
    $idx = $j['step_index'] ?? 0;
    if ($idx >= 1200 && $idx <= 1260) {
        if ($j['type'] === 'USER_INPUT') {
            echo "=== USER [$idx] ===\n" . substr($j['content'], 0, 150) . "\n";
        } elseif ($j['type'] === 'PLANNER_RESPONSE' && !empty($j['tool_calls'])) {
            echo "-> TOOL [$idx]: " . $j['tool_calls'][0]['name'] . ' ' . json_encode($j['tool_calls'][0]['args']) . "\n";
        } elseif (!empty($j['content']) && $j['source'] === 'MODEL') {
            echo "MODEL [$idx]: " . substr($j['content'], 0, 150) . "\n";
        }
    }
}
