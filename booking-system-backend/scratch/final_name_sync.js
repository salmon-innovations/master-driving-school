const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  user: process.env.DB_USER || 'postgres', host: 'localhost', database: 'booking_system_db', password: 'admin123', port: 5432,
});
async function sync() {
  // Sync Tricycle
  await pool.query("UPDATE courses SET name = 'PDC A1-Tricycle' WHERE id = 5");
  // Sync Van
  await pool.query("UPDATE courses SET name = 'PDC B1-Van/B2-L300' WHERE id = 6");
  console.log('Final sync complete!');
  await pool.end();
}
sync();
