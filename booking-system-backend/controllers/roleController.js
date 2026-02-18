const pool = require('../config/db');

// Get all roles
const getAllRoles = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM roles ORDER BY id ASC');
        res.json({
            success: true,
            roles: result.rows,
        });
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ error: 'Server error while fetching roles' });
    }
};

// Create new role
const createRole = async (req, res) => {
    try {
        const { name, display_name, description, permissions } = req.body;

        if (!name || !display_name) {
            return res.status(400).json({ error: 'Name and display name are required' });
        }

        const result = await pool.query(
            'INSERT INTO roles (name, display_name, description, permissions) VALUES ($1, $2, $3, $4) RETURNING *',
            [name.toLowerCase().replace(/\s+/g, '_'), display_name, description, JSON.stringify(permissions || [])]
        );

        res.status(201).json({
            success: true,
            role: result.rows[0],
        });
    } catch (error) {
        console.error('Create role error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Role name already exists' });
        }
        res.status(500).json({ error: 'Server error while creating role' });
    }
};

// Update role
const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { display_name, description, permissions } = req.body;

        // Check if role exists and if it's a system role
        const currentRole = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (currentRole.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // System roles can only have certain fields updated (or not at all, but let's allow display_name/desc)
        const result = await pool.query(
            'UPDATE roles SET display_name = $1, description = $2, permissions = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [display_name, description, JSON.stringify(permissions || []), id]
        );

        res.json({
            success: true,
            role: result.rows[0],
        });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Server error while updating role' });
    }
};

// Delete role
const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if it's a system role
        const roleCheck = await pool.query('SELECT is_system, name FROM roles WHERE id = $1', [id]);
        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        if (roleCheck.rows[0].is_system) {
            return res.status(403).json({ error: 'System roles cannot be deleted' });
        }

        // Check if role is in use
        const usersCount = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', [roleCheck.rows[0].name]);
        if (parseInt(usersCount.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Cannot delete role because it is assigned to users' });
        }

        await pool.query('DELETE FROM roles WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Role deleted successfully',
        });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ error: 'Server error while deleting role' });
    }
};

module.exports = {
    getAllRoles,
    createRole,
    updateRole,
    deleteRole,
};
