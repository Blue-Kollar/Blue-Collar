/**
 * HorizonClient — typed wrapper around Stellar Horizon REST API.
 * Consumed by both the API (packages/api) and App (packages/app).
 */

import type { AccountInfo, BroadcastResult, TxStatus, SdkConfig } from './types.js';
import { TESTNET_FRIENDBOT_URL } from './constants.js';

export class HorizonClient {
  private readonly baseUrl: string;

  constructor(config: Pick<SdkConfig, 'horizonUrl'>) {
    this.baseUrl = config.horizonUrl;
  }

  /** Fetch account balance and sequence number from Horizon. */
  async getAccountInfo(publicKey: string): Promise<AccountInfo> {
    const res = await fetch(`${this.baseUrl}/accounts/${publicKey}`);

    if (res.status === 404) throw new SdkError('Account not found on Stellar network', 404);
    if (!res.ok) throw new SdkError(`Horizon error: ${res.statusText}`, res.status);

    const data = (await res.json()) as {
      balances: Array<{ balance: string; asset_type: string }>;
      sequence: string;
    };

    const native = data.balances.find((b) => b.asset_type === 'native');
    return {
      publicKey,
      balance: native ? parseFloat(native.balance) : 0,
      sequence: BigInt(data.sequence),
    };
  }

  /** Submit a signed XDR transaction envelope to Stellar. */
  async broadcastTransaction(signedXdr: string): Promise<BroadcastResult> {
    const res = await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      body: new URLSearchParams({ tx: signedXdr }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { title?: string; detail?: string };
      throw new SdkError(`Broadcast failed: ${err.detail ?? err.title}`, res.status);
    }

    const result = (await res.json()) as { hash: string; id: string };
    return { txHash: result.hash, txId: result.id };
  }

  /** Poll transaction confirmation status. */
  async getTransactionStatus(txHash: string): Promise<TxStatus> {
    const res = await fetch(`${this.baseUrl}/transactions/${txHash}`);
    if (res.status === 404) return { status: 'pending' };
    if (!res.ok) throw new SdkError('Failed to fetch transaction status', res.status);

    const tx = (await res.json()) as { successful: boolean; result_code: string };
    return { status: tx.successful ? 'confirmed' : 'failed', resultCode: tx.result_code };
  }

  /** Retrieve transaction history for an account. */
  async getAccountTransactions(publicKey: string, limit = 50, order: 'asc' | 'desc' = 'desc') {
    const url = `${this.baseUrl}/accounts/${publicKey}/transactions?limit=${limit}&order=${order}`;
    const res = await fetch(url);
    if (!res.ok) throw new SdkError('Failed to fetch transactions', res.status);

    const data = (await res.json()) as {
      _embedded: { records: Array<{ hash: string; created_at: string }> };
    };
    return data._embedded.records;
  }

  /** Fund a testnet account via Stellar Friendbot. Only works on testnet. */
  async fundTestnetAccount(publicKey: string) {
    const res = await fetch(TESTNET_FRIENDBOT_URL, {
      method: 'POST',
      body: JSON.stringify({ account: publicKey }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new SdkError(`Friendbot failed: ${err.error ?? res.statusText}`, res.status);
    }
    const result = (await res.json()) as { hash: string };
    return { txHash: result.hash };
  }

  /**
   * Build unsigned transaction parameters for a tip/payment.
   * The client signs and broadcasts via broadcastTransaction().
   */
  async buildUnsignedPaymentTx(
    sourcePublicKey: string,
    destinationPublicKey: string,
    amount: string,
    memo = '',
  ) {
    const account = await this.getAccountInfo(sourcePublicKey);
    const sequence = (account.sequence + BigInt(1)).toString();
    return { sourcePublicKey, destinationPublicKey, amount, memo, sequence };
  }
}

/** Typed SDK error carrying an HTTP status code. */
export class SdkError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'SdkError';
  }
}
