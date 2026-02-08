const pool = require('../config/db');

// Get all branches
const getAllBranches = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM branches ORDER BY name ASC');

    res.json({
      success: true,
      branches: result.rows,
    });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ error: 'Server error while fetching branches' });
  }
};

// Get single branch by ID
const getBranchById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM branches WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    res.json({
      success: true,
      branch: result.rows[0],
    });
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({ error: 'Server error while fetching branch' });
  }
};

module.exports = {
  getAllBranches,
  getBranchById,
};
