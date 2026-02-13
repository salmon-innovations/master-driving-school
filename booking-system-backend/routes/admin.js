const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllBookings,
  getAllUsers,
  updateBookingStatus,
  deleteBooking,
  getRevenueData,
  getEnrollmentData,
  getBestSellingCourses,
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'hrm' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(isAdmin);

// Dashboard statistics
router.get('/stats', getDashboardStats);

// Get all bookings (admin view)
router.get('/bookings', getAllBookings);

// Get all users
router.get('/users', getAllUsers);

// Update booking status (admin)
router.patch('/bookings/:id/status', updateBookingStatus);

// Delete booking (admin)
router.delete('/bookings/:id', deleteBooking);

// Get revenue data for charts
router.get('/revenue', getRevenueData);

// Get enrollment data for charts
router.get('/enrollments', getEnrollmentData);

// Get best selling courses
router.get('/best-selling-courses', getBestSellingCourses);

// User management routes
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', toggleUserStatus);
router.post('/users/:id/reset-password', resetUserPassword);

module.exports = router;
