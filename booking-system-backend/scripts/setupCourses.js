const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const setupCourses = async () => {
  try {
    console.log('🔧 Setting up courses table...\n');
    
    // Step 1: Add status column if it doesn't exist
    console.log('1️⃣ Adding status column...');
    await pool.query(`
      ALTER TABLE courses 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'
    `);
    console.log('✅ Column added successfully\n');
    
    // Step 2: Update any existing NULL values
    console.log('2️⃣ Updating NULL values...');
    await pool.query(`UPDATE courses SET status = 'active' WHERE status IS NULL`);
    console.log('✅ NULL values updated\n');
    
    // Step 3: Delete all existing courses
    console.log('3️⃣ Deleting all existing courses...');
    const deleteResult = await pool.query('DELETE FROM courses');
    console.log(`✅ Deleted ${deleteResult.rowCount} course(s)\n`);
    
    // Step 4: Reset the sequence to start from 1
    console.log('4️⃣ Resetting courses ID sequence to start from 1...');
    await pool.query(`SELECT setval('courses_id_seq', 1, false)`);
    console.log('✅ Course ID sequence reset successfully. Next ID will be: 1\n');
    
    // Step 5: Verify the setup
    const verifyResult = await pool.query(`SELECT last_value FROM courses_id_seq`);
    console.log(`✅ Verified - Current sequence value: ${verifyResult.rows[0].last_value}\n`);
    
    // Step 6: Check table structure
    const structureResult = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'courses' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Courses table structure:');
    console.table(structureResult.rows);
    
    // Step 7: Check remaining courses
    const countResult = await pool.query('SELECT COUNT(*) FROM courses');
    console.log(`\n📊 Total courses in database: ${countResult.rows[0].count}`);
    
    console.log('\n✨ Course setup complete! Ready to add courses from the admin panel.');
    
  } catch (err) {
    console.error('❌ Error setting up courses:', err);
  } finally {
    await pool.end();
  }
};

setupCourses();
