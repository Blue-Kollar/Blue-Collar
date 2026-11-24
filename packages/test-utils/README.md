# @bluecollar/test-utils

Shared, deterministic test utilities for every BlueCollar package. This is a
private workspace package: it replaces the per-file `makeReq` / `makeRes` /
factory / fixture boilerplate that used to be copied into individual test files.
Nothing here talks to a real database, network, or Stellar node unless you
explicitly ask it to.

## Installation

Add it as a dev dependency in the consuming package (no `pnpm install` is needed
if it is already present in the workspace lockfile):

```json
{
  "devDependencies": {
    "@bluecollar/test-utils": "workspace:*"
  }
}
```

## Subpath exports

Every subpath below is declared in `package.json` → `exports`, so it can be
imported by name from any workspace package.

| Subpath | Contents | Typical consumer |
|---|---|---|
| `@bluecollar/test-utils` (root) | All of the below **except** React helpers, re-exported from one place | Any test that needs two or more kinds of helper |
| `@bluecollar/test-utils/factories` | `userFactory`, `workerFactory`, `categoryFactory`, `reviewFactory`, `authUserFactory`, `stellarAddressFactory` and the `Fake*` interfaces | api, app, mobile |
| `@bluecollar/test-utils/express` | `makeRequest`, `makeResponse`, `makeNext`, `makeJwt`, `makeExpiredJwt` and the `Mock*` interfaces | api controller / middleware tests |
| `@bluecollar/test-utils/react` | `renderWithProviders`, `useTestAuth`, `RenderWithProvidersOptions` | app (React) tests only |
| `@bluecollar/test-utils/contract-fixtures` | Account factories, account states, escrow/worker fixtures, Horizon response builders, `TESTNET_*` / `MAINNET_*` URL constants | sdk, contracts, api |
| `@bluecollar/test-utils/stellar-mocks` | Horizon / Freighter / Soroban mocks, `makeMockStellarClient`, fixture helpers and `MOCK_*` constants | api, app, sdk |
| `@bluecollar/test-utils/stellar-sdk-mock` | `MockStellarServer`, `MockSorobanRpcServer`, `createMockStellarClient`, `mockAccountFixture`, `mockTransactionFixture` | api integration tests |
| `@bluecollar/test-utils/db-fixtures` | Prisma-backed `create*` / `create*Batch` factories for StellarAccount, WebhookSubscription, WebhookLog, Booking and EscrowRecord | api integration tests |

### Root vs subpath

- Use the **root** when you need helpers from several modules at once:
  `import { userFactory, makeResponse, accountFixture } from '@bluecollar/test-utils'`.
  The root lists its exports explicitly; there are no `export *` collisions and
  every runtime export of the non-React subpaths is re-exported by identity.
- Use a **subpath** when you only need one concern (smaller import graph, clearer
  intent) or when you need React helpers. `renderWithProviders` and `useTestAuth`
  are **only** available from `/react`: the root deliberately omits them so that
  API/mobile tests do not have to resolve React just to import a factory.
- Deep imports such as `@bluecollar/test-utils/src/...` are not supported; add a
  new entry to `exports` instead (see below).

## Usage

### Data factories

```ts
import { userFactory, workerFactory, authUserFactory } from '@bluecollar/test-utils'

const curator = userFactory({ role: 'curator', verified: true })
const worker = workerFactory({ isActive: false })
const auth = authUserFactory({ role: 'admin' })
```

All factories accept `Partial<T>` overrides so you only specify what differs
from the defaults. `userFactory()` returns a full DB-shape user;
`authUserFactory()` returns only the fields carried in a JWT / AuthContext.

### Express mocks

```ts
import { makeRequest, makeResponse, makeNext } from '@bluecollar/test-utils'

it('returns 200 on success', async () => {
  const req = makeRequest({ body: { email: 'a@b.com' } })
  const res = makeResponse()
  const next = makeNext()

  await myController(req as any, res as any, next as any)

  expect(res.status).toHaveBeenCalledWith(200)
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }))
})
```

