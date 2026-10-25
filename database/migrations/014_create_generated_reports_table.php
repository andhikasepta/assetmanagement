<?php
/**
 * Migration: Create generated_reports table for storing generated BA reports
 */
return [
    'up' => function (PDO $db) {
        $db->exec('
            CREATE TABLE IF NOT EXISTS generated_reports (
                id SERIAL PRIMARY KEY,
                sitecode VARCHAR(100) NOT NULL,
                sitename VARCHAR(255),
                dept VARCHAR(100),
                sub_dept VARCHAR(100),
                period_month INT NOT NULL,
                period_year INT NOT NULL,
                status VARCHAR(50) DEFAULT \'generated\',
                pdf_path VARCHAR(500),
                docx_path VARCHAR(500),
                pic_name VARCHAR(150),
                pic_phone VARCHAR(50),
                avp_name VARCHAR(150),
                avp_title VARCHAR(255),
                fvp_name VARCHAR(150),
                fvp_title VARCHAR(255),
                summary_data JSONB,
                generated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                sent_at TIMESTAMP WITHOUT TIME ZONE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_site_period UNIQUE (sitecode, period_month, period_year)
            )
        ');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_gen_reports_sitecode ON generated_reports(sitecode)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_gen_reports_period ON generated_reports(period_month, period_year)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_gen_reports_status ON generated_reports(status)');
    },

    'down' => function (PDO $db) {
        $db->exec('DROP TABLE IF EXISTS generated_reports');
    },
];
