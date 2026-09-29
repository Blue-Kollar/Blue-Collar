# Mock Stellar/Soroban RPC Guide

How to write backend tests that touch `packages/api/src/clients/` without
hitting the live Stellar testnet.

---

## Why this exists

`StellarClient` (and the Horizon poller) communicate with an external network
over HTTP.  Tests that reach the real testnet are:

- **Slow** — round-trips to `horizon-testnet.stellar.org` add seconds per test.
- **Flaky** — testnet outages or rate-limits fail the suite unpredictably.
- **Non-deterministic** — live account state changes between runs.

The mock layer solves all three by intercepting `globalThis.fetch` in-process
before any packet leaves the machine.

---

## Two tools, one purpose

| Tool | Lives in | Best for |
|---|---|---|
| `MockStellarRpcServer` | `packages/api/src/clients/mockStellarRpcServer.ts` | Unit / integration tests that import `StellarClient` directly or test services that call it |
| `makeMockHorizonFetch` | `@bluecollar/test-utils/stellar-mocks` | HTTP-stack integration tests (supertest) that only need fetch-level stubbing |

Both intercept `globalThis.fetch`.  Prefer `MockStellarRpcServer` for new tests
— it has richer routing, an intercepted-calls log, and a documented extension
point.  Use `makeMockHorizonFetch` when you are already in a test file that
does `vi.stubGlobal('fetch', ...)` per-test.

---

## Quick-start

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StellarClient } from '../clients/stellar.client.js'
import { MockStellarRpcServer, MOCK_HORIZON_ADDRESS } from '../clients/mockStellarRpcServer.js'

describe('MyService', () => {
  const server = new MockStellarRpcServer()
  const client = new StellarClient('https://mock-horizon.test', 'https://mock-friendbot.test')

  beforeEach(() => {
    server.reset()   // clears call log + restores constructor defaults
    server.install() // stubs globalThis.fetch
  })

  afterEach(() => server.uninstall()) // restores original fetch

  it('reads account balance', async () => {
    const info = await client.getAccountInfo(MOCK_HORIZON_ADDRESS)
    expect(info.balance).toBe(100)          // default fixture value
    expect(server.calls).toHaveLength(1)    // proof: no live network call
  })
})
```

---

## Default fixture values

| Constant | Value | Used by |
|---|---|---|
| `MOCK_HORIZON_ADDRESS` | `GDQP2...W37` | Account info requests |
| `MOCK_HORIZON_TX_HASH` | `abcdef12...90` (64 hex chars) | Broadcast / status responses |
| `MOCK_HORIZON_BALANCE` | `'100.0000000'` | Native XLM balance |
| `MOCK_HORIZON_SEQUENCE`| `'1234567'` | Account sequence number |

All constants are exported from `mockStellarRpcServer.ts` and re-exported by
`@bluecollar/test-utils/stellar-mocks`.

---

## Changing a response for one test

Call `server.setResponse(type, overrides)` after `server.reset()` and before
the call under test.  Changes apply to all subsequent requests in that test.

```ts
it('reflects a high balance', async () => {
  server.setResponse('account', { balance: '9999.0000000', sequence: '42' })

  const info = await client.getAccountInfo(MOCK_HORIZON_ADDRESS)
  expect(info.balance).toBe(9999)
  expect(info.sequence).toBe(BigInt(42))
})

it('handles broadcast failure', async () => {
  // broadcastFails is a constructor flag — use a one-off server instance
  const failServer = new MockStellarRpcServer({ broadcastFails: true })
  failServer.install()

  await expect(client.broadcastTransaction('bad-xdr')).rejects.toMatchObject({ statusCode: 400 })

  failServer.uninstall()
})
```

### Available `setResponse` types

| Type key | Fields | Controls |
|---|---|---|
| `'account'` | `balance`, `sequence`, `extraBalances` | `GET /accounts/:id` |
| `'broadcast'` | `hash`, `id` | `POST /transactions` |
| `'txStatus'` | `successful`, `result_code` | `GET /transactions/:hash` |
| `'friendbot'` | `hash` | `POST <friendbotUrl>` |
| `'txHistory'` | `Array<{ hash, created_at }>` | `GET /accounts/:id/transactions` |

### Constructor error flags

Pass these to the constructor when the entire describe block needs an error
scenario:

| Flag | Effect |
|---|---|
| `accountNotFound: true` | `GET /accounts/:id` → 404 |
| `broadcastFails: true` | `POST /transactions` → 400 `op_underfunded` |
| `txPending: true` | `GET /transactions/:hash` → 404 (pending) |
| `accountServerError: true` | `GET /accounts/:id` → 500 |

---

## Adding a new Horizon endpoint

Follow these steps when `StellarClient` grows a new method that calls an
endpoint not yet handled by the mock.

### Step 1 — Add a response-shape interface

In `mockStellarRpcServer.ts`, add a new interface near the existing ones:

```ts
// Example: a new /offers endpoint
export interface OffersResponse {
  records: Array<{ id: string; amount: string }>
}
```

### Step 2 — Add a default fixture field

In the `MockStellarRpcServer` class, add a private field and initialise it
in the constructor:

```ts
private offersOpts: OffersResponse = { records: [] }
```

### Step 3 — Add a `setResponse` overload

Extend the overloaded signature and the `switch` statement:

```ts
setResponse(type: 'offers', value: OffersResponse): void
// ...existing overloads...

