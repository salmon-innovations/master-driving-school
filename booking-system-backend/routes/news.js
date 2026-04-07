const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    next();
};

// Public routes (anyone can see news and videos)
router.get('/', newsController.getAllNews);
router.get('/videos', newsController.getAllVideos);
router.patch('/:id/increment', newsController.incrementInteraction);

// Protected routes (Only admin can post/edit)
router.post('/', authenticateToken, isAdmin, newsController.createNews);
router.put('/:id', authenticateToken, isAdmin, newsController.updateNews);
router.delete('/:id', authenticateToken, isAdmin, newsController.deleteNews);
router.post('/:id/broadcast', authenticateToken, isAdmin, newsController.broadcastNews);

module.exports = router;
