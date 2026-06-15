const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Profile details
router.get('/', protect, profileController.getProfile);
router.patch('/', protect, profileController.updateProfile);

// User listings & details (Admin/B2G)
router.get('/users', protect, authorize('SuperAdmin', 'B2G'), profileController.getAllUsers);
router.get('/users/:userId', protect, authorize('SuperAdmin', 'B2G'), profileController.getUserDetails);

// Contacts / Guardians management
router.post('/contacts', protect, profileController.addTrustedContact);
router.delete('/contacts/:contactId', protect, profileController.removeTrustedContact);

// Guardian remote options
router.get('/guardian/alerts', protect, profileController.getGuardianAlerts);
router.get('/guardian/locations', protect, profileController.getGuardianLocations);
router.post('/guardian/request-location/:userId', protect, profileController.requestLocationFromUser);
router.post('/guardian/trigger-alert/:userId', protect, profileController.triggerAlertForUser);

module.exports = router;
