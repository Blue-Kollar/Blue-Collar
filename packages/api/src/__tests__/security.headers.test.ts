import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'
process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
process.env.GOOGLE_CLIENT_ID = 'test-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
process.env.APP_URL = 'http://localhost:3000'
process.env.MAIL_HOST = 'smtp.test.local'
process.env.MAIL_USER = 'test@test.com'
process.env.MAIL_PASS = 'test-pass'
process.env.MAIL_PORT = '587'

vi.mock('../routes/auth.js', () => ({ default: (_req: Request, _res: Response, next: NextFunction) => next() }))
vi.mock('../routes/categories.js', () => ({ default: (_req: Request, _res: Response, next: NextFunction) => next() }))
vi.mock('../routes/workers.js', () => ({ default: (_req: Request, _res: Response, next: NextFunction) => next() }))
vi.mock('../routes/portfolio.js', () => ({ default: (_req: Request, _res: Response, next: NextFunction) => next() }))
vi.mock('../routes/reviews.js', () => ({ default: (_req: Request, _res: Response, next: NextFunction) => next() }))
vi.mock('../routes/subscriptions.js', () => ({ default: (_req: Request, _res: Response, next: NextFunction) => next() }))
vi.mock('../monitoring/tracing.js', () => ({ initializeTracing: vi.fn() }))
vi.mock('../services/reminder.service.js', () => ({ startReminderScheduler: vi.fn() }))
vi.mock('../config/logger.js', () => ({ logger: { info: vi.fn() } }))
vi.mock('../config/passport.js', () => ({ default: { initialize: () => (_req: Request, _res: Response, next: NextFunction) => next() } }))
vi.mock('../websocket/server.js', () => ({ WebSocketServer: vi.fn() }))

describe('security headers', () => {
  it('sets key Helmet headers on GET /api/v1/workers', async () => {
    const { default: app } = await import('../index.js')
    const res = await request(app).get('/api/v1/workers')

    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/)
    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
