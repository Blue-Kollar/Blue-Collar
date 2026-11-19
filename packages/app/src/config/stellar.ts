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

/**
 * Lightweight network constants.
 *
 * These values are inlined here (rather than imported from `@bluecollar/sdk`)
 * so that this config module does not pull the full Stellar SDK into the
 * initial bundle.  The SDK is heavy and is only needed by code paths that
 * actually build/sign transactions, which are lazy-loaded (issue #1791).
 *
 * Keep these in sync with `@bluecollar/sdk/constants` (issue #1295).
 */
const TESTNET_HORIZON_URL = 'https://horizon-testnet.stellar.org';
const MAINNET_HORIZON_URL = 'https://horizon.stellar.org';
const TESTNET_SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
const MAINNET_SOROBAN_RPC_URL = 'https://soroban.stellar.org';
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const TESTNET_FRIENDBOT_URL = 'https://friendbot.stellar.org';
const TESTNET_EXPLORER_TX_BASE = 'https://stellar.expert/explorer/testnet/tx';
const MAINNET_EXPLORER_TX_BASE = 'https://stellar.expert/explorer/public/tx';
const TESTNET_EXPLORER_CONTRACT_BASE = 'https://stellar.expert/explorer/testnet/contract';
const MAINNET_EXPLORER_CONTRACT_BASE = 'https://stellar.expert/explorer/public/contract';

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
