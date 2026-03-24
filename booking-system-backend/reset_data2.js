require('dotenv').config();
const pool = require('./config/db');

async function reset() {
    try {
        const u = await pool.query("SELECT id FROM users WHERE email = 'gabasamarcjeff03@gmail.com'");
        if (u.rows.length) {
            const uid = u.rows[0].id;
            console.log('Cleaning up user ID:', uid);
            await pool.query('DELETE FROM schedule_enrollments WHERE student_id = $1', [uid]);
            await pool.query('DELETE FROM bookings WHERE user_id = $1', [uid]);
            await pool.query('DELETE FROM testimonials WHERE user_id = $1', [uid]);
            
            if (uid !== 2) {
                await pool.query('DELETE FROM users WHERE id = 2');
                await pool.query("UPDATE users SET id = 2 WHERE email = 'gabasamarcjeff03@gmail.com'");
            }
            console.log('User ID set to 2.');
        } else {
            console.log('User not found.');
        }
        
        await pool.query('UPDATE schedule_slots SET available_slots = total_capacity');
        console.log('Slots reset.');
        
        // Reset sequence (check both possible names or use pg_get_serial_sequence)
        try {
            await pool.query("SELECT setval(pg_get_serial_sequence('users', 'id'), 2, true)");
            console.log('Sequence reset to start next at 3.');
        } catch(seqErr) {
            console.log('Sequence reset failed:', seqErr.message);
        }
        
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
reset();
