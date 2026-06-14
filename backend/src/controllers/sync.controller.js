const { z } = require('zod');
const User = require('../models/User');
const Incident = require('../models/Incident');
const SosSession = require('../models/SosSession');
const { verifyCoordinates } = require('../services/maps.service');

// Zod schemas for mesh items validation
const meshPingSchema = z.object({
  phone: z.string(),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  timestamp: z.string().transform(str => new Date(str))
});

const meshIncidentSchema = z.object({
  phone: z.string(),
  category: z.enum(['harassment', 'stalking', 'domestic_violence', 'physical_assault', 'kidnapping', 'other']),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  description: z.string().optional(),
  timestamp: z.string().transform(str => new Date(str)),
  mediaUrls: z.array(z.string()).default([])
});

const meshSyncSchema = z.object({
  pings: z.array(meshPingSchema).default([]),
  incidents: z.array(meshIncidentSchema).default([])
});

/**
 * Handle mesh network sync for offline/delayed uploads
 */
const syncMesh = async (req, res, next) => {
  try {
    const validatedData = meshSyncSchema.parse(req.body);
    const { pings, incidents } = validatedData;

    const results = {
      pingsProcessed: 0,
      pingsFailed: 0,
      incidentsProcessed: 0,
      incidentsFailed: 0,
      errors: []
    };

    // 1. Process offline SOS pings
    for (const ping of pings) {
      try {
        const user = await User.findOne({ phone: ping.phone });
        if (!user) {
          throw new Error(`User not found for phone: ${ping.phone}`);
        }

        // Find an active session or a session matching this timeframe (within 2 hours of ping)
        const timeLimitStart = new Date(ping.timestamp.getTime() - 2 * 60 * 60 * 1000);
        const timeLimitEnd = new Date(ping.timestamp.getTime() + 2 * 60 * 60 * 1000);

        let session = await SosSession.findOne({
          user: user._id,
          startTime: { $lte: ping.timestamp },
          $or: [
            { active: true },
            { endTime: { $gte: ping.timestamp } }
          ]
        });

        // If no matching session exists, create a historical closed session to log the path
        if (!session) {
          session = await SosSession.create({
            user: user._id,
            active: false,
            startTime: new Date(ping.timestamp.getTime() - 5000), // set start slightly before ping
            endTime: new Date(ping.timestamp.getTime() + 5000),
            coordinates: []
          });
        }

        // Push coordinate to session path
        session.coordinates.push({
          location: {
            type: 'Point',
            coordinates: [ping.longitude, ping.latitude]
          },
          timestamp: ping.timestamp
        });

        // Keep coordinates sorted by timestamp
        session.coordinates.sort((a, b) => a.timestamp - b.timestamp);

        // Adjust end time if necessary
        if (!session.active && (!session.endTime || session.endTime < ping.timestamp)) {
          session.endTime = new Date(ping.timestamp.getTime() + 5000);
        }

        await session.save();
        results.pingsProcessed += 1;
      } catch (error) {
        results.pingsFailed += 1;
        results.errors.push({ type: 'ping', data: ping, error: error.message });
      }
    }

    // 2. Process offline Incident reports
    for (const inc of incidents) {
      try {
        const user = await User.findOne({ phone: inc.phone });
        if (!user) {
          throw new Error(`User not found for phone: ${inc.phone}`);
        }

        // Verify coords
        const address = await verifyCoordinates(inc.longitude, inc.latitude);
        const finalDesc = inc.description
          ? `${inc.description}\n\n[Sync via Mesh Network - Location verified: ${address}]`
          : `Sync via Mesh Network - Location verified: ${address}`;

        await Incident.create({
          reporter: user._id,
          category: inc.category,
          location: {
            type: 'Point',
            coordinates: [inc.longitude, inc.latitude]
          },
          mediaUrls: inc.mediaUrls,
          description: finalDesc,
          verificationStatus: 'pending',
          timestamp: inc.timestamp
        });

        results.incidentsProcessed += 1;
      } catch (error) {
        results.incidentsFailed += 1;
        results.errors.push({ type: 'incident', data: inc, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Mesh network sync completed',
      results
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  syncMesh
};
