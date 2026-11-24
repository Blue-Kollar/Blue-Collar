/**
 * db-isolation.ts — #1871: database test isolation for packages/api.
 *
 * Chosen strategy: per-test interactive transaction with mandatory rollback,
 * plus an advisory-lock-serialised, deterministic table reset for suite setup.
 *
 * - `beginTest()` opens one interactive transaction and exposes its tx client
 *   through a routing proxy, so tests keep using the exported `db` object.
 * - `endTest()` (afterEach) aborts that transaction. Nothing a test writes is
 *   ever committed, so concurrent Vitest workers cannot see each other's rows.
 * - nested `db.$transaction(...)` calls become SAVEPOINTs on the same
 *   transaction (savepoint strategy) instead of opening a second connection.
 * - `resetDatabase()` is the only operation on committed state. It takes a
 *   PostgreSQL transaction-scoped advisory lock (stable key shared by all
 *   workers) before `TRUNCATE ... RESTART IDENTITY CASCADE`, so parallel
 *   workers cannot interleave resets. The table list is fixed and ordered,
 *   and table discovery is limited to the public schema used by Prisma here.
 *
 * The module has no runtime dependency on @prisma/client so it can be
 * unit-tested with a mocked client without Prisma client generation.
 */

const DEFAULT_MAX_WAIT = 15_000;
const DEFAULT_TIMEOUT = 60_000;

/** Minimum structural surface required from a Prisma-like client. */
export interface IsolationClient {
  $transaction<T>(
    fn: (tx: IsolationClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
  $executeRawUnsafe(command: string, ...values: unknown[]): Promise<unknown>;
  $queryRawUnsafe<T = unknown>(command: string, ...values: unknown[]): Promise<T>;
}

export interface IsolationOptions {
  /** Stable across workers so every worker derives the same reset lock key. */
  workerId?: string;
  lockKey?: number;
  maxWait?: number;
  timeout?: number;
}

export interface ResetOptions {
  tables?: readonly string[];
  lockKey?: number;
  maxWait?: number;
  timeout?: number;
}

export interface ResetResult {
  lockKey: number;
  /** Existing tables actually truncated, in deterministic order. */
  tables: string[];
}

export interface IsolationHooks {
  beforeEach: (fn: () => Promise<void>) => void;
  afterEach: (fn: () => Promise<void>) => void;
}

/**
 * All Prisma models in schema.prisma, dependents first. CASCADE makes the order
 * non-critical, but keeping it fixed makes resets reproducible and testable.
 * Tables absent from the migration state are skipped at runtime.
 */
export const ISOLATION_TABLES = [
  'Booking',
  'Message',
  'ConversationParticipant',
  'Conversation',
  'ReviewHelpful',
  'Notification',
  'NotificationPreferences',
  'EscrowDispute',
  'EscrowRecord',
  'MediaAsset',
  'StellarAccount',
  'EventIndexerCursor',
  'ContractEvent',
  'IdempotencyKey',
  'RefreshToken',
  'SearchAnalytics',
  'WorkerAnalytics',
  'WorkerTipEvent',
  'ProfileView',
  'JobMessage',
  'JobApplication',
  'Job',
  'Referral',
  'InsuranceDocument',
  'ContactRequest',
  'AuditLog',
  'VerificationRequest',
  'WebhookLog',
  'WebhookSubscription',
  'UserInteraction',
  'Dispute',
  'Subscription',
  'Review',
  'PortfolioItem',
  'Availability',
  'PushSubscription',
  'Bookmark',
  'Worker',
  'Category',
  'User',
  'Location',
] as const;

export const RESET_LOCK_SCOPE = 'bluecollar:db-integration:reset';

/** FNV-1a (32-bit) — same scope always yields the same advisory lock key. */
export function makeAdvisoryLockKey(scope: string = RESET_LOCK_SCOPE): number {
  let hash = 2166136261;
  for (let index = 0; index < scope.length; index += 1) {
    hash ^= scope.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

/** Vitest injects a pool/worker id; fall back to the process id. */
export function resolveWorkerId(env: Record<string, string | undefined> = process.env): string {
  return env.VITEST_POOL_ID ?? env.VITEST_WORKER_ID ?? String(process.pid);
}

/** SQL-safe, worker-specific fragment used in savepoint names. */
export function makeWorkerTag(workerId: string): string {
  return (
    workerId
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 24) || 'worker'
  );
}

const quoteIdentifier = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/**
 * Serialised reset of all known tables. Runs in its own transaction so the
 * advisory lock and the TRUNCATE are atomic. Safe to call from every worker.
 */
export async function resetDatabase(
  client: IsolationClient,
  options: ResetOptions = {},
): Promise<ResetResult> {
  const tables = [...(options.tables ?? ISOLATION_TABLES)];
  const lockKey = Math.trunc(options.lockKey ?? makeAdvisoryLockKey());

  return client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);
      const rows = await tx.$queryRawUnsafe<Array<{ table_name?: unknown }>>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
      );
      const present = new Set(rows.map((row) => String(row.table_name ?? '')));
      const existing = tables.filter((table) => present.has(table));

      if (existing.length > 0) {
        await tx.$executeRawUnsafe(
          `TRUNCATE TABLE ${existing.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE`,
        );
      }

      return { lockKey, tables: existing };
    },
    {
      maxWait: options.maxWait ?? DEFAULT_MAX_WAIT,
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
    },
  );
}

