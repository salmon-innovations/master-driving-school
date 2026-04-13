const pool = require('../config/db');
const { withCache, bustCache } = require('../config/db');

// Get all branches  (cached 5 min — branches rarely change)
const getAllBranches = async (req, res) => {
  try {
    const branches = await withCache('branches:all', async () => {
      const result = await pool.query('SELECT * FROM branches ORDER BY id ASC');
      return result.rows;
    }, 5 * 60_000);

    // Tell CDN/browser to cache for 5 min — safe, branches change admin-side only
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.json({ success: true, branches });
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

// Create new branch
const createBranch = async (req, res) => {
  try {
    const { name, address, contact_number, email } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const result = await pool.query(
      'INSERT INTO branches (name, address, contact_number, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, address, contact_number, email]
    );

    res.status(201).json({
      success: true,
      branch: result.rows[0],
    });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ error: 'Server error while creating branch' });
  }
};

// Update branch
const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, contact_number, email } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const result = await pool.query(
      'UPDATE branches SET name = $1, address = $2, contact_number = $3, email = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [name, address, contact_number, email, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    bustCache('branches:all'); // invalidate cached branch list
    res.json({ success: true, branch: result.rows[0] });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ error: 'Server error while updating branch' });
  }
};

// Delete branch
const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;

    const usersCount = await pool.query('SELECT COUNT(*) FROM users WHERE branch_id = $1', [id]);
    if (parseInt(usersCount.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete branch because it is being used by users' });
    }

    const result = await pool.query('DELETE FROM branches WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    bustCache('branches:all'); // invalidate cached branch list
    res.json({ success: true, message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ error: 'Server error while deleting branch' });
  }
};

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
};
