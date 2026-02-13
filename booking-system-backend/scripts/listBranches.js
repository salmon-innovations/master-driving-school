const pool = require('../config/db');

async function listBranches() {
  try {
    console.log('📋 Listing all branches...\n');
    
    const result = await pool.query('SELECT id, name, address FROM branches ORDER BY id');
    
    console.log(`Total branches: ${result.rows.length}\n`);
    console.table(result.rows);
    
    console.log('\n✅ Valid branch IDs:', result.rows.map(b => b.id).join(', '));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error listing branches:', error);
    process.exit(1);
  }
}

listBranches();
