// Simulate exactly what getAllBookings does for booking id=3
const pool = require('./config/db');

async function test() {
  const result = await pool.query(`
    SELECT b.id, b.user_id, b.course_id, b.branch_id, b.booking_date,
           b.booking_time, b.status, b.notes, b.total_amount,
           b.created_at, b.updated_at, b.course_type,
           COALESCE(b.payment_type, 'N/A') as payment_type,
           COALESCE(b.payment_method, 'N/A') as payment_method,
           COALESCE(b.enrollment_type, 'online') as enrollment_type,
           u.first_name || ' ' || COALESCE(u.middle_name || ' ', '') || u.last_name as student_name,
           c.name as course_name,
           c.price as course_price,
           br.name as branch_name
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN courses c ON b.course_id = c.id
    LEFT JOIN branches br ON b.branch_id = br.id
    WHERE b.id = 3
  `);
  const row = result.rows[0];
  console.log('total_amount:', row.total_amount, '| type:', typeof row.total_amount);
  console.log('course_price:', row.course_price, '| type:', typeof row.course_price);
  console.log('created_at:', row.created_at, '| type:', typeof row.created_at);
  console.log('payment_type:', row.payment_type);
  console.log('payment_method:', row.payment_method);
  console.log('notes:', row.notes);
  process.exit(0);
}
test().catch(e => { console.error(e.message); process.exit(1); });
