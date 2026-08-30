import { z } from 'zod'

/**
 * Wallet validation schemas
 */

export const linkWalletRules = z.object({
  publicKey: z.string().min(56).max(56, 'Public key must be exactly 56 characters'),
})

export const buildTxRules = z.object({
  sourcePublicKey: z.string().min(1, 'Source public key is required'),
  destinationPublicKey: z.string().min(1, 'Destination public key is required'),
  amount: z.string().min(1, 'Amount is required'),
  memo: z.string().optional(),
})

export const broadcastRules = z.object({
  signedXdr: z.string().min(1, 'Signed XDR is required'),
})

export const fundTestnetRules = z.object({
  publicKey: z.string().min(1, 'Public key is required'),
})
