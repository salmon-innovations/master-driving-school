const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  user: process.env.DB_USER || 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});
async function add() {
  const manualRes = await pool.query("SELECT * FROM courses WHERE id = 4");
  const m = manualRes.rows[0];
  await pool.query(`
    INSERT INTO courses (name, category, course_type, duration, price, status, description, image_url, pricing_data)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
  `, ['PDC Car Automatic', 'PDC', 'Automatic', m.duration, m.price, 'active', m.description, m.image_url]);
  console.log('Done!');
  await pool.end();
}
add();
