import { describe, expect, it, vi } from 'vitest';
import {
  DbIsolation,
  ISOLATION_TABLES,
  makeAdvisoryLockKey,
  makeWorkerTag,
  resetDatabase,
  resolveWorkerId,
  type IsolationClient,
} from './db-isolation.js';

interface MockState {
  client: IsolationClient;
  calls: string[];
  options: Array<{ maxWait?: number; timeout?: number } | undefined>;
  sql: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  lastTx: IsolationClient | undefined;
  baseFind: ReturnType<typeof vi.fn>;
  txFind: ReturnType<typeof vi.fn>;
  baseDisconnect: ReturnType<typeof vi.fn>;
}

function createMockClient(
  options: { tables?: readonly string[]; failOnBegin?: boolean } = {},
): MockState {
  const tables = options.tables ?? ISOLATION_TABLES;
  const calls: string[] = [];
  const transactionOptions: Array<{ maxWait?: number; timeout?: number } | undefined> = [];
  const baseFind = vi.fn(async () => 'base');
  const txFind = vi.fn(async () => 'tx');
  const baseDisconnect = vi.fn(async () => undefined);

  const sql = vi.fn(async (command: string) => {
    calls.push(command);
    return 0;
  });
  const query = vi.fn(async (command: string) => {
    calls.push(command);
    return tables.map((table_name) => ({ table_name }));
  });

  const state: MockState = {
    calls,
    options: transactionOptions,
    sql,
    query,
    lastTx: undefined,
    baseFind,
    txFind,
    baseDisconnect,
    client: undefined as unknown as IsolationClient,
  };

  const makeTx = (): IsolationClient =>
    ({
      $executeRawUnsafe: sql,
      $queryRawUnsafe: query,
      $transaction: async () => {
        throw new Error('nested raw transaction on tx client');
      },
      user: { findMany: txFind },
    }) as unknown as IsolationClient;

  state.client = {
    $executeRawUnsafe: sql,
    $queryRawUnsafe: query,
    $transaction: async (
      fn: (tx: IsolationClient) => Promise<unknown>,
      transactionOption?: { maxWait?: number; timeout?: number },
    ) => {
      calls.push('BEGIN');
      transactionOptions.push(transactionOption);
      if (options.failOnBegin) {
        calls.push('ROLLBACK');
        throw new Error('connection failed');
      }
      const tx = makeTx();
      state.lastTx = tx;
      try {
        const result = await fn(tx);
        calls.push('COMMIT');
        return result;
      } catch (error) {
        calls.push('ROLLBACK');
        throw error;
      }
    },
    user: { findMany: baseFind },
    $disconnect: baseDisconnect,
  } as unknown as IsolationClient;

  return state;
}

