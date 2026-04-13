const pool = require('../config/db');
const { sendNewsPromoEmail } = require('../utils/emailService');

// Get all items (News, Events, etc.)
const getAllNews = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT n.*, u.first_name || ' ' || u.last_name as author_name 
       FROM news_events n
       LEFT JOIN users u ON n.author_id = u.id
       ORDER BY n.published_at DESC`
        );
        res.json({ success: true, news: result.rows });
    } catch (error) {
        console.error('Get news error:', error);
        res.status(500).json({ error: 'Server error while fetching news' });
    }
};

// Create item
const createNews = async (req, res) => {
    try {
        const { title, description, content, tag, type, image_url, duration, thumbnail_url } = req.body;
        const authorId = req.user.id;

        const result = await pool.query(
            `INSERT INTO news_events (title, description, content, tag, type, media_url, duration, thumbnail_url, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [title, description, content || description, tag, type, image_url, duration, thumbnail_url, authorId]
        );

        res.status(201).json({
            success: true,
            message: 'Item created successfully',
            news: result.rows[0]
        });
    } catch (error) {
        console.error('Create error:', error);
        res.status(500).json({ error: 'Server error while creating item' });
    }
};

// Update item
const updateNews = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, content, tag, type, image_url, status, duration, thumbnail_url } = req.body;

        const result = await pool.query(
            `UPDATE news_events 
       SET title = $1, description = $2, content = $3, tag = $4, type = $5, media_url = $6, status = $7, duration = $8, thumbnail_url = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
            [title, description, content || description, tag, type, image_url, status || 'published', duration, thumbnail_url, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({
            success: true,
            message: 'Item updated successfully',
            news: result.rows[0]
        });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Server error while updating item' });
    }
};

// Delete item
const deleteNews = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM news_events WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Server error while deleting item' });
    }
};

// Get only promotional videos
const getAllVideos = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM news_events WHERE type = 'Promotional Video' AND status = 'published' ORDER BY published_at DESC");
        res.json({ success: true, videos: result.rows });
    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({ error: 'Server error while fetching videos' });
    }
};

// Broadcast news/promo to all active students
const broadcastNews = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch the news
        const newsResult = await pool.query('SELECT * FROM news_events WHERE id = $1', [id]);
        if (newsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const news = newsResult.rows[0];

        // Fetch all active students and walk-ins who have emails
        const usersResult = await pool.query(`
            SELECT email, first_name 
            FROM users 
            WHERE role IN ('student', 'walkin_student') 
            AND email IS NOT NULL 
            AND status = 'active'
        `);

        if (usersResult.rows.length === 0) {
            return res.status(400).json({ error: 'No active student emails found to broadcast.' });
        }

        // Send email to all asynchronously
        // For larger userbases, you would typically use a message queue
        let sentCount = 0;
        for (const user of usersResult.rows) {
            try {
                await sendNewsPromoEmail(
                    user.email,
                    user.first_name,
                    news.title,
                    news.description || news.content,
                    news.type,
                    news.tag
                );
                sentCount++;
            } catch (err) {
                console.error(`Failed to broadcast to ${user.email}:`, err.message);
            }
        }

        res.json({ success: true, message: `Successfully broadcasted to ${sentCount} students.`, sentCount });
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: 'Server error while broadcasting' });
    }
};

// Increment views/interactions
const incrementInteraction = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'UPDATE news_events SET interactions = COALESCE(CAST(interactions AS INTEGER), 0) + 1 WHERE id = $1 RETURNING interactions',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ success: true, interactions: result.rows[0].interactions });
    } catch (error) {
        console.error('Increment error:', error);
        res.status(500).json({ error: 'Server error while incrementing interaction' });
    }
};

module.exports = {
    getAllNews,
    createNews,
    updateNews,
    deleteNews,
    getAllVideos,
    broadcastNews,
    incrementInteraction
};
