/**
 * MockStellarRpcServer
 *
 * A deterministic, in-process mock for Stellar Horizon REST and Soroban RPC
 * calls made by `StellarClient`.  It intercepts `globalThis.fetch` via
 * Vitest's `vi.stubGlobal` so the real network is never touched during tests.
 *
 * ─── Design goals ────────────────────────────────────────────────────────────
 *  1. Zero network I/O — every request is handled synchronously in memory.
 *  2. Deterministic — default fixtures are stable constants so snapshots and
 *     assertion values never change between runs.
 *  3. Composable — individual response types can be overridden per-test via
 *     `server.setResponse(...)` or the full option bag in the constructor.
 *  4. Observable — `server.calls` records every intercepted URL + method so
 *     tests can assert "no live network call was made".
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { MockStellarRpcServer } from '../clients/mockStellarRpcServer.js'
 *
 *   describe('StellarClient', () => {
 *     const server = new MockStellarRpcServer()
 *
 *     beforeEach(() => server.install())   // stubs global fetch
 *     afterEach(() => server.uninstall())  // restores original fetch
 *
 *     it('returns account balance', async () => {
 *       server.setResponse('account', { balance: '250.0000000', sequence: '999' })
 *       const client = new StellarClient('https://mock-horizon.test')
 *       const info = await client.getAccountInfo('GABC...')
 *       expect(info.balance).toBe(250)
 *       expect(server.calls).toHaveLength(1)
 *       expect(server.calls[0].url).toContain('/accounts/')
 *     })
 *   })
 *
 * ─── Adding new response types ────────────────────────────────────────────────
 * See MOCK_RPC_GUIDE.md in packages/api/src/clients/ for a step-by-step guide.
 */

import { vi } from 'vitest'

// ─── Stable fixture constants ─────────────────────────────────────────────────

/** Default 56-character Stellar address used in all account fixtures. */
export const MOCK_HORIZON_ADDRESS =
  'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

/** Stable 64-hex transaction hash used as default in broadcast / status fixtures. */
export const MOCK_HORIZON_TX_HASH =
  'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

/** Default XLM balance string returned by the account endpoint. */
export const MOCK_HORIZON_BALANCE = '100.0000000'

/** Default sequence number returned by the account endpoint. */
export const MOCK_HORIZON_SEQUENCE = '1234567'

// ─── Response shape types ─────────────────────────────────────────────────────

export interface AccountResponse {
  balance: string
  sequence: string
  /** Extra non-native asset balances to include alongside XLM. */
  extraBalances?: Array<{ asset_type: string; balance: string; asset_code?: string }>
}

export interface BroadcastResponse {
  hash: string
  id: string
}

export interface TransactionStatusResponse {
  successful: boolean
  result_code: string
}

export interface FriendbotResponse {
  hash: string
}

export interface TransactionHistoryResponse {
  records: Array<{ hash: string; created_at: string }>
}

/** Collected record of every fetch intercepted by the mock server. */
export interface InterceptedCall {
  url: string
  method: string
  body?: string
}

// ─── Error simulation options ─────────────────────────────────────────────────

export interface MockStellarRpcServerOptions {
  /** If true, GET /accounts/:id returns 404. */
  accountNotFound?: boolean
  /** If true, POST /transactions returns 400 with a broadcast-failure body. */
  broadcastFails?: boolean
  /** If true, GET /transactions/:hash returns 404 (pending). */
  txPending?: boolean
  /** If true, GET /accounts/:id returns 500. */
  accountServerError?: boolean
  /** Override the default account fixture values. */
  account?: Partial<AccountResponse>
  /** Override the default broadcast fixture values. */
  broadcast?: Partial<BroadcastResponse>
  /** Override the default transaction-status fixture values. */
  txStatus?: Partial<TransactionStatusResponse>
  /** Override the default friendbot fixture values. */
  friendbot?: Partial<FriendbotResponse>
  /** Initial transaction history records (default: []). */
  txHistory?: Array<{ hash: string; created_at: string }>
  /**
   * Custom per-URL handler.  Receives the intercepted URL and RequestInit and
   * should return a `Response` (or `null` to fall through to the built-in
   * routing logic).
   */
  customHandler?: (url: string, method: string, init?: RequestInit) => Response | null
}

