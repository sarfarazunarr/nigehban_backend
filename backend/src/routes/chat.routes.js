const express = require('express');
const router = express.Router();
const multer = require('multer');
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

router.get('/history', protect, chatController.getChatHistory);
router.get('/active', protect, authorize('SuperAdmin', 'B2G'), chatController.getActiveChats);
router.post('/close', protect, authorize('SuperAdmin', 'B2G'), chatController.closeHumanSession);
router.post('/message', protect, upload.single('media'), chatController.sendMessage);
router.post('/reply', protect, authorize('SuperAdmin', 'B2G'), chatController.replyMessage);

module.exports = router;
