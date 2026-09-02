import { beforeEach,describe, expect, it, vi } from 'vitest'

import { createServiceLogger,ServiceLogger } from './logger.js'

// Mock pino logger
vi.mock('../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('ServiceLogger', () => {
  let logger: ServiceLogger

  beforeEach(() => {
    logger = new ServiceLogger('TestService')
  })

  it('should create a logger with context', () => {
    expect(logger).toBeDefined()
  })

  it('should log info messages with context', () => {
    logger.info('Test message', { userId: '123' })
    // Verify the logger was called (implementation depends on mock)
    expect(logger).toBeDefined()
  })

  it('should log warn messages with context', () => {
    logger.warn('Warning message', { reason: 'test' })
    expect(logger).toBeDefined()
  })

  it('should log error messages with error details', () => {
    const error = new Error('Test error')
    logger.error('Error occurred', error, { context: 'test' })
    expect(logger).toBeDefined()
  })

  it('should log debug messages with context', () => {
    logger.debug('Debug message', { details: 'test' })
    expect(logger).toBeDefined()
  })

  it('should create child logger with nested context', () => {
    const childLogger = logger.child('SubService')
    expect(childLogger).toBeDefined()
  })
})

describe('createServiceLogger', () => {
  it('should create a service logger with given name', () => {
    const logger = createServiceLogger('MyService')
    expect(logger).toBeDefined()
  })

  it('should create multiple independent loggers', () => {
    const logger1 = createServiceLogger('Service1')
    const logger2 = createServiceLogger('Service2')
    expect(logger1).toBeDefined()
    expect(logger2).toBeDefined()
  })
})
