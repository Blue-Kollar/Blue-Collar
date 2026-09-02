import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { moderateAuthRateLimiter, strictAuthRateLimiter } from './rateLimiter.js'

describe('auth rate limiters', () => {
  it('returns 429 after 5 strict auth requests', async () => {
    const app = express()
    app.post('/api/auth/login', strictAuthRateLimiter, (_req, res) => res.status(401).json({ status: 'error' }))

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'wrong' })
    }

    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'wrong' })

    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBeDefined()
  })

  it('returns 429 after 20 moderate auth requests', async () => {
    const app = express()
    app.post('/api/auth/register', moderateAuthRateLimiter, (_req, res) => res.status(201).json({ status: 'success' }))

    for (let i = 0; i < 20; i += 1) {
      await request(app).post('/api/auth/register').send({ email: `u${i}@x.com`, password: 'password123' })
    }

    const res = await request(app).post('/api/auth/register').send({ email: 'new@x.com', password: 'password123' })

    expect(res.status).toBe(429)
  })
})
