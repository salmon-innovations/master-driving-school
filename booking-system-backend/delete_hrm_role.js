const pool = require('./config/db');

async function removeHRMRole() {
    try {
        console.log("Searching for 'hrm' in roles table...");

        // Check if table roles exists first
        const tableExists = await pool.query(`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE  table_schema = 'public'
        AND    table_name   = 'roles'
        );`);

        if (tableExists.rows[0].exists) {
            const result = await pool.query("DELETE FROM roles WHERE name = 'hrm' RETURNING *");
            console.log(`Deleted ${result.rowCount} HRM role(s).`, result.rows);
        } else {
            console.log("Roles table doesn't exist.");
        }

        process.exit(0);
    } catch (err) {
        console.error("Error deleting HRM role:", err);
        process.exit(1);
    }
}

removeHRMRole();
