const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', protect, profileController.getProfile);
router.get('/users', protect, authorize('SuperAdmin', 'B2G'), profileController.getAllUsers);
router.post('/contacts', protect, profileController.addTrustedContact);
router.delete('/contacts/:contactId', protect, profileController.removeTrustedContact);

module.exports = router;
