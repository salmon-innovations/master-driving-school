const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const verify = async () => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.role,
                    u.branch_id, u.is_verified, b.name as branch_name
             FROM users u
             LEFT JOIN branches b ON u.branch_id = b.id
             WHERE u.email IN ('hr@gmail.com', 'staff@gmail.com')
             ORDER BY u.id`
        );

        if (result.rows.length === 0) {
            console.log('❌ No HR/Staff accounts found!');
            return;
        }

        result.rows.forEach(user => {
            console.log('\n✅ Account verified:');
            console.log(`   ID       : ${user.id}`);
            console.log(`   Name     : ${user.first_name} ${user.last_name}`);
            console.log(`   Email    : ${user.email}`);
            console.log(`   Role     : ${user.role}`);
            console.log(`   Branch   : ${user.branch_name || '❌ NOT ASSIGNED'} (id=${user.branch_id})`);
            console.log(`   Verified : ${user.is_verified ? '✅ Yes' : '❌ No'}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
};

verify();
