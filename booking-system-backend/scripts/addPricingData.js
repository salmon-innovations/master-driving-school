const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addPricingData() {
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
    
    // Add pricing_data column
    console.log('➕ Adding pricing_data column...');
    await client.query(`
      ALTER TABLE courses 
      ADD COLUMN IF NOT EXISTS pricing_data JSONB
    `);
    console.log('✅ pricing_data column added\n');
    
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
    console.log('📝 pricing_data will store JSON array of {type, price} objects');
    console.log('   Example: [{"type":"Online","price":"5000"},{"type":"F2F","price":"6000"}]');
    
  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addPricingData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
