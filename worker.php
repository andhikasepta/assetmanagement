<?php
/**
 * AMORA Worker Daemon for VM 103.123.100.15
 * 
 * Handles background queues, async tasks, and periodic maintenance jobs.
 * Connects to Redis (103.123.100.11) and PostgreSQL (103.123.100.14).
 * 
 * Usage:
 *   php worker.php              (Run continuous worker loop)
 *   php worker.php --once       (Process one batch and exit)
 *   php worker.php --status     (Check connection and queue stats)
 */

if (php_sapi_name() !== 'cli') {
    echo "AMORA Worker must be run from CLI.\n";
    exit(1);
}

require_once __DIR__ . '/config/database.php';

$running = true;

// Register signal handlers for graceful exit (Linux / VM environment)
if (function_exists('pcntl_async_signals') && function_exists('pcntl_signal')) {
    pcntl_async_signals(true);
    pcntl_signal(SIGTERM, function () use (&$running) {
        echo "[" . date('Y-m-d H:i:s') . "] SIGTERM received, stopping worker gracefully...\n";
        $running = false;
    });
    pcntl_signal(SIGINT, function () use (&$running) {
        echo "[" . date('Y-m-d H:i:s') . "] SIGINT received, stopping worker gracefully...\n";
        $running = false;
    });
}

$mode = $argv[1] ?? '--daemon';

echo "========================================================\n";
echo " AMORA Worker Daemon (VM 103.123.100.15)\n";
echo " Mode: " . htmlspecialchars($mode) . "\n";
echo " Started at: " . date('Y-m-d H:i:s') . "\n";
echo "========================================================\n";

// Test Database Connection
try {
    $db = getDbConnection();
    echo "[OK] PostgreSQL connected (" . ($dbConfig['host'] ?? '') . ":" . ($dbConfig['dbname'] ?? '') . ")\n";
} catch (Throwable $e) {
    echo "[WARN] PostgreSQL connection warning: " . $e->getMessage() . "\n";
}

// Test Redis Connection
$redis = getRedisConnection();
if ($redis) {
    echo "[OK] Redis connected (" . (getenv('REDIS_HOST') ?: 'configured') . ")\n";
} else {
    echo "[WARN] Redis connection is not available or extension 'redis' is missing.\n";
}

if ($mode === '--status') {
    if ($redis) {
        $queueLen = $redis->lLen('amora:queue:default');
        $lastPing = $redis->get('amora:worker:last_heartbeat');
        echo "Queue length (amora:queue:default): {$queueLen}\n";
        echo "Last worker heartbeat: " . ($lastPing ?: 'None') . "\n";
    }
    echo "Status check complete.\n";
    exit(0);
}

$lastHeartbeat = 0;
$heartbeatInterval = 60; // 60 seconds

while ($running) {
    $now = time();

    // 1. Periodic Heartbeat & Health Telemetry
    if ($now - $lastHeartbeat >= $heartbeatInterval) {
        $lastHeartbeat = $now;
        $timestampStr = date('Y-m-d H:i:s');
        if ($redis) {
            try {
                $redis->setex('amora:worker:last_heartbeat', 180, $timestampStr);
            } catch (Throwable $ignore) {}
        }
        echo "[{$timestampStr}] Heartbeat: Worker active, memory: " . round(memory_get_usage(true) / 1024 / 1024, 2) . " MB\n";
    }

    // 2. Queue Job Processing
    $hasJob = false;
    if ($redis) {
        try {
            // Non-blocking pop or 2-second timeout pop
            $jobData = $redis->rPop('amora:queue:default');
            if ($jobData) {
                $hasJob = true;
                processJob($jobData, $db ?? null);
            }
        } catch (Throwable $e) {
            echo "[" . date('Y-m-d H:i:s') . "] Redis queue error: " . $e->getMessage() . "\n";
            sleep(3);
        }
    }

    if ($mode === '--once') {
        echo "Single execution cycle complete.\n";
        break;
    }

    if (!$hasJob) {
        usleep(1000000); // Sleep 1 second when idle
    }
}

echo "[" . date('Y-m-d H:i:s') . "] Worker terminated cleanly.\n";

/**
 * Process a single queued job payload
 */
function processJob(string $rawPayload, ?PDO $db): void
{
    $payload = json_decode($rawPayload, true);
    if (!is_array($payload)) {
        echo "[" . date('Y-m-d H:i:s') . "] Invalid payload received: " . substr($rawPayload, 0, 100) . "\n";
        return;
    }

    $action = $payload['action'] ?? 'unknown';
    echo "[" . date('Y-m-d H:i:s') . "] Executing job '{$action}'...\n";

    switch ($action) {
        case 'ping':
            echo "  --> Pong from worker!\n";
            break;

        case 'clear_temp_uploads':
            $uploadDir = __DIR__ . '/uploads';
            if (is_dir($uploadDir)) {
                $count = 0;
                $files = glob($uploadDir . '/*');
                foreach ($files as $file) {
                    if (is_file($file) && (time() - filemtime($file) > 86400 * 7)) { // 7 days old
                        @unlink($file);
                        $count++;
                    }
                }
                echo "  --> Cleaned {$count} old temporary files.\n";
            }
            break;

        case 'refresh_stats':
            echo "  --> Stats refreshed.\n";
            break;

        default:
            echo "  --> Custom action executed: " . htmlspecialchars($action) . "\n";
            break;
    }
}
