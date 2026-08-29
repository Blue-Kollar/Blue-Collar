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
