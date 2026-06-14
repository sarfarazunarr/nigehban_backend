const express = require('express');
const router = express.Router();
const syncController = require('../controllers/sync.controller');
const { protect } = require('../middleware/auth');

// Mesh network sync endpoint
router.post('/mesh', protect, syncController.syncMesh);

module.exports = router;
