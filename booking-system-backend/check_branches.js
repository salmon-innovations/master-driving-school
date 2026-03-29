const pool = require('./config/db');

async function checkBranches() {
    try {
        const res = await pool.query(`SELECT id, name FROM branches`);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkBranches();
