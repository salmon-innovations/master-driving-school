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

// ── Pool tuned for Render Starter (512 MB RAM) + Basic PostgreSQL ─────────
// Render Basic DB allows max ~25 connections; starter web service is single-
// instance so keeping max at 5 leaves room for migrations and background jobs.
const POOL_CONFIG = {
  max: 5,                // max simultaneous open connections
  min: 1,               // keep at least 1 warm connection to avoid cold-start latency
  idleTimeoutMillis: 30000,      // release idle client after 30 s
  connectionTimeoutMillis: 8000, // fail-fast if DB is unreachable (cold start)
  statement_timeout: 20000,      // kill queries running > 20 s (protects starter plan)
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: dbSsl }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: dbSsl,
      }),
};

const pool = new Pool(POOL_CONFIG);

pool.on('connect', (client) => {
  // Faster seq scans on small-ish Render DB (no parallel workers on basic plan)
  client.query('SET search_path TO public');
  client.query("SET work_mem = '8MB'").catch(() => {});
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error on idle client', err);
  // Don't exit — let the process recover by acquiring a new client next request.
});

// ── Simple in-process response cache ─────────────────────────────────────
// Caches expensive, infrequently-changing query results (stats, branches,
// best-selling courses, course config) for a short TTL to reduce DB round-trips
// on Render's cold-connection-prone basic plan.
const _cache = new Map(); // key -> { data, expiresAt }

/**
 * Get a cached value, or run `fetchFn` and cache the result for `ttlMs`.
 * @param {string}   key
 * @param {Function} fetchFn  async () => value
 * @param {number}   ttlMs    cache lifetime in ms (default 60 s)
 */
const withCache = async (key, fetchFn, ttlMs = 60_000) => {
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.data;
  const data = await fetchFn();
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
};

/** Manually bust one or more cache keys (call after write operations). */
const bustCache = (...keys) => {
  keys.forEach((k) => _cache.delete(k));
};

module.exports = pool;
module.exports.withCache = withCache;
module.exports.bustCache = bustCache;
