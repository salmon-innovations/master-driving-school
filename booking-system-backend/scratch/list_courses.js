const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  user: process.env.DB_USER || 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});
async function list() {
  const res = await pool.query("SELECT id, name, course_type, category FROM courses ORDER BY category, id");
  console.table(res.rows);
  await pool.end();
}
list();
