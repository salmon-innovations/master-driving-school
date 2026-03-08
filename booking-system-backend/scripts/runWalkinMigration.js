const pool = require('../config/db');

async function runMigration() {
    try {
        console.log('Running walk-in student role migration...');

        // 1. Drop existing role constraint and add new one with walkin_student
        await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
        console.log('✅ Dropped old role constraint');

        await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff', 'student', 'walkin_student'))`);
        console.log('✅ Added new role constraint with walkin_student');

        // 2. Add enrollment_type column to bookings if not exists
        await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS enrollment_type VARCHAR(20) DEFAULT 'online'`);
        console.log('✅ Added enrollment_type column');

        // 3. Add course_type column to bookings if not exists
        await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS course_type VARCHAR(50)`);
        console.log('✅ Added course_type column');

        // 4. Add enrolled_by column to bookings if not exists
        await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS enrolled_by VARCHAR(255)`);
        console.log('✅ Added enrolled_by column');

        console.log('\n🎉 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
