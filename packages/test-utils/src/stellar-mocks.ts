/**
 * @bluecollar/test-utils — Stellar SDK mock helpers
 *
 * Shared mock factories for Horizon REST and Soroban RPC calls.
 * Use these inside your vitest `vi.mock(...)` factories so every package
 * gets identical, consistent behaviour instead of hand-rolled copies.
 *
 * Issue: #1054 — Introduce shared mock service layer for Stellar SDK calls
 * Issue: #1265 — Add mock Stellar SDK fixtures for backend tests
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { makeMockHorizonFetch, MOCK_STELLAR_ADDRESS } from '@bluecollar/test-utils/stellar-mocks'
 *
 *   // In a test file:
 *   vi.stubGlobal('fetch', makeMockHorizonFetch())
 *
 *   // Or build a fully custom response:
 *   vi.stubGlobal('fetch', makeMockHorizonFetch({
 *     account: { balance: '250.0000000', sequence: '9999' },
 *     tx: { hash: 'custom_hash', successful: true },
 *   }))
 *
 *   // Mock the full StellarClient:
 *   import { makeMockStellarClient } from '@bluecollar/test-utils/stellar-mocks'
 *   vi.mock('../clients/stellar.client.js', () => ({
 *     stellarClient: makeMockStellarClient(),
 *     StellarClient: vi.fn().mockImplementation(() => makeMockStellarClient()),
 *   }))
 */

import { vi } from 'vitest'

// ─── Well-known test addresses ────────────────────────────────────────────────

/** A stable 56-character Stellar public key used as a generic "payer" address in tests. */
export const MOCK_STELLAR_ADDRESS =
  'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

/** A stable address used as the "worker" / recipient in payment tests. */
export const MOCK_WORKER_ADDRESS =
  'GCKFBEIYTKP6RCZX6LRJLPWLZBQK3RGZDVQBVQXAHXQ7VQXAHXQ7VQXA'

/** A stable address used as the fee-distribution recipient in market tests. */
export const MOCK_FEE_RECIPIENT_ADDRESS =
  'GBZVR55UH7NODXNZMBMOZSGSGQKGLYFQSYWJBGX2MKMJCSVPAJFX7KRF'

// ─── Common fixture constants (#1265) ─────────────────────────────────────────

/** A stable 64-hex-character transaction hash used as a fixture in Stellar tests. */
export const MOCK_TX_HASH =
  'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

/** A stable sequence number (as bigint) returned by account-info fixtures. */
export const MOCK_SEQUENCE = BigInt(1234567)

/** A stable XLM balance (as a number) returned by account-info fixtures. */
export const MOCK_BALANCE = 100

// ─── Default fixture values ────────────────────────────────────────────────────

const DEFAULT_BALANCE = '100.0000000'
const DEFAULT_SEQUENCE = '1234567'
const DEFAULT_TX_HASH = MOCK_TX_HASH

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MockHorizonOptions {
  /** Override the native XLM balance returned by /accounts/:id */
  balance?: string
  /** Override the sequence number returned by /accounts/:id */
  sequence?: string
  /** Override the transaction hash returned by POST /transactions */
  txHash?: string
  /** Whether the transaction is successful (default: true) */
  txSuccessful?: boolean
  /** Result code string for transaction status responses (default: 'ok') */
  txResultCode?: string
  /** If true, /accounts/:id responds with 404 (account not found) */
  accountNotFound?: boolean
  /** If true, POST /transactions responds with 400 (broadcast failure) */
  broadcastFails?: boolean
  /** If true, /transactions/:hash responds with 404 (pending) */
  txPending?: boolean
  /** Extra balances to include alongside native XLM */
  extraBalances?: Array<{ asset_type: string; balance: string; asset_code?: string }>
}

export interface MockFreighterOptions {
  isConnected?: boolean
  address?: string
  network?: string
}

// ─── Horizon fetch mock ───────────────────────────────────────────────────────

/**
 * Returns a `vi.fn()` suitable for `vi.stubGlobal('fetch', ...)` that intercepts
 * Horizon REST calls and returns configurable test fixtures.
 *
 * Handles:
 *  - GET  /accounts/:id          → account info + balances
 *  - POST /transactions           → broadcast result
 *  - GET  /transactions/:hash     → transaction status
 *  - GET  /accounts/:id/transactions → transaction history (empty array)
 *  - POST https://friendbot-testnet.stellar.org/bump_sequence → friendbot
 */
