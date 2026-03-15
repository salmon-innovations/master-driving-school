const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://postgres:admin123@localhost:5432/booking_system_db'
});

async function run() {
    await client.connect();

    try {
        console.log('--- Checking users ---');
        const u = await client.query("SELECT id, email FROM users WHERE email ILIKE '%dummy%'");
        console.log(u.rows);

        console.log('--- Deleting dummy users and cascading bookings/enrollments ---');
        // Cascading or manually deleting bookings
        for (const user of u.rows) {
            await client.query("DELETE FROM bookings WHERE user_id = $1", [user.id]);
            await client.query("DELETE FROM schedule_enrollments WHERE student_id = $1", [user.id]);
            await client.query("DELETE FROM users WHERE id = $1", [user.id]);
        }

        console.log('--- Resetting Users Sequence ---');
        const maxUser = await client.query("SELECT MAX(id) FROM users");
        const nextUserId = (maxUser.rows[0].max || 0) + 1;
        await client.query(`ALTER SEQUENCE users_id_seq RESTART WITH ${nextUserId}`);

        console.log('--- Resetting Bookings Sequence ---');
        const maxBooking = await client.query("SELECT MAX(id) FROM bookings");
        const nextBookingId = (maxBooking.rows[0].max || 0) + 1;
        await client.query(`ALTER SEQUENCE bookings_id_seq RESTART WITH ${nextBookingId}`);

        console.log('--- Resetting Schedule Enrollments Sequence ---');
        const maxEnrollment = await client.query("SELECT MAX(id) FROM schedule_enrollments");
        const nextEnrollmentId = (maxEnrollment.rows[0].max || 0) + 1;
        await client.query(`ALTER SEQUENCE schedule_enrollments_id_seq RESTART WITH ${nextEnrollmentId}`);

        console.log('--- Resetting Schedule Slots Sequence ---');
        const maxSlot = await client.query("SELECT MAX(id) FROM schedule_slots");
        const nextSlotId = (maxSlot.rows[0].max || 0) + 1;
        await client.query(`ALTER SEQUENCE schedule_slots_id_seq RESTART WITH ${nextSlotId}`);

        console.log('All dummy data removed and sequences reset!');

    } catch (e) { console.error(e) }
    await client.end();
}
run();
