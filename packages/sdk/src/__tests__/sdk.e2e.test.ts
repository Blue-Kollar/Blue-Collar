/**
 * E2E tests for the @bluecollar/sdk client (closes #1049).
 *
 * These tests exercise the full public surface of the SDK — createSdk(),
 * HorizonClient, and RegistryClient — by mocking the network boundary at the
 * global fetch level.  Every test validates the behaviour a consumer would
 * observe when integrating the SDK into packages/api or packages/app.
 *
 * Scope:
 *  - createSdk factory configuration (testnet / mainnet URLs, registry opt-in)
 *  - HorizonClient: account info, transaction broadcast, status polling,
 *    account transactions, testnet Friendbot funding, unsigned payment build
 *  - RegistryClient: simulateInvoke happy path + RPC error handling
 *  - SdkError shape and statusCode propagation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSdk, HorizonClient, RegistryClient, SdkError } from '../index.js'

// ── Global fetch mock ─────────────────────────────────────────────────────────

function mockFetchOnce(body: unknown, status = 200): void {
  vi.spyOn(global, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function mockFetchFail(status: number, body: unknown = {}): void {
  vi.spyOn(global, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  )
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TESTNET_URL = 'https://horizon-testnet.stellar.org'
const MAINNET_URL = 'https://horizon.stellar.org'
const PUBLIC_KEY = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'
const CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const TX_HASH = 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'

// ═════════════════════════════════════════════════════════════════════════════
// createSdk factory
// ═════════════════════════════════════════════════════════════════════════════

describe('createSdk — factory configuration', () => {
  afterEach(() => vi.restoreAllMocks())

  it('creates a testnet SDK with the correct Horizon URL', () => {
    const sdk = createSdk({ network: 'testnet' })
    expect(sdk.config.horizonUrl).toBe(TESTNET_URL)
    expect(sdk.config.network).toBe('testnet')
  })

  it('creates a mainnet SDK with the correct Horizon URL', () => {
    const sdk = createSdk({ network: 'mainnet' })
    expect(sdk.config.horizonUrl).toBe(MAINNET_URL)
    expect(sdk.config.network).toBe('mainnet')
  })

  it('honours an explicit horizonUrl override', () => {
    const custom = 'https://custom-horizon.example.com'
    const sdk = createSdk({ network: 'testnet', horizonUrl: custom })
    expect(sdk.config.horizonUrl).toBe(custom)
  })

  it('exposes a HorizonClient instance', () => {
    const sdk = createSdk({ network: 'testnet' })
    expect(sdk.horizon).toBeInstanceOf(HorizonClient)
  })

  it('registry is null when registryContractId is not provided', () => {
    const sdk = createSdk({ network: 'testnet' })
    expect(sdk.registry).toBeNull()
  })

  it('registry is a RegistryClient when registryContractId is provided', () => {
    const sdk = createSdk({ network: 'testnet', registryContractId: CONTRACT_ID })
    expect(sdk.registry).toBeInstanceOf(RegistryClient)
  })

  it('returns the BlueCollarSdk shape: { horizon, registry, config }', () => {
    const sdk = createSdk({ network: 'testnet' })
    expect(sdk).toHaveProperty('horizon')
    expect(sdk).toHaveProperty('registry')
    expect(sdk).toHaveProperty('config')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HorizonClient — getAccountInfo
// ═════════════════════════════════════════════════════════════════════════════

describe('HorizonClient.getAccountInfo', () => {
  let client: HorizonClient

  beforeEach(() => {
    client = new HorizonClient({ horizonUrl: TESTNET_URL })
    vi.restoreAllMocks()
  })

  it('returns parsed balance and sequence for a live account', async () => {
    mockFetchOnce({
      balances: [{ balance: '250.0000000', asset_type: 'native' }],
      sequence: '987654321',
    })

    const info = await client.getAccountInfo(PUBLIC_KEY)

    expect(info.publicKey).toBe(PUBLIC_KEY)
    expect(info.balance).toBe(250)
    expect(info.sequence).toBe(BigInt(987654321))
  })

  it('returns 0 balance when account has no native balance entry', async () => {
    mockFetchOnce({
      balances: [{ balance: '10.0000000', asset_type: 'credit_alphanum4' }],
      sequence: '1',
    })

    const info = await client.getAccountInfo(PUBLIC_KEY)
    expect(info.balance).toBe(0)
  })

  it('throws SdkError with statusCode 404 for unfunded accounts', async () => {
    mockFetchFail(404)

    const err = await client.getAccountInfo(PUBLIC_KEY).catch((e) => e)
    expect(err).toBeInstanceOf(SdkError)
    expect(err).toMatchObject({
      statusCode: 404,
    })
  })

  it('throws SdkError for any non-ok response other than 404', async () => {
    mockFetchFail(500)

    await expect(client.getAccountInfo(PUBLIC_KEY)).rejects.toThrow(SdkError)
  })

  it('calls the correct Horizon accounts endpoint', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ balances: [{ balance: '1.0', asset_type: 'native' }], sequence: '1' }),
        { status: 200 },
      ),
    )
    await client.getAccountInfo(PUBLIC_KEY)
    expect(spy).toHaveBeenCalledWith(`${TESTNET_URL}/accounts/${PUBLIC_KEY}`)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HorizonClient — broadcastTransaction
// ═════════════════════════════════════════════════════════════════════════════

describe('HorizonClient.broadcastTransaction', () => {
  let client: HorizonClient

  beforeEach(() => {
    client = new HorizonClient({ horizonUrl: TESTNET_URL })
    vi.restoreAllMocks()
  })

  it('returns txHash and txId on successful broadcast', async () => {
    mockFetchOnce({ hash: TX_HASH, id: 'tx-id-001' })

    const result = await client.broadcastTransaction('SIGNED_XDR_BASE64')
    expect(result.txHash).toBe(TX_HASH)
    expect(result.txId).toBe('tx-id-001')
  })

  it('throws SdkError with detail message when broadcast fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: 'Transaction submission failed', title: 'Bad request' }),
        { status: 400 },
      ),
    )

    await expect(client.broadcastTransaction('BAD_XDR')).rejects.toThrow(/Broadcast failed/)
  })

  it('throws SdkError with title message when detail is absent', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Internal Server Error' }), { status: 500 }),
    )

    const err = await client.broadcastTransaction('XDR').catch((e) => e)
    expect(err).toBeInstanceOf(SdkError)
    expect(err.message).toMatch(/Internal Server Error/)
  })

  it('posts to the /transactions endpoint', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ hash: TX_HASH, id: 'id' }), { status: 200 }),
    )
    await client.broadcastTransaction('XDR')
    expect(spy).toHaveBeenCalledWith(
      `${TESTNET_URL}/transactions`,
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HorizonClient — getTransactionStatus
// ═════════════════════════════════════════════════════════════════════════════

describe('HorizonClient.getTransactionStatus', () => {
  let client: HorizonClient

  beforeEach(() => {
    client = new HorizonClient({ horizonUrl: TESTNET_URL })
    vi.restoreAllMocks()
  })

  it('returns "pending" when tx is not found (404)', async () => {
    mockFetchFail(404)
    const status = await client.getTransactionStatus(TX_HASH)
    expect(status.status).toBe('pending')
  })

  it('returns "confirmed" with resultCode for successful tx', async () => {
    mockFetchOnce({ successful: true, result_code: 'txSUCCESS' })
    const status = await client.getTransactionStatus(TX_HASH)
    expect(status.status).toBe('confirmed')
    expect(status.resultCode).toBe('txSUCCESS')
  })

  it('returns "failed" for unsuccessful tx', async () => {
    mockFetchOnce({ successful: false, result_code: 'txFAILED' })
    const status = await client.getTransactionStatus(TX_HASH)
    expect(status.status).toBe('failed')
    expect(status.resultCode).toBe('txFAILED')
  })

  it('throws SdkError for unexpected HTTP errors', async () => {
    mockFetchFail(503)
    await expect(client.getTransactionStatus(TX_HASH)).rejects.toThrow(SdkError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HorizonClient — getAccountTransactions
// ═════════════════════════════════════════════════════════════════════════════

describe('HorizonClient.getAccountTransactions', () => {
  let client: HorizonClient

  beforeEach(() => {
    client = new HorizonClient({ horizonUrl: TESTNET_URL })
    vi.restoreAllMocks()
  })

  it('returns an array of transaction records', async () => {
    const records = [
      { hash: 'tx1', created_at: '2024-01-01T00:00:00Z' },
      { hash: 'tx2', created_at: '2024-01-02T00:00:00Z' },
    ]
    mockFetchOnce({ _embedded: { records } })

    const txs = await client.getAccountTransactions(PUBLIC_KEY)
    expect(txs).toHaveLength(2)
    expect(txs[0].hash).toBe('tx1')
  })

  it('passes limit and order query params', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ _embedded: { records: [] } }), { status: 200 }),
    )
    await client.getAccountTransactions(PUBLIC_KEY, 10, 'asc')
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
    )
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('order=asc'),
    )
  })

  it('throws SdkError on non-ok response', async () => {
    mockFetchFail(400)
    await expect(client.getAccountTransactions(PUBLIC_KEY)).rejects.toThrow(SdkError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HorizonClient — fundTestnetAccount
// ═════════════════════════════════════════════════════════════════════════════

describe('HorizonClient.fundTestnetAccount', () => {
  let client: HorizonClient

  beforeEach(() => {
    client = new HorizonClient({ horizonUrl: TESTNET_URL })
    vi.restoreAllMocks()
  })

  it('returns txHash from Friendbot on success', async () => {
    mockFetchOnce({ hash: 'friendbot-tx-hash' })
    const result = await client.fundTestnetAccount(PUBLIC_KEY)
    expect(result.txHash).toBe('friendbot-tx-hash')
  })

  it('throws SdkError with Friendbot error message on failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'account already funded' }), { status: 400 }),
    )
    await expect(client.fundTestnetAccount(PUBLIC_KEY)).rejects.toThrow(/account already funded/)
  })

  it('throws SdkError with status text when error field is absent', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 503, statusText: 'Service Unavailable' }),
    )
    const err = await client.fundTestnetAccount(PUBLIC_KEY).catch((e) => e)
    expect(err).toBeInstanceOf(SdkError)
    expect(err.message).toMatch(/Service Unavailable/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HorizonClient — buildUnsignedPaymentTx
// ═════════════════════════════════════════════════════════════════════════════

describe('HorizonClient.buildUnsignedPaymentTx', () => {
  let client: HorizonClient

  beforeEach(() => {
    client = new HorizonClient({ horizonUrl: TESTNET_URL })
    vi.restoreAllMocks()
  })

  it('returns a payment tx params struct with incremented sequence', async () => {
    mockFetchOnce({
      balances: [{ balance: '100.0', asset_type: 'native' }],
      sequence: '100',
    })

    const DEST = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    const params = await client.buildUnsignedPaymentTx(PUBLIC_KEY, DEST, '10', 'tip')

    expect(params.sourcePublicKey).toBe(PUBLIC_KEY)
    expect(params.destinationPublicKey).toBe(DEST)
    expect(params.amount).toBe('10')
    expect(params.memo).toBe('tip')
    expect(params.sequence).toBe('101') // sequence + 1
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// RegistryClient — simulateInvoke
// ═════════════════════════════════════════════════════════════════════════════

describe('RegistryClient.simulateInvoke', () => {
  let registry: RegistryClient

  beforeEach(() => {
    registry = new RegistryClient({
      registryContractId: CONTRACT_ID,
      network: 'testnet',
    })
    vi.restoreAllMocks()
  })

  it('returns the RPC result on a successful simulate call', async () => {
    const fakeResult = { latestLedger: 12345, results: [{ xdr: 'AAAAAAAAAGQBVavQ' }] }
    mockFetchOnce({ jsonrpc: '2.0', id: 1, result: fakeResult })

    const result = await registry.simulateInvoke('get_worker', [{ id: 'w-001' }])
    expect(result).toEqual(fakeResult)
  })

  it('throws SdkError when RPC returns an error object', async () => {
    mockFetchOnce({
      jsonrpc: '2.0',
      id: 1,
      error: { message: 'contract not found', code: -32600 },
    })

    const err = await registry.simulateInvoke('get_worker', []).catch((e) => e)
    expect(err).toBeInstanceOf(SdkError)
    expect(err).toMatchObject({
      statusCode: 400,
    })
  })

  it('throws SdkError when the HTTP call itself fails', async () => {
    mockFetchFail(503)

    await expect(registry.simulateInvoke('get_worker', [])).rejects.toThrow(SdkError)
  })

  it('sends a valid JSON-RPC simulateTransaction body', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: {} }), { status: 200 }),
    )
    await registry.simulateInvoke('get_category_count')

    const [, init] = spy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.method).toBe('simulateTransaction')
    expect(body.jsonrpc).toBe('2.0')
  })

  it('uses the testnet Soroban RPC endpoint', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: {} }), { status: 200 }),
    )
    await registry.simulateInvoke('ping')
    expect(spy.mock.calls[0][0]).toContain('testnet')
  })

  it('uses the mainnet Soroban RPC endpoint when network is mainnet', async () => {
    const mainnetRegistry = new RegistryClient({
      registryContractId: CONTRACT_ID,
      network: 'mainnet',
    })
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: {} }), { status: 200 }),
    )
    await mainnetRegistry.simulateInvoke('ping')
    expect(spy.mock.calls[0][0]).not.toContain('testnet')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SdkError
// ═════════════════════════════════════════════════════════════════════════════

describe('SdkError', () => {
  it('carries the HTTP statusCode', () => {
    const err = new SdkError('test error', 429)
    expect(err.statusCode).toBe(429)
    expect(err.message).toBe('test error')
    expect(err.name).toBe('SdkError')
  })

  it('is an instance of Error', () => {
    expect(new SdkError('x', 500)).toBeInstanceOf(Error)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Full SDK integration path: createSdk → account info → payment params
// ═════════════════════════════════════════════════════════════════════════════

describe('Full SDK path — createSdk → account info → build payment', () => {
  afterEach(() => vi.restoreAllMocks())

  it('chains getAccountInfo into buildUnsignedPaymentTx correctly', async () => {
    const sdk = createSdk({ network: 'testnet' })

    // First fetch: getAccountInfo (inside buildUnsignedPaymentTx)
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          balances: [{ balance: '50.0', asset_type: 'native' }],
          sequence: '999',
        }),
        { status: 200 },
      ),
    )

    const DEST = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    const params = await sdk.horizon.buildUnsignedPaymentTx(PUBLIC_KEY, DEST, '5', 'work payment')

    expect(params.amount).toBe('5')
    expect(params.sequence).toBe('1000')
  })
})
