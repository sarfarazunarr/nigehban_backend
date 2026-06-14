const Incident = require('../models/Incident');
const { uploadMediaStream } = require('./cloudinary.service');
const { verifyCoordinates } = require('./maps.service');

/**
 * Creates a new incident log with media uploads
 * @param {string} userId - ID of reporting user
 * @param {string} category - Incident category
 * @param {Array<number>} coordinates - [longitude, latitude]
 * @param {string} description - Text description of incident
 * @param {Array<object>} files - Array of files from multer
 */
const createIncident = async (userId, category, coordinates, description, files = []) => {
  // Validate coordinates input
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new Error('Coordinates must be an array of [longitude, latitude].');
  }

  const [lng, lat] = coordinates;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw new Error('Invalid geocoordinates. Longitude [-180, 180], Latitude [-90, 90].');
  }

  // 1. Verify location coordinates using Maps Service
  const verifiedAddress = await verifyCoordinates(lng, lat);
  const updatedDescription = description
    ? `${description}\n\n[Verified Location Address: ${verifiedAddress}]`
    : `Reported at verified location: ${verifiedAddress}`;

  // 2. Upload media files to Cloudinary
  const mediaUrls = [];
  if (files && files.length > 0) {
    console.log(`Uploading ${files.length} incident media file(s) to Cloudinary...`);
    const uploadPromises = files.map((file) => uploadMediaStream(file.buffer, 'nigehbaan_incidents'));
    const uploadResults = await Promise.all(uploadPromises);
    uploadResults.forEach((result) => {
      mediaUrls.push(result.secure_url);
    });
  }

  // 3. Save incident to MongoDB
  const incident = await Incident.create({
    reporter: userId,
    category,
    location: {
      type: 'Point',
      coordinates: [lng, lat]
    },
    mediaUrls,
    description: updatedDescription,
    verificationStatus: 'pending',
    status: 'pending',
    teamReply: '',
    action: ''
  });

  return incident;
};

/**
 * Retrieves incident reports with filtering options
 */
const getIncidents = async (filters = {}, limit = 50, page = 1) => {
  const skip = (page - 1) * limit;
  const incidents = await Incident.find(filters)
    .populate('reporter', 'phone cnic role')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Incident.countDocuments(filters);

  return { incidents, total, page, limit };
};

/**
 * Fetch a single incident by ID
 */
const getIncidentById = async (incidentId) => {
  return await Incident.findById(incidentId).populate('reporter', 'phone cnic role');
};

/**
 * Update incident verification and resolution status (Admin/B2G)
 */
const updateIncidentStatus = async (incidentId, status, teamReply, action) => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  if (status) {
    incident.status = status;
    // Keep legacy verificationStatus synced
    if (status === 'resolved' || status === 'in-progress') {
      incident.verificationStatus = 'verified';
    } else if (status === 'dismissed') {
      incident.verificationStatus = 'dismissed';
    } else {
      incident.verificationStatus = 'pending';
    }
  }

  if (teamReply !== undefined) {
    incident.teamReply = teamReply;
  }
  if (action !== undefined) {
    incident.action = action;
  }

  await incident.save();
  return incident;
};

module.exports = {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncidentStatus
};
