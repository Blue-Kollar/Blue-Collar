/**
 * RegistryClient — typed wrapper for calling the BlueCollar Registry Soroban contract.
 * Uses the Horizon client for transaction submission.
 */

import type { SdkConfig } from './types.js';
import { SdkError } from './horizon.client.js';
import { SOROBAN_RPC_URLS } from './constants.js';

export interface WorkerOnChainData {
  id: string;
  owner: string;
  categoryId: string;
  isActive: boolean;
  reputation: number;
  reviewCount: number;
}

export class RegistryClient {
  private readonly contractId: string;
  private readonly network: SdkConfig['network'];

  constructor(config: Required<Pick<SdkConfig, 'registryContractId' | 'network'>>) {
    this.contractId = config.registryContractId;
    this.network = config.network;
  }

  /**
   * Returns the RPC URL for the configured network.
   */
  private get rpcUrl() {
    return SOROBAN_RPC_URLS[this.network];
  }

  /**
   * Invoke a read-only Soroban contract function (simulateTransaction).
   * For write operations the client must sign and submit via HorizonClient.
   */
  async simulateInvoke(method: string, args: unknown[] = []): Promise<unknown> {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'simulateTransaction',
      params: {
        transaction: this.buildInvocationEnvelope(method, args),
      },
    };

    const res = await fetch(`${this.rpcUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new SdkError(`RPC error: ${res.statusText}`, res.status);
    const data = (await res.json()) as { result?: unknown; error?: { message: string } };
    if (data.error) throw new SdkError(`Contract error: ${data.error.message}`, 400);
    return data.result;
  }

  /**
   * Returns a minimal transaction envelope string for a contract invocation.
   * In production this should use stellar-sdk's TransactionBuilder; this is the
   * minimal shape needed for the RPC simulate call.
   */
  private buildInvocationEnvelope(method: string, _args: unknown[]): string {
    // Placeholder — real XDR is built with stellar-sdk TransactionBuilder.
    // The SDK consumers (API/App) import @stellar/stellar-sdk and assemble XDR.
    return JSON.stringify({ contractId: this.contractId, method });
  }
}
