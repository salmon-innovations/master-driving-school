const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const assignBranches = async () => {
    try {
        // Get first 2 branches
        const branches = await pool.query('SELECT id, name FROM branches ORDER BY id LIMIT 2');
        if (branches.rows.length === 0) {
            console.log('No branches found in database!');
            return;
        }

        console.log('Available branches:');
        branches.rows.forEach(b => console.log(`  id=${b.id} => ${b.name}`));

        const hrBranchId = branches.rows[0].id;
        const staffBranchId = branches.rows[1] ? branches.rows[1].id : branches.rows[0].id;

        // Assign branch to HR Manager
        const hrResult = await pool.query(
            'UPDATE users SET branch_id = $1 WHERE email = $2 RETURNING email, branch_id',
            [hrBranchId, 'hr@gmail.com']
        );
        console.log(`HR assigned branch_id=${hrBranchId}:`, hrResult.rows[0] || 'user not found');

        // Assign branch to Staff
        const staffResult = await pool.query(
            'UPDATE users SET branch_id = $1 WHERE email = $2 RETURNING email, branch_id',
            [staffBranchId, 'staff@gmail.com']
        );
        console.log(`Staff assigned branch_id=${staffBranchId}:`, staffResult.rows[0] || 'user not found');

    } catch (err) {
        console.error('Error assigning branches:', err);
    } finally {
        await pool.end();
    }
};

assignBranches();
