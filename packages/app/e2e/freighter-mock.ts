/**
 * Deterministic Freighter wallet mock for Playwright E2E tests.
 *
 * Inject into a page before navigating to pages that interact with the wallet:
 *   await injectFreighterMock(page)
 *
 * The mock simulates a connected Stellar testnet wallet with a fixed address,
 * deterministic transaction signing (returns a pre-built XDR), and a fixed
 * network set to TESTNET so wallet-gating logic in the app passes cleanly.
 */

import type { Page } from '@playwright/test'

export const MOCK_WALLET_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'
export const MOCK_NETWORK = 'TESTNET'

export async function injectFreighterMock(page: Page): Promise<void> {
  await page.addInitScript(
    ({ address, network }) => {
      const freighter = {
        isConnected: () => Promise.resolve({ isConnected: true }),
        requestAccess: () => Promise.resolve({ address }),
        getAddress: () => Promise.resolve({ address }),
        getNetwork: () => Promise.resolve({ network, networkPassphrase: 'Test SDF Network ; September 2015' }),
        signTransaction: (_xdr: string, _opts: unknown) =>
          Promise.resolve({ signedTxXdr: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }),
        signBlob: (_blob: string, _opts: unknown) => Promise.resolve({ signedBlob: 'mock-signed-blob' }),
      }
      // Expose as the global Freighter API that @stellar/freighter-api reads from
      ;(window as any).freighterApi = freighter
      // Also override the module-level exports that the app bundles
      ;(window as any).__mockFreighter = freighter
    },
    { address: MOCK_WALLET_ADDRESS, network: MOCK_NETWORK }
  )
}
