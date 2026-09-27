import type { Response } from 'express'

export interface ApiResponse<T = unknown> {
  data?: T
  status: 'success' | 'error'
  message?: string
  code: number
}

/**
 * Send a success response with the standard envelope.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { message?: string; statusCode?: number } = {},
): Response {
  const statusCode = options.statusCode ?? 200
  const body: ApiResponse<T> = {
    data,
    status: 'success',
    code: statusCode,
    ...(options.message ? { message: options.message } : {}),
  }
  return res.status(statusCode).json(body)
}

/**
 * Send an error response with the standard envelope.
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
): Response {
  const body: ApiResponse = {
    status: 'error',
    message,
    code: statusCode,
  }
  return res.status(statusCode).json(body)
}
