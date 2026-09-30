<?php
/**
 * Database Migration System
 * 
 * Provides flexible schema management for the Dashboard Asset Management.
 * Tracks applied migrations in a `migrations` table and supports:
 *   - Running all pending migrations (up)
 *   - Rolling back the last batch (down)
 *   - Checking migration status
 */

require_once __DIR__ . '/../config/database.php';

class Migrator
{
    private PDO $db;

    public function __construct()
    {
        $this->db = getDbConnection();
        $this->ensureMigrationsTable();
    }

    /**
     * Create the migrations tracking table if it doesn't exist.
     */
    private function ensureMigrationsTable(): void
    {
        $this->db->exec('
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                migration VARCHAR(255) NOT NULL UNIQUE,
                batch INTEGER NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ');
    }

    /**
     * Get all migration files from the migrations directory.
     *
     * @return array<string, string> [filename => filepath]
     */
    private function getMigrationFiles(): array
    {
        $migrationsDir = __DIR__ . '/migrations';
        if (!is_dir($migrationsDir)) {
            mkdir($migrationsDir, 0755, true);
            return [];
        }

        $files = glob($migrationsDir . '/*.php');
        $migrations = [];
        foreach ($files as $file) {
            $migrations[basename($file, '.php')] = $file;
        }
        ksort($migrations);
        return $migrations;
    }

    /**
     * Get list of already-applied migration names.
     *
     * @return array<string>
     */
    private function getAppliedMigrations(): array
    {
        $stmt = $this->db->query('SELECT migration FROM migrations ORDER BY migration');
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * Get the next batch number.
     *
     * @return int
     */
    private function getNextBatch(): int
    {
        $stmt = $this->db->query('SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations');
        return (int) $stmt->fetchColumn();
    }

    /**
     * Run all pending migrations.
     *
     * @return array{applied: string[], errors: string[]}
     */
    public function migrate(): array
    {
        $files = $this->getMigrationFiles();
        $applied = $this->getAppliedMigrations();
        $batch = $this->getNextBatch();
        $results = ['applied' => [], 'errors' => []];

        foreach ($files as $name => $filepath) {
            if (in_array($name, $applied, true)) {
                continue;
            }

            try {
                $migration = require $filepath;

                if (!is_array($migration) || !isset($migration['up'])) {
                    $results['errors'][] = "$name: Invalid migration format";
                    continue;
                }

                $this->db->beginTransaction();

                // Execute the up migration
                if (is_callable($migration['up'])) {
                    $migration['up']($this->db);
                } elseif (is_string($migration['up'])) {
                    $this->db->exec($migration['up']);
                }

                // Record the migration
                $stmt = $this->db->prepare(
                    'INSERT INTO migrations (migration, batch) VALUES (:migration, :batch)'
                );
                $stmt->execute(['migration' => $name, 'batch' => $batch]);

                $this->db->commit();
                $results['applied'][] = $name;
            } catch (Throwable $e) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                $results['errors'][] = "$name: " . $e->getMessage();
            }
        }

        return $results;
    }

    /**
     * Rollback the last batch of migrations.
     *
     * @return array{rolledBack: string[], errors: string[]}
     */
    public function rollback(): array
    {
        $stmt = $this->db->query('SELECT COALESCE(MAX(batch), 0) FROM migrations');
        $lastBatch = (int) $stmt->fetchColumn();

        if ($lastBatch === 0) {
            return ['rolledBack' => [], 'errors' => ['Nothing to rollback']];
        }

        $stmt = $this->db->prepare(
            'SELECT migration FROM migrations WHERE batch = :batch ORDER BY migration DESC'
        );
        $stmt->execute(['batch' => $lastBatch]);
        $migrationsToRollback = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $files = $this->getMigrationFiles();
        $results = ['rolledBack' => [], 'errors' => []];

        foreach ($migrationsToRollback as $name) {
            if (!isset($files[$name])) {
                $results['errors'][] = "$name: Migration file not found";
                continue;
            }

            try {
                $migration = require $files[$name];

                if (!is_array($migration) || !isset($migration['down'])) {
                    $results['errors'][] = "$name: No down migration defined";
                    continue;
                }

                $this->db->beginTransaction();

                if (is_callable($migration['down'])) {
                    $migration['down']($this->db);
                } elseif (is_string($migration['down'])) {
                    $this->db->exec($migration['down']);
                }

                $deleteStmt = $this->db->prepare(
                    'DELETE FROM migrations WHERE migration = :migration'
                );
                $deleteStmt->execute(['migration' => $name]);

                $this->db->commit();
                $results['rolledBack'][] = $name;
            } catch (Throwable $e) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                $results['errors'][] = "$name: " . $e->getMessage();
            }
        }

        return $results;
    }

    /**
     * Get the status of all migrations.
     *
     * @return array<array{name: string, status: string, batch: int|null, executed_at: string|null}>
     */
    public function status(): array
    {
        $files = $this->getMigrationFiles();

        $stmt = $this->db->query(
            'SELECT migration, batch, executed_at FROM migrations ORDER BY migration'
        );
        $applied = [];
        foreach ($stmt->fetchAll() as $row) {
            $applied[$row['migration']] = $row;
        }

        $status = [];
        foreach ($files as $name => $_filepath) {
            if (isset($applied[$name])) {
                $status[] = [
                    'name'        => $name,
                    'status'      => 'Applied',
                    'batch'       => (int) $applied[$name]['batch'],
                    'executed_at' => $applied[$name]['executed_at'],
                ];
            } else {
                $status[] = [
                    'name'        => $name,
                    'status'      => 'Pending',
                    'batch'       => null,
                    'executed_at' => null,
                ];
            }
        }

        return $status;
    }
}
