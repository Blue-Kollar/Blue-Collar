import { z, ZodSchema } from 'zod'
import type { Request, Response, NextFunction } from 'express'

// Maximum field string length — rejects absurdly large individual field values.
const MAX_FIELD_LENGTH = 10_000

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
 * Stellar addresses are 56 characters of base32 encoding.
 */
const STELLAR_ADDRESS_RE = /^[GC][A-Z2-7]{55}$/

export const walletAddressSchema = z
  .string()
  .trim()
  .max(56, 'Stellar address must be exactly 56 characters')
  .regex(STELLAR_ADDRESS_RE, 'Invalid Stellar wallet address')

/**
 * Stellar token amount: positive decimal, max 15 significant digits to prevent
 * overflow / precision attacks on the Market contract.
 */
export const stellarAmountSchema = z
  .string()
  .trim()
  .max(20, 'Amount too large')
  .regex(/^\d{1,15}(\.\d{1,7})?$/, 'Invalid amount: must be a positive decimal with up to 7 decimal places')

/**
 * Generic string field guard — rejects values exceeding MAX_FIELD_LENGTH.
 * Compose with .min() / .regex() as needed.
 */
export const boundedString = z.string().max(MAX_FIELD_LENGTH, `Field exceeds maximum length of ${MAX_FIELD_LENGTH}`)

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
