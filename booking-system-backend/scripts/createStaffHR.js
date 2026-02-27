const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const createUsers = async () => {
    try {
        const salt = await bcrypt.genSalt(10);

        // HR Manager
        const hrEmail = 'hr@gmail.com';
        const hrPassword = 'hr123';
        const hrHashedPassword = await bcrypt.hash(hrPassword, salt);

        // Check if HR exists
        const hrResult = await pool.query('SELECT * FROM users WHERE email = $1', [hrEmail]);
        if (hrResult.rows.length === 0) {
            await pool.query(
                `INSERT INTO users (first_name, last_name, email, password, role, age, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                ['HR', 'Manager', hrEmail, hrHashedPassword, 'hrm', 30, true]
            );
            console.log('HR Manager user created successfully.');
        } else {
            console.log('HR Manager user already exists. Updating role and verification status...');
            await pool.query('UPDATE users SET role = $1, is_verified = true WHERE email = $2', ['hrm', hrEmail]);
        }

        // Staff
        const staffEmail = 'staff@gmail.com';
        const staffPassword = 'staff123';
        const staffHashedPassword = await bcrypt.hash(staffPassword, salt);

        // Check if Staff exists
        const staffResult = await pool.query('SELECT * FROM users WHERE email = $1', [staffEmail]);
        if (staffResult.rows.length === 0) {
            await pool.query(
                `INSERT INTO users (first_name, last_name, email, password, role, age, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                ['Staff', 'Member', staffEmail, staffHashedPassword, 'staff', 25, true]
            );
            console.log('Staff user created successfully.');
        } else {
            console.log('Staff user already exists. Updating role and verification status...');
            await pool.query('UPDATE users SET role = $1, is_verified = true WHERE email = $2', ['staff', staffEmail]);
        }

    } catch (err) {
        console.error('Error creating users:', err);
    } finally {
        await pool.end();
    }
};

createUsers();
