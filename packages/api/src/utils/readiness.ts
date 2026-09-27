/**
 * Readiness checks — downstream dependency connectivity for /readyz and /ready.
 *
 * Each check reports its own ok/error status + latency so orchestrators
 * (k8s, load balancers) can see exactly which dependency is degraded,
 * rather than a single opaque pass/fail.
 */
import { redis } from '../config/redis.js'
import { db } from '../db.js'
import { config } from '../config/config.js'
import { emailQueue } from '../queue/index.js'
import { getErrorMessage } from './getErrorMessage.js'

export interface DependencyStatus {
  status: 'ok' | 'error'
  latencyMs: number
  error?: string
}

export interface ReadinessReport {
  status: 'ok' | 'degraded'
  service: string
  checks: Record<string, DependencyStatus>
  timestamp: string
}

async function timed(fn: () => Promise<unknown>): Promise<DependencyStatus> {
  const start = Date.now()
  try {
    await fn()
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (err) {
    return { status: 'error', latencyMs: Date.now() - start, error: getErrorMessage(err) }
  }
}

/** Database connectivity (Postgres via Prisma). */
export function checkDatabase(): Promise<DependencyStatus> {
  return timed(() => db.$queryRaw`SELECT 1`)
}

/** Redis connectivity (cache + rate limiter backend). */
export function checkRedis(): Promise<DependencyStatus> {
  return timed(() => redis.ping())
}

/** BullMQ job queue connectivity (shares the Redis connection). */
export function checkQueue(): Promise<DependencyStatus> {
  return timed(() => emailQueue.client.then((client) => client.ping()))
}

/** Stellar Horizon RPC connectivity. */
export function checkHorizonRpc(): Promise<DependencyStatus> {
  return timed(async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3_000)
    try {
      const res = await fetch(config.horizonUrl, { signal: controller.signal })
      if (!res.ok) throw new Error(`Horizon RPC returned HTTP ${res.status}`)
    } finally {
      clearTimeout(timeout)
    }
  })
}

/**
 * Runs all critical downstream dependency checks and aggregates them into
 * a single readiness report. Used by /readyz and /ready — never by the
 * liveness probes (/healthz, /health), which must stay dependency-free.
 */
export async function buildReadinessReport(): Promise<ReadinessReport> {
  const [database, redisCheck, queue, horizon] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQueue(),
    checkHorizonRpc(),
  ])

  const checks: Record<string, DependencyStatus> = { database, redis: redisCheck, queue, horizon }
  const allOk = Object.values(checks).every((c) => c.status === 'ok')

  return {
    status: allOk ? 'ok' : 'degraded',
    service: 'bluecollar-api',
    checks,
    timestamp: new Date().toISOString(),
  }
}
