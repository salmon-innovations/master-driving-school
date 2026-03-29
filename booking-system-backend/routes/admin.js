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
  walkInEnrollment,
  searchStudents,
  getAllTransactions,
  getUnpaidBookings,
  getFunnelData,
  getCourseDistribution,
  getBranchPerformance,
  getNotifications,
  markBookingAsPaid,
  sendReceiptEmail,
  getEmailContent,
  updateEmailContent,
  sendTestEmailRoute,
  sendAllEmailDesignsRoute,
  getTodayStudents,
  getStudentDetail,
  getAddonsConfig,
  updateAddonsConfig,
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.role !== 'super_admin') {
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

// Get notifications
router.get('/notifications', getNotifications);

// User management routes
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', toggleUserStatus);
router.post('/users/:id/reset-password', resetUserPassword);

// Walk-in enrollment
router.post('/walk-in-enrollment', walkInEnrollment);
router.get('/search-students', searchStudents);

// Financial transactions
router.get('/transactions', getAllTransactions);

// Unpaid bookings
router.get('/unpaid-bookings', getUnpaidBookings);

// Mark booking as fully paid (collect remaining balance)
router.patch('/bookings/:id/mark-paid', markBookingAsPaid);

// Send payment receipt email
router.post('/bookings/:id/send-receipt', sendReceiptEmail);

// Analytics Routes
router.get('/analytics/funnel', getFunnelData);
router.get('/analytics/course-distribution', getCourseDistribution);
router.get('/analytics/branch-performance', getBranchPerformance);

// Email content configuration (admin only)
router.get('/email-content', getEmailContent);
router.put('/email-content', updateEmailContent);
router.post('/email-content/test', sendTestEmailRoute);
router.post('/email-content/test-all', sendAllEmailDesignsRoute);
router.get('/addons-config', getAddonsConfig);
router.put('/addons-config', updateAddonsConfig);

// Today's students with active schedule
router.get('/today-students', getTodayStudents);

// Full student detail (personal info + bookings/payment)
router.get('/student-detail/:studentId', getStudentDetail);

module.exports = router;
