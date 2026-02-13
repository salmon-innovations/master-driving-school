const pool = require('../config/db');

async function checkForeignKeys() {
  try {
    console.log('🔍 Checking foreign key constraints...\n');
    
    // Check foreign keys on users table
    const result = await pool.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'users';
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No foreign keys found on users table!\n');
    } else {
      console.log('✅ Foreign keys on users table:');
      console.table(result.rows);
    }
    
    // Check specifically for branch_id
    const branchFK = result.rows.find(row => row.column_name === 'branch_id');
    
    console.log('\n🏢 Branch ID Foreign Key Check:');
    if (branchFK) {
      console.log(`  ✅ branch_id IS a foreign key`);
      console.log(`  📌 References: ${branchFK.foreign_table_name}.${branchFK.foreign_column_name}`);
      console.log(`  🔗 Constraint name: ${branchFK.constraint_name}`);
    } else {
      console.log('  ❌ branch_id is NOT a foreign key!');
      console.log('  ⚠️  This needs to be fixed to maintain data integrity.');
    }
    
    // Check if branches table exists
    const branchesTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'branches' AND table_schema = 'public';
    `);
    
    console.log('\n📋 Branches table check:');
    if (branchesTable.rows.length > 0) {
      console.log('  ✅ branches table exists');
      
      // Get branches count
      const branchCount = await pool.query('SELECT COUNT(*) as count FROM branches');
      console.log(`  📊 Total branches: ${branchCount.rows[0].count}`);
    } else {
      console.log('  ❌ branches table does NOT exist!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking foreign keys:', error);
    process.exit(1);
  }
}

checkForeignKeys();
