require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function dropCRMTables() {
    try {
        console.log('Dropping CRM tables...');

        await pool.query(`
            DROP TABLE IF EXISTS lead_attachments CASCADE;
            DROP TABLE IF EXISTS lead_interactions CASCADE;
            DROP TABLE IF EXISTS leads CASCADE;
            DROP TABLE IF EXISTS lead_statuses CASCADE;
            DROP TABLE IF EXISTS lead_sources CASCADE;
        `);

        console.log('Successfully dropped all CRM tables.');
    } catch (err) {
        console.error('Error dropping tables:', err);
    } finally {
        await pool.end();
    }
}

dropCRMTables();
