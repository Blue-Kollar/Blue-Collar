/**
 * Formatting helpers for Stellar addresses, amounts and explorer links.
 *
 * These were previously inlined in individual components, which made them
 * impossible to unit-test or reuse.
 *
 * The Stellar SDK is intentionally NOT imported at the top level. It is a
 * heavy dependency, so it is loaded lazily via dynamic `import()` only inside
 * the functions that actually need it. This keeps the SDK in its own chunk and
 * out of the initial bundle (see issue #1791).
 */

export type StellarNetwork = 'testnet' | 'public';

/**
 * Shorten a Stellar address for display, keeping enough of both ends that a
 * user can still verify it against a wallet: `GABCDE…WXYZ`.
 */
export function truncateStellarAddress(address: string, lead = 6, tail = 4): string {
  if (!address) return '';
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
export function stellarExplorerTxUrl(hash: string, network: StellarNetwork = 'testnet'): string {
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

/**
 * Lazily load the Stellar SDK. The dynamic import keeps the SDK in a separate
 * chunk so it is only fetched when a caller actually needs it.
 */
export async function loadStellarSdk(): Promise<typeof import('@stellar/stellar-sdk')> {
  return import('@stellar/stellar-sdk');
}

/**
 * Validate a Stellar public key using the lazily-loaded SDK.
 * Returns `false` for empty/invalid input rather than throwing.
 */
export async function isValidStellarAddress(address: string): Promise<boolean> {
  if (!address) return false;
  const { StrKey } = await loadStellarSdk();
  return StrKey.isValidEd25519PublicKey(address);
}

/**
 * Build a Horizon server instance for the given network using the
 * lazily-loaded SDK. Callers should only invoke this when they need to talk to
 * Horizon, so the SDK chunk is not pulled in for pure formatting work.
 */
export async function createHorizonServer(
  network: StellarNetwork = 'testnet',
): Promise<import('@stellar/stellar-sdk').Horizon.Server> {
  const { Horizon } = await loadStellarSdk();
  const url =
    network === 'public' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org';
  return new Horizon.Server(url);
}