export function makeMockHorizonFetch(options: MockHorizonOptions = {}) {
  const {
    balance = DEFAULT_BALANCE,
    sequence = DEFAULT_SEQUENCE,
    txHash = DEFAULT_TX_HASH,
    txSuccessful = true,
    txResultCode = 'ok',
    accountNotFound = false,
    broadcastFails = false,
    txPending = false,
    extraBalances = [],
  } = options

  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : String(url)
    const method = (init?.method ?? 'GET').toUpperCase()

    // ── Friendbot ──────────────────────────────────────────────────────────
    if (urlStr.includes('friendbot')) {
      return new Response(JSON.stringify({ hash: txHash }), { status: 200 })
    }

    // ── POST /transactions (broadcast) ─────────────────────────────────────
    if (method === 'POST' && urlStr.endsWith('/transactions')) {
      if (broadcastFails) {
        return new Response(
          JSON.stringify({ title: 'Transaction Failed', detail: 'op_underfunded' }),
          { status: 400 },
        )
      }
      return new Response(
        JSON.stringify({ hash: txHash, id: `id_${txHash.slice(0, 8)}` }),
        { status: 200 },
      )
    }

    // ── GET /transactions/:hash (status) ───────────────────────────────────
    if (method === 'GET' && /\/transactions\/[^/]+$/.test(urlStr) && !urlStr.includes('/accounts/')) {
      if (txPending) {
        return new Response('{}', { status: 404 })
      }
      return new Response(
        JSON.stringify({ successful: txSuccessful, result_code: txResultCode }),
        { status: 200 },
      )
    }

    // ── GET /accounts/:id/transactions (history) ───────────────────────────
    if (method === 'GET' && urlStr.includes('/transactions') && urlStr.includes('/accounts/')) {
      return new Response(
        JSON.stringify({ _embedded: { records: [] } }),
        { status: 200 },
      )
    }

    // ── GET /accounts/:id (account info) ──────────────────────────────────
    if (method === 'GET' && urlStr.includes('/accounts/')) {
      if (accountNotFound) {
        return new Response('{}', { status: 404 })
      }
      const balances = [
        { asset_type: 'native', balance },
        ...extraBalances,
      ]
      return new Response(
        JSON.stringify({ balances, sequence }),
        { status: 200 },
      )
    }

    // ── Fallback: unexpected URL ───────────────────────────────────────────
    console.warn(`[test-utils] Unhandled mock fetch: ${method} ${urlStr}`)
    return new Response('{}', { status: 200 })
  })
}

// ─── Freighter API mock ────────────────────────────────────────────────────────

/**
 * Returns a mock object that mirrors the `@stellar/freighter-api` module shape.
 * Pass this to `vi.mock('@stellar/freighter-api', () => makeFreighterMock(...))`.
 *
 * @example
 * ```ts
 * vi.mock('@stellar/freighter-api', () => makeFreighterMock({
 *   isConnected: true,
 *   address: MOCK_STELLAR_ADDRESS,
 *   network: 'TESTNET',
 * }))
 * ```
 */
export function makeFreighterMock(options: MockFreighterOptions = {}) {
  const {
    isConnected = false,
    address = MOCK_STELLAR_ADDRESS,
    network = 'TESTNET',
  } = options

  return {
    isConnected: vi.fn().mockResolvedValue({ isConnected }),
    requestAccess: vi.fn().mockResolvedValue({ address }),
    getAddress: vi.fn().mockResolvedValue({ address }),
    getNetwork: vi.fn().mockResolvedValue({ network }),
    signTransaction: vi.fn().mockResolvedValue({ signedXDR: 'MOCK_SIGNED_XDR' }),
    signBlob: vi.fn().mockResolvedValue({ signedBlob: 'MOCK_SIGNED_BLOB' }),
  }
}

// ─── Soroban RPC mock ──────────────────────────────────────────────────────────

export interface MockSorobanRpcOptions {
  /** Contract ID to simulate (default: 'MOCK_CONTRACT_ID') */
  contractId?: string
  /** Simulated return value for invokeContract (stringified JSON) */
  simulateResult?: unknown
  /** If true, simulation throws an error */
  simulateFails?: boolean
}

