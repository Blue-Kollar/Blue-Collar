/**
 * Enumeration of application-level error codes for consistent error identification.
 * These codes are included in error responses to help clients handle errors programmatically.
 */
export enum ErrorCode {
  // Auth
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_NOT_VERIFIED = 'ACCOUNT_NOT_VERIFIED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',

  // Resource
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Custom error class for operational errors that are safe to expose to clients.
 * Extends the native Error class with HTTP status codes, error codes, and
 * operational error identification.
 *
 * @example
 * throw new AppError('User not found', 404, true, ErrorCode.NOT_FOUND)
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly errorCode: ErrorCode

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR,
  ) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.errorCode = errorCode

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    Error.captureStackTrace(this, this.constructor)

    // Set the prototype explicitly to ensure instanceof checks work correctly
    Object.setPrototypeOf(this, AppError.prototype)
  }
}
