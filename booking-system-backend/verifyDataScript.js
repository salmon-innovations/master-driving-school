const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');

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
    
    const email = 'gabasamarcjeff03@gmail.com';
    const userRes = await client.query('SELECT id, email FROM users WHERE email = $1', [email]);
    let output = '';
    
    if (userRes.rowCount === 0) {
        output += 'User not found\n';
    } else {
        const uid = userRes.rows[0].id;
        output += `User ID: ${uid}\n`;
        const bRes = await client.query('SELECT COUNT(*) FROM bookings WHERE user_id = $1', [uid]);
        output += `Bookings count: ${bRes.rows[0].count}\n`;
        
        const sRes = await client.query('SELECT COUNT(*) FROM schedule_enrollments WHERE student_id = $1', [uid]);
        output += `Schedule enrollments count: ${sRes.rows[0].count}\n`;
    }
    
    // Check sequences
    const seqs = ['bookings_id_seq', 'payments_id_seq', 'schedule_enrollments_id_seq'];
    for (let seq of seqs) {
        try {
            const res = await client.query(`SELECT last_value FROM ${seq}`);
            output += `${seq} current value: ${res.rows[0].last_value}\n`;
        } catch(e) {
            output += `${seq} error: ${e.message}\n`;
        }
    }
    
    fs.writeFileSync('db_status.txt', output);
    console.log('Done!');
    client.release();
  } catch(e) {
    fs.writeFileSync('db_status.txt', 'Error: ' + e.message);
  } finally {
    pool.end();
  }
}
run();
