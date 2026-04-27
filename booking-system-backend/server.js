const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const compression = require('compression');
require('dotenv').config();
const {
  apiLimiter,
  authLoginLimiter,
  authRegisterLimiter,
  authRecoveryLimiter,
} = require('./middleware/rateLimiters');

const app = express();
const PORT = process.env.PORT || 5000;
const pool = require('./config/db'); // Import database connection

app.set('trust proxy', 1);

// Test database connection + auto-migrate
pool.query('SELECT NOW()', (err, _res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected successfully');

    const migrations = [
      // Column migrations (idempotent)
      `ALTER TABLE courses ADD COLUMN IF NOT EXISTS branch_prices JSONB`,
      `ALTER TABLE courses ALTER COLUMN course_type TYPE TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS login_lock_until TIMESTAMP`,
    ];

    // Run column migrations sequentially (cheap on startup)
    migrations.reduce((p, sql) => p.then(() => pool.query(sql)).catch(e => console.warn('⚠️  migration skipped:', e.message)), Promise.resolve())
      .then(() => console.log('✅ Column migrations done'))
      // Performance indexes — run async, never block startup
      .then(() => {
        const fs   = require('fs');
        const path = require('path');
        const idxFile = path.join(__dirname, 'migrations', 'add_performance_indexes.sql');
        if (fs.existsSync(idxFile)) {
          const sql = fs.readFileSync(idxFile, 'utf8');
          return pool.query(sql)
            .then(() => console.log('✅ Performance indexes applied'))
            .catch(e => console.warn('⚠️  Index migration skipped:', e.message));
        }
      });

    // Role constraint + super_admin promotion
    pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`)
      .then(() => pool.query(`
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'staff', 'student', 'walkin_student', 'super_admin'))
      `))
      .then(() => pool.query(`
        UPDATE users SET role = 'super_admin'
        WHERE (email = 'admin@gmail.com' OR email = 'superadmin@gmail.com') AND role != 'super_admin'
      `))
      .then(r => {
        if (r.rowCount > 0) console.log('✅ Promoted global admin to super_admin');
      })
      .catch(e => console.warn('⚠️  super_admin setup skipped:', e.message));
  }
});



// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Safety fallback so production still works if FRONTEND_URL is not set correctly.
if (!allowedOrigins.includes('https://masterdriving.ph')) {
  allowedOrigins.push('https://masterdriving.ph');
}
if (!allowedOrigins.includes('https://www.masterdriving.ph')) {
  allowedOrigins.push('https://www.masterdriving.ph');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (server-to-server/curl/health checks).
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// Compress all responses ≥ 1 KB — important on Render's shared network
app.use(compression({ threshold: 1024 }));
app.use(hpp());

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLoginLimiter);
app.use('/api/auth/register', authRegisterLimiter);
app.use('/api/auth/resend-code', authRecoveryLimiter);
app.use('/api/auth/forgot-password', authRecoveryLimiter);
app.use('/api/auth/verify-email', authRecoveryLimiter);
app.use('/api/auth/verify-reset-otp', authRecoveryLimiter);
app.use('/api/auth/reset-password', authRecoveryLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const path = require('path');
// Static uploads: long cache + ETags so GoDaddy/CloudFlare can cache avatars/images
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  etag: true,
  lastModified: true,
  maxAge: '30d',
  immutable: false, // uploads can change (avatars), so no immutable flag
}));


// Routes
app.use('/api/news', require('./routes/news'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/promos', require('./routes/promoRoutes'));
app.use('/api/starpay', require('./routes/starpay')); // StarPay payment gateway

// TEST ROUTE - ABSOLUTE PRIORITY
app.get('/api/crm-check', (req, res) => {
  res.json({
    success: true,
    message: 'CRM API is online and responding',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

// Serve static files from the 'dist' directory (if it exists)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Handle SPA routing: serve index.html for all non-API routes
app.get('/:path*', (req, res, next) => {
  // If it's an API route that wasn't found, let the 404 handler take it
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Otherwise, serve the frontend index.html
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      // If index.html is missing, fall through to the 404 handler
      next();
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle uncaught exceptions and unhandled rejections to prevent crashing
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err.message);
  console.error(err.stack);
  // Optional: Graceful shutdown if needed, but for now we'll log it.
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
