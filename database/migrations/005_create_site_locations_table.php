<?php
/**
 * Migration: Create site_locations table
 * Stores site location details:
 * ID, CATEGORY, NAME (INTAN, EPROC, IMS), ORGANIZATIONS, MANAGER,
 * REGIONAL (REGION, AREA, CLUSTER), LOCATION (ADDR, PROVINCE, CITY, SUB DIS, VILLAGE, POSTAL)
 */
return [
    'up' => function (PDO $db) {
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
            )
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_site_locations_site_id 
            ON site_locations (site_id)
        ');

        $db->exec('
            CREATE INDEX IF NOT EXISTS idx_site_locations_region 
            ON site_locations (region, area, cluster)
        ');
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS site_locations CASCADE');
    },
];
