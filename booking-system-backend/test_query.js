const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres', // modify as needed based on .env
  host: 'localhost',
  database: 'master_school_db', // guessing name, will use .env instead
  port: 5432,
});

require('dotenv').config({ path: 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/.env' });

const envPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
  try {
    const res = await envPool.query(`
      SELECT u.id, u.email, u.branch_id as real_u_b_id,
      (SELECT branch_id FROM bookings WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as bk_branch_id,
      COALESCE(b.name, (
        SELECT br.name FROM bookings bk JOIN branches br ON bk.branch_id = br.id WHERE bk.user_id = u.id ORDER BY bk.created_at DESC LIMIT 1
      )) as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.role IN ('student', 'walkin_student')
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await envPool.end();
  }
}
run();
