/**
 * Contract account-state tests (issue #1276).
 *
 * These tests exercise the SDK's Horizon client using the shared
 * `@bluecollar/test-utils` account-state fixtures instead of hand-rolled
 * account objects. They assert that the client behaves correctly for the
 * common states the contract suite cares about: funded, zero-balance, and
 * unfunded accounts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HorizonClient, SdkError } from '../index.js'
import {
  buildMockAccountResponse,
  fundedAccount,
  makeSenderRecipient,
  zeroBalanceAccount,
} from '@bluecollar/test-utils'

const TESTNET_URL = 'https://horizon-testnet.stellar.org'

describe('contract account states via shared fixtures', () => {
  let client: HorizonClient

  beforeEach(() => {
    client = new HorizonClient({ horizonUrl: TESTNET_URL })
    vi.restoreAllMocks()
  })

  it('reads balance for a funded account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(buildMockAccountResponse(fundedAccount({ balance: '500.5000000' }), '42')),
    )
    const info = await client.getAccountInfo('GEXAMPLE')
    expect(info.balance).toBe(500.5)
    expect(info.sequence).toBe(BigInt(42))
  })

  it('reports zero balance for a zero-balance account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildMockAccountResponse(zeroBalanceAccount(), '1')))
    const info = await client.getAccountInfo('GEXAMPLE')
    expect(info.balance).toBe(0)
  })

  it('treats an unfunded (404) account as an SdkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))
    await expect(client.getAccountInfo('GEXAMPLE')).rejects.toThrow(SdkError)
  })

  it('a sender/recipient pair can both be inspected', async () => {
    const { sender, recipient } = makeSenderRecipient()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildMockAccountResponse(sender, '10')))
    const senderInfo = await client.getAccountInfo(sender.publicKey)
    expect(senderInfo.balance).toBe(10000)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildMockAccountResponse(recipient, '20')))
    const recipientInfo = await client.getAccountInfo(recipient.publicKey)
    expect(recipientInfo.balance).toBe(10000)
  })
})
