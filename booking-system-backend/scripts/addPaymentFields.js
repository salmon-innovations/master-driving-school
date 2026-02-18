const pool = require('../config/db');

async function addPaymentFields() {
    try {
        console.log('Adding payment fields to bookings table...\n');

        // Add payment_type column
        await pool.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'Full Payment'
        `);
        console.log('✓ Added payment_type column');

        // Add payment_method column
        await pool.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Online Payment'
        `);
        console.log('✓ Added payment_method column');

        // Check the updated schema
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' 
            AND column_name IN ('payment_type', 'payment_method')
        `);

        console.log('\nNew columns added:');
        console.table(result.rows);

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        process.exit(1);
    }
}

addPaymentFields();
