/**
 * StellarClient encapsulates all Stellar Horizon network operations.
 * This layer is responsible solely for:
 * - Communicating with the Stellar Horizon API
 * - Serializing request data
 * - Deserializing response data
 * - Mapping HTTP errors to application errors
 */

import { AppError, ErrorCode } from '../utils/AppError.js'

const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'
const FRIENDBOT_URL = 'https://friendbot-testnet.stellar.org/bump_sequence'

/**
 * Maps an upstream Horizon/friendbot HTTP status to an application ErrorCode
 */
function upstreamErrorCode(status: number): ErrorCode {
  if (status === 404) return ErrorCode.NOT_FOUND
  if (status >= 500) return ErrorCode.SERVICE_UNAVAILABLE
  return ErrorCode.VALIDATION_ERROR
}

/**
 * StellarClient for all Horizon network operations.
 */
export class StellarClient {
  private horizonUrl: string
  private friendbotUrl: string

  constructor(horizonUrl = HORIZON_URL, friendbotUrl = FRIENDBOT_URL) {
    this.horizonUrl = horizonUrl
    this.friendbotUrl = friendbotUrl
  }

  /**
   * Fetch account balance and sequence from Horizon.
   */
  async getAccountInfo(publicKey: string) {
    const response = await fetch(`${this.horizonUrl}/accounts/${publicKey}`)

    if (response.status === 404) {
      throw new AppError('Account not found on Stellar network', 404, true, ErrorCode.NOT_FOUND)
    }

    if (!response.ok) {
      throw new AppError(
        `Stellar network error: ${response.statusText}`,
        response.status,
        true,
        upstreamErrorCode(response.status),
      )
    }

    const data = (await response.json()) as {
      balances: Array<{ balance: string; asset_type: string }>
      sequence: string
    }

    const nativeBalance = data.balances.find((b) => b.asset_type === 'native')
    const balance = nativeBalance ? parseFloat(nativeBalance.balance) : 0

    return {
      publicKey,
      balance,
      sequence: BigInt(data.sequence),
    }
  }

  /**
   * Submit a signed XDR transaction to Stellar network.
   */
  async broadcastTransaction(signedXdr: string) {
    const response = await fetch(`${this.horizonUrl}/transactions`, {
      method: 'POST',
      body: new URLSearchParams({ tx: signedXdr }),
    })

    if (!response.ok) {
      const error = (await response.json()) as { title?: string; detail?: string }
      throw new AppError(
        `Broadcast failed: ${error.detail || error.title}`,
        response.status,
        true,
        upstreamErrorCode(response.status),
      )
    }

    const result = (await response.json()) as { hash: string; id: string }
    return { txHash: result.hash, txId: result.id }
  }

  /**
   * Poll transaction status from Horizon.
   */
  async pollTransactionStatus(txHash: string) {
    const response = await fetch(`${this.horizonUrl}/transactions/${txHash}`)

    if (response.status === 404) {
      return { status: 'pending' }
    }

    if (!response.ok) {
      throw new AppError(
        'Failed to fetch transaction status',
        response.status,
        true,
        upstreamErrorCode(response.status),
      )
    }

    const tx = (await response.json()) as { successful: boolean; result_code: string }

    return {
      status: tx.successful ? 'confirmed' : 'failed',
      resultCode: tx.result_code,
    }
  }

  /**
   * Fund testnet account via friendbot.
   */
  async fundTestnetAccount(publicKey: string) {
    const response = await fetch(this.friendbotUrl, {
      method: 'POST',
      body: JSON.stringify({ account: publicKey }),
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const error = (await response.json()) as { error?: string }
      throw new AppError(
        `Friendbot failed: ${error.error || response.statusText}`,
        response.status,
        true,
        upstreamErrorCode(response.status),
      )
    }

    const result = (await response.json()) as { hash: string }
    return { txHash: result.hash, message: 'Account funded successfully' }
  }

  /**
   * Get transaction history for a Stellar account from Horizon.
   */
  async getAccountTransactions(
    publicKey: string,
    limit = 50,
    order: 'asc' | 'desc' = 'desc',
  ) {
    const response = await fetch(
      `${this.horizonUrl}/accounts/${publicKey}/transactions?limit=${limit}&order=${order}`,
    )

    if (!response.ok) {
      throw new AppError(
        'Failed to fetch transactions',
        response.status,
        true,
        upstreamErrorCode(response.status),
      )
    }

    const data = (await response.json()) as {
      _embedded: { records: Array<{ hash: string; created_at: string }> }
    }

    return data._embedded.records
  }
}

// Default instance
export const stellarClient = new StellarClient()
