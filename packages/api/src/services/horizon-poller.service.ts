/**
 * Horizon Poller — background job that polls Stellar Horizon for contract events
 * and dispatches them to registered webhook subscribers and the event indexer.
 *
 * Polls every POLL_INTERVAL_MS (default 30s). Uses database cursor to track
 * last processed ledger/transaction so restarts are safe and no events are missed.
 */
import { logger } from '../config/logger.js'
import { publishEvent } from './webhook.service.js'
import * as indexerService from './indexer.service.js'
import { stellarRpcClient } from './stellar-rpc.client.js'

const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID ?? ''
const MARKET_CONTRACT_ID = process.env.MARKET_CONTRACT_ID ?? ''
const POLL_INTERVAL_MS = 30_000

let pollTimer: ReturnType<typeof setTimeout> | null = null

/** Map Horizon contract event topics to internal event names */
function resolveEventName(contractId: string, topic: string): string | null {
  if (contractId === REGISTRY_CONTRACT_ID) {
    if (topic === 'register') return 'worker.registered'
    if (topic === 'toggle') return 'worker.toggled'
  }
  if (contractId === MARKET_CONTRACT_ID) {
    if (topic === 'tip') return 'tip.sent'
  }
  return null
}

async function fetchContractEvents(contractId: string): Promise<void> {
  if (!contractId) return

  try {
    // Get cursor from database
    const cursor = await indexerService.getOrCreateCursor(contractId)

    const records = await stellarRpcClient.getContractEvents(
      contractId,
      cursor.ledger > 0 ? cursor.ledger : undefined,
    )
    let lastLedger = cursor.ledger
    let lastTxIndex = cursor.txIndex

    for (const record of records) {
      try {
        // Extract ledger info from paging token (format: ledger-txindex-eventindex)
        const parts = record.paging_token.split('-')
        const ledger = BigInt(parts[0] || cursor.ledger)
        const txIndex = parseInt(parts[1] || '0')
        const eventIndex = parseInt(parts[2] || '0')

        // Ingest event into database
        const topic = record.topic?.[0] ?? ''
        await indexerService.ingestContractEvent({
          contractId: record.contract_id,
          eventName: topic,
          ledger,
          txIndex,
          eventIndex,
          indexed: { topic: record.topic },
          data: record.value as Record<string, unknown>,
        })

        // Publish to webhooks
        const eventName = resolveEventName(record.contract_id, topic)
        if (eventName) {
          await publishEvent(eventName, {
            contractId: record.contract_id,
            topic: record.topic,
            value: record.value,
            eventId: record.id,
          }).catch((err) =>
            logger.error({ err, eventName }, 'Failed to publish webhook event'),
          )
        }

        lastLedger = ledger
        lastTxIndex = txIndex
      } catch (err) {
        logger.error({ err, record }, 'Failed to process event')
      }
    }

    // Update cursor if we processed events
    if (records.length > 0) {
      await indexerService.updateCursor(contractId, lastLedger, lastTxIndex)
    }
  } catch (err) {
    logger.error({ err, contractId }, 'Horizon fetch error for contract')
  }
}

async function poll(): Promise<void> {
  try {
    await Promise.all([
      fetchContractEvents(REGISTRY_CONTRACT_ID),
      fetchContractEvents(MARKET_CONTRACT_ID),
    ])
  } catch (err) {
    logger.warn({ err }, 'Horizon poll cycle error')
  } finally {
    pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
  }
}

/** Start the Horizon polling background job */
export function startHorizonPoller(): void {
  if (!REGISTRY_CONTRACT_ID && !MARKET_CONTRACT_ID) {
    logger.info(
      'Horizon poller skipped — no contract IDs configured (REGISTRY_CONTRACT_ID / MARKET_CONTRACT_ID)',
    )
    return
  }
  logger.info({ REGISTRY_CONTRACT_ID, MARKET_CONTRACT_ID }, 'Starting Horizon poller')
  pollTimer = setTimeout(poll, 0)
}

/** Stop the Horizon polling background job (useful in tests) */
export function stopHorizonPoller(): void {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}
