const express = require('express');
const router = express.Router();
const lawController = require('../controllers/law.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// User access endpoints
router.get('/', protect, lawController.getAll);
router.get('/category/:category', protect, lawController.getByCategory);
router.get('/survival-instructions/:category', protect, lawController.getInstructions); // Separate endpoint for instructions
router.get('/precautions/:category', protect, lawController.getPrecautions); // Separate endpoint for precautions

// Admin CRUD management endpoints
router.post('/', protect, authorize('SuperAdmin'), lawController.upsert);
router.delete('/category/:category', protect, authorize('SuperAdmin'), lawController.remove);

module.exports = router;
