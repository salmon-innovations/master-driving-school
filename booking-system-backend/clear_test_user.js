const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_nUy1mLAHD6TZ@ep-summer-king-a1rsfih7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function clearData() {
  const email = 'gabasamarcjeff03@gmail.com';
  console.log('Clearing data for ' + email + '...');
  try {
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rowCount === 0) {
      console.log('User not found. They might have already been deleted.');
      return;
    }
    const userId = userRes.rows[0].id;
    console.log('Found user ID: ' + userId);
    
    const bookingsRes = await pool.query('SELECT id, schedule_id FROM bookings WHERE user_id = $1', [userId]);
    for (const booking of bookingsRes.rows) {
      if (booking.schedule_id) {
         await pool.query('UPDATE schedule SET available_slots = available_slots + 1 WHERE id = $1', [booking.schedule_id]);
         console.log('Restored 1 slot for schedule ID: ' + booking.schedule_id);
      }
      await pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]);
      console.log('Deleted booking ID: ' + booking.id);
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    console.log('Deleted user ' + email);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

clearData();
