/**
 * Stellar network configuration sourced entirely from environment variables.
 *
 * All Stellar/Horizon/Soroban URLs are centralised here so that switching
 * between testnet and mainnet requires only a change to NEXT_PUBLIC_STELLAR_NETWORK
 * in the environment — no source files need to be edited.
 *
 * Closes #1207
 */

export type StellarNetworkName = "TESTNET" | "MAINNET";

/** Resolved network name derived from NEXT_PUBLIC_STELLAR_NETWORK. Defaults to TESTNET. */
export const STELLAR_NETWORK: StellarNetworkName =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() as StellarNetworkName) === "MAINNET"
    ? "MAINNET"
    : "TESTNET";

const isMainnet = STELLAR_NETWORK === "MAINNET";

/** Horizon REST API base URL (no trailing slash). */
export const HORIZON_URL: string =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
  (isMainnet ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org");

/** Soroban JSON-RPC endpoint URL (no trailing slash). */
export const SOROBAN_RPC_URL: string =
  process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL ??
  (isMainnet ? "https://soroban-mainnet.stellar.org" : "https://soroban-testnet.stellar.org");

/** Stellar Friendbot funding URL (testnet only). */
export const FRIENDBOT_URL: string =
  process.env.NEXT_PUBLIC_STELLAR_FRIENDBOT_URL ?? "https://friendbot.stellar.org";

/** Network passphrase used to sign and verify transactions. */
export const NETWORK_PASSPHRASE: string = isMainnet
  ? "Public Global Stellar Network ; September 2015"
  : "Test SDF Network ; September 2015";

/**
 * stellar.expert explorer base URL for transactions.
 * Example: `${EXPLORER_TX_BASE}/abc123`
 */
export const EXPLORER_TX_BASE: string = isMainnet
  ? "https://stellar.expert/explorer/public/tx"
  : "https://stellar.expert/explorer/testnet/tx";

/**
 * stellar.expert explorer base URL for contracts.
 * Example: `${EXPLORER_CONTRACT_BASE}/C...`
 */
export const EXPLORER_CONTRACT_BASE: string = isMainnet
  ? "https://stellar.expert/explorer/public/contract"
  : "https://stellar.expert/explorer/testnet/contract";

/** stellar.expert network slug used in dynamically-constructed URLs. */
export const EXPLORER_NETWORK_SLUG: string = isMainnet ? "public" : "testnet";

/** Whether the app is running against the Stellar testnet. */
export const IS_TESTNET: boolean = !isMainnet;

/** Deployed Soroban Market contract ID (empty string when unconfigured). */
export const MARKET_CONTRACT_ID: string = process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID ?? "";

/** Deployed Soroban Registry contract ID (empty string when unconfigured). */
export const REGISTRY_CONTRACT_ID: string = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? "";
