const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getAllRoles, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { authenticateToken } = require('../middleware/auth');

const ROLE_PERMISSION_PRESETS = {
  super_admin: ['*'],
  admin: [
    'operations.schedules.manage',
    'operations.schedules.tab.schedule',
    'operations.schedules.tab.summary',
    'operations.schedules.tab.noshow',
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

const requireAnyPermission = (requiredPermissions = []) => async (req, res, next) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'super_admin') return next();

    const result = await pool.query('SELECT permissions FROM users WHERE id = $1', [req.user.id]);
    const explicitPermissions = normalizePermissions(result.rows[0]?.permissions);
    const fallbackPermissions = ROLE_PERMISSION_PRESETS[role] || [];
    const permissionSet = new Set(explicitPermissions.length > 0 ? explicitPermissions : fallbackPermissions);

    const allowed = requiredPermissions.some((permission) => permissionSet.has(permission));
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }

    next();
  } catch (error) {
    console.error('Role route permission error:', error);
    return res.status(500).json({ error: 'Server error while validating permissions.' });
  }
};

// Middleware to check admin privileges
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

// All routes are protected and require admin
router.use(authenticateToken);
router.use(isAdmin);
router.use(requireAnyPermission(['accounts.config.tab.roles']));

router.get('/', getAllRoles);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

module.exports = router;
