const Redis = require('ioredis');

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: null
};

console.log(`Connecting to Redis at ${redisOptions.host}:${redisOptions.port}...`);
const redisClient = new Redis(redisOptions);

redisClient.on('connect', () => {
  console.log('Redis connected successfully.');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

module.exports = {
  redisClient,
  redisOptions
};
