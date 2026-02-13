const pool = require('../config/db');

// Get all courses
const getAllCourses = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses ORDER BY created_at DESC');

    res.json({
      success: true,
      courses: result.rows,
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Server error while fetching courses' });
  }
};

// Get single course by ID
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      success: true,
      course: result.rows[0],
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Server error while fetching course' });
  }
};

// Admin: Create new course
const createCourse = async (req, res) => {
  try {
    const { name, description, price, duration, status, images, category, course_type, pricing_data } = req.body;

    // Validate required fields
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const result = await pool.query(
      `INSERT INTO courses (name, description, price, duration, status, image_url, category, course_type, pricing_data) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        name, 
        description || null, 
        parseFloat(price), 
        duration || null,
        status || 'active',
        images && images.length > 0 ? JSON.stringify(images) : null,
        category || 'Basic',
        course_type || null,
        pricing_data && pricing_data.length > 0 ? JSON.stringify(pricing_data) : null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course: result.rows[0],
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Server error while creating course' });
  }
};

// Admin: Update course
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration, status, images, category, course_type, pricing_data } = req.body;

    // Check if course exists
    const existingCourse = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (existingCourse.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const result = await pool.query(
      `UPDATE courses SET 
        name = $1, 
        description = $2, 
        price = $3, 
        duration = $4,
        status = $5,
        image_url = $6,
        category = $7,
        course_type = $8,
        pricing_data = $9,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 
       RETURNING *`,
      [
        name, 
        description || null, 
        parseFloat(price), 
        duration || null,
        status || 'active',
        images && images.length > 0 ? JSON.stringify(images) : null,
        category || 'Basic',
        course_type || null,
        pricing_data && pricing_data.length > 0 ? JSON.stringify(pricing_data) : null,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Course updated successfully',
      course: result.rows[0],
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Server error while updating course' });
  }
};

// Admin: Delete course
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      success: true,
      message: 'Course deleted successfully',
      course: result.rows[0],
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Server error while deleting course' });
  }
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
};
