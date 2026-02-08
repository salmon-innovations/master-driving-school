const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config(); // looks for .env in current working directory

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const setupAdmin = async () => {
  try {
    console.log('Connecting to database...');
    
    // 1. Add role column if not exists
    console.log('Checking for role column...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'student';
    `);
    console.log('Role column verified.');

    // 2. Check/Create Admin User
    const adminEmail = 'admin@gmail.com';
    const adminPassword = 'admin123';
    
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    
    if (userResult.rows.length === 0) {
      console.log('Admin user not found. Creating...');
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      // Insert with minimal required fields based on schema
      // firstname, lastname, email, password are NOT NULL
      await pool.query(
        `INSERT INTO users (
          first_name, 
          last_name, 
          email, 
          password, 
          role,
          age
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Admin', 'User', adminEmail, hashedPassword, 'admin', 30] // Added age as some logic might require it, though DB says integer
      );
      
      console.log('Admin user created successfully.');
    } else {
        console.log('Admin user already exists. Updating role to admin...');
        await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', adminEmail]);
        // Optional: Update password if needed, but safer to skip to avoid overwriting user changed pswd
        console.log('Admin role ensured.');
    }

  } catch (err) {
    console.error('Error setting up admin:', err);
  } finally {
    await pool.end();
  }
};

setupAdmin();
