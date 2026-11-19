import { z, ZodSchema } from 'zod'
import type { Request, Response, NextFunction } from 'express'
import {
  MAX_FIELD_LENGTH,
  walletAddressSchema as sharedWalletAddressSchema,
  stellarAmountSchema as sharedStellarAmountSchema,
  boundedString as sharedBoundedString,
  sanitizedString as sharedSanitizedString,
  freeText as sharedFreeText,
} from '@bluecollar/types'

/**
 * Zod-based validate middleware factory (#519).
 * Validates req.body against a Zod schema and returns structured 400 errors.
 *
 * @param schema - A Zod schema to validate against
 * @param target - Which part of the request to validate ('body' | 'query' | 'params')
 */
export function validate(schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target])
    if (!result.success) {
      const errors = result.error.errors.reduce<Record<string, string[]>>((acc, err) => {
        const field = err.path.join('.') || '_root'
        if (!acc[field]) acc[field] = []
        acc[field].push(err.message)
        return acc
      }, {})
      return res.status(422).json({
        status: 'error',
        message: 'Validation failed',
        code: 422,
        errors,
      })
    }
    req[target] = result.data
    next()
  }
}

/**
 * Validates a Stellar public key (G...) or contract address (C...).
 * Re-exported from the shared types package so API and frontend validation
 * stay in sync (#1788).
 */
export const walletAddressSchema = sharedWalletAddressSchema

/**
 * Stellar token amount: positive decimal, max 15 significant digits to prevent
 * overflow / precision attacks on the Market contract.
 * Re-exported from the shared types package (#1788).
 */
export const stellarAmountSchema = sharedStellarAmountSchema

/**
 * Generic string field guard — rejects values exceeding MAX_FIELD_LENGTH.
 * Compose with .min() / .regex() as needed.
 * Re-exported from the shared types package (#1788).
 */
export const boundedString = sharedBoundedString

/**
 * Reusable free-text field builder (#1685).
 * Trims input, enforces the maximum field length, and rejects script tags /
 * other dangerous HTML constructs so free-text fields are sanitised
 * consistently across validation schemas.
 * Re-exported from the shared types package (#1788).
 *
 * @param maxLength - Optional per-field maximum length (defaults to MAX_FIELD_LENGTH)
 */
export const sanitizedString = sharedSanitizedString

/**
 * Alias for {@link sanitizedString} — use for free-text fields such as
 * worker bios and messages.
 */
export const freeText = sharedFreeText

/**
 * Middleware: validate that req.body.walletAddress is a well-formed Stellar address.
 * Use on any route that accepts a wallet address to prevent blockchain-specific injection.
 */
export function validateWalletAddress(req: Request, res: Response, next: NextFunction) {
  const result = walletAddressSchema.safeParse(req.body?.walletAddress)
  if (!result.success) {
    return res.status(422).json({
      status: 'error',
      message: 'Invalid wallet address',
      code: 422,
      errors: { walletAddress: result.error.errors.map((e) => e.message) },
    })
  }
  next()
}
