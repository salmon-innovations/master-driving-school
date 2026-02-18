const pool = require('../config/db');

async function autoUpdateFullPayments() {
    try {
        console.log('Auto-updating Full Payment bookings to Paid status...\n');

        const result = await pool.query(`
            UPDATE bookings 
            SET status = 'paid'
            WHERE payment_type = 'Full Payment' 
            AND LOWER(status) = 'collectable'
            RETURNING id, status, payment_type
        `);

        if (result.rows.length > 0) {
            console.log(`✓ Updated ${result.rows.length} booking(s):`);
            console.table(result.rows);
        } else {
            console.log('No bookings needed updating.');
        }

        console.log('\n✅ Auto-update completed!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

autoUpdateFullPayments();
