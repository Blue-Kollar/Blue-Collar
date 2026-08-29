/**
 * Unit tests for the wallet controller (#1004)
 *
 * The controller is exercised in complete isolation by injecting a stubbed
 * WalletService via `createWalletController()`. No real DB, network, or
 * external deps are touched.
 *
 * Note: `catchAsync` wraps handlers so the returned function is synchronous;
 * the internal promise resolves in the microtask queue. We use `flushPromises`
 * to await all pending microtasks after each handler call.
 */
import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { createWalletController, type WalletService } from './wallet.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve))

function makeService(overrides: Partial<WalletService> = {}): WalletService {
  return {
    getUserBalance: vi.fn(),
    getAccountInfo: vi.fn(),
    linkStellarAccount: vi.fn(),
    buildUnsignedTx: vi.fn(),
    broadcastTransaction: vi.fn(),
    pollTransactionStatus: vi.fn(),
    fundTestnetAccount: vi.fn(),
    getAccountTransactions: vi.fn(),
    syncStellarAccount: vi.fn(),
    ...overrides,
  } as unknown as WalletService
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  return res as unknown as Response
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: 'user-1', role: 'user', email: 'user@example.com' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request
}

// ─── getBalance ───────────────────────────────────────────────────────────────
describe('walletController.getBalance', () => {
  it('returns balance data', async () => {
    const balanceData = { publicKey: 'GAABC123', balance: 500.0, lastSyncedAt: new Date() }
    const service = makeService({ getUserBalance: vi.fn().mockResolvedValue(balanceData) })
    const { getBalance } = createWalletController(service)
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    getBalance(req, res, next)
    await flushPromises()

    expect(service.getUserBalance).toHaveBeenCalledWith('user-1')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', code: 200, data: balanceData }))
  })

  it('calls next with 401 when not authenticated', async () => {
    const service = makeService()
    const { getBalance } = createWalletController(service)
    const req = makeReq({ user: undefined })
    const res = makeRes()
    const next = vi.fn()

    getBalance(req, res, next)
    await flushPromises()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }))
    expect(service.getUserBalance).not.toHaveBeenCalled()
  })
})

// ─── getAccountInfo ───────────────────────────────────────────────────────────
describe('walletController.getAccountInfo', () => {
  it('returns account info', async () => {
    const accountData = { publicKey: 'GAABC123', balance: 100.0, sequence: BigInt(12345) }
    const service = makeService({ getAccountInfo: vi.fn().mockResolvedValue(accountData) })
    const { getAccountInfo } = createWalletController(service)
    const req = makeReq({ params: { publicKey: 'GAABC123' } })
    const res = makeRes()
    const next = vi.fn()

    getAccountInfo(req, res, next)
    await flushPromises()

    expect(service.getAccountInfo).toHaveBeenCalledWith('GAABC123')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', code: 200 }))
  })
})

// ─── linkWallet ───────────────────────────────────────────────────────────────
describe('walletController.linkWallet', () => {
  const validKey = 'G'.padEnd(56, 'A')

  it('returns 201 when wallet is linked', async () => {
    const account = { publicKey: validKey, userId: 'user-1', balance: 0 }
    const service = makeService({ linkStellarAccount: vi.fn().mockResolvedValue(account) })
    const { linkWallet } = createWalletController(service)
    const req = makeReq({ body: { publicKey: validKey } })
    const res = makeRes()
    const next = vi.fn()

    linkWallet(req, res, next)
    await flushPromises()

    expect(service.linkStellarAccount).toHaveBeenCalledWith('user-1', validKey)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('calls next with 400 when publicKey is too short', async () => {
    const service = makeService()
    const { linkWallet } = createWalletController(service)
    const req = makeReq({ body: { publicKey: 'SHORT' } })
    const res = makeRes()
    const next = vi.fn()

    linkWallet(req, res, next)
    await flushPromises()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }))
  })
})

// ─── buildTransaction ─────────────────────────────────────────────────────────
describe('walletController.buildTransaction', () => {
  it('returns tx params', async () => {
    const txData = { sourcePublicKey: 'GSOURCE', destinationPublicKey: 'GDEST', amount: '50', sequence: '100' }
    const service = makeService({ buildUnsignedTx: vi.fn().mockResolvedValue(txData) })
    const { buildTransaction } = createWalletController(service)
    const req = makeReq({ body: { sourcePublicKey: 'GSOURCE', destinationPublicKey: 'GDEST', amount: '50' } })
    const res = makeRes()
    const next = vi.fn()

    buildTransaction(req, res, next)
    await flushPromises()

    expect(service.buildUnsignedTx).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', code: 200 }))
  })

  it('calls next with 400 when amount is missing', async () => {
    const service = makeService()
    const { buildTransaction } = createWalletController(service)
    const req = makeReq({ body: { sourcePublicKey: 'GSRC', destinationPublicKey: 'GDEST' } })
    const res = makeRes()
    const next = vi.fn()

    buildTransaction(req, res, next)
    await flushPromises()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }))
  })
})

