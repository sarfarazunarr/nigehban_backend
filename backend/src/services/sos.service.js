const SosSession = require('../models/SosSession');
const User = require('../models/User');
const { redisClient } = require('../config/redis');
const pusher = require('../config/pusher');

/**
 * Initiates an SOS Session in both Redis and MongoDB.
 * @param {string} userId - Reporting User ID
 * @param {Array<number>} initialCoordinates - [longitude, latitude]
 */
const startSosSession = async (userId, initialCoordinates) => {
  // Find user and their trusted contacts
  const user = await User.findById(userId).populate('trustedContacts', '_id phone');
  if (!user) {
    throw new Error('User not found.');
  }

  // 1. Check if there is already an active SOS session
  let session = await SosSession.findOne({ user: userId, active: true });

  const initialCoord = initialCoordinates ? {
    location: {
      type: 'Point',
      coordinates: initialCoordinates
    },
    timestamp: new Date()
  } : null;

  if (!session) {
    // 2. Create SOS Session in MongoDB
    session = await SosSession.create({
      user: userId,
      active: true,
      startTime: new Date(),
      coordinates: initialCoord ? [initialCoord] : [],
      listeningGuardians: user.trustedContacts.map(c => c._id)
    });
  } else if (initialCoord) {
    // Session exists, push coordinate
    session.coordinates.push(initialCoord);
    await session.save();
  }

  // 3. Cache the active SOS status in Redis for sub-millisecond retrieval & Socket room management
  if (redisClient.status === 'ready') {
    const redisData = {
      sessionId: session._id.toString(),
      userId: userId.toString(),
      startTime: session.startTime.toISOString(),
      active: 'true',
      lastLng: initialCoordinates ? initialCoordinates[0].toString() : '',
      lastLat: initialCoordinates ? initialCoordinates[1].toString() : ''
    };
    
    await redisClient.hset(`sos:active:${userId}`, redisData);
    await redisClient.expire(`sos:active:${userId}`, 86400);

    if (initialCoordinates) {
      const pingData = JSON.stringify({
        coordinates: initialCoordinates,
        timestamp: new Date().toISOString()
      });
      await redisClient.rpush(`sos:path:${userId}`, pingData);
      await redisClient.expire(`sos:path:${userId}`, 86400);
    }
  }

  if (initialCoordinates) {
    await User.findByIdAndUpdate(userId, {
      lastLocation: {
        type: 'Point',
        coordinates: initialCoordinates
      }
    });
  }

  // Trigger Pusher alerts for SOS start
  try {
    const coords = initialCoordinates || [0, 0];
    
    // Alert guardians (trusted contacts)
    user.trustedContacts.forEach((contact) => {
      pusher.trigger(`user-notifications-${contact._id}`, 'sos_alert', {
        reporterId: userId.toString(),
        reporterPhone: user.phone,
        coordinates: coords,
        sessionId: session._id.toString()
      }).catch(err => console.error('Pusher SOS alert error:', err.message));
    });

    // Alert dispatch operators
    pusher.trigger('role-B2G', 'sos_dispatch_alert', {
      reporterId: userId.toString(),
      reporterPhone: user.phone,
      coordinates: coords,
      sessionId: session._id.toString()
    }).catch(err => console.error('Pusher dispatch SOS alert error:', err.message));
  } catch (err) {
    console.error('Failed to trigger Pusher alerts for SOS start:', err.message);
  }

  return session;
};

/**
 * Record a location ping during an active SOS
 * @param {string} userId - User ID
 * @param {Array<number>} coordinates - [longitude, latitude]
 */
const pingSosLocation = async (userId, coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new Error('Coordinates must be [longitude, latitude]');
  }

  const [lng, lat] = coordinates;
  const now = new Date();

  // 1. Update active coordinates in Redis cache for instantaneous socket tracking reads
  if (redisClient.status === 'ready') {
    await redisClient.hset(`sos:active:${userId}`, {
      lastLng: lng.toString(),
      lastLat: lat.toString()
    });

    const pingData = JSON.stringify({
      coordinates,
      timestamp: now.toISOString()
    });
    await redisClient.rpush(`sos:path:${userId}`, pingData);
  }

  // 2. Append coordinates to MongoDB immediately so command centers can view updates in real-time
  const session = await SosSession.findOneAndUpdate(
    { user: userId, active: true },
    {
      $push: {
        coordinates: {
          location: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          timestamp: now
        }
      }
    },
    { new: true }
  );

  // Also update User's lastLocation
  await User.findByIdAndUpdate(userId, {
    lastLocation: {
      type: 'Point',
      coordinates
    }
  });

  // Trigger Pusher alert for location ping
  try {
    pusher.trigger(`sos-room-${userId}`, 'location_update', {
      userId: userId.toString(),
      coordinates,
      timestamp: now
    }).catch(err => console.error('Pusher location ping error:', err.message));
  } catch (err) {
    console.error('Failed to trigger Pusher alert for location ping:', err.message);
  }

  return session;
};

/**
 * Closes an active SOS Session
 * Syncs final path state and clears Redis caches
 * @param {string} userId 
 */
const closeSosSession = async (userId) => {
  // 1. Update MongoDB session to inactive
  const session = await SosSession.findOneAndUpdate(
    { user: userId, active: true },
    {
      active: false,
      endTime: new Date()
    },
    { new: true }
  );

  if (!session) {
    console.warn(`No active SOS session found to close for user: ${userId}`);
    return null;
  }

  // 2. Clear Redis cache for the active session
  if (redisClient.status === 'ready') {
    await redisClient.del(`sos:active:${userId}`);
    await redisClient.del(`sos:path:${userId}`);
  }

  // Trigger Pusher alert for SOS closure
  try {
    pusher.trigger(`sos-room-${userId}`, 'sos_resolved', {
      userId: userId.toString(),
      resolvedAt: new Date()
    }).catch(err => console.error('Pusher SOS resolve error:', err.message));
  } catch (err) {
    console.error('Failed to trigger Pusher alert for SOS close:', err.message);
  }

  return session;
};

/**
 * Get active SOS sessions in the database for dispatch screens (B2G Police)
 */
const getActiveSosSessions = async () => {
  return await SosSession.find({ active: true })
    .populate('user', 'phone cnic role name address')
    .populate('listeningGuardians', 'phone cnic');
};

module.exports = {
  startSosSession,
  pingSosLocation,
  closeSosSession,
  getActiveSosSessions
};
