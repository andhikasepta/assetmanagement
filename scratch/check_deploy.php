<?php
$file = 'C:/Users/User/.gemini/antigravity-ide/brain/01749c07-7788-45eb-9266-30f0c77768c8/.system_generated/logs/transcript.jsonl';
$lines = file($file);
foreach ($lines as $line) {
    if (preg_match('/(ssh|docker build|deploy|git push)/i', $line)) {
        $j = json_decode($line, true);
        if ($j && !empty($j['tool_calls'])) {
            echo "STEP [{$j['step_index']}]: " . $j['tool_calls'][0]['name'] . ' -> ' . substr(json_encode($j['tool_calls'][0]['args']), 0, 120) . "\n";
        }
    }
}
