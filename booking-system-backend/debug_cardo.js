require('dotenv').config();
const pool = require('./config/db');

(async () => {
  try {
    // Check all booking columns
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'bookings' ORDER BY ordinal_position
    `);
    console.log('BOOKINGS COLUMNS:', cols.rows.map(r => r.column_name).join(', '));

    // Cardo's booking
    const result = await pool.query(`
      SELECT b.* FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE u.first_name ILIKE '%Cardo%'
    `);
    console.log('\nBOOKING ROW:', JSON.stringify(result.rows, null, 2));

    if (result.rows.length === 0) { await pool.end(); return; }
    const uid = result.rows[0].user_id;

    // Cardo's schedule_enrollments
    const enroll = await pool.query(`
      SELECT se.id, se.slot_id, se.enrollment_status, ss.date, ss.end_date, ss.type, ss.course_type
      FROM schedule_enrollments se
      JOIN schedule_slots ss ON se.slot_id = ss.id
      WHERE se.student_id = $1
    `, [uid]);
    console.log('\nSCHEDULE_ENROLLMENTS:', JSON.stringify(enroll.rows, null, 2));

    // March 7-9 TDC slots
    const slot = await pool.query(`
      SELECT id, date, end_date, type, course_type, session, available_slots, total_capacity
      FROM schedule_slots
      WHERE date <= '2026-03-07' AND end_date >= '2026-03-07'
        AND type ILIKE '%tdc%'
    `);
    console.log('\nMARCH 7-9 TDC SLOTS:', JSON.stringify(slot.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
