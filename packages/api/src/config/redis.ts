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

/**
 * Gracefully close Redis connection.
 * This should be called during shutdown to ensure pending commands complete.
 */
export async function disconnectRedis(): Promise<void> {
  if (!redis) {
    return
  }

  try {
    // quit() sends QUIT command and closes connection
    await redis.quit()
  } catch (error) {
    // Connection may already be closed or in error state
    logger.debug(error, 'Error closing Redis connection')
    // Try to disconnect anyway
    try {
      redis.disconnect()
    } catch {
      // Ignore errors, connection is being closed regardless
    }
  }
}

export default redis
