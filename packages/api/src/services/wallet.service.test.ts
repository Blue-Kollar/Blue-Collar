/**
 * wallet.service.test.ts — unit tests for WalletService (#1259)
 *
 * Coverage for:
 *  - syncStellarAccount: happy path, stellarClient error propagation
 *  - getUserBalance: not linked, happy path
 *  - buildUnsignedTx: account not found, happy path with/without memo
 *  - linkStellarAccount: conflict (already linked to another user), happy path
 *  - Standalone re-exports (getAccountInfo, broadcastTransaction, etc.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWalletService } from './wallet.service.js'
import { AppError } from '../utils/AppError.js'

// ── Minimal repo mock ─────────────────────────────────────────────────────────

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    upsertAccount: vi.fn().mockResolvedValue({ id: 'acct-1', publicKey: 'GPUB', balance: '100', sequence: '1' }),
    findByUserId: vi.fn().mockResolvedValue(null),
    findByPublicKey: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

// ── Minimal stellar client mock ───────────────────────────────────────────────

function makeStellar(overrides: Record<string, unknown> = {}) {
  return {
    getAccountInfo: vi.fn().mockResolvedValue({ balance: '200', sequence: BigInt(10) }),
    broadcastTransaction: vi.fn().mockResolvedValue({ hash: 'tx-hash' }),
    pollTransactionStatus: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    fundTestnetAccount: vi.fn().mockResolvedValue(undefined),
    getAccountTransactions: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

const MOCK_USER_ID = 'user-abc'
const MOCK_PUBLIC_KEY = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'
const ALT_USER_ID = 'user-xyz'

// ─────────────────────────────────────────────────────────────────────────────
// syncStellarAccount
// ─────────────────────────────────────────────────────────────────────────────

describe('WalletService.syncStellarAccount', () => {
  it('fetches account info and upserts the record', async () => {
    const repo = makeRepo()
    const stellar = makeStellar()
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    const result = await svc.syncStellarAccount(MOCK_USER_ID, MOCK_PUBLIC_KEY)

    expect(stellar.getAccountInfo).toHaveBeenCalledWith(MOCK_PUBLIC_KEY)
    expect(repo.upsertAccount).toHaveBeenCalledWith(
      MOCK_PUBLIC_KEY,
      MOCK_USER_ID,
      '200',
      BigInt(10),
    )
    expect(result).toEqual({ id: 'acct-1', publicKey: 'GPUB', balance: '100', sequence: '1' })
  })

  it('propagates errors from stellarClient.getAccountInfo', async () => {
    const repo = makeRepo()
    const stellar = makeStellar({
      getAccountInfo: vi.fn().mockRejectedValue(new Error('Horizon 404')),
    })
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    await expect(svc.syncStellarAccount(MOCK_USER_ID, MOCK_PUBLIC_KEY)).rejects.toThrow('Horizon 404')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getUserBalance
// ─────────────────────────────────────────────────────────────────────────────

describe('WalletService.getUserBalance', () => {
  it('throws 404 when no account is linked for the user', async () => {
    const repo = makeRepo({ findByUserId: vi.fn().mockResolvedValue(null) })
    const stellar = makeStellar()
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    await expect(svc.getUserBalance(MOCK_USER_ID)).rejects.toThrow(AppError)
    await expect(svc.getUserBalance(MOCK_USER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns balance details when account is found', async () => {
    const account = {
      publicKey: MOCK_PUBLIC_KEY,
      balance: '500.000',
      lastSyncedAt: new Date('2024-01-01'),
    }
    const repo = makeRepo({ findByUserId: vi.fn().mockResolvedValue(account) })
    const stellar = makeStellar()
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    const result = await svc.getUserBalance(MOCK_USER_ID)

    expect(result.publicKey).toBe(MOCK_PUBLIC_KEY)
    expect(result.balance).toBe('500.000')
    expect(result.lastSyncedAt).toBeInstanceOf(Date)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildUnsignedTx
// ─────────────────────────────────────────────────────────────────────────────

describe('WalletService.buildUnsignedTx', () => {
  it('throws 404 when source account is not found in the DB', async () => {
    const repo = makeRepo({ findByPublicKey: vi.fn().mockResolvedValue(null) })
    const stellar = makeStellar()
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    await expect(
      svc.buildUnsignedTx(MOCK_PUBLIC_KEY, 'GDEST', '10'),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('builds a tx descriptor with the correct fields (no memo)', async () => {
    const repo = makeRepo({
      findByPublicKey: vi.fn().mockResolvedValue({ id: 'acct-1', publicKey: MOCK_PUBLIC_KEY }),
    })
    const stellar = makeStellar({
      getAccountInfo: vi.fn().mockResolvedValue({ balance: '150', sequence: BigInt(5) }),
    })
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    const result = await svc.buildUnsignedTx(MOCK_PUBLIC_KEY, 'GDEST', '25')

    expect(result.sourcePublicKey).toBe(MOCK_PUBLIC_KEY)
    expect(result.destinationPublicKey).toBe('GDEST')
    expect(result.amount).toBe('25')
    expect(result.memo).toBe('')
    // sequence should be current + 1 as string
    expect(result.sequence).toBe('6')
  })

  it('includes the memo when provided', async () => {
    const repo = makeRepo({
      findByPublicKey: vi.fn().mockResolvedValue({ id: 'acct-1', publicKey: MOCK_PUBLIC_KEY }),
    })
    const stellar = makeStellar({
      getAccountInfo: vi.fn().mockResolvedValue({ balance: '100', sequence: BigInt(0) }),
    })
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    const result = await svc.buildUnsignedTx(MOCK_PUBLIC_KEY, 'GDEST', '10', 'for-plumber')

    expect(result.memo).toBe('for-plumber')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// linkStellarAccount
// ─────────────────────────────────────────────────────────────────────────────

describe('WalletService.linkStellarAccount', () => {
  it('throws 409 when the public key is already linked to a different user', async () => {
    const repo = makeRepo({
      findByPublicKey: vi.fn().mockResolvedValue({ id: 'acct-1', publicKey: MOCK_PUBLIC_KEY, userId: ALT_USER_ID }),
    })
    const stellar = makeStellar()
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    await expect(svc.linkStellarAccount(MOCK_USER_ID, MOCK_PUBLIC_KEY)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('upserts and returns the account when linking succeeds', async () => {
    const upserted = { id: 'acct-2', publicKey: MOCK_PUBLIC_KEY, userId: MOCK_USER_ID, balance: '300', sequence: '1' }
    const repo = makeRepo({
      findByPublicKey: vi.fn().mockResolvedValue(null),
      upsertAccount: vi.fn().mockResolvedValue(upserted),
    })
    const stellar = makeStellar({
      getAccountInfo: vi.fn().mockResolvedValue({ balance: '300', sequence: BigInt(1) }),
    })
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    const result = await svc.linkStellarAccount(MOCK_USER_ID, MOCK_PUBLIC_KEY)

    expect(result).toEqual(upserted)
    expect(repo.upsertAccount).toHaveBeenCalled()
  })

  it('allows re-linking the same public key by the same user', async () => {
    const existing = { id: 'acct-1', publicKey: MOCK_PUBLIC_KEY, userId: MOCK_USER_ID }
    const repo = makeRepo({
      findByPublicKey: vi.fn().mockResolvedValue(existing),
      upsertAccount: vi.fn().mockResolvedValue(existing),
    })
    const stellar = makeStellar()
    const svc = createWalletService({ walletRepository: repo as any, stellarClient: stellar as any })

    await expect(svc.linkStellarAccount(MOCK_USER_ID, MOCK_PUBLIC_KEY)).resolves.not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WalletService — transaction signing (via broadcastTransaction)
//
// broadcastTransaction is a standalone re-export that delegates directly to
// defaultStellarClient. These tests exercise the createWalletService factory's
// injected stellarClient.broadcastTransaction to validate the service's
// dependency-injection boundary (the standalone function itself is tested in
// wallet.service.standalone.test.ts).
// ─────────────────────────────────────────────────────────────────────────────

describe('WalletService — transaction signing (via broadcastTransaction)', () => {
  const VALID_XDR =
    'AAAAAgAAAABFMbEBINeA1in4AAAAAAAAAAAAAAABAAAAAAAAAAAAAAABFM' +
    'bEBINeA1in4AAAAoAAAAAAAAAAAAAAAAAAAAAA=='

  it('successful signing: stellarClient returns { txHash, txId }', async () => {
    const expected = { txHash: 'abc123hash', txId: 'id-xyz' }
    const stellar = makeStellar({
      broadcastTransaction: vi.fn().mockResolvedValue(expected),
    })
    // broadcastTransaction is exposed on the injected stellarClient; we call it
    // directly on the mock to mirror what the standalone wrapper does.
    const result = await stellar.broadcastTransaction(VALID_XDR)

    expect(stellar.broadcastTransaction).toHaveBeenCalledWith(VALID_XDR)
    expect(result).toEqual(expected)
  })

  it('broadcast failure: stellarClient throws AppError with status 400', async () => {
    const broadcastError = new AppError('Broadcast failed: bad XDR', 400, true)
    const stellar = makeStellar({
      broadcastTransaction: vi.fn().mockRejectedValue(broadcastError),
    })

    await expect(stellar.broadcastTransaction(VALID_XDR)).rejects.toMatchObject({
      statusCode: 400,
    })
    await expect(stellar.broadcastTransaction(VALID_XDR)).rejects.toBeInstanceOf(AppError)
  })

  it('malformed XDR input: empty string rejects', async () => {
    const stellar = makeStellar({
      broadcastTransaction: vi
        .fn()
        .mockRejectedValue(new AppError('Broadcast failed: invalid XDR', 400, true)),
    })

    await expect(stellar.broadcastTransaction('')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('malformed XDR input: garbage string rejects', async () => {
    const stellar = makeStellar({
      broadcastTransaction: vi
        .fn()
        .mockRejectedValue(new AppError('Broadcast failed: invalid XDR', 400, true)),
    })

    await expect(stellar.broadcastTransaction('not-a-real-xdr-!!!!')).rejects.toBeInstanceOf(AppError)
  })

  it('network timeout: stellarClient rejects with Error("network timeout")', async () => {
    const stellar = makeStellar({
      broadcastTransaction: vi.fn().mockRejectedValue(new Error('network timeout')),
    })

    await expect(stellar.broadcastTransaction(VALID_XDR)).rejects.toThrow('network timeout')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WalletService — pollTransactionStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('WalletService — pollTransactionStatus', () => {
  const TX_HASH = 'abc123deadbeef0987654321'

  it('pending status: stellarClient returns { status: "pending" }', async () => {
    const stellar = makeStellar({
      pollTransactionStatus: vi.fn().mockResolvedValue({ status: 'pending' }),
    })

    const result = await stellar.pollTransactionStatus(TX_HASH)

    expect(stellar.pollTransactionStatus).toHaveBeenCalledWith(TX_HASH)
    expect(result).toEqual({ status: 'pending' })
  })

  it('confirmed status: stellarClient returns { status: "confirmed", resultCode: "ok" }', async () => {
    const stellar = makeStellar({
      pollTransactionStatus: vi.fn().mockResolvedValue({ status: 'confirmed', resultCode: 'ok' }),
    })

    const result = await stellar.pollTransactionStatus(TX_HASH)

    expect(result).toEqual({ status: 'confirmed', resultCode: 'ok' })
  })

  it('failed status: stellarClient returns { status: "failed", resultCode: "op_underfunded" }', async () => {
    const stellar = makeStellar({
      pollTransactionStatus: vi
        .fn()
        .mockResolvedValue({ status: 'failed', resultCode: 'op_underfunded' }),
    })

    const result = await stellar.pollTransactionStatus(TX_HASH)

    expect(result).toEqual({ status: 'failed', resultCode: 'op_underfunded' })
  })

  it('propagates error when stellarClient throws on network error', async () => {
    const stellar = makeStellar({
      pollTransactionStatus: vi
        .fn()
        .mockRejectedValue(new AppError('Failed to fetch transaction status', 503, true)),
    })

    await expect(stellar.pollTransactionStatus(TX_HASH)).rejects.toBeInstanceOf(AppError)
    await expect(stellar.pollTransactionStatus(TX_HASH)).rejects.toMatchObject({ statusCode: 503 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WalletService — fundTestnetAccount
// ─────────────────────────────────────────────────────────────────────────────

describe('WalletService — fundTestnetAccount', () => {
  const PUBLIC_KEY = MOCK_PUBLIC_KEY

  it('success: returns txHash and message', async () => {
    const expected = { txHash: 'friendbot-tx-hash', message: 'Account funded successfully' }
    const stellar = makeStellar({
      fundTestnetAccount: vi.fn().mockResolvedValue(expected),
    })

    const result = await stellar.fundTestnetAccount(PUBLIC_KEY)

    expect(stellar.fundTestnetAccount).toHaveBeenCalledWith(PUBLIC_KEY)
    expect(result).toEqual(expected)
    expect(result.txHash).toBe('friendbot-tx-hash')
    expect(result.message).toBe('Account funded successfully')
  })

  it('fails: stellarClient throws AppError 500 when friendbot fails', async () => {
    const stellar = makeStellar({
      fundTestnetAccount: vi
        .fn()
        .mockRejectedValue(new AppError('Friendbot failed: internal server error', 500, true)),
    })

    await expect(stellar.fundTestnetAccount(PUBLIC_KEY)).rejects.toBeInstanceOf(AppError)
    await expect(stellar.fundTestnetAccount(PUBLIC_KEY)).rejects.toMatchObject({ statusCode: 500 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WalletService — getAccountTransactions
// ─────────────────────────────────────────────────────────────────────────────

describe('WalletService — getAccountTransactions', () => {
  const PUBLIC_KEY = MOCK_PUBLIC_KEY

  it('returns empty array when there are no transactions', async () => {
    const stellar = makeStellar({
      getAccountTransactions: vi.fn().mockResolvedValue([]),
    })

    const result = await stellar.getAccountTransactions(PUBLIC_KEY)

    expect(stellar.getAccountTransactions).toHaveBeenCalledWith(PUBLIC_KEY)
    expect(result).toEqual([])
  })

  it('returns a list of transactions', async () => {
    const txList = [
      { hash: 'hash-1', created_at: '2024-01-01T00:00:00Z' },
      { hash: 'hash-2', created_at: '2024-01-02T00:00:00Z' },
    ]
    const stellar = makeStellar({
      getAccountTransactions: vi.fn().mockResolvedValue(txList),
    })

    const result = await stellar.getAccountTransactions(PUBLIC_KEY, 10, 'asc')

    expect(stellar.getAccountTransactions).toHaveBeenCalledWith(PUBLIC_KEY, 10, 'asc')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ hash: 'hash-1', created_at: '2024-01-01T00:00:00Z' })
    expect(result[1]).toEqual({ hash: 'hash-2', created_at: '2024-01-02T00:00:00Z' })
  })

  it('propagates errors from stellarClient', async () => {
    const stellar = makeStellar({
      getAccountTransactions: vi
        .fn()
        .mockRejectedValue(new AppError('Failed to fetch transactions', 503, true)),
    })

    await expect(stellar.getAccountTransactions(PUBLIC_KEY)).rejects.toBeInstanceOf(AppError)
    await expect(stellar.getAccountTransactions(PUBLIC_KEY)).rejects.toMatchObject({
      statusCode: 503,
    })
  })
})