const ROLLBACK_SYMBOL = Symbol('db-isolation:rollback');
const ROLLBACK_ERROR = Object.assign(new Error('db isolation: rolling back test transaction'), {
  [ROLLBACK_SYMBOL]: true,
});

const isRollbackSignal = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && ROLLBACK_SYMBOL in value;

interface ActiveTest {
  tx: IsolationClient;
  completion: Promise<unknown>;
  reject: (error: unknown) => void;
}

/** Owns one per-test transaction and the routing proxy over the base client. */
export class DbIsolation {
  readonly workerId: string;
  readonly workerTag: string;
  readonly lockKey: number;

  private readonly client: IsolationClient;
  private readonly maxWait: number;
  private readonly timeout: number;
  private active: ActiveTest | undefined;
  private savepointCounter = 0;

  constructor(client: IsolationClient, options: IsolationOptions = {}) {
    this.client = client;
    this.workerId = options.workerId ?? resolveWorkerId();
    this.workerTag = makeWorkerTag(this.workerId);
    this.lockKey = options.lockKey ?? makeAdvisoryLockKey();
    this.maxWait = options.maxWait ?? DEFAULT_MAX_WAIT;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  get isActive(): boolean {
    return this.active !== undefined;
  }

  /**
   * A drop-in `db` replacement: model/raw calls go to the active test
   * transaction, everything else to the base client. `$disconnect` always
   * targets the base client so a test cannot tear down its own pool.
   */
  createRoutingClient<T extends object>(base: T): T {
    const runNested = (fn: unknown, options?: { maxWait?: number; timeout?: number }) =>
      this.runNestedTransaction(fn, options);

    return new Proxy(base, {
      get: (target, property) => {
        if (property === '$transaction') {
          return runNested;
        }

        if (property === '$connect' || property === '$disconnect' || property === '$on') {
          const baseValue = Reflect.get(target, property, target);
          return typeof baseValue === 'function' ? baseValue.bind(target) : baseValue;
        }

        const source = (this.active?.tx ?? target) as object;
        const value = Reflect.get(source, property, source);
        return typeof value === 'function' ? value.bind(source) : value;
      },
    });
  }

  /** Open the per-test transaction; the tx client is captured via the callback. */
  async beginTest(): Promise<void> {
    if (this.active) {
      throw new Error('db isolation: a test transaction is already active');
    }

    let capture!: (tx: IsolationClient) => void;
    const captured = new Promise<IsolationClient>((resolve) => {
      capture = resolve;
    });
    let abort!: (error: unknown) => void;
    const release = new Promise<void>((_resolve, reject) => {
      abort = reject;
    });

    const completion = this.client.$transaction(
      async (tx) => {
        capture(tx);
        await release;
      },
      { maxWait: this.maxWait, timeout: this.timeout },
    );
    void completion.catch(() => undefined);

    const unexpectedClose = completion.then(() => {
      throw new Error('db isolation: test transaction closed before the test started');
    });
    void unexpectedClose.catch(() => undefined);

    const tx = await Promise.race([captured, unexpectedClose]);
    this.active = { tx, completion, reject: abort };
  }

  /** Always roll back; a failed rollback is surfaced rather than swallowed. */
  async endTest(): Promise<void> {
    const active = this.active;
    if (!active) return;
    this.active = undefined;
    active.reject(ROLLBACK_ERROR);
    try {
      await active.completion;
    } catch (error) {
      if (!isRollbackSignal(error)) throw error;
    }
  }

  /** Serialised baseline reset, for use in suite-level beforeAll. */
  async reset(): Promise<ResetResult> {
    return resetDatabase(this.client, {
      lockKey: this.lockKey,
      maxWait: this.maxWait,
      timeout: this.timeout,
    });
  }

  /** Convenience wiring for Vitest hooks; suitable for setup files. */
  registerHooks(hooks: IsolationHooks): void {
    hooks.beforeEach(async () => {
      await this.beginTest();
    });
    hooks.afterEach(async () => {
      await this.endTest();
    });
  }

  private async runNestedTransaction(
    fn: unknown,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<unknown> {
    if (typeof fn !== 'function') {
      throw new Error('db isolation: nested batch transactions are not supported');
    }
    const callback = fn as (tx: IsolationClient) => Promise<unknown>;
    const active = this.active;
    if (!active) {
      return this.client.$transaction(callback, options);
    }

    this.savepointCounter += 1;
    const savepoint = `sp_${this.workerTag}_${this.savepointCounter}`;
    await active.tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
    try {
      const result = await callback(this.createRoutingClient(this.client));
      await active.tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      await active.tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await active.tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    }
  }
}