`makeResponse()` pre-wires `status.mockReturnValue(res)`, so `res.status(200).json(...)`
chains correctly. `makeJwt()` / `makeExpiredJwt()` sign with
`process.env.JWT_SECRET ?? 'test-secret'` and require `jsonwebtoken` to be
available in the consuming package.

### React render helper

```tsx
import { renderWithProviders } from '@bluecollar/test-utils/react'
import { authUserFactory } from '@bluecollar/test-utils/factories'

it('shows curator-only edit button', () => {
  renderWithProviders(<WorkerCard worker={worker} />, {
    authUser: authUserFactory({ role: 'curator' }),
  })
  expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `authUser` | `FakeAuthUser \| null` | `null` | The authenticated user |
| `token` | `string \| null` | `'test-jwt'` if `authUser` set, else `null` | JWT token |
| `authLoading` | `boolean` | `false` | Whether auth is still loading |
| `extraWrappers` | `ComponentType[]` | `[]` | Extra providers to wrap around the component |

`useTestAuth()` reads the same context from a component under test.

### Contract fixtures

```ts
import {
  makeTestAccountSet,
  fundedAccount,
  resetAllCounters,
  TESTNET_FRIENDBOT_URL,
} from '@bluecollar/test-utils/contract-fixtures'

beforeEach(() => resetAllCounters())

const { admin, curator, worker, payer, feeRecipient } = makeTestAccountSet()
const sender = fundedAccount({ label: 'sender' })
```

Key helpers: `makeTestAccount`, `makeTestAccountSet`, `freshAccount`,
`fundedAccount`, `zeroBalanceAccount`, `authorizedAccount`,
`unauthorizedAccount`, `makeSenderRecipient`, `makeAccountStates`,
`makeTestWorkerFixture`, `makeEscrowId`, `futureExpiry`,
`buildMockFundedResponse`, `buildMockAccountResponse`, `mockFundTestnetAccount`,
and the `reset*Counter` helpers. Deterministic keys/counters make snapshots
stable; reset them in `beforeEach`.

The `TESTNET_FRIENDBOT_URL`, `TESTNET_HORIZON_URL` and `MAINNET_HORIZON_URL`
constants have the same names and values as the ones in `@bluecollar/sdk`. They
are declared locally so test-utils does not have to import the SDK barrel (the
SDK also dev-depends on test-utils, which made that import circular).

### Stellar SDK mocks (`/stellar-sdk-mock`)

```ts
import {
  MockStellarServer,
  createMockStellarClient,
} from '@bluecollar/test-utils/stellar-sdk-mock'

const server = new MockStellarServer()
const client = createMockStellarClient(server)
```

`createMockStellarClient` accepts either a `MockStellarServer` (so the client
uses that server's state) or an object of per-method overrides
(`getAccountInfo`, `broadcastTransaction`, `pollTransactionStatus`,
`getAccountTransactions`). It returns `{ horizonServer, sorobanServer, ... }`.
`MockStellarServer` supports `setAccountResponse`, `getAccount`,
`submitTransaction`, `getTransaction`, `getAccountTransactions`,
`setFailureMode` and `reset`; `MockSorobanRpcServer` is the RPC equivalent.
`mockAccountFixture()` and `mockTransactionFixture()` now reuse the shared
`MOCK_STELLAR_ADDRESS` / `MOCK_TX_HASH` constants from `/stellar-mocks`.

### Database fixtures (`/db-fixtures`)

```ts
import {
  createStellarAccount,
  createEscrowRecord,
  createWebhookSubscription,
} from '@bluecollar/test-utils/db-fixtures'

