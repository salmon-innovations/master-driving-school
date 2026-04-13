const pool = require('../config/db');

exports.createPackage = async (req, res) => {
    try {
        const { name, description, status, start_date, end_date, applicable_branches, trigger_rule, reward_rule, max_free_qty, is_stackable } = req.body;
        
        if (reward_rule && reward_rule.type === 'TDC' && reward_rule.mode === 'Online') {
            return res.status(400).json({ error: 'Cannot select TDC Online as a reward' });
        }

        const result = await pool.query(
            "INSERT INTO promo_packages (name, description, status, start_date, end_date, applicable_branches, trigger_rule, reward_rule, max_free_qty, is_stackable) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
            [name, description, status, start_date, end_date, JSON.stringify(applicable_branches), JSON.stringify(trigger_rule), JSON.stringify(reward_rule), max_free_qty, is_stackable]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPackages = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM promo_packages ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getActivePackages = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM promo_packages WHERE status = 'active' AND CURRENT_DATE BETWEEN start_date AND end_date ORDER BY created_at DESC"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
