/**
 * Seed: Test student account for reschedule/no-show feature testing
 *  - Student:   Linbil Celestre  |  linbilcelestre31@gmail.com
 *  - Course:    TDC (F2F)  –  ₱700
 *  - Schedule:  March 2, 2026 (Day 1)  → March 3, 2026 (Day 2)
 *  - Branch:    V-luna Main Branch (id=1)
 *  - Status:    enrolled  (past date so it looks like a missed class)
 *
 * Run once:  node seed_test_student.js
 */

const pool   = require('./config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* ── 1. Create / find user ─────────────────────────────────── */
    const email    = 'linbilcelestre31@gmail.com';
    const existing = await client.query('SELECT id FROM users WHERE email=$1', [email]);

    let userId;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      console.log(`⚠️  User already exists  → id=${userId}`);
    } else {
      const hash = await bcrypt.hash('Test@1234', 10);
      const ins  = await client.query(
        `INSERT INTO users
           (first_name, last_name, email, password, role,
            contact_numbers, gender, status, is_verified, created_at, updated_at)
         VALUES
           ('Linbil', 'Celestre', $1, $2, 'student',
            '09171234567', 'Male', 'active', TRUE, NOW(), NOW())
         RETURNING id`,
        [email, hash]
      );
      userId = ins.rows[0].id;
      console.log(`✅  Created user  → id=${userId}  (password: Test@1234)`);
    }

    /* ── 2. Create or reuse the TDC F2F multi-day slot ─────────── */
    const slotCheck = await client.query(
      `SELECT id FROM schedule_slots
       WHERE type='tdc' AND course_type='F2F' AND date='2026-03-02' AND end_date='2026-03-03' AND branch_id=1
       LIMIT 1`
    );

    let slotId;
    if (slotCheck.rows.length > 0) {
      slotId = slotCheck.rows[0].id;
      console.log(`⚠️  TDC F2F slot already exists  → id=${slotId}`);
    } else {
      const slotIns = await client.query(
        `INSERT INTO schedule_slots
           (date, end_date, type, session, time_range, course_type, transmission,
            total_capacity, available_slots, branch_id, created_at, updated_at)
         VALUES
           ('2026-03-02', '2026-03-03', 'tdc', 'Whole Day', '08:00 AM - 05:00 PM', 'F2F', NULL,
            15, 14, 1, NOW(), NOW())
         RETURNING id`
      );
      slotId = slotIns.rows[0].id;
      console.log(`✅  Created TDC F2F slot (Mar 2→3)  → id=${slotId}`);
    }

    /* ── 3. Create booking ─────────────────────────────────────── */
    const bookingCheck = await client.query(
      `SELECT id FROM bookings WHERE user_id=$1 AND course_id=2`, [userId]
    );

    let bookingId;
    if (bookingCheck.rows.length > 0) {
      bookingId = bookingCheck.rows[0].id;
      console.log(`⚠️  Booking already exists  → id=${bookingId}`);
    } else {
      const bookIns = await client.query(
        `INSERT INTO bookings
           (user_id, course_id, branch_id, booking_date, booking_time,
            status, notes, total_amount, payment_type, payment_method,
            course_type, enrollment_type, created_at, updated_at)
         VALUES
           ($1, 2, 1, '2026-03-02', '08:00:00',
            'paid', 'Test seed for reschedule/no-show feature', 700.00,
            'Full Payment', 'GCash',
            'TDC', 'online', NOW(), NOW())
         RETURNING id`,
        [userId]
      );
      bookingId = bookIns.rows[0].id;
      console.log(`✅  Created booking  → id=${bookingId}`);
    }

    /* ── 4. Enroll student in the slot ────────────────────────── */
    const enrollCheck = await client.query(
      `SELECT id FROM schedule_enrollments WHERE slot_id=$1 AND student_id=$2`,
      [slotId, userId]
    );

    if (enrollCheck.rows.length > 0) {
      console.log(`⚠️  Enrollment already exists  → id=${enrollCheck.rows[0].id}`);
    } else {
      const enrollIns = await client.query(
        `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status, created_at, updated_at)
         VALUES ($1, $2, 'enrolled', NOW(), NOW()) RETURNING id`,
        [slotId, userId]
      );
      // slot available_slots was already set to 14 (15-1) during slot creation, so no further decrement needed.
      console.log(`✅  Created enrollment  → id=${enrollIns.rows[0].id}`);
    }

    await client.query('COMMIT');

    console.log('\n🎉  Seed complete!');
    console.log('─────────────────────────────────────────────────────');
    console.log(`  Email   : linbilcelestre31@gmail.com`);
    console.log(`  Password: Test@1234`);
    console.log(`  Course  : THEORETICAL DRIVING COURSE (TDC) – F2F`);
    console.log(`  Slot    : March 2-3, 2026  |  Whole Day  |  V-luna`);
    console.log(`  Status  : enrolled  (past date – ready for no-show test)`);
    console.log('─────────────────────────────────────────────────────');
    console.log(`\n  To test reschedule flow:`);
    console.log(`  1. Go to Schedule page → set date to March 2, 2026`);
    console.log(`  2. Open the TDC F2F slot → click "Students"`);
    console.log(`  3. Click "Mark No-Show" next to Linbil Celestre`);
    console.log(`     → Email will be sent to linbilcelestre31@gmail.com`);
    console.log(`     → Check inbox for ₱1,000 reschedule fee link`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
