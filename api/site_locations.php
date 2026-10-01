<?php
/**
 * Site Locations API Endpoint
 * Handles CRUD operations for Site Locations
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();

    // Auto-create table if not exists
    $db->exec('
        CREATE TABLE IF NOT EXISTS site_locations (
            id SERIAL PRIMARY KEY,
            site_id VARCHAR(50) NOT NULL,
            category VARCHAR(100) DEFAULT \'\',
            name_intan VARCHAR(255) DEFAULT \'\',
            name_eproc VARCHAR(255) DEFAULT \'\',
            name_ims VARCHAR(255) DEFAULT \'\',
            organizations VARCHAR(255) DEFAULT \'\',
            manager VARCHAR(150) DEFAULT \'\',
            region VARCHAR(150) DEFAULT \'\',
            area VARCHAR(100) DEFAULT \'\',
            cluster VARCHAR(100) DEFAULT \'\',
            addr TEXT DEFAULT \'\',
            province VARCHAR(100) DEFAULT \'\',
            city VARCHAR(100) DEFAULT \'\',
            sub_dis VARCHAR(100) DEFAULT \'\',
            village VARCHAR(100) DEFAULT \'\',
            postal VARCHAR(30) DEFAULT \'\',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_site_locations_site_id ON site_locations (site_id);
    ');

    // Seed default sample data if table is completely empty
    $countCheck = $db->query('SELECT COUNT(*) FROM site_locations')->fetchColumn();
    if ((int)$countCheck === 0) {
        $insSample = $db->prepare('
            INSERT INTO site_locations (
                site_id, category, name_intan, name_eproc, name_ims, organizations, manager,
                region, area, cluster, addr, province, city, sub_dis, village, postal
            ) VALUES (
                :site_id, :category, :name_intan, :name_eproc, :name_ims, :organizations, :manager,
                :region, :area, :cluster, :addr, :province, :city, :sub_dis, :village, :postal
            )
        ');

        $samples = [
            [
                'site_id'       => '0SMRKLA007',
                'category'      => 'WAREHOUSE LA',
                'name_intan'    => 'APLIKANUSA LINTASARTA - OUTLET BARU SEMARANG',
                'name_eproc'    => 'APLIKANUSA LINTASARTA - OUTLET BARU SEMARANG',
                'name_ims'      => '',
                'organizations' => 'ASSET MANAGEMENT CENTRAL JAVA AND DIY OPERATION',
                'manager'       => '',
                'region'        => 'CENTRAL INDONESIA REGIONAL (CIR)',
                'area'          => 'CJDA',
                'cluster'       => 'SEMARANG',
                'addr'          => 'Jl. Merapi No.11, Gajahmungkur, Kec. Gajahmungkur, Kota Semarang, Jawa Tengah 50232',
                'province'      => 'JAWA TENGAH',
                'city'          => 'SEMARANG',
                'sub_dis'       => 'GAJAHMUNGKUR',
                'village'       => 'GAJAHMUNGKUR',
                'postal'        => '50232'
            ],
            [
                'site_id'       => '0BANKLA001',
                'category'      => 'OUTLET LA',
                'name_intan'    => 'APLIKANUSA LINTASARTA - OUTLET GUDANG BIAK',
                'name_eproc'    => 'APLIKANUSA LINTASARTA - OUTLET GUDANG BIAK',
                'name_ims'      => '',
                'organizations' => 'EAST INDONESIA REGIONAL OPERATION',
                'manager'       => '',
                'region'        => 'EAST INDONESIA REGIONAL (EIR)',
                'area'          => 'PAPUA',
                'cluster'       => 'BIAK',
                'addr'          => 'Jl. Majapahit No. 45, Biak Kota',
                'province'      => 'PAPUA',
                'city'          => 'BIAK NUMFOR',
                'sub_dis'       => 'BIAK KOTA',
                'village'       => 'BIAK',
                'postal'        => '98115'
            ],
            [
                'site_id'       => '0ABNKLA005',
                'category'      => 'VENDOR GUDANG',
                'name_intan'    => 'APLIKANUSA LINTASARTA - VENDOR CV. BUANA SEJAHTERA',
                'name_eproc'    => 'APLIKANUSA LINTASARTA - VENDOR CV. BUANA SEJAHTERA',
                'name_ims'      => '',
                'organizations' => 'SUMATRA REGIONAL OPERATION',
                'manager'       => '',
                'region'        => 'WEST INDONESIA REGIONAL (WIR)',
                'area'          => 'ACEH',
                'cluster'       => 'BANDA ACEH',
                'addr'          => 'Jl. Teuku Umar No. 88, Banda Aceh',
                'province'      => 'ACEH',
                'city'          => 'BANDA ACEH',
                'sub_dis'       => 'BAITURRAHMAN',
                'village'       => 'SUKARAMAI',
                'postal'        => '23243'
            ],
            [
                'site_id'       => '0ACBKLA002',
                'category'      => 'VENDOR GUDANG',
                'name_intan'    => 'APLIKANUSA LINTASARTA - DONYA TEKNOLOGI PERKASA',
                'name_eproc'    => 'APLIKANUSA LINTASARTA - DONYA TEKNOLOGI PERKASA',
                'name_ims'      => '',
                'organizations' => 'SUMATRA REGIONAL OPERATION',
                'manager'       => '',
                'region'        => 'WEST INDONESIA REGIONAL (WIR)',
                'area'          => 'ACEH',
                'cluster'       => 'LHOKSEUMAWE',
                'addr'          => 'Jl. Merdeka No. 12, Lhokseumawe',
                'province'      => 'ACEH',
                'city'          => 'LHOKSEUMAWE',
                'sub_dis'       => 'BANDA SAKTI',
                'village'       => 'LANCANG GARAM',
                'postal'        => '24351'
            ]
        ];

        foreach ($samples as $s) {
            $insSample->execute([
                ':site_id'       => $s['site_id'],
                ':category'      => $s['category'],
                ':name_intan'    => $s['name_intan'],
                ':name_eproc'    => $s['name_eproc'],
                ':name_ims'      => $s['name_ims'],
                ':organizations' => $s['organizations'],
                ':manager'       => $s['manager'],
                ':region'        => $s['region'],
                ':area'          => $s['area'],
                ':cluster'       => $s['cluster'],
                ':addr'          => $s['addr'],
                ':province'      => $s['province'],
                ':city'          => $s['city'],
                ':sub_dis'       => $s['sub_dis'],
                ':village'       => $s['village'],
                ':postal'        => $s['postal'],
            ]);
        }
    }

    if ($method === 'GET') {
        $search = trim($_GET['search'] ?? '');
        $sortCol = $_GET['sort'] ?? 'site_id';
        $sortDir = strtolower($_GET['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

        $allowedSorts = [
            'id', 'site_id', 'category', 'name_intan', 'name_eproc', 'name_ims',
            'organizations', 'manager', 'region', 'area', 'cluster',
            'addr', 'province', 'city', 'sub_dis', 'village', 'postal'
        ];
        if (!in_array($sortCol, $allowedSorts, true)) {
            $sortCol = 'site_id';
        }

        $params = [];
        $whereSql = '';
        if ($search !== '') {
            $whereSql = '
                WHERE site_id ILIKE :s
                   OR category ILIKE :s
                   OR name_intan ILIKE :s
                   OR name_eproc ILIKE :s
                   OR organizations ILIKE :s
                   OR region ILIKE :s
                   OR area ILIKE :s
                   OR cluster ILIKE :s
                   OR province ILIKE :s
                   OR city ILIKE :s
                   OR addr ILIKE :s
            ';
            $params[':s'] = '%' . $search . '%';
        }

        $stmt = $db->prepare("
            SELECT id, site_id, category, name_intan, name_eproc, name_ims,
                   organizations, manager, region, area, cluster,
                   addr, province, city, sub_dis, village, postal
            FROM site_locations
            $whereSql
            ORDER BY $sortCol $sortDir, id ASC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'data'    => $rows,
            'total'   => count($rows)
        ]);
        exit;
    }

    // CSRF check for state-changing requests
    session_start();
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
    if (empty($csrfHeader) || !hash_equals($_SESSION['csrf_token'] ?? '', $csrfHeader)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true) ?? $_POST;

        $siteId = trim((string)($payload['site_id'] ?? ''));
        if ($siteId === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Site ID is required']);
            exit;
        }

        $stmt = $db->prepare('
            INSERT INTO site_locations (
                site_id, category, name_intan, name_eproc, name_ims, organizations, manager,
                region, area, cluster, addr, province, city, sub_dis, village, postal
            ) VALUES (
                :site_id, :category, :name_intan, :name_eproc, :name_ims, :organizations, :manager,
                :region, :area, :cluster, :addr, :province, :city, :sub_dis, :village, :postal
            ) RETURNING id
        ');

        $stmt->execute([
            ':site_id'       => $siteId,
            ':category'      => trim((string)($payload['category'] ?? '')),
            ':name_intan'    => trim((string)($payload['name_intan'] ?? '')),
            ':name_eproc'    => trim((string)($payload['name_eproc'] ?? '')),
            ':name_ims'      => trim((string)($payload['name_ims'] ?? '')),
            ':organizations' => trim((string)($payload['organizations'] ?? '')),
            ':manager'       => trim((string)($payload['manager'] ?? '')),
            ':region'        => trim((string)($payload['region'] ?? '')),
            ':area'          => trim((string)($payload['area'] ?? '')),
            ':cluster'       => trim((string)($payload['cluster'] ?? '')),
            ':addr'          => trim((string)($payload['addr'] ?? '')),
            ':province'      => trim((string)($payload['province'] ?? '')),
            ':city'          => trim((string)($payload['city'] ?? '')),
            ':sub_dis'       => trim((string)($payload['sub_dis'] ?? '')),
            ':village'       => trim((string)($payload['village'] ?? '')),
            ':postal'        => trim((string)($payload['postal'] ?? '')),
        ]);

        $newId = $stmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'id'      => $newId,
            'message' => 'Site location created successfully'
        ]);
        exit;
    }

    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? null;
        if (!$id || !ctype_digit((string)$id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Valid record ID is required']);
            exit;
        }

        $stmt = $db->prepare('DELETE FROM site_locations WHERE id = :id');
        $stmt->execute([':id' => (int)$id]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Site location deleted successfully']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Record not found']);
        }
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('Site Locations API error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
