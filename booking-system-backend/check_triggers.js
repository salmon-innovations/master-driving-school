const pool = require('./config/db');
async function checkTriggers() {
    try {
        const res = await pool.query("SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers");
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkTriggers();
