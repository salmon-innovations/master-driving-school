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
  const email = 'gabasamarcjeff03@gmail.com';
  let output = '';
  
  try {
    const client = await pool.connect();
    // find user
    const users = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (users.rowCount === 0) {
        output += 'User not found.\n';
        fs.writeFileSync('db_action.txt', output);
        client.release();
        return;
    }
    const userId = users.rows[0].id;
    
    // bookings
    const bookings = await client.query('SELECT id FROM bookings WHERE user_id = $1', [userId]);
    output += `Found ${bookings.rowCount} bookings.\n`;
    
    if (bookings.rowCount > 0) {
        const bookingIds = bookings.rows.map(b => b.id);
        
        try {
            const tr = await client.query('DELETE FROM transactions WHERE booking_id = ANY($1::int[])', [bookingIds]);
            output += `Deleted ${tr.rowCount} from transactions.\n`;
        } catch(e) { output += `Transactions error: ${e.message}\n`; }
        
        try {
            const p = await client.query('DELETE FROM payments WHERE booking_id = ANY($1::int[])', [bookingIds]);
            output += `Deleted ${p.rowCount} from payments.\n`;
        } catch(e) { output += `Payments error: ${e.message}\n`; }

        try {
            const sRes = await client.query('DELETE FROM schedule_enrollments WHERE student_id = $1 RETURNING slot_id', [userId]);
            output += `Deleted ${sRes.rowCount} from schedule_enrollments.\n`;
            if (sRes.rowCount > 0) {
                for (let sid of sRes.rows.map(r=>r.slot_id)) {
                    await client.query('UPDATE schedule_slots SET available_slots = available_slots + 1 WHERE id = $1', [sid]);
                }
            }
        } catch(e) { output += `Schedule enrollments error: ${e.message}\n`; }
        
        try {
            const bRes = await client.query('DELETE FROM bookings WHERE id = ANY($1::int[])', [bookingIds]);
            output += `Deleted ${bRes.rowCount} from bookings.\n`;
        } catch(e) { output += `Bookings error: ${e.message}\n`; }
    }
    
    // Delete items in cart just to be thorough
    try {
        await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
    } catch(e) { }
    
    // RESET SEQUENCES!
    const seqs = ['bookings_id_seq', 'transactions_id_seq', 'schedule_enrollments_id_seq'];
    for (let seq of seqs) {
        try {
            const table = seq.replace('_id_seq', '');
            await client.query(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 1), false)`);
            output += `Reset ${seq}\n`;
        } catch(e) {
            output += `${seq} error: ${e.message}\n`;
        }
    }
    
    fs.writeFileSync('db_action.txt', output);
    client.release();
  } catch(e) {
    fs.writeFileSync('db_action.txt', 'Global Error: ' + e.message);
  } finally {
    pool.end();
  }
}
run();
