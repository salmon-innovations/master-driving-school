const pool = require('../config/db');

async function addTestBookings() {
    try {
        console.log('Adding test bookings...\n');

        // Test 1: Full Payment booking (should be auto-set to 'paid')
        const fullPayment = await pool.query(`
            INSERT INTO bookings (
                user_id, course_id, branch_id, booking_date, booking_time,
                status, notes, total_amount, payment_type, payment_method,
                created_at, updated_at
            ) VALUES (
                2, 3, 2, '2026-02-20', '10:00:00',
                'paid', 'Test Full Payment', 5000.00, 'Full Payment', 'GCash',
                NOW(), NOW()
            ) RETURNING id, status, payment_type, total_amount
        `);

        console.log('✓ Full Payment booking added:');
        console.table(fullPayment.rows);

        // Test 2: Down Payment booking (should be 'collectable')
        const downPayment = await pool.query(`
            INSERT INTO bookings (
                user_id, course_id, branch_id, booking_date, booking_time,
                status, notes, total_amount, payment_type, payment_method,
                created_at, updated_at
            ) VALUES (
                2, 2, 3, '2026-02-22', '14:00:00',
                'collectable', 'Test Down Payment', 3000.00, 'Down Payment', 'StarPay',
                NOW(), NOW()
            ) RETURNING id, status, payment_type, total_amount
        `);

        console.log('\n✓ Down Payment booking added:');
        console.table(downPayment.rows);

        // Show all bookings
        const allBookings = await pool.query(`
            SELECT id, status, payment_type, payment_method, total_amount 
            FROM bookings 
            ORDER BY id DESC 
            LIMIT 5
        `);

        console.log('\n📋 Recent bookings:');
        console.table(allBookings.rows);

        console.log('\n✅ Test bookings added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

addTestBookings();
