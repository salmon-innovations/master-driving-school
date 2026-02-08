const express = require('express');
const router = express.Router();
const { getAllCourses, getCourseById } = require('../controllers/courseController');

// Public routes
router.get('/', getAllCourses);
router.get('/:id', getCourseById);

module.exports = router;
