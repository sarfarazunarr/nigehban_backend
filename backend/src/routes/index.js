const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const profileRoutes = require('./profile.routes');
const incidentRoutes = require('./incident.routes');
const sosRoutes = require('./sos.routes');
const lawRoutes = require('./law.routes');
const mapsRoutes = require('./maps.routes');
const chatRoutes = require('./chat.routes');
const communityRoutes = require('./community.routes');

// Healthcheck endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date(),
    service: 'Nigehbaan Emergency Backend'
  });
});

// Bind domains
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/incidents', incidentRoutes);
router.use('/sos', sosRoutes);
router.use('/laws', lawRoutes);
router.use('/routes', mapsRoutes);
router.use('/chat', chatRoutes);
router.use('/community', communityRoutes);

module.exports = router;
