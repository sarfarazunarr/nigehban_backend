const SosSession = require('../models/SosSession');
const User = require('../models/User');
const { redisClient } = require('../config/redis');

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
    // Expire active key after 24 hours to prevent memory leaks if session is never closed
    await redisClient.expire(`sos:active:${userId}`, 86400);

    // If initial coordinates are sent, also cache the path in Redis list
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

  return session;
};

/**
 * Get active SOS sessions in the database for dispatch screens (B2G Police)
 */
const getActiveSosSessions = async () => {
  return await SosSession.find({ active: true })
    .populate('user', 'phone cnic role')
    .populate('listeningGuardians', 'phone cnic');
};

module.exports = {
  startSosSession,
  pingSosLocation,
  closeSosSession,
  getActiveSosSessions
};
