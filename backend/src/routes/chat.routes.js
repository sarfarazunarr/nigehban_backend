const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/history', protect, chatController.getChatHistory);
router.get('/active', protect, authorize('SuperAdmin', 'B2G'), chatController.getActiveChats);
router.post('/close', protect, authorize('SuperAdmin', 'B2G'), chatController.closeHumanSession);

module.exports = router;