describe('resetDatabase', () => {
  it('covers every Prisma model exactly once', () => {
    expect(ISOLATION_TABLES).toHaveLength(41);
    expect(new Set(ISOLATION_TABLES).size).toBe(ISOLATION_TABLES.length);
  });

  it('locks first, then truncates every known table in deterministic order', async () => {
    const state = createMockClient();
    const result = await resetDatabase(state.client, { lockKey: 1234 });

    expect(result.lockKey).toBe(1234);
    expect(result.tables).toEqual([...ISOLATION_TABLES]);
    expect(state.calls[0]).toBe('BEGIN');
    expect(state.calls[1]).toContain('pg_advisory_xact_lock(1234)');
    expect(state.calls[2]).toContain('information_schema.tables');
    expect(state.calls[3]).toBe(
      `TRUNCATE TABLE ${ISOLATION_TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
    expect(state.calls[4]).toBe('COMMIT');
  });

  it('resets only tables that currently exist', async () => {
    const state = createMockClient({ tables: ['Unknown', 'Location', 'User'] });
    const result = await resetDatabase(state.client);

    expect(result.tables).toEqual(['User', 'Location']);
    expect(state.calls.find((call) => call.startsWith('TRUNCATE'))).toBe(
      'TRUNCATE TABLE "User", "Location" RESTART IDENTITY CASCADE',
    );
  });

  it('skips TRUNCATE when no known table exists', async () => {
    const state = createMockClient({ tables: [] });
    const result = await resetDatabase(state.client);

    expect(result.tables).toEqual([]);
    expect(state.calls.some((call) => call.startsWith('TRUNCATE'))).toBe(false);
  });

  it('passes transaction options through to the client', async () => {
    const state = createMockClient();
    await resetDatabase(state.client, { maxWait: 100, timeout: 200 });

    expect(state.options[0]).toEqual({ maxWait: 100, timeout: 200 });
  });
});

describe('DbIsolation per-test transaction', () => {
  it('routes reads to the tx client during a test and to the base client outside', async () => {
    const state = createMockClient();
    const isolation = new DbIsolation(state.client, { workerId: '1' });
    const db = isolation.createRoutingClient({
      user: { findMany: state.baseFind },
      $disconnect: state.baseDisconnect,
    });

    expect(await db.user.findMany()).toBe('base');
    await isolation.beginTest();
    expect(isolation.isActive).toBe(true);
    expect(state.calls[0]).toBe('BEGIN');
    expect(await db.user.findMany()).toBe('tx');
    expect(state.txFind).toHaveBeenCalledTimes(1);
    expect(state.baseFind).toHaveBeenCalledTimes(1);

    await db.$disconnect();
    expect(state.baseDisconnect).toHaveBeenCalledTimes(1);

    await isolation.endTest();
    expect(isolation.isActive).toBe(false);
    expect(await db.user.findMany()).toBe('base');
  });

  it('always rolls back and never commits the test transaction', async () => {
    const state = createMockClient();
    const isolation = new DbIsolation(state.client, { workerId: '1' });
    await isolation.beginTest();
    await isolation.endTest();

    expect(state.calls).toContain('ROLLBACK');
    expect(state.calls).not.toContain('COMMIT');
  });

  it('rolls back even when the test itself fails', async () => {
    const state = createMockClient();
    const isolation = new DbIsolation(state.client, { workerId: '1' });
    await isolation.beginTest();

    const failure = new Error('test failed');
    await expect(
      (async () => {
        throw failure;
      })(),
    ).rejects.toBe(failure);
    await isolation.endTest();

    expect(state.calls).toContain('ROLLBACK');
  });

  it('propagates a failure to open the transaction', async () => {
    const state = createMockClient({ failOnBegin: true });
    const isolation = new DbIsolation(state.client, { workerId: '1' });

    await expect(isolation.beginTest()).rejects.toThrow('connection failed');
    expect(isolation.isActive).toBe(false);
    await expect(isolation.endTest()).resolves.toBeUndefined();
  });

  it('guards against nested beginTest and makes redundant endTest safe', async () => {
    const state = createMockClient();
    const isolation = new DbIsolation(state.client, { workerId: '1' });

    await expect(isolation.endTest()).resolves.toBeUndefined();
    await isolation.beginTest();
    await expect(isolation.beginTest()).rejects.toThrow('already active');
    await isolation.endTest();
    expect(state.calls.filter((call) => call === 'ROLLBACK')).toHaveLength(1);
  });
});

describe('DbIsolation nested transactions (savepoints)', () => {
  it('uses SAVEPOINT/RELEASE on success', async () => {
    const state = createMockClient();
    const isolation = new DbIsolation(state.client, { workerId: 'w1' });
    const db = isolation.createRoutingClient(state.client);
    await isolation.beginTest();

    await expect(db.$transaction(async () => 'ok')).resolves.toBe('ok');
    expect(state.sql).toHaveBeenCalledWith('SAVEPOINT sp_w1_1');
    expect(state.sql).toHaveBeenCalledWith('RELEASE SAVEPOINT sp_w1_1');
    expect(state.calls).not.toContain('COMMIT');

    await isolation.endTest();
  });

  it('uses ROLLBACK TO SAVEPOINT on failure and rethrows the error', async () => {
    const state = createMockClient();
    const isolation = new DbIsolation(state.client, { workerId: 'w1' });
    const db = isolation.createRoutingClient(state.client);
    await isolation.beginTest();

    const failure = new Error('intentional rollback');
    await expect(
      db.$transaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(state.sql).toHaveBeenCalledWith('SAVEPOINT sp_w1_1');
    expect(state.sql).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_w1_1');
    expect(state.sql).toHaveBeenCalledWith('RELEASE SAVEPOINT sp_w1_1');
    await isolation.endTest();
  });

  it('delegates to the base client when no test transaction is active', async () => {
    const state = createMockClient();
    const isolation = new DbIsolation(state.client, { workerId: 'w1' });
    const db = isolation.createRoutingClient(state.client);

    await expect(db.$transaction(async () => 'base')).resolves.toBe('base');
    expect(state.calls).toContain('COMMIT');
    expect(state.sql).not.toHaveBeenCalled();
  });

  it('rejects nested batch transactions with a clear error', async () => {
    const state = createMockClient();
    const isolation = new DbIsolation(state.client, { workerId: 'w1' });
    const db = isolation.createRoutingClient(state.client);
    await isolation.beginTest();

    const transaction = db.$transaction as (value: unknown) => Promise<unknown>;
    await expect(transaction([])).rejects.toThrow('nested batch transactions');
    await isolation.endTest();
  });
});

describe('DbIsolation hook wiring and worker safety', () => {
  it('wires beforeEach/afterEach automatically', async () => {
    const state = createMockClient();
    const isolation = new DbIsolation(state.client, { workerId: '1' });
    let before!: () => Promise<void>;
    let after!: () => Promise<void>;
    isolation.registerHooks({
      beforeEach: (fn) => {
        before = fn;
      },
      afterEach: (fn) => {
        after = fn;
      },
    });

    await before();
    expect(isolation.isActive).toBe(true);
    await after();
    expect(isolation.isActive).toBe(false);
  });

  it('keeps concurrent workers independent while sharing the reset lock key', async () => {
    const first = createMockClient();
    const second = createMockClient();
    const workerA = new DbIsolation(first.client, { workerId: 'worker-1' });
    const workerB = new DbIsolation(second.client, { workerId: 'worker-2' });

    expect(workerA.lockKey).toBe(workerB.lockKey);
    expect(workerA.workerTag).not.toBe(workerB.workerTag);

    await Promise.all([workerA.beginTest(), workerB.beginTest()]);
    expect(first.lastTx).toBeDefined();
    expect(second.lastTx).toBeDefined();
    expect(first.lastTx).not.toBe(second.lastTx);

    await workerA.endTest();
    expect(first.calls).toContain('ROLLBACK');
    expect(second.calls).not.toContain('ROLLBACK');
    expect(workerB.isActive).toBe(true);
    await workerB.endTest();
  });

  it('derives stable lock keys and sanitised worker identifiers', () => {
    expect(makeAdvisoryLockKey()).toBe(makeAdvisoryLockKey());
    expect(makeAdvisoryLockKey('other-scope')).not.toBe(makeAdvisoryLockKey());
    expect(makeWorkerTag('Worker/1')).toBe('worker_1');
    expect(resolveWorkerId({ VITEST_POOL_ID: '5' })).toBe('5');
    expect(resolveWorkerId({ VITEST_WORKER_ID: '7' })).toBe('7');
  });
});
