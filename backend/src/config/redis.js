const Redis = require('ioredis');

const useRedis = process.env.USE_REDIS === 'true';
let redisClient;
let redisOptions = {};

if (useRedis) {
  redisOptions = {
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
  redisClient = new Redis(redisOptions);

  redisClient.on('connect', () => {
    console.log('Redis connected successfully.');
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });
} else {
  console.log('Redis is disabled. App running in MongoDB-only mode.');
  // Return stub object that matches ioredis signature but does not connect
  redisClient = {
    status: 'disabled',
    on: () => {},
    set: async () => 'OK',
    get: async () => null,
    del: async () => 0,
    hset: async () => 0,
    hgetall: async () => ({}),
    rpush: async () => 0,
    expire: async () => 0,
    keys: async () => [],
    quit: async () => 'OK',
    disconnect: () => {}
  };
}

module.exports = {
  redisClient,
  redisOptions
};
