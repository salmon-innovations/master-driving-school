const pool = require('./config/db');
(async () => {
  const r = await pool.query(`SELECT * FROM bookings ORDER BY id DESC LIMIT 1`);
  console.log(Object.keys(r.rows[0] || {}));
  process.exit(0);
})();
