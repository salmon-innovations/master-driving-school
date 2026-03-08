const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

const runMigration = async () => {
    try {
        const migrationFile = process.argv[2];
        if (!migrationFile) {
            console.error('Please provide a migration file name as an argument.');
            process.exit(1);
        }

        const sqlPath = path.join(__dirname, 'migrations', migrationFile);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Running migration: ${migrationFile}...`);
        await pool.query(sql);
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        pool.end();
    }
};

runMigration();
