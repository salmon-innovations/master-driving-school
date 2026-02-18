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
} = require('../controllers/scheduleController');

// Get slots by date
router.get('/slots', authenticateToken, getSlotsByDate);

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

module.exports = router;