// ─── MockStellarRpcServer ─────────────────────────────────────────────────────

/**
 * Deterministic mock for all Horizon REST + Soroban RPC calls made by
 * `StellarClient`.  Install it before each test and uninstall after.
 */
export class MockStellarRpcServer {
  /** Every URL + method intercepted since the last `install()`. */
  public readonly calls: InterceptedCall[] = []

  private opts: MockStellarRpcServerOptions
  private installed = false

  // ── Per-call response overrides (mutated via setResponse) ─────────────────
  private accountOpts: AccountResponse
  private broadcastOpts: BroadcastResponse
  private txStatusOpts: TransactionStatusResponse
  private friendbotOpts: FriendbotResponse
  private txHistoryOpts: Array<{ hash: string; created_at: string }>

  constructor(opts: MockStellarRpcServerOptions = {}) {
    this.opts = opts
    this.accountOpts = {
      balance: opts.account?.balance ?? MOCK_HORIZON_BALANCE,
      sequence: opts.account?.sequence ?? MOCK_HORIZON_SEQUENCE,
      extraBalances: opts.account?.extraBalances ?? [],
    }
    this.broadcastOpts = {
      hash: opts.broadcast?.hash ?? MOCK_HORIZON_TX_HASH,
      id: opts.broadcast?.id ?? `id_${MOCK_HORIZON_TX_HASH.slice(0, 8)}`,
    }
    this.txStatusOpts = {
      successful: opts.txStatus?.successful ?? true,
      result_code: opts.txStatus?.result_code ?? 'ok',
    }
    this.friendbotOpts = {
      hash: opts.friendbot?.hash ?? MOCK_HORIZON_TX_HASH,
    }
    this.txHistoryOpts = opts.txHistory ?? []
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Stubs `globalThis.fetch` with the mock implementation.
   * Call this in `beforeEach`.
   */
  install(): void {
    if (this.installed) return
    this.calls.length = 0
    vi.stubGlobal('fetch', this._handler.bind(this))
    this.installed = true
  }

  /**
   * Restores the original `globalThis.fetch`.
   * Call this in `afterEach`.
   */
  uninstall(): void {
    if (!this.installed) return
    vi.unstubAllGlobals()
    this.installed = false
  }

  // ── Per-test response configuration ───────────────────────────────────────

  /**
   * Override one response type for the next request(s).
   *
   * @example
   * server.setResponse('account', { balance: '500.0000000', sequence: '42' })
   * server.setResponse('broadcast', { hash: 'deadbeef' + '0'.repeat(56) })
   * server.setResponse('txStatus', { successful: false, result_code: 'op_underfunded' })
   * server.setResponse('txHistory', [{ hash: 'tx1', created_at: '2026-01-01T00:00:00Z' }])
   */
  setResponse(type: 'account', value: Partial<AccountResponse>): void
  setResponse(type: 'broadcast', value: Partial<BroadcastResponse>): void
  setResponse(type: 'txStatus', value: Partial<TransactionStatusResponse>): void
  setResponse(type: 'friendbot', value: Partial<FriendbotResponse>): void
  setResponse(type: 'txHistory', value: Array<{ hash: string; created_at: string }>): void
  setResponse(type: string, value: unknown): void {
    switch (type) {
      case 'account':
        this.accountOpts = { ...this.accountOpts, ...(value as Partial<AccountResponse>) }
        break
      case 'broadcast':
        this.broadcastOpts = { ...this.broadcastOpts, ...(value as Partial<BroadcastResponse>) }
        break
      case 'txStatus':
        this.txStatusOpts = { ...this.txStatusOpts, ...(value as Partial<TransactionStatusResponse>) }
        break
      case 'friendbot':
        this.friendbotOpts = { ...this.friendbotOpts, ...(value as Partial<FriendbotResponse>) }
        break
      case 'txHistory':
        this.txHistoryOpts = value as Array<{ hash: string; created_at: string }>
        break
    }
  }

  /**
   * Reset all response overrides back to the defaults supplied at construction
   * time (useful inside `beforeEach` when the constructor options serve as
   * per-suite defaults).
   */
  reset(): void {
    this.accountOpts = {
      balance: this.opts.account?.balance ?? MOCK_HORIZON_BALANCE,
      sequence: this.opts.account?.sequence ?? MOCK_HORIZON_SEQUENCE,
      extraBalances: this.opts.account?.extraBalances ?? [],
    }
    this.broadcastOpts = {
      hash: this.opts.broadcast?.hash ?? MOCK_HORIZON_TX_HASH,
      id: this.opts.broadcast?.id ?? `id_${MOCK_HORIZON_TX_HASH.slice(0, 8)}`,
    }
    this.txStatusOpts = {
      successful: this.opts.txStatus?.successful ?? true,
      result_code: this.opts.txStatus?.result_code ?? 'ok',
    }
    this.friendbotOpts = {
      hash: this.opts.friendbot?.hash ?? MOCK_HORIZON_TX_HASH,
    }
    this.txHistoryOpts = this.opts.txHistory ?? []
    this.calls.length = 0
  }

  // ── Internal fetch handler ─────────────────────────────────────────────────

  private _handler(url: string | URL | Request, init?: RequestInit): Promise<Response> {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = typeof init?.body === 'string' ? init.body : undefined

    this.calls.push({ url: urlStr, method, body })

    // Custom handler takes priority (return null to fall through)
    if (this.opts.customHandler) {
      const custom = this.opts.customHandler(urlStr, method, init)
      if (custom !== null) return Promise.resolve(custom)
    }

    return Promise.resolve(this._route(urlStr, method))
  }

  private _route(url: string, method: string): Response {
    // ── Friendbot ────────────────────────────────────────────────────────────
    if (url.includes('friendbot')) {
      return this._json(this.friendbotOpts, 200)
    }

    // ── POST /transactions (broadcast) ───────────────────────────────────────
    if (method === 'POST' && url.endsWith('/transactions')) {
      if (this.opts.broadcastFails) {
        return this._json(
          { title: 'Transaction Failed', detail: 'op_underfunded' },
          400,
        )
      }
      return this._json(this.broadcastOpts, 200)
    }

    // ── GET /accounts/:id/transactions (history) ─────────────────────────────
    if (method === 'GET' && url.includes('/accounts/') && url.includes('/transactions')) {
      return this._json({ _embedded: { records: this.txHistoryOpts } }, 200)
    }

    // ── GET /transactions/:hash (status) ─────────────────────────────────────
    if (method === 'GET' && /\/transactions\/[^/]+$/.test(url) && !url.includes('/accounts/')) {
      if (this.opts.txPending) {
        return new Response('{}', { status: 404 })
      }
      return this._json(this.txStatusOpts, 200)
    }

    // ── GET /accounts/:id (account info) ─────────────────────────────────────
    if (method === 'GET' && url.includes('/accounts/')) {
      if (this.opts.accountNotFound) {
        return new Response('{}', { status: 404 })
      }
      if (this.opts.accountServerError) {
        return new Response('Internal Server Error', { status: 500 })
      }
      const balances = [
        { asset_type: 'native', balance: this.accountOpts.balance },
        ...(this.accountOpts.extraBalances ?? []),
      ]
      return this._json({ balances, sequence: this.accountOpts.sequence }, 200)
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    console.warn(`[MockStellarRpcServer] Unhandled mock request: ${method} ${url}`)
    return this._json({}, 200)
  }

  private _json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
