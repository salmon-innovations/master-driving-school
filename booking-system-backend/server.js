const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const pool = require('./config/db'); // Import database connection

app.set('trust proxy', 1);

// Test database connection + auto-migrate branch_prices column
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected successfully');
    pool.query('ALTER TABLE courses ADD COLUMN IF NOT EXISTS branch_prices JSONB')
      .then(() => console.log('✅ branch_prices column ready'))
      .catch(e => console.warn('⚠️  branch_prices migration skipped:', e.message));

    // Ensure avatar column exists on users table
    pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT')
      .then(() => console.log('✅ avatar column ready'))
      .catch(e => console.warn('⚠️  avatar migration skipped:', e.message));

    // Expand the role CHECK constraint to include 'super_admin', then promote admin@gmail.com
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
        if (r.rowCount > 0) console.log('✅ Found global admin account: Promoted to super_admin');
        else console.log('ℹ️  Global admin accounts are already super_admin or not found');
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
app.use(compression());
app.use(hpp());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait and try again.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/resend-code', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/verify-email', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  etag: true,
  maxAge: '7d',
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
