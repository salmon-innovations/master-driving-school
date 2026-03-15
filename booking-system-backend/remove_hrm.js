const pool = require('./config/db');

async function removeHRM() {
    try {
        console.log("Removing all HRM accounts...");
        const result = await pool.query("DELETE FROM users WHERE role = 'hrm'");
        console.log(`Successfully deleted ${result.rowCount} HRM account(s).`);
        process.exit(0);
    } catch (err) {
        console.error("Error deleting HRM accounts:", err);
        process.exit(1);
    }
}

removeHRM();
