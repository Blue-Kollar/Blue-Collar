import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

// In-memory fake of the Redis sorted-set operations createRateLimiter relies
// on, so the sliding-window count actually increments per request without
// needing a live Redis instance.
const counts = new Map<string, number>()

vi.mock('../config/redis.js', () => ({
  redis: {
    pipeline: () => {
      const ops: Array<{ cmd: string; key: string }> = []
      const chain = {
        zremrangebyscore: (key: string) => { ops.push({ cmd: 'zremrangebyscore', key }); return chain },
        zadd: (key: string) => { ops.push({ cmd: 'zadd', key }); return chain },
        zcard: (key: string) => { ops.push({ cmd: 'zcard', key }); return chain },
        expire: (key: string) => { ops.push({ cmd: 'expire', key }); return chain },
        exec: async () => ops.map(({ cmd, key }) => {
          if (cmd === 'zadd') counts.set(key, (counts.get(key) ?? 0) + 1)
          if (cmd === 'zcard') return [null, counts.get(key) ?? 0]
          return [null, null]
        }),
      }
      return chain
    },
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  },
}))

describe('createRateLimiter (jobs/disputes/payments mutation endpoints)', () => {
  it('returns a standard 429 response with Retry-After once the threshold is exceeded', async () => {
    const { createRateLimiter } = await import('./rateLimit.js')
    const { JOBS_WRITE } = await import('../config/rateLimits.js')

    // Tiny limit so the test triggers the threshold quickly.
    const tinyLimiter = createRateLimiter({ ...JOBS_WRITE, authLimit: 2, burstAllowance: 0, windowSec: 60 })

    const app = express()
    app.use((req, _res, next) => {
      ;(req as unknown as { user: { id: string; role: string } }).user = { id: 'u1', role: 'worker' }
      next()
    })
    app.post('/jobs', tinyLimiter, (_req, res) => res.status(201).json({ status: 'success' }))

    const responses = []
    for (let i = 0; i < 4; i += 1) {
      responses.push(await request(app).post('/jobs').send({ title: `job ${i}` }))
    }

    const limited = responses.find((r) => r.status === 429)
    expect(limited).toBeDefined()
    expect(limited?.body).toMatchObject({ status: 'error', code: 429 })
    expect(limited?.headers['retry-after']).toBeDefined()
  })
})
