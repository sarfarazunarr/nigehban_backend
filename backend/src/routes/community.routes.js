const express = require('express');
const router = express.Router();
const communityController = require('../controllers/community.controller');
const { protect } = require('../middleware/auth');

router.post('/alert', protect, communityController.createAlert);
router.post('/alert/:alertId/close', protect, communityController.closeAlert);
router.get('/alerts/nearby', protect, communityController.getNearbyAlerts);
router.post('/alert/:alertId/respond', protect, communityController.respondToAlert);
router.get('/chats', protect, communityController.getChats);
router.get('/chats/:chatId', protect, communityController.getChatById);
router.post('/chats/:chatId/message', protect, communityController.sendChatMessage);

module.exports = router;
