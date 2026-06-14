const { IS_MOCK_MAPS, GOOGLE_MAPS_API_KEY } = require('../config/maps');
const Incident = require('../models/Incident');

/**
 * Verified address from coordinates using Google Geocoding API
 * @param {number} lng 
 * @param {number} lat 
 * @returns {Promise<string>} Address string
 */
const verifyCoordinates = async (lng, lat) => {
  if (IS_MOCK_MAPS) {
    // Return mock address based on coordinates
    return `Mock Area, Coordinate Section (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return 'Unknown Location (Geocode failed)';
  } catch (error) {
    console.error('Google Maps Geocoding API call failed:', error.message);
    return 'Coordinates Verification Offline';
  }
};

/**
 * Generate heatmaps for predictive routing
 * Aggregates incidents near a given center point and calculates safety scores
 * @param {number} lng - Center longitude
 * @param {number} lat - Center latitude
 * @param {number} radiusMeters - Search radius
 */
const getSafetyHeatmap = async (lng, lat, radiusMeters = 5000) => {
  try {
    // 1. Fetch incidents within a radius using Mongoose spatial query
    const incidents = await Incident.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: radiusMeters
        }
      }
    });

    // 2. Aggregate and score density
    // Group incidents into minor spatial grids (approx 100m grid cells) to make route planning easier
    const gridCells = {};
    const weightMap = {
      harassment: 2,
      stalking: 3,
      domestic_violence: 4,
      physical_assault: 5,
      kidnapping: 5,
      other: 1
    };

    incidents.forEach((incident) => {
      const [iLng, iLat] = incident.location.coordinates;
      // Round coordinates to ~100m resolution (3 decimal places is ~110m)
      const gridKey = `${iLng.toFixed(3)},${iLat.toFixed(3)}`;

      if (!gridCells[gridKey]) {
        gridCells[gridKey] = {
          coordinates: [parseFloat(iLng.toFixed(3)), parseFloat(iLat.toFixed(3))],
          incidentCount: 0,
          dangerWeight: 0,
          categories: new Set()
        };
      }

      gridCells[gridKey].incidentCount += 1;
      gridCells[gridKey].dangerWeight += weightMap[incident.category] || 1;
      gridCells[gridKey].categories.add(incident.category);
    });

    // Format output
    const heatPoints = Object.values(gridCells).map((cell) => ({
      location: {
        type: 'Point',
        coordinates: cell.coordinates
      },
      intensity: cell.dangerWeight,
      incidentCount: cell.incidentCount,
      primaryThreats: Array.from(cell.categories)
    }));

    return {
      center: [lng, lat],
      radiusMeters,
      totalIncidentsNearby: incidents.length,
      heatPoints
    };
  } catch (error) {
    console.error('Error generating safety heatmap:', error);
    throw error;
  }
};

module.exports = {
  verifyCoordinates,
  getSafetyHeatmap
};
