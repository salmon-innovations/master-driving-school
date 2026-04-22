const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  initiatePayment, 
  handleWebhook, 
  checkStatus, 
  initiateRescheduleFeePayment
} = require('../controllers/starpayController');

// Create StarPay QR payment order (student must be logged in)
router.post('/create-payment', authenticateToken, initiatePayment);

// Webhook from StarPay — no auth, verified by RSA signature inside handler
router.post('/webhook', handleWebhook);

// Poll status — no auth needed, msgId is unguessable
router.get('/status/:msgId', checkStatus);

router.post('/reschedule-fee/:enrollmentId', authenticateToken, initiateRescheduleFeePayment);

// Diagnostic ping route
router.get('/ping', (req, res) => res.json({ success: true, message: 'StarPay router is active' }));


module.exports = router;

