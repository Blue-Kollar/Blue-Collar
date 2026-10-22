/**
 * Request-ID middleware — issue #1238
 *
 * Generates a unique request ID for every incoming HTTP request and:
 *   1. Attaches it to `req.id` so downstream handlers can log it
 *   2. Sets the `X-Request-ID` response header so clients can correlate
 *      browser/mobile traces with server logs
 *   3. Honours an inbound `X-Request-ID` header so upstream proxies or
 *      API gateways can inject their own trace IDs (e.g. AWS ALB, Nginx)
 *
 * ## Usage
 *
 * ```ts
 * import { requestId } from './middleware/requestId.js'
 *
 * app.use(requestId)          // mount before requestLogger
 * app.use(requestLogger)      // requestLogger reads req.id automatically
 * ```
 *
 * ## Downstream propagation
 *
 * The ID is also available in child loggers via `logger.child({ requestId })`.
 * `requestLogger.ts` binds it via the `genReqId` hook so every pino-http
 * log line carries `{ requestId }`.
 *
 * ### Logstash configuration
 * The field name `requestId` is mapped in `deploy/logstash/pipeline.conf`
 * under the `json` filter so it becomes a first-class queryable field:
 *
 * ```
 * filter {
 *   json { source => "message" }
 *   mutate { rename => { "requestId" => "[@metadata][request_id]" } }
 * }
 * ```
 */

import { randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'

// Extend Express's Request type so `req.id` is typed throughout the codebase.
declare global {
  namespace Express {
    interface Request {
      /** Unique request ID — set by the requestId middleware. */
      id: string
    }
  }
}

/**
 * Assign a UUID to every request.
 *
 * Checks the inbound `X-Request-ID` header first so upstream load-balancers
 * or API gateways can supply their own correlation IDs.  If absent, generates
 * a new UUID v4.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers['x-request-id']
  const id =
    typeof inbound === 'string' && inbound.trim().length > 0
      ? inbound.trim()
      : randomUUID()

  req.id = id
  res.setHeader('X-Request-ID', id)
  next()
}
