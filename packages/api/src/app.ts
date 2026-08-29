import express from 'express'
import cors from 'cors'
import methodOverride from 'method-override'
import passport from './config/passport.js'
import { redis, cacheMetrics } from './config/redis.js'
import { db } from './db.js'
import { requestLogger } from './middleware/requestLogger.js'
import { requestId } from './middleware/requestId.js'
import { registerEventHandlers } from './events/index.js'
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
import conversationRoutes from './routes/conversations.js'
import helpfulRoutes from './routes/helpful.js'
import vitalsRoutes from './routes/vitals.js'
import devicesRoutes from './routes/devices.js'
import { auditMiddleware } from './middleware/audit.js'
import { sanitize } from './middleware/sanitize.js'
import { versionMiddleware, deprecationWarning, versionDeprecationMiddleware } from './middleware/version.js'
import { responseSchemaVersioning } from './utils/schemaVersioning.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import docsRouter from './openapi/docs.js'
import { metricsEndpoint, metricsMiddleware } from './middleware/metrics.js'
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

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(sanitize)
app.use(requestId)          // generate/propagate X-Request-ID before logging
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

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/workers', workerRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/users', userRoutes)
app.use('/api/disputes', disputeRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/verifications', verificationRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api', responseTimeRoutes)
app.use('/api/workers', insuranceRoutes)
app.use('/api/referrals', referralRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/reviews', helpfulRoutes)
app.use('/api/auth', devicesRoutes)
app.use('/api', vitalsRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/events', indexerRoutes)
app.use('/api/escrow', escrowRoutes)
// ── Versioned routes (v1) ─────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/categories', categoryRoutes)
app.use('/api/v1/workers', workerRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/disputes', disputeRoutes)
app.use('/api/v1/recommendations', recommendationRoutes)
app.use('/api/v1/webhooks', webhookRoutes)
app.use('/api/v1/verifications', verificationRoutes)
app.use('/api/v1/audit', auditRoutes)
app.use('/api/v1', responseTimeRoutes)
app.use('/api/v1/workers', insuranceRoutes)
app.use('/api/v1/referrals', referralRoutes)
app.use('/api/v1/payments', paymentRoutes)
app.use('/api/v1/jobs', jobRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/conversations', conversationRoutes)
app.use('/api/v1/reviews', helpfulRoutes)
app.use('/api/v1/auth', devicesRoutes)

// ── Versioned routes (v2) ─────────────────────────────────────────────────────
app.use('/api/v2/auth', authRoutes)
app.use('/api/v2/categories', categoryRoutes)
app.use('/api/v2/workers', workerRoutes)
app.use('/api/v2/admin', adminRoutes)
app.use('/api/v2/users', userRoutes)
app.use('/api/v2/disputes', disputeRoutes)
app.use('/api/v2/recommendations', recommendationRoutes)
app.use('/api/v2/auth', devicesRoutes)
app.use('/api/v2/webhooks', webhookRoutes)
app.use('/api/v2/verifications', verificationRoutes)
app.use('/api/v2/audit', auditRoutes)
app.use('/api/v2', responseTimeRoutes)
app.use('/api/v2/workers', insuranceRoutes)
app.use('/api/v2/referrals', referralRoutes)
app.use('/api/v2/payments', paymentRoutes)
app.use('/api/v2/notifications', notificationRoutes)
app.use('/api/v2/conversations', conversationRoutes)
app.use('/api/v2/reviews', helpfulRoutes)
app.use('/api/v2/wallet', walletRoutes)
app.use('/api/v2/events', indexerRoutes)
app.use('/api/v2/escrow', escrowRoutes)

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

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.get('/ready', async (_req, res) => {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {}

  // Database check
  const dbStart = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch (err: any) {
    checks.database = { status: 'error', latencyMs: Date.now() - dbStart, error: err?.message }
  }

  // Redis check
  const redisStart = Date.now()
  try {
    await redis.ping()
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
  } catch (err: any) {
    checks.redis = { status: 'error', latencyMs: Date.now() - redisStart, error: err?.message }
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

// Swagger UI — development only
if (process.env['NODE_ENV'] !== 'production') {
  app.use('/api', docsRouter)
}

// 404 handler — must come after all routes
app.use(notFoundHandler)

// Global error handler — must be last
app.use(errorHandler)

export default app
