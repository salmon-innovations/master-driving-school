const pool = require('./config/db'); async function test() {
    try {
        const userId = 2; // gabasamarcjeff03@gmail.com
        const branchId = 1;
        const courseId = 2; // TDC
        const enrol = await pool.query(
            "INSERT INTO bookings (user_id, course_id, branch_id, booking_date, status, created_at, total_amount, payment_type) 
            VALUES ($1, $2, $3, '2026-03-15', 'completed', NOW(), 1500, 'Full Payment') RETURNING id",
            [userId, courseId, branchId]
        );
        const bookingId = enrol.rows[0].id;
        console.log('Created booking', bookingId);
        
        const slot = await pool.query(
            "INSERT INTO schedule_slots 
            (date, end_date, available_slots, total_capacity, branch_id, type, session, time_range, course_type, created_at, updated_at) 
            VALUES ('2026-03-15', '2026-03-16', 10, 10, $1, 'tdc', 'Morning', '08:00 AM - 12:00 PM', 'F2F', NOW(), NOW()) 
            RETURNING id",
            [branchId]
        );
        const slotId = slot.rows[0].id;
        console.log('Created slot', slotId);

        await pool.query(
            "INSERT INTO schedule_enrollments (student_id, slot_id, enrollment_status, enrolled_at, created_at) 
            VALUES ($1, $2, 'completed', NOW(), NOW())",
            [userId, slotId]
        );
        console.log('Done mapping.');
        process.exit();
    } catch(e) { console.error('error', e); process.exit();}
}
test();
