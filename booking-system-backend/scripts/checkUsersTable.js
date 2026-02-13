const pool = require('../config/db');

async function checkUsersTable() {
  try {
    console.log('🔍 Checking users table schema...\n');
    
    // Get column information
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Users table columns:');
    console.table(result.rows);
    
    // Check specifically for role and branch columns
    const roleColumn = result.rows.find(col => col.column_name === 'role');
    const branchColumn = result.rows.find(col => col.column_name === 'branch');
    const branchIdColumn = result.rows.find(col => col.column_name === 'branch_id');
    const statusColumn = result.rows.find(col => col.column_name === 'status');
    const verifiedColumn = result.rows.find(col => col.column_name === 'is_verified');
    
    console.log('\n🔎 Column existence check:');
    console.log('  role:', roleColumn ? '✅ EXISTS' : '❌ MISSING');
    console.log('  branch:', branchColumn ? '✅ EXISTS (type: ' + branchColumn.data_type + ')' : '❌ MISSING');
    console.log('  branch_id:', branchIdColumn ? '✅ EXISTS (type: ' + branchIdColumn.data_type + ')' : '❌ MISSING');
    console.log('  status:', statusColumn ? '✅ EXISTS' : '❌ MISSING');
    console.log('  is_verified:', verifiedColumn ? '✅ EXISTS' : '❌ MISSING');
    
    if (branchColumn && branchIdColumn) {
      console.log('\n⚠️  WARNING: Both "branch" and "branch_id" columns exist!');
      console.log('   This may cause conflicts. Recommend using only branch_id.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking table schema:', error);
    process.exit(1);
  }
}

checkUsersTable();
