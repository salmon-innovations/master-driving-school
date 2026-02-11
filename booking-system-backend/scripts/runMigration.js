const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

// Function to run SQL migration file
async function runMigration(migrationFile) {
  try {
    const filePath = path.join(__dirname, '..', 'migrations', migrationFile);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`\n📝 Running migration: ${migrationFile}`);
    console.log('─'.repeat(50));

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
        console.log('✅', statement.substring(0, 60) + '...');
      }
    }

    console.log('─'.repeat(50));
    console.log(`✅ Migration completed successfully!\n`);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Please provide migration file name');
  console.log('Usage: node scripts/runMigration.js <migration-file.sql>');
  console.log('Example: node scripts/runMigration.js add_user_management_columns.sql');
  process.exit(1);
}

// Run the migration
runMigration(migrationFile);
