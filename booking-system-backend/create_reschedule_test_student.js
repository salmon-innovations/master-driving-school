/**
 * Seed: Reschedule-test student
 * email: gabasamarcjeff03@gmail.com
 * Scenario: Enrolled in TDC F2F Whole Day (V-luna Main, 2026-03-02 → 2026-03-03),
 *           marked no-show, rescheduling fee already paid.
 */

const pool = require('./config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1 ─ Find V-luna Main Branch
    const branchRes = await client.query(
      `SELECT id FROM branches WHERE name ILIKE '%V-luna%' LIMIT 1`
    );
    if (branchRes.rows.length === 0) throw new Error('V-luna branch not found in DB');
    const branchId = branchRes.rows[0].id;
    console.log(`✅ Branch found: id=${branchId}`);

    // 2 ─ Find (or create) TDC course with category = 'TDC'
    const courseRes = await client.query(
      `SELECT id, name, price FROM courses WHERE category ILIKE 'TDC' ORDER BY id LIMIT 1`
    );
    if (courseRes.rows.length === 0) throw new Error('No TDC course found. Please add a TDC category course first.');
    const course = courseRes.rows[0];
    console.log(`✅ TDC course found: id=${course.id} name="${course.name}" price=${course.price}`);

    // 3 ─ Upsert user (gabasamarcjeff03@gmail.com)
    const email = 'gabasamarcjeff03@gmail.com';
    const passwordHash = await bcrypt.hash('Test@12345', 10);

    let userId;
    const existingUser = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log(`ℹ️  User already exists: id=${userId}`);
    } else {
      const userIns = await client.query(
        `INSERT INTO users
           (first_name, last_name, email, password, role, status, is_verified, branch_id)
         VALUES ($1, $2, $3, $4, 'student', 'active', TRUE, $5)
         RETURNING id`,
        ['Marc Jeff', 'Gabasa', email, passwordHash, branchId]
      );
      userId = userIns.rows[0].id;
      console.log(`✅ User created: id=${userId}`);
    }

    // 4 ─ Find or create the TDC F2F Whole Day slot on 2026-03-02 at V-luna
    const slotDate = '2026-03-02';
    const slotEndDate = '2026-03-03';

    let slotId;
    const existingSlot = await client.query(
      `SELECT id FROM schedule_slots
        WHERE date = $1 AND end_date = $2
          AND type = 'tdc' AND session = 'Whole Day'
          AND (course_type ILIKE 'F2F')
          AND branch_id = $3
        LIMIT 1`,
      [slotDate, slotEndDate, branchId]
    );

    if (existingSlot.rows.length > 0) {
      slotId = existingSlot.rows[0].id;
      console.log(`ℹ️  Slot already exists: id=${slotId}`);
    } else {
      const slotIns = await client.query(
        `INSERT INTO schedule_slots
           (date, end_date, type, session, time_range, total_capacity, available_slots, branch_id, course_type, transmission)
         VALUES ($1, $2, 'tdc', 'Whole Day', '08:00 AM - 05:00 PM', 15, 14, $3, 'F2F', NULL)
         RETURNING id`,
        [slotDate, slotEndDate, branchId]
      );
      slotId = slotIns.rows[0].id;
      console.log(`✅ Slot created: id=${slotId}`);
    }

    // 5 ─ Create booking for the TDC course
    let bookingId;
    const existingBooking = await client.query(
      `SELECT id FROM bookings WHERE user_id = $1 AND course_id = $2 AND status = 'paid' LIMIT 1`,
      [userId, course.id]
    );

    if (existingBooking.rows.length > 0) {
      bookingId = existingBooking.rows[0].id;
      console.log(`ℹ️  Booking already exists: id=${bookingId}`);
    } else {
      const bookingIns = await client.query(
        `INSERT INTO bookings
           (user_id, course_id, branch_id, booking_date, status, total_amount,
            payment_type, payment_method, enrollment_type, course_type,
            notes)
         VALUES ($1, $2, $3, $4, 'paid', $5, 'Full Payment', 'Cash', 'online', 'F2F',
                 'Rescheduling fee of ₱1,000 paid — eligible to reschedule.')
         RETURNING id`,
        [userId, course.id, branchId, slotDate, course.price]
      );
      bookingId = bookingIns.rows[0].id;
      console.log(`✅ Booking created: id=${bookingId}`);
    }

    // 6 ─ Create schedule_enrollment with status 'no-show' (already paid ₱1,000 fee)
    const existingEnrollment = await client.query(
      `SELECT id FROM schedule_enrollments WHERE slot_id = $1 AND student_id = $2 LIMIT 1`,
      [slotId, userId]
    );

    if (existingEnrollment.rows.length > 0) {
      console.log(`ℹ️  Enrollment already exists: id=${existingEnrollment.rows[0].id}`);
      // Ensure it is marked no-show
      await client.query(
        `UPDATE schedule_enrollments SET enrollment_status = 'no-show' WHERE id = $1`,
        [existingEnrollment.rows[0].id]
      );
      console.log(`✅ Enrollment updated to no-show`);
    } else {
      const enrollIns = await client.query(
        `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status)
         VALUES ($1, $2, 'no-show')
         RETURNING id`,
        [slotId, userId]
      );
      console.log(`✅ Enrollment created with no-show: id=${enrollIns.rows[0].id}`);
    }

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('✅ Seed complete!');
    console.log(`  Student email : ${email}`);
    console.log(`  Password      : Test@12345`);
    console.log(`  Branch        : V-luna Main (id=${branchId})`);
    console.log(`  Slot          : TDC F2F Whole Day  ${slotDate} → ${slotEndDate} (id=${slotId})`);
    console.log(`  Booking       : id=${bookingId}  (status=paid, notes: ₱1,000 reschedule fee paid)`);
    console.log(`  Enrollment    : status=no-show  → eligible for reschedule`);
    console.log('========================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed, rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
