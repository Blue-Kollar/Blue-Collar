# Testing Guide

This guide covers testing approaches across all parts of the BlueCollar codebase: the API, Soroban smart contracts, the Next.js frontend, and the CI/CD pipeline.

## Test File Naming & Location Conventions

All packages in the monorepo follow a consistent naming and location convention for tests. Following these conventions ensures test runners discover files correctly and contributors can quickly identify test type from the filename.

### Naming Convention

| Test type | Suffix | Example |
|-----------|--------|---------|
| Unit test | `*.test.ts` / `*.test.tsx` | `auth.test.ts`, `LoginForm.test.tsx` |
| Integration test | `*.integration.test.ts` | `workers.integration.test.ts` |
| E2E test (API) | `*.e2e.test.ts` | `auth.e2e.test.ts` |
| E2E test (App — Playwright) | `*.spec.ts` | `auth.spec.ts`, `workers.spec.ts` |
| Contract/Pact test | `*.pact.test.ts` | `consumer.workers.pact.test.ts` |

**Key rules:**
- Never use `.spec.ts` for Vitest-based unit or integration tests.
- Always use `*.e2e.test.ts` for API end-to-end tests (Vitest).
- Always use `*.spec.ts` for Playwright browser E2E tests (App package).

### Location Convention

```
packages/
├── api/
│   ├── src/
│   │   ├── middleware/        # Colocated unit tests (next to source)
│   │   │   ├── auth.ts
│   │   │   └── auth.test.ts
│   │   ├── services/          # Colocated unit tests
│   │   │   ├── auth.service.ts
│   │   │   └── auth.service.test.ts
│   │   ├── controllers/       # Colocated unit tests
│   │   ├── utils/             # Colocated unit tests
│   │   ├── validations/       # Colocated unit tests
│   │   └── __tests__/
│   │       ├── setup.ts       # Global test setup (runs before all suites)
│   │       ├── factories/     # Test data factories (faker-based)
│   │       ├── helpers/       # Shared test helpers
│   │       ├── types.ts       # Shared test types
│   │       ├── unit/          # Unit tests (for modules without colocated tests)
│   │       ├── integration/   # Integration tests (mocked DB, full HTTP stack)
│   │       ├── e2e/           # E2E tests (require live database)
│   │       ├── contract/      # Contract/Pact tests
│   │       ├── security/      # Security regression tests
│   │       └── *.test.ts      # Top-level unit/integration tests
│   └── vitest.config.ts
├── app/
│   ├── src/
│   │   ├── components/        # Colocated component tests
│   │   │   ├── LoginForm.tsx
│   │   │   └── LoginForm.test.tsx
│   │   └── __tests__/         # Shared test setup and fixtures
│   ├── e2e/                   # Playwright E2E tests (*.spec.ts)
│   └── vitest.config.ts
├── sdk/
│   ├── src/__tests__/         # All tests in __tests__ directory
│   └── vitest.config.ts
├── test-utils/
│   ├── src/                   # Source + colocated tests
│   └── tests/                 # Additional test files
└── monitoring/
    └── tests/                 # Tests separate from src
```

### How Test Runners Discover Files

**API (`vitest.config.ts`):**
```typescript
include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
exclude: ['src/**/*.e2e.test.ts'],
```
- Includes all `*.test.ts` files anywhere under `src/`
- Excludes `*.e2e.test.ts` (run separately with a live database)
- E2E tests: `pnpm exec vitest run src/__tests__/e2e/`

**App (`vitest.config.ts`):**
```typescript
include: ['src/**/*.{test,spec}.{ts,tsx}'],
```
- Includes both `*.test.*` and `*.spec.*` for compatibility

**Playwright (App E2E):**
```typescript
// playwright.config.ts
testMatch: 'e2e/**/*.spec.ts',
```

### Test Fixtures & Helpers

