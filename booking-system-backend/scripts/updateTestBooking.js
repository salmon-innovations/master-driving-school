const pool = require('../config/db');

async function updateBooking() {
    try {
        console.log('Updating booking with payment details...\n');

        await pool.query(`
            UPDATE bookings 
            SET payment_type = 'Full Payment', 
                payment_method = 'GCash'
            WHERE id = 2
        `);

        const result = await pool.query(`
            SELECT id, status, payment_type, payment_method, total_amount 
            FROM bookings 
            WHERE id = 2
        `);

        console.log('✓ Updated booking:');
        console.table(result.rows);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

updateBooking();
