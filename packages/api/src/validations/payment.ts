import { z } from 'zod'

import { stellarAmountSchema,walletAddressSchema } from '../middleware/validate.js'

// POST /payments/tip
export const tipRules = z.object({
  from: walletAddressSchema,
  to: walletAddressSchema,
  amount: stellarAmountSchema,
})

// POST /payments/escrow
export const createEscrowRules = z.object({
  from: walletAddressSchema,
  to: walletAddressSchema,
  amount: stellarAmountSchema,
  expiryDate: z.string().datetime(),
})

// PATCH /payments/fee
export const updateFeeRules = z.object({
  fee_bps: z.number().int().min(0).max(500),
})
