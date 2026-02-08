const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const verifyAdmin = async () => {
  try {
    const adminEmail = 'admin@gmail.com';
    console.log(`Verifying email for ${adminEmail}...`);
    
    const result = await pool.query(
      'UPDATE users SET is_verified = TRUE, verification_code = NULL, verification_code_expires = NULL WHERE email = $1 RETURNING *',
      [adminEmail]
    );

    if (result.rowCount > 0) {
      console.log('Admin email verified successfully.');
    } else {
      console.log('Admin user not found.');
    }

  } catch (err) {
    console.error('Error verifying admin:', err);
  } finally {
    await pool.end();
  }
};

verifyAdmin();
