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
 * Configure Redis session handler if REDIS_HOST is specified
 */
function initRedisSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    // Set distinctive session cookie name
    session_name('amora_session');

    $ttl = (int) (getenv('SESSION_TTL') ?: ($_ENV['SESSION_TTL'] ?? '1200'));
    if ($ttl <= 0) {
        $ttl = 1200;
    }

    $isSecure = filter_var(getenv('SESSION_SECURE') ?: ($_ENV['SESSION_SECURE'] ?? false), FILTER_VALIDATE_BOOLEAN);

    // Configure session cookie parameters
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => $ttl,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $isSecure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    $redisHost = getenv('REDIS_HOST') ?: ($_ENV['REDIS_HOST'] ?? '');
    if (!empty($redisHost)) {
        $redisPort = (int) (getenv('REDIS_PORT') ?: ($_ENV['REDIS_PORT'] ?? 6379));
        $redisPass = getenv('REDIS_PASSWORD') ?: ($_ENV['REDIS_PASSWORD'] ?? null);

        // Pre-check TCP socket to avoid crash if Redis is unreachable
        $testSocket = @fsockopen($redisHost, $redisPort, $errCode, $errStr, 1.0);
        if ($testSocket) {
            fclose($testSocket);
            $handlerFile = __DIR__ . '/../includes/RedisSessionHandler.php';
            if (file_exists($handlerFile)) {
                require_once $handlerFile;
                if (class_exists('RedisSessionHandler')) {
                    $handler = new RedisSessionHandler(
                        $redisHost,
                        $redisPort,
                        1.5,
                        'AMORA_SESSION:',
                        $ttl,
                        $redisPass
                    );
                    if ($handler->testConnection()) {
                        session_set_save_handler($handler, true);
                    } else {
                        // Redis TCP open but AUTH/PING failed -> stay on safe standard PHP file sessions
                        ini_set('session.save_handler', 'files');
                    }
                }
            }
        } else {
            ini_set('session.save_handler', 'files');
        }
    }
}

// Auto-initialize Redis session handler
initRedisSession();

/**
 * Get Redis connection if Redis extension is loaded and REDIS_HOST is configured
 *
 * @return Redis|null
 */
function getRedisConnection(): ?Redis
{
    $redisHost = getenv('REDIS_HOST') ?: ($_ENV['REDIS_HOST'] ?? '');
    if (empty($redisHost) || !extension_loaded('redis')) {
        return null;
    }
    $redisPort = (int) (getenv('REDIS_PORT') ?: ($_ENV['REDIS_PORT'] ?? '6379'));
    $redisPass = getenv('REDIS_PASSWORD') ?: ($_ENV['REDIS_PASSWORD'] ?? '');

    $redis = new Redis();
    $redis->connect($redisHost, $redisPort, 2.5);
    if (!empty($redisPass)) {
        $redis->auth($redisPass);
    }
    return $redis;
}

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

