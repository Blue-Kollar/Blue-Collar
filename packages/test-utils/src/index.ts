/**
 * @bluecollar/test-utils
 *
 * Shared test utilities across all BlueCollar packages.
 *
 * Sub-path exports:
 *   '@bluecollar/test-utils/factories'           — Data factories
 *   '@bluecollar/test-utils/express'             — Express req/res/next + JWT mocks
 *   '@bluecollar/test-utils/react'               — renderWithProviders (React only)
 *   '@bluecollar/test-utils/contract-fixtures'   — Stellar/contract account fixtures
 *   '@bluecollar/test-utils/stellar-mocks'       — Horizon / Freighter / Soroban mocks
 *   '@bluecollar/test-utils/stellar-sdk-mock'    — MockStellarServer / client helpers
 *   '@bluecollar/test-utils/db-fixtures'         — Prisma-backed DB fixture factories
 *
 * The root entry point re-exports every non-React helper so you can import
 * several things from one place:
 *
 *   import { userFactory, makeRequest, makeResponse } from '@bluecollar/test-utils'
 *
 * React helpers are deliberately excluded from the root so non-React packages
 * do not have to resolve React to import this barrel. Import them from the
 * '/react' sub-path instead.
 *
 * Exports are listed explicitly (rather than using `export *`) so ambiguous
 * re-exports cannot silently appear when a module grows a new symbol.
 */

export {
  type FakeAuthUser,
  type FakeCategory,
  type FakeReview,
  type FakeUser,
  type FakeWorker,
  authUserFactory,
  categoryFactory,
  reviewFactory,
  stellarAddressFactory,
  userFactory,
  workerFactory,
} from './factories/index.js'

export {
  type MockRequest,
  type MockResponse,
  type MockUser,
  makeExpiredJwt,
  makeJwt,
  makeNext,
  makeRequest,
  makeResponse,
} from './express/index.js'

export {
  type AccountInfoFixture,
  type BalanceFixture,
  type MockFreighterOptions,
  type MockHorizonOptions,
  type MockSorobanRpcOptions,
  type MockStellarClientOptions,
  type TransactionFixture,
  MOCK_BALANCE,
  MOCK_FEE_RECIPIENT_ADDRESS,
  MOCK_SEQUENCE,
  MOCK_STELLAR_ADDRESS,
  MOCK_TX_HASH,
  MOCK_WORKER_ADDRESS,
  accountFixture,
  balanceFixture,
  makeFreighterMock,
  makeMockHorizonFetch,
  makeMockStellarClient,
  makeSorobanRpcMock,
  transactionFixture,
} from './stellar-mocks.js'

export {
  MockSorobanRpcServer,
  MockStellarServer,
  createMockStellarClient,
  mockAccountFixture,
  mockTransactionFixture,
} from './stellar-sdk-mock.js'

export {
  type AccountStateOptions,
  type AccountStates,
  type MakeTestAccountOptions,
  type TestAccount,
  type TestAccountSet,
  type TestWorkerFixture,
  DEFAULT_TEST_BALANCE,
  MAINNET_HORIZON_URL,
  ONE_DAY_LEDGERS,
  TESTNET_FRIENDBOT_URL,
  TESTNET_HORIZON_URL,
  authorizedAccount,
  buildMockAccountResponse,
  buildMockFundedResponse,
  freshAccount,
  fundedAccount,
  futureExpiry,
  makeAccountStates,
  makeEscrowId,
  makeSenderRecipient,
  makeTestAccount,
  makeTestAccountSet,
  makeTestWorkerFixture,
  mockFundTestnetAccount,
  resetAllCounters,
  resetEscrowCounter,
  resetTestKeyCounter,
  resetWorkerCounter,
  unauthorizedAccount,
  zeroBalanceAccount,
} from './contract-fixtures.js'

export {
  type PrismaFixtureClient,
  createBooking,
  createBookings,
  createEscrowRecord,
  createEscrowRecords,
  createStellarAccount,
  createStellarAccounts,
  createWebhookLog,
  createWebhookSubscription,
  createWebhookSubscriptions,
} from './db-fixtures.js'
