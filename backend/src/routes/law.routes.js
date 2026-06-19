const express = require('express');
const router = express.Router();
const lawController = require('../controllers/law.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// User access endpoints
router.get('/', protect, lawController.getAll);
router.get('/category/:category/:language?', protect, lawController.getByCategory);
router.get('/survival-instructions/:category/:language?', protect, lawController.getInstructions);
router.get('/precautions/:category/:language?', protect, lawController.getPrecautions);

// Admin CRUD management endpoints
router.post('/', protect, authorize('SuperAdmin'), lawController.upsert);
router.delete('/category/:category/:language?', protect, authorize('SuperAdmin'), lawController.remove);

module.exports = router;
