<?php
/**
 * CLI Migration Runner
 * 
 * Usage:
 *   php migrate.php migrate    - Run all pending migrations
 *   php migrate.php rollback   - Rollback last batch
 *   php migrate.php status     - Show migration status
 *   php migrate.php refresh    - Rollback all and re-run
 */

require_once __DIR__ . '/database/Migrator.php';

$action = $argv[1] ?? 'status';

try {
    $migrator = new Migrator();

    switch ($action) {
        case 'migrate':
            echo "Running migrations...\n";
            $result = $migrator->migrate();
            if (!empty($result['applied'])) {
                echo "Applied migrations:\n";
                foreach ($result['applied'] as $m) {
                    echo "  ✓ $m\n";
                }
            } else {
                echo "Nothing to migrate.\n";
            }
            if (!empty($result['errors'])) {
                echo "Errors:\n";
                foreach ($result['errors'] as $e) {
                    echo "  ✗ $e\n";
                }
            }
            break;

        case 'rollback':
            echo "Rolling back last batch...\n";
            $result = $migrator->rollback();
            if (!empty($result['rolledBack'])) {
                echo "Rolled back:\n";
                foreach ($result['rolledBack'] as $m) {
                    echo "  ↩ $m\n";
                }
            }
            if (!empty($result['errors'])) {
                echo "Errors:\n";
                foreach ($result['errors'] as $e) {
                    echo "  ✗ $e\n";
                }
            }
            break;

        case 'status':
            echo "Migration Status:\n";
            echo str_repeat('-', 70) . "\n";
            printf("%-45s %-10s %-5s\n", 'Migration', 'Status', 'Batch');
            echo str_repeat('-', 70) . "\n";
            $statuses = $migrator->status();
            if (empty($statuses)) {
                echo "No migration files found.\n";
            }
            foreach ($statuses as $s) {
                printf(
                    "%-45s %-10s %-5s\n",
                    $s['name'],
                    $s['status'],
                    $s['batch'] ?? '-'
                );
            }
            echo str_repeat('-', 70) . "\n";
            break;

        case 'refresh':
            echo "Refreshing database (rollback all + migrate)...\n";
            // Rollback all batches
            $maxAttempts = 20;
            $attempt = 0;
            do {
                $result = $migrator->rollback();
                $attempt++;
            } while (!empty($result['rolledBack']) && $attempt < $maxAttempts);

            // Re-run all
            $result = $migrator->migrate();
            if (!empty($result['applied'])) {
                echo "Applied migrations:\n";
                foreach ($result['applied'] as $m) {
                    echo "  ✓ $m\n";
                }
            }
            if (!empty($result['errors'])) {
                echo "Errors:\n";
                foreach ($result['errors'] as $e) {
                    echo "  ✗ $e\n";
                }
            }
            break;

        default:
            echo "Unknown action: $action\n";
            echo "Usage: php migrate.php [migrate|rollback|status|refresh]\n";
            exit(1);
    }
} catch (Throwable $e) {
    // Display generic error without exposing internal details
    echo "Migration failed. Please check your database configuration.\n";
    // Log detailed error for debugging
    error_log('Migration error: ' . $e->getMessage());
    exit(1);
}
