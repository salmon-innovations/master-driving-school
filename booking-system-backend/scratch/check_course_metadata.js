const pool = require('../config/db');
async function run() {
    try {
        const res = await pool.query("SELECT * FROM courses WHERE id = 12");
        console.log('Course details:', JSON.stringify(res.rows[0], null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
run();
