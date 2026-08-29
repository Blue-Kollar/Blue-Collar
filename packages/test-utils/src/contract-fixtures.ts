/**
 * @bluecollar/test-utils — Contract test fixtures and account helpers
 *
 * Shared helpers for spinning up test accounts, funding them, and generating
 * valid Stellar key-pairs for use across packages/sdk and packages/contracts tests.
 *
 * Issue: #1056 — Add contract-level test fixtures shared across sdk and contracts tests
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import {
 *     makeTestAccount,
 *     makeTestAccountSet,
 *     TESTNET_FRIENDBOT_URL,
 *     buildMockFundedResponse,
 *   } from '@bluecollar/test-utils/contract-fixtures'
 *
 *   // In a test file:
 *   const { admin, curator, worker, payer } = makeTestAccountSet()
 */

import { vi } from 'vitest'

// ─── Constants ─────────────────────────────────────────────────────────────────

export const TESTNET_FRIENDBOT_URL = 'https://friendbot-testnet.stellar.org/bump_sequence'
export const TESTNET_HORIZON_URL = 'https://horizon-testnet.stellar.org'
export const MAINNET_HORIZON_URL = 'https://horizon.stellar.org'

/** Default initial XLM balance for newly funded test accounts (in stroops string form). */
export const DEFAULT_TEST_BALANCE = '10000.0000000'

/** Approximate ledger timestamp offset (seconds) used for escrow expiry helpers. */
export const ONE_DAY_LEDGERS = 86_400

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * A lightweight test account representation.
 * Mirrors the shape returned by Soroban testutils `Address::generate()` but
 * is usable from TypeScript/JavaScript tests without a Rust environment.
 */
export interface TestAccount {
  /** Stellar G-address (public key) */
  publicKey: string
  /** Stellar S-address (secret seed) — only for tests, never use in production */
  secretKey: string
  /** Human-readable label for debugging */
  label: string
  /** Simulated XLM balance (stroops string) */
  balance: string
}

/** A full set of accounts commonly used in contract integration tests. */
export interface TestAccountSet {
  admin: TestAccount
  curator: TestAccount
  worker: TestAccount
  payer: TestAccount
  feeRecipient: TestAccount
}

/** Options for creating a single test account. */
export interface MakeTestAccountOptions {
  label?: string
  balance?: string
  /** Provide a specific public key instead of generating one */
  publicKey?: string
}

// ─── Deterministic test addresses ────────────────────────────────────────────
// These are stable across test runs so snapshots and logged output are predictable.

const DETERMINISTIC_KEYS: Array<[string, string]> = [
  ['GADMIN111111111111111111111111111111111111111111111111ADMIN', 'SADMIN11111111111111111111111111111111111111111111111111'],
  ['GCURATOR11111111111111111111111111111111111111111111CURATOR', 'SCURATOR1111111111111111111111111111111111111111111111111'],
  ['GWORKER11111111111111111111111111111111111111111111WORKER11', 'SWORKER11111111111111111111111111111111111111111111111111'],
  ['GPAYER111111111111111111111111111111111111111111111PAYER111', 'SPAYER111111111111111111111111111111111111111111111111111'],
  ['GFEERECIP1111111111111111111111111111111111111111FEERECIP1', 'SFEERECIP111111111111111111111111111111111111111111111111'],
  ['GOTHER111111111111111111111111111111111111111111111OTHER111', 'SOTHER111111111111111111111111111111111111111111111111111'],
]

let _keyIndex = 0

/** Returns the next deterministic key pair. Resets when exhausted. */
function nextDeterministicKey(): [string, string] {
  const pair = DETERMINISTIC_KEYS[_keyIndex % DETERMINISTIC_KEYS.length]
  _keyIndex++
  return pair
}

/**
 * Reset the deterministic key counter. Call in `beforeEach` to ensure
 * each test starts from the same key sequence.
 *
 * @example
 * ```ts
 * beforeEach(() => resetTestKeyCounter())
 * ```
 */
export function resetTestKeyCounter(): void {
  _keyIndex = 0
}

// ─── Account factories ────────────────────────────────────────────────────────

/**
 * Create a single test account with a deterministic or custom public key.
 *
 * @example
 * ```ts
 * const admin = makeTestAccount({ label: 'admin', balance: '5000.0000000' })
 * ```
 */
export function makeTestAccount(options: MakeTestAccountOptions = {}): TestAccount {
  const { label = 'test-account', balance = DEFAULT_TEST_BALANCE, publicKey } = options
  const [detKey, detSecret] = nextDeterministicKey()

  return {
    publicKey: publicKey ?? detKey,
    secretKey: detSecret,
    label,
    balance,
  }
}

/**
 * Create the full set of accounts needed for typical contract integration tests:
 * admin, curator, worker, payer, and feeRecipient.
 *
 * @example
 * ```ts
 * const accounts = makeTestAccountSet()
 * // accounts.admin.publicKey → 'GADMIN111...'
 * ```
 */
