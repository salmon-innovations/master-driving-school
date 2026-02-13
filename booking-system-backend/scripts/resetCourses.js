const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const resetCourses = async () => {
  try {
    console.log('Connecting to database...');
    
    // Delete all courses
    console.log('Deleting all courses...');
    const deleteResult = await pool.query('DELETE FROM courses');
    console.log(`✅ Deleted ${deleteResult.rowCount} course(s)`);
    
    // Reset the sequence to start from 1
    console.log('Resetting courses ID sequence to start from 1...');
    await pool.query(`SELECT setval('courses_id_seq', 1, false)`);
    console.log('✅ Course ID sequence reset successfully. Next ID will be: 1');
    
    // Verify the reset
    const verifyResult = await pool.query(`SELECT last_value FROM courses_id_seq`);
    console.log(`✅ Verified - Current sequence value: ${verifyResult.rows[0].last_value}`);
    
    // Check remaining courses
    const countResult = await pool.query('SELECT COUNT(*) FROM courses');
    console.log(`\n📊 Total courses in database: ${countResult.rows[0].count}`);
    
    console.log('\n✨ Courses reset complete!');
    
  } catch (err) {
    console.error('❌ Error resetting courses:', err);
  } finally {
    await pool.end();
  }
};

resetCourses();
