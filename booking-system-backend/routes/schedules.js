const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/auth');
const {
  getSlotsByDate,
  createSlot,
  updateSlot,
  deleteSlot,
  getSlotEnrollments,
  enrollStudent,
  updateEnrollmentStatus,
  cancelEnrollment,
  markFeePaid,
  getMyEnrollments,
  processNoShow,
  requestFreeReschedule,
  rescheduleEnrollment,
  getUnassignedPdcStudents,
  payRemainingBalance,
  getNoShowStudents,
} = require('../controllers/scheduleController');

// Get my enrollments (logged-in student)
router.get('/my-enrollments', authenticateToken, getMyEnrollments);

// Student pays remaining balance online
router.patch('/pay-balance/:bookingId', authenticateToken, payRemainingBalance);

// Get unassigned PDC students
router.get('/unassigned-pdc', authenticateToken, getUnassignedPdcStudents);

// Get slots by date
router.get('/slots', optionalAuthenticateToken, getSlotsByDate);

// Create new slot
router.post('/slots', authenticateToken, createSlot);

// Update slot
router.put('/slots/:id', authenticateToken, updateSlot);

// Delete slot
router.delete('/slots/:id', authenticateToken, deleteSlot);

// Get enrollments for a slot
router.get('/slots/:slotId/enrollments', authenticateToken, getSlotEnrollments);

// Release temporary atomic locks (placeholder for future implementation)
router.post('/slots/release-locks', (req, res) => res.json({ success: true, message: 'Locks cleared successfully' }));

// Enroll student in slot
router.post('/slots/:slotId/enroll', authenticateToken, enrollStudent);

// Update enrollment status
router.patch('/enrollments/:enrollmentId/status', authenticateToken, updateEnrollmentStatus);

// Cancel enrollment
router.delete('/enrollments/:enrollmentId', authenticateToken, cancelEnrollment);

// Process No-Show with fee notification
router.post('/enrollments/:enrollmentId/no-show', authenticateToken, processNoShow);

// Request a free reschedule within 5 days of a no-show
router.post('/enrollments/:enrollmentId/request-free-reschedule', authenticateToken, requestFreeReschedule);

// Reschedule student to a different slot
router.post('/enrollments/:enrollmentId/reschedule', authenticateToken, rescheduleEnrollment);

// Mark no-show rescheduling fee as paid
router.patch('/enrollments/:enrollmentId/mark-fee-paid', authenticateToken, markFeePaid);

router.get('/no-show-students', authenticateToken, getNoShowStudents);

module.exports = router;
