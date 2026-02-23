const { createClient } = require('redis');
const logger = require('../utils/logger');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => logger.error('Redis error:', err));

async function connectRedis() {
  await client.connect();
  logger.info('Redis connected');
}

async function get(key) { return client.get(key); }
async function set(key, value, options) { return client.set(key, value, options); }
async function del(key) { return client.del(key); }
async function setEx(key, seconds, value) { return client.setEx(key, seconds, value); }
async function exists(key) { return client.exists(key); }

module.exports = { redis: { get, set, del, setEx, exists, client }, connectRedis };
