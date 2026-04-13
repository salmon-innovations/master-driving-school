const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_nUy1mLAHD6TZ@ep-summer-king-a1rsfih7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function clearData() {
  const email = 'gabasamarcjeff03@gmail.com';
  console.log('Clearing data for ' + email + '...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rowCount === 0) {
      console.log('User not found. They might have already been deleted.');
      await client.query('ROLLBACK');
      return;
    }

    const userId = userRes.rows[0].id;
    console.log('Found user ID: ' + userId);

    const enrollmentsRes = await client.query('SELECT id FROM schedule_enrollments WHERE student_id = $1', [userId]);
    if (enrollmentsRes.rowCount > 0) {
      await client.query('DELETE FROM schedule_enrollments WHERE student_id = $1', [userId]);
      console.log('Deleted schedule enrollments: ' + enrollmentsRes.rowCount);
    }

    const bookingsRes = await client.query('SELECT id FROM bookings WHERE user_id = $1', [userId]);
    if (bookingsRes.rowCount > 0) {
      await client.query('DELETE FROM bookings WHERE user_id = $1', [userId]);
      console.log('Deleted bookings: ' + bookingsRes.rowCount);
    }

    // Recompute slot availability from actual active enrollments to avoid negative booked counts.
    const recalcResult = await client.query(`
      WITH active_counts AS (
        SELECT
          slot_id,
          COUNT(*)::int AS used_count
        FROM schedule_enrollments
        WHERE enrollment_status NOT IN ('cancelled', 'no-show')
        GROUP BY slot_id
      )
      UPDATE schedule_slots s
      SET
        available_slots = GREATEST(0, LEAST(s.total_capacity, s.total_capacity - COALESCE(a.used_count, 0))),
        updated_at = CURRENT_TIMESTAMP
      FROM (SELECT id FROM schedule_slots) all_slots
      LEFT JOIN active_counts a ON a.slot_id = all_slots.id
      WHERE s.id = all_slots.id
      RETURNING s.id
    `);
    console.log('Recomputed slot availability rows: ' + recalcResult.rowCount);

    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    console.log('Deleted user ' + email);

    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

clearData();
