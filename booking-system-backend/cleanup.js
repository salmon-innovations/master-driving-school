const pool = require('./config/db');

async function run() {
    try {
        console.log("Removing dummy users, bookings, and all schedule slots/enrollments...");

        // 1. Delete dummy bookings
        await pool.query(`
      DELETE FROM bookings 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE 'juan%@example.com' OR email LIKE 'maria%@example.com'
      )
    `);

        // 2. Delete dummy users
        await pool.query(`
      DELETE FROM users 
      WHERE email LIKE 'juan%@example.com' OR email LIKE 'maria%@example.com'
    `);

        // 3. Delete ALL schedule enrollments and slots
        await pool.query(`TRUNCATE TABLE schedule_enrollments CASCADE`);
        await pool.query(`TRUNCATE TABLE schedule_slots CASCADE`);

        // 4. Reset sequences for slots and enrollments
        await pool.query(`ALTER SEQUENCE schedule_enrollments_id_seq RESTART WITH 1`);
        await pool.query(`ALTER SEQUENCE schedule_slots_id_seq RESTART WITH 1`);

        // 5. Reset sequences for users and bookings based on current max ID
        await pool.query(`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), false)`);
        await pool.query(`SELECT setval('bookings_id_seq', COALESCE((SELECT MAX(id) FROM bookings), 1), false)`);

        console.log("Successfully removed dummy data, cleared schedule slots, and reset ID sequences.");
        process.exit(0);
    } catch (err) {
        console.error("Error cleaning up data:", err);
        process.exit(1);
    }
}

run();
