/**
 * stellar.ts — canonical Stellar-domain utility functions.
 *
 * These were originally duplicated in packages/app/src/lib/utils.ts and
 * packages/app/src/lib/transactions.ts. Moved here so both app and any
 * future consumer (mobile, CLI) share a single implementation.
 */

/** Stroops per XLM — Stellar's smallest unit. */
export const STROOPS_PER_XLM = 10_000_000n;

/** Maximum decimal precision for XLM amounts. */
export const MAX_DECIMAL_PLACES = 7;

/**
 * Shorten a Stellar address for display: `GABCD...WXYZ`.
 * Returns the input unchanged if it is already short enough.
 */
export function formatWalletAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * Format a stroop amount (smallest unit) as a human-readable XLM string.
 * Uses en-US grouping; callers that need locale-specific output should
 * layer their own formatting on top.
 */
export function formatXLM(stroops: number | bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: MAX_DECIMAL_PLACES,
  })} XLM`;
}

/**
 * Structural check for a Stellar ed25519 public key (G…) or a Soroban
 * contract id (C…). Does not import the Stellar SDK to stay tree-shakeable
 * for consumers that only need string validation.
 */
export function isValidStellarAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.length !== 56) return false;
  if (!address.startsWith('G') && !address.startsWith('C')) return false;
  return /^[A-Z2-7]+$/.test(address);
}
