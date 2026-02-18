const pool = require('./config/db');

async function listTables() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', res.rows.map(r => r.table_name));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

listTables();
