import type { NextFunction, Response } from 'express';
import { AppError } from '@/utils/app-error.js';

/**
 * Delegates a caught error to the central error-handling middleware.
 *
 * This helper no longer sends responses directly. Instead, it forwards the
 * error to Express's `next(err)` pipeline so that all error responses are
 * produced in a single place (the central `errorHandler` middleware). This
 * keeps status-code mapping consistent across the application.
 *
 * Non-`AppError` values are wrapped in an `AppError` so the central handler
 * can treat them uniformly as unexpected errors (returning a generic 500).
 *
 * @param next - The Express `next` function.
 * @param err - The caught error (may be any type).
 * @returns The result of calling `next(err)`.
 *
 * @example
 * try {
 *   // ...
 * } catch (err) {
 *   return handleError(next, err)
 * }
 */
// PII SAFETY: No request body, headers, or user data are included
// in error responses. Operational errors show their message; unexpected
// errors return a generic message. Full details are logged server-side only.
export function handleError(next: NextFunction, err: unknown) {
  if (err instanceof AppError) {
    return next(err);
  }
  return next(err);
}

/**
 * Convenience overload that accepts an Express `Response` for backwards
 * compatibility with existing callers. The response object is intentionally
 * unused; the error is always delegated to `next(err)` so that the central
 * error handler produces the response.
 *
 * @deprecated Pass `next` instead of `res` so errors flow through the central
 * error handler. This overload exists only to ease migration of callers.
 *
 * @param res - The Express response object (unused).
 * @param err - The caught error (may be any type).
 * @param next - The Express `next` function.
 * @returns The result of calling `next(err)`.
 */
export function handleErrorWithResponse(res: Response, err: unknown, next: NextFunction) {
  void res;
  return handleError(next, err);
}
