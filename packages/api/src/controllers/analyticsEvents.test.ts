import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const debugMock = vi.hoisted(() => vi.fn())

vi.mock('@/utils/logger.js', () => ({
  createServiceLogger: () => ({ debug: debugMock, info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

import { recordEvents } from './analyticsEvents.js'

describe('recordEvents', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    debugMock.mockClear()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it('logger.debug is called with the events in development', async () => {
    process.env.NODE_ENV = 'development'
    const events = [{ event: 'view', category: 'worker', timestamp: '2026-01-01T00:00:00.000Z' }]
    const res = { json: vi.fn() }
    const next = vi.fn()

    await recordEvents({ body: { events } } as never, res as never, next)

    expect(debugMock).toHaveBeenCalledWith('Analytics events received', { events })
    expect(res.json).toHaveBeenCalledWith({ status: 'success', code: 200 })
  })

  it('does not log outside development', async () => {
    process.env.NODE_ENV = 'production'
    const events = [{ event: 'view', category: 'worker', timestamp: '2026-01-01T00:00:00.000Z' }]
    const res = { json: vi.fn() }

    await recordEvents({ body: { events } } as never, res as never, vi.fn())

    expect(debugMock).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalled()
  })
})
