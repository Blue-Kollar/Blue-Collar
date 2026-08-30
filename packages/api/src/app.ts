import express from 'express'
import methodOverride from 'method-override'
import passport from './config/passport.js'
import { redis, cacheMetrics } from './config/redis.js'
import { db } from './db.js'
import { disconnectDb } from './db.js'
import { requestLogger } from './middleware/requestLogger.js'
import { getErrorMessage } from './utils/getErrorMessage.js'
import { registerEventHandlers } from './events/index.js'
import { applySecurity, depthLimiter } from './middleware/security.js'
import authRoutes from './routes/auth.js'
import categoryRoutes from './routes/categories.js'
import workerRoutes from './routes/workers.js'
import adminRoutes from './routes/admin.js'
import userRoutes from './routes/users.js'
import disputeRoutes from './routes/disputes.js'
import recommendationRoutes from './routes/recommendations.js'
import webhookRoutes from './routes/webhooks.js'
import verificationRoutes from './routes/verifications.js'
import auditRoutes from './routes/audit.js'
import responseTimeRoutes from './routes/response-time.js'
import insuranceRoutes from './routes/insurance.js'
import referralRoutes from './routes/referral.js'
import analyticsRoutes from './routes/analytics.js'
import paymentRoutes from './routes/payments.js'
import jobRoutes from './routes/jobs.js'
import notificationRoutes from './routes/notifications.js'
import helpfulRoutes from './routes/helpful.js'
import vitalsRoutes from './routes/vitals.js'
import devicesRoutes from './routes/devices.js'
import bookingsRoutes from './routes/bookings.js'
import escrowRoutes from './routes/escrow.js'
import indexerRoutes from './routes/indexer.js'
import messagesRoutes from './routes/messages.js'
import notificationPreferencesRoutes from './routes/notificationPreferences.js'
import portfolioRoutes from './routes/portfolio.js'
import reviewsRoutes from './routes/reviews.js'
import subscriptionsRoutes from './routes/subscriptions.js'
import walletRoutes from './routes/wallet.js'
import workerEventsRoutes from './routes/workerEvents.js'
import { auditMiddleware } from './middleware/audit.js'
import { sanitize, sanitizeParams } from './middleware/sanitize.js'
import {
  VERSION_CONFIG,
  versionMiddleware,
  deprecationWarning,
  versionDeprecationMiddleware,
} from './middleware/version.js'
import { responseSchemaVersioning } from './utils/schemaVersioning.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { metricsHandler as metricsEndpoint, metricsMiddleware } from './middleware/metrics.js'
import { getRateLimitStatus } from './middleware/versionRateLimit.js'
import { versionAwareAuth, addAuthGuidanceHeaders } from './middleware/versionAuth.js'
import { getRolloutStatusEndpoint, updateRolloutEndpoint } from './utils/versionRollout.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { version: API_VERSION } = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
)

const app = express()

// Register application event handlers
registerEventHandlers()

// Connect Redis (non-blocking — app starts even if Redis is down)
redis.connect().catch(() => {})

applySecurity(app)
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use(sanitize)
app.use(sanitizeParams)
app.use(depthLimiter)
app.use(metricsMiddleware)
app.use(requestLogger)
app.use(methodOverride('X-HTTP-Method'))
app.use(passport.initialize())
app.use(versionMiddleware)
app.use(versionDeprecationMiddleware)
app.use(versionAwareAuth)
app.use(addAuthGuidanceHeaders)
app.use(responseSchemaVersioning)
app.use(auditMiddleware)

