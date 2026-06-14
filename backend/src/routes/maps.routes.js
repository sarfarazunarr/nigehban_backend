const express = require('express');
const router = express.Router();
const mapsController = require('../controllers/maps.controller');
const { protect } = require('../middleware/auth');

router.get('/safety', protect, mapsController.checkRouteSafety);

module.exports = router;
