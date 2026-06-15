const express = require('express');
const router = express.Router();
const emergencyContactController = require('../controllers/emergencyContact.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', protect, emergencyContactController.getAll);
router.post('/', protect, authorize('SuperAdmin'), emergencyContactController.upsert);
router.delete('/:id', protect, authorize('SuperAdmin'), emergencyContactController.remove);

module.exports = router;
