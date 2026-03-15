/**
 * Seed two test students on March 2, 2026 TDC F2F slot.
 *
 * linbilcelestre31@gmail.com  → no-show, fee PAID    (can test Reschedule)
 * lancehappy12@gmail.com      → enrolled             (can test Mark No-Show → email)
 */
const pool = require('./config/db');
const bcrypt = require('bcryptjs');

const TDC_COURSE_ID = 2;        // THEORETICAL DRIVING COURSE (TDC) ₱700
const BRANCH_ID = 13;           // Master Driving School Bocaue Bulacan Branch
const SLOT_DATE = '2026-03-02';

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash('Password123', 10);

    // ── 1. Upsert users ──
    const users = [
      { first: 'Lin Bil', last: 'Celestre', email: 'linbilcelestre31@gmail.com' },
      { first: 'Lance',   last: 'Happy',    email: 'lancehappy12@gmail.com'     },
    ];

    const userIds = [];
    for (const u of users) {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
      let uid;
      if (existing.rows.length > 0) {
        uid = existing.rows[0].id;
        console.log(`User already exists: ${u.email} (id=${uid})`);
      } else {
        const res = await client.query(
          `INSERT INTO users (first_name, last_name, email, password, role, is_verified, gender, age)
           VALUES ($1, $2, $3, $4, 'student', true, 'Male', 25)
           RETURNING id`,
          [u.first, u.last, u.email, passwordHash]
        );
        uid = res.rows[0].id;
        console.log(`Created user: ${u.email} (id=${uid})`);
      }
      userIds.push(uid);
    }

    // ── 2. Ensure a TDC F2F slot exists on March 2, 2026 ──
    const existingSlot = await client.query(
      `SELECT id FROM schedule_slots
       WHERE date = $1 AND type = 'tdc' AND course_type = 'F2F' AND branch_id = $2
       LIMIT 1`,
      [SLOT_DATE, BRANCH_ID]
    );

    let slotId;
    if (existingSlot.rows.length > 0) {
      slotId = existingSlot.rows[0].id;
      console.log(`Slot already exists (id=${slotId})`);
    } else {
      const res = await client.query(
        `INSERT INTO schedule_slots
           (date, end_date, type, session, time_range, total_capacity, available_slots, branch_id, course_type)
         VALUES ($1, $2, 'tdc', 'Whole Day', '08:00 AM - 05:00 PM', 15, 13, $3, 'F2F')
         RETURNING id`,
        [SLOT_DATE, '2026-03-03', BRANCH_ID]
      );
      slotId = res.rows[0].id;
      console.log(`Created slot (id=${slotId}) on ${SLOT_DATE}`);
    }

    // ── 3. Upsert bookings ──
    for (const userId of userIds) {
      const existBk = await client.query(
        'SELECT id FROM bookings WHERE user_id = $1 AND course_id = $2',
        [userId, TDC_COURSE_ID]
      );
      if (existBk.rows.length === 0) {
        await client.query(
          `INSERT INTO bookings
             (user_id, course_id, branch_id, booking_date, status, total_amount,
              payment_type, payment_method, enrollment_type, course_type)
           VALUES ($1, $2, $3, $4, 'confirmed', 700.00,
                   'Full Payment', 'Cash', 'walk-in', 'F2F')`,
          [userId, TDC_COURSE_ID, BRANCH_ID, SLOT_DATE]
        );
        console.log(`Created booking for user ${userId}`);
      } else {
        console.log(`Booking already exists for user ${userId}`);
      }
    }

    // ── 4. Upsert enrollments ──
    // linbilcelestre31 (userIds[0]) → no-show, fee PAID
    // lancehappy12     (userIds[1]) → enrolled
    const enrollConfig = [
      { userId: userIds[0], status: 'no-show',  feePaid: true  },
      { userId: userIds[1], status: 'enrolled', feePaid: false },
    ];

    for (const cfg of enrollConfig) {
      const existEnroll = await client.query(
        'SELECT id FROM schedule_enrollments WHERE slot_id = $1 AND student_id = $2',
        [slotId, cfg.userId]
      );

      if (existEnroll.rows.length > 0) {
        await client.query(
          `UPDATE schedule_enrollments
             SET enrollment_status = $1, reschedule_fee_paid = $2, updated_at = CURRENT_TIMESTAMP
           WHERE slot_id = $3 AND student_id = $4`,
          [cfg.status, cfg.feePaid, slotId, cfg.userId]
        );
        console.log(`Updated enrollment for user ${cfg.userId}: ${cfg.status}, fee_paid=${cfg.feePaid}`);
      } else {
        await client.query(
          `INSERT INTO schedule_enrollments (slot_id, student_id, enrollment_status, reschedule_fee_paid)
           VALUES ($1, $2, $3, $4)`,
          [slotId, cfg.userId, cfg.status, cfg.feePaid]
        );
        // Decrement available_slots only for active enrollment
        if (cfg.status === 'enrolled') {
          await client.query(
            'UPDATE schedule_slots SET available_slots = available_slots - 1 WHERE id = $1 AND available_slots > 0',
            [slotId]
          );
        }
        console.log(`Created enrollment for user ${cfg.userId}: ${cfg.status}, fee_paid=${cfg.feePaid}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Done! Summary:');
    console.log('  linbilcelestre31@gmail.com → no-show, fee PAID (Reschedule button active)');
    console.log('  lancehappy12@gmail.com     → enrolled (use No-Show button to test email)');
    console.log('  Password for both: Password123');
    console.log(`  Slot: TDC F2F ${SLOT_DATE} Whole Day at branch ${BRANCH_ID}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
})();
