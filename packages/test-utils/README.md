# @bluecollar/test-utils

Shared test utilities for all BlueCollar packages. Replaces duplicated helper
functions that previously lived independently in every test file.

## What's inside

| Export path | Contents |
|---|---|
| `@bluecollar/test-utils` (root) | Everything below, re-exported |
| `@bluecollar/test-utils/factories` | Data factories (`userFactory`, `workerFactory`, `categoryFactory`, `reviewFactory`, `authUserFactory`, `stellarAddressFactory`) |
| `@bluecollar/test-utils/react` | `renderWithProviders` — wraps RTL `render` with `AuthContext` pre-wired |

## Installation

The package is a private workspace member. Add it as a `devDependency` in
whichever package needs it:

```json
{
  "devDependencies": {
    "@bluecollar/test-utils": "workspace:*"
  }
}
```

Then run `pnpm install` from the repo root.

## Usage

### Data factories

```ts
import { userFactory, workerFactory, authUserFactory } from '@bluecollar/test-utils'

const curator = userFactory({ role: 'curator', verified: true })
const worker  = workerFactory({ isActive: false })
const auth    = authUserFactory({ role: 'admin' })
```

All factories accept `Partial<T>` overrides so you only specify what differs
from the sensible defaults.

### Express mock helpers (API unit tests)

```ts
import { makeRequest, makeResponse, makeNext, makeJwt } from '@bluecollar/test-utils'

it('returns 200 on success', async () => {
  const req  = makeRequest({ body: { email: 'a@b.com' }, user: { id: 'u-1', role: 'user' } })
  const res  = makeResponse()
  const next = makeNext()

  await myController(req as any, res as any, next as any)

  expect(res.status).toHaveBeenCalledWith(200)
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }))
})
```

### React render helper (app unit tests)

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

Available options for `renderWithProviders`:

| Option | Type | Default | Description |
|---|---|---|---|
| `authUser` | `FakeAuthUser \| null` | `null` | The authenticated user |
| `token` | `string \| null` | `'test-jwt'` if authUser set, else `null` | JWT token |
| `authLoading` | `boolean` | `false` | Whether auth is still loading |
| `extraWrappers` | `ComponentType[]` | `[]` | Extra providers to wrap around the component |

## Migration guide

### Before (#1058): per-file helpers

```ts
// Scattered across dozens of test files in packages/api and packages/app
function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function createTestUser(overrides = {}) {
  return { id: faker.string.uuid(), email: faker.internet.email(), ... }
}
```

### After (#1058): shared imports

```ts
import { makeRequest, makeResponse, makeNext, userFactory } from '@bluecollar/test-utils'
```

Differences to keep in mind when migrating:

- `makeResponse()` already sets up `status.mockReturnValue(res)` — you don't
  need to do it yourself.
- `userFactory()` returns a full DB-shape user; `authUserFactory()` returns
  only the fields present in JWT / AuthContext.
- `makeJwt()` signs with `process.env.JWT_SECRET ?? 'test-secret'`, which
  matches the `JWT_SECRET` set in `src/__tests__/setup.ts`.

## Adding new helpers

Add to the appropriate file:

- **Domain data** (new model factories): `src/factories/index.ts`
- **Express mocks**: `src/express/index.ts`
- **React/Next helpers**: `src/react/index.ts`

Export from `src/index.ts` if the helper belongs at the root entry point.

Then re-run `pnpm install` and import from the consuming package.

## Audit results (#1058)

The following helpers were identified as duplicates before consolidation:

| Helper | Appeared in |
|---|---|
| `makeReq` / `makeRequest` / `createMockRequest` | `auth.test.ts`, `workers.test.ts`, `helpers/factories.ts`, `security/regression.test.ts`, +12 more |
| `makeRes` / `makeResponse` / `createMockResponse` | Same files as above |
| `makeNext` / `createMockNext` | Same files |
| `createTestUser` / `userFactory` | `helpers/factories.ts`, `factories/user.factory.ts`, app `Dashboard.test.tsx` |
| `createTestWorkerData` / `workerFactory` | `helpers/factories.ts`, `factories/worker.factory.ts` |
| `generateTestToken` / `makeJwt` | `helpers/factories.ts`, `auth.test.ts`, `workers.test.ts`, +8 more |

## Stellar SDK Mocks

> Added in issue #1265. Import from `@bluecollar/test-utils/stellar-mocks` or
> from the package root.

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

### Well-known address constants

| Constant | Use |
|---|---|
| `MOCK_STELLAR_ADDRESS` | Generic payer / user address |
| `MOCK_WORKER_ADDRESS` | Worker / recipient address |
| `MOCK_FEE_RECIPIENT_ADDRESS` | Fee-distribution recipient address |
| `MOCK_TX_HASH` | Stable 64-hex-char transaction hash |
| `MOCK_SEQUENCE` | Stable account sequence (`bigint`) |
| `MOCK_BALANCE` | Stable XLM balance (`number`, `100`) |

### Fixture helpers

#### `accountFixture(overrides?)`

Returns a default `getAccountInfo` response matching the shared constants.

```ts
import { accountFixture, MOCK_STELLAR_ADDRESS } from '@bluecollar/test-utils/stellar-mocks'

const info = accountFixture()
// { publicKey: MOCK_STELLAR_ADDRESS, balance: 100, sequence: 1234567n }

const custom = accountFixture({ balance: 9999, publicKey: 'GCUSTOM' })
```

#### `transactionFixture(overrides?)`

