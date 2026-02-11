const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkUserStatus() {
  try {
    console.log('🔍 Checking database schema and user status...\n');
    
    // Check if status column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('status', 'branch_id', 'last_login', 'is_verified')
      ORDER BY column_name;
    `);
    
    console.log('📋 Columns in users table:');
    if (columnCheck.rows.length === 0) {
      console.log('❌ No status, branch_id, last_login, or is_verified columns found!');
      console.log('⚠️  Migration may not have run successfully\n');
    } else {
      columnCheck.rows.forEach(col => {
        console.log(`  ✅ ${col.column_name} (${col.data_type}) - Default: ${col.column_default || 'none'}`);
      });
    }
    
    console.log('\n📊 Current user statuses:');
    // Get all users with their status
    const users = await pool.query(`
      SELECT id, email, role, status, branch_id, is_verified
      FROM users
      ORDER BY id;
    `);
    
    if (users.rows.length === 0) {
      console.log('  No users found in database');
    } else {
      users.rows.forEach(user => {
        console.log(`  ID: ${user.id} | ${user.email}`);
        console.log(`    Role: ${user.role || 'NULL'}`);
        console.log(`    Status: ${user.status || 'NULL'}`);
        console.log(`    Branch ID: ${user.branch_id || 'NULL'}`);
        console.log(`    Verified: ${user.is_verified}`);
        console.log('');
      });
    }
    
    await pool.end();
    console.log('✅ Check complete');
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkUserStatus();
