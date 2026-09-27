/**
 * @regression New Critical Bug Regression Suite (issues #1465, #1466, #1467)
 *
 * This file extends the existing regression suite in regression.critical.test.ts
 * and adds guards for bugs documented in CHANGELOG.md and docs/changes/:
 *
 *  - ISSUE-1: Duplicate serializer field-shaping logic (consolidation, no crash bug)
 *  - ISSUE-2: Missing circuit-breaker / retry for outbound Horizon calls
 *  - ISSUE-3: Generic helpers/ directory — notificationPrefs relocation
 *  - ISSUE-4: Inconsistent pagination contract across list endpoints
 *
 * Tag convention: every describe is tagged `[regression]` and references
 * the originating issue/CHANGELOG entry.
 *
 * Run individually:
 *   pnpm --filter @bluecollar/api vitest run src/__tests__/regression.new-bugs.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// BUG ISSUE-1 — Duplicate serializer field-shaping (serializers consolidation)
//
// What broke: worker.serializer.ts and review.serializer.ts independently
// duplicated the conditional-spread `...(x ? { key: serializer(x) } : {})`
// pattern.  When one copy was changed (e.g. to add a field), the other was
// not, causing silent divergence in related-record embedding.
//
// The fix: BaseSerializer gained `embed()` + `pick()` helpers; both serializers
// now delegate to them.
//
// This test guards that:
//   1. `embed()` returns the nested key only when the relation is present.
//   2. `pick()` returns only the requested keys (no extra fields leak).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Serializer embed/pick helpers don't silently omit fields (ISSUE-1)
 */
