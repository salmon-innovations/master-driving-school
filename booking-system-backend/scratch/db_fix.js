const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/gabas/OneDrive/Desktop/Booking System/booking-system-backend/.env' });

const config = {
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD || ''),
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
};

const pool = new Pool(config);

async function run() {
  try {
    await pool.query("UPDATE courses SET name = REPLACE(name, '(Bundle)', '') WHERE name LIKE '%(Bundle)%'");
    await pool.query("UPDATE bookings SET course_name = REPLACE(course_name, '(Bundle)', ''), course_summary = REPLACE(course_summary, '(Bundle)', '') WHERE course_name LIKE '%(Bundle)%' OR course_summary LIKE '%(Bundle)%'");
    console.log('Cleanup finished');
  } catch(e) { console.error(e); }
  finally { await pool.end(); }
}
run();
