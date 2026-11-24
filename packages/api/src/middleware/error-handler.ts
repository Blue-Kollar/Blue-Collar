import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError, ErrorCode } from '@/utils/app-error.js'
import { logger } from '@/config/logger.js'
import { serializeError } from '@/serializers/error.serializer.js'
import { ErrorMessages } from '@/constants/index.js'

/**
 * Consistent JSON error envelope returned by the central error handler.
 */
export interface ErrorEnvelope {
  status: 'error'
  message: string
  code: number
  errorCode: string
  traceId?: string
  details?: unknown
}

/**
 * Extract a request id from the Express request, if present.
 * Falls back to the `x-request-id` header when `req.id` is not set.
 */
function getRequestId(req: Request): string | undefined {
  const reqWithId = req as Request & { id?: string | number }
  if (reqWithId.id !== undefined && reqWithId.id !== null) {
    return String(reqWithId.id)
  }
  const headerId = req.headers?.['x-request-id']
  if (typeof headerId === 'string' && headerId.length > 0) {
    return headerId
  }
  return undefined
}

/**
 * Flatten a ZodError into a serializable structure of issues.
 */
function flattenZodError(err: ZodError): unknown {
  if (typeof err.flatten === 'function') {
    return err.flatten()
  }
  return err.issues
}

/**
 * Global error handling middleware for Express.
 * Must be registered as the last middleware in the application.
 *
 * Handles:
 * - Operational AppErrors: exposes message, errorCode and details to clients
 * - ZodError: mapped to 400 with flattened issues
 * - Prisma known errors (P2002 unique, P2025 not found): mapped to 409/404
 * - Unexpected errors: logged with full context, returns generic 500
 *
 * Always responds with a consistent JSON envelope:
 * { status: 'error', message, code, errorCode, traceId, details? }
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const traceId = getRequestId(req)

  let statusCode: number
  let message: string
  let errorCode: string
  let details: unknown

  if (err instanceof AppError) {
    statusCode = err.statusCode
    message = err.message
    errorCode = err.errorCode
    details = err.details
  } else if (err instanceof ZodError) {
    statusCode = 400
    message = ErrorMessages.VALIDATION_ERROR ?? 'Validation failed'
    errorCode = ErrorCode.VALIDATION_ERROR ?? 'VALIDATION_ERROR'
    details = flattenZodError(err)
  } else {
    const serialized = serializeError(err)
    statusCode = serialized.statusCode
    message = serialized.body?.message ?? 'Internal server error'
    errorCode = serialized.body?.errorCode ?? ErrorCode.INTERNAL_SERVER_ERROR ?? 'INTERNAL_SERVER_ERROR'
    details = serialized.body?.details
  }

  if (statusCode >= 500) {
    const error = err instanceof Error ? err : new Error(String(err))
    // PII SAFETY: only sanitized fields logged — no headers, body, or query params
    logger.error(
      {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        requestId: traceId,
      },
      '[ERROR]',
    )
  }

  const body: ErrorEnvelope = {
    status: 'error',
    message,
    code: statusCode,
    errorCode,
    traceId,
  }

  if (details !== undefined) {
    body.details = details
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