Returns a default `broadcastTransaction` response.

```ts
import { transactionFixture, MOCK_TX_HASH } from '@bluecollar/test-utils/stellar-mocks'

const tx = transactionFixture()
// { txHash: MOCK_TX_HASH, txId: 'id_abcdef12' }

const custom = transactionFixture({ txHash: 'deadbeef' + '0'.repeat(56) })
// txId is auto-derived as 'id_deadbeef' unless also overridden
```

#### `balanceFixture(overrides?)`

Returns a default `pollTransactionStatus` response.

```ts
import { balanceFixture } from '@bluecollar/test-utils/stellar-mocks'

const ok = balanceFixture()
// { status: 'confirmed', resultCode: 'ok' }

const failed = balanceFixture({ status: 'failed', resultCode: 'op_underfunded' })
```

### `makeMockStellarClient(options?)`

Creates a fully-typed, vi.fn()-backed mock of `StellarClient`. Use it for unit
tests that need to inject a fake client without touching the network.

```ts
import {
  makeMockStellarClient,
  accountFixture,
  MOCK_STELLAR_ADDRESS,
} from '@bluecollar/test-utils/stellar-mocks'

// Replace the default exported singleton:
vi.mock('../clients/stellar.client.js', () => ({
  stellarClient: makeMockStellarClient(),
  StellarClient: vi.fn().mockImplementation(() => makeMockStellarClient()),
}))

// Or inject directly:
it('returns account balance', async () => {
  const client = makeMockStellarClient({
    accountInfo: accountFixture({ balance: 500 }),
  })
  const result = await client.getAccountInfo(MOCK_STELLAR_ADDRESS)
  expect(result.balance).toBe(500)
  expect(client.getAccountInfo).toHaveBeenCalledWith(MOCK_STELLAR_ADDRESS)
})

// Simulate failures:
it('handles account not found', async () => {
  const client = makeMockStellarClient({ accountInfoFails: true })
  await expect(client.getAccountInfo('GABCD')).rejects.toThrow('Account not found')
})
```

Available `MockStellarClientOptions` fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `accountInfo` | `AccountInfoFixture` | `accountFixture()` | Resolved value of `getAccountInfo` |
| `accountInfoFails` | `boolean` | `false` | Makes `getAccountInfo` reject |
| `broadcastResult` | `TransactionFixture` | `transactionFixture()` | Resolved value of `broadcastTransaction` |
| `broadcastFails` | `boolean` | `false` | Makes `broadcastTransaction` reject |
| `txStatus` | `BalanceFixture` | `balanceFixture()` | Resolved value of `pollTransactionStatus` |
| `pollFails` | `boolean` | `false` | Makes `pollTransactionStatus` reject |
| `fundResult` | `{ txHash, message }` | `{ txHash: MOCK_TX_HASH, message: 'Account funded successfully' }` | Resolved value of `fundTestnetAccount` |
| `fundFails` | `boolean` | `false` | Makes `fundTestnetAccount` reject |
| `accountTransactions` | `Array<{ hash, created_at }>` | `[]` | Resolved value of `getAccountTransactions` |
| `accountTransactionsFails` | `boolean` | `false` | Makes `getAccountTransactions` reject |

### `makeMockHorizonFetch(options?)`

Returns a `vi.fn()` suitable for `vi.stubGlobal('fetch', ...)` that intercepts
Horizon REST calls and returns configurable test fixtures.

```ts
import {
  makeMockHorizonFetch,
  MOCK_TX_HASH,
} from '@bluecollar/test-utils/stellar-mocks'

// Stub the global fetch before the test:
vi.stubGlobal('fetch', makeMockHorizonFetch())

// Simulate account not found:
vi.stubGlobal('fetch', makeMockHorizonFetch({ accountNotFound: true }))

// Simulate broadcast failure:
vi.stubGlobal('fetch', makeMockHorizonFetch({ broadcastFails: true }))

// Simulate a pending transaction:
vi.stubGlobal('fetch', makeMockHorizonFetch({ txPending: true }))

// Custom response values:
vi.stubGlobal('fetch', makeMockHorizonFetch({
  balance: '250.0000000',
  sequence: '9999',
  txHash: MOCK_TX_HASH,
}))
```

### `makeFreighterMock(options?)`

Returns a mock object matching the `@stellar/freighter-api` module shape.

```ts
import {
  makeFreighterMock,
  MOCK_STELLAR_ADDRESS,
} from '@bluecollar/test-utils/stellar-mocks'

// Mock the Freighter browser extension:
vi.mock('@stellar/freighter-api', () =>
  makeFreighterMock({ isConnected: true, address: MOCK_STELLAR_ADDRESS })
)

it('reads the wallet address', async () => {
  const mock = makeFreighterMock({ isConnected: true, address: MOCK_STELLAR_ADDRESS })
  const { address } = await mock.getAddress()
  expect(address).toBe(MOCK_STELLAR_ADDRESS)
})
```

### `makeSorobanRpcMock(options?)`

Creates a minimal mock of the Soroban RPC / stellar-sdk `Server` object.

```ts
import { makeSorobanRpcMock } from '@bluecollar/test-utils/stellar-mocks'

vi.mock('@stellar/stellar-sdk', () => makeSorobanRpcMock({
  simulateResult: { success: true },
}))

// Simulate a contract invocation failure:
vi.mock('@stellar/stellar-sdk', () => makeSorobanRpcMock({ simulateFails: true }))
```

