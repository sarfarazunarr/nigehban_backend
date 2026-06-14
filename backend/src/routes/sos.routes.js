const express = require('express');
const router = express.Router();
const sosController = require('../controllers/sos.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Manual SOS Trigger and REST tracking backups
router.post('/start', protect, sosController.startSos);
router.post('/ping', protect, sosController.pingLocation);
router.post('/close', protect, sosController.closeSos);

// Admin/Dispatcher views
router.get('/active', protect, authorize('SuperAdmin', 'B2G'), sosController.getActiveSessions);

// Autonomous Local AI Webhook (checks API key in controller, no standard user login required)
router.post('/webhook/ai-sos', sosController.handleAiWebhook);

module.exports = router;
