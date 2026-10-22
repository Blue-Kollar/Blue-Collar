/**
 * Wallet validation schemas — issue #1582.
 * Confirms wallet request rules reject malformed input before it reaches controllers.
 */
import { describe, it, expect } from 'vitest'
import { linkWalletRules, buildTxRules, broadcastRules, fundTestnetRules } from './wallet.js'

const PUBLIC_KEY = 'G' + 'A'.repeat(55)

describe('linkWalletRules', () => {
  it('accepts a 56-character public key', () => {
    expect(linkWalletRules.safeParse({ publicKey: PUBLIC_KEY }).success).toBe(true)
  })

  it('rejects a public key one character short', () => {
    expect(linkWalletRules.safeParse({ publicKey: PUBLIC_KEY.slice(1) }).success).toBe(false)
  })

  it('rejects a public key one character long', () => {
    expect(linkWalletRules.safeParse({ publicKey: PUBLIC_KEY + 'A' }).success).toBe(false)
  })
})

describe('buildTxRules', () => {
  const valid = { sourcePublicKey: PUBLIC_KEY, destinationPublicKey: PUBLIC_KEY, amount: '10' }

  it('accepts a transaction without a memo', () => {
    expect(buildTxRules.safeParse(valid).success).toBe(true)
  })

  it('accepts a transaction with a memo', () => {
    expect(buildTxRules.safeParse({ ...valid, memo: 'invoice-42' }).success).toBe(true)
  })

  it('rejects an empty source public key', () => {
    const result = buildTxRules.safeParse({ ...valid, sourcePublicKey: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Source public key is required')
  })

  it('rejects an empty destination public key', () => {
    const result = buildTxRules.safeParse({ ...valid, destinationPublicKey: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Destination public key is required')
  })

  it('rejects an empty amount', () => {
    const result = buildTxRules.safeParse({ ...valid, amount: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Amount is required')
  })
})

describe('broadcastRules', () => {
  it('accepts a non-empty signed XDR', () => {
    expect(broadcastRules.safeParse({ signedXdr: 'AAAAAgAAAAB' }).success).toBe(true)
  })

  it('rejects an empty signed XDR', () => {
    const result = broadcastRules.safeParse({ signedXdr: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Signed XDR is required')
  })
})

describe('fundTestnetRules', () => {
  it('accepts a non-empty public key', () => {
    expect(fundTestnetRules.safeParse({ publicKey: PUBLIC_KEY }).success).toBe(true)
  })

  it('rejects an empty public key', () => {
    const result = fundTestnetRules.safeParse({ publicKey: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Public key is required')
  })
})
