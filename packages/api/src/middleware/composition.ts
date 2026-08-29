import type { RequestHandler } from "express";
import { authenticate, authorize } from "./auth.js";
import { validate } from "./validate.js";
import type { ZodSchema } from "zod";

/**
 * Compose authenticate + optional authorize into a single middleware array.
 *
 * @example
 * router.get('/mine', withAuth('curator'), handler)
 * router.get('/public-ish', withAuth(), handler)  // any authenticated user
 */
export function withAuth(...roles: string[]): RequestHandler[] {
  const mw: RequestHandler[] = [authenticate];
  if (roles.length > 0) {
    mw.push(authorize(...roles));
  }
  return mw;
}

/**
 * Compose authenticate + authorize + validate into a single middleware array.
 *
 * @example
 * router.post('/', withAuthAndValidation('curator', createWorkerRules), handler)
 */
export function withAuthAndValidation(
  role: string,
  schema: ZodSchema
): RequestHandler[] {
  return [authenticate, authorize(role), validate(schema)];
}