/**
 * Creates a minimal mock of the Soroban RPC / stellar-sdk `Server` object
 * for use in packages that call contract functions via the SDK.
 *
 * @example
 * ```ts
 * vi.mock('@stellar/stellar-sdk', () => ({
 *   ...makeSorobanRpcMock({ simulateResult: { success: true } }),
 * }))
 * ```
 */
export function makeSorobanRpcMock(options: MockSorobanRpcOptions = {}) {
  const {
    contractId = 'MOCK_CONTRACT_ID',
    simulateResult = { success: true },
    simulateFails = false,
  } = options

  const mockSimulate = simulateFails
    ? vi.fn().mockRejectedValue(new Error('Soroban simulation failed'))
    : vi.fn().mockResolvedValue({
        results: [{ xdr: Buffer.from(JSON.stringify(simulateResult)).toString('base64') }],
        cost: { cpuInsns: '100', memBytes: '1000' },
        latestLedger: 42,
      })

  return {
    SorobanRpc: {
      Server: vi.fn().mockImplementation(() => ({
        simulateTransaction: mockSimulate,
        sendTransaction: vi.fn().mockResolvedValue({
          hash: DEFAULT_TX_HASH,
          status: 'PENDING',
        }),
        getTransaction: vi.fn().mockResolvedValue({
          status: 'SUCCESS',
          returnValue: { value: () => simulateResult },
        }),
        getAccount: vi.fn().mockResolvedValue({
          accountId: () => MOCK_STELLAR_ADDRESS,
          sequenceNumber: () => DEFAULT_SEQUENCE,
          incrementSequenceNumber: vi.fn(),
        }),
      })),
    },
    Networks: {
      TESTNET: 'Test SDF Network ; September 2015',
      PUBLIC: 'Public Global Stellar Network ; September 2015',
    },
    Keypair: {
      random: vi.fn().mockReturnValue({
        publicKey: () => MOCK_STELLAR_ADDRESS,
        secret: () => 'SMOCK_SECRET_KEY',
        sign: vi.fn(),
      }),
      fromSecret: vi.fn().mockReturnValue({
        publicKey: () => MOCK_STELLAR_ADDRESS,
        sign: vi.fn(),
      }),
    },
    Contract: vi.fn().mockImplementation((id: string) => ({
      contractId: id ?? contractId,
      call: vi.fn().mockReturnValue({}),
    })),
    TransactionBuilder: vi.fn().mockImplementation(() => ({
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({
        toEnvelope: vi.fn().mockReturnValue({ toXDR: vi.fn().mockReturnValue('MOCK_XDR') }),
        toXDR: vi.fn().mockReturnValue('MOCK_XDR'),
      }),
    })),
    Asset: {
      native: vi.fn().mockReturnValue({ code: 'XLM', issuer: null }),
    },
    Operation: {
      payment: vi.fn().mockReturnValue({}),
    },
    Memo: {
      none: vi.fn().mockReturnValue({}),
      text: vi.fn().mockReturnValue({}),
    },
    BASE_FEE: '100',
  }
}

// ─── Fixture helpers (#1265) ──────────────────────────────────────────────────

/**
 * Shape of the object returned by `StellarClient.getAccountInfo`.
 */
export interface AccountInfoFixture {
  publicKey: string
  balance: number
  sequence: bigint
}

/**
 * Shape of the object returned by `StellarClient.broadcastTransaction`.
 */
export interface TransactionFixture {
  txHash: string
  txId: string
}

/**
 * Shape of the object returned by `StellarClient.pollTransactionStatus`.
 */
export interface BalanceFixture {
  status: string
  resultCode?: string
}

/**
 * Returns a default `getAccountInfo` response fixture with optional field overrides.
 *
 * @example
 * ```ts
 * const info = accountFixture({ balance: 500 })
 * // { publicKey: MOCK_STELLAR_ADDRESS, balance: 500, sequence: MOCK_SEQUENCE }
 * ```
 */
export function accountFixture(overrides: Partial<AccountInfoFixture> = {}): AccountInfoFixture {
  return {
    publicKey: MOCK_STELLAR_ADDRESS,
    balance: MOCK_BALANCE,
    sequence: MOCK_SEQUENCE,
    ...overrides,
  }
}

/**
 * Returns a default `broadcastTransaction` response fixture with optional field overrides.
 *
 * @example
 * ```ts
 * const tx = transactionFixture({ txHash: 'deadbeef...' })
 * // { txHash: 'deadbeef...', txId: 'id_deadbeef' }
 * ```
 */
