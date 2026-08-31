/**
 * Integration tests for the on-chain sync path — issue #1162.
 *
 * Covers: horizon-poller.service.ts → indexer.service.ts → webhook.service.ts
 *
 * A live Horizon/Soroban dependency makes true E2E impractical (per #1162's
 * acceptance criteria), so this is a documented integration test instead: the
 * database is mocked (same convention as admin.integration.test.ts /
 * search.integration.test.ts) and global `fetch` is stubbed with a realistic
 * Horizon `/contracts/:id/events` response plus a mocked webhook subscriber
 * endpoint. This exercises the real, unmocked service code — cursor lookup,
 * ledger/txIndex/eventIndex parsing from the paging token, idempotent event
 * upsert, topic → webhook-event mapping, and signed webhook delivery — and
 * asserts that a single on-chain event correctly updates API-side state:
 * the indexed ContractEvent row, the advanced EventIndexerCursor, and a
 * delivered + HMAC-signed WebhookLog entry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Env (read at module-load time by horizon-poller.service.ts) ─────────────
process.env.REGISTRY_CONTRACT_ID = 'CREGISTRYCONTRACTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
process.env.MARKET_CONTRACT_ID = 'CMARKETCONTRACTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org'

const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID
const MARKET_CONTRACT_ID = process.env.MARKET_CONTRACT_ID

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({
  db: {
    eventIndexerCursor: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    contractEvent: { upsert: vi.fn() },
    webhookSubscription: { findMany: vi.fn() },
    webhookLog: { create: vi.fn(), update: vi.fn() },
  },
}))

// ─── Imports (after mocks/env) ─────────────────────────────────────────────────

import { db } from '../../db.js'
import { startHorizonPoller, stopHorizonPoller } from '../../services/horizon-poller.service.js'
import { verifySignature } from '../../services/webhook.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SUBSCRIBER = {
  id: 'sub-1',
  userId: 'curator-1',
  url: 'https://partner.example.com/webhook',
  secret: 'whsec_test_integration_secret_0123456789',
  events: ['worker.registered'],
  isActive: true,
}

function makeCursor(contractId: string, ledger = BigInt(0), txIndex = 0) {
  return { id: `cursor-${contractId}`, contractId, ledger, txIndex, updatedAt: new Date() }
}

/** A realistic Horizon `/contracts/:id/events` record for a `register` topic. */
function registerEventRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'horizon-event-1',
    type: 'contract',
    contract_id: REGISTRY_CONTRACT_ID,
    topic: ['register'],
    value: { owner: 'GABCXYZ0000000000000000000000000000000000000000000000', workerId: 'onchain-worker-1' },
    paging_token: '12345-1-0',
    ledger_close_time: '2026-08-22T00:00:00Z',
    ...overrides,
  }
}

function horizonEventsResponse(records: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ _embedded: { records } }) }
}

/** Stubs global fetch: Horizon events endpoints (by contract) + the webhook subscriber URL. */
type FetchOpts = { method?: string; headers?: Record<string, string>; body?: string }

