const pool = require('../config/db');
async function run() {
    try {
        const res = await pool.query(`
            SELECT id, status, total_amount, payment_type, transaction_id, created_at, updated_at
            FROM bookings 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.log("RECENT BOOKINGS:");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
