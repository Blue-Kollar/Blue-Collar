import { AppError, ErrorCode } from '../utils/AppError.js'
import { getTraceId } from '../monitoring/tracing.js'
import { ErrorMessages, HttpStatus } from '../constants/index.js'

export interface ErrorResponse {
  status: 'error'
  message: string
  code: number
  errorCode: ErrorCode
  traceId?: string
  stack?: string
  originalMessage?: string
}

interface PrismaClientKnownRequestError {
  code: string
  meta?: Record<string, unknown>
}

function isPrismaError(err: unknown): err is PrismaClientKnownRequestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string' &&
    (err as Record<string, unknown>).code?.toString().startsWith('P')
  )
}

function mapPrismaError(err: PrismaClientKnownRequestError): { statusCode: number; message: string; errorCode: ErrorCode } {
  switch (err.code) {
    case 'P2002': return { statusCode: HttpStatus.CONFLICT, message: ErrorMessages.DB_DUPLICATE_VALUE, errorCode: ErrorCode.CONFLICT }
    case 'P2025': return { statusCode: HttpStatus.NOT_FOUND, message: ErrorMessages.DB_RECORD_NOT_FOUND, errorCode: ErrorCode.NOT_FOUND }
    case 'P2003': return { statusCode: HttpStatus.BAD_REQUEST, message: ErrorMessages.DB_RELATED_NOT_FOUND, errorCode: ErrorCode.VALIDATION_ERROR }
    default:      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: ErrorMessages.DB_ERROR, errorCode: ErrorCode.INTERNAL_ERROR }
  }
}

export interface SerializedError {
  statusCode: number
  body: ErrorResponse
}

export function serializeError(err: unknown): SerializedError {
  const traceId = getTraceId()

  if (err instanceof Error && err.message.startsWith('CORS:')) {
    return {
      statusCode: HttpStatus.FORBIDDEN,
      body: { status: 'error', message: ErrorMessages.FORBIDDEN, code: HttpStatus.FORBIDDEN, errorCode: ErrorCode.FORBIDDEN },
    }
  }

  if (isPrismaError(err)) {
    const { statusCode, message, errorCode } = mapPrismaError(err)
    return { statusCode, body: { status: 'error', message, code: statusCode, errorCode, traceId } }
  }

  if (err instanceof AppError && err.isOperational) {
    // PII SAFETY: operational errors only expose the error message and code — no user data
    return {
      statusCode: err.statusCode,
      body: { status: 'error', message: err.message, code: err.statusCode, errorCode: err.errorCode, traceId },
    }
  }

  // PII SAFETY: unexpected errors return a generic message without any
  // request context, user data, or internal details. Stack traces are
  // only included in development and are logged server-side only.
  const error = err instanceof Error ? err : new Error(String(err))
  const body: ErrorResponse = {
    status: 'error',
    message: ErrorMessages.INTERNAL_SERVER_ERROR,
    code: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: ErrorCode.INTERNAL_ERROR,
    traceId,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack, originalMessage: error.message }),
  }
  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, body }
}
