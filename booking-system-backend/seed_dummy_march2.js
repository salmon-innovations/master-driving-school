/**
 * Seed dummy students and enroll them in a TDC F2F slot on March 2.
 * Run: node seed_dummy_march2.js
 *
 * Students:
 *   - Lin Bil Celestre  (linbilcelestre31@gmail.com)
 *   - Lance Happy       (lancehappy12@gmail.com)
 *
 * Behavior:
 *   1. Upserts the slot for 2026-03-02 TDC (Whole Day) if it doesn't exist.
 *   2. Creates user accounts for both emails (walkin_student role) if they don't exist.
 *   3. Creates a booking record for each user (TDC F2F).
 *   4. Enrolls each user in the March 2 TDC slot.
 *   5. Marks both as no-show AND marks the fee as paid so Reschedule is unlocked.
 *   6. Prints a summary of what was done.
 */

const pool = require('./config/db');

const SLOT_DATE     = '2026-03-02';
const SLOT_TYPE     = 'tdc';
const SLOT_SESSION  = 'Whole Day';
const SLOT_TIME     = '08:00 AM - 05:00 PM';
const SLOT_COURSE   = 'TDC F2F';
const SLOT_CAPACITY = 15;

const STUDENTS = [
  {
    first_name: 'Lin Bil',
    last_name: 'Celestre',
    email: 'linbilcelestre31@gmail.com',
    password: '$2b$10$dummyhashplaceholderLinBilCelestre', // not used for login
  },
  {
    first_name: 'Lance',
    last_name: 'Happy',
    email: 'lancehappy12@gmail.com',
    password: '$2b$10$dummyhashplaceholderLanceHappy1234',
  },
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Find or create the slot ─────────────────────────────────────────
    let slotId;
    const existingSlot = await client.query(
      `SELECT id FROM schedule_slots
       WHERE date = $1 AND LOWER(type) = $2 AND session = $3 AND end_date = $1
       LIMIT 1`,
      [SLOT_DATE, SLOT_TYPE, SLOT_SESSION]
    );

    if (existingSlot.rows.length > 0) {
      slotId = existingSlot.rows[0].id;
      console.log(`✅ Using existing slot id=${slotId} on ${SLOT_DATE}`);
    } else {
      // Try to resolve a branch_id (use first available branch)
      const branchRow = await client.query('SELECT id FROM branches ORDER BY id LIMIT 1');
      const branchId = branchRow.rows[0]?.id || null;

      const newSlot = await client.query(
        `INSERT INTO schedule_slots
           (date, end_date, type, session, time_range, total_capacity, available_slots, course_type, branch_id)
         VALUES ($1, $1, $2, $3, $4, $5, $5, $6, $7)
         RETURNING id`,
        [SLOT_DATE, SLOT_TYPE, SLOT_SESSION, SLOT_TIME, SLOT_CAPACITY, SLOT_COURSE, branchId]
      );
      slotId = newSlot.rows[0].id;
      console.log(`✅ Created new TDC slot id=${slotId} on ${SLOT_DATE} (branch_id=${branchId})`);
    }

    // Find a TDC course for booking
    const courseRow = await client.query(
      `SELECT id, price FROM courses WHERE category ILIKE '%tdc%' OR name ILIKE '%tdc%' LIMIT 1`
    );
    const courseId    = courseRow.rows[0]?.id    || null;
    const coursePrice = parseFloat(courseRow.rows[0]?.price || 0);

    // Find a valid branch_id from the slot
    const slotBranchRow = await client.query('SELECT branch_id FROM schedule_slots WHERE id = $1', [slotId]);
    const branchId = slotBranchRow.rows[0]?.branch_id || null;

    // ── 2–5. For each student ──────────────────────────────────────────────
    for (const s of STUDENTS) {
      // 2. Upsert user
      let userId;
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1', [s.email]
      );
      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
        console.log(`  👤 User already exists: ${s.email} (id=${userId})`);
      } else {
        const newUser = await client.query(
          `INSERT INTO users
             (first_name, last_name, email, password, role, is_verified)
           VALUES ($1, $2, $3, $4, 'walkin_student', TRUE)
           ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
           RETURNING id`,
          [s.first_name, s.last_name, s.email, s.password]
        );
        userId = newUser.rows[0].id;
        console.log(`  ✅ Created user: ${s.email} (id=${userId})`);
      }

      // 3. Create booking if not already present
      let bookingId;
      const existingBooking = await client.query(
        `SELECT id FROM bookings WHERE user_id = $1 AND course_id IS NOT DISTINCT FROM $2 LIMIT 1`,
        [userId, courseId]
      );
      if (existingBooking.rows.length > 0) {
        bookingId = existingBooking.rows[0].id;
        console.log(`  📋 Booking already exists (id=${bookingId})`);
      } else {
        const newBooking = await client.query(
          `INSERT INTO bookings
             (user_id, course_id, branch_id, status, payment_method, course_type, total_amount, booking_date)
           VALUES ($1, $2, $3, 'confirmed', 'cash', 'TDC F2F', $4, CURRENT_DATE)
           RETURNING id`,
          [userId, courseId, branchId, coursePrice]
        );
        bookingId = newBooking.rows[0].id;
        console.log(`  ✅ Created booking (id=${bookingId})`);
      }

      // 4. Enroll in the slot (upsert — cancel any previous no-show/cancelled)
      const existingEnroll = await client.query(
        'SELECT id, enrollment_status FROM schedule_enrollments WHERE slot_id = $1 AND student_id = $2',
        [slotId, userId]
      );

      let enrollmentId;
      if (existingEnroll.rows.length > 0) {
        enrollmentId = existingEnroll.rows[0].id;
        await client.query(
          `UPDATE schedule_enrollments
             SET enrollment_status = 'no-show', reschedule_fee_paid = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [enrollmentId]
        );
        console.log(`  🔄 Updated existing enrollment (id=${enrollmentId}) → no-show + fee paid`);
      } else {
        const newEnroll = await client.query(
          `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status, reschedule_fee_paid)
           VALUES ($1, $2, 'no-show', TRUE)
           RETURNING id`,
          [slotId, userId]
        );
        enrollmentId = newEnroll.rows[0].id;
        console.log(`  ✅ Created enrollment (id=${enrollmentId}) → no-show + fee paid`);
      }
    }

    await client.query('COMMIT');
    console.log('\n🎉 Done! Both students are enrolled in the March 2 TDC slot as no-show with fee paid.');
    console.log('   Reschedule button will be fully unlocked for both.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
