const express = require('express');
const router = express.Router();
const {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  convertLead,
  addInteraction,
  getAllInteractions,
  getLeadSources,
  createLeadSource,
  updateLeadSource,
  deleteLeadSource,
  getLeadStatuses,
  createLeadStatus,
  updateLeadStatus,
  deleteLeadStatus,
  getCRMStats,
  createLeadFromContact,
  createLeadFromCourseInterest
} = require('../controllers/crmController');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check admin privileges
const isAuthorized = (req, res, next) => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

// --- PUBLIC ROUTES ---
router.post('/public/contact', createLeadFromContact);
router.post('/public/course-interest', createLeadFromCourseInterest);

// --- PRIVATE ROUTES ---
router.use(authenticateToken);
router.use(isAuthorized);

// CRITICAL: Move these to the top of the private stack to ensure they aren't shadowed by /leads/:id
router.get('/stats', getCRMStats);
router.get('/interactions', getAllInteractions);

// Config
router.get('/sources', getLeadSources);
router.get('/statuses', getLeadStatuses);

// Lead Operations
router.get('/leads', getAllLeads);
router.get('/leads/:id', getLeadById);
router.post('/leads', createLead);
router.put('/leads/:id', updateLead);
router.delete('/leads/:id', deleteLead);

// CRM specific actions
router.post('/leads/:id/convert', convertLead);
router.post('/leads/:lead_id/interactions', addInteraction);

// Configuration updates
router.post('/sources', createLeadSource);
router.put('/sources/:id', updateLeadSource);
router.delete('/sources/:id', deleteLeadSource);
router.post('/statuses', createLeadStatus);
router.put('/statuses/:id', updateLeadStatus);
router.delete('/statuses/:id', deleteLeadStatus);

module.exports = router;
