const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// ─── Course Config (categories & types) ─────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, '../config/course_config.json');

const normalizePromoPdcName = (value) => {
  const cleaned = String(value || '').trim();
  const lower = cleaned.toLowerCase();
  if (!cleaned) return '';
  if (lower === 'motorcycle') return 'PDC Motor Manual';
  if (lower === 'manual' || lower === 'carmt' || lower === 'car mt' || lower === 'pdc car manual') return 'PDC Car Manual';
  if (lower === 'automatic' || lower === 'carat' || lower === 'car at' || lower === 'pdc car automatic') return 'PDC Car Automatic';
  if (lower === 'v1-tricycle' || lower === 'a1-tricycle' || lower === 'pdc a1-tricycle') return 'PDC A1-Tricycle';
  if (lower === 'b1-van/b2 - l300' || lower === 'b1-van/b2-l300' || lower === 'pdc b1-van/b2-l300') return 'PDC B1-Van/B2-L300';
  return cleaned;
};

const buildBundleKey = (tdcPart, pdcParts) => {
  const normalizedPdcParts = [...new Set((pdcParts || []).map(v => normalizePromoPdcName(v)).filter(Boolean))].sort();
  if (!tdcPart || normalizedPdcParts.length === 0) return '';
  return `${String(tdcPart).trim()}+${normalizedPdcParts.join('|')}`;
};

const normalizeBundleEntry = (entry) => {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const [tdcPart, pdcRaw = ''] = entry.split('+');
    const pdcParts = pdcRaw.split('|').map(v => normalizePromoPdcName(v)).filter(Boolean);
    const key = buildBundleKey(tdcPart, pdcParts);
    if (!key) return null;
    return {
      value: key,
      key,
      tdcPart: String(tdcPart || '').trim(),
      pdcParts: [...new Set(pdcParts)].sort(),
      label: `${String(tdcPart || '').trim()} TDC + ${[...new Set(pdcParts)].sort().join(', ')} PDC`,
    };
  }

  if (typeof entry === 'object') {
    const rawValue = String(entry.value || '').trim();
    const tdcPart = String(entry.tdcPart || '').trim() || (rawValue.includes('+') ? rawValue.split('+')[0].trim() : '');
    const rawPdcParts = Array.isArray(entry.pdcParts)
      ? entry.pdcParts
      : (rawValue.includes('+') ? rawValue.split('+')[1].split('|') : []);
    const pdcParts = [...new Set(rawPdcParts.map(v => normalizePromoPdcName(v)).filter(Boolean))].sort();
    const key = buildBundleKey(tdcPart, pdcParts);
    if (!key) return null;
    return {
      value: key,
      key,
      tdcPart,
      pdcParts,
      label: String(entry.label || '').trim() || `${tdcPart} TDC + ${pdcParts.join(', ')} PDC`,
    };
  }

  return null;
};

const normalizeCourseConfig = (rawConfig) => {
  const merged = { ...DEFAULT_COURSE_CONFIG, ...(rawConfig || {}) };
  const bundleTypes = (Array.isArray(merged.bundleTypes) ? merged.bundleTypes : [])
    .map(normalizeBundleEntry)
    .filter(Boolean);
  return { ...merged, bundleTypes };
};

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
  bundleTypes: [],
};

const loadCourseConfig = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return normalizeCourseConfig(saved);
    }
  } catch (e) {
    console.error('Failed to load course config:', e.message);
  }
  return normalizeCourseConfig(DEFAULT_COURSE_CONFIG);
};

const saveCourseConfig = (config) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(normalizeCourseConfig(config), null, 2));
  } catch (e) {
    console.error('Failed to save course config:', e.message);
    throw new Error('Failed to persist course configuration');
  }
};

const getCourseConfig = async (req, res) => {
  try {
    res.json({ success: true, config: normalizeCourseConfig(loadCourseConfig()) });
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

    const normalizedUpdated = normalizeCourseConfig(updated);

    // If categories changed, update the DB check constraint
    const oldSorted = [...current.categories].sort().join(',');
    const newSorted = [...normalizedUpdated.categories].sort().join(',');
    if (categories && oldSorted !== newSorted) {
      const catList = normalizedUpdated.categories.map(c => `'${c.replace(/'/g, "''")}'`).join(', ');
      await pool.query('ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_category_check');
      await pool.query(`ALTER TABLE courses ADD CONSTRAINT courses_category_check CHECK (category IN (${catList}))`);
    }

    saveCourseConfig(normalizedUpdated);
    res.json({ success: true, config: normalizedUpdated });
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
    const { name, description, price, discount, duration, status, images, category, course_type, pricing_data, branch_prices } = req.body;

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

    let branchPricesJson = null;
    if (branch_prices && branch_prices.length > 0) {
      branchPricesJson = JSON.stringify(branch_prices);
    }

    const result = await pool.query(
      `INSERT INTO courses (name, description, price, discount, duration, status, image_url, category, course_type, pricing_data, branch_prices) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [
        name,
        description || null,
        parseFloat(price),
        parseFloat(discount) || 0,
        duration || null,
        status || 'active',
        imageData,
        category || 'Basic',
        course_type || null,
        pricingDataJson,
        branchPricesJson
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
    const { name, description, price, discount, duration, status, images, category, course_type, pricing_data, branch_prices } = req.body;

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

    let branchPricesJson = null;
    if (branch_prices && branch_prices.length > 0) {
      branchPricesJson = JSON.stringify(branch_prices);
    }

    const result = await pool.query(
      `UPDATE courses SET 
        name = $1, 
        description = $2, 
        price = $3, 
        discount = $4,
        duration = $5,
        status = $6,
        image_url = $7,
        category = $8,
        course_type = $9,
        pricing_data = $10,
        branch_prices = $11,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 
       RETURNING *`,
      [
        name,
        description || null,
        parseFloat(price),
        parseFloat(discount) || 0,
        duration || null,
        status || 'active',
        imageData,
        category || 'Basic',
        course_type || null,
        pricingDataJson,
        branchPricesJson,
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

// Admin: Update branch prices only (stores ONLY branches that differ from the course default)
const updateBranchPrices = async (req, res) => {
  try {
    const { id } = req.params;
    const { branch_prices } = req.body;

    if (!Array.isArray(branch_prices)) {
      return res.status(400).json({ error: 'branch_prices must be an array' });
    }

    const existing = await pool.query('SELECT id FROM courses WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const branchPricesJson = branch_prices.length > 0 ? JSON.stringify(branch_prices) : null;

    const result = await pool.query(
      `UPDATE courses SET branch_prices = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [branchPricesJson, id]
    );

    res.json({ success: true, message: 'Branch prices updated successfully', course: result.rows[0] });
  } catch (error) {
    console.error('Update branch prices error:', error.message);
    res.status(500).json({ error: 'Server error while updating branch prices' });
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
  updateBranchPrices,
  getCourseConfig,
  updateCourseConfig,
};
