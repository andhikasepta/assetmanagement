<?php
/**
 * Executive Summary Notes API
 * Handles CRUD operations for Executive Summary notes/catatan per period
 */

require_once __DIR__ . '/../config/database.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    // Auto-create table if not exists
    $db->exec('
        CREATE TABLE IF NOT EXISTS executive_notes (
            id SERIAL PRIMARY KEY,
            year INT NOT NULL,
            month INT NOT NULL,
            so_type VARCHAR(20) DEFAULT \'monthly\',
            dept VARCHAR(100) DEFAULT \'\',
            sub_dept VARCHAR(100) DEFAULT \'\',
            keterangan TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_exec_notes_period ON executive_notes (year, month);
        CREATE INDEX IF NOT EXISTS idx_exec_notes_so_type ON executive_notes (so_type);
    ');

    if ($method === 'GET') {
        $year = isset($_GET['year']) && $_GET['year'] !== '' ? (int)$_GET['year'] : null;
        $month = isset($_GET['month']) && $_GET['month'] !== '' && $_GET['month'] !== 'all' ? (int)$_GET['month'] : null;
        $soType = isset($_GET['so_type']) && $_GET['so_type'] !== '' && $_GET['so_type'] !== 'all' ? trim($_GET['so_type']) : null;

        $sql = 'SELECT id, year, month, so_type, dept, sub_dept, keterangan, to_char(created_at, \'YYYY-MM-DD HH24:MI:SS\') as created_at, to_char(updated_at, \'YYYY-MM-DD HH24:MI:SS\') as updated_at FROM executive_notes';
        $params = [];
        $where = [];

        if ($year !== null) {
            $where[] = 'year = ?';
            $params[] = $year;
        }
        if ($month !== null) {
            $where[] = 'month = ?';
            $params[] = $month;
        }
        if ($soType !== null) {
            $where[] = 'LOWER(so_type) = LOWER(?)';
            $params[] = $soType;
        }

        $dept = isset($_GET['dept']) && $_GET['dept'] !== '' && $_GET['dept'] !== 'all' ? trim($_GET['dept']) : null;
        if ($dept !== null) {
            $where[] = 'dept = ?';
            $params[] = $dept;
        }

        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' ORDER BY year DESC, month DESC, id ASC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $notes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data'    => $notes,
            'count'   => count($notes),
            'filter'  => [
                'year'    => $year,
                'month'   => $month,
                'so_type' => $soType
            ]
        ]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid JSON input']);
            exit;
        }

        $year = isset($input['year']) ? (int)$input['year'] : 0;
        $month = isset($input['month']) ? (int)$input['month'] : 0;
        $defaultSoType = isset($input['so_type']) && trim($input['so_type']) !== '' ? strtolower(trim($input['so_type'])) : 'monthly';

        if ($year < 2000 || $month < 1 || $month > 12) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Periode tahun dan bulan tidak valid']);
            exit;
        }

        $items = [];
        if (isset($input['items']) && is_array($input['items'])) {
            $items = $input['items'];
        } else if (isset($input['keterangan'])) {
            $items = [[
                'so_type'    => $defaultSoType,
                'dept'       => $input['dept'] ?? '',
                'sub_dept'   => $input['sub_dept'] ?? '',
                'keterangan' => $input['keterangan'] ?? ''
            ]];
        }

        if (empty($items)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Tidak ada data catatan yang dikirim']);
            exit;
        }

        $validItems = [];
        foreach ($items as $item) {
            $ket = trim($item['keterangan'] ?? '');
            if ($ket !== '') {
                $validItems[] = [
                    'so_type'    => strtolower(trim($item['so_type'] ?? $defaultSoType)),
                    'dept'       => trim($item['dept'] ?? ''),
                    'sub_dept'   => trim($item['sub_dept'] ?? ''),
                    'keterangan' => $ket
                ];
            }
        }

        if (empty($validItems)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Keterangan catatan tidak boleh kosong']);
            exit;
        }

        $db->beginTransaction();
        $stmt = $db->prepare('
            INSERT INTO executive_notes (year, month, so_type, dept, sub_dept, keterangan)
            VALUES (?, ?, ?, ?, ?, ?)
        ');

        $insertedCount = 0;
        foreach ($validItems as $v) {
            $stmt->execute([
                $year,
                $month,
                $v['so_type'],
                $v['dept'],
                $v['sub_dept'],
                $v['keterangan']
            ]);
            $insertedCount++;
        }
        $db->commit();

        echo json_encode([
            'success'  => true,
            'message'  => "Berhasil menyimpan {$insertedCount} catatan",
            'inserted' => $insertedCount
        ]);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID catatan tidak ditemukan']);
            exit;
        }

        $id = (int)$input['id'];
        $year = isset($input['year']) ? (int)$input['year'] : null;
        $month = isset($input['month']) ? (int)$input['month'] : null;
        $soType = isset($input['so_type']) && trim($input['so_type']) !== '' ? strtolower(trim($input['so_type'])) : null;
        $dept = isset($input['dept']) ? trim($input['dept']) : null;
        $subDept = isset($input['sub_dept']) ? trim($input['sub_dept']) : null;
        $keterangan = isset($input['keterangan']) ? trim($input['keterangan']) : null;

        if ($keterangan === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Keterangan tidak boleh kosong']);
            exit;
        }

        $stmt = $db->prepare('
            UPDATE executive_notes 
            SET year = COALESCE(?, year),
                month = COALESCE(?, month),
                so_type = COALESCE(?, so_type),
                dept = COALESCE(?, dept),
                sub_dept = COALESCE(?, sub_dept),
                keterangan = COALESCE(?, keterangan),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ');
        $stmt->execute([$year, $month, $soType, $dept, $subDept, $keterangan, $id]);

        echo json_encode([
            'success' => true,
            'message' => 'Catatan berhasil diperbarui'
        ]);
        exit;
    }

    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
        if (!$id) {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['id']) ? (int)$input['id'] : null;
        }

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID catatan tidak valid']);
            exit;
        }

        $stmt = $db->prepare('DELETE FROM executive_notes WHERE id = ?');
        $stmt->execute([$id]);

        echo json_encode([
            'success' => true,
            'message' => 'Catatan berhasil dihapus'
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
