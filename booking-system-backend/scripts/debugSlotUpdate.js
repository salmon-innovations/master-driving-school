const pool = require('../config/db');

async function debugSlotUpdate() {
    try {
        console.log('Testing slot update...\n');

        // Check if slot 1 exists
        const checkSlot = await pool.query('SELECT * FROM schedule_slots WHERE id = 1');
        console.log('Slot 1 data:');
        console.table(checkSlot.rows);

        if (checkSlot.rows.length === 0) {
            console.log('\n❌ Slot ID 1 does not exist!');
            process.exit(0);
        }

        // Try updating slot 1 with sample data
        const testUpdate = await pool.query(
            `UPDATE schedule_slots 
             SET type = $1, session = $2, time_range = $3, total_capacity = $4, available_slots = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            ['tdc', 'Whole Day', '08:00 AM - 05:00 PM', 15, 15, 1]
        );

        console.log('\n✓ Update successful!');
        console.log('Updated slot:');
        console.table(testUpdate.rows);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

debugSlotUpdate();
