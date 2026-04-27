const pool = require('./config/db');
async function checkLastBookings() {
    try {
        const res = await pool.query("SELECT id, status, payment_type, transaction_id, created_at FROM bookings ORDER BY created_at DESC LIMIT 5");
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkLastBookings();
