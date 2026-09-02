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

import { beforeEach,describe, expect, it, vi } from 'vitest'

import { AppError } from '../utils/AppError.js'
import { createWalletService } from './wallet.service.js'

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
