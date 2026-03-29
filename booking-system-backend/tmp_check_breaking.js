const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'booking_system_db',
  password: 'admin123',
  port: 5432,
});

async function checkBooking() {
  try {
    const res = await pool.query(`
      SELECT b.id, b.notes, b.total_amount, c.price as course_price
      FROM bookings b 
      JOIN users u ON b.user_id = u.id 
      JOIN courses c ON b.course_id = c.id 
      WHERE u.email = 'gabasamarcjeff03@gmail.com' 
      ORDER BY b.created_at DESC 
      LIMIT 1
    `);
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkBooking();
