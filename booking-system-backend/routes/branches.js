const express = require('express');
const router = express.Router();
const { getAllBranches, getBranchById, createBranch, updateBranch, deleteBranch } = require('../controllers/branchController');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check admin privileges
const isAuthorized = (req, res, next) => {
    if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    next();
};

// Public routes
router.get('/', getAllBranches);
router.get('/:id', getBranchById);

// Protected routes (Admin only)
router.post('/', authenticateToken, isAuthorized, createBranch);
router.put('/:id', authenticateToken, isAuthorized, updateBranch);
router.delete('/:id', authenticateToken, isAuthorized, deleteBranch);

module.exports = router;
