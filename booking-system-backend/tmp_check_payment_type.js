const pool = require('./config/db');
async function run() {
  try {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_type'`);
    console.log('Result:', res.rows.length > 0 ? 'EXISTS' : 'MISSING');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}
run();
