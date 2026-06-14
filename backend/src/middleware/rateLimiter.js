const { redisClient } = require('../config/redis');

/**
 * Redis-based Rate Limiter Middleware
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Max number of requests allowed in the window
 * @param {string} message - Error message on block
 */
const rateLimiter = (windowMs = 60000, max = 10, message = 'Too many requests, please try again later.') => {
  return async (req, res, next) => {
    // Unique key identifier: user IP + path + (body.phone/cnic if available to block targeted bruteforce)
    const identifier = req.body && (req.body.phone || req.body.cnic)
      ? `${req.ip}:${req.body.phone || req.body.cnic}`
      : req.ip;
    
    const key = `rate_limit:${identifier}:${req.baseUrl || ''}${req.path}`;

    try {
      // Check if redisClient is connected
      if (redisClient.status === 'ready') {
        const currentRequests = await redisClient.incr(key);

        if (currentRequests === 1) {
          // New window, set expiry
          await redisClient.pexpire(key, windowMs);
        }

        if (currentRequests > max) {
          return res.status(429).json({
            success: false,
            error: message,
            retryAfterMs: await redisClient.pttl(key)
          });
        }
      } else {
        // Fallback if Redis is temporarily offline (prevents blocking users, or fallback to simple memory block)
        console.warn('Redis is offline. Bypassing rate limiter check.');
      }
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Do not block request if rate limiter itself fails
    }
  };
};

module.exports = rateLimiter;
