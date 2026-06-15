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

/**
 * Retrieve route options and check safety for each route
 * @param {string} origin 
 * @param {string} destination 
 */
const getRouteSafety = async (origin, destination) => {
  let routes = [];

  if (IS_MOCK_MAPS) {
    // Generate mock routes based in Islamabad area for testing
    routes = [
      {
        summary: 'Kashmir Highway (Srinagar Highway)',
        legs: [{
          distance: { text: '6.2 km', value: 6200 },
          duration: { text: '12 mins', value: 720 },
          start_address: origin,
          end_address: destination,
          steps: [
            { start_location: { lng: 73.0479, lat: 33.6844 }, end_location: { lng: 73.0585, lat: 33.6950 }, html_instructions: 'Head northeast on Srinagar Highway' },
            { start_location: { lng: 73.0585, lat: 33.6950 }, end_location: { lng: 73.0700, lat: 33.7050 }, html_instructions: 'Take the exit toward F-7' }
          ]
        }]
      },
      {
        summary: 'Jinnah Avenue & Khayaban-e-Suhrwardy',
        legs: [{
          distance: { text: '7.8 km', value: 7800 },
          duration: { text: '18 mins', value: 1080 },
          start_address: origin,
          end_address: destination,
          steps: [
            { start_location: { lng: 73.0479, lat: 33.6844 }, end_location: { lng: 73.0420, lat: 33.6700 }, html_instructions: 'Head south toward Jinnah Ave' },
            { start_location: { lng: 73.0420, lat: 33.6700 }, end_location: { lng: 73.0650, lat: 33.6620 }, html_instructions: 'Turn left onto Khayaban-e-Suhrwardy' },
            { start_location: { lng: 73.0650, lat: 33.6620 }, end_location: { lng: 73.0700, lat: 33.7050 }, html_instructions: 'Arrive at destination' }
          ]
        }]
      }
    ];
  } else {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        routes = data.routes.map(r => ({
          summary: r.summary,
          legs: r.legs.map(leg => ({
            distance: leg.distance,
            duration: leg.duration,
            start_address: leg.start_address,
            end_address: leg.end_address,
            steps: leg.steps.map(step => ({
              start_location: step.start_location,
              end_location: step.end_location,
              html_instructions: step.html_instructions
            }))
          }))
        }));
      } else {
        throw new Error(`Directions API error: ${data.status} ${data.error_message || ''}`);
      }
    } catch (error) {
      console.error('Google Maps Directions API call failed, using mock routes:', error.message);
      // Fallback to mock routes if live call fails
      return getRouteSafety('Mock Origin', 'Mock Destination');
    }
  }

  // Analyze safety for each route option
  const analyzedRoutes = await Promise.all(routes.map(async (route, idx) => {
    // 1. Gather all coordinate points in the route steps
    const points = [];
    route.legs.forEach(leg => {
      leg.steps.forEach(step => {
        // Collect start and end locations of steps
        points.push([step.start_location.lng, step.start_location.lat]);
        points.push([step.end_location.lng, step.end_location.lat]);
      });
    });

    if (points.length === 0) {
      return {
        routeIndex: idx,
        summary: route.summary,
        distance: route.legs[0].distance.text,
        duration: route.legs[0].duration.text,
        safetyStatus: 'safe',
        safetyAssessment: 'No path coordinates found to analyze.',
        nearbyIncidentsCount: 0,
        nearbyIncidents: []
      };
    }

    // 2. Compute bounding box for query optimization
    const lngs = points.map(p => p[0]);
    const lats = points.map(p => p[1]);
    const minLng = Math.min(...lngs) - 0.005; // expand bounding box by 500m
    const maxLng = Math.max(...lngs) + 0.005;
    const minLat = Math.min(...lats) - 0.005;
    const maxLat = Math.max(...lats) + 0.005;

    // 3. Find incidents inside the bounding box
    const candidateIncidents = await Incident.find({
      'location.coordinates.0': { $gte: minLng, $lte: maxLng },
      'location.coordinates.1': { $gte: minLat, $lte: maxLat }
    }).populate('reporter', 'phone cnic role');

    // 4. Check distance from candidate incidents to any route point
    // 500 meters is approximately 0.0045 decimal degrees
    const safetyThreshold = 0.0045; 
    const nearbyIncidents = [];

    candidateIncidents.forEach(incident => {
      const [incLng, incLat] = incident.location.coordinates;
      
      // Calculate min distance to any point along the route
      let minDistance = Infinity;
      for (const [ptLng, ptLat] of points) {
        const dist = Math.sqrt(Math.pow(incLng - ptLng, 2) + Math.pow(incLat - ptLat, 2));
        if (dist < minDistance) {
          minDistance = dist;
        }
      }

      if (minDistance <= safetyThreshold) {
        nearbyIncidents.push({
          id: incident._id,
          category: incident.category,
          coordinates: incident.location.coordinates,
          description: incident.description,
          status: incident.status,
          distanceMeters: Math.round(minDistance * 111000) // approx meters
        });
      }
    });

    // Determine status - safety status evaluations are disabled
    let safetyStatus = 'unrated';
    let safetyAssessment = 'Route safety rating is temporarily disabled.';

    return {
      routeIndex: idx,
      summary: route.summary,
      distance: route.legs[0].distance.text,
      duration: route.legs[0].duration.text,
      safetyStatus,
      safetyAssessment,
      nearbyIncidentsCount: 0,
      nearbyIncidents: [],
      steps: route.legs[0].steps
    };
  }));

  return analyzedRoutes;
};

module.exports = {
  verifyCoordinates,
  getSafetyHeatmap,
  getRouteSafety
};