| Location | Purpose |
|----------|---------|
| `packages/api/src/__tests__/factories/` | Faker-based data factories (`user.factory.ts`, `worker.factory.ts`, `category.factory.ts`) |
| `packages/api/src/__tests__/helpers/factories.ts` | Shared test helpers re-exporting `@bluecollar/test-utils` |
| `packages/api/src/__tests__/types.ts` | Shared test types (`User`, `Worker`, `Category`) |
| `packages/test-utils/src/` | Cross-package shared utilities (mock helpers, factories, contract fixtures) |
| `packages/test-utils/src/express/` | Express mock helpers (`makeRequest`, `makeResponse`, `makeJwt`) |
| `packages/test-utils/src/factories/` | Shared data factories (`userFactory`, `workerFactory`) |

### How to Name a New Test

1. **Determine the test type** (unit, integration, E2E).
2. **Choose the location** based on the table above.
3. **Use the correct suffix:**
   - Unit test next to source: `myModule.test.ts`
   - Integration test: `myFeature.integration.test.ts`
   - E2E test (API): `myFlow.e2e.test.ts`
   - E2E test (App): `myFlow.spec.ts`
4. **Place it** in the correct directory (colocated or `__tests__/` subdirectory).
5. **Import helpers** from `@bluecollar/test-utils` where possible.

## API Unit Testing

