<?php
/**
 * Database configuration for Dashboard Asset Management
 * Uses environment variables with fallbacks for development.
 * 
 * TODO(security): For production deployment, use a secret management solution
 * (e.g., HashiCorp Vault, AWS Secrets Manager) instead of environment variables
 * or hardcoded fallbacks. The current fallback values are for development only.
 */

// Load .env file if it exists
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (str_contains($line, '=')) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (!array_key_exists($key, $_ENV)) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }
}

/**
 * Get a database configuration value from environment.
 *
 * @param string $key The environment variable name
 * @param string $default The fallback value
 * @return string
 */
function getDbConfig(string $key, string $default): string
{
    $value = getenv($key);
    if ($value !== false && $value !== '') {
        return $value;
    }
    return $default;
}

$dbConfig = [
    'host'     => getDbConfig('DB_HOST', '103.123.100.14'),
    'port'     => getDbConfig('DB_PORT', '5432'),
    'dbname'   => getDbConfig('DB_NAME', 'dashboardasset_db'),
    'user'     => getDbConfig('DB_USER', 'deutsch'),
    'password' => getDbConfig('DB_PASSWORD', 'S3pt4@'),
];

/**
 * Get PDO connection to PostgreSQL
 *
 * @return PDO
 * @throws PDOException
 */
function getDbConnection(): PDO
{
    global $dbConfig;

    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        $dbConfig['host'],
        $dbConfig['port'],
        $dbConfig['dbname']
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    return new PDO($dsn, $dbConfig['user'], $dbConfig['password'], $options);
}
