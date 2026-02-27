const { Pool, types } = require('pg');
require('dotenv').config();

// Force DATE (OID 1082) columns to verify returned as strings 'YYYY-MM-DD'
// prevent automatic timezone conversion to local midnight -> UTC shift
types.setTypeParser(1082, (str) => str);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
