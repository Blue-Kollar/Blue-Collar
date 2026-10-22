/**
 * Shared Stellar network constants — single source of truth.
 *
 * All Stellar URL, network-passphrase, and numeric constants live here so
 * that api, app, mobile, monitoring, and sdk itself all reference identical
 * values.  Previously these were scattered across:
 *
 *   packages/app/src/config/stellar.ts
 *   packages/app/src/lib/transactions.ts
 *   packages/api/src/clients/stellar.client.ts
 *   packages/api/src/services/stellar-rpc.client.ts
 *   packages/sdk/src/horizon.client.ts
 *   packages/sdk/src/registry.client.ts
 *   packages/monitoring/src/index.ts
 *   packages/test-utils/src/contract-fixtures.ts
 *
 * Consolidation: issue #1295
 */

// ─── Network identifiers ──────────────────────────────────────────────────────

/** Canonical network name string used internally (upper-cased). */
export type StellarNetworkName = 'testnet' | 'mainnet';

// ─── Network passphrases ──────────────────────────────────────────────────────

/**
 * Official Stellar testnet network passphrase.
 * Used when building and verifying signed transactions on testnet.
 */
export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015' as const;

/**
 * Official Stellar mainnet network passphrase.
 * Used when building and verifying signed transactions on mainnet.
 */
export const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015' as const;

/** Map from network name to its passphrase for programmatic lookup. */
export const NETWORK_PASSPHRASES: Record<StellarNetworkName, string> = {
  testnet: TESTNET_PASSPHRASE,
  mainnet: MAINNET_PASSPHRASE,
} as const;

// ─── Horizon REST API URLs ────────────────────────────────────────────────────

/** Stellar Horizon REST API URL for testnet. */
export const TESTNET_HORIZON_URL = 'https://horizon-testnet.stellar.org' as const;

/** Stellar Horizon REST API URL for mainnet. */
export const MAINNET_HORIZON_URL = 'https://horizon.stellar.org' as const;

/** Map from network name to Horizon URL for programmatic lookup. */
export const HORIZON_URLS: Record<StellarNetworkName, string> = {
  testnet: TESTNET_HORIZON_URL,
  mainnet: MAINNET_HORIZON_URL,
} as const;

// ─── Soroban JSON-RPC URLs ────────────────────────────────────────────────────

/** Soroban JSON-RPC endpoint URL for testnet. */
export const TESTNET_SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org' as const;

/** Soroban JSON-RPC endpoint URL for mainnet. */
export const MAINNET_SOROBAN_RPC_URL = 'https://soroban-mainnet.stellar.org' as const;

/** Map from network name to Soroban RPC URL for programmatic lookup. */
export const SOROBAN_RPC_URLS: Record<StellarNetworkName, string> = {
  testnet: TESTNET_SOROBAN_RPC_URL,
  mainnet: MAINNET_SOROBAN_RPC_URL,
} as const;

// ─── Friendbot ────────────────────────────────────────────────────────────────

/**
 * Stellar Friendbot funding endpoint (testnet only).
 * Used to fund newly-created accounts during testing.
 */
export const TESTNET_FRIENDBOT_URL = 'https://friendbot-testnet.stellar.org/bump_sequence' as const;

// ─── Explorer URLs ────────────────────────────────────────────────────────────

/** stellar.expert explorer transaction base URL for testnet. */
export const TESTNET_EXPLORER_TX_BASE = 'https://stellar.expert/explorer/testnet/tx' as const;

/** stellar.expert explorer transaction base URL for mainnet. */
export const MAINNET_EXPLORER_TX_BASE = 'https://stellar.expert/explorer/public/tx' as const;

/** stellar.expert explorer contract base URL for testnet. */
export const TESTNET_EXPLORER_CONTRACT_BASE =
  'https://stellar.expert/explorer/testnet/contract' as const;

/** stellar.expert explorer contract base URL for mainnet. */
export const MAINNET_EXPLORER_CONTRACT_BASE =
  'https://stellar.expert/explorer/public/contract' as const;

// ─── Numeric / precision constants ───────────────────────────────────────────

/**
 * Number of stroops per one XLM (1 XLM = 10,000,000 stroops).
 * Stellar represents all amounts as integer stroops internally.
 */
export const STROOPS_PER_XLM = 10_000_000n;

/**
 * Maximum number of decimal places supported by Stellar (7).
 * Used when validating user-supplied XLM amounts.
 */
export const XLM_DECIMAL_PLACES = 7;

/**
 * Minimum non-dust XLM amount: 0.0000001 XLM (1 stroop).
 */
export const MIN_XLM_AMOUNT = 0.0000001;

/**
 * Default Horizon transaction fee in stroops (100 = 0.00001 XLM).
 * Applies when no explicit fee is specified.
 */
export const BASE_FEE_STROOPS = 100;

/**
 * Full network configuration record keyed by network name.
 * Convenient for components that need all network properties at once.
 */
export const STELLAR_NETWORKS = {
  testnet: {
    passphrase: TESTNET_PASSPHRASE,
    horizonUrl: TESTNET_HORIZON_URL,
    sorobanRpcUrl: TESTNET_SOROBAN_RPC_URL,
    friendbotUrl: TESTNET_FRIENDBOT_URL,
    explorerTxBase: TESTNET_EXPLORER_TX_BASE,
    explorerContractBase: TESTNET_EXPLORER_CONTRACT_BASE,
  },
  mainnet: {
    passphrase: MAINNET_PASSPHRASE,
    horizonUrl: MAINNET_HORIZON_URL,
    sorobanRpcUrl: MAINNET_SOROBAN_RPC_URL,
    friendbotUrl: null, // Friendbot does not exist on mainnet
    explorerTxBase: MAINNET_EXPLORER_TX_BASE,
    explorerContractBase: MAINNET_EXPLORER_CONTRACT_BASE,
  },
} as const satisfies Record<
  StellarNetworkName,
  {
    passphrase: string;
    horizonUrl: string;
    sorobanRpcUrl: string;
    friendbotUrl: string | null;
    explorerTxBase: string;
    explorerContractBase: string;
  }
>;

export type StellarNetworkConfig = (typeof STELLAR_NETWORKS)[StellarNetworkName];
