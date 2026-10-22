import { describe, it, expect } from 'vitest'
import {
  formatXlmAmount,
  stellarExplorerTxUrl,
  truncateStellarAddress,
} from '@/utils'

const ADDRESS = 'GCKFBEIYTKP6RCZX6LRJLPWLZBQK3RGZDVQBVQXAHXQ7VQXAHXQ7VQXA'

describe('truncateStellarAddress', () => {
  it('keeps the leading and trailing characters around an ellipsis', () => {
    expect(truncateStellarAddress(ADDRESS)).toBe('GCKFBE…VQXA')
  })

  it('honours custom lead/tail lengths', () => {
    expect(truncateStellarAddress(ADDRESS, 4, 6)).toBe('GCKF…Q7VQXA')
  })

  it('returns short values untouched rather than making them longer', () => {
    expect(truncateStellarAddress('GABCDEFGHIJ')).toBe('GABCDEFGHIJ')
    expect(truncateStellarAddress('')).toBe('')
  })
})

describe('formatXlmAmount', () => {
  it('renders Horizon amounts at two decimal places', () => {
    expect(formatXlmAmount('12.5000000')).toBe('12.50')
    expect(formatXlmAmount('0.0000001')).toBe('0.00')
    expect(formatXlmAmount('1000')).toBe('1000.00')
  })

  it('honours a custom precision', () => {
    expect(formatXlmAmount('12.5678900', 4)).toBe('12.5679')
  })

  it('passes non-numeric input through instead of rendering NaN', () => {
    expect(formatXlmAmount('not-a-number')).toBe('not-a-number')
  })
})

describe('stellarExplorerTxUrl', () => {
  it('defaults to testnet', () => {
    expect(stellarExplorerTxUrl('abc123')).toBe(
      'https://stellar.expert/explorer/testnet/tx/abc123',
    )
  })

  it('accepts the public network', () => {
    expect(stellarExplorerTxUrl('abc123', 'public')).toBe(
      'https://stellar.expert/explorer/public/tx/abc123',
    )
  })
})
