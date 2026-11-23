# Blue-Collar Testing Infrastructure Enhancements

## Overview

This PR implements comprehensive testing infrastructure for Blue-Collar's payment and webhook systems, with reusable mock utilities and database fixtures. All four issues address critical gaps in integration testing coverage, enabling reliable testing of Stellar blockchain interactions, payment flows, and webhook delivery mechanisms.

**Closes #1857 #1858 #1859 #1860**

---

## Issues & Changes

### Issue #1857: Mock Stellar SDK Test Utility

**File:** `packages/test-utils/src/stellar-sdk-mock.ts`

Provides production-grade mock implementations for Stellar blockchain interactions without hitting live Horizon or Soroban RPC servers.

**Key Classes:**

- **MockStellarServer**: Simulates Horizon API with account state management
  - `getAccount(publicKey)`: Returns mock account with balance & sequence
  - `submitTransaction(tx)`: Accepts & tracks transactions
  - `getTransaction(hash)`: Retrieves submitted transactions
  - `getAccountTransactions(publicKey)`: Returns paginated transaction history
  - `setAccountState(publicKey, state)`: Manually set account data for testing

- **MockSorobanRpcServer**: Simulates Soroban RPC with contract interaction mocking
  - `simulateTransaction(tx)`: Mock contract invocation simulation
  - `sendTransaction(tx)`: Mock Soroban transaction submission
  - `getTransaction(hash)`: Retrieve Soroban transactions
  - `getAccount(publicKey)`: Mock Soroban account data

**Helper Functions:**

- `createMockStellarClient(mockServer)`: Factory for mock StellarClient
- `createMockTransaction()`: Generate realistic Stellar Transaction objects
- `mockAccountFixture()`: Generate account fixtures (balance, sequence)
- `mockTransactionFixture()`: Generate transaction fixtures with status

**Usage Example:**

```typescript
const mockServer = new MockStellarServer();
const mockClient = createMockStellarClient(mockServer);
mockServer.setAccountState('GXXXX...', { balance: '1000', sequence: 1 });
const result = await mockClient.submitTransaction(tx);
```

**Benefits:**

- Zero external dependencies (no Horizon/Soroban API calls)
- Deterministic test execution (same input = same output)
- Full control over account state & transaction results
- Eliminates rate limiting & network flakiness

---

### Issue #1858: Database Fixture Factories

**File:** `packages/test-utils/src/db-fixtures.ts`

Provides factory functions for generating consistent test data across integration tests. Supports both single-instance and batch creation with partial overrides.

**Core Factories:**

1. **StellarAccount Factories**
   - `createStellarAccount(db, overrides)`: Create wallet account with default 100 XLM balance
   - `createStellarAccounts(db, count, overrides)`: Batch create multiple accounts
   - Auto-creates user if `userId` not provided

2. **WebhookSubscription Factories**
   - `createWebhookSubscription(db, overrides)`: Create webhook endpoint with auto-generated secret
   - `createWebhookSubscriptions(db, userId, count, overrides)`: Batch create for user
   - Generates cryptographically secure 32-byte secrets (hex-encoded)

3. **WebhookLog Factories**
   - `createWebhookLog(db, subscriptionId, overrides)`: Create delivery log entry
   - Tracks attempts, status codes, error messages, and payload

4. **Booking Factories**
   - `createBooking(db, overrides)`: Create service booking with startTime/endTime
   - `createBookings(db, count, overrides)`: Batch create bookings
   - Auto-creates worker & requester if not provided
   - Default: 24h future start time, 2-hour duration

5. **EscrowRecord Factories**
   - `createEscrowRecord(db, overrides)`: Create escrow payment transaction
   - `createEscrowRecords(db, count, overrides)`: Batch create escrow records
   - Auto-creates payer & payee if not provided
   - Default: 50 XLM amount, 7-day expiry

**Helper Functions:**

- `getOrCreateUserId(db)`: Create user with faker data if needed
- `getOrCreateCategoryId(db)`: Create or retrieve category

**Usage Example:**

```typescript
const account = await createStellarAccount(db, { balance: 1000 });
const subscription = await createWebhookSubscription(db, {
  userId,
  events: ['payment.created'],
});
const booking = await createBooking(db, { workerId, requesterId });
```

**Benefits:**

- Consistent test data (deterministic via faker seeding)
- Reduced boilerplate in integration tests
- Automatic FK relationships (users created as needed)
- Flexible overrides for custom test scenarios

---

### Issue #1859: Payment Flow Integration Tests

**File:** `packages/api/src/__tests__/integration/payment-flow.integration.test.ts`

Comprehensive integration tests for payment service covering tips, escrows, and fee calculations.

**Test Suites:**

1. **Tip Payments** (3 tests)
   - ✅ Create tip payment from payer to payee
   - ✅ Reject tips with insufficient balance (error scenario)
   - ✅ Apply fee basis points (bps) to tip calculations

2. **Escrow Payments** (4 tests)
   - ✅ Create escrow record with pending status
   - ✅ Release escrow to payee
   - ✅ Prevent release of expired escrows
   - ✅ Cancel escrow and return funds

3. **Stellar Blockchain Integration** (2 tests)
   - ✅ Track Stellar transaction IDs in escrow records
   - ✅ Handle Stellar RPC failures gracefully

4. **Fee Calculations** (4 tests)
   - ✅ Correctly calculate fees from basis points (e.g., 200 bps = 2%)
   - ✅ Handle zero-fee configurations
   - ✅ Reject unauthorized fee updates from non-admin users
   - ✅ Proper rounding for fractional fees

**Coverage:**

- 13 total test cases
- Happy path scenarios (successful payments)
- Error scenarios (insufficient balance, expired escrows)
- Security scenarios (admin-only operations)
- Mock Stellar interactions (no live RPC calls)