export function transactionFixture(overrides: Partial<TransactionFixture> = {}): TransactionFixture {
  const txHash = overrides.txHash ?? MOCK_TX_HASH
  return {
    txHash,
    txId: `id_${txHash.slice(0, 8)}`,
    ...overrides,
  }
}

/**
 * Returns a default `pollTransactionStatus` response fixture with optional field overrides.
 *
 * @example
 * ```ts
 * const bal = balanceFixture({ status: 'failed', resultCode: 'op_underfunded' })
 * ```
 */
export function balanceFixture(overrides: Partial<BalanceFixture> = {}): BalanceFixture {
  return {
    status: 'confirmed',
    resultCode: 'ok',
    ...overrides,
  }
}

// ─── MockStellarClient (#1265) ────────────────────────────────────────────────

/**
 * Options for `makeMockStellarClient`.
 *
 * Each field corresponds to the resolved value (or thrown error) of a matching
 * `StellarClient` method.  Pass `undefined` to keep the built-in default.
 */
export interface MockStellarClientOptions {
  /** Override the resolved value of `getAccountInfo`. */
  accountInfo?: AccountInfoFixture
  /** If true, `getAccountInfo` rejects with an error. */
  accountInfoFails?: boolean

  /** Override the resolved value of `broadcastTransaction`. */
  broadcastResult?: TransactionFixture
  /** If true, `broadcastTransaction` rejects with an error. */
  broadcastFails?: boolean

  /** Override the resolved value of `pollTransactionStatus`. */
  txStatus?: BalanceFixture
  /** If true, `pollTransactionStatus` rejects with an error. */
  pollFails?: boolean

  /** Override the resolved value of `fundTestnetAccount`. */
  fundResult?: { txHash: string; message: string }
  /** If true, `fundTestnetAccount` rejects with an error. */
  fundFails?: boolean

  /** Override the resolved value of `getAccountTransactions`. */
  accountTransactions?: Array<{ hash: string; created_at: string }>
  /** If true, `getAccountTransactions` rejects with an error. */
  accountTransactionsFails?: boolean
}

/**
 * Creates a fully-typed mock of `StellarClient` suitable for dependency
 * injection or `vi.mock(...)` factories.
 *
 * Every method is a `vi.fn()` so you can assert call counts / arguments in
 * your tests, or override behaviour with `.mockResolvedValueOnce(...)`.
 *
 * @example
 * ```ts
 * // In a test file:
 * import { makeMockStellarClient, accountFixture } from '@bluecollar/test-utils/stellar-mocks'
 *
 * vi.mock('../clients/stellar.client.js', () => ({
 *   stellarClient: makeMockStellarClient(),
 *   StellarClient: vi.fn().mockImplementation(() => makeMockStellarClient()),
 * }))
 *
 * // Or with custom values:
 * const client = makeMockStellarClient({
 *   accountInfo: accountFixture({ balance: 9999 }),
 *   broadcastFails: true,
 * })
 * ```
 */
export function makeMockStellarClient(options: MockStellarClientOptions = {}) {
  const {
    accountInfo = accountFixture(),
    accountInfoFails = false,
    broadcastResult = transactionFixture(),
    broadcastFails = false,
    txStatus = balanceFixture(),
    pollFails = false,
    fundResult = { txHash: MOCK_TX_HASH, message: 'Account funded successfully' },
    fundFails = false,
    accountTransactions = [],
    accountTransactionsFails = false,
  } = options

  return {
    getAccountInfo: accountInfoFails
      ? vi.fn().mockRejectedValue(new Error('Account not found on Stellar network'))
      : vi.fn().mockResolvedValue(accountInfo),

    broadcastTransaction: broadcastFails
      ? vi.fn().mockRejectedValue(new Error('Broadcast failed: op_underfunded'))
      : vi.fn().mockResolvedValue(broadcastResult),

    pollTransactionStatus: pollFails
      ? vi.fn().mockRejectedValue(new Error('Failed to fetch transaction status'))
      : vi.fn().mockResolvedValue(txStatus),

    fundTestnetAccount: fundFails
      ? vi.fn().mockRejectedValue(new Error('Friendbot failed'))
      : vi.fn().mockResolvedValue(fundResult),

    getAccountTransactions: accountTransactionsFails
      ? vi.fn().mockRejectedValue(new Error('Failed to fetch transactions'))
      : vi.fn().mockResolvedValue(accountTransactions),
  }
}
