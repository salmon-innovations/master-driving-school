const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { initiatePayment, handleWebhook, checkStatus, initiateRescheduleFeePayment } = require('../controllers/starpayController');

// Create StarPay QR payment order (student must be logged in)
router.post('/create-payment', authenticateToken, initiatePayment);

// Webhook from StarPay — no auth, verified by RSA signature inside handler
router.post('/webhook', handleWebhook);

// Poll status — no auth needed, msgId is unguessable
router.get('/status/:msgId', checkStatus);

// Student pays reschedule fee via StarPay (must be logged in)
router.post('/reschedule-fee/:enrollmentId', authenticateToken, initiateRescheduleFeePayment);

// TEST-ONLY: instantly mark reschedule fee as paid without calling StarPay
router.patch('/test-mark-fee-paid/:enrollmentId', authenticateToken, async (req, res) => {
  const pool = require('../config/db');
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.id;
    const result = await pool.query(
      `UPDATE schedule_enrollments
          SET reschedule_fee_paid = TRUE,
              walkin_payment_method = 'StarPay (Test)',
              walkin_fee_amount = 1000,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND student_id = $2 AND enrollment_status = 'no-show'
        RETURNING id`,
      [enrollmentId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
