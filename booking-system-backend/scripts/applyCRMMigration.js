const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function applyCRMMigration() {
  const client = await pool.connect();
  
  try {
    console.log('📋 Starting CRM migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_crm_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ CRM migration applied successfully!');
    console.log('\nTables created:');
    console.log('  - leads');
    console.log('  - lead_sources');
    console.log('  - lead_statuses');
    console.log('  - lead_interactions');
    console.log('  - lead_attachments');
    
    // Verify tables were created
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('leads', 'lead_sources', 'lead_statuses', 'lead_interactions', 'lead_attachments')
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Verification:');
    tableCheck.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name} table exists`);
    });
    
    // Check default data
    const sourcesCount = await client.query('SELECT COUNT(*) FROM lead_sources');
    const statusesCount = await client.query('SELECT COUNT(*) FROM lead_statuses');
    
    console.log('\n📦 Default data loaded:');
    console.log(`  - ${sourcesCount.rows[0].count} lead sources`);
    console.log(`  - ${statusesCount.rows[0].count} lead statuses`);
    
    console.log('\n🎉 CRM system is ready to use!');
    console.log('\nNext steps:');
    console.log('  1. Restart your backend server');
    console.log('  2. Log in to the admin panel');
    console.log('  3. Click "CRM" in the sidebar');
    console.log('  4. Start managing your leads!');
    
  } catch (error) {
    console.error('❌ Error applying CRM migration:', error.message);
    
    if (error.code === '42P07') {
      console.log('\n⚠️  Tables already exist. Migration may have been applied previously.');
    } else {
      console.log('\nError details:', error);
    }
    
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Run the migration
applyCRMMigration().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
