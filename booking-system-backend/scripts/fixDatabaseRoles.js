const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function addRoleConstraint() {
  try {
    console.log('Adding role constraint...');
    
    // First, update any invalid roles to 'student' to avoid violation
    await pool.query("UPDATE users SET role = 'student' WHERE role NOT IN ('admin', 'staff', 'student')");
    
    // Drop the constraint if it exists (to avoid errors on re-run)
    try {
        await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role");
    } catch (e) {
        // Ignore if not exists (though IF EXISTS handles it)
    }

    // Add the constraint
    await pool.query("ALTER TABLE users ADD CONSTRAINT check_user_role CHECK (role IN ('admin', 'staff', 'student'))");
    
    console.log('Role constraint added successfully: admin, staff, student');
  } catch (err) {
    console.error('Error adding constraint:', err);
  } finally {
    await pool.end();
  }
}

addRoleConstraint();
