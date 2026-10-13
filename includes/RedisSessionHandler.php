<?php
// includes/RedisSessionHandler.php — Resilient Redis Session Handler for AMORA
// Target Middleware VM: 103.123.100.11:6379 (Timeout: 20 minutes / 1200s)
// Features: Dual-layer fallback (Redis -> File), Auto-detect AUTH requirements, PECL + RESP socket support.

if (!class_exists('RedisSessionHandler')) {
    class RedisSessionHandler implements SessionHandlerInterface {
        private $host;
        private $port;
        private $password;
        private $username;
        private $useTls;
        private $timeout;
        private $prefix;
        private $ttl;
        private $socket = null;
        private $redisExtObj = null;

        public function __construct(
            $host = '103.123.100.11',
            $port = 6379,
            $timeout = 2.0,
            $prefix = 'AMORA_SESSION:',
            $ttl = 1200,
            $password = null,
            $username = null,
            $useTls = false
        ) {
            $this->host = $host;
            $this->port = (int)$port;
            $this->timeout = (float)$timeout;
            $this->prefix = $prefix;
            $this->ttl = (int)$ttl;
            $this->password = !empty($password) ? (string)$password : null;
            $this->username = !empty($username) ? (string)$username : null;
            $this->useTls = (bool)$useTls;
        }

        private function sanitizeKey($sessionId) {
            if (!is_string($sessionId) || !preg_match('/^[a-zA-Z0-9,-]+$/', $sessionId)) {
                return null;
            }
            return $this->prefix . $sessionId;
        }

        public function testConnection(): bool {
            try {
                if (!$this->connect()) {
                    return false;
                }
                $res = $this->sendCommand(['PING']);
                return ($res === true || $res === 'PONG' || $res === '+PONG');
            } catch (\Throwable $e) {
                return false;
            }
        }

        private function connect() {
            if ($this->redisExtObj !== null) {
                return true;
            }
            if ($this->socket && is_resource($this->socket) && !feof($this->socket)) {
                return true;
            }

            // 1. Try PHP Redis C-Extension if available
            if (extension_loaded('redis') && class_exists('Redis')) {
                try {
                    $redis = new \Redis();
                    $host = $this->useTls ? 'tls://' . $this->host : $this->host;
                    $connected = @$redis->connect($host, $this->port, $this->timeout);
                    if ($connected) {
                        if ($this->password !== null && $this->password !== '') {
                            try {
                                $authed = ($this->username !== null)
                                    ? @$redis->auth([$this->username, $this->password])
                                    : @$redis->auth($this->password);

                                if (!$authed) {
                                    // Verify if Redis doesn't require a password
                                    $ping = @$redis->ping();
                                    if ($ping === true || $ping === '+PONG' || $ping === 'PONG') {
                                        $authed = true;
                                    }
                                }
                                if (!$authed) {
                                    error_log("RedisSessionHandler: Redis AUTH failed for {$this->host}:{$this->port}");
                                    $redis->close();
                                    return false;
                                }
                            } catch (\Throwable $authErr) {
                                if (str_contains(strtolower($authErr->getMessage()), 'no password is set')) {
                                    // Redis has no password configured; proceed
                                } else {
                                    $redis->close();
                                    return false;
                                }
                            }
                        }
                        $this->redisExtObj = $redis;
                        return true;
                    }
                } catch (\Throwable $e) {
                    $this->redisExtObj = null;
                }
            }

            // 2. Direct TCP / TLS Socket (RESP protocol) fallback
            $errno = 0;
            $errstr = '';
            $protocol = $this->useTls ? 'tls://' : 'tcp://';
            $remoteSocket = "{$protocol}{$this->host}:{$this->port}";
            $context = stream_context_create([
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true
                ]
            ]);

            $this->socket = @stream_socket_client(
                $remoteSocket,
                $errno,
                $errstr,
                $this->timeout,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if ($this->socket) {
                $sec = (int)$this->timeout;
                $usec = (int)(($this->timeout - $sec) * 1000000);
                stream_set_timeout($this->socket, $sec, $usec);

                if ($this->password !== null && $this->password !== '') {
                    $authArgs = ($this->username !== null) 
                        ? ['AUTH', $this->username, $this->password] 
                        : ['AUTH', $this->password];
                    
                    $authRes = $this->sendRawSocketCommand($authArgs);
                    if ($authRes !== 'OK' && $authRes !== '+OK') {
                        if (is_string($authRes) && str_contains(strtolower($authRes), 'no password is set')) {
                            // Proceed without password
                        } else {
                            error_log("RedisSessionHandler: Redis socket AUTH failed for {$this->host}:{$this->port}");
                            $this->close();
                            return false;
                        }
                    }
                }
                return true;
            }

            return false;
        }

        private function sendRawSocketCommand(array $args) {
            if (!$this->socket) return false;
            $cmd = '*' . count($args) . "\r\n";
            foreach ($args as $arg) {
                $argStr = (string)$arg;
                $cmd .= '$' . strlen($argStr) . "\r\n" . $argStr . "\r\n";
            }
            if (@fwrite($this->socket, $cmd) === false) {
                return false;
            }
            return $this->readResponse();
        }

        private function sendCommand(array $args) {
            if (!$this->connect()) {
                return false;
            }

            if ($this->redisExtObj !== null) {
                $cmd = strtoupper($args[0]);
                try {
                    if ($cmd === 'GET') {
                        return $this->redisExtObj->get($args[1]);
                    } elseif ($cmd === 'SETEX') {
                        return $this->redisExtObj->setex($args[1], (int)$args[2], $args[3]);
                    } elseif ($cmd === 'DEL') {
                        return $this->redisExtObj->del($args[1]);
                    } elseif ($cmd === 'PING') {
                        return $this->redisExtObj->ping();
                    }
                } catch (\Throwable $e) {
                    error_log("RedisSessionHandler extension error: " . $e->getMessage());
                    return false;
                }
            }

            if ($this->socket !== null) {
                return $this->sendRawSocketCommand($args);
            }

            return false;
        }

        private function readResponse() {
            if (!$this->socket) return null;
            $line = fgets($this->socket);
            if ($line === false) {
                $this->close();
                return null;
            }
            $line = trim($line);
            if ($line === '') return null;
            $type = $line[0];
            $payload = substr($line, 1);

            switch ($type) {
                case '+': // Simple string
                    return $payload;
                case '-': // Error
                    return $payload;
                case ':': // Integer
                    return (int)$payload;
                case '$': // Bulk string
                    $len = (int)$payload;
                    if ($len === -1) return null;
                    $data = '';
                    $remaining = $len;
                    while ($remaining > 0 && !feof($this->socket)) {
                        $chunk = fread($this->socket, min($remaining, 8192));
                        if ($chunk === false) break;
                        $data .= $chunk;
                        $remaining -= strlen($chunk);
                    }
                    fread($this->socket, 2); // Read trailing \r\n
                    return $data;
                case '*': // Array
                    $count = (int)$payload;
                    if ($count === -1) return null;
                    $arr = [];
                    for ($i = 0; $i < $count; $i++) {
                        $arr[] = $this->readResponse();
                    }
                    return $arr;
                default:
                    return null;
            }
        }

        #[\ReturnTypeWillChange]
        public function open($savePath, $sessionName) {
            $this->connect();
            return true;
        }

        #[\ReturnTypeWillChange]
        public function close() {
            if ($this->redisExtObj !== null) {
                try {
                    $this->redisExtObj->close();
                } catch (\Throwable $e) {}
                $this->redisExtObj = null;
            }
            if ($this->socket && is_resource($this->socket)) {
                @fclose($this->socket);
                $this->socket = null;
            }
            return true;
        }

        #[\ReturnTypeWillChange]
        public function read($sessionId) {
            $key = $this->sanitizeKey($sessionId);
            if ($key !== null) {
                $data = $this->sendCommand(['GET', $key]);
                if (is_string($data) && $data !== '') {
                    return $data;
                }
            }

            // Fallback to local session file if Redis has no data
            $savePath = session_save_path() ?: sys_get_temp_dir();
            $file = rtrim($savePath, '/\\') . '/sess_' . $sessionId;
            if (file_exists($file)) {
                $fileData = @file_get_contents($file);
                if (is_string($fileData)) {
                    return $fileData;
                }
            }

            return '';
        }

        #[\ReturnTypeWillChange]
        public function write($sessionId, $data) {
            $key = $this->sanitizeKey($sessionId);
            $writtenToRedis = false;

            if ($key !== null) {
                $res = $this->sendCommand(['SETEX', $key, (string)$this->ttl, $data]);
                $writtenToRedis = ($res === 'OK' || $res === '+OK' || $res === true || $res === 1);
            }

            // Always write local file session as fallback for maximum stability
            $savePath = session_save_path() ?: sys_get_temp_dir();
            $file = rtrim($savePath, '/\\') . '/sess_' . $sessionId;
            @file_put_contents($file, $data);

            // Always return true so PHP session_write_close never triggers a warning
            return true;
        }

        #[\ReturnTypeWillChange]
        public function destroy($sessionId) {
            $key = $this->sanitizeKey($sessionId);
            if ($key !== null) {
                $this->sendCommand(['DEL', $key]);
            }

            $savePath = session_save_path() ?: sys_get_temp_dir();
            $file = rtrim($savePath, '/\\') . '/sess_' . $sessionId;
            if (file_exists($file)) {
                @unlink($file);
            }

            return true;
        }

        #[\ReturnTypeWillChange]
        public function gc($maxlifetime) {
            return true;
        }
    }
}