const account = await createStellarAccount(db, { userId, balance: 100 })
```

All factories take a Prisma client as the first argument and a partial override
object as the last. They auto-create related rows (user, worker, category,
payer/payee) when the corresponding id is omitted, and batch variants exist:
`createStellarAccounts`, `createWebhookSubscriptions`, `createBookings`,
`createEscrowRecords`. The client parameter is typed with the local structural
`PrismaFixtureClient` interface, so a real `PrismaClient` is accepted without
test-utils needing `@prisma/client` as a hard dependency.

### Stellar mocks (`/stellar-mocks`)

> Added in issues #1054 / #1265. Import from `@bluecollar/test-utils/stellar-mocks`
> or from the package root.

```ts
import {
  makeMockHorizonFetch,
  makeFreighterMock,
  makeSorobanRpcMock,
  makeMockStellarClient,
  accountFixture,
  transactionFixture,
  balanceFixture,
  MOCK_STELLAR_ADDRESS,
  MOCK_WORKER_ADDRESS,
  MOCK_FEE_RECIPIENT_ADDRESS,
  MOCK_TX_HASH,
  MOCK_SEQUENCE,
  MOCK_BALANCE,
} from '@bluecollar/test-utils/stellar-mocks'
```

#### Well-known address constants

| Constant | Use |
|---|---|
| `MOCK_STELLAR_ADDRESS` | Generic payer / user address |
| `MOCK_WORKER_ADDRESS` | Worker / recipient address |
| `MOCK_FEE_RECIPIENT_ADDRESS` | Fee-distribution recipient address |
| `MOCK_TX_HASH` | Stable 64-hex-char transaction hash |
| `MOCK_SEQUENCE` | Stable account sequence (`bigint`) |
| `MOCK_BALANCE` | Stable XLM balance (`number`, `100`) |

#### Fixture helpers

```ts
accountFixture()                                  // { publicKey, balance: 100, sequence: 1234567n }
accountFixture({ balance: 9999, publicKey: 'GCUSTOM' })
transactionFixture()                              // { txHash: MOCK_TX_HASH, txId: 'id_abcdef12' }
transactionFixture({ txHash: 'deadbeef' + '0'.repeat(56) }) // txId is derived
balanceFixture()                                  // { status: 'confirmed', resultCode: 'ok' }
balanceFixture({ status: 'failed', resultCode: 'op_underfunded' })
```

#### `makeMockStellarClient(options?)`

Creates a fully-typed, `vi.fn()`-backed mock of `StellarClient` for injection.
Every method is a spy, so call arguments can be asserted.

```ts
vi.mock('../clients/stellar.client.js', () => ({
  stellarClient: makeMockStellarClient(),
  StellarClient: vi.fn().mockImplementation(() => makeMockStellarClient()),
}))

const client = makeMockStellarClient({ accountInfo: accountFixture({ balance: 500 }) })
expect((await client.getAccountInfo(MOCK_STELLAR_ADDRESS)).balance).toBe(500)
```

| Option | Type | Default |
|---|---|---|
| `accountInfo` / `accountInfoFails` | `AccountInfoFixture` / `boolean` | `accountFixture()` / `false` |
| `broadcastResult` / `broadcastFails` | `TransactionFixture` / `boolean` | `transactionFixture()` / `false` |
| `txStatus` / `pollFails` | `BalanceFixture` / `boolean` | `balanceFixture()` / `false` |
| `fundResult` / `fundFails` | `{ txHash, message }` / `boolean` | mock success / `false` |
| `accountTransactions` / `accountTransactionsFails` | array / `boolean` | `[]` / `false` |

#### `makeMockHorizonFetch(options?)`

Returns a `vi.fn()` for `vi.stubGlobal('fetch', ...)` that intercepts Horizon
REST calls. Supports `accountNotFound`, `broadcastFails`, `txPending`, custom
`balance`, `sequence`, `txHash` and `extraBalances`.

```ts
vi.stubGlobal('fetch', makeMockHorizonFetch({ accountNotFound: true }))
```

#### `makeFreighterMock(options?)`

Mirrors the `@stellar/freighter-api` module shape (`isConnected`,
`requestAccess`, `getAddress`, `getNetwork`, `signTransaction`, `signBlob`).

```ts
vi.mock('@stellar/freighter-api', () =>
  makeFreighterMock({ isConnected: true, address: MOCK_STELLAR_ADDRESS }))
