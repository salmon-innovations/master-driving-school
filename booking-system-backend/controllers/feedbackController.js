const pool = require('../config/db');
exports.submitFeedback = async (req, res) => {
    try {
        const { rating, comment, videoUrl, course_name } = req.body;
        const user_id = req.user.id;
        const newFeedback = await pool.query(
            'INSERT INTO feedbacks (user_id, rating, comment, video_url, course_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user_id, rating, comment, videoUrl || null, course_name]
        );
        res.status(201).json({ success: true, feedback: newFeedback.rows[0] });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getPublicFeedbacks = async (req, res) => {
    try {
        const query = "SELECT f.id, f.rating, f.comment, f.video_url, f.course_name, u.first_name, u.last_name, COALESCE((SELECT name FROM branches WHERE id = u.branch_id LIMIT 1), 'Online') as branch_name FROM feedbacks f JOIN users u ON f.user_id = u.id WHERE f.is_public = true ORDER BY f.created_at DESC LIMIT 10";
        const feedbacks = await pool.query(query);
        res.json({ success: true, feedbacks: feedbacks.rows });
    } catch (error) {
        console.error('Error fetching feedbacks:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

