/**
 * Tests for packages/test-utils/src/stellar-mocks.ts
 *
 * Issue: #1265 — Add mock Stellar SDK fixtures for backend tests
 *
 * Covers:
 *  - makeMockHorizonFetch: account not found, broadcast failure, success, pending tx
 *  - makeFreighterMock: connected/disconnected states, signTransaction
 *  - makeSorobanRpcMock: simulate success, simulate failure
 *  - makeMockStellarClient: getAccountInfo, broadcastTransaction, pollTransactionStatus
 *  - fixture helpers: accountFixture, transactionFixture, balanceFixture
 */
import { describe, it, expect, vi } from 'vitest'
import {
  MOCK_BALANCE,
  MOCK_FEE_RECIPIENT_ADDRESS,
  MOCK_SEQUENCE,
  MOCK_STELLAR_ADDRESS,
  MOCK_TX_HASH,
  MOCK_WORKER_ADDRESS,
  accountFixture,
  balanceFixture,
  makeFreighterMock,
  makeMockHorizonFetch,
  makeMockStellarClient,
  makeSorobanRpcMock,
  transactionFixture,
} from '../src/stellar-mocks'

// ─── Constants ────────────────────────────────────────────────────────────────

describe('exported constants', () => {
  it('MOCK_STELLAR_ADDRESS is a 56-character G… key', () => {
    expect(MOCK_STELLAR_ADDRESS).toHaveLength(56)
    expect(MOCK_STELLAR_ADDRESS.startsWith('G')).toBe(true)
  })

  it('MOCK_WORKER_ADDRESS is a 56-character G… key', () => {
    expect(MOCK_WORKER_ADDRESS).toHaveLength(56)
    expect(MOCK_WORKER_ADDRESS.startsWith('G')).toBe(true)
  })

  it('MOCK_FEE_RECIPIENT_ADDRESS is a 56-character G… key', () => {
    expect(MOCK_FEE_RECIPIENT_ADDRESS).toHaveLength(56)
    expect(MOCK_FEE_RECIPIENT_ADDRESS.startsWith('G')).toBe(true)
  })

  it('MOCK_TX_HASH is a 64-character hex string', () => {
    expect(MOCK_TX_HASH).toHaveLength(64)
    expect(MOCK_TX_HASH).toMatch(/^[0-9a-f]+$/)
  })

  it('MOCK_SEQUENCE is a bigint', () => {
    expect(typeof MOCK_SEQUENCE).toBe('bigint')
    expect(MOCK_SEQUENCE).toBe(BigInt(1234567))
  })

  it('MOCK_BALANCE is a positive number', () => {
    expect(typeof MOCK_BALANCE).toBe('number')
    expect(MOCK_BALANCE).toBeGreaterThan(0)
  })
})

// ─── Fixture helpers ──────────────────────────────────────────────────────────

describe('accountFixture', () => {
  it('returns defaults matching the shared constants', () => {
    const fixture = accountFixture()
    expect(fixture.publicKey).toBe(MOCK_STELLAR_ADDRESS)
    expect(fixture.balance).toBe(MOCK_BALANCE)
    expect(fixture.sequence).toBe(MOCK_SEQUENCE)
  })

  it('applies partial overrides', () => {
    const fixture = accountFixture({ balance: 9999, publicKey: 'GCUSTOM' })
    expect(fixture.balance).toBe(9999)
    expect(fixture.publicKey).toBe('GCUSTOM')
    expect(fixture.sequence).toBe(MOCK_SEQUENCE) // unchanged
  })

  it('overriding sequence produces a bigint', () => {
    const fixture = accountFixture({ sequence: BigInt(99) })
    expect(fixture.sequence).toBe(BigInt(99))
  })
})

