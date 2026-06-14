require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./src/config/db');
const { redisClient } = require('./src/config/redis');
const setupSockets = require('./src/sockets');
const apiRoutes = require('./src/routes');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// 1. Core Security & Request Parsing Middleware
app.use(helmet()); // Set secure HTTP headers
app.use(cors({ origin: '*' })); // CORS configuration (allow all for developer testability)
app.use(express.json()); // Body parser for JSON
app.use(express.urlencoded({ extended: true })); // Body parser for url-encoded

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[HTTP Request] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// 2. Mount API Routes
app.use('/api', apiRoutes);

// Root Route redirect
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Nigehbaan Emergency Backend API is active. Mount under /api.',
    documentation: '/README.md'
  });
});

// 3. 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Resource not found: ${req.method} ${req.originalUrl}`
  });
});

// 4. Global Error Handler Middleware
app.use(errorHandler);

// 5. Initialize Services and Listen
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Setup Socket.io real-time layer
    const io = setupSockets(server);
    app.set('io', io); // Make socket instance accessible to controllers if needed

    // Start HTTP Server
    server.listen(PORT, () => {
      console.log(`===================================================`);
      console.log(`Nigehbaan safety backend running on port: ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===================================================`);
    });
  } catch (error) {
    console.error('Fatal Server Start Error:', error);
    process.exit(1);
  }
};

// 6. Graceful Shutdown Handlers
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP Server closed.');
  });

  try {
    // Close MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
    }

    // Close Redis connection
    if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
      await redisClient.quit();
      console.log('Redis client connection closed.');
    }

    console.log('Graceful shutdown completed. Exiting process.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Launch
startServer();