// inside the switch:
case 'offers':
  this.offersOpts = value as OffersResponse
  break
```

### Step 4 — Add routing in `_route`

Add a URL match before the catch-all fallback:

```ts
// GET /accounts/:id/offers
if (method === 'GET' && url.includes('/offers')) {
  return this._json({ _embedded: { records: this.offersOpts.records } }, 200)
}
```

### Step 5 — Export the constant (optional)

If the new endpoint has a stable fixture value tests will assert against,
export it as a named constant at the top of the file:

```ts
export const MOCK_OFFERS_RECORD = { id: 'offer-1', amount: '50.0' }
```

### Step 6 — Write the test

```ts
it('returns offer list', async () => {
  server.setResponse('offers', { records: [{ id: 'offer-1', amount: '50.0' }] })
  const offers = await client.getOffers(MOCK_HORIZON_ADDRESS)
  expect(offers).toHaveLength(1)
})
```

---

## Adding a Soroban RPC call

Soroban contract invocations go through `makeSorobanRpcMock` in
`@bluecollar/test-utils/stellar-mocks`.  Steps:

1. Add the new method signature to `MockSorobanRpcOptions`.
2. Wire the method in the `SorobanRpc.Server` mock factory inside
   `makeSorobanRpcMock`.
3. Use it in the test file:

```ts
vi.mock('@stellar/stellar-sdk', () =>
  makeSorobanRpcMock({ simulateResult: { jobId: 'job-42', workerPubkey: MOCK_HORIZON_ADDRESS } }),
)
```

---

## Using `customHandler` for mixed HTTP scenarios

Some tests (like `onchain-sync.integration.test.ts`) need to mock Horizon
contract-events endpoints **and** a third-party webhook receiver in the same
fetch stub.  Use the `customHandler` escape hatch:

```ts
const server = new MockStellarRpcServer({
  customHandler: (url, method) => {
    if (url.includes('/contracts/CREGISTRY.../events')) {
      return new Response(JSON.stringify({ _embedded: { records: [myEvent] } }), { status: 200 })
    }
    if (url === 'https://partner.example.com/webhook') {
      return new Response('{}', { status: 200 })
    }
    return null // fall through to built-in routing for everything else
  },
})
server.install()
```

Returning `null` hands the request back to the built-in router, so standard
Horizon endpoints (`/accounts/:id`, `/transactions`, etc.) keep working without
extra configuration.

---

## Asserting no live network calls

`server.calls` accumulates every URL the mock intercepted.  Use it as a
lightweight assertion that no request escaped to the real network:

```ts
const liveNetworkCalls = server.calls.filter(
  (c) => c.url.includes('stellar.org') || c.url.includes('horizon-testnet'),
)
expect(liveNetworkCalls).toHaveLength(0)
```

The global `HORIZON_URL` guard in `src/__tests__/setup.ts` provides a
safety-net at the environment level: it points `HORIZON_URL` at
`http://127.0.0.1:0` (a port that is always refused) when no value is set, so
any test that forgets to install a mock fails with a clear connection error
rather than silently hitting testnet.

---

## Checklist for new Stellar-touching tests

- [ ] Import `MockStellarRpcServer` (or `makeMockHorizonFetch` for simpler
      HTTP-only tests).
- [ ] Call `server.install()` in `beforeEach` and `server.uninstall()` in
      `afterEach`.
- [ ] Call `server.reset()` at the top of `beforeEach` when using
      per-test `setResponse` overrides.
- [ ] Assert `server.calls` to confirm all requests were intercepted.
- [ ] Do **not** set `HORIZON_URL` to a real testnet URL in tests — the
      setup guard enforces this by default.
