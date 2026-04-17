const pool = require('../config/db');
async function run() {
    try {
        const res = await pool.query("SELECT id, name FROM courses WHERE name LIKE '%OTDC + 4 PDC%'");
        console.log('Courses found:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
run();
