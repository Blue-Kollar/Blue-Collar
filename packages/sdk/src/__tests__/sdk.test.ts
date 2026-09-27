/**
 * HorizonClient and createSdk tests.
 *
 * Migrated to use @bluecollar/test-utils shared mocks (issue #1054) — the
 * hand-rolled `vi.spyOn(global, 'fetch', ...)` calls have been replaced with
 * `makeMockHorizonFetch()` so every package uses identical, consistent fixtures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HorizonClient, SdkError } from '../horizon.client.js'
import { createSdk } from '../index.js'
import {
  makeMockHorizonFetch,
  MOCK_STELLAR_ADDRESS,
} from '@bluecollar/test-utils'

const TESTNET_URL = 'https://horizon-testnet.stellar.org'

describe('HorizonClient', () => {
  let client: HorizonClient

  beforeEach(() => {
    client = new HorizonClient({ horizonUrl: TESTNET_URL })
    vi.restoreAllMocks()
  })

  it('getAccountInfo parses balance and sequence', async () => {
    vi.stubGlobal('fetch', makeMockHorizonFetch({ balance: '100.0000000', sequence: '1234567' }))

    const info = await client.getAccountInfo(MOCK_STELLAR_ADDRESS)
    expect(info.balance).toBe(100)
    expect(info.sequence).toBe(BigInt(1234567))
  })

  it('getAccountInfo throws SdkError on 404', async () => {
    vi.stubGlobal('fetch', makeMockHorizonFetch({ accountNotFound: true }))
    await expect(client.getAccountInfo(MOCK_STELLAR_ADDRESS)).rejects.toThrow(SdkError)
  })

  it('broadcastTransaction returns txHash on success', async () => {
    vi.stubGlobal('fetch', makeMockHorizonFetch({ txHash: 'abc123' }))
    const result = await client.broadcastTransaction('SIGNED_XDR')
    expect(result.txHash).toBe('abc123')
  })

  it('getTransactionStatus returns pending on 404', async () => {
    vi.stubGlobal('fetch', makeMockHorizonFetch({ txPending: true }))
    const status = await client.getTransactionStatus('HASH')
    expect(status.status).toBe('pending')
  })

  it('getTransactionStatus returns confirmed for successful tx', async () => {
    vi.stubGlobal('fetch', makeMockHorizonFetch({ txSuccessful: true, txResultCode: 'OK' }))
    const status = await client.getTransactionStatus('HASH')
    expect(status.status).toBe('confirmed')
  })

  it('broadcastTransaction throws SdkError on broadcast failure', async () => {
    vi.stubGlobal('fetch', makeMockHorizonFetch({ broadcastFails: true }))
    await expect(client.broadcastTransaction('SIGNED_XDR')).rejects.toThrow(SdkError)
  })

  it('fundTestnetAccount returns txHash', async () => {
    vi.stubGlobal('fetch', makeMockHorizonFetch({ txHash: 'funding_hash_abc' }))
    const result = await client.fundTestnetAccount(MOCK_STELLAR_ADDRESS)
    expect(result.txHash).toBe('funding_hash_abc')
  })
})

describe('createSdk', () => {
  it('returns horizon client with correct URL on testnet', () => {
    const sdk = createSdk({ network: 'testnet' })
    expect(sdk.horizon).toBeInstanceOf(HorizonClient)
    expect(sdk.config.horizonUrl).toBe(TESTNET_URL)
  })

  it('registry is null when no contractId provided', () => {
    const sdk = createSdk({ network: 'testnet' })
    expect(sdk.registry).toBeNull()
  })

  it('registry is instantiated when contractId is provided', () => {
    const sdk = createSdk({ network: 'testnet', registryContractId: 'CONTRACT_ABC' })
    expect(sdk.registry).not.toBeNull()
  })
})
