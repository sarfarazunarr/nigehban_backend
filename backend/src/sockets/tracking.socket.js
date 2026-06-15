const User = require('../models/User');
const sosService = require('../services/sos.service');
const { redisClient } = require('../config/redis');

module.exports = (io, socket) => {
  /**
   * Start / Trigger an SOS session over WebSockets
   */
  socket.on('trigger_sos', async (data, callback) => {
    try {
      const coordinates = data && data.coordinates ? data.coordinates : null;
      console.log(`[Socket SOS] SOS triggered by user: ${socket.user._id} (${socket.user.phone})`);

      // Start SOS in database and Redis
      const session = await sosService.startSosSession(socket.user._id, coordinates);

      // Join the private SOS room
      const roomName = `sos:room:${socket.user._id}`;
      socket.join(roomName);

      // Broadcast alert to trusted contacts if online
      socket.user.trustedContacts.forEach((contactId) => {
        io.to(`user:notifications:${contactId}`).emit('sos_alert', {
          reporterId: socket.user._id,
          reporterPhone: socket.user.phone,
          coordinates,
          sessionId: session._id
        });
      });

      // Broadcast alert to B2G (police dispatch) rooms
      io.to('role:B2G').emit('sos_dispatch_alert', {
        reporterId: socket.user._id,
        reporterPhone: socket.user.phone,
        coordinates,
        sessionId: session._id
      });

      if (callback) {
        callback({ success: true, sessionId: session._id });
      }
    } catch (error) {
      console.error('Socket trigger_sos error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * High-frequency GPS ping from client
   */
  socket.on('location_ping', async (data, callback) => {
    try {
      const { coordinates } = data;
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new Error('Coordinates must be an array of [lng, lat]');
      }

      // Update Redis and MongoDB via service
      await sosService.pingSosLocation(socket.user._id, coordinates);

      // Broadcast location to all listeners in this user's tracking room
      const roomName = `sos:room:${socket.user._id}`;
      io.to(roomName).emit('location_update', {
        userId: socket.user._id,
        coordinates,
        timestamp: new Date()
      });

      if (callback) callback({ success: true });
    } catch (error) {
      console.error('Socket location_ping error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * End an active SOS session
   */
  socket.on('resolve_sos', async (callback) => {
    try {
      console.log(`[Socket SOS] SOS resolved by user: ${socket.user._id}`);
      const session = await sosService.closeSosSession(socket.user._id);

      const roomName = `sos:room:${socket.user._id}`;
      // Notify all listening guardians / dispatchers that SOS is resolved
      io.to(roomName).emit('sos_resolved', {
        userId: socket.user._id,
        resolvedAt: new Date()
      });

      // Leave the room
      socket.leave(roomName);

      if (callback) callback({ success: true });
    } catch (error) {
      console.error('Socket resolve_sos error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Subscribe to a user's live safety track (Guardians/Police Dispatch only)
   * Implements STRICT permission control checks
   */
  socket.on('subscribe_tracking', async (data, callback) => {
    try {
      const { targetUserId } = data;
      if (!targetUserId) {
        throw new Error('Target User ID is required.');
      }

      // Fetch the target user details
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        throw new Error('Target user not found.');
      }

      // 1. Permission checks
      let isAuthorized = false;

      // SuperAdmin or B2G dispatcher has absolute access
      if (['SuperAdmin', 'B2G'].includes(socket.user.role)) {
        isAuthorized = true;
      }
      // Guardian is authorized if they are in the target user's trustedContacts list
      else if (socket.user.role === 'Guardian') {
        const isTrusted = targetUser.trustedContacts.some(
          (contactId) => contactId.toString() === socket.user._id.toString()
        );
        if (isTrusted) {
          isAuthorized = true;
        }
      }
      // Corporate admin authorized only if tracking is globally enabled for users (for commute logs)
      else if (socket.user.role === 'CorporateAdmin' && targetUser.trackingEnabled) {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        throw new Error('Unauthorized to monitor this user. Permission denied.');
      }

      // 2. Join the target user's SOS tracking room
      const roomName = `sos:room:${targetUserId}`;
      socket.join(roomName);
      console.log(`[Socket Subscribe] Listener ${socket.user.phone} joined room ${roomName}`);

      // 3. Return the current SOS active state if available from Redis
      let activeSession = null;
      if (redisClient.status === 'ready') {
        const activeSos = await redisClient.hgetall(`sos:active:${targetUserId}`);
        if (activeSos && activeSos.active === 'true') {
          activeSession = {
            sessionId: activeSos.sessionId,
            startTime: activeSos.startTime,
            lastLocation: activeSos.lastLng && activeSos.lastLat 
              ? [parseFloat(activeSos.lastLng), parseFloat(activeSos.lastLat)]
              : null
          };
        }
      }

      if (callback) {
        callback({
          success: true,
          message: `Successfully subscribed to tracking room for user ${targetUserId}`,
          activeSession
        });
      }
    } catch (error) {
      console.error('Socket subscribe_tracking error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Leave a user's tracking room
   */
  socket.on('unsubscribe_tracking', (data, callback) => {
    try {
      const { targetUserId } = data;
      const roomName = `sos:room:${targetUserId}`;
      socket.leave(roomName);
      console.log(`[Socket Unsubscribe] Listener ${socket.user.phone} left room ${roomName}`);
      if (callback) callback({ success: true });
    } catch (error) {
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Guardian requests user's location
   */
  socket.on('guardian_request_location', async (data, callback) => {
    try {
      const { targetUserId } = data;
      if (!targetUserId) {
        throw new Error('Target User ID is required.');
      }

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        throw new Error('Target user not found.');
      }

      // Check authorization: target user must have added this guardian
      const isLinked = targetUser.trustedContacts.some(
        (contactId) => contactId.toString() === socket.user._id.toString()
      );
      if (!isLinked && !['SuperAdmin', 'B2G'].includes(socket.user.role)) {
        throw new Error('Unauthorized to request location for this user.');
      }

      // Emit notification to user if online
      io.to(`user:notifications:${targetUserId}`).emit('location_request_received', {
        requestedBy: {
          _id: socket.user._id,
          phone: socket.user.phone,
          name: socket.user.name || 'Guardian'
        }
      });

      console.log(`[Socket Guardian] Guardian ${socket.user.phone} requested location for ward: ${targetUserId}`);

      if (callback) {
        callback({
          success: true,
          lastLocation: targetUser.lastLocation
        });
      }
    } catch (error) {
      console.error('Socket guardian_request_location error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Guardian triggers alert/SOS on behalf of the user
   */
  socket.on('guardian_trigger_alert', async (data, callback) => {
    try {
      const { targetUserId } = data;
      if (!targetUserId) {
        throw new Error('Target User ID is required.');
      }

      const targetUser = await User.findById(targetUserId).populate('trustedContacts', '_id phone');
      if (!targetUser) {
        throw new Error('Target user not found.');
      }

      // Check authorization
      const isLinked = targetUser.trustedContacts.some(
        (contactId) => contactId.toString() === socket.user._id.toString()
      );
      if (!isLinked && !['SuperAdmin', 'B2G'].includes(socket.user.role)) {
        throw new Error('Unauthorized to trigger alert for this user.');
      }

      const initialCoords = targetUser.lastLocation && targetUser.lastLocation.coordinates
        ? targetUser.lastLocation.coordinates
        : [0, 0];

      // Start SOS session
      const session = await sosService.startSosSession(targetUserId, initialCoords);

      // Broadcast alert to trusted contacts if online
      targetUser.trustedContacts.forEach((contactId) => {
        io.to(`user:notifications:${contactId}`).emit('sos_alert', {
          reporterId: targetUserId,
          reporterPhone: targetUser.phone,
          coordinates: initialCoords,
          sessionId: session._id
        });
      });

      // Broadcast alert to B2G (police dispatch) rooms
      io.to('role:B2G').emit('sos_dispatch_alert', {
        reporterId: targetUserId,
        reporterPhone: targetUser.phone,
        coordinates: initialCoords,
        sessionId: session._id
      });

      console.log(`[Socket Guardian] Guardian ${socket.user.phone} triggered SOS alert on behalf of ward: ${targetUserId}`);

      if (callback) {
        callback({ success: true, sessionId: session._id });
      }
    } catch (error) {
      console.error('Socket guardian_trigger_alert error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });
};