```

#### `makeSorobanRpcMock(options?)`

Minimal mock of the Soroban RPC / `stellar-sdk` `Server` object, including
`SorobanRpc.Server`, `Networks`, `Keypair`, `Contract`, `TransactionBuilder`,
`Asset`, `Operation` and `Memo`. Use `simulateResult` / `simulateFails` to drive
contract simulation paths.

## Adding new utilities

1. Put the implementation in the matching module:
   - domain data → `src/factories/index.ts`
   - Express/JWT mocks → `src/express/index.ts`
   - React/Next helpers → `src/react/index.ts` (subpath only)
   - account/contract fixtures → `src/contract-fixtures.ts`
   - Horizon/Freighter/Soroban mocks → `src/stellar-mocks.ts`
   - stateful Stellar server/client mocks → `src/stellar-sdk-mock.ts`
   - Prisma-backed fixtures → `src/db-fixtures.ts`
2. If it is a new file, add a `"./<name>": "./src/<name>.ts"` entry to the
   `exports` map in `package.json`. Subpaths must be declared or consumers
   cannot import them.
3. Add the symbol to the explicit export list in `src/index.ts` (unless it is a
   React helper — those stay subpath-only).
4. Export its TypeScript types alongside the value so consumers can annotate.
5. Add a test under `tests/` that imports it both from its subpath and, when
   applicable, from the root. Run `pnpm --filter @bluecollar/test-utils test`,
   `... type-check` and `... exec knip`.

## Deprecated / removed helpers

| Helper | Status | Notes / replacement |
|---|---|---|
| `createMockTransaction` (from `/stellar-sdk-mock`) | **Removed in #1879** | Was unused across the monorepo and imported a non-existent `@stellar/js-sdk` package. Build real transactions with `@stellar/stellar-sdk` in the consuming package, or use `transactionFixture` from `/stellar-mocks`. |
| Trailing `export { mockAccountFixture, mockTransactionFixture }` in `stellar-sdk-mock.ts` | **Removed in #1879** | Both are already exported at their declarations; the second export was a duplicate that broke parsing of the root barrel. |
| Re-export of `TESTNET_*` / `MAINNET_*` from `@bluecollar/sdk` | **Changed in #1879** | Constants now live locally with identical names/values; no consumer change needed. |
| `@prisma/client` type import in `/db-fixtures` | **Removed in #1879** | Replaced by `PrismaFixtureClient`; pass a real `PrismaClient` as before. |
| `makeMockStellarClient` vs `createMockStellarClient` | Both supported | `makeMockStellarClient` gives `vi.fn()` spies for injection; `createMockStellarClient` wires stateful `MockStellarServer` / `MockSorobanRpcServer` instances. Prefer the latter for integration-style tests. |

Nothing else was removed: all other public helpers are still exported from the
same subpath and from the root.

## Migration guide

### Before (#1058): per-file helpers

```ts
function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}
function createTestUser(overrides = {}) {
  return { id: faker.string.uuid(), email: faker.internet.email(), ...overrides }
}
```

### After: shared imports

```ts
import { makeRequest, makeResponse, makeNext, userFactory } from '@bluecollar/test-utils'
```

## Audit results (#1058)

The original consolidation replaced these duplicated helpers:

| Old name | New shared name |
|---|---|
| `makeReq` / `makeRequest` / `createMockRequest` | `makeRequest` |
| `makeRes` / `makeResponse` / `createMockResponse` | `makeResponse` |
| `makeNext` / `createMockNext` | `makeNext` |
| `createTestUser` / `userFactory` | `userFactory` |
| `createTestWorkerData` / `workerFactory` | `workerFactory` |
| `generateTestToken` / `makeJwt` | `makeJwt` |
