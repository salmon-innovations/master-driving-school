const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
  try {
    const client = await pool.connect();
    
    console.log('--- BRANCHES ---');
    const branches = await client.query('SELECT id, name FROM branches');
    console.table(branches.rows);

    console.log('\n--- SCHEDULE SLOTS ---');
    const schedules = await client.query(`
      SELECT s.id, s.date, s.type, s.session, s.course_type, s.transmission, s.total_capacity, s.available_slots, b.name as branch
      FROM schedule_slots s
      JOIN branches b ON s.branch_id = b.id
      WHERE s.date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY s.date DESC LIMIT 50
    `);
    console.table(schedules.rows);

    client.release();
  } catch(e) {
    console.error('Error: ' + e.message);
  } finally {
    pool.end();
  }
}
run();
