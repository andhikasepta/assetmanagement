<?php
/**
 * Migration: Create site_pics table and seed initial sites from site_regional
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            CREATE TABLE IF NOT EXISTS site_pics (
                id SERIAL PRIMARY KEY,
                dept VARCHAR(50),
                sub_dept VARCHAR(50),
                sitecode VARCHAR(50) NOT NULL,
                name_site VARCHAR(255),
                pic VARCHAR(150),
                no_telp VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_site_pics_sitecode ON site_pics (sitecode);
            CREATE INDEX IF NOT EXISTS idx_site_pics_dept ON site_pics (dept);
        ');

        // Initial seed from site_regional if empty
        $count = (int)$db->query('SELECT COUNT(*) FROM site_pics')->fetchColumn();
        if ($count === 0) {
            $db->exec("
                INSERT INTO site_pics (dept, sub_dept, sitecode, name_site, pic, no_telp)
                SELECT dept, sub_dept, sitecode, name_site, '', ''
                FROM site_regional
                ORDER BY dept ASC, sub_dept ASC, sitecode ASC
            ");
        }
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS site_pics CASCADE');
    },
];