// ─── broadcastTx ──────────────────────────────────────────────────────────────
describe('walletController.broadcastTx', () => {
  it('returns tx hash on success', async () => {
    const result = { txHash: 'abc123', txId: 'id-456' }
    const service = makeService({ broadcastTransaction: vi.fn().mockResolvedValue(result) })
    const { broadcastTx } = createWalletController(service)
    const req = makeReq({ body: { signedXdr: 'AAAAAA==' } })
    const res = makeRes()
    const next = vi.fn()

    broadcastTx(req, res, next)
    await flushPromises()

    expect(service.broadcastTransaction).toHaveBeenCalledWith('AAAAAA==')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: result }))
  })

  it('calls next with 400 when signedXdr is missing', async () => {
    const service = makeService()
    const { broadcastTx } = createWalletController(service)
    const req = makeReq({ body: {} })
    const res = makeRes()
    const next = vi.fn()

    broadcastTx(req, res, next)
    await flushPromises()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }))
  })
})

// ─── getTxStatus ──────────────────────────────────────────────────────────────
describe('walletController.getTxStatus', () => {
  it('returns status', async () => {
    const statusData = { status: 'confirmed', resultCode: 'SUCCESS' }
    const service = makeService({ pollTransactionStatus: vi.fn().mockResolvedValue(statusData) })
    const { getTxStatus } = createWalletController(service)
    const req = makeReq({ params: { txHash: 'abc123' } })
    const res = makeRes()
    const next = vi.fn()

    getTxStatus(req, res, next)
    await flushPromises()

    expect(service.pollTransactionStatus).toHaveBeenCalledWith('abc123')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: statusData }))
  })
})

// ─── fundTestnet ──────────────────────────────────────────────────────────────
describe('walletController.fundTestnet', () => {
  it('returns success when funding succeeds', async () => {
    const fundResult = { txHash: 'fundtxhash', message: 'Account funded successfully' }
    const service = makeService({ fundTestnetAccount: vi.fn().mockResolvedValue(fundResult) })
    const { fundTestnet } = createWalletController(service)
    const req = makeReq({ body: { publicKey: 'GPUBKEY123' } })
    const res = makeRes()
    const next = vi.fn()

    fundTestnet(req, res, next)
    await flushPromises()

    expect(service.fundTestnetAccount).toHaveBeenCalledWith('GPUBKEY123')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: fundResult }))
  })

  it('calls next with 400 when publicKey is missing', async () => {
    const service = makeService()
    const { fundTestnet } = createWalletController(service)
    const req = makeReq({ body: {} })
    const res = makeRes()
    const next = vi.fn()

    fundTestnet(req, res, next)
    await flushPromises()

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }))
  })
})

// ─── getTransactions ──────────────────────────────────────────────────────────
describe('walletController.getTransactions', () => {
  it('returns transaction list', async () => {
    const txList = [{ hash: 'tx1', created_at: '2026-01-01T00:00:00Z' }]
    const service = makeService({ getAccountTransactions: vi.fn().mockResolvedValue(txList) })
    const { getTransactions } = createWalletController(service)
    const req = makeReq({ params: { publicKey: 'GPUBKEY123' }, query: {} })
    const res = makeRes()
    const next = vi.fn()

    getTransactions(req, res, next)
    await flushPromises()

    expect(service.getAccountTransactions).toHaveBeenCalledWith('GPUBKEY123', 50, 'desc')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: txList }))
  })

  it('passes limit and order query params', async () => {
    const service = makeService({ getAccountTransactions: vi.fn().mockResolvedValue([]) })
    const { getTransactions } = createWalletController(service)
    const req = makeReq({ params: { publicKey: 'GPUBKEY123' }, query: { limit: '10', order: 'asc' } })
    const res = makeRes()
    const next = vi.fn()

    getTransactions(req, res, next)
    await flushPromises()

    expect(service.getAccountTransactions).toHaveBeenCalledWith('GPUBKEY123', 10, 'asc')
  })
})
