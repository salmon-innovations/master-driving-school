const pool = require('./config/db');
pool.query(`
  SELECT b.id, b.total_amount, b.payment_type, b.payment_method, b.notes, b.created_at, b.transaction_id,
         c.price as course_price, c.name as course_name
  FROM bookings b
  LEFT JOIN courses c ON b.course_id = c.id
  WHERE b.id = 3
`).then(r => { console.log(JSON.stringify(r.rows, null, 2)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
