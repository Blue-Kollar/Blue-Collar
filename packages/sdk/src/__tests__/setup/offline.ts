/**
 * Vitest setup: block real network access for every SDK test file.
 *
 * Any call to `fetch` that is not explicitly faked fails loudly with the
 * requested URL, so a test that accidentally reaches Horizon or RPC is caught
 * instead of silently depending on the network.
 */
import { beforeEach } from 'vitest';

beforeEach(() => {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    throw new Error(`Unfaked network call in SDK test: ${String(input)}`);
  }) as typeof fetch;
});
