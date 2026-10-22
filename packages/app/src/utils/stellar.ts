/**
 * Formatting helpers for Stellar addresses, amounts and explorer links.
 *
 * These were previously inlined in individual components, which made them
 * impossible to unit-test or reuse.
 */

export type StellarNetwork = "testnet" | "public";

/**
 * Shorten a Stellar address for display, keeping enough of both ends that a
 * user can still verify it against a wallet: `GABCDE…WXYZ`.
 */
export function truncateStellarAddress(address: string, lead = 6, tail = 4): string {
  if (!address) return "";
  // Nothing to gain if the ellipsis would make the string longer.
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Format a raw Horizon amount string (e.g. "12.5000000") for display.
 * Falls back to the original string when it isn't a finite number, so bad
 * data from the network shows through instead of rendering "NaN".
 */
export function formatXlmAmount(amount: string, fractionDigits = 2): string {
  const parsed = parseFloat(amount);
  return Number.isFinite(parsed) ? parsed.toFixed(fractionDigits) : amount;
}

/** Build a stellar.expert transaction URL for the given network. */
export function stellarExplorerTxUrl(hash: string, network: StellarNetwork = "testnet"): string {
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}
