const express = require('express');
const router = express.Router();
const {
  register,
  guestCheckout,
  login,
  logout,
  getProfile,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  verifyResetOTP,
  resetPassword
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/guest-checkout', guestCheckout);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendVerificationCode);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

// Protected routes
router.post('/logout', authenticateToken, logout);
router.get('/profile', authenticateToken, getProfile);

module.exports = router;
