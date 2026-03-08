const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const pool = require('./config/db'); // Import database connection

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
