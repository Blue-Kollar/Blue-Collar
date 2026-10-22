import { createHash } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { Counter, Gauge } from 'prom-client'

// ── Prometheus metrics for cache-hit ratio tracking ──────────────────────────

const etagHitsTotal = new Counter({
  name: 'http_etag_hits_total',
  help: 'Responses served as 304 Not Modified via ETag match',
})

const etagMissesTotal = new Counter({
  name: 'http_etag_misses_total',
  help: 'Full responses sent (ETag absent or mismatch)',
})

const cacheHitRatio = new Gauge({
  name: 'http_cache_hit_ratio',
  help: 'Rolling HTTP ETag cache-hit ratio (304 hits / total conditionals)',
})

let _hits = 0
let _misses = 0

function track(isHit: boolean) {
  if (isHit) {
    _hits++
    etagHitsTotal.inc()
  } else {
    _misses++
    etagMissesTotal.inc()
  }
  const total = _hits + _misses
  cacheHitRatio.set(total > 0 ? _hits / total : 0)
}

// ── Middleware factories ──────────────────────────────────────────────────────

/**
 * Applies Cache-Control and ETag headers to safe GET/HEAD responses.
 * Returns 304 Not Modified when the client's If-None-Match matches the
 * current ETag, eliminating unnecessary payload transfer.
 *
 * Per CDN_SETUP.md the CloudFront distribution forwards the ETag so
 * edge-cached responses also benefit from conditional revalidation.
 *
 * @param maxAge - TTL in seconds cached by the client/CDN (default: 300)
 * @param opts.isPublic - Allow CDN/proxy caching; default true
 * @param opts.swr - stale-while-revalidate seconds appended to the directive
 */
export function apiCacheHeaders(
  maxAge = 300,
  opts: { isPublic?: boolean; swr?: number } = {},
) {
  const visibility = opts.isPublic !== false ? 'public' : 'private'

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    const origJson = res.json.bind(res)

    res.json = (body: unknown) => {
      const payload = JSON.stringify(body)
      const etag = `"${createHash('sha1').update(payload).digest('hex').slice(0, 16)}"`

      const directives = [visibility, `max-age=${maxAge}`, 'must-revalidate']
      if (opts.swr) directives.push(`stale-while-revalidate=${opts.swr}`)

      res.setHeader('Cache-Control', directives.join(', '))
      res.setHeader('ETag', etag)

      if (req.headers['if-none-match'] === etag) {
        track(true)
        res.status(304).end()
        return res
      }

      track(false)
      return origJson(body)
    }

    next()
  }
}

/**
 * Sets long-lived immutable Cache-Control headers for versioned static assets
 * served through the CDN (S3 + CloudFront).  Per CDN_SETUP.md assets are
 * uploaded with content-hashed filenames so TTL can safely be 1 year.
 */
export function staticAssetCacheHeaders() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    next()
  }
}

/**
 * Prevents all caching for auth endpoints, mutations, and user-specific data.
 */
export function noCacheHeaders() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    next()
  }
}
