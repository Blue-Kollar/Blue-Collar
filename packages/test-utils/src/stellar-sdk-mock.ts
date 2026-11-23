/**
 * Enhanced Mock Stellar SDK test utility
 * Provides comprehensive mocking for Stellar SDK operations including:
 * - Horizon API client simulation
 * - Soroban RPC client simulation
 * - Transaction signing and submission
 * - Account operations
 * - Contract invocations
 *
 * Issue #1857: Mock Stellar SDK test utility
 */

import { MOCK_STELLAR_ADDRESS, MOCK_TX_HASH } from './stellar-mocks.js'

/**
 * Mock account fixture with common test values
 */
export const mockAccountFixture = () => ({
  id: MOCK_STELLAR_ADDRESS,
  sequence: '100',
  balances: [
    {
      balance: '1000.0000000',
      buying_liabilities: '0.0000000',
      selling_liabilities: '0.0000000',
      asset_type: 'native',
    },
  ],
  flags: {
    auth_required: false,
    auth_revocable: false,
    auth_immutable: false,
  },
  signers: [
    {
      weight: 1,
      key: MOCK_STELLAR_ADDRESS,
      type: 'ed25519_public_key',
    },
  ],
  data: {},
  id_ledger: 12345,
  paging_token: '12345-0',
  last_modified_ledger: 12345,
  last_modified_time: new Date().toISOString(),
  subentry_count: 0,
})

/**
 * Mock transaction fixture
 */
export const mockTransactionFixture = () => ({
  id: MOCK_TX_HASH,
  paging_token: '51623103489-0',
  hash: MOCK_TX_HASH,
  ledger: 12345,
  created_at: new Date().toISOString(),
  source_account: MOCK_STELLAR_ADDRESS,
  source_account_sequence: '100',
  fee_charged: '100',
  max_fee: '100',
  operation_count: 1,
  transaction_successful: true,
  envelope_xdr: 'AAAAAgAAAABLJXzRPWCaAJ4t5C1XqXcLOa6vrvYk1VmWjJSJzF8bAAABhADpGBYAAAD5AAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAMm/2ASABQAAAAAAAAAP7w8AA'
})

/**
 * Mock Stellar Server implementation for testing
 */
export class MockStellarServer {
  private accountResponses: Map<string, object> = new Map()
  private transactionResponses: Map<string, object> = new Map()
  private failureMode: 'success' | 'not_found' | 'server_error' | 'network_error' = 'success'

  /**
   * Set up account response
   */
  setAccountResponse(publicKey: string, accountData: object) {
    this.accountResponses.set(publicKey, accountData)
  }

  /**
   * Get account info (simulates Horizon /accounts/:id endpoint)
   */
  async getAccount(publicKey: string) {
    if (this.failureMode === 'not_found') {
      throw new Error(`Account not found: ${publicKey}`)
    }
    if (this.failureMode === 'server_error') {
      throw new Error('Server error')
    }
    if (this.failureMode === 'network_error') {
      throw new Error('Network error')
    }

    const account = this.accountResponses.get(publicKey)
    if (!account) {
      // Return default account
      return mockAccountFixture()
    }
    return account
  }

  /**
   * Submit transaction (simulates Horizon POST /transactions endpoint)
   */
  async submitTransaction(transaction: string) {
    if (this.failureMode === 'server_error') {
      throw new Error('Server error')
    }
    if (this.failureMode === 'network_error') {
      throw new Error('Network error')
    }

    return {
      hash: MOCK_TX_HASH,
      result_xdr: 'AAAAAAAAAGQAAAAAAAAAAA==',
      result_meta_xdr: 'AAAAAgAAAAIAAAADACYaAQAAAAA=',
    }
  }

  /**
   * Get transaction (simulates Horizon GET /transactions/:hash endpoint)
   */
  async getTransaction(hash: string) {
    if (this.failureMode === 'not_found') {
      throw new Error(`Transaction not found: ${hash}`)
    }
    if (this.failureMode === 'server_error') {
      throw new Error('Server error')
    }

    return mockTransactionFixture()
  }

  /**
   * Get account transactions (simulates Horizon GET /accounts/:id/transactions endpoint)
   */
  async getAccountTransactions(publicKey: string, options?: { limit?: number; cursor?: string; order?: 'asc' | 'desc' }) {
    if (this.failureMode === 'server_error') {
      throw new Error('Server error')
    }

    return {
      _links: {
        self: { href: `https://horizon.stellar.org/accounts/${publicKey}/transactions` },
        next: { href: '' },
        prev: { href: '' },
      },
      _embedded: {
        records: [mockTransactionFixture()],
      },
    }
  }

