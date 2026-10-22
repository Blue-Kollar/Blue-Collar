import { gzipSync, brotliCompressSync, constants } from 'zlib'
import type { Request, Response, NextFunction } from 'express'

// Minimum response size (bytes) to bother compressing.
// Tiny payloads gain nothing and pay the CPU cost.
const MIN_SIZE = 512

/**
 * Response compression middleware supporting Brotli and Gzip.
 *
 * Intercepts res.json — which handles all JSON API responses — and compresses
 * the serialized payload when the client advertises Accept-Encoding support.
 * Brotli is preferred over gzip when both are offered.
 *
 * Brotli quality is capped at 4 (fast mode) so the CPU overhead stays low on
 * hot paths; the CloudFront CDN layer re-compresses at quality 11 for cached
 * responses served to end users (see docs/CDN_SETUP.md).
 *
 * Only payloads >= MIN_SIZE bytes are compressed; smaller ones are passed
 * through to avoid overhead for trivial responses.
 */
export function compress() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'HEAD') return next()

    const accept = String(req.headers['accept-encoding'] ?? '')
    const useBr = /\bbr\b/.test(accept)
    const useGzip = !useBr && /\bgzip\b/.test(accept)
    if (!useBr && !useGzip) return next()

    const origJson = res.json.bind(res)

    res.json = (body: unknown) => {
      const json = JSON.stringify(body)
      if (json.length < MIN_SIZE) return origJson(body)

      try {
        const buf = useBr
          ? brotliCompressSync(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
          : gzipSync(json, { level: 6 })

        res.setHeader('Content-Encoding', useBr ? 'br' : 'gzip')
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Vary', 'Accept-Encoding')
        res.removeHeader('Content-Length')
        res.end(buf)
      } catch {
        return origJson(body)
      }

      return res
    }

    next()
  }
}