function installFetchStub(registryRecords: unknown[]) {
  const fetchMock = vi.fn(async (url: unknown, _opts?: FetchOpts) => {
    const href = String(url)
    if (href.includes(`/contracts/${REGISTRY_CONTRACT_ID}/events`)) return horizonEventsResponse(registryRecords)
    if (href.includes(`/contracts/${MARKET_CONTRACT_ID}/events`)) return horizonEventsResponse([])
    if (href === SUBSCRIBER.url) return { ok: true, status: 200, json: async () => ({}) }
    throw new Error(`Unexpected fetch call in test: ${href}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function waitUntil(check: () => boolean, timeoutMs = 2000, intervalMs = 20) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition was not met in time')
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

function resetDbMocks() {
  vi.mocked(db.eventIndexerCursor.upsert).mockImplementation(async ({ where }: any) => makeCursor(where.contractId))
  vi.mocked(db.eventIndexerCursor.findUnique).mockImplementation(async ({ where }: any) => makeCursor(where.contractId))
  vi.mocked(db.eventIndexerCursor.update).mockImplementation(async ({ where, data }: any) => ({
    ...makeCursor(where.contractId),
    ...data,
  }))
  vi.mocked(db.contractEvent.upsert).mockResolvedValue({ id: 'evt-1' } as any)
  vi.mocked(db.webhookSubscription.findMany).mockResolvedValue([SUBSCRIBER] as any)
  vi.mocked(db.webhookLog.create).mockResolvedValue({ id: 'log-1' } as any)
  vi.mocked(db.webhookLog.update).mockResolvedValue({} as any)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('On-chain sync: Horizon poller → indexer → webhook (mocked Horizon event stream)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbMocks()
  })

  afterEach(() => {
    stopHorizonPoller()
    vi.unstubAllGlobals()
  })

  it('ingests a Horizon contract event, advances the cursor, and delivers a signed webhook', async () => {
    const fetchMock = installFetchStub([registerEventRecord()])

    startHorizonPoller()
    await waitUntil(() => vi.mocked(db.webhookLog.update).mock.calls.length > 0)

    // Both configured contracts are polled every cycle.
    expect(db.eventIndexerCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contractId: REGISTRY_CONTRACT_ID } }),
    )
    expect(db.eventIndexerCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contractId: MARKET_CONTRACT_ID } }),
    )

    // Indexer: event persisted idempotently, keyed by (contractId, ledger, txIndex, eventIndex)
    // parsed from the Horizon paging token "12345-1-0".
    expect(db.contractEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contractId_ledger_txIndex_eventIndex: {
            contractId: REGISTRY_CONTRACT_ID,
            ledger: BigInt(12345),
            txIndex: 1,
            eventIndex: 0,
          },
        },
        create: expect.objectContaining({
          eventName: 'register',
          ledger: BigInt(12345),
          txIndex: 1,
          eventIndex: 0,
          indexed: { topic: ['register'] },
          data: registerEventRecord().value,
        }),
      }),
    )

    // Cursor advances past the processed event for the registry contract only
    // (the market contract saw zero records this cycle).
    expect(db.eventIndexerCursor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contractId: REGISTRY_CONTRACT_ID },
        data: expect.objectContaining({ ledger: BigInt(12345), txIndex: 1 }),
      }),
    )
    expect(db.eventIndexerCursor.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { contractId: MARKET_CONTRACT_ID } }),
    )

    // Webhook fan-out: the `register` topic maps to `worker.registered`, so only
    // subscriptions for that event are queried and notified.
    expect(db.webhookSubscription.findMany).toHaveBeenCalledWith({
      where: { isActive: true, events: { has: 'worker.registered' } },
    })
    expect(db.webhookLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionId: SUBSCRIBER.id, event: 'worker.registered' }) }),
    )

    // Delivery: the signed payload actually reaches the subscriber URL, and the
    // signature verifies against the subscription's own secret.
    const deliveryCall = fetchMock.mock.calls.find(([url]) => url === SUBSCRIBER.url)
    expect(deliveryCall).toBeDefined()
    const deliveryOpts = deliveryCall![1]!
    const signature = deliveryOpts.headers!['X-BlueCollar-Signature']
    expect(verifySignature(SUBSCRIBER.secret, deliveryOpts.body!, signature)).toBe(true)
    expect(JSON.parse(deliveryOpts.body!)).toMatchObject({ contractId: REGISTRY_CONTRACT_ID, topic: ['register'] })

    // Delivery outcome is recorded back onto the log — proving the full
    // on-chain-event → API-state loop closes.
    expect(db.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
        data: expect.objectContaining({ statusCode: 200, success: true }),
      }),
    )
  })

  it('does not fan out a webhook when no subscription is registered for the mapped event', async () => {
    vi.mocked(db.webhookSubscription.findMany).mockResolvedValue([])
    installFetchStub([registerEventRecord()])

    startHorizonPoller()
    await waitUntil(() => vi.mocked(db.webhookSubscription.findMany).mock.calls.length > 0)
    await new Promise((resolve) => setTimeout(resolve, 100)) // let any stray delivery attempt surface

    expect(db.contractEvent.upsert).toHaveBeenCalled() // raw event is still indexed
    expect(db.webhookLog.create).not.toHaveBeenCalled()
  })

  it('indexes an event with an unmapped topic without publishing a webhook', async () => {
    // 'unrecognized_event' has no mapping in resolveEventName for either contract.
    installFetchStub([registerEventRecord({ topic: ['unrecognized_event'], paging_token: '12346-0-0' })])

    startHorizonPoller()
    await waitUntil(() => vi.mocked(db.contractEvent.upsert).mock.calls.length > 0)
    await new Promise((resolve) => setTimeout(resolve, 100)) // let any stray delivery attempt surface

    expect(db.contractEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ eventName: 'unrecognized_event' }) }),
    )
    expect(db.webhookSubscription.findMany).not.toHaveBeenCalled()
    expect(db.webhookLog.create).not.toHaveBeenCalled()
  })
})
