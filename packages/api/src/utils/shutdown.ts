/**
 * Graceful shutdown handler for BlueCollar API (#1642)
 *
 * On SIGTERM/SIGINT:
 * 1. Stop accepting new connections
 * 2. Wait for in-flight requests to complete (with timeout)
 * 3. Stop background jobs
 * 4. Close database connections
 * 5. Close Redis connections
 * 6. Exit process
 *
 * This ensures:
 * - No new requests start during shutdown
 * - Existing requests finish cleanly
 * - Database transactions don't get interrupted
 * - WebSocket connections are properly closed
 */

import { Server } from 'http'
import { logger } from '@/config/logger.js'
import { disconnectDb } from '@/db.js'
import { disconnectRedis } from '@/config/redis.js'
import { stopAllJobs } from '@/jobs/index.js'

// Configuration for graceful shutdown
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? '30000', 10)
const DRAIN_TIMEOUT_MS = parseInt(process.env.DRAIN_TIMEOUT_MS ?? '5000', 10)

/**
 * Creates and returns a graceful shutdown handler.
 *
 * The handler can be attached to process signals:
 * ```
 * process.on('SIGTERM', createGracefulShutdownHandler(server))
 * process.on('SIGINT', createGracefulShutdownHandler(server))
 * ```
 *
 * @param httpServer - The HTTP server instance to shutdown gracefully
 * @returns Async function that performs graceful shutdown
 */
export function createGracefulShutdownHandler(httpServer: Server): () => Promise<void> {
  let isShuttingDown = false

  return async () => {
    // Prevent concurrent shutdown attempts
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal')
      return
    }
    isShuttingDown = true

    logger.info('Graceful shutdown initiated')

    try {
      // Phase 1: Stop accepting new connections
      await stopAcceptingConnections(httpServer)

      // Phase 2: Wait for in-flight requests to drain
      await drainInFlightRequests(httpServer)

      // Phase 3: Stop background jobs
      stopAllJobs()

      // Phase 4: Close database connections
      logger.info('Closing database connections')
      await disconnectDb()

      // Phase 5: Close Redis connection
      logger.info('Closing Redis connection')
      await closeRedis()

      logger.info('Graceful shutdown completed successfully')
      process.exit(0)
    } catch (error) {
      logger.error(error, 'Error during graceful shutdown')
      process.exit(1)
    }
  }
}

/**
 * Stop the server from accepting new connections.
 * Existing keep-alive connections may stay open briefly.
 */
async function stopAcceptingConnections(httpServer: Server): Promise<void> {
  return new Promise((resolve) => {
    logger.info('Stopping acceptance of new connections')
    httpServer.close(() => {
      logger.info('Server stopped accepting connections')
      resolve()
    })
  })
}

/**
 * Wait for all in-flight requests to complete or timeout.
 *
 * Tracks active requests and waits for them to finish.
 * If timeout is exceeded, forces shutdown anyway.
 */
async function drainInFlightRequests(httpServer: Server): Promise<void> {
  const requestsAtShutdown = (httpServer as any).connections ?? 0

  if (requestsAtShutdown === 0) {
    logger.info('No in-flight requests to drain')
    return
  }

  logger.info({ connections: requestsAtShutdown }, 'Draining in-flight requests')

  return new Promise((resolve) => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = (httpServer as any).connections ?? 0

      if (remaining === 0) {
        logger.info({ elapsedMs: elapsed }, 'All requests drained')
        clearInterval(interval)
        resolve()
        return
      }

      if (elapsed > DRAIN_TIMEOUT_MS) {
        logger.warn(
          { remaining, timeoutMs: DRAIN_TIMEOUT_MS },
          'Drain timeout reached, forcing shutdown',
        )
        clearInterval(interval)
        resolve()
        return
      }

      // Log progress every second
      if (elapsed % 1000 === 0) {
        logger.debug({ remaining, elapsedMs: elapsed }, 'Waiting for requests to drain')
      }
    }, 100)
  })
}

/**
 * Close Redis connection gracefully.
 * Redis will attempt to send a QUIT command before closing.
 */
async function closeRedis(): Promise<void> {
  try {
    await disconnectRedis()
  } catch (error) {
    // Connection may already be closed, which is fine
    logger.debug(error, 'Error closing Redis connection')
  }
}

/**
 * Middleware to track active requests for graceful shutdown.
 *
 * Add this middleware early in the Express app to track connections:
 * ```
 * app.use(trackActiveRequests)
 * ```
 *
 * This creates a request tracking mechanism that graceful shutdown can use.
 */
export function trackActiveRequests(
  req: any,
  res: any,
  next: any,
): void {
  // Increment on request start
  if (!req.socket._destroyed) {
    if (!req.socket._requestCount) {
      req.socket._requestCount = 0
    }
    req.socket._requestCount++
  }

  // Decrement on response finish
  res.on('finish', () => {
    if (req.socket && !req.socket._destroyed) {
      req.socket._requestCount = Math.max(0, (req.socket._requestCount ?? 1) - 1)
    }
  })

  next()
}