  /**
   * Set failure mode for testing error scenarios
   */
  setFailureMode(mode: 'success' | 'not_found' | 'server_error' | 'network_error') {
    this.failureMode = mode
  }

  /**
   * Reset mock state
   */
  reset() {
    this.accountResponses.clear()
    this.transactionResponses.clear()
    this.failureMode = 'success'
  }
}

/**
 * Mock Soroban RPC Server for contract testing
 */
export class MockSorobanRpcServer {
  private simulationResponses: Map<string, object> = new Map()
  private failureMode: 'success' | 'not_found' | 'server_error' | 'network_error' = 'success'

  /**
   * Simulate transaction (simulates /simulateTransaction endpoint)
   */
  async simulateTransaction(transactionXdr: string) {
    if (this.failureMode === 'server_error') {
      throw new Error('Server error')
    }

    return {
      transactionData: 'AAAADgAAAAH...',
      events: [],
      results: [
        {
          xdr: 'AAAADgAA...',
        },
      ],
      latestLedger: 12345,
      minFeeA: 100,
      minFeeB: 542,
    }
  }

  /**
   * Send transaction (simulates /sendTransaction endpoint)
   */
  async sendTransaction(transactionXdr: string) {
    if (this.failureMode === 'server_error') {
      throw new Error('Server error')
    }

    return {
      id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'PENDING',
      latestLedger: 12345,
    }
  }

  /**
   * Get transaction (simulates /getTransaction endpoint)
   */
  async getTransaction(transactionId: string) {
    if (this.failureMode === 'not_found') {
      throw new Error(`Transaction not found: ${transactionId}`)
    }

    return {
      status: 'SUCCESS',
      latestLedger: 12345,
      ledger: 12340,
      createdAt: Date.now() / 1000,
      startLedger: 12335,
      applicationOrder: 0,
      feeBump: false,
      envelopeXdr: 'AAAAAgAAAAB...',
      resultXdr: 'AAAAAAAAAGQAAAAAAAAAAA==',
      resultMetaXdr: 'AAAAAgAAAAI...',
    }
  }

  /**
   * Get account (simulates /getAccount endpoint)
   */
  async getAccount(accountId: string) {
    if (this.failureMode === 'not_found') {
      throw new Error(`Account not found: ${accountId}`)
    }

    return {
      id: accountId,
      accountId,
      sequenceNumber: '100',
      balances: [
        {
          balance: '1000000000',
          asset: 'native',
        },
      ],
    }
  }

  /**
   * Set failure mode for testing error scenarios
   */
  setFailureMode(mode: 'success' | 'not_found' | 'server_error' | 'network_error') {
    this.failureMode = mode
  }

  /**
   * Reset mock state
   */
  reset() {
    this.simulationResponses.clear()
    this.failureMode = 'success'
  }
}

/**
 * Create a mock Stellar client for testing.
 *
 * Accepts either a `MockStellarServer` (the usage documented when this helper
 * was introduced) or an object of per-method overrides.
 */
export function createMockStellarClient(
  overridesOrServer: {
    getAccountInfo?: (publicKey: string) => Promise<any>
    broadcastTransaction?: (xdr: string) => Promise<any>
    pollTransactionStatus?: (hash: string) => Promise<any>
    getAccountTransactions?: (publicKey: string) => Promise<any>
  } | MockStellarServer = {},
) {
  const horizonServer =
    overridesOrServer instanceof MockStellarServer ? overridesOrServer : new MockStellarServer()
  const sorobanServer = new MockSorobanRpcServer()
  const overrides =
    overridesOrServer instanceof MockStellarServer
      ? {}
      : (overridesOrServer as {
          getAccountInfo?: (publicKey: string) => Promise<any>
          broadcastTransaction?: (xdr: string) => Promise<any>
          pollTransactionStatus?: (hash: string) => Promise<any>
          getAccountTransactions?: (publicKey: string) => Promise<any>
        })

  return {
    horizonServer,
    sorobanServer,
    getAccountInfo: overrides.getAccountInfo || ((publicKey: string) => horizonServer.getAccount(publicKey)),
    broadcastTransaction: overrides.broadcastTransaction || ((xdr: string) => horizonServer.submitTransaction(xdr)),
    pollTransactionStatus: overrides.pollTransactionStatus || ((hash: string) => horizonServer.getTransaction(hash)),
    getAccountTransactions: overrides.getAccountTransactions || ((publicKey: string) => horizonServer.getAccountTransactions(publicKey)),
  }
}
