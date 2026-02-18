const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
}); 

const resetUserIds = async () => {
  try {
    console.log('Connecting to database...');
    
    // Get the starting ID from command line argument or use default
    const startId = process.argv[2] ? parseInt(process.argv[2]) : null;
    
    if (startId) {
      // Use specified starting ID
      console.log(`Resetting sequence to start from ID: ${startId}`);
      await pool.query(`SELECT setval('users_id_seq', $1, false)`, [startId]);
      console.log(`User ID sequence reset successfully. Next ID will be: ${startId}`);
    } else {
      // Auto-detect from maximum ID
      const maxIdResult = await pool.query('SELECT MAX(id) as max_id FROM users');
      const maxId = maxIdResult.rows[0].max_id || 0;
      
      console.log(`Current maximum user ID: ${maxId}`);
      
      // Reset the sequence to the next value after the maximum ID
      const nextId = maxId + 1;
      await pool.query(`SELECT setval('users_id_seq', $1, false)`, [nextId]);
      
      console.log(`User ID sequence reset successfully. Next ID will be: ${nextId}`);
    }
    
    // Verify the reset
    const verifyResult = await pool.query(`SELECT last_value FROM users_id_seq`);
    console.log(`Verified - Current sequence value: ${verifyResult.rows[0].last_value}`);
    
  } catch (err) {
    console.error('Error resetting user IDs:', err);
  } finally {
    await pool.end();
  }
};

resetUserIds();
