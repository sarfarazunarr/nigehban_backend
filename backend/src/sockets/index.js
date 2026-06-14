const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const User = require('../models/User');
const { redisClient, redisOptions } = require('../config/redis');

// Handlers
const registerTrackingHandlers = require('./tracking.socket');
const registerChatHandlers = require('./chat.socket');

const setupSockets = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: '*', // Allow all origins for testing/development
      methods: ['GET', 'POST']
    }
  });

  // 1. Initialize Redis Adapter for horizontal scaling (if Redis is running)
  if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
    try {
      const pubClient = new Redis(redisOptions);
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.io Redis adapter initialized successfully.');
    } catch (adapterErr) {
      console.error('Socket.io Redis adapter setup failed, falling back to in-memory adapter:', adapterErr.message);
    }
  } else {
    console.log('Redis client not ready. Socket.io running on in-memory adapter.');
  }

  // 2. Authentication Middleware
  io.use(async (socket, next) => {
    try {
      // Allow token to be passed either in handshake auth or headers
      const token = socket.handshake.auth?.token || 
                    socket.handshake.headers['authorization']?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication failed: Token is missing.'));
      }

      // Verify token
      const decoded = jwt.verify(
        token, 
        process.env.JWT_ACCESS_SECRET || 'nigehbaan_access_secret_129847129847'
      );

      // Load user
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication failed: User does not exist.'));
      }

      // Attach user to socket session
      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket authentication error:', err.message);
      return next(new Error('Authentication failed: Invalid or expired token.'));
    }
  });

  // 3. Socket Connection Handler
  io.on('connection', (socket) => {
    console.log(`[Socket Connected] User: ${socket.user.phone} | Role: ${socket.user.role} | Socket ID: ${socket.id}`);

    // Join a self notification room for user-specific targeted events (notifications, direct alerts)
    socket.join(`user:notifications:${socket.user._id}`);

    // Join a role-specific room (e.g. all B2G dispatchers join role:B2G for system wide dispatch broadcasts)
    socket.join(`role:${socket.user.role}`);

    // Register domain specific socket handlers
    registerTrackingHandlers(io, socket);
    registerChatHandlers(io, socket);

    // Disconnect event
    socket.on('disconnect', () => {
      console.log(`[Socket Disconnected] User: ${socket.user.phone} | Socket ID: ${socket.id}`);
    });
  });

  return io;
};

module.exports = setupSockets;