describe('transactionFixture', () => {
  it('returns defaults matching the shared constants', () => {
    const fixture = transactionFixture()
    expect(fixture.txHash).toBe(MOCK_TX_HASH)
    expect(fixture.txId).toBe(`id_${MOCK_TX_HASH.slice(0, 8)}`)
  })

  it('applies partial overrides — txId is derived from overridden txHash', () => {
    const hash = 'deadbeef' + '0'.repeat(56)
    const fixture = transactionFixture({ txHash: hash })
    expect(fixture.txHash).toBe(hash)
    expect(fixture.txId).toBe('id_deadbeef')
  })

  it('accepts explicit txId override', () => {
    const fixture = transactionFixture({ txHash: MOCK_TX_HASH, txId: 'custom-id' })
    expect(fixture.txId).toBe('custom-id')
  })
})

describe('balanceFixture', () => {
  it('returns a confirmed status with resultCode ok by default', () => {
    const fixture = balanceFixture()
    expect(fixture.status).toBe('confirmed')
    expect(fixture.resultCode).toBe('ok')
  })

  it('applies partial overrides', () => {
    const fixture = balanceFixture({ status: 'failed', resultCode: 'op_underfunded' })
    expect(fixture.status).toBe('failed')
    expect(fixture.resultCode).toBe('op_underfunded')
  })

  it('resultCode may be omitted via override', () => {
    const fixture = balanceFixture({ resultCode: undefined })
    expect(fixture.resultCode).toBeUndefined()
  })
})

// ─── makeMockHorizonFetch ─────────────────────────────────────────────────────

