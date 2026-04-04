const pool = require('./config/db');
(async () => {
  const r = await pool.query(`SELECT id, notes FROM bookings WHERE id = 1`);
  const n = JSON.parse(r.rows[0].notes || '{}');
  console.log(JSON.stringify(n, null, 2));
  process.exit(0);
})();
