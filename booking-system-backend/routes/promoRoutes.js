const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promoController');

router.post('/', promoController.createPackage);
router.get('/', promoController.getPackages);
router.get('/active', promoController.getActivePackages);

module.exports = router;
