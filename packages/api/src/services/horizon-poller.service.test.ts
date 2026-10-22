/**
 * horizon-poller.service.test.ts — unit tests for the Horizon poller (#1584).
 *
 * Covers:
 *  - cursor-driven fetching from the RPC client
 *  - event ingestion, webhook dispatch and cursor advancement
 *  - error logging when the RPC fetch or a single event fails
 *  - start/stop scheduling of the polling loop (fake timers, no network)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  process.env.REGISTRY_CONTRACT_ID = 'CREGISTRY';
  process.env.MARKET_CONTRACT_ID = 'CMARKET';
});

vi.mock('@/config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./webhook.service.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./indexer.service.js', () => ({
  getOrCreateCursor: vi.fn(),
  ingestContractEvent: vi.fn().mockResolvedValue(undefined),
  updateCursor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./stellar-rpc.client.js', () => ({
  stellarRpcClient: { getContractEvents: vi.fn() },
}));

import { logger } from '@/config/logger.js';
import { publishEvent } from './webhook.service.js';
import * as indexerService from './indexer.service.js';
import { stellarRpcClient } from './stellar-rpc.client.js';
import {
  fetchContractEvents,
  startHorizonPoller,
  stopHorizonPoller,
} from './horizon-poller.service.js';

const REGISTRY = 'CREGISTRY';

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    paging_token: '100-2-0',
    contract_id: REGISTRY,
    topic: ['register'],
    value: { worker: 'w1' },
    ...overrides,
  };
}

beforeEach(() => {
  // resetAllMocks also drains queued mockResolvedValueOnce values left by earlier tests
  vi.resetAllMocks();
  vi.mocked(indexerService.getOrCreateCursor).mockResolvedValue({ ledger: 0, txIndex: 0 } as any);
  vi.mocked(indexerService.ingestContractEvent).mockResolvedValue(undefined);
  vi.mocked(indexerService.updateCursor).mockResolvedValue(undefined);
  vi.mocked(publishEvent).mockResolvedValue(undefined);
  vi.mocked(stellarRpcClient.getContractEvents).mockResolvedValue([]);
});

describe('fetchContractEvents', () => {
  it('does nothing when the contract id is empty', async () => {
    await fetchContractEvents('');

    expect(indexerService.getOrCreateCursor).not.toHaveBeenCalled();
    expect(stellarRpcClient.getContractEvents).not.toHaveBeenCalled();
  });

  it('omits the ledger cursor when none has been stored yet', async () => {
    await fetchContractEvents(REGISTRY);

    expect(stellarRpcClient.getContractEvents).toHaveBeenCalledWith(REGISTRY, undefined);
  });

  it('resumes from the stored ledger cursor', async () => {
    vi.mocked(indexerService.getOrCreateCursor).mockResolvedValueOnce({
      ledger: 500,
      txIndex: 3,
    } as any);

    await fetchContractEvents(REGISTRY);

    expect(stellarRpcClient.getContractEvents).toHaveBeenCalledWith(REGISTRY, 500);
  });

  it('ingests each record and maps known topics to webhook events', async () => {
    vi.mocked(stellarRpcClient.getContractEvents).mockResolvedValueOnce([makeRecord()]);

    await fetchContractEvents(REGISTRY);

    expect(indexerService.ingestContractEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: REGISTRY,
        eventName: 'register',
        ledger: 100n,
        txIndex: 2,
      }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      'worker.registered',
      expect.objectContaining({ contractId: REGISTRY, eventId: 'evt-1' }),
    );
  });

  it('does not publish a webhook for unmapped topics', async () => {
    vi.mocked(stellarRpcClient.getContractEvents).mockResolvedValueOnce([
      makeRecord({ topic: ['unknown'] }),
    ]);

    await fetchContractEvents(REGISTRY);

    expect(indexerService.ingestContractEvent).toHaveBeenCalledTimes(1);
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it('advances the cursor to the last processed ledger and tx index', async () => {
    vi.mocked(stellarRpcClient.getContractEvents).mockResolvedValueOnce([
      makeRecord({ id: 'a', paging_token: '100-1-0' }),
      makeRecord({ id: 'b', paging_token: '101-4-0' }),
    ]);

    await fetchContractEvents(REGISTRY);

    expect(indexerService.updateCursor).toHaveBeenCalledWith(REGISTRY, 101n, 4);
  });

  it('leaves the cursor untouched when there are no new records', async () => {
    await fetchContractEvents(REGISTRY);

    expect(indexerService.updateCursor).not.toHaveBeenCalled();
  });

  it('logs and swallows an RPC failure without updating the cursor', async () => {
    vi.mocked(stellarRpcClient.getContractEvents).mockRejectedValueOnce(new Error('rpc down'));

    await expect(fetchContractEvents(REGISTRY)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: REGISTRY }),
      'Horizon fetch error for contract',
    );
    expect(indexerService.updateCursor).not.toHaveBeenCalled();
  });

  it('keeps processing remaining records when one ingestion fails', async () => {
    vi.mocked(stellarRpcClient.getContractEvents).mockResolvedValueOnce([
      makeRecord({ id: 'bad', paging_token: '100-0-0' }),
      makeRecord({ id: 'good', paging_token: '101-0-0' }),
    ]);
    vi.mocked(indexerService.ingestContractEvent)
      .mockRejectedValueOnce(new Error('db write failed'))
      .mockResolvedValueOnce(undefined);

    await fetchContractEvents(REGISTRY);

    expect(indexerService.ingestContractEvent).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(expect.anything(), 'Failed to process event');
    expect(indexerService.updateCursor).toHaveBeenCalledWith(REGISTRY, 101n, 0);
  });

  it('logs a webhook delivery failure but still advances the cursor', async () => {
    vi.mocked(stellarRpcClient.getContractEvents).mockResolvedValueOnce([makeRecord()]);
    vi.mocked(publishEvent).mockRejectedValueOnce(new Error('webhook timeout'));

    await fetchContractEvents(REGISTRY);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'worker.registered' }),
      'Failed to publish webhook event',
    );
    expect(indexerService.updateCursor).toHaveBeenCalledWith(REGISTRY, 100n, 2);
  });
});

describe('polling lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopHorizonPoller();
    vi.useRealTimers();
  });

  it('polls both configured contracts immediately and then every 30 seconds', async () => {
    startHorizonPoller();

    await vi.advanceTimersByTimeAsync(0);
    expect(stellarRpcClient.getContractEvents).toHaveBeenCalledWith('CREGISTRY', undefined);
    expect(stellarRpcClient.getContractEvents).toHaveBeenCalledWith('CMARKET', undefined);

    vi.mocked(stellarRpcClient.getContractEvents).mockClear();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(stellarRpcClient.getContractEvents).toHaveBeenCalledTimes(2);
  });

  it('stops scheduling new polls after stopHorizonPoller', async () => {
    startHorizonPoller();
    await vi.advanceTimersByTimeAsync(0);
    stopHorizonPoller();

    vi.mocked(stellarRpcClient.getContractEvents).mockClear();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(stellarRpcClient.getContractEvents).not.toHaveBeenCalled();
  });
});
