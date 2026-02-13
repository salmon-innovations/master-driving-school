const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addCategoryAndType() {
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
    
    // Add category column
    console.log('➕ Adding category column...');
    await client.query(`
      ALTER TABLE courses 
      ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Basic'
    `);
    console.log('✅ category column added\n');
    
    // Add course_type column
    console.log('➕ Adding course_type column...');
    await client.query(`
      ALTER TABLE courses 
      ADD COLUMN IF NOT EXISTS course_type VARCHAR(50)
    `);
    console.log('✅ course_type column added\n');
    
    // Add check constraint
    console.log('➕ Adding category check constraint...');
    await client.query(`
      ALTER TABLE courses 
      DROP CONSTRAINT IF EXISTS courses_category_check
    `);
    await client.query(`
      ALTER TABLE courses 
      ADD CONSTRAINT courses_category_check 
      CHECK (category IN ('TDC', 'PDC', 'Basic'))
    `);
    console.log('✅ Check constraint added\n');
    
    // Verify final structure
    console.log('✅ Verifying final table structure...\n');
    const finalColumns = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'courses'
      ORDER BY ordinal_position
    `);
    
    console.log('Final columns:');
    finalColumns.rows.forEach(col => {
      const defaultVal = col.column_default ? ` [default: ${col.column_default}]` : '';
      console.log(`  ✓ ${col.column_name} (${col.data_type})${defaultVal}`);
    });
    console.log('');
    
    console.log('✅ Migration completed successfully!');
    console.log('📋 Total columns:', finalColumns.rows.length);
    console.log('');
    console.log('📝 Category values: TDC, PDC, Basic');
    console.log('📝 Course types:');
    console.log('   - TDC: Online, F2F');
    console.log('   - PDC: Automatic, Manual');
    console.log('   - Basic: (no type needed)');
    
  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addCategoryAndType()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
