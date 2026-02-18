const pool = require('../config/db');

async function addTestBooking() {
    try {
        console.log('Adding test booking...');

        // Insert a test booking
        const result = await pool.query(`
            INSERT INTO bookings (
                user_id, 
                course_id, 
                branch_id, 
                booking_date, 
                booking_time, 
                status, 
                notes, 
                total_amount,
                created_at,
                updated_at
            ) VALUES (
                2,
                2,
                1,
                '2026-02-15',
                '08:00:00',
                'Collectable',
                'Test booking for development',
                2500.00,
                NOW(),
                NOW()
            ) RETURNING *
        `);

        console.log('✓ Test booking added successfully!');
        console.log('Booking ID:', result.rows[0].id);
        console.log('Status:', result.rows[0].status);
        console.log('Date:', result.rows[0].booking_date);
        console.log('Amount:', result.rows[0].total_amount);

        // Display the booking details
        const bookings = await pool.query('SELECT * FROM bookings ORDER BY id DESC LIMIT 1');
        console.log('\nLatest booking:');
        console.log(bookings.rows[0]);

        process.exit(0);
    } catch (error) {
        console.error('Error adding test booking:', error.message);
        process.exit(1);
    }
}

addTestBooking();