// ── Domain route registration ────────────────────────────────────────────────
//
// `registerDomainRoutes(prefix)` mounts every domain router under `prefix`
// exactly once. This replaces the previous pattern of repeating three
// identical blocks for the unversioned base, /v1, and /v2 prefixes.
//
// To add a new domain router:
//   1. Import its Router above.
//   2. Add a single `app.use(p + '/your-path', yourRouter)` line inside
//      registerDomainRoutes — it will automatically be mounted for all
//      supported API prefixes.
//
function registerDomainRoutes(p: string) {
  // ── Core domains ──────────────────────────────────────────────────────────
  app.use(`${p}/auth`,                         authRoutes)
  app.use(`${p}/auth`,                         devicesRoutes)       // device tokens share /auth prefix
  app.use(`${p}/categories`,                   categoryRoutes)
  app.use(`${p}/users`,                        userRoutes)

  // ── Workers domain ────────────────────────────────────────────────────────
  app.use(`${p}/workers`,                      workerRoutes)
  app.use(`${p}/workers`,                      insuranceRoutes)     // /workers/:id/insurance
  app.use(`${p}/workers/events`,               workerEventsRoutes)
  app.use(`${p}/workers/:workerId/portfolio`,  portfolioRoutes)

  // ── Jobs domain ───────────────────────────────────────────────────────────
  app.use(`${p}/jobs`,                         jobRoutes)
  app.use(`${p}/bookings`,                     bookingsRoutes)

  // ── Payments & wallet domain ──────────────────────────────────────────────
  app.use(`${p}/payments`,                     paymentRoutes)
  app.use(`${p}/wallet`,                       walletRoutes)
  app.use(`${p}/escrow`,                       escrowRoutes)

  // ── Reviews & recommendations ─────────────────────────────────────────────
  app.use(`${p}/reviews`,                      helpfulRoutes)
  app.use(`${p}/reviews/helpful`,              reviewsRoutes)
  app.use(`${p}/recommendations`,              recommendationRoutes)

  // ── Notifications & messaging ─────────────────────────────────────────────
  app.use(`${p}/notifications`,                notificationRoutes)
  app.use(`${p}/notifications/preferences`,    notificationPreferencesRoutes)
  app.use(`${p}/messages`,                     messagesRoutes)
  app.use(`${p}/subscriptions`,                subscriptionsRoutes)

  // ── Admin, moderation & compliance ───────────────────────────────────────
  app.use(`${p}/admin`,                        adminRoutes)
  app.use(`${p}/disputes`,                     disputeRoutes)
  app.use(`${p}/verifications`,                verificationRoutes)
  app.use(`${p}/audit`,                        auditRoutes)

  // ── Platform & infrastructure ─────────────────────────────────────────────
  app.use(`${p}/analytics`,                    analyticsRoutes)
  app.use(`${p}/referrals`,                    referralRoutes)
  app.use(`${p}/webhooks`,                     webhookRoutes)
  app.use(`${p}/events`,                       indexerRoutes)
  app.use(p,                                   responseTimeRoutes)  // /response-time (no sub-path)
  app.use(p,                                   vitalsRoutes)        // /vitals (no sub-path)
}

// Register all domain routes for every supported API prefix.
registerDomainRoutes('/api')
registerDomainRoutes('/api/v1')
registerDomainRoutes('/api/v2')

// ── Version endpoint ──────────────────────────────────────────────────────────
app.get('/api/version', (_req, res) => {
  res.json({
    apiPackageVersion: API_VERSION,
    apiVersions: Array.from(VERSION_CONFIG.supported),
    currentVersion: VERSION_CONFIG.current,
    deprecatedVersions: VERSION_CONFIG.deprecated,
    status: 'current',
  })
})

app.get('/api/v1/version', (_req, res) => {
  res.json({
    version: API_VERSION,
    apiVersion: 'v1',
    status: VERSION_CONFIG.deprecated.includes('v1') ? 'deprecated' : 'current',
    supported: Array.from(VERSION_CONFIG.supported),
    deprecated: VERSION_CONFIG.deprecated,
    sunset: VERSION_CONFIG.sunset.v1,
  })
})

app.get('/api/v2/version', (_req, res) => {
  res.json({
    version: API_VERSION,
    apiVersion: 'v2',
    status: VERSION_CONFIG.deprecated.includes('v2') ? 'deprecated' : 'current',
    supported: Array.from(VERSION_CONFIG.supported),
    deprecated: VERSION_CONFIG.deprecated,
    sunset: VERSION_CONFIG.sunset.v2,
  })
})

app.get('/api/v1/versions', (_req, res) => {
  const versionInfo = Array.from(VERSION_CONFIG.supported).map(v => ({
    version: v,
    status: VERSION_CONFIG.deprecated.includes(v) ? 'deprecated' : 'current',
    sunset: VERSION_CONFIG.sunset[v as keyof typeof VERSION_CONFIG.sunset] || null,
    rateLimiting: VERSION_CONFIG.rateLimitByVersion[v as keyof typeof VERSION_CONFIG.rateLimitByVersion],
    authPolicy: VERSION_CONFIG.authPolicies[v as keyof typeof VERSION_CONFIG.authPolicies],
  }))
  res.json({
    versions: versionInfo,
    current: VERSION_CONFIG.current,
  })
})

