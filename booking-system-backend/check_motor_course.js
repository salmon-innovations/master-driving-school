const pool = require('./config/db');

async function checkMotorCourseType() {
    try {
        const res = await pool.query(`
            SELECT id, name, category, course_type, pricing_data
            FROM courses 
            WHERE name ILIKE '%Motorcycle%' OR name ILIKE '%TC%'
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkMotorCourseType();
