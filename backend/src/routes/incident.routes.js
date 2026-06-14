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

// Get current user's own complaints
router.get('/my', protect, incidentController.getMyIncidents);

// Get safety heatmap for routing (accessible to logged-in users)
router.get('/heatmap', protect, incidentController.getHeatmap);

// Get specific incident details (accessible to reporter or admins/B2G/CorporateAdmin)
router.get('/:id', protect, incidentController.getById);

// Update status, team reply, and action for an incident (Admin and B2G dispatcher only)
router.patch('/:id', protect, authorize('SuperAdmin', 'B2G'), incidentController.updateStatus);

// List incidents (Admin, B2G, and CorporateAdmin only)
router.get('/', protect, authorize('SuperAdmin', 'B2G', 'CorporateAdmin'), incidentController.getList);

module.exports = router;
