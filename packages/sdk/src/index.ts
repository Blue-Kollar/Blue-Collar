/**
 * @bluecollar/sdk
 * Single source of truth for Stellar / contract interaction.
 * Consumed by both packages/api and packages/app.
 *
 * Usage:
 *   import { createSdk } from '@bluecollar/sdk'
 *   const sdk = createSdk({ network: 'testnet' })
 *   const info = await sdk.horizon.getAccountInfo(publicKey)
 */

// Core clients
export { HorizonClient, SdkError } from './horizon.client.js';
export { RegistryClient } from './registry.client.js';

// Shared Stellar constants — single source of truth (#1295)
export * from './constants.js';

// Types
export type * from './types.js';

import { HorizonClient } from './horizon.client.js';
import { RegistryClient } from './registry.client.js';
import type { SdkConfig } from './types.js';
import { HORIZON_URLS } from './constants.js';

/**
 * Create a configured SDK instance. Call once per process or once per request
 * depending on your runtime (Node.js vs Edge).
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

export type BlueCollarSdk = ReturnType<typeof createSdk>;
