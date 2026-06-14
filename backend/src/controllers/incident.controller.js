const { z } = require('zod');
const incidentService = require('../services/incident.service');
const mapsService = require('../services/maps.service');

// Zod validation schemas
const createIncidentSchema = z.object({
  category: z.enum(['harassment', 'stalking', 'domestic_violence', 'physical_assault', 'kidnapping', 'other']),
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  description: z.string().optional()
});

const heatmapSchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  radius: z.coerce.number().min(100).max(50000).default(5000) // 100m to 50km radius
});

/**
 * Log a new incident
 */
const create = async (req, res, next) => {
  try {
    const validatedData = createIncidentSchema.parse(req.body);
    const files = req.files || []; // Express multer array upload

    const incident = await incidentService.createIncident(
      req.user._id,
      validatedData.category,
      [validatedData.longitude, validatedData.latitude],
      validatedData.description || '',
      files
    );

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      incident
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get aggregated safety heatmap for predictive routing
 */
const getHeatmap = async (req, res, next) => {
  try {
    const validatedQuery = heatmapSchema.parse(req.query);

    const heatmap = await mapsService.getSafetyHeatmap(
      validatedQuery.longitude,
      validatedQuery.latitude,
      validatedQuery.radius
    );

    res.status(200).json({
      success: true,
      data: heatmap
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get listing of incident logs (Admin/Authorized only)
 */
const getList = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const category = req.query.category;
    const verificationStatus = req.query.verificationStatus;

    const filters = {};
    if (category) filters.category = category;
    if (verificationStatus) filters.verificationStatus = verificationStatus;

    const result = await incidentService.getIncidents(filters, limit, page);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getHeatmap,
  getList
};
