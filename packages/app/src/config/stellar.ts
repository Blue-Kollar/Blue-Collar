/**
 * Stellar network configuration sourced from environment variables.
 *
 * Canonical URL/passphrase constants are imported from @bluecollar/sdk/constants
 * (issue #1295) so there is a single source of truth.  This module resolves
 * which network to use at runtime and re-exports the appropriate values so
 * that all app code can keep importing from "@/config/stellar" unchanged.
 *
 * Switching between testnet and mainnet requires only changing
 * NEXT_PUBLIC_STELLAR_NETWORK in the environment — no source files need editing.
 *
 * Closes #1207, updated for #1295.
 */

import {
  TESTNET_HORIZON_URL,
  MAINNET_HORIZON_URL,
  TESTNET_SOROBAN_RPC_URL,
  MAINNET_SOROBAN_RPC_URL,
  TESTNET_PASSPHRASE,
  MAINNET_PASSPHRASE,
  TESTNET_FRIENDBOT_URL,
  TESTNET_EXPLORER_TX_BASE,
  MAINNET_EXPLORER_TX_BASE,
  TESTNET_EXPLORER_CONTRACT_BASE,
  MAINNET_EXPLORER_CONTRACT_BASE,
} from '@bluecollar/sdk';

export type StellarNetworkName = 'TESTNET' | 'MAINNET';

/** Resolved network name derived from NEXT_PUBLIC_STELLAR_NETWORK. Defaults to TESTNET. */
export const STELLAR_NETWORK: StellarNetworkName =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() as StellarNetworkName) === 'MAINNET'
    ? 'MAINNET'
    : 'TESTNET';

const isMainnet = STELLAR_NETWORK === 'MAINNET';

/** Horizon REST API base URL (no trailing slash). */
export const HORIZON_URL: string =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
  (isMainnet ? MAINNET_HORIZON_URL : TESTNET_HORIZON_URL);

/** Soroban JSON-RPC endpoint URL (no trailing slash). */
export const SOROBAN_RPC_URL: string =
  process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL ??
  (isMainnet ? MAINNET_SOROBAN_RPC_URL : TESTNET_SOROBAN_RPC_URL);

/** Stellar Friendbot funding URL (testnet only). */
export const FRIENDBOT_URL: string =
  process.env.NEXT_PUBLIC_STELLAR_FRIENDBOT_URL ?? TESTNET_FRIENDBOT_URL;

/** Network passphrase used to sign and verify transactions. */
export const NETWORK_PASSPHRASE: string = isMainnet ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;

/**
 * stellar.expert explorer base URL for transactions.
 * Example: `${EXPLORER_TX_BASE}/abc123`
 */
export const EXPLORER_TX_BASE: string = isMainnet
  ? MAINNET_EXPLORER_TX_BASE
  : TESTNET_EXPLORER_TX_BASE;

/**
 * stellar.expert explorer base URL for contracts.
 * Example: `${EXPLORER_CONTRACT_BASE}/C...`
 */
export const EXPLORER_CONTRACT_BASE: string = isMainnet
  ? MAINNET_EXPLORER_CONTRACT_BASE
  : TESTNET_EXPLORER_CONTRACT_BASE;

/** stellar.expert network slug used in dynamically-constructed URLs. */
export const EXPLORER_NETWORK_SLUG: string = isMainnet ? 'public' : 'testnet';

/** Whether the app is running against the Stellar testnet. */
export const IS_TESTNET: boolean = !isMainnet;

/** Deployed Soroban Market contract ID (empty string when unconfigured). */
export const MARKET_CONTRACT_ID: string = process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID ?? '';

/** Deployed Soroban Registry contract ID (empty string when unconfigured). */
export const REGISTRY_CONTRACT_ID: string = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? '';
