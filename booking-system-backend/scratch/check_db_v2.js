const pool = require('../config/db');
async function run() {
    try {
        const res = await pool.query("SELECT id, status, total_amount, payment_type, transaction_id, created_at FROM bookings ORDER BY created_at DESC LIMIT 10");
        console.log("ALL RECENT BOOKINGS:");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