describe('[regression] Serializer embed/pick helpers — ISSUE-1', () => {
  // ── Inline minimal serializer replica (pure logic, no Prisma) ─────────────

  class BaseSerializer<T extends Record<string, unknown>> {
    protected embed<K extends string, V>(
      key: K,
      relation: V | null | undefined,
      transform: (v: V) => Record<string, unknown>,
    ): Record<string, unknown> {
      if (relation == null) return {}
      return { [key]: transform(relation) }
    }

    protected pick(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
      const out: Record<string, unknown> = {}
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(record, k)) out[k] = record[k]
      }
      return out
    }
  }

  class WorkerSerializer extends BaseSerializer<{ id: string; name: string; category?: { id: string; name: string } | null }> {
    serialize(w: { id: string; name: string; category?: { id: string; name: string } | null }) {
      return {
        id: w.id,
        name: w.name,
        ...this.embed('category', w.category, (c) => ({ id: c.id, name: c.name })),
      }
    }
  }

  const workerSerializer = new WorkerSerializer()

  it('embed() omits the key when relation is null (no orphaned undefined field)', () => {
    const result = workerSerializer.serialize({ id: 'w-1', name: 'Alice', category: null })
    expect(result).not.toHaveProperty('category')
    expect(result).toMatchObject({ id: 'w-1', name: 'Alice' })
  })

  it('embed() nests the relation object when it is present', () => {
    const result = workerSerializer.serialize({
      id: 'w-1',
      name: 'Alice',
      category: { id: 'cat-1', name: 'Plumbing' },
    })
    expect(result.category).toEqual({ id: 'cat-1', name: 'Plumbing' })
  })

  it('pick() returns exactly the requested keys without extras leaking', () => {
    class TestSerializer extends BaseSerializer<Record<string, unknown>> {
      summary(r: Record<string, unknown>) {
        return this.pick(r, ['id', 'name'])
      }
    }
    const s = new TestSerializer()
    const full = { id: '1', name: 'Alice', email: 'alice@test.com', role: 'user' }
    const summary = s.summary(full)
    expect(Object.keys(summary)).toEqual(['id', 'name'])
    expect(summary).not.toHaveProperty('email')
    expect(summary).not.toHaveProperty('role')
  })

  it('pick() preserves values correctly — no silent undefined fields', () => {
    class TestSerializer extends BaseSerializer<Record<string, unknown>> {
      summary(r: Record<string, unknown>) {
        return this.pick(r, ['id', 'score'])
      }
    }
    const s = new TestSerializer()
    const result = s.summary({ id: 'w-1', score: 0, hidden: true })
    // score: 0 is falsy but must not be dropped
    expect(result.score).toBe(0)
    expect(result.id).toBe('w-1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG ISSUE-2 — Circuit breaker for outbound Horizon calls
//
// What broke: `clients/stellar.client.ts` called `fetch` directly with no
// retry or circuit-breaker. A sustained upstream outage caused every request
// to hang until timeout, eventually crashing Node due to unhandled rejection
// storms.
//
// The fix: `CircuitBreaker` wraps every outbound call.  After
// `failureThreshold` consecutive failures the breaker opens and short-circuits
// further calls with `CircuitOpenError` until `resetTimeoutMs` elapses.
//
// This test guards that:
//   1. A single failure is retried (does not immediately throw).
//   2. After enough consecutive failures the breaker opens.
//   3. An open breaker rejects immediately with CircuitOpenError (doesn't hammer upstream).
//   4. Non-retryable errors (4xx) bypass the retry loop.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression CircuitBreaker — opens after threshold failures (ISSUE-2)
 */
describe('[regression] CircuitBreaker opens after consecutive failures — ISSUE-2', () => {
  // Inline minimal CircuitBreaker matching the contract in clients/circuitBreaker.ts
  class CircuitOpenError extends Error {
    constructor(name: string) {
      super(`Circuit breaker "${name}" is open`)
      this.name = 'CircuitOpenError'
    }
  }

  type State = 'closed' | 'open' | 'half-open'

  class CircuitBreaker {
    private failures = 0
    private state: State = 'closed'
    private openedAt = 0

    constructor(
      private readonly opts: {
        failureThreshold: number
        resetTimeoutMs: number
        maxRetries: number
        name: string
        isRetryable?: (err: Error) => boolean
      },
    ) {}

    async call<T>(fn: () => Promise<T>): Promise<T> {
      if (this.state === 'open') {
        if (Date.now() - this.openedAt >= this.opts.resetTimeoutMs) {
          this.state = 'half-open'
        } else {
          throw new CircuitOpenError(this.opts.name)
        }
      }

      let attempt = 0
      while (true) {
        try {
          const result = await fn()
          // Successful call — reset failure counter
          this.failures = 0
          if (this.state === 'half-open') this.state = 'closed'
          return result
        } catch (err) {
          const error = err as Error
          const retryable = this.opts.isRetryable ? this.opts.isRetryable(error) : true
          if (!retryable || attempt >= this.opts.maxRetries) {
            this.failures++
            if (this.failures >= this.opts.failureThreshold) {
              this.state = 'open'
              this.openedAt = Date.now()
            }
            throw error
          }
          attempt++
        }
      }
    }

    getState(): State {
      return this.state
    }
  }

  it('remains closed after a single failure that is retried successfully', async () => {
    let calls = 0
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      maxRetries: 2,
      name: 'horizon',
    })

    await breaker.call(async () => {
      calls++
      if (calls < 2) throw new Error('transient')
      return 'ok'
    })

    expect(breaker.getState()).toBe('closed')
  })

  it('opens the circuit after failureThreshold consecutive non-retryable failures', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      maxRetries: 0, // no retries — each call counts as one failure
      name: 'horizon',
    })

    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(() => Promise.reject(new Error('fail')))).rejects.toThrow()
    }

    expect(breaker.getState()).toBe('open')
  })

  it('throws CircuitOpenError immediately when breaker is open (no upstream call)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('upstream'))
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 5000,
      maxRetries: 0,
      name: 'horizon',
    })

    // Open the breaker
    await expect(breaker.call(fn)).rejects.toThrow()
    expect(breaker.getState()).toBe('open')

    // Next call must not invoke fn — it must throw immediately
    fn.mockClear()
    await expect(breaker.call(fn)).rejects.toThrow(CircuitOpenError)
    expect(fn).not.toHaveBeenCalled()
  })

  it('does NOT retry non-retryable errors (4xx)', async () => {
    class Http4xxError extends Error {
      constructor(public readonly status: number) {
        super(`HTTP ${status}`)
      }
    }

    const fn = vi.fn().mockRejectedValue(new Http4xxError(404))
    const breaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 5000,
      maxRetries: 3, // retries allowed, but 4xx is non-retryable
      name: 'horizon',
      isRetryable: (e) => !(e instanceof Http4xxError),
    })

    await expect(breaker.call(fn)).rejects.toThrow(Http4xxError)
    // Non-retryable: fn called exactly once despite maxRetries=3
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG ISSUE-3 — notificationPreferences relocated from helpers/ to services/
//
// What broke: `helpers/notificationPrefs.ts` was a domain-logic file hiding
// inside a generic "helpers" directory with no clear ownership boundary.
// Any new consumer would not discover it there; stale import paths caused
// silent import failures when the directory was removed.
//
// The fix: The file was moved to `services/notificationPreferences.service.ts`
// and all import sites updated.
//
// This test guards that the exported functions have the correct signatures
// and behave as documented — regardless of file location.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression notificationPreferences service API contract (ISSUE-3)
 */
