const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function removeColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking current courses table structure...\n');
    
    // Check current columns
    const currentColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'courses'
      ORDER BY ordinal_position
    `);
    
    console.log('Current columns:');
    currentColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    console.log('');
    
    // Remove course_type column
    console.log('🗑️  Removing course_type column...');
    await client.query('ALTER TABLE courses DROP COLUMN IF EXISTS course_type');
    console.log('✅ course_type column removed\n');
    
    // Remove pricing_data column
    console.log('🗑️  Removing pricing_data column...');
    await client.query('ALTER TABLE courses DROP COLUMN IF EXISTS pricing_data');
    console.log('✅ pricing_data column removed\n');
    
    // Verify final structure
    console.log('✅ Verifying final table structure...\n');
    const finalColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'courses'
      ORDER BY ordinal_position
    `);
    
    console.log('Final columns:');
    finalColumns.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });
    console.log('');
    
    console.log('✅ Migration completed successfully!');
    console.log('📋 Remaining columns:', finalColumns.rows.length);
    
  } catch (error) {
    console.error('❌ Error removing columns:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

removeColumns()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
