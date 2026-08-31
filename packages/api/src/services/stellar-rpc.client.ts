import { AppError, ErrorCode } from '../utils/AppError.js'
import { logger } from '../config/logger.js'

const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'
const FRIENDBOT_URL = 'https://friendbot-testnet.stellar.org/bump_sequence'

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 8000

/**
 * Maps an upstream Horizon/friendbot HTTP status to an application ErrorCode
 */
function upstreamErrorCode(status: number): ErrorCode {
  if (status === 404) return ErrorCode.NOT_FOUND
  if (status >= 500) return ErrorCode.SERVICE_UNAVAILABLE
  return ErrorCode.VALIDATION_ERROR
}

/**
 * Exponential backoff with jitter for retries
 */
function getBackoffDelay(attempt: number): number {
  const exponential = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS)
  const jitter = Math.random() * 0.1 * exponential
  return exponential + jitter
}

/**
 * Determines if an error is retryable (5xx or network error)
 */
function isRetryableError(status?: number): boolean {
  if (!status) return true // Network error
  return status >= 500
}

export class StellarRpcClient {
  private horizonUrl: string
  private friendbotUrl: string

  constructor(horizonUrl: string = HORIZON_URL, friendbotUrl: string = FRIENDBOT_URL) {
    this.horizonUrl = horizonUrl
    this.friendbotUrl = friendbotUrl
  }

  /**
   * Fetch account info (balance, sequence) from Horizon with retry logic
   */
  async getAccountInfo(publicKey: string) {
    const makeRequest = async () => {
      const response = await fetch(`${this.horizonUrl}/accounts/${publicKey}`, {
        signal: AbortSignal.timeout(10_000),
      })

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

    return this.retryWithBackoff(makeRequest, `getAccountInfo for ${publicKey}`)
  }

  /**
   * Submit a signed XDR transaction to Stellar network
   */
  async broadcastTransaction(signedXdr: string) {
    const makeRequest = async () => {
      const response = await fetch(`${this.horizonUrl}/transactions`, {
        method: 'POST',
        body: new URLSearchParams({ tx: signedXdr }),
        signal: AbortSignal.timeout(10_000),
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

    return this.retryWithBackoff(makeRequest, 'broadcastTransaction')
  }

  /**
   * Poll transaction status from Horizon
   */
  async pollTransactionStatus(txHash: string) {
    const makeRequest = async () => {
      const response = await fetch(`${this.horizonUrl}/transactions/${txHash}`, {
        signal: AbortSignal.timeout(10_000),
      })

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

    return this.retryWithBackoff(makeRequest, `pollTransactionStatus for ${txHash}`)
  }

  /**
   * Fund testnet account via friendbot
   */
  async fundTestnetAccount(publicKey: string) {
    const makeRequest = async () => {
      const response = await fetch(this.friendbotUrl, {
        method: 'POST',
        body: JSON.stringify({ account: publicKey }),
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
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

    return this.retryWithBackoff(makeRequest, `fundTestnetAccount for ${publicKey}`)
  }

  /**
   * Get transaction history for a Stellar account from Horizon
   */
  async getAccountTransactions(
    publicKey: string,
    limit = 50,
    order: 'asc' | 'desc' = 'desc',
  ) {
    const makeRequest = async () => {
      const response = await fetch(
        `${this.horizonUrl}/accounts/${publicKey}/transactions?limit=${limit}&order=${order}`,
        {
          signal: AbortSignal.timeout(10_000),
        },
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

    return this.retryWithBackoff(makeRequest, `getAccountTransactions for ${publicKey}`)
  }

  /**
   * Fetch contract events from Horizon
   */
  async getContractEvents(contractId: string, startLedger?: number) {
    const makeRequest = async () => {
      const url = new URL(`${this.horizonUrl}/contracts/${contractId}/events`)
      url.searchParams.set('order', 'asc')
      url.searchParams.set('limit', '100')

      if (startLedger && startLedger > 0) {
        url.searchParams.set('start_ledger', startLedger.toString())
      }

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10_000),
      })

      if (!res.ok) {
        throw new AppError(
          `Failed to fetch contract events: ${res.statusText}`,
          res.status,
          true,
          upstreamErrorCode(res.status),
        )
      }

      const json = (await res.json()) as {
        _embedded?: {
          records: Array<{
            id: string
            type: string
            contract_id: string
            topic: string[]
            value: unknown
            paging_token: string
            ledger_close_time: string
          }>
        }
      }

      return json._embedded?.records ?? []
    }

    return this.retryWithBackoff(makeRequest, `getContractEvents for ${contractId}`)
  }

  /**
   * Retry a request with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn()
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        const shouldRetry =
          err instanceof AppError &&
          isRetryableError(err.statusCode) &&
          attempt < MAX_RETRIES - 1

        if (!shouldRetry) {
          throw err
        }

        const delayMs = getBackoffDelay(attempt)
        logger.warn(
          {
            operation: operationName,
            attempt: attempt + 1,
            delayMs,
            error: lastError.message,
          },
          'Retrying Stellar RPC call',
        )

        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    throw lastError || new Error(`Failed to execute ${operationName} after ${MAX_RETRIES} attempts`)
  }
}

// Default singleton instance
export const stellarRpcClient = new StellarRpcClient()
