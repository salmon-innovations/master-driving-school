const pool = require('./config/db');

async function checkPdcBranches() {
    try {
        const res = await pool.query(`
            SELECT id, date, branch_id, transmission, course_type
            FROM schedule_slots 
            WHERE type ILIKE 'pdc' AND date >= '2026-03-01' AND date <= '2026-03-31'
            ORDER BY date
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkPdcBranches();
