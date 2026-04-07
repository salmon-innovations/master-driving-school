const pool = require('./config/db');

function parseEmailArg() {
    const args = process.argv.slice(2);
    if (!args.length) return null;

    // Supports:
    // node cleanup_test_user.js user@example.com
    // node cleanup_test_user.js --email=user@example.com
    // node cleanup_test_user.js --email user@example.com
    const direct = args.find((arg) => !arg.startsWith('-'));
    const emailFlagEq = args.find((arg) => arg.startsWith('--email='));
    const emailFlagIndex = args.findIndex((arg) => arg === '--email' || arg === '-e');

    if (emailFlagEq) return emailFlagEq.split('=').slice(1).join('=').trim();
    if (emailFlagIndex >= 0 && args[emailFlagIndex + 1]) return String(args[emailFlagIndex + 1]).trim();
    if (direct) return String(direct).trim();

    return null;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function cleanupUser() {
    const email = parseEmailArg();

    if (!email) {
        console.log('Usage: node cleanup_test_user.js <email>');
        console.log('   or: node cleanup_test_user.js --email=<email>');
        console.log('   or: node cleanup_test_user.js --email <email>');
        process.exit(1);
    }

    if (!isValidEmail(email)) {
        console.log(`❌ Invalid email format: ${email}`);
        process.exit(1);
    }

    try {
        console.log(`🧹 Starting data cleanup for: ${email} (Account will be kept)`);

        // 1. Get user ID
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            console.log('❌ User not found in database.');
            return;
        }
        const userId = userRes.rows[0].id;

        // 2. Delete transactions
        const tranRes = await pool.query('DELETE FROM transactions WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = $1)', [userId]);
        console.log(`✅ Deleted ${tranRes.rowCount} transactions.`);

        // 3. Delete schedule enrollments
        const enrollRes = await pool.query('DELETE FROM schedule_enrollments WHERE student_id = $1', [userId]);
        console.log(`✅ Deleted ${enrollRes.rowCount} schedule enrollments.`);

        // 4. Delete bookings
        const bookRes = await pool.query('DELETE FROM bookings WHERE user_id = $1', [userId]);
        console.log(`✅ Deleted ${bookRes.rowCount} bookings.`);

        // 5. Reset ALL slots to 15
        await pool.query('UPDATE schedule_slots SET available_slots = 15');
        console.log('✅ All available_slots reset to 15.');

        // 6. Reset table sequences
        const tables = ['bookings', 'transactions', 'schedule_enrollments'];
        for (const table of tables) {
            const maxIdRes = await pool.query(`SELECT MAX(id) as max_id FROM ${table}`);
            const nextId = (maxIdRes.rows[0].max_id || 0) + 1;
            await pool.query(`SELECT setval('${table}_id_seq', ${nextId}, false)`);
            console.log(`🔄 Sequence for ${table} reset to ${nextId}.`);
        }

        console.log(`✨ Cleanup complete! Account ${email} is ready for re-enrollment.`);
    } catch (err) {
        console.error('❌ Cleanup error:', err);
    } finally {
        process.exit();
    }
}

cleanupUser();
