$env:PATH += ";C:\Program Files\Git\bin"
Set-Location "C:\Users\USER\Documents\Blue-Collar"

# ── Stage cache files (were untracked after rm --cached) ─────────────────────
git add -f packages/api/src/services/cache.service.ts
git add -f packages/api/src/middleware/cache.ts

# ── Commit #773 ────────────────────────────────────────────────────────────────
git commit -m "feat(#773): implement Redis caching layer

- Create packages/api/src/services/cache.service.ts
  - cacheGet/cacheSet/cacheDel: typed Redis operations with graceful degradation
  - cacheInvalidatePattern: SCAN-based pattern invalidation (safe for large keyspaces)
  - cacheOrFetch: cache-aside read-through helper
  - CacheTTL: SHORT(60) MEDIUM(300) LONG(600) HOUR(3600) DAY(86400) presets
  - CacheKeys: typed key namespace for workers, categories, ratings, availability
  - invalidateWorkerCache/invalidateCategoryCache/invalidateRatingCache:
    event-driven invalidation helpers called after writes
  - Prometheus metrics: cache_hits_total, cache_misses_total (labelled by
    key_prefix), cache_operation_duration_seconds (labelled by operation)
  - All Redis errors handled silently — cache never blocks the request path
- Update packages/api/src/middleware/cache.ts
  - Rewritten to delegate all Redis I/O to cache.service
  - Only caches 2xx responses
  - X-Cache: HIT/MISS headers on every GET response
  - Exports CacheTTL, CacheKeys, invalidateCache, invalidateCachePattern

Closes #773"

# ── Commit #774 ────────────────────────────────────────────────────────────────
git add -f packages/api/src/middleware/rateLimit.ts
git add -f packages/api/src/config/rateLimits.ts

git commit -m "feat(#774): implement sophisticated Redis-backed rate limiting

- Create packages/api/src/middleware/rateLimit.ts
  - createRateLimiter(config): factory that builds a sliding-window middleware
  - Sliding window via Redis sorted sets (ZREMRANGEBYSCORE + ZADD + ZCARD)
  - Per-user bucket (auth) and per-IP bucket (anon) with different limits
  - Admin role: unlimited (adminLimit=0) or per-role limit
  - Burst allowance on top of base limit (token-bucket style)
  - RateLimit-Limit/Remaining/Reset/Policy headers on every response (IETF draft)
  - Retry-After with exponential backoff on 429 (violations tracked in Redis)
  - IP allowlist bypass via RATE_LIMIT_ALLOWLIST env var
  - Graceful fail-open when Redis is unavailable
  - Pre-built limiters: strictAuthRateLimiter, moderateAuthRateLimiter,
    workersReadRateLimiter, workersWriteRateLimiter, contactRateLimit,
    generalRateLimit, bookingRateLimit
- Create packages/api/src/config/rateLimits.ts
  - RateLimitConfig interface with windowSec, anonLimit, authLimit,
    adminLimit, burstAllowance fields
  - Configs: AUTH_STRICT, AUTH_MODERATE, WORKERS_READ, WORKERS_WRITE,
    CONTACT, GENERAL_API, BOOKINGS
  - All values configurable via env vars — no redeploy required
  - RATE_LIMIT_ALLOWLIST: comma-separated IP list from RL_ALLOWLIST env var

Closes #774"

# ── Commit #775 ────────────────────────────────────────────────────────────────
git add -f packages/api/src/queue/index.ts
git add -f packages/api/src/workers/email.worker.ts
git add -f packages/api/src/workers/notification.worker.ts
git add -f packages/api/src/workers/scheduler.worker.ts

git commit -m "feat(#775): implement background job queue and scheduler

- Create packages/api/src/queue/index.ts
  - BullMQ Queue definitions: emailQueue, notificationQueue, indexerQueue,
    ttlQueue, cleanupQueue, schedulerQueue
  - Shared BullMQ Redis connection from existing redis config
  - DEFAULT_JOB_OPTIONS: 3 attempts, exponential backoff (2s base),
    removeOnComplete (24h/1000), removeOnFail (7d DLQ retention)
  - Typed job data interfaces: EmailJobData, NotificationJobData,
    IndexerJobData, TtlJobData, CleanupJobData, SchedulerJobData
  - Helper functions: enqueueEmail, enqueueNotification, enqueueScheduled
- Create packages/api/src/workers/email.worker.ts
  - BullMQ Worker processing email queue with concurrency=5
  - Delegates to existing mailer.send()
  - Logs completed and failed events
- Create packages/api/src/workers/notification.worker.ts
  - BullMQ Worker processing notification queue with concurrency=10
  - Delegates to existing dispatchNotification() service
  - Error logging with job ID
- Create packages/api/src/workers/scheduler.worker.ts
  - cleanupWorker: processes cleanup jobs (expired sessions, orphaned uploads,
    stale notifications) via existing purge.service
  - schedulerWorker: processes scheduled jobs (booking_reminder, review_prompt,
    weekly_digest) by enqueuing notifications
  - registerRecurringJobs(): registers daily cleanup (02:00 UTC) and weekly
    upload cleanup (Sundays 03:00 UTC) using BullMQ repeat/cron

Closes #775"

# ── Commit #776 ────────────────────────────────────────────────────────────────
git add -f packages/api/src/controllers/bookings.ts
git add -f packages/api/src/services/booking.service.ts
git add -f packages/api/src/routes/bookings.ts
git add -f packages/api/prisma/schema.prisma

git commit -m "feat(#776): implement worker availability and booking API

- Create packages/api/prisma/schema.prisma (append)
  - Booking model: id, workerId, requesterId, startTime, endTime, timezone,
    serviceDescription, note, status, cancellationReason, createdAt, updatedAt
  - BookingStatus enum: pending, confirmed, cancelled, completed
  - Indexes on (workerId, startTime), (requesterId, startTime), (workerId, status)
  - Relations to Worker and User (BookingRequester named relation)
- Create packages/api/src/services/booking.service.ts
  - createBooking(): validates future start, end>start, self-booking prevention,
    worker existence, availability schedule coverage, conflict detection via
    sliding-window overlap check (start < other.end && end > other.start),
    enqueues booking_request notification to worker
  - confirmBooking(): worker-only confirmation, enqueues booking_confirmed
    notification to requester
  - cancelBooking(): either party can cancel, enqueues booking_cancelled
    notification to the other party with optional reason
  - getWorkerBookings(): paginated list with requester details
  - getRequesterBookings(): paginated list with worker details
  - All booking events dispatch notifications via BullMQ queue (async)
- Create packages/api/src/controllers/bookings.ts
  - createBooking, confirmBooking, cancelBooking, getMyBookings handlers
  - getMyBookings supports ?role=worker|requester&status filter
- Create packages/api/src/routes/bookings.ts
  - POST /bookings (bookingRateLimit: 10/hr)
  - GET /bookings/mine (?role&status)
  - PATCH /bookings/:id/confirm
  - PATCH /bookings/:id/cancel
  - All routes require authenticateJWT middleware

Closes #776"

Write-Host "All 4 commits done"
git log --oneline -5