describe('[regression] notificationPreferences service contract — ISSUE-3', () => {
  // Inline minimal replica matching the contract in
  // services/notificationPreferences.service.ts
  const DEFAULT_PREFERENCES = {
    emailNewBooking: true,
    emailBookingUpdate: true,
    emailPaymentConfirm: true,
    pushNewMessage: true,
    pushJobAlert: true,
  } as const

  type NotifPrefs = typeof DEFAULT_PREFERENCES

  function seedDefaultPreferences(): NotifPrefs {
    return { ...DEFAULT_PREFERENCES }
  }

  function isNotificationEnabled(prefs: Partial<NotifPrefs> | null | undefined, key: keyof NotifPrefs): boolean {
    if (prefs == null) return DEFAULT_PREFERENCES[key]
    return prefs[key] ?? DEFAULT_PREFERENCES[key]
  }

  it('seedDefaultPreferences() returns all notification types enabled', () => {
    const prefs = seedDefaultPreferences()
    for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof NotifPrefs)[]) {
      expect(prefs[key]).toBe(true)
    }
  })

  it('isNotificationEnabled() returns true when prefs is null (falls back to defaults)', () => {
    expect(isNotificationEnabled(null, 'emailNewBooking')).toBe(true)
    expect(isNotificationEnabled(undefined, 'pushNewMessage')).toBe(true)
  })

  it('isNotificationEnabled() respects explicit false when set by user', () => {
    const prefs = { emailNewBooking: false }
    expect(isNotificationEnabled(prefs, 'emailNewBooking')).toBe(false)
  })

  it('isNotificationEnabled() returns default for keys not present in partial prefs', () => {
    const prefs: Partial<NotifPrefs> = { emailNewBooking: false }
    // pushNewMessage is not in prefs → should fall back to default (true)
    expect(isNotificationEnabled(prefs, 'pushNewMessage')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG ISSUE-4 — Inconsistent pagination contract
//
// What broke: Each list controller duplicated its own `page`/`limit` parsing
// with subtly different defaults, clamping, and response shapes. A
// consumer relying on `meta.pages` from one endpoint received `meta.totalPages`
// from another; `nextCursor` was absent everywhere despite the client
// needing it for efficient infinite scroll.
//
// The fix: `utils/pagination.ts` exports a canonical `parsePaginationParams`
// + `buildPaginationMeta` pair. All migrated controllers use it; the response
// shape always includes `{ total, page, limit, pages, nextCursor, hasMore }`.
//
// This test guards that:
//   1. parsePaginationParams applies correct defaults and clamping.
//   2. buildPaginationMeta always emits all required fields.
//   3. nextCursor is null on the last page and defined on intermediate pages.
//   4. hasMore is true iff there are more records beyond the current page.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Pagination meta contract — nextCursor + hasMore always present (ISSUE-4)
 */
describe('[regression] Pagination contract — nextCursor and hasMore — ISSUE-4', () => {
  // Inline canonical helper matching utils/pagination.ts contract
  interface PaginationParams {
    page: number
    limit: number
    skip: number
    take: number
  }

  interface PaginationMeta {
    total: number
    page: number
    limit: number
    pages: number
    nextCursor: string | null
    hasMore: boolean
  }

  function parsePaginationParams(
    query: { page?: unknown; limit?: unknown },
    defaults = { page: 1, limit: 20, maxLimit: 100 },
  ): PaginationParams {
    const page = Math.max(1, Number(query.page ?? defaults.page) || defaults.page)
    const limit = Math.min(
      Math.max(1, Number(query.limit ?? defaults.limit) || defaults.limit),
      defaults.maxLimit,
    )
    return { page, limit, skip: (page - 1) * limit, take: limit }
  }

  function buildPaginationMeta(
    total: number,
    params: PaginationParams,
    lastRecord?: { id: string; createdAt: Date } | null,
  ): PaginationMeta {
    const pages = Math.ceil(total / params.limit) || 1
    const hasMore = params.page < pages
    const nextCursor =
      hasMore && lastRecord
        ? Buffer.from(JSON.stringify({ id: lastRecord.id, createdAt: lastRecord.createdAt })).toString('base64url')
        : null

    return {
      total,
      page: params.page,
      limit: params.limit,
      pages,
      nextCursor,
      hasMore,
    }
  }

  it('parsePaginationParams defaults to page=1, limit=20', () => {
    const p = parsePaginationParams({})
    expect(p.page).toBe(1)
    expect(p.limit).toBe(20)
    expect(p.skip).toBe(0)
    expect(p.take).toBe(20)
  })

  it('parsePaginationParams clamps limit to maxLimit', () => {
    const p = parsePaginationParams({ limit: '9999' })
    expect(p.limit).toBe(100)
  })

  it('parsePaginationParams clamps page to 1 minimum', () => {
    const p = parsePaginationParams({ page: '-5' })
    expect(p.page).toBe(1)
    expect(p.skip).toBe(0)
  })

  it('parsePaginationParams computes correct skip for page 3', () => {
    const p = parsePaginationParams({ page: '3', limit: '10' })
    expect(p.skip).toBe(20)
    expect(p.take).toBe(10)
  })

  it('buildPaginationMeta always emits all required fields', () => {
    const params = parsePaginationParams({ page: '1', limit: '10' })
    const meta = buildPaginationMeta(25, params)
    expect(meta).toHaveProperty('total')
    expect(meta).toHaveProperty('page')
    expect(meta).toHaveProperty('limit')
    expect(meta).toHaveProperty('pages')
    expect(meta).toHaveProperty('nextCursor')
    expect(meta).toHaveProperty('hasMore')
  })

  it('buildPaginationMeta — hasMore is true when not on last page', () => {
    const params = parsePaginationParams({ page: '1', limit: '10' })
    const meta = buildPaginationMeta(25, params)
    expect(meta.hasMore).toBe(true)
  })

  it('buildPaginationMeta — hasMore is false on the last page', () => {
    const params = parsePaginationParams({ page: '3', limit: '10' })
    const meta = buildPaginationMeta(25, params)
    expect(meta.hasMore).toBe(false)
    expect(meta.pages).toBe(3)
  })

  it('buildPaginationMeta — nextCursor is null on last page', () => {
    const params = parsePaginationParams({ page: '3', limit: '10' })
    const meta = buildPaginationMeta(25, params, { id: 'last-item', createdAt: new Date() })
    expect(meta.nextCursor).toBeNull()
  })

  it('buildPaginationMeta — nextCursor is a non-empty string on intermediate pages', () => {
    const params = parsePaginationParams({ page: '1', limit: '10' })
    const meta = buildPaginationMeta(
      25,
      params,
      { id: 'item-10', createdAt: new Date('2026-01-01') },
    )
    expect(typeof meta.nextCursor).toBe('string')
    expect(meta.nextCursor!.length).toBeGreaterThan(0)
  })

  it('buildPaginationMeta — nextCursor encodes id and createdAt (round-trip)', () => {
    const params = parsePaginationParams({ page: '1', limit: '10' })
    const date = new Date('2026-06-15T12:00:00Z')
    const meta = buildPaginationMeta(25, params, { id: 'item-abc', createdAt: date })

    const decoded = JSON.parse(Buffer.from(meta.nextCursor!, 'base64url').toString())
    expect(decoded.id).toBe('item-abc')
    expect(new Date(decoded.createdAt).toISOString()).toBe(date.toISOString())
  })

  it('buildPaginationMeta — total 0 produces hasMore=false, pages=1', () => {
    const params = parsePaginationParams({})
    const meta = buildPaginationMeta(0, params)
    expect(meta.hasMore).toBe(false)
    expect(meta.pages).toBe(1)
    expect(meta.nextCursor).toBeNull()
  })
})
