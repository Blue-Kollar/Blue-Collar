/**
 * @bluecollar/sdk
 * Single source of truth for Stellar / contract interaction.
 * Consumed by both packages/api and packages/app.
 *
 * @remarks
 * The SDK is split into two clients:
 * - {@link HorizonClient} — read/write access to Stellar Horizon (accounts, transactions, payments).
 * - {@link RegistryClient} — read access to the Blue-Collar registry contract via Soroban simulation.
 *
 * Use {@link createSdk} to build a configured pair of clients in one call.
 *
 * @example
 * ```ts
 * import { createSdk } from '@bluecollar/sdk';
 *
 * const sdk = createSdk({ network: 'testnet' });
 * const info = await sdk.horizon.getAccountInfo(publicKey);
 * ```
 *
 * @packageDocumentation
 */

// Core clients
export { HorizonClient, SdkError } from './horizon.client.js';
export { RegistryClient } from './registry.client.js';

// Shared Stellar constants — single source of truth (#1295)
export * from './constants.js';

// Shared Stellar utilities — single source of truth (#1488)
export {
  STROOPS_PER_XLM,
  MAX_DECIMAL_PLACES,
  formatWalletAddress,
  formatXLM,
  isValidStellarAddress,
} from './utils/stellar.js';

// Types
export type * from './types.js';

import { HorizonClient } from './horizon.client.js';
import { RegistryClient } from './registry.client.js';
import type { SdkConfig } from './types.js';
import { HORIZON_URLS } from './constants.js';

/**
 * Create a configured SDK instance.
 *
 * @remarks
 * Call once per process or once per request depending on your runtime
 * (Node.js vs Edge). The returned `registry` client is `null` when no
 * `registryContractId` is supplied, so contract calls must be guarded.
 *
 * @param config - SDK configuration. `network` is required; all other
 *   {@link SdkConfig} fields are optional. When `horizonUrl` is omitted the
 *   default Horizon URL for the chosen network is used.
 * @returns An object containing the {@link HorizonClient}, an optional
 *   {@link RegistryClient}, and the fully-resolved config (including `horizonUrl`).
 *
 * @example
 * ```ts
 * // Read-only usage against testnet
 * const sdk = createSdk({ network: 'testnet' });
 * const account = await sdk.horizon.getAccountInfo(publicKey);
 * ```
 *
 * @example
 * ```ts
 * // With a registry contract for Soroban reads
 * const sdk = createSdk({
 *   network: 'testnet',
 *   registryContractId: 'C...',
 * });
 * const entry = await sdk.registry?.simulateInvoke('get_entry', [address]);
 * ```
 */
export function createSdk(config: Partial<SdkConfig> & Pick<SdkConfig, 'network'>) {
  const horizonUrl = config.horizonUrl ?? HORIZON_URLS[config.network];

  const horizon = new HorizonClient({ horizonUrl });

  const registry = config.registryContractId
    ? new RegistryClient({
        registryContractId: config.registryContractId,
        network: config.network,
      })
    : null;

  return { horizon, registry, config: { ...config, horizonUrl } };
}

/**
 * The configured SDK instance returned by {@link createSdk}.
 *
 * @example
 * ```ts
 * function useSdk(sdk: BlueCollarSdk) {
 *   return sdk.horizon.getAccountInfo(publicKey);
 * }
 * ```
 */
export type BlueCollarSdk = ReturnType<typeof createSdk>;