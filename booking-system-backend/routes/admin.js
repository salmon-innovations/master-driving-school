const express = require('express');
const router = express.Router();
const pool = require('../config/db');
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
  assignPdcSchedule,
  sendReceiptEmail,
  getEmailContent,
  updateEmailContent,
  sendTestEmailRoute,
  sendAllEmailDesignsRoute,
  getTodayStudents,
  getTdcOnlineStudents,
  getPdcSchedulingQueue,
  getStudentDetail,
  getAddonsConfig,
  updateAddonsConfig,
  getDatabaseBackup,
  exportStudentsCSV,
  exportTransactionsCSV,
  clearDatabase,
  importSQLBackup,
  importStudentsCSV,
  importTransactionsCSV,
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'tmp/' });

const ROLE_PERMISSION_PRESETS = {
  super_admin: ['*'],
  admin: [
    'operations.schedules.manage',
    'operations.schedules.tab.schedule',
    'operations.schedules.tab.summary',
    'operations.schedules.tab.noshow',
    'operations.schedules.tab.tdc_online',
    'operations.bookings.manage',
    'operations.walk_in.manage',
    'operations.sales.manage',
    'operations.crm.manage',
    'operations.analytics.view',
    'operations.best_selling_courses.view',
    'operations.news.manage',
    'accounts.courses.view',
    'accounts.courses.tab.courses',
    'accounts.courses.tab.discounts',
    'accounts.courses.tab.config',
    'accounts.config.view',
    'accounts.config.tab.branches',
    'accounts.config.tab.coursetypes',
    'accounts.config.tab.emailcontent',
    'accounts.config.tab.settings',
    'accounts.users.create',
    'accounts.users.edit',
    'accounts.users.reset_password',
  ],
};

const normalizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return permissions.filter((permission) => typeof permission === 'string' && permission.trim().length > 0);
};

const resolveUserPermissions = async (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'super_admin') {
    return new Set(['*']);
  }

  const result = await pool.query('SELECT permissions FROM users WHERE id = $1', [user.id]);
  const explicitPermissions = result.rows[0]?.permissions;
  const normalizedExplicit = normalizePermissions(explicitPermissions);
  const fallback = ROLE_PERMISSION_PRESETS[role] || [];
  const effective = normalizedExplicit.length > 0 ? normalizedExplicit : fallback;
  return new Set(effective);
};

const requireAnyPermission = (requiredPermissions = []) => async (req, res, next) => {
  try {
    const permissionSet = await resolveUserPermissions(req.user);
    if (permissionSet.has('*')) return next();

    const allowed = requiredPermissions.some((permission) => permissionSet.has(permission));
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }

    next();
  } catch (error) {
    console.error('Permission check error:', error);
    return res.status(500).json({ error: 'Server error while validating permissions.' });
  }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
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

// Assign PDC schedule for CRM-gated bookings
router.patch('/bookings/:id/assign-pdc', assignPdcSchedule);

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

// TDC Online students queue for provider onboarding
router.get('/tdc-online-students', getTdcOnlineStudents);
// Backward-compatible aliases for older frontend builds.
router.get('/tdc_online_students', getTdcOnlineStudents);
router.get('/online-tdc-students', getTdcOnlineStudents);

// PDC scheduling queue (OTDC completed and locked for assignment)
router.get('/pdc-scheduling-queue', getPdcSchedulingQueue);

// Full student detail (personal info + bookings/payment)
router.get('/student-detail/:studentId', getStudentDetail);

// Backup & Export routes
router.get('/db-backup', requireAnyPermission(['accounts.config.tab.backup']), getDatabaseBackup);
router.get('/export-students', requireAnyPermission(['accounts.config.tab.backup']), exportStudentsCSV);
router.get('/export-transactions', requireAnyPermission(['accounts.config.tab.backup']), exportTransactionsCSV);

// Maintenance routes
router.post('/clear-database', requireAnyPermission(['accounts.config.tab.backup']), clearDatabase);
router.post('/import-sql', requireAnyPermission(['accounts.config.tab.backup']), upload.single('file'), importSQLBackup);
router.post('/import-students', requireAnyPermission(['accounts.config.tab.backup']), upload.single('file'), importStudentsCSV);
router.post('/import-transactions', requireAnyPermission(['accounts.config.tab.backup']), upload.single('file'), importTransactionsCSV);

module.exports = router;