export function makeTestAccountSet(balances?: Partial<Record<keyof TestAccountSet, string>>): TestAccountSet {
  return {
    admin: makeTestAccount({ label: 'admin', balance: balances?.admin ?? DEFAULT_TEST_BALANCE }),
    curator: makeTestAccount({ label: 'curator', balance: balances?.curator ?? DEFAULT_TEST_BALANCE }),
    worker: makeTestAccount({ label: 'worker', balance: balances?.worker ?? '0.0000000' }),
    payer: makeTestAccount({ label: 'payer', balance: balances?.payer ?? DEFAULT_TEST_BALANCE }),
    feeRecipient: makeTestAccount({ label: 'feeRecipient', balance: balances?.feeRecipient ?? '0.0000000' }),
  }
}

// ─── Friendbot / funding helpers ──────────────────────────────────────────────

/**
 * Build the mock `fetch` response body for a successful Friendbot funding call.
 *
 * @example
 * ```ts
 * vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(buildMockFundedResponse('GDUMMY...')))
 * ```
 */
export function buildMockFundedResponse(txHash = 'mock_funding_tx_hash'): Response {
  return new Response(JSON.stringify({ hash: txHash }), { status: 200 })
}

/**
 * Build the mock Horizon account-info response for a funded account.
 *
 * @example
 * ```ts
 * vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(buildMockAccountResponse(account)))
 * ```
 */
export function buildMockAccountResponse(account: TestAccount, sequence = '1000000'): Response {
  return new Response(
    JSON.stringify({
      balances: [{ asset_type: 'native', balance: account.balance }],
      sequence,
    }),
    { status: 200 },
  )
}

/**
 * Returns a `vi.fn()` that mocks `fundTestnetAccount` on `HorizonClient`,
 * recording call arguments for assertion.
 *
 * @example
 * ```ts
 * const fundMock = mockFundTestnetAccount()
 * vi.spyOn(client, 'fundTestnetAccount').mockImplementation(fundMock)
 * await someFunction(client)
 * expect(fundMock).toHaveBeenCalledWith(account.publicKey)
 * ```
 */
export function mockFundTestnetAccount(
  txHash = 'mock_funding_tx_hash',
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({ txHash })
}

// ─── Escrow / contract-call helpers ───────────────────────────────────────────

/**
 * Generate a deterministic escrow ID for testing.
 * Uses a counter so multiple escrows in one test have unique IDs.
 */
let _escrowCounter = 0

export function makeEscrowId(prefix = 'esc'): string {
  return `${prefix}_${String(_escrowCounter++).padStart(3, '0')}`
}

/** Reset the escrow ID counter (call in `beforeEach`). */
export function resetEscrowCounter(): void {
  _escrowCounter = 0
}

/**
 * Compute a ledger expiry timestamp offset (in seconds) from "now".
 * Use this instead of raw `Date.now()` so tests don't depend on wall-clock time.
 *
 * @param offsetSeconds - seconds in the future (default: 24 hours)
 */
export function futureExpiry(offsetSeconds = ONE_DAY_LEDGERS): number {
  return Math.floor(Date.now() / 1000) + offsetSeconds
}

// ─── Worker fixture factory ────────────────────────────────────────────────────

export interface TestWorkerFixture {
  id: string
  ownerAddress: string
  name: string
  category: string
  /** WASM hash placeholder (32 zero bytes, hex-encoded) */
  wasmHash: string
}

const WORKER_CATEGORIES = ['plumber', 'electrician', 'carpenter', 'welder', 'painter'] as const
let _workerCounter = 0

/**
 * Generate a deterministic worker fixture for contract/SDK tests.
 *
 * @example
 * ```ts
 * const worker = makeTestWorkerFixture({ ownerAddress: accounts.worker.publicKey })
 * registry.register(worker.id, worker.ownerAddress, worker.name, worker.category, ...)
 * ```
 */
export function makeTestWorkerFixture(
  overrides: Partial<TestWorkerFixture> = {},
): TestWorkerFixture {
  const idx = _workerCounter++
  const category = WORKER_CATEGORIES[idx % WORKER_CATEGORIES.length]
  return {
    id: `worker_${String(idx).padStart(3, '0')}`,
    ownerAddress: DETERMINISTIC_KEYS[idx % DETERMINISTIC_KEYS.length][0],
    name: `Test Worker ${idx}`,
    category,
    wasmHash: '0'.repeat(64),
    ...overrides,
  }
}

/** Reset worker fixture counter (call in `beforeEach`). */
export function resetWorkerCounter(): void {
  _workerCounter = 0
}

/**
 * Reset all counters at once. Convenient for `beforeEach`.
 *
 * @example
 * ```ts
 * beforeEach(() => resetAllCounters())
 * ```
 */
export function resetAllCounters(): void {
  resetTestKeyCounter()
  resetEscrowCounter()
  resetWorkerCounter()
}
