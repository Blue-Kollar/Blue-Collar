/**
 * Tests for admin export endpoints (#518)
 */
import type { Request, Response } from 'express'
import { beforeEach,describe, expect, it, vi } from 'vitest'

vi.mock('../db.js', () => ({
  db: {
    worker: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}))

vi.mock('../services/audit.service.js', () => ({
  log: vi.fn().mockResolvedValue(undefined),
}))

import { exportUsers,exportWorkers } from '../controllers/export.js'
import { db } from '../db.js'
import { log } from '../services/audit.service.js'

const mockWorkers = [
  {
    id: 'w-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-1234',
    isActive: true,
    isVerified: false,
    category: { name: 'Plumber' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
]

const mockUsers = [
  {
    id: 'u-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    verified: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
]

function makeRes() {
  const headers: Record<string, string> = {}
  let body: any
  const res = {
    setHeader: vi.fn((k: string, v: string) => { headers[k] = v }),
    json: vi.fn((b: any) => { body = b; return res }),
    send: vi.fn((b: any) => { body = b; return res }),
    status: vi.fn().mockReturnThis(),
    _headers: headers,
    _body: () => body,
  } as unknown as Response
  return res
}

function makeReq(query: Record<string, string> = {}, userId = 'admin-1') {
  return {
    query,
    user: { id: userId, role: 'admin' },
    ip: '127.0.0.1',
  } as unknown as Request
}

describe('exportWorkers', () => {
  beforeEach(() => {
    vi.mocked(db.worker.findMany).mockResolvedValue(mockWorkers as any)
  })

  it('returns JSON by default', async () => {
    const req = makeReq()
    const res = makeRes()
    await exportWorkers(req, res)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    expect(res.json).toHaveBeenCalled()
    const body = (res.json as any).mock.calls[0][0]
    expect(body.count).toBe(1)
    expect(body.data[0].name).toBe('John Doe')
  })

  it('returns CSV when format=csv', async () => {
    const req = makeReq({ format: 'csv' })
    const res = makeRes()
    await exportWorkers(req, res)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv')
    const csv = (res.send as any).mock.calls[0][0] as string
    expect(csv).toContain('id,name,email')
    expect(csv).toContain('John Doe')
  })

  it('logs audit event', async () => {
    const req = makeReq({ format: 'json' })
    const res = makeRes()
    await exportWorkers(req, res)
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.export', resource: 'Worker' }))
  })
})

describe('exportUsers', () => {
  beforeEach(() => {
    vi.mocked(db.user.findMany).mockResolvedValue(mockUsers as any)
  })

  it('returns JSON by default', async () => {
    const req = makeReq()
    const res = makeRes()
    await exportUsers(req, res)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    const body = (res.json as any).mock.calls[0][0]
    expect(body.count).toBe(1)
    expect(body.data[0].email).toBe('admin@example.com')
  })

  it('returns CSV when format=csv', async () => {
    const req = makeReq({ format: 'csv' })
    const res = makeRes()
    await exportUsers(req, res)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv')
    const csv = (res.send as any).mock.calls[0][0] as string
    expect(csv).toContain('id,email,firstName')
    expect(csv).toContain('admin@example.com')
  })

  it('logs audit event', async () => {
    const req = makeReq({ format: 'csv' })
    const res = makeRes()
    await exportUsers(req, res)
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.export', resource: 'User' }))
  })
})
