/**
 * Custom error class for operational errors that are safe to expose to clients.
 * Extends the native Error class with additional fields for HTTP status codes
 * and operational error identification.
 */
export class AppError extends Error {
    public readonly statusCode: number
    public readonly isOperational: boolean

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message)
        this.statusCode = statusCode
        this.isOperational = isOperational

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        Error.captureStackTrace(this, this.constructor)

        // Set the prototype explicitly to ensure instanceof checks work correctly
        Object.setPrototypeOf(this, AppError.prototype)
    }
}
