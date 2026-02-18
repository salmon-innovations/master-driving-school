const express = require('express');
const router = express.Router();
const { getAllBranches, getBranchById, createBranch, updateBranch, deleteBranch } = require('../controllers/branchController');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check staff privileges
const isAuthorized = (req, res, next) => {
    if (!req.user || !['admin', 'hrm', 'staff'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Staff privileges required.' });
    }
    next();
};

// Public routes
router.get('/', getAllBranches);
router.get('/:id', getBranchById);

// Protected routes (Staff only)
router.post('/', authenticateToken, isAuthorized, createBranch);
router.put('/:id', authenticateToken, isAuthorized, updateBranch);
router.delete('/:id', authenticateToken, isAuthorized, deleteBranch);

module.exports = router;
