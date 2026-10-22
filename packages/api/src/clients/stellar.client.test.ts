/**
 * Unit tests for StellarClient (packages/api/src/clients/stellar.client.ts)
 *
 * All Horizon HTTP calls are intercepted by MockStellarRpcServer — no live
 * network traffic is made. The HORIZON_URL env guard in src/__tests__/setup.ts
 * ensures any test that accidentally bypasses the mock fails fast with a
 * connection error rather than silently hitting testnet.
 *
 * Issue: [Testing] Add mock Stellar/Soroban RPC service for deterministic backend tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StellarClient } from './stellar.client.js'
import {
  MockStellarRpcServer,
  MOCK_HORIZON_ADDRESS,
  MOCK_HORIZON_TX_HASH,
  MOCK_HORIZON_BALANCE,
  MOCK_HORIZON_SEQUENCE,
} from './mockStellarRpcServer.js'

// ─── Shared server instance ───────────────────────────────────────────────────
//
// One server per describe block; reset() wipes the calls log and any
// per-test overrides before each test.

const MOCK_HORIZON_URL = 'https://mock-horizon.test'
const MOCK_FRIENDBOT_URL = 'https://mock-friendbot.test'

describe('StellarClient — via MockStellarRpcServer', () => {
  const server = new MockStellarRpcServer()
  // StellarClient is constructed once and shared; it uses the URLs we pass,
  // which are intercepted by the mock regardless of their hostname.
  const client = new StellarClient(MOCK_HORIZON_URL, MOCK_FRIENDBOT_URL)

  beforeEach(() => {
    server.reset()
    server.install()
  })

  afterEach(() => {
    server.uninstall()
  })

  // ── getAccountInfo ──────────────────────────────────────────────────────────

  describe('getAccountInfo', () => {
    it('returns parsed balance and sequence for a known account', async () => {
      const info = await client.getAccountInfo(MOCK_HORIZON_ADDRESS)

      expect(info.publicKey).toBe(MOCK_HORIZON_ADDRESS)
      expect(info.balance).toBe(parseFloat(MOCK_HORIZON_BALANCE))
      expect(info.sequence).toBe(BigInt(MOCK_HORIZON_SEQUENCE))
    })

    it('calls the correct Horizon endpoint', async () => {
      await client.getAccountInfo(MOCK_HORIZON_ADDRESS)

      expect(server.calls).toHaveLength(1)
      expect(server.calls[0].url).toContain(`/accounts/${MOCK_HORIZON_ADDRESS}`)
      expect(server.calls[0].method).toBe('GET')
    })

    it('reflects a custom balance set via setResponse', async () => {
      server.setResponse('account', { balance: '250.0000000', sequence: '9999' })

      const info = await client.getAccountInfo(MOCK_HORIZON_ADDRESS)

      expect(info.balance).toBe(250)
      expect(info.sequence).toBe(BigInt(9999))
    })

    it('returns 0 balance when there are no native asset entries', async () => {
      server.setResponse('account', {
        balance: '0.0000000',
        extraBalances: [{ asset_type: 'credit_alphanum4', balance: '50.0', asset_code: 'USDC' }],
      })

      const info = await client.getAccountInfo(MOCK_HORIZON_ADDRESS)

      expect(info.balance).toBe(0)
    })

    it('throws AppError(404) when the account is not found', async () => {
      const notFoundServer = new MockStellarRpcServer({ accountNotFound: true })
      notFoundServer.install()

      await expect(client.getAccountInfo('GNONEXISTENT')).rejects.toMatchObject({
        statusCode: 404,
      })

      notFoundServer.uninstall()
    })

    it('throws AppError on a 500 server error', async () => {
      const errorServer = new MockStellarRpcServer({ accountServerError: true })
      errorServer.install()

      await expect(client.getAccountInfo(MOCK_HORIZON_ADDRESS)).rejects.toMatchObject({
        statusCode: 500,
      })

      errorServer.uninstall()
    })

    it('makes no live network calls', async () => {
      await client.getAccountInfo(MOCK_HORIZON_ADDRESS)
      // All calls land in server.calls — proof that fetch was intercepted
      expect(server.calls.every((c) => c.url.startsWith(MOCK_HORIZON_URL))).toBe(true)
    })
  })

  // ── broadcastTransaction ────────────────────────────────────────────────────

  describe('broadcastTransaction', () => {
    it('returns txHash and txId on a successful broadcast', async () => {
      const result = await client.broadcastTransaction('AAAA...signedXdr')

      expect(result.txHash).toBe(MOCK_HORIZON_TX_HASH)
      expect(result.txId).toBe(`id_${MOCK_HORIZON_TX_HASH.slice(0, 8)}`)
    })

    it('POSTs to the /transactions endpoint with the XDR in the body', async () => {
      await client.broadcastTransaction('AAAA...signedXdr')

      expect(server.calls).toHaveLength(1)
      expect(server.calls[0].url).toContain('/transactions')
      expect(server.calls[0].method).toBe('POST')
    })

    it('reflects a custom txHash set via setResponse', async () => {
      const customHash = 'deadbeef' + '0'.repeat(56)
      server.setResponse('broadcast', { hash: customHash, id: 'custom-id' })

      const result = await client.broadcastTransaction('signed')

      expect(result.txHash).toBe(customHash)
      expect(result.txId).toBe('custom-id')
    })

    it('throws AppError when Horizon rejects the transaction', async () => {
      const failServer = new MockStellarRpcServer({ broadcastFails: true })
      failServer.install()

      await expect(client.broadcastTransaction('bad-xdr')).rejects.toMatchObject({
        statusCode: 400,
      })

      failServer.uninstall()
    })
  })

  // ── pollTransactionStatus ───────────────────────────────────────────────────

  describe('pollTransactionStatus', () => {
    it('returns confirmed status for a successful transaction', async () => {
      const result = await client.pollTransactionStatus(MOCK_HORIZON_TX_HASH)

      expect(result.status).toBe('confirmed')
      expect(result.resultCode).toBe('ok')
    })

    it('returns pending when Horizon responds with 404', async () => {
      const pendingServer = new MockStellarRpcServer({ txPending: true })
      pendingServer.install()

      const result = await client.pollTransactionStatus('unknown-hash')

      expect(result.status).toBe('pending')
      pendingServer.uninstall()
    })

    it('returns failed status for an unsuccessful transaction', async () => {
      server.setResponse('txStatus', { successful: false, result_code: 'tx_failed' })

      const result = await client.pollTransactionStatus(MOCK_HORIZON_TX_HASH)

      expect(result.status).toBe('failed')
      expect(result.resultCode).toBe('tx_failed')
    })

    it('calls the correct /transactions/:hash endpoint', async () => {
      await client.pollTransactionStatus(MOCK_HORIZON_TX_HASH)

      expect(server.calls[0].url).toContain(`/transactions/${MOCK_HORIZON_TX_HASH}`)
      expect(server.calls[0].method).toBe('GET')
    })
  })

  // ── fundTestnetAccount ──────────────────────────────────────────────────────

  describe('fundTestnetAccount', () => {
    it('returns a txHash and success message', async () => {
      const result = await client.fundTestnetAccount(MOCK_HORIZON_ADDRESS)

      expect(result.txHash).toBe(MOCK_HORIZON_TX_HASH)
      expect(result.message).toMatch(/funded successfully/i)
    })

    it('POSTs to the friendbot URL', async () => {
      await client.fundTestnetAccount(MOCK_HORIZON_ADDRESS)

      expect(server.calls[0].url).toContain('friendbot')
      expect(server.calls[0].method).toBe('POST')
    })

    it('reflects a custom friendbot txHash via setResponse', async () => {
      server.setResponse('friendbot', { hash: 'friendbot-custom-hash' + '0'.repeat(45) })

      const result = await client.fundTestnetAccount(MOCK_HORIZON_ADDRESS)

      expect(result.txHash).toBe('friendbot-custom-hash' + '0'.repeat(45))
    })
  })

  // ── getAccountTransactions ──────────────────────────────────────────────────

  describe('getAccountTransactions', () => {
    it('returns an empty list by default', async () => {
      const txs = await client.getAccountTransactions(MOCK_HORIZON_ADDRESS)

      expect(txs).toEqual([])
    })

    it('returns the seeded transaction history', async () => {
      server.setResponse('txHistory', [
        { hash: 'tx1abc', created_at: '2026-01-01T00:00:00Z' },
        { hash: 'tx2def', created_at: '2026-01-02T00:00:00Z' },
      ])

      const txs = await client.getAccountTransactions(MOCK_HORIZON_ADDRESS)

      expect(txs).toHaveLength(2)
      expect(txs[0].hash).toBe('tx1abc')
      expect(txs[1].hash).toBe('tx2def')
    })

    it('calls the correct /accounts/:id/transactions endpoint', async () => {
      await client.getAccountTransactions(MOCK_HORIZON_ADDRESS, 10, 'asc')

      expect(server.calls[0].url).toContain(`/accounts/${MOCK_HORIZON_ADDRESS}/transactions`)
      expect(server.calls[0].method).toBe('GET')
    })

    it('passes limit and order query params in the URL', async () => {
      await client.getAccountTransactions(MOCK_HORIZON_ADDRESS, 25, 'asc')

      expect(server.calls[0].url).toContain('limit=25')
      expect(server.calls[0].url).toContain('order=asc')
    })
  })

  // ── No live network calls (global assertion) ────────────────────────────────

  describe('network isolation', () => {
    it('all intercepted calls go to the mock URL, never to live testnet', async () => {
      await client.getAccountInfo(MOCK_HORIZON_ADDRESS)
      await client.broadcastTransaction('xdr')
      await client.pollTransactionStatus(MOCK_HORIZON_TX_HASH)
      await client.fundTestnetAccount(MOCK_HORIZON_ADDRESS)
      await client.getAccountTransactions(MOCK_HORIZON_ADDRESS)

      const liveTestnetCalls = server.calls.filter(
        (c) =>
          c.url.includes('stellar.org') ||
          c.url.includes('horizon-testnet') ||
          c.url.includes('friendbot.stellar'),
      )

      expect(liveTestnetCalls).toHaveLength(0)
      expect(server.calls.length).toBeGreaterThan(0)
    })
  })

  // ── customHandler escape hatch ──────────────────────────────────────────────

  describe('customHandler', () => {
    it('allows overriding a single URL pattern while keeping default routing', async () => {
      let customCalled = false

      const customServer = new MockStellarRpcServer({
        customHandler: (url, method) => {
          if (url.includes('/accounts/') && method === 'GET') {
            customCalled = true
            return new Response(
              JSON.stringify({
                balances: [{ asset_type: 'native', balance: '999.0000000' }],
                sequence: '1',
              }),
              { status: 200 },
            )
          }
          return null // fall through for everything else
        },
      })
      customServer.install()

      const info = await client.getAccountInfo(MOCK_HORIZON_ADDRESS)

      expect(customCalled).toBe(true)
      expect(info.balance).toBe(999)

      customServer.uninstall()
    })
  })
})
