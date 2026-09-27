import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'
import { Gauge, Counter, Histogram } from 'prom-client'

// ── Prometheus metrics ────────────────────────────────────────────────────────

const lagGauge = new Gauge({
  name: 'indexer_lag_ledgers',
  help: 'Ledgers the indexer cursor is behind the chain head',
  labelNames: ['contractId'],
})

const batchIngestCounter = new Counter({
  name: 'indexer_batch_ingest_events_total',
  help: 'Total events ingested via batch operations',
  labelNames: ['contractId'],
})

const coldStartHistogram = new Histogram({
  name: 'indexer_cold_start_duration_ms',
  help: 'Milliseconds taken to catch up from a cold start',
  buckets: [500, 1000, 5000, 10_000, 30_000, 60_000, 120_000],
})

// Backpressure: pause ingestion when the indexer falls this many ledgers behind
const MAX_LAG_BACKPRESSURE = BigInt(500)

interface ContractEventData {
  contractId: string
  eventName: string
  ledger: bigint
  txIndex: number
  eventIndex: number
  indexed: Record<string, unknown>
  data?: Record<string, unknown>
}

/**
 * Ingest a contract event idempotently.
 * Uses unique constraint on (contractId, ledger, txIndex, eventIndex) to prevent duplicates.
 */
export async function ingestContractEvent(event: ContractEventData) {
  return db.contractEvent.upsert({
    where: {
      contractId_ledger_txIndex_eventIndex: {
        contractId: event.contractId,
        ledger: event.ledger,
        txIndex: event.txIndex,
        eventIndex: event.eventIndex,
      },
    },
    update: {
      processedAt: new Date(),
    },
    create: {
      contractId: event.contractId,
      eventName: event.eventName,
      ledger: event.ledger,
      txIndex: event.txIndex,
      eventIndex: event.eventIndex,
      indexed: event.indexed,
      data: event.data,
    },
  })
}

/**
 * Get or create the indexer cursor for a contract.
 * Tracks the last ledger/txIndex processed to enable safe restarts.
 */
export async function getOrCreateCursor(contractId: string) {
  return db.eventIndexerCursor.upsert({
    where: { contractId },
    update: {},
    create: {
      contractId,
      ledger: BigInt(0),
      txIndex: 0,
    },
  })
}

/**
 * Update the indexer cursor after processing events.
 * Only updates if the new cursor is ahead of the current one.
 */
export async function updateCursor(
  contractId: string,
  ledger: bigint,
  txIndex: number,
) {
  const current = await db.eventIndexerCursor.findUnique({
    where: { contractId },
  })

  if (!current) {
    throw new AppError('Cursor not found for contract', 404)
  }

  // Only update if we're moving forward
  if (ledger > current.ledger || (ledger === current.ledger && txIndex > current.txIndex)) {
    return db.eventIndexerCursor.update({
      where: { contractId },
      data: {
        ledger,
        txIndex,
        updatedAt: new Date(),
      },
    })
  }

  return current
}

/**
 * Query indexed events by contract and event name.
 * Supports pagination for fast REST API responses.
 */
export async function queryEvents(
  contractId: string,
  eventName?: string,
  limit = 50,
  offset = 0,
) {
  const where: { contractId: string; eventName?: string } = { contractId }
  if (eventName) where.eventName = eventName

  const [events, total] = await Promise.all([
    db.contractEvent.findMany({
      where,
      orderBy: { ledger: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.contractEvent.count({ where }),
  ])

  return { events, total, limit, offset }
}

/**
 * Get worker registration events by owner address.
 */
export async function getWorkerRegistrationEvents(
  contractId: string,
  ownerAddress: string,
) {
  return db.contractEvent.findMany({
    where: {
      contractId,
      eventName: 'WrkReg',
      indexed: {
        path: ['owner'],
        equals: ownerAddress,
      },
    },
    orderBy: { ledger: 'desc' },
  })
}

/**
 * Reconcile events on startup: scan for gaps and update cursor if needed.
 * Called after restart to ensure no events are missed.
 */
export async function reconcileEvents(contractId: string) {
  const cursor = await getOrCreateCursor(contractId)

  // Find the last ingested event
  const lastEvent = await db.contractEvent.findFirst({
    where: { contractId },
    orderBy: { ledger: 'desc' },
  })

  if (lastEvent && lastEvent.ledger > cursor.ledger) {
    await updateCursor(contractId, lastEvent.ledger, lastEvent.txIndex)
  }

  return cursor
}

/**
 * Clean up old events beyond retention period (for storage optimization).
 * Keeps events for the last N days (default: 90 days).
 */
export async function cleanupOldEvents(contractId: string, retentionDays = 90) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  return db.contractEvent.deleteMany({
    where: {
      contractId,
      createdAt: { lt: cutoffDate },
    },
  })
}

// ── Batch ingestion ───────────────────────────────────────────────────────────

/**
 * Ingest a batch of contract events in a single round-trip.
 * Uses createMany with skipDuplicates so this is idempotent — re-feeding
 * already-indexed events is safe.  Returns the number of net-new rows written.
 */
export async function ingestBatch(events: ContractEventData[]): Promise<number> {
  if (events.length === 0) return 0

  const result = await db.contractEvent.createMany({
    data: events.map((e) => ({
      contractId: e.contractId,
      eventName: e.eventName,
      ledger: e.ledger,
      txIndex: e.txIndex,
      eventIndex: e.eventIndex,
      indexed: e.indexed,
      data: e.data ?? {},
    })),
    skipDuplicates: true,
  })

  batchIngestCounter.labels(events[0]?.contractId ?? 'unknown').inc(result.count)
  return result.count
}

// ── Lag metrics & backpressure ────────────────────────────────────────────────

/**
 * Compute how many ledgers the indexer is behind the given chain-head ledger.
 * Updates the Prometheus lag gauge so dashboards/alerts stay current.
 */
export async function getIndexerLag(
  contractId: string,
  chainHeadLedger: bigint,
): Promise<bigint> {
  const cursor = await db.eventIndexerCursor.findUnique({ where: { contractId } })
  const cursorLedger = cursor?.ledger ?? BigInt(0)
  const lag = chainHeadLedger > cursorLedger ? chainHeadLedger - cursorLedger : BigInt(0)
  lagGauge.labels(contractId).set(Number(lag))
  return lag
}

/**
 * Returns true when the indexer is so far behind that the caller (horizon
 * poller) should pause polling and let the indexer drain its backlog.
 * Threshold is MAX_LAG_BACKPRESSURE ledgers.
 */
export function isBackpressureActive(lag: bigint): boolean {
  return lag > MAX_LAG_BACKPRESSURE
}

// ── Cold-start benchmark ──────────────────────────────────────────────────────

/**
 * Record how long a cold-start catch-up took in milliseconds.
 * Call this after the catch-up loop finishes so the histogram populates.
 *
 * Example usage in the horizon poller:
 *   const t0 = Date.now()
 *   await runCatchUp(contractId)
 *   recordColdStartDuration(Date.now() - t0)
 */
export function recordColdStartDuration(ms: number): void {
  coldStartHistogram.observe(ms)
}
