const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_nUy1mLAHD6TZ@ep-summer-king-a1rsfih7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function findUser() {
  const email = 'gabasamarcjeff03@gmail.com';
  console.log('Finding user ' + email + '...');
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log('User rows:', userRes.rows);
    if(userRes.rows.length > 0) {
      const u = userRes.rows[0];
      const bookingsRes = await pool.query('SELECT * FROM bookings WHERE user_id = $1', [u.id]);
      console.log('Bookings:', bookingsRes.rows);
      
      const enrollRes = await pool.query('SELECT * FROM schedule_enrollments WHERE student_id = $1', [u.id]);
      console.log('Schedule Enrollments:', enrollRes.rows);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

findUser();
