const pool = require('./config/db');
async function run() {
  try {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings'`);
    console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}
run();
