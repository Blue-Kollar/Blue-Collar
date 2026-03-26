import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError.js'

/**
 * Global error handling middleware for Express.
 * Must be registered as the last middleware in the application.
 * 
 * Distinguishes between:
 * - Operational errors: Known, safe to expose to clients (e.g., validation errors, 404s)
 * - Programmer errors: Unexpected errors that should be logged and return generic 500s
 */
export function errorHandler(
    err: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    // Default to 500 Internal Server Error
    let statusCode = 500
    let message = 'Internal Server Error'
    let isOperational = false

    // Check if this is an operational error (AppError instance)
    if (err instanceof AppError) {
        statusCode = err.statusCode
        message = err.message
        isOperational = err.isOperational
    }

    // Log all errors for debugging
    if (!isOperational || statusCode >= 500) {
        console.error('[ERROR]', {
            message: err.message,
            stack: err.stack,
            url: req.url,
            method: req.method,
            statusCode,
            isOperational,
        })
    }

    // For operational errors, send the actual error message
    // For programmer errors, send a generic message to avoid leaking implementation details
    const responseMessage = isOperational ? message : 'Internal Server Error'

    res.status(statusCode).json({
        status: 'error',
        message: responseMessage,
        code: statusCode,
        ...(process.env.NODE_ENV === 'development' && !isOperational && {
            stack: err.stack,
            originalMessage: err.message,
        }),
    })
}

/**
 * Middleware to handle 404 Not Found errors for unmatched routes.
 * Should be registered after all route handlers but before the error handler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
    const error = new AppError(`Route ${req.method} ${req.url} not found`, 404)
    next(error)
}
