const { z } = require('zod');
const mapsService = require('../services/maps.service');

const routeSafetySchema = z.object({
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required')
});

/**
 * Enlist route alternatives and check the safety of each
 */
const checkRouteSafety = async (req, res, next) => {
  try {
    const validatedQuery = routeSafetySchema.parse(req.query);
    const { origin, destination } = validatedQuery;

    const routes = await mapsService.getRouteSafety(origin, destination);

    res.status(200).json({
      success: true,
      data: routes
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkRouteSafety
};
