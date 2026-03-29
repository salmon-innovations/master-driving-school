const pool = require('./config/db');

async function listPdcSlots() {
    try {
        const res = await pool.query(`
            SELECT id, date, type, session, time_range, transmission, course_type, available_slots
            FROM schedule_slots 
            WHERE type ILIKE 'pdc' AND date >= '2026-03-01' AND date <= '2026-03-31'
            ORDER BY date
        `);
        console.log('--- MARCH PDC SLOTS ---');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

listPdcSlots();
