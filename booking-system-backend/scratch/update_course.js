const pool = require('../config/db');
async function run() {
    try {
        const updateRes = await pool.query(
            "UPDATE courses SET name = 'OTDC + 4 PDC' WHERE id = 12 AND name = 'OTDC + 4 PDC (Bundle)'"
        );
        console.log('Update result:', updateRes.rowCount, 'row(s) affected');

        const verifyRes = await pool.query("SELECT id, name FROM courses WHERE id = 12");
        console.log('Verification:', JSON.stringify(verifyRes.rows[0], null, 2));
    } catch (err) {
        console.error('Error updating course:', err);
    } finally {
        process.exit();
    }
}
run();