app.get('/api/v2/versions', (_req, res) => {
  const versionInfo = Array.from(VERSION_CONFIG.supported).map(v => ({
    version: v,
    status: VERSION_CONFIG.deprecated.includes(v) ? 'deprecated' : 'current',
    sunset: VERSION_CONFIG.sunset[v as keyof typeof VERSION_CONFIG.sunset] || null,
    rateLimiting: VERSION_CONFIG.rateLimitByVersion[v as keyof typeof VERSION_CONFIG.rateLimitByVersion],
    authPolicy: VERSION_CONFIG.authPolicies[v as keyof typeof VERSION_CONFIG.authPolicies],
  }))
  res.json({
    versions: versionInfo,
    current: VERSION_CONFIG.current,
  })
})

// ── Rate limit status endpoints ───────────────────────────────────────────────
app.get('/api/rate-limit', getRateLimitStatus)
app.get('/api/v1/rate-limit', getRateLimitStatus)
app.get('/api/v2/rate-limit', getRateLimitStatus)

// ── Rollout status endpoints ──────────────────────────────────────────────────
app.get('/api/rollout', getRolloutStatusEndpoint)
app.get('/api/v1/rollout', getRolloutStatusEndpoint)
app.get('/api/v2/rollout', getRolloutStatusEndpoint)

// ── Admin: Update rollout configuration ───────────────────────────────────────
app.put('/api/admin/rollout', updateRolloutEndpoint)
app.put('/api/v1/admin/rollout', updateRolloutEndpoint)
app.put('/api/v2/admin/rollout', updateRolloutEndpoint)

// ── Redirect unversioned /api/* → /api/v1/* with deprecation headers ──────────
app.use('/api', deprecationWarning, (req, res) => {
  const qs = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query as any).toString() : ''
  const target = `/api/v1${req.path}${qs}`
  res.redirect(301, target)
})

// ── Health check endpoints ────────────────────────────────────────────────────
// /healthz: lightweight liveness probe (service is running)
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

// /health: legacy liveness probe (kept for backward compatibility)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

// /readyz: readiness probe (service is ready to handle traffic)
// Checks DB and Redis connectivity before declaring ready
app.get('/readyz', async (_req, res) => {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {}

  // Database check
  const dbStart = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch (err) {
    checks.database = { status: 'error', latencyMs: Date.now() - dbStart, error: getErrorMessage(err) }
  }

  // Redis check
  const redisStart = Date.now()
  try {
    await redis.ping()
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
  } catch (err) {
    checks.redis = { status: 'error', latencyMs: Date.now() - redisStart, error: getErrorMessage(err) }
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok')
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    service: 'bluecollar-api',
    checks,
    timestamp: new Date().toISOString(),
  })
})

// /ready: legacy readiness probe (kept for backward compatibility)
app.get('/ready', async (_req, res) => {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {}

  // Database check
  const dbStart = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch (err) {
    checks.database = { status: 'error', latencyMs: Date.now() - dbStart, error: getErrorMessage(err) }
  }

  // Redis check
  const redisStart = Date.now()
  try {
    await redis.ping()
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
  } catch (err) {
    checks.redis = { status: 'error', latencyMs: Date.now() - redisStart, error: getErrorMessage(err) }
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok')
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    service: 'bluecollar-api',
    checks,
    timestamp: new Date().toISOString(),
  })
})

app.get('/metrics/cache', (_req, res) => {
  const total = cacheMetrics.hits + cacheMetrics.misses
  res.json({
    hits: cacheMetrics.hits,
    misses: cacheMetrics.misses,
    hitRate: total > 0 ? `${Math.round((cacheMetrics.hits / total) * 100)}%` : '0%',
  })
})

app.get('/metrics', metricsEndpoint)

// Swagger UI — development only. Imported lazily (and skipped in test) so that
// OpenAPI spec generation, which runs eagerly on import, never runs as a side
// effect of booting the app for tests.
if (process.env['NODE_ENV'] !== 'production' && process.env['NODE_ENV'] !== 'test') {
  const { default: docsRouter } = await import('./openapi/docs.js')
  app.use('/api', docsRouter)
}

// 404 handler — must come after all routes
app.use(notFoundHandler)

// Global error handler — must be last
app.use(errorHandler)

// ── Graceful shutdown (#836) ───────────────────────────────────────────────────
// Drain in-flight requests and close both Prisma pool connections cleanly.
// Kubernetes / PM2 send SIGTERM; Ctrl+C sends SIGINT.
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[shutdown] ${signal} received — closing database connections…`)
  try {
    await disconnectDb()
    console.log('[shutdown] Database connections closed.')
  } catch (err) {
    console.error('[shutdown] Error closing database connections:', err)
  }
  process.exit(0)
}

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.once('SIGINT',  () => gracefulShutdown('SIGINT'))

export default app
