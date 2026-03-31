const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
}); 

// Fetch public testimonials
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                t.*, 
                u.first_name, 
                u.last_name, 
                c.name as course_name
            FROM testimonials t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN courses c ON t.course_id = c.id
            WHERE t.is_approved = TRUE
            ORDER BY t.created_at DESC
            LIMIT 10
        `);
        
        const formatter = result.rows.map(row => ({
            id: row.id,
            name: `${row.first_name} ${row.last_name || ''}`.trim(),
            location: 'Branch Student', // Can derive from branch if wanted
            rating: row.rating,
            comment: row.comment,
            course: row.course_name || 'Driving Course',
            videoUrl: row.video_url,
            imageUrl: row.image_url,
            isFeatured: row.is_featured
        }));
        
        res.json({ success: true, testimonials: formatter });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Submit a new testimonial
router.post('/', authenticateToken, upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
    try {
        const { rating, comment, booking_id, course_id } = req.body;
        let videoUrl = req.body.videoUrl || null;
        let imageUrl = null;
        const user_id = req.user.id;
        
        // If a file was uploaded, use its path instead
        if (req.files) {
            if (req.files.videoFile && req.files.videoFile.length > 0) {
                videoUrl = `/uploads/${req.files.videoFile[0].filename}`;
            }
            if (req.files.imageFile && req.files.imageFile.length > 0) {
                imageUrl = `/uploads/${req.files.imageFile[0].filename}`;
            }
        }
        
        // We could verify the user has actually completed a booking

        await pool.query(
            `INSERT INTO testimonials (user_id, course_id, booking_id, rating, comment, video_url, image_url, is_approved)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
            [user_id, course_id || null, booking_id || null, rating, comment, videoUrl, imageUrl]
        );
        
        res.json({ success: true, message: 'Testimonial submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Feature a specific testimonial (and unfeature all others)
// Toggle feature status for a testimonial (up to 5 total)
router.put('/:id/feature', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check current status
        const currentRes = await pool.query('SELECT is_featured FROM testimonials WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Testimonial not found' });
        }
        
        const isCurrentlyFeatured = currentRes.rows[0].is_featured;
        
        if (!isCurrentlyFeatured) {
            // Check if we already have 5 featured
            const countRes = await pool.query('SELECT COUNT(*) FROM testimonials WHERE is_featured = TRUE');
            const count = parseInt(countRes.rows[0].count);
            
            if (count >= 5) {
                return res.status(400).json({ success: false, message: 'Maximum of 5 featured testimonials reached. Unfeature one to add another.' });
            }
        }
        
        // Toggle
        const newStatus = !isCurrentlyFeatured;
        await pool.query('UPDATE testimonials SET is_featured = $1 WHERE id = $2', [newStatus, id]);
        
        res.json({ success: true, message: newStatus ? 'Testimonial featured' : 'Testimonial unfeatured' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;