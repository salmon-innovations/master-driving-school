const pool = require('./config/db');
(async () => {
  const r = await pool.query(`SELECT id, notes FROM bookings WHERE id = 1`);
  console.log(r.rows[0]?.notes || 'no notes');
  process.exit(0);
})();
