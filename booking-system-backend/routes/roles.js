const express = require('express');
const router = express.Router();
const { getAllRoles, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check admin privileges
const isAdmin = (req, res, next) => {
    if (!req.user || !['admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
    next();
};

// All routes are protected and require admin
router.use(authenticateToken);
router.use(isAdmin);

router.get('/', getAllRoles);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

module.exports = router;
