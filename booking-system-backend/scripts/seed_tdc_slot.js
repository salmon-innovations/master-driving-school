require('dotenv').config();
const pool = require('../config/db');

async function seed() {
  try {
    // find user
    const userRes = await pool.query(`SELECT id FROM users WHERE email = 'gabasamarcjeff03@gmail.com'`);
    if (!userRes.rows.length) {
      console.log('User not found.');
      return process.exit(1);
    }
    const user_id = userRes.rows[0].id;

    // get branch
    const branchRes = await pool.query(`SELECT id FROM branches LIMIT 1`);
    const branch_id = branchRes.rows[0]?.id || 1;

    // create tdc course if not exists
    let courseRes = await pool.query(`SELECT id FROM courses WHERE name ILIKE '%TDC%' LIMIT 1`);
    let course_id;
    if (courseRes.rows.length > 0) {
      course_id = courseRes.rows[0].id;
    } else {
      const c = await pool.query(`INSERT INTO courses (name, category, price) VALUES ('TDC F2F Course', 'TDC', 1500) RETURNING id`);
      course_id = c.rows[0].id;
    }

    // create slot for mid-march
    const slotRes = await pool.query(`
      INSERT INTO schedule_slots (
        branch_id, date, end_date, total_capacity, available_slots, type, session, time_range, course_type
      )
      VALUES ($1, '2026-03-15', '2026-03-16', 10, 9, 'tdc', 'Morning', '08:00 AM - 12:00 PM', 'f2f')
      RETURNING id;
    `, [branch_id]);
    const slot_id = slotRes.rows[0].id;
    console.log('Created slot ID:', slot_id);

    // create booking
    const bookingRes = await pool.query(`
      INSERT INTO bookings (
        user_id, course_id, branch_id, booking_date, total_amount, payment_type, payment_method, status
      )
      VALUES ($1, $2, $3, NOW(), 1500, 'full payment', 'Cash', 'completed')
      RETURNING id;
    `, [user_id, course_id, branch_id]);
    const booking_id = bookingRes.rows[0].id;
    console.log('Created booking ID:', booking_id);

    // create enrollment
    await pool.query(`
      INSERT INTO student_enrollments (booking_id, user_id, schedule_slot_id, registration_status, payment_status)
      VALUES ($1, $2, $3, 'completed', 'paid')
    `, [booking_id, user_id, slot_id]).catch(async () => {
         // if student_enrollments schema is different or fails, we can just insert into schedule_enrollments
         await pool.query(`
            INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
            VALUES ($1, $2, 'completed')
         `, [slot_id, user_id]);
    });
    console.log('Enrollment setup complete!');
    process.exit(0);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
seed();