const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Oasis@02230325',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'booking_system'
});

async function check() {
    try {
        const res = await pool.query("SELECT id, branch_id, type, date, end_date, available_slots FROM schedule_slots WHERE LOWER(type) = 'tdc'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
