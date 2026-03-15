const pool = require('./config/db');

async function removeHRMConstraint() {
    try {
        console.log("Updating role constraint to remove HRM...");
        await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
        await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff', 'student', 'walkin_student'))`);

        // update comment as well
        await pool.query(`COMMENT ON COLUMN users.role IS 'User role: admin, staff, student, or walkin_student'`);
        await pool.query(`COMMENT ON COLUMN users.branch_id IS 'Foreign key to branches table for admin/staff users'`);

        console.log("Successfully updated constraint and comments.");
        process.exit(0);
    } catch (err) {
        console.error("Error updating constraint:", err);
        process.exit(1);
    }
}

removeHRMConstraint();
