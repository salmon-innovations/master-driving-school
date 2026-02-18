const pool = require('../config/db');

async function checkExistingData() {
    try {
        console.log('Checking existing data...\n');

        // Check users
        const users = await pool.query('SELECT id, email, role FROM users LIMIT 5');
        console.log('Users:');
        console.table(users.rows);

        // Check courses
        const courses = await pool.query('SELECT id, name FROM courses LIMIT 5');
        console.log('\nCourses:');
        console.table(courses.rows);

        // Check branches
        const branches = await pool.query('SELECT id, name FROM branches LIMIT 5');
        console.log('\nBranches:');
        console.table(branches.rows);

        // If any is empty, provide guidance
        if (users.rows.length === 0) {
            console.log('\n⚠️ No users found. You need to create a user first.');
        }
        if (courses.rows.length === 0) {
            console.log('\n⚠️ No courses found. You need to create a course first.');
        }
        if (branches.rows.length === 0) {
            console.log('\n⚠️ No branches found. You need to create a branch first.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkExistingData();