**Test Setup:**

- Real Prisma database (via TEST_DATABASE_URL or DATABASE_URL)
- MockStellarServer for blockchain simulation
- DB fixtures for consistent test data
- FK-safe table cleanup before each test

**Usage:**

```bash
# Run payment flow tests only
pnpm test packages/api/src/__tests__/integration/payment-flow.integration.test.ts

# Run with coverage
pnpm test -- --coverage payment-flow.integration.test.ts
```

---

### Issue #1860: Webhook Integration Tests

**File:** `packages/api/src/__tests__/integration/webhook-delivery.integration.test.ts`

Comprehensive integration tests for webhook subscription, signature verification, and delivery tracking.

**Test Suites:**

1. **Subscription Lifecycle** (4 tests)
   - ✅ Create webhook subscription with secret generation
   - ✅ List subscriptions for user (ordered by recency)
   - ✅ Delete subscription (authorized user only)
   - ✅ Prevent unauthorized deletion attempts

2. **Webhook Signature Verification** (6 tests)
   - ✅ Generate deterministic HMAC-SHA256 signatures
   - ✅ Verify valid signatures via timing-safe comparison
   - ✅ Reject tampered payloads (signature mismatch)
   - ✅ Reject signatures with wrong secret
   - ✅ Verify full webhook request with timestamp
   - ✅ Reject stale timestamps beyond tolerance window (e.g., >5 min)

3. **Event Publishing** (4 tests)
   - ✅ Find subscriptions matching event type
   - ✅ Filter out inactive subscriptions
   - ✅ Create webhook logs for published events
   - ✅ Prevent unauthorized log access

4. **Delivery & Retry Logic** (4 tests)
   - ✅ Track delivery attempts (1-3 retries)
   - ✅ Record delivery errors in logs
   - ✅ Update logs on successful delivery
   - ✅ Preserve payload through retry cycles

**Coverage:**

- 18 total test cases
- Happy path (successful subscription & delivery)
- Error scenarios (failed requests, retries)
- Security scenarios (signature tampering, unauthorized access, timing attacks)
- Retry logic with exponential backoff simulation

**Test Setup:**

- Real Prisma database
- WebhookService with dependency injection
- DB fixtures for consistent test data
- Mock HTTP interactions (no external webhook calls)

**Key Security Tests:**

- Timing-safe comparison prevents timing attack vulnerability
- Signature verification prevents payload tampering
- Authorization checks prevent unauthorized access
- Stale timestamp rejection prevents replay attacks

**Usage:**

```bash
# Run webhook tests only
pnpm test packages/api/src/__tests__/integration/webhook-delivery.integration.test.ts

# Run with coverage
pnpm test -- --coverage webhook-delivery.integration.test.ts
```

---

## Technical Stack

| Component       | Technology                 | Version        |
| --------------- | -------------------------- | -------------- |
| Test Framework  | Vitest                     | 3.2.6+         |
| Database        | PostgreSQL + Prisma        | Latest         |
| Blockchain Mock | MockStellarServer (custom) | -              |
| HTTP Mock       | Fetch API mocking          | Node.js native |
| Data Generation | @faker-js/faker            | 8.x+           |
| Crypto          | Node.js crypto module      | Native         |

---

## Files Modified/Created

```
packages/test-utils/src/
├── stellar-sdk-mock.ts       [NEW] 408 lines - Mock Stellar SDK
├── db-fixtures.ts            [NEW] 487 lines - DB fixture factories
└── index.ts                  [MODIFIED] - Export new utilities

packages/api/src/__tests__/integration/
├── payment-flow.integration.test.ts         [NEW] 546 lines
└── webhook-delivery.integration.test.ts     [NEW] 600 lines
```

**Total Lines Added:** 2,641 lines
**Test Cases Added:** 31 new integration tests

---

## Running Tests

### Prerequisites

Ensure `TEST_DATABASE_URL` or `DATABASE_URL` is set in `.env`:

```bash
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/bluecollar_test
```

### Run All Tests

```bash
# Run all integration tests
pnpm test packages/api/src/__tests__/integration/

# Run specific test file
pnpm test payment-flow.integration.test.ts

# Run with coverage
pnpm test -- --coverage
```

### Database Migration

Database schema is automatically applied via Prisma:

```bash
pnpm exec prisma migrate deploy
```

---

## Breaking Changes

None. All additions are backward compatible.

---

## Migration Guide

No migration required. All utilities are opt-in and work alongside existing tests.

**For New Tests:**

```typescript
import {
  createStellarAccount,
  createWebhookSubscription,
  createBooking,
  createEscrowRecord,
} from '@bluecollar/test-utils/db-fixtures';

import {
  createMockStellarClient,
  MockStellarServer,
} from '@bluecollar/test-utils/stellar-sdk-mock';

// Usage in your tests...
```

---

## Reviewers Checklist

- [ ] All 4 issues are properly implemented
- [ ] Integration tests follow existing patterns in `packages/api/src/__tests__/integration/`
- [ ] Mock utilities provide complete Stellar SDK coverage
- [ ] DB fixtures support partial overrides and auto-creation
- [ ] Security tests include timing-safe comparison, tampering detection
- [ ] Database cleanup is FK-safe (dependencies before parents)
- [ ] No external API calls (all mocked)
- [ ] Error scenarios are tested alongside happy paths
- [ ] Authorization checks prevent unauthorized access
- [ ] Tests are deterministic (reproducible results)

---

## Related Issues

- Closes #1857 (Mock Stellar SDK)
- Closes #1858 (DB fixtures/factories)
- Closes #1859 (Payment flow integration tests)
- Closes #1860 (Webhook integration tests)
