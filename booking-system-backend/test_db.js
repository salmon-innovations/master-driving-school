const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});
async function listCourses() {
    try {
        const res = await pool.query('SELECT id, name, category, pricing_data, course_type FROM courses;');
        fs.writeFileSync('courses_out.json', JSON.stringify(res.rows, null, 2), 'utf8');
    } catch (e) { console.error('Error:', e.message); }
    pool.end();
}
listCourses();
