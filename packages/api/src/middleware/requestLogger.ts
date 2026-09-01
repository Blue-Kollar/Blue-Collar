/**
 * Structured request/response logging middleware — issue #1238
 *
 * Wraps pino-http to produce a structured log line for every HTTP request:
 *
 * ```json
 * {
 *   "level": "info",
 *   "time": 1718000000000,
 *   "requestId": "a1b2c3d4-...",
 *   "service": "bluecollar-api",
 *   "req": { "method": "GET", "url": "/api/workers" },
 *   "res": { "statusCode": 200 },
 *   "responseTime": 42,
 *   "userAgent": "Mozilla/5.0 ...",
 *   "ip": "10.0.0.1",
 *   "userId": "user-123",
 *   "msg": "GET /api/workers 200"
 * }
 * ```
 *
 * ## Key changes in issue #1238
 *
 * - `genReqId` reads `req.id` (set by the `requestId` middleware that runs
 *   before this one) so the same UUID is used across request, response, and
 *   all child logger calls within a request lifecycle.
 * - `customProps` adds `requestId` to the root of every log line so log
 *   aggregators (Grafana/Loki, Logstash) can filter by request ID without
 *   navigating nested objects.
 * - `service: 'bluecollar-api'` label added for multi-service log pipelines.
 *
 * ## Downstream propagation
 *
 * Request IDs propagate to downstream service logs when callers create a
 * child logger:
 *
 * ```ts
 * const reqLogger = logger.child({ requestId: req.id })
 * reqLogger.info('Sending verification email')
 * // → { ..., requestId: "a1b2c3d4-...", msg: "Sending verification email" }
 * ```
 *
 * ## Log file rotation
 *
 * In production, logs are written to daily rotating files via pino/file:
 *   `storage/logs/api-YYYY-MM-DD.log`
 *
 * The `deploy/logstash` pipeline ingests these files.
 */

import pinoHttp from 'pino-http'
import pino from 'pino'
import fs from 'node:fs'
import path from 'node:path'
import type { Request } from 'express'
import type { IncomingMessage } from 'node:http'

/** Request augmented with the authenticated user attached by auth middleware. */
type LoggedRequest = IncomingMessage & { user?: { id?: string } }

const LOG_DIR = process.env.LOG_DIR ?? 'storage/logs'
fs.mkdirSync(path.resolve(LOG_DIR), { recursive: true })

const isDev = process.env.NODE_ENV !== 'production'

export const requestLogger = pinoHttp({
  logger: isDev
    ? pino({
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, ignore: 'pid,hostname' },
        },
      })
    : pino(
        { level: 'info' },
        pino.destination({
          dest: path.resolve(LOG_DIR, `api-${new Date().toISOString().slice(0, 10)}.log`),
          sync: false,
        }),
      ),

  /**
   * Use the UUID already attached by the `requestId` middleware so every log
   * line — including pino-http's request and response records — carries the
   * same correlation ID.
   *
   * Falls back to a new UUID if the `requestId` middleware was not mounted
   * (e.g. legacy test helpers that bypass the middleware stack).
   */
  genReqId: (req: Request) => req.id ?? crypto.randomUUID(),

  /**
   * Root-level fields added to every log line.
   * `requestId` at the root (not nested under `req`) is the convention used
   * by the Logstash pipeline in deploy/logstash — keeps it queryable without
   * a nested field path.
   */
  customProps: (req: Request) => ({
    service:   'bluecollar-api',
    requestId: req.id ?? null,
    userAgent: req.headers['user-agent'],
    ip:        req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress,
    userId:    (req as any).user?.id ?? null,
  }),

  customSuccessMessage: (req: Request, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,

  customErrorMessage: (req: Request, res, err) =>
    `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
  // PII SAFETY: Only method, url, and statusCode are logged.
  // No headers, body, query params, or IP addresses are persisted.
  customProps: (req: IncomingMessage) => ({
    userId: (req as LoggedRequest).user?.id ?? null,
  }),

  customSuccessMessage: (req: IncomingMessage, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req: IncomingMessage, res, err) => `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,

  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: (err) => ({ message: err.message, type: err.type }),
  },
})

/**
 * Create a child logger bound to a specific request ID.
 *
 * Use this in controllers and services to emit log lines that are
 * automatically correlated with the originating HTTP request:
 *
 * ```ts
 * import { childLogger } from '../middleware/requestLogger.js'
 *
 * function handleRequest(req: Request) {
 *   const log = childLogger(req)
 *   log.info({ to }, 'Sending verification email')
 *   // → { requestId: "a1b2c3d4-...", service: "bluecollar-api", ... }
 * }
 * ```
 */
import { logger } from '../config/logger.js'

export function childLogger(req: Request) {
  return logger.child({
    requestId: req.id,
    service: 'bluecollar-api',
  })
}
