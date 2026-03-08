const express = require('express');
const router = express.Router();
const { getAllCourses, getCourseById, createCourse, updateCourse, deleteCourse, getCourseConfig, updateCourseConfig } = require('../controllers/courseController');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

// Course config routes
router.get('/config', getCourseConfig);
router.put('/config', authenticateToken, isAdmin, updateCourseConfig);

// Public routes
router.get('/', getAllCourses);
router.get('/:id', getCourseById);

// Admin routes (protected)
router.post('/', authenticateToken, isAdmin, createCourse);
router.put('/:id', authenticateToken, isAdmin, updateCourse);
router.delete('/:id', authenticateToken, isAdmin, deleteCourse);

module.exports = router;
