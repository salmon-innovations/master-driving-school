const pool = require('./config/db'); async function test() {
    const c1 = await pool.query("SELECT id, name, category, course_type FROM courses");
    console.log(c1.rows);
    process.exit();
}
test();