The API uses [Vitest](https://vitest.dev) in a Node.js environment. Tests live in `packages/api/src/__tests__/`.

### Configuration

`packages/api/vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./testSetup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
    include: ['src/__tests__/**/*.test.ts'],
  },
})
```

### Running Tests

```bash
cd packages/api

# Run all tests once
pnpm test --run

# Run with coverage
pnpm test:coverage

# Run a specific file
pnpm test --run src/__tests__/auth.test.ts
```

### Test Setup (`testSetup.ts`)

`packages/api/testSetup.ts` runs before every test suite. It:

- Loads `.env` via `dotenv`
- Runs `prisma migrate deploy` to ensure the test DB schema is current
- Cleans all tables after each test in FK-safe order
- Disconnects Prisma after all tests

```typescript
beforeAll(async () => {
  execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit' })
})

afterEach(async () => {
  await db.$transaction([
    db.worker.deleteMany(),
    db.user.deleteMany(),
    db.category.deleteMany(),
    db.location.deleteMany(),
  ])
})
```

Set `TEST_DATABASE_URL` in your `.env` to point to a dedicated test database:

```env
TEST_DATABASE_URL=postgresql://localhost:5432/bluecollar_test
```

### Unit Test Patterns

Unit tests mock all external dependencies (database, mailer, services) and test controllers and middleware in isolation.

**Mocking pattern:**

```typescript
// Mock before imports
vi.mock('../services/auth.service.js', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
}))

vi.mock('../mailer/transport.js', () => ({
  transporter: {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id' }),
  },
}))

// Import after mocks
import * as authService from '../services/auth.service.js'
import { register } from '../controllers/auth.js'
```

**Request/Response helpers:**

```typescript
function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function makeReq(body = {}, user?: any): any {
  return { body, user }
}
```

**Asserting responses:**

```typescript
it('returns 201 on successful registration', async () => {
  (authService.registerUser as any).mockResolvedValue(mockUser)
  const req = makeReq({ email: 'alice@example.com', password: 'secret' })
  const res = makeRes()

  await register(req, res)

  expect(res.status).toHaveBeenCalledWith(201)
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'success', code: 201 })
  )
})
```

**Testing middleware:**

```typescript
import { authenticate, authorize } from '../middleware/auth.js'
import jwt from 'jsonwebtoken'

it('returns 401 for missing Authorization header', () => {
  const req = makeReq({ headers: {} })
  const res = makeRes()
  const next = vi.fn()

  authenticate(req, res, next)

  expect(res.status).toHaveBeenCalledWith(401)
  expect(next).not.toHaveBeenCalled()
})

it('calls next() for a valid JWT', () => {
  const token = jwt.sign({ id: 'user-1', role: 'curator' }, 'test-secret')
  const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
  const res = makeRes()
  const next = vi.fn()

  authenticate(req, res, next)

  expect(next).toHaveBeenCalledOnce()
  expect(req.user).toMatchObject({ id: 'user-1', role: 'curator' })
})
```

## Database Integration Testing (Real PostgreSQL)

Database integration tests exercise actual Prisma operations against a live PostgreSQL database. They validate that the application's persistence layer works correctly with the real database engine — no mocking.

### Setup

1. Start a test database (Docker recommended):

```bash
docker compose -f docker-compose.test.yml up -d
```

2. Set the test database URL:

```bash
export TEST_DATABASE_URL=postgresql://bluecollar_test:bluecollar_test@localhost:5433/bluecollar_test
```

Or add it to `packages/api/.env`:

```env
TEST_DATABASE_URL=postgresql://bluecollar_test:bluecollar_test@localhost:5433/bluecollar_test
```

3. Run the database integration tests:

```bash
cd packages/api
pnpm test:integration:db
```

4. Stop and clean up the test database:

```bash
docker compose -f docker-compose.test.yml down -v
```

### What These Tests Cover

- **User CRUD** — create, retrieve, update, soft-delete, hard-delete
- **Category CRUD** — create, list, unique constraints, delete
- **Worker CRUD** — foreign key relationships (Worker → User, Worker → Category)
- **Unique constraints** — email uniqueness, category name uniqueness
- **Required fields** — validation of NOT NULL constraints
- **Default values** — role defaults to "user", verified defaults to false
- **Query filters** — filtering by isActive, categoryId, ordering, pagination
- **Transactions** — commit on success, rollback on failure
- **Timestamps** — auto-generated createdAt/updatedAt, auto-update on edit
- **Optional fields** — nullable columns accept null and set values

### Configuration

`packages/api/vitest.db-integration.config.ts`:

```typescript
export default defineConfig({
  test: {
    include: ['src/__tests__/db-integration/**/*.test.ts'],
    setupFiles: ['src/__tests__/db-integration/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
```

### Test Setup (`db-integration/setup.ts`)

The setup file:
- Validates `TEST_DATABASE_URL` or `DATABASE_URL` is a valid PostgreSQL URL
- Runs `prisma migrate deploy` to ensure schema is current
- Cleans all tables before each test (FK-safe order)
- Disconnects Prisma after all tests

### Writing New Database Integration Tests

```typescript
import { describe, it, expect } from 'vitest'
import { db } from './setup.js'

describe('MyFeature persistence', () => {
  it('creates and retrieves a record', async () => {
    const created = await db.myModel.create({
      data: { name: 'Test', value: 42 },
    })

    expect(created.id).toBeDefined()

    const found = await db.myModel.findUnique({ where: { id: created.id } })
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Test')
  })
})
```

## Contract Testing with Soroban SDK

Smart contracts in `packages/contracts/` are written in Rust and tested using the [Soroban SDK test utilities](https://docs.rs/soroban-sdk/latest/soroban_sdk/testutils/index.html). No external network is required — tests run against an in-memory Soroban environment.

### Running Contract Tests

```bash
cd packages/contracts

# Run all contract tests
cargo test

# Run tests for a specific contract
cargo test -p market

# Run with output (useful for debugging)
cargo test -- --nocapture
```

### Test Environment Setup

The `TestEnv` struct pattern provides a reusable test harness:

```rust
struct TestEnv {
    env: Env,
    contract_id: Address,
    payer: Address,
    worker: Address,
    token_addr: Address,
}

impl TestEnv {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();  // Skip auth checks in tests

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let worker = Address::generate(&env);

        // Register a mock Stellar asset and mint tokens to payer
        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_addr = token_id.address();
        StellarAssetClient::new(&env, &token_addr).mint(&payer, &1_000_000);

        // Deploy the contract under test
        let contract_id = env.register_contract(None, MarketContract);

        TestEnv { env, contract_id, payer, worker, token_addr }
    }

    fn client(&self) -> MarketContractClient {
        MarketContractClient::new(&self.env, &self.contract_id)
    }

    fn token_balance(&self, addr: &Address) -> i128 {
        TokenClient::new(&self.env, &self.token_addr).balance(addr)
    }
}
```

### Writing Contract Tests

```rust
#[test]
fn test_tip_transfers_tokens() {
    let t = TestEnv::new();
    // Initialize the contract first
    t.client().initialize(&admin, &0, &fee_recipient);
    // Call the function under test
    t.client().tip(&t.payer, &t.worker, &t.token_addr, &500_000);
    // Assert token balances
    assert_eq!(t.token_balance(&t.worker), 500_000);
    assert_eq!(t.token_balance(&t.payer), 500_000);
}
```

**Testing panics (expected failures):**

```rust
#[test]
#[should_panic(expected = "Escrow id already exists")]
fn test_duplicate_escrow_panics() {
    let t = TestEnv::new();
    let id = Symbol::new(&t.env, "escrow1");
    t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &100_000, &9999);
    t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &100_000, &9999);
}
```

**Manipulating ledger time for expiry tests:**

```rust
fn set_time(&self, ts: u64) {
    self.env.ledger().set(LedgerInfo {
        timestamp: ts,
        protocol_version: 22,
        sequence_number: 1,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 100_000,
    });
}

#[test]
fn test_cancel_after_expiry() {
    let t = TestEnv::new();
    t.set_time(1000);
    t.client().create_escrow(&id, &t.payer, &t.worker, &t.token_addr, &300_000, &2000);
    t.set_time(3000);  // advance past expiry
    t.client().cancel_escrow(&id, &t.payer);
    assert_eq!(t.token_balance(&t.payer), 1_000_000);  // full refund
}
```

## E2E Testing for the Frontend

The API includes E2E tests in `packages/api/src/__tests__/e2e/` that use [Supertest](https://github.com/ladjs/supertest) to make real HTTP requests against the Express app with a live test database.

### Running E2E Tests

E2E tests require a running PostgreSQL database. Set `TEST_DATABASE_URL` in your environment:

```bash
cd packages/api
TEST_DATABASE_URL=postgresql://localhost:5432/bluecollar_test pnpm test --run src/__tests__/e2e/
```

### E2E Test Pattern

```typescript
import request from 'supertest'
import app from '../../app.js'

// Mock external services that shouldn't run in tests
vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }) },
}))

describe('POST /api/auth/register', () => {
  it('creates a new account and returns 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'Password123!', firstName: 'Alice', lastName: 'Smith' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
    expect(res.body.data.email).toBe('user@example.com')
  })
})
```

**Authenticated requests:**

```typescript
let authToken: string

// Obtain a token in a beforeAll or earlier test
authToken = (await request(app).post('/api/auth/login').send(credentials)).body.token

// Use it in subsequent requests
const res = await request(app)
  .get('/api/auth/me')
  .set('Authorization', `Bearer ${authToken}`)
```

### Frontend Component Testing

The Next.js app uses Vitest + React Testing Library in `packages/app/src/__tests__/`.

**Configuration** (`packages/app/vitest.config.ts`):

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

**Running frontend tests:**

```bash
cd packages/app
pnpm test --run
```

**Component test pattern:**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import TipModal from '@/components/TipModal'

// Mock external dependencies
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  signTransaction: vi.fn(),
}))

