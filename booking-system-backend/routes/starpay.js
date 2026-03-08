const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { initiatePayment, initiateGuestPayment, handleWebhook, checkStatus, initiateRescheduleFeePayment } = require('../controllers/starpayController');

// Create StarPay QR payment order (student must be logged in)
router.post('/create-payment', authenticateToken, initiatePayment);

// Create StarPay QR payment order for guest students (no login required)
router.post('/guest-create-payment', initiateGuestPayment);

// Webhook from StarPay — no auth, verified by RSA signature inside handler
router.post('/webhook', handleWebhook);

// Poll status — no auth needed, msgId is unguessable
router.get('/status/:msgId', checkStatus);

// Student pays reschedule fee via StarPay (must be logged in)
router.post('/reschedule-fee/:enrollmentId', authenticateToken, initiateRescheduleFeePayment);

module.exports = router;
