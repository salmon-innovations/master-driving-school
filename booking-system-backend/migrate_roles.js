const pool = require('./config/db');

async function createRolesTable() {
    try {
        console.log('Creating roles table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                display_name VARCHAR(100) NOT NULL,
                description TEXT,
                permissions JSONB DEFAULT '[]',
                is_system BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert initial roles if they don't exist
        const initialRoles = [
            ['admin', 'Administrator', 'Full system access', '["*"]', true],
            ['hrm', 'HR Manager', 'Management of staff and users', '["users.view", "users.edit"]', true],
            ['staff', 'Office Staff', 'General office operations', '["bookings.view", "schedules.view"]', true],
            ['student', 'Student', 'Standard student access', '["profile.view", "bookings.own"]', true],
            ['walkin_student', 'Walk-in Student', 'Student account created by staff', '["profile.view"]', true]
        ];

        for (const [name, display_name, description, permissions, is_system] of initialRoles) {
            await pool.query(
                `INSERT INTO roles (name, display_name, description, permissions, is_system) 
                 VALUES ($1, $2, $3, $4, $5) 
                 ON CONFLICT (name) DO NOTHING`,
                [name, display_name, description, permissions, is_system]
            );
        }

        console.log('Roles table and initial data ready!');
    } catch (err) {
        console.error('Error creating roles table:', err);
    } finally {
        process.exit();
    }
}

createRolesTable();
