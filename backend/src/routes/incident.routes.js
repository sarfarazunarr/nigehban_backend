const express = require('express');
const router = express.Router();
const multer = require('multer');
const incidentController = require('../controllers/incident.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

// Create incident (any logged-in user)
router.post('/', protect, upload.array('media', 5), incidentController.create);

// Get safety heatmap for routing (accessible to logged-in users)
router.get('/heatmap', protect, incidentController.getHeatmap);

// List incidents (Admin, B2G, and CorporateAdmin only)
router.get('/', protect, authorize('SuperAdmin', 'B2G', 'CorporateAdmin'), incidentController.getList);

module.exports = router;
