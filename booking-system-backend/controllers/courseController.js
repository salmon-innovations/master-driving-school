const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// ─── Course Config (categories & types) ─────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, '../config/course_config.json');

const DEFAULT_COURSE_CONFIG = {
  categories: ['Basic', 'TDC', 'PDC', 'Promo'],
  tdcTypes: [
    { value: 'F2F', label: 'F2F (Face-to-Face)' },
    { value: 'Online', label: 'Online' },
  ],
  pdcTypes: [
    { value: 'Automatic', label: 'Automatic' },
    { value: 'Manual', label: 'Manual' },
    { value: 'V1-Tricycle', label: 'V1-Tricycle' },
    { value: 'B1-Van/B2 - L300', label: 'B1 - Van/B2 - L300' },
  ],
  bundleTypes: [
    { value: 'F2F+Motorcycle', label: 'F2F TDC + MOTOR (Motorcycle PDC)' },
    { value: 'F2F+CarAT', label: 'F2F TDC + CAR AT (Car Automatic PDC)' },
    { value: 'F2F+CarMT', label: 'F2F TDC + CAR MT (Car Manual PDC)' },
    { value: 'Online+Motorcycle', label: 'OTDC + MOTOR (Motorcycle PDC)' },
    { value: 'Online+CarAT', label: 'OTDC + CAR AT (Car Automatic PDC)' },
    { value: 'Online+CarMT', label: 'OTDC + CAR MT (Car Manual PDC)' },
  ],
};

const loadCourseConfig = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...DEFAULT_COURSE_CONFIG, ...saved };
    }
  } catch (e) {
    console.error('Failed to load course config:', e.message);
  }
  return DEFAULT_COURSE_CONFIG;
};

const saveCourseConfig = (config) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save course config:', e.message);
    throw new Error('Failed to persist course configuration');
  }
};

const getCourseConfig = async (req, res) => {
  try {
    res.json({ success: true, config: loadCourseConfig() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read course configuration' });
  }
};

const updateCourseConfig = async (req, res) => {
  try {
    const { categories, tdcTypes, pdcTypes, bundleTypes } = req.body;
    const current = loadCourseConfig();

    const updated = {
      categories: categories ?? current.categories,
      tdcTypes: tdcTypes ?? current.tdcTypes,
      pdcTypes: pdcTypes ?? current.pdcTypes,
      bundleTypes: bundleTypes ?? current.bundleTypes,
    };

    // If categories changed, update the DB check constraint
    const oldSorted = [...current.categories].sort().join(',');
    const newSorted = [...updated.categories].sort().join(',');
    if (categories && oldSorted !== newSorted) {
      const catList = updated.categories.map(c => `'${c.replace(/'/g, "''")}'`).join(', ');
      await pool.query('ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_category_check');
      await pool.query(`ALTER TABLE courses ADD CONSTRAINT courses_category_check CHECK (category IN (${catList}))`);
    }

    saveCourseConfig(updated);
    res.json({ success: true, config: updated });
  } catch (error) {
    console.error('Update course config error:', error);
    res.status(500).json({ error: error.message || 'Failed to update course configuration' });
  }
};
// ────────────────────────────────────────────────────────────────────────────

// Get all courses
const getAllCourses = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, CAST(COUNT(b.id) AS INTEGER) as enrolled
      FROM courses c
      LEFT JOIN bookings b ON c.id = b.course_id AND b.status IN ('paid', 'completed')
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

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

    console.log('Create course request:', {
      name,
      category,
      course_type,
      imagesCount: images ? images.length : 0,
      pricingDataCount: pricing_data ? pricing_data.length : 0
    });

    // Validate required fields
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    // Prepare image data
    let imageData = null;
    if (images && images.length > 0) {
      imageData = JSON.stringify(images);
      console.log('Image data size:', imageData.length, 'characters');
    }

    // Prepare pricing data
    let pricingDataJson = null;
    if (pricing_data && pricing_data.length > 0) {
      pricingDataJson = JSON.stringify(pricing_data);
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
        imageData,
        category || 'Basic',
        course_type || null,
        pricingDataJson
      ]
    );

    console.log('Course created successfully:', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course: result.rows[0],
    });
  } catch (error) {
    console.error('Create course error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      error: 'Server error while creating course',
      details: error.message
    });
  }
};

// Admin: Update course
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration, status, images, category, course_type, pricing_data } = req.body;

    console.log('Update course request:', {
      id,
      name,
      category,
      course_type,
      imagesCount: images ? images.length : 0,
      pricingDataCount: pricing_data ? pricing_data.length : 0
    });

    // Check if course exists
    const existingCourse = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (existingCourse.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Prepare image data
    let imageData = null;
    if (images && images.length > 0) {
      imageData = JSON.stringify(images);
      console.log('Image data size:', imageData.length, 'characters');
    }

    // Prepare pricing data
    let pricingDataJson = null;
    if (pricing_data && pricing_data.length > 0) {
      pricingDataJson = JSON.stringify(pricing_data);
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
        imageData,
        category || 'Basic',
        course_type || null,
        pricingDataJson,
        id
      ]
    );

    console.log('Course updated successfully:', result.rows[0].id);

    res.json({
      success: true,
      message: 'Course updated successfully',
      course: result.rows[0],
    });
  } catch (error) {
    console.error('Update course error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      error: 'Server error while updating course',
      details: error.message
    });
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
  getCourseConfig,
  updateCourseConfig,
};