describe('makeMockHorizonFetch', () => {
  it('is a vi.fn()', () => {
    const mock = makeMockHorizonFetch()
    expect(vi.isMockFunction(mock)).toBe(true)
  })

  describe('GET /accounts/:id — success', () => {
    it('returns 200 with native balance and sequence', async () => {
      const mock = makeMockHorizonFetch({ balance: '250.0000000', sequence: '9999' })
      const res = await mock('https://horizon-testnet.stellar.org/accounts/GABCD')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.balances[0]).toMatchObject({ asset_type: 'native', balance: '250.0000000' })
      expect(body.sequence).toBe('9999')
    })

    it('includes extra balances when provided', async () => {
      const extra = [{ asset_type: 'credit_alphanum4', balance: '5.0000000', asset_code: 'USDC' }]
      const mock = makeMockHorizonFetch({ extraBalances: extra })
      const res = await mock('https://horizon-testnet.stellar.org/accounts/GABCD')
      const body = await res.json()
      expect(body.balances).toHaveLength(2)
      expect(body.balances[1].asset_code).toBe('USDC')
    })
  })

  describe('GET /accounts/:id — account not found', () => {
    it('returns 404 when accountNotFound is true', async () => {
      const mock = makeMockHorizonFetch({ accountNotFound: true })
      const res = await mock('https://horizon-testnet.stellar.org/accounts/GABCD')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /transactions — success', () => {
    it('returns 200 with hash and id', async () => {
      const mock = makeMockHorizonFetch({ txHash: MOCK_TX_HASH })
      const res = await mock('https://horizon-testnet.stellar.org/transactions', {
        method: 'POST',
        body: 'tx=MOCK_XDR',
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.hash).toBe(MOCK_TX_HASH)
      expect(body.id).toBe(`id_${MOCK_TX_HASH.slice(0, 8)}`)
    })
  })

  describe('POST /transactions — broadcast failure', () => {
    it('returns 400 with error detail when broadcastFails is true', async () => {
      const mock = makeMockHorizonFetch({ broadcastFails: true })
      const res = await mock('https://horizon-testnet.stellar.org/transactions', {
        method: 'POST',
        body: 'tx=MOCK_XDR',
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.detail).toBe('op_underfunded')
    })
  })

  describe('GET /transactions/:hash — status', () => {
    it('returns 200 with successful and result_code on success', async () => {
      const mock = makeMockHorizonFetch({ txSuccessful: true, txResultCode: 'ok' })
      const res = await mock(`https://horizon-testnet.stellar.org/transactions/${MOCK_TX_HASH}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.successful).toBe(true)
      expect(body.result_code).toBe('ok')
    })

    it('returns 404 (pending) when txPending is true', async () => {
      const mock = makeMockHorizonFetch({ txPending: true })
      const res = await mock(`https://horizon-testnet.stellar.org/transactions/${MOCK_TX_HASH}`)
      expect(res.status).toBe(404)
    })
  })

  describe('GET /accounts/:id/transactions — history', () => {
    it('returns an empty records array by default', async () => {
      const mock = makeMockHorizonFetch()
      const res = await mock(
        'https://horizon-testnet.stellar.org/accounts/GABCD/transactions?limit=10',
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body._embedded.records).toEqual([])
    })
  })

  describe('friendbot', () => {
    it('returns 200 with hash', async () => {
      const mock = makeMockHorizonFetch({ txHash: MOCK_TX_HASH })
      const res = await mock('https://friendbot-testnet.stellar.org/bump_sequence', {
        method: 'POST',
        body: JSON.stringify({ account: MOCK_STELLAR_ADDRESS }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.hash).toBe(MOCK_TX_HASH)
    })
  })
})

// ─── makeFreighterMock ────────────────────────────────────────────────────────

describe('makeFreighterMock', () => {
  describe('disconnected state (default)', () => {
    it('isConnected resolves to false', async () => {
      const mock = makeFreighterMock()
      const result = await mock.isConnected()
      expect(result.isConnected).toBe(false)
    })

    it('all functions are vi.fn()', () => {
      const mock = makeFreighterMock()
      for (const key of Object.keys(mock)) {
        expect(vi.isMockFunction(mock[key as keyof typeof mock])).toBe(true)
      }
    })
  })

  describe('connected state', () => {
    it('isConnected resolves to true', async () => {
      const mock = makeFreighterMock({ isConnected: true })
      const result = await mock.isConnected()
      expect(result.isConnected).toBe(true)
    })

    it('getAddress resolves to the configured address', async () => {
      const mock = makeFreighterMock({ isConnected: true, address: MOCK_STELLAR_ADDRESS })
      const result = await mock.getAddress()
      expect(result.address).toBe(MOCK_STELLAR_ADDRESS)
    })

    it('getNetwork resolves to the configured network', async () => {
      const mock = makeFreighterMock({ isConnected: true, network: 'MAINNET' })
      const result = await mock.getNetwork()
      expect(result.network).toBe('MAINNET')
    })
  })

  describe('signTransaction', () => {
    it('resolves with a mock signed XDR', async () => {
      const mock = makeFreighterMock({ isConnected: true })
      const result = await mock.signTransaction('RAW_XDR')
      expect(result.signedXDR).toBe('MOCK_SIGNED_XDR')
    })

    it('is called with the provided XDR', async () => {
      const mock = makeFreighterMock({ isConnected: true })
      await mock.signTransaction('MY_CUSTOM_XDR')
      expect(mock.signTransaction).toHaveBeenCalledWith('MY_CUSTOM_XDR')
    })
  })

  describe('requestAccess', () => {
    it('resolves with the configured address', async () => {
      const mock = makeFreighterMock({ address: MOCK_WORKER_ADDRESS })
      const result = await mock.requestAccess()
      expect(result.address).toBe(MOCK_WORKER_ADDRESS)
    })
  })
})

// ─── makeSorobanRpcMock ───────────────────────────────────────────────────────

describe('makeSorobanRpcMock', () => {
  it('exposes SorobanRpc.Server constructor', () => {
    const mock = makeSorobanRpcMock()
    expect(vi.isMockFunction(mock.SorobanRpc.Server)).toBe(true)
  })

  describe('simulate success', () => {
    it('simulateTransaction resolves with results and cost', async () => {
      const mock = makeSorobanRpcMock({ simulateResult: { success: true } })
      const server = new mock.SorobanRpc.Server('https://soroban-testnet.stellar.org')
      const result = await server.simulateTransaction({} as never)
      expect(result.results).toHaveLength(1)
      expect(result.cost.cpuInsns).toBe('100')
      expect(result.latestLedger).toBe(42)
    })

    it('sendTransaction resolves with PENDING status', async () => {
      const mock = makeSorobanRpcMock()
      const server = new mock.SorobanRpc.Server('https://soroban-testnet.stellar.org')
      const result = await server.sendTransaction({} as never)
      expect(result.hash).toBe(MOCK_TX_HASH)
      expect(result.status).toBe('PENDING')
    })

    it('getTransaction resolves with SUCCESS status', async () => {
      const mock = makeSorobanRpcMock()
      const server = new mock.SorobanRpc.Server('https://soroban-testnet.stellar.org')
      const result = await server.getTransaction(MOCK_TX_HASH)
      expect(result.status).toBe('SUCCESS')
    })
  })

  describe('simulate failure', () => {
    it('simulateTransaction rejects when simulateFails is true', async () => {
      const mock = makeSorobanRpcMock({ simulateFails: true })
      const server = new mock.SorobanRpc.Server('https://soroban-testnet.stellar.org')
      await expect(server.simulateTransaction({} as never)).rejects.toThrow(
        'Soroban simulation failed',
      )
    })
  })

  it('Contract can be instantiated with a contract ID', () => {
    const mock = makeSorobanRpcMock({ contractId: 'MY_CONTRACT' })
    const contract = new mock.Contract('MY_CONTRACT')
    expect(contract.contractId).toBe('MY_CONTRACT')
  })

  it('Networks constants are defined', () => {
    const mock = makeSorobanRpcMock()
    expect(mock.Networks.TESTNET).toContain('Test SDF')
    expect(mock.Networks.PUBLIC).toContain('Public Global')
  })
})

// ─── makeMockStellarClient ────────────────────────────────────────────────────

describe('makeMockStellarClient', () => {
  describe('default behaviour', () => {
    it('all methods are vi.fn()', () => {
      const client = makeMockStellarClient()
      expect(vi.isMockFunction(client.getAccountInfo)).toBe(true)
      expect(vi.isMockFunction(client.broadcastTransaction)).toBe(true)
      expect(vi.isMockFunction(client.pollTransactionStatus)).toBe(true)
      expect(vi.isMockFunction(client.fundTestnetAccount)).toBe(true)
      expect(vi.isMockFunction(client.getAccountTransactions)).toBe(true)
    })
  })

  describe('getAccountInfo', () => {
    it('resolves with default accountFixture', async () => {
      const client = makeMockStellarClient()
      const info = await client.getAccountInfo(MOCK_STELLAR_ADDRESS)
      expect(info.publicKey).toBe(MOCK_STELLAR_ADDRESS)
      expect(info.balance).toBe(MOCK_BALANCE)
      expect(info.sequence).toBe(MOCK_SEQUENCE)
    })

    it('resolves with custom accountInfo override', async () => {
      const client = makeMockStellarClient({
        accountInfo: accountFixture({ balance: 9999, publicKey: 'GCUSTOM' }),
      })
      const info = await client.getAccountInfo('GCUSTOM')
      expect(info.balance).toBe(9999)
      expect(info.publicKey).toBe('GCUSTOM')
    })

    it('rejects when accountInfoFails is true', async () => {
      const client = makeMockStellarClient({ accountInfoFails: true })
      await expect(client.getAccountInfo(MOCK_STELLAR_ADDRESS)).rejects.toThrow(
        'Account not found on Stellar network',
      )
    })

    it('records call arguments', async () => {
      const client = makeMockStellarClient()
      await client.getAccountInfo('GTEST')
      expect(client.getAccountInfo).toHaveBeenCalledWith('GTEST')
      expect(client.getAccountInfo).toHaveBeenCalledTimes(1)
    })
  })

  describe('broadcastTransaction', () => {
    it('resolves with default transactionFixture', async () => {
      const client = makeMockStellarClient()
      const result = await client.broadcastTransaction('SIGNED_XDR')
      expect(result.txHash).toBe(MOCK_TX_HASH)
      expect(result.txId).toBe(`id_${MOCK_TX_HASH.slice(0, 8)}`)
    })

    it('resolves with custom broadcastResult override', async () => {
      const custom = transactionFixture({ txHash: 'cafecafe' + '0'.repeat(56) })
      const client = makeMockStellarClient({ broadcastResult: custom })
      const result = await client.broadcastTransaction('XDR')
      expect(result.txHash).toBe(custom.txHash)
    })

    it('rejects when broadcastFails is true', async () => {
      const client = makeMockStellarClient({ broadcastFails: true })
      await expect(client.broadcastTransaction('XDR')).rejects.toThrow(
        'Broadcast failed: op_underfunded',
      )
    })
  })

  describe('pollTransactionStatus', () => {
    it('resolves with confirmed status by default', async () => {
      const client = makeMockStellarClient()
      const status = await client.pollTransactionStatus(MOCK_TX_HASH)
      expect(status.status).toBe('confirmed')
      expect(status.resultCode).toBe('ok')
    })

    it('resolves with custom txStatus override', async () => {
      const client = makeMockStellarClient({
        txStatus: balanceFixture({ status: 'failed', resultCode: 'op_underfunded' }),
      })
      const status = await client.pollTransactionStatus(MOCK_TX_HASH)
      expect(status.status).toBe('failed')
      expect(status.resultCode).toBe('op_underfunded')
    })

    it('resolves with pending status when overridden', async () => {
      const client = makeMockStellarClient({ txStatus: { status: 'pending' } })
      const status = await client.pollTransactionStatus(MOCK_TX_HASH)
      expect(status.status).toBe('pending')
    })

    it('rejects when pollFails is true', async () => {
      const client = makeMockStellarClient({ pollFails: true })
      await expect(client.pollTransactionStatus(MOCK_TX_HASH)).rejects.toThrow(
        'Failed to fetch transaction status',
      )
    })
  })

  describe('fundTestnetAccount', () => {
    it('resolves with txHash and success message by default', async () => {
      const client = makeMockStellarClient()
      const result = await client.fundTestnetAccount(MOCK_STELLAR_ADDRESS)
      expect(result.txHash).toBe(MOCK_TX_HASH)
      expect(result.message).toBe('Account funded successfully')
    })

    it('rejects when fundFails is true', async () => {
      const client = makeMockStellarClient({ fundFails: true })
      await expect(client.fundTestnetAccount(MOCK_STELLAR_ADDRESS)).rejects.toThrow(
        'Friendbot failed',
      )
    })
  })

  describe('getAccountTransactions', () => {
    it('resolves with empty array by default', async () => {
      const client = makeMockStellarClient()
      const txs = await client.getAccountTransactions(MOCK_STELLAR_ADDRESS)
      expect(txs).toEqual([])
    })

    it('resolves with provided transactions', async () => {
      const txs = [
        { hash: MOCK_TX_HASH, created_at: '2025-01-01T00:00:00Z' },
        { hash: 'beef' + '0'.repeat(60), created_at: '2025-01-02T00:00:00Z' },
      ]
      const client = makeMockStellarClient({ accountTransactions: txs })
      const result = await client.getAccountTransactions(MOCK_STELLAR_ADDRESS)
      expect(result).toHaveLength(2)
      expect(result[0].hash).toBe(MOCK_TX_HASH)
    })

    it('rejects when accountTransactionsFails is true', async () => {
      const client = makeMockStellarClient({ accountTransactionsFails: true })
      await expect(client.getAccountTransactions(MOCK_STELLAR_ADDRESS)).rejects.toThrow(
        'Failed to fetch transactions',
      )
    })

    it('can be overridden per-call with mockResolvedValueOnce', async () => {
      const client = makeMockStellarClient()
      const onceResult = [{ hash: 'once', created_at: '2025-06-01T00:00:00Z' }]
      client.getAccountTransactions.mockResolvedValueOnce(onceResult)
      const first = await client.getAccountTransactions(MOCK_STELLAR_ADDRESS)
      const second = await client.getAccountTransactions(MOCK_STELLAR_ADDRESS)
      expect(first).toBe(onceResult)
      expect(second).toEqual([]) // falls back to default
    })
  })
})
