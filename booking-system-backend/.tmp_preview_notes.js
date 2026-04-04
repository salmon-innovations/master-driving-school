const pool = require('./config/db');
(async () => {
  const q = `
    SELECT id, total_amount, payment_type, payment_method, status, left(notes, 400) as notes_preview
    FROM bookings
    ORDER BY id DESC
    LIMIT 10
  `;
  const r = await pool.query(q);
  console.log(JSON.stringify(r.rows, null, 2));
  process.exit(0);
})();
