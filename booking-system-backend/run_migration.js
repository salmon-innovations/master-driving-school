const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

const runMigration = async () => {
    try {
        const sqlPath = path.join(__dirname, 'migrations', 'add_end_date_to_schedule.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration...');
        await pool.query(sql);
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        pool.end();
    }
};

runMigration();
