import { describe, expect, it, vi } from 'vitest'

import { appEvents } from '../events/app-events.js'

describe('AppEventEmitter', () => {
  it('emits and receives typed events', () => {
    const handler = vi.fn()
    appEvents.on('worker.created', handler)
    appEvents.emit('worker.created', { workerId: 'w1', curatorId: 'u1' })
    expect(handler).toHaveBeenCalledWith({ workerId: 'w1', curatorId: 'u1' })
    appEvents.off('worker.created', handler)
  })

  it('once() fires only once', () => {
    const handler = vi.fn()
    appEvents.once('worker.deleted', handler)
    appEvents.emit('worker.deleted', { workerId: 'w2' })
    appEvents.emit('worker.deleted', { workerId: 'w2' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('off() removes listener', () => {
    const handler = vi.fn()
    appEvents.on('worker.toggled', handler)
    appEvents.off('worker.toggled', handler)
    appEvents.emit('worker.toggled', { workerId: 'w3', isActive: false })
    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple event types', () => {
    const workerHandler = vi.fn()
    const userHandler = vi.fn()
    appEvents.on('worker.updated', workerHandler)
    appEvents.on('user.registered', userHandler)
    appEvents.emit('worker.updated', { workerId: 'w4', curatorId: 'u2' })
    appEvents.emit('user.registered', { userId: 'u3', email: 'a@b.com' })
    expect(workerHandler).toHaveBeenCalledOnce()
    expect(userHandler).toHaveBeenCalledOnce()
    appEvents.off('worker.updated', workerHandler)
    appEvents.off('user.registered', userHandler)
  })
})
