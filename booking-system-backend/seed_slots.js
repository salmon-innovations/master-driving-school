const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgres://postgres:postgres@localhost:5432/booking_system_db'
});

async function seed() {
    try {
        const types = ['Whole Day', 'Morning', 'Afternoon'];
        const times = ['08:00 AM - 05:00 PM', '08:00 AM - 12:00 PM', '01:00 PM - 05:00 PM'];

        // Seed slots for the rest of the current month
        for (let i = 1; i < 20; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);

            // Skip Sundays
            if (d.getDay() === 0) continue;

            const dStr = d.toISOString().split('T')[0];

            // Insert a slot for each time session
            for (let j = 0; j < 3; j++) {
                await pool.query(
                    `INSERT INTO schedule_slots 
                (date, end_date, type, session, time_range, total_capacity, available_slots, branch_id, course_type, transmission) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [dStr, dStr, 'pdc', types[j], times[j], 15, 15, 1, 'both', 'both']
                );
            }
        }
        console.log('Successfully seeded PDC slots into the database!');
    } catch (e) {
        console.error('Error seeding slots:', e);
    } finally {
        process.exit(0);
    }
}

seed();
