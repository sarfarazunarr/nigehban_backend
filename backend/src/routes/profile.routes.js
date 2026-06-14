const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { protect } = require('../middleware/auth');

router.get('/', protect, profileController.getProfile);
router.post('/contacts', protect, profileController.addTrustedContact);
router.delete('/contacts/:contactId', protect, profileController.removeTrustedContact);

module.exports = router;
