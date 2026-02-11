const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const runMigrations = async () => {
  try {
    console.log('Connecting to database...');
    
    // Run email verification migration
    console.log('Running email verification migration...');
    const emailVerificationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/add_email_verification.sql'),
      'utf8'
    );
    await pool.query(emailVerificationSQL);
    console.log('Email verification migration completed.');
    
    // Run branch addresses fix migration
    console.log('Running branch addresses fix migration...');
    const branchAddressesSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/fix_branch_addresses.sql'),
      'utf8'
    );
    await pool.query(branchAddressesSQL);
    console.log('Branch addresses fix migration completed.');
    
    console.log('All migrations completed successfully.');
  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    await pool.end();
  }
};

runMigrations();
