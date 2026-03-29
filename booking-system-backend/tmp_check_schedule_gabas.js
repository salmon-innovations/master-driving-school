const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});

async function checkSchedule() {
  try {
    const res = await pool.query(`
      SELECT b.id, 
             (SELECT json_agg(json_build_object('date', ss.date, 'end_date', ss.end_date, 'type', ss.type)) 
              FROM schedule_enrollments se 
              JOIN schedule_slots ss ON se.slot_id = ss.id 
              WHERE se.booking_id = b.id) as schedule_details 
      FROM bookings b 
      JOIN users u ON b.user_id = u.id 
      WHERE u.email = 'gabasamarcjeff03@gmail.com' 
      LIMIT 1
    `);
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSchedule();
