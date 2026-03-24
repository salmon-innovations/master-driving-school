const pool = require('./config/db'); async function test() {
    const c1 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'courses'");
    console.log('courses cols:', c1.rows.map(r=>r.column_name));
    const c2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'schedule_slots'");
    console.log('slots cols:', c2.rows.map(r=>r.column_name));
    process.exit();
}
test();
