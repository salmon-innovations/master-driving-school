require('dotenv').config();
const pool = require('../config/db');
async function run() {
  const r1 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'schedule_slots'`);
  console.log('schedule_slots cols:', r1.rows.map(r => r.column_name));
  const r2 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings'`);
  console.log('bookings cols:', r2.rows.map(r => r.column_name));
  const r3 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'enrollments'`);
  console.log('enrollments cols:', r3.rows.map(r => r.column_name));
  const r4 = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
  console.log('tables:', r4.rows.map(r => r.table_name));
  const t = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'testimonials'`);
  console.log('testimonials:', t.rows.map(r => r.column_name));
  const f = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'feedbacks'`);
  console.log('feedbacks:', f.rows.map(r => r.column_name));
  const cs = await pool.query(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'schedule_slots_session_check'`);
  console.log('check constraints:', cs.rows);
  const ct = await pool.query(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'schedule_slots_type_check'`);
  console.log('type constraints:', ct.rows);
  const cp = await pool.query(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'bookings_payment_method_check'`);
  console.log('payment constraints:', cp.rows);
  process.exit();
}
run();