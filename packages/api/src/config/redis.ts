import Redis from 'ioredis'

import { logger } from './logger.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

export const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
})

redis.on('connect', () => logger.info('Redis connected'))
redis.on('error', (err) => logger.warn({ err }, 'Redis error — caching disabled'))

// Cache hit/miss metrics (in-memory counters)
export const cacheMetrics = { hits: 0, misses: 0 }

export default redis
