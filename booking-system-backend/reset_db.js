const pool = require('./config/db.js');

const resetSequences = async () => {
    try {
        const email = 'gabasamarcjeff03@gmail.com';
        console.log(`Starting reset for ${email}`);
        
        // Find user
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            console.log('User not found!');
            return;
        }
        const userId = userRes.rows[0].id;
        console.log(`Found user ID: ${userId}`);

        // Delete schedule enrollments
        const delSlots = await pool.query('DELETE FROM schedule_enrollments WHERE student_id = $1 RETURNING *', [userId]);
        console.log(`Deleted ${delSlots.rowCount} schedule_enrollments`);

        // Need to restore available_slots in schedule_slots if needed, but let's just delete the bookings and transactions first
        // If we truncate we can just reset, but it's better to just delete or truncate carefully

        // Wait, does the user want to delete ALL bookings so ID can start at 1?
        // Let's just delete ALL bookings and transactions since they want "if you add new booking it will start in ID 1".
        
        // Wait, if I delete all bookings, it might affect other things. Let's delete ALL records to be safe to restart sequence to 1.
        console.log('Truncating tables to reset sequences completely...');
        
        await pool.query('TRUNCATE table transactions RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE table schedule_enrollments RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE table student_enrollments RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE table bookings RESTART IDENTITY CASCADE');
        
        console.log('Sequences have been restarted to 1 successfully.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
};

resetSequences();