describe('TipModal', () => {
  it('opens modal when trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<TipModal workerName="Alice" walletAddress="GABC..." />)

    await user.click(screen.getByRole('button', { name: /send tip/i }))

    expect(await screen.findByText('Send a Tip')).toBeInTheDocument()
  })

  it('disables submit when amount is empty', async () => {
    const user = userEvent.setup()
    render(<TipModal workerName="Alice" walletAddress="GABC..." />)
    await user.click(screen.getByRole('button', { name: /send tip/i }))

    expect(screen.getByRole('button', { name: /^send tip$/i })).toBeDisabled()
  })
})
```

## Test Data Factories

Factories in `packages/api/src/__tests__/factories/` use [@faker-js/faker](https://fakerjs.dev) to generate realistic test data with sensible defaults that can be overridden.

### Available Factories

**userFactory**

```typescript
import { userFactory } from './factories/user.factory'

const user = userFactory()
// { id: uuid, email: 'alice@example.com', firstName: 'Alice', role: 'user', ... }

const admin = userFactory({ role: 'admin', email: 'admin@example.com' })
```

**workerFactory**

```typescript
import { workerFactory } from './factories/worker.factory'

const worker = workerFactory()
// { id: uuid, name: 'John Smith', isActive: true, isVerified: false, ... }

const verifiedWorker = workerFactory({ isVerified: true, walletAddress: 'GABC...' })
```

**categoryFactory**

```typescript
import { categoryFactory } from './factories/category.factory'

const category = categoryFactory()
// { id: uuid, name: 'Electronics', description: '...', ... }

const plumbing = categoryFactory({ name: 'Plumbing' })
```

### Creating a New Factory

```typescript
// packages/api/src/__tests__/factories/review.factory.ts
import { faker } from '@faker-js/faker'
import type { Review } from '../types'

export const reviewFactory = (overrides: Partial<Review> = {}): Review => ({
  id: faker.string.uuid(),
  rating: faker.number.int({ min: 1, max: 5 }),
  comment: faker.lorem.sentence(),
  workerId: faker.string.uuid(),
  userId: faker.string.uuid(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
```

### Using Factories in E2E Tests

In E2E tests, factories generate the data shape but you still need to persist it to the database:

```typescript
import { userFactory } from '../factories/user.factory'
import { db } from '../../db.js'

const userData = userFactory({ role: 'curator' })
await db.user.create({ data: userData })
```

## Monitoring Alert Rule Coverage

The `packages/monitoring` package ships a pure alert-rule evaluation engine (`src/alerts.ts`) that parses the Prometheus-style `expr` strings from the alert YAML files (`packages/monitoring/alerts/*.yml`) and evaluates them against live metrics, honoring `for:` (debounce), `labels.severity`, `disabled`, and `no-data` semantics.

### Running the tests

```bash
cd packages/monitoring

# Run the suite
pnpm test

# Run with coverage (enforces >=85% lines/functions/branches/statements)
pnpm test:coverage
```

Coverage is configured in `packages/monitoring/vitest.config.ts` to include only `src/alerts.ts` and fail the build below the thresholds. The suite (`packages/monitoring/tests/alerts.test.ts`) covers:

- Comparison operators (`>`, `>=`, `<`, `<=`, `==`, `!=`) with numeric, duration, and percentage expressions.
- `rate(...)` / `increase(...)` style wrapped expressions and `by`/`without` labels.
- `for:` debounce (`pending` until the duration elapses, then `firing`).
- `disabled` rules (skipped) and missing/zero series (`no-data` → `inactive`).
- `severity` propagation and metric-label matching via `AlertEvaluator.evaluateRules`.

## Shared Test Utilities & Contract Fixtures

`@bluecollar/test-utils` centralizes reusable test helpers so packages don't duplicate setup boilerplate (#1278). Subpath exports:

- `@bluecollar/test-utils/express` — `makeRequest`, `makeResponse`, `makeNext`, `makeToken`, `makeExpiredToken` (JWT helpers). The API controllers delegate their mock `req`/`res`/`next` and token helpers here.
- `@bluecollar/test-utils/contract-fixtures` — Stellar/Soroban contract fixtures: `makeTestAccount`, `makeTestAsset`, `makeTestPayment`, `buildMockAccountResponse`, `makeMockTransaction`, `makeMockEffects`, `makeMockOperations`, plus common **account states** (#1276):
  - `freshAccount`, `fundedAccount`, `zeroBalanceAccount`, `authorizedAccount`, `unauthorizedAccount`
  - `makeSenderRecipient`, `makeAccountStates`
- `@bluecollar/test-utils/stellar-mocks` — `makeStellarMockServer`, `makeMockServer`, `mockHorizonError`, `mockRpcError`.

### Running the tests

```bash
cd packages/test-utils
pnpm test            # unit tests for the fixtures
pnpm test:coverage   # coverage for the fixtures package
```

The SDK consumes these fixtures directly (see `packages/sdk/src/__tests__/contract-account-states.test.ts` and the migrated `sdk.e2e.test.ts`), exercising `authorized`/`unauthorized` and `funded`/`zero-balance` account states against its Stellar client.

## Mobile E2E Coverage (Onboarding / Send / Receive)

The `packages/mobile` app now has real critical-flow screens under `packages/mobile/src/screens/`
(`OnboardingScreen`, `SendScreen`, `ReceiveScreen`) with injected dependencies (`walletProvider`,
`onSend`, `publicKey`, `onCopy`) so they can be rendered and asserted deterministically.

The E2E specs live in `packages/mobile/e2e/flows/`:

- `onboarding.e2e.tsx` — happy path (create wallet → back up → confirm → dashboard) and the "re-enter phrase" mismatch guard.
- `send.e2e.tsx` — amount validation (empty / invalid / non-positive) and a successful send that invokes `onSend`.
- `receive.e2e.tsx` — renders the public key / shareable address and fires `onCopy`.

### Running the tests

```bash
cd packages/mobile
pnpm test:e2e          # jest --config e2e/jest.e2e.config.js --forceExit
```

The specs use **seeded, fake Stellar public keys** (never real secrets), for example:

```text
GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37   # sender ("Alice")
GBCB6T6GIR7LRI2WW7GTER7KA6EQBUEKQYED7YENPRZXZDQISJA4FXV2G   # recipient ("Bob")
```

`expo-secure-store` and the wallet provider are mocked in `packages/mobile/jest.setup.ts`.

> **Environment note:** In this sandbox the mobile E2E suite could not be executed because of a
> `jest-expo` + React Native `0.74` + newer `@babel/parser` (Flow) incompatibility when transforming
> `@react-native/js-polyfills` (`react-native/jest/setup.js`). This also affects the pre-existing
> `packages/mobile/e2e/mobile-flows.e2e.ts`, so it is a tooling-version limitation rather than a
> regression. The specs are written against the existing `jest-expo` E2E config and are expected to
> run in CI where the matching Babel/React Native versions are resolved. The screens themselves
> type-check cleanly via `tsc --noEmit` (the `mobile` `tsconfig` excludes `e2e` from type-checking).

## CI/CD Testing Pipeline

Tests run automatically on every push and pull request via GitHub Actions (`.github/workflows/`).

### Pipeline Stages

```
Push / PR
    │
    ▼
┌─────────────────────────────────────────┐
│  1. Lint & Type Check                   │
│     pnpm lint                           │
│     pnpm tsc --noEmit                   │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  2. API Unit Tests                      │
│     cd packages/api                     │
│     pnpm test:coverage                  │
│     (requires TEST_DATABASE_URL secret) │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  3. Frontend Tests                      │
│     cd packages/app                     │
│     pnpm test --run                     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  4. Contract Tests                      │
│     cd packages/contracts               │
│     cargo test                          │
└─────────────────────────────────────────┘
```

### Required Secrets

Set these in your GitHub repository settings under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `TEST_DATABASE_URL` | PostgreSQL connection string for the test database |
| `JWT_SECRET` | Secret used to sign JWTs in tests |
| `APP_URL` | Base URL used in email templates during tests |

### Coverage Thresholds

The API enforces minimum coverage thresholds in `vitest.config.ts`. The CI build fails if coverage drops below:

- Lines: 80%
- Functions: 80%
- Branches: 70%

Run coverage locally before pushing:

```bash
cd packages/api
pnpm test:coverage
```

The HTML report is generated at `packages/api/coverage/index.html`.
