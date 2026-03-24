const { Pool, types } = require('pg');
require('dotenv').config();

types.setTypeParser(1082, (str) => str);

const toBool = (value, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const dbSslEnabled = toBool(process.env.DB_SSL, !!process.env.DATABASE_URL);
const dbSslRejectUnauthorized = toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);
const dbSsl = dbSslEnabled
  ? { rejectUnauthorized: dbSslRejectUnauthorized }
  : false;

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: dbSsl
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: dbSsl
      }
);

pool.on('connect', (client) => {
  client.query('SET search_path TO public');
  console.log('? Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('? Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
