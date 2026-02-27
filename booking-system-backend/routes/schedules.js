const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getSlotsByDate,
  createSlot,
  updateSlot,
  deleteSlot,
  getSlotEnrollments,
  enrollStudent,
  updateEnrollmentStatus,
  cancelEnrollment,
  getMyEnrollments,
  processNoShow,
} = require('../controllers/scheduleController');

// Get my enrollments (logged-in student)
router.get('/my-enrollments', authenticateToken, getMyEnrollments);

// Get slots by date
router.get('/slots', getSlotsByDate);

// Create new slot
router.post('/slots', authenticateToken, createSlot);

// Update slot
router.put('/slots/:id', authenticateToken, updateSlot);

// Delete slot
router.delete('/slots/:id', authenticateToken, deleteSlot);

// Get enrollments for a slot
router.get('/slots/:slotId/enrollments', authenticateToken, getSlotEnrollments);

// Enroll student in slot
router.post('/slots/:slotId/enroll', authenticateToken, enrollStudent);

// Update enrollment status
router.patch('/enrollments/:enrollmentId/status', authenticateToken, updateEnrollmentStatus);

// Cancel enrollment
router.delete('/enrollments/:enrollmentId', authenticateToken, cancelEnrollment);

// Process No-Show with fee notification
router.post('/enrollments/:enrollmentId/no-show', authenticateToken, processNoShow);

module.exports = router;
