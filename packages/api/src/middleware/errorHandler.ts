import type { Request, Response, NextFunction } from 'express'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { logger } from '../config/logger.js'
import { serializeError } from '../serializers/error.serializer.js'
import { ErrorMessages } from '../constants/index.js'

/**
 * Global error handling middleware for Express.
 * Must be registered as the last middleware in the application.
 *
 * Handles:
 * - Operational AppErrors: exposes message and errorCode to clients
 * - Prisma known errors (P2002 unique, P2025 not found): mapped to 409/404
 * - Unexpected errors: logged with full context, returns generic 500
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const { statusCode, body } = serializeError(err)

  if (statusCode >= 500) {
    const error = err instanceof Error ? err : new Error(String(err))
    // PII SAFETY: only sanitized fields logged — no headers, body, or query params
    logger.error({ message: error.message, stack: error.stack, url: req.url, method: req.method }, '[ERROR]')
  }

  return res.status(statusCode).json(body)
}

/**
 * Middleware to handle 404 Not Found errors for unmatched routes.
 * Register after all route handlers but before errorHandler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(ErrorMessages.ROUTE_NOT_FOUND(req.method, req.url), 404, true, ErrorCode.NOT_FOUND))
}
