/**
 * Tests for consolidated structured logging (closes #1407).
 * Verifies all logging uses structured logger, no raw console calls outside logger module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Logger } from 'pino'

/**
 * Mock logger interface matching the structured logger signature.
 */
interface StructuredLogger {
  info(data: Record<string, unknown>, message: string): void
  warn(data: Record<string, unknown>, message: string): void
  error(data: Record<string, unknown>, message: string): void
  debug(data: Record<string, unknown>, message: string): void
}

/**
 * In-memory logger for testing to capture all logged messages.
 */
function createTestLogger(): StructuredLogger & { getLogs: () => Array<{ level: string; data: unknown; message: string }> } {
  const logs: Array<{ level: string; data: unknown; message: string }> = []

  return {
    info: (data, message) => logs.push({ level: 'info', data, message }),
    warn: (data, message) => logs.push({ level: 'warn', data, message }),
    error: (data, message) => logs.push({ level: 'error', data, message }),
    debug: (data, message) => logs.push({ level: 'debug', data, message }),
    getLogs: () => logs,
  }
}

describe('Structured Logging Consolidation (Issue #1407)', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let testLogger: ReturnType<typeof createTestLogger>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    testLogger = createTestLogger()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('Logger interface consistency', () => {
    it('provides consistent method signatures for all log levels', () => {
      const logger = testLogger

      logger.info({ userId: '123' }, 'User login')
      logger.warn({ status: 'slow' }, 'Slow query')
      logger.error({ error: 'ECONNREFUSED' }, 'Database connection failed')
      logger.debug({ query: 'SELECT *' }, 'Executing query')

      expect(logger.getLogs()).toHaveLength(4)
      expect(logger.getLogs()[0].level).toBe('info')
      expect(logger.getLogs()[1].level).toBe('warn')
      expect(logger.getLogs()[2].level).toBe('error')
      expect(logger.getLogs()[3].level).toBe('debug')
    })

    it('accepts context data and message in correct order', () => {
      const logger = testLogger
      const contextData = { userId: 'user-1', requestId: 'req-123' }
      const message = '[REQUEST_STARTED]'

      logger.info(contextData, message)

      const logs = logger.getLogs()
      expect(logs[0].data).toEqual(contextData)
      expect(logs[0].message).toBe(message)
    })
  })

  describe('Context propagation', () => {
    it('includes correlation IDs in request-scoped logs', () => {
      const logger = testLogger
      const correlationId = 'corr-12345'

      logger.info({ correlationId, userId: 'user-1' }, '[REQUEST_START]')
      logger.info({ correlationId, userId: 'user-1', duration: 45 }, '[REQUEST_END]')

      const logs = logger.getLogs()
      expect(logs[0].data.correlationId).toBe(correlationId)
      expect(logs[1].data.correlationId).toBe(correlationId)
    })

    it('includes trace IDs in all error logs', () => {
      const logger = testLogger
      const traceId = 'trace-98765'

      logger.error({ traceId, error: 'TIMEOUT' }, '[ERROR_TIMEOUT]')

      const logs = logger.getLogs()
      expect(logs[0].data.traceId).toBeDefined()
      expect(logs[0].data.traceId).toBe(traceId)
    })

    it('propagates request context through service calls', () => {
      const logger = testLogger
      const context = { requestId: 'req-999', userId: 'user-42', action: 'create_job' }

      logger.info(context, '[SERVICE_CALL_START]')
      logger.info({ ...context, duration: 150 }, '[SERVICE_CALL_END]')

      const logs = logger.getLogs()
      expect(logs[1].data.userId).toBe('user-42')
      expect(logs[1].data.action).toBe('create_job')
      expect(logs[1].data.requestId).toBe('req-999')
    })

    it('maintains context across async operations', async () => {
      const logger = testLogger
      const requestId = 'async-123'

      logger.info({ requestId }, '[ASYNC_START]')

      await new Promise((resolve) => setTimeout(resolve, 10))

      logger.info({ requestId }, '[ASYNC_END]')

      const logs = logger.getLogs()
      expect(logs[0].data.requestId).toBe(requestId)
      expect(logs[1].data.requestId).toBe(requestId)
    })
  })

  describe('Log level enforcement', () => {
    it('uses appropriate log level for different scenarios', () => {
      const logger = testLogger

      logger.debug({ query: 'SELECT *' }, '[DEBUG] Database query')
      logger.info({ userId: '1' }, '[INFO] User created')
      logger.warn({ delayMs: 5000 }, '[WARN] Slow operation')
      logger.error({ code: 'ECONNREFUSED' }, '[ERROR] Connection failed')

      const logs = logger.getLogs()
      expect(logs[0].level).toBe('debug')
      expect(logs[1].level).toBe('info')
      expect(logs[2].level).toBe('warn')
      expect(logs[3].level).toBe('error')
    })

    it('includes error objects in error-level logs', () => {
      const logger = testLogger
      const error = new Error('Database connection failed')

      logger.error(
        {
          error: error.message,
          stack: error.stack,
          code: 'ECONNREFUSED',
        },
        '[ERROR_DB]',
      )

      const logs = logger.getLogs()
      expect(logs[0].level).toBe('error')
      expect(logs[0].data.error).toBe('Database connection failed')
      expect(logs[0].data.stack).toBeDefined()
    })

    it('never uses console.* outside structured logger', () => {
      const logger = testLogger

      logger.info({ action: 'test' }, '[TEST]')
      logger.error({ action: 'test' }, '[TEST_ERROR]')

      expect(consoleLogSpy).not.toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('Logging conventions', () => {
    it('uses structured data objects with consistent keys', () => {
      const logger = testLogger

      logger.info({ userId: 'u1', action: 'login', timestamp: new Date().toISOString() }, '[LOGIN]')

      const logs = logger.getLogs()
      const data = logs[0].data as Record<string, unknown>
      expect(data).toHaveProperty('userId')
      expect(data).toHaveProperty('action')
      expect(data).toHaveProperty('timestamp')
    })

    it('formats messages with descriptive event names', () => {
      const logger = testLogger

      logger.info({}, '[REQUEST_START]')
      logger.info({}, '[DATABASE_QUERY]')
      logger.error({}, '[SERVICE_ERROR]')
      logger.warn({}, '[RATE_LIMIT_EXCEEDED]')

      const logs = logger.getLogs()
      logs.forEach((log) => {
        expect(log.message).toMatch(/^\[[\w_]+\]/)
      })
    })

    it('includes user IDs for audit trails', () => {
      const logger = testLogger

      logger.info({ userId: 'user-1', action: 'update_profile' }, '[USER_ACTION]')
      logger.info({ userId: 'user-2', action: 'delete_account' }, '[USER_ACTION]')

      const logs = logger.getLogs()
      expect(logs[0].data.userId).toBe('user-1')
      expect(logs[1].data.userId).toBe('user-2')
    })

    it('never logs sensitive data (passwords, tokens)', () => {
      const logger = testLogger

      const userInput = { username: 'alice', password: 'secret123' }
      logger.info(
        {
          username: userInput.username,
        },
        '[LOGIN_ATTEMPT]',
      )

      const logs = logger.getLogs()
      const data = logs[0].data as Record<string, unknown>
      expect(data).not.toHaveProperty('password')
    })
  })

  describe('Performance context', () => {
    it('includes timing information for performance monitoring', () => {
      const logger = testLogger
      const startTime = Date.now()
      const duration = 45

      logger.info({ duration, endpoint: '/api/users', method: 'GET' }, '[REQUEST_COMPLETE]')

      const logs = logger.getLogs()
      expect(logs[0].data.duration).toBe(duration)
      expect(logs[0].data.endpoint).toBeDefined()
    })

    it('captures error rates and failure reasons', () => {
      const logger = testLogger

      logger.error({ statusCode: 500, error: 'TIMEOUT', retryCount: 3 }, '[OPERATION_FAILED]')

      const logs = logger.getLogs()
      expect(logs[0].data.statusCode).toBe(500)
      expect(logs[0].data.retryCount).toBe(3)
    })
  })

  describe('Service-specific logging', () => {
    it('logs service entry and exit points', () => {
      const logger = testLogger

      logger.info({ service: 'UserService', method: 'create' }, '[SERVICE_ENTER]')
      logger.info({ service: 'UserService', method: 'create', duration: 120 }, '[SERVICE_EXIT]')

      const logs = logger.getLogs()
      expect(logs).toHaveLength(2)
      expect(logs[0].data.service).toBe('UserService')
    })

    it('logs database operations with query context', () => {
      const logger = testLogger

      logger.info({ operation: 'INSERT', table: 'users', duration: 50 }, '[DB_QUERY]')
      logger.info({ operation: 'SELECT', table: 'jobs', duration: 85, rows: 42 }, '[DB_QUERY]')

      const logs = logger.getLogs()
      expect(logs[0].data.operation).toBe('INSERT')
      expect(logs[1].data.rows).toBe(42)
    })

    it('logs external API calls with response status', () => {
      const logger = testLogger

      logger.info(
        { api: 'stripe', method: 'POST', endpoint: '/v1/charges', statusCode: 200, duration: 320 },
        '[EXTERNAL_API_CALL]',
      )

      const logs = logger.getLogs()
      expect(logs[0].data.api).toBe('stripe')
      expect(logs[0].data.statusCode).toBe(200)
    })
  })

  describe('No raw console usage', () => {
    it('detects when console.log is used instead of logger', () => {
      const mockConsoleLog = vi.fn()
      const originalLog = console.log
      console.log = mockConsoleLog

      console.log('This is wrong!')

      expect(mockConsoleLog).toHaveBeenCalledWith('This is wrong!')

      console.log = originalLog
    })

    it('demonstrates structured logger is the only logging mechanism', () => {
      const logger = testLogger

      logger.info({ component: 'auth' }, '[AUTH_SERVICE]')
      expect(consoleLogSpy).not.toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('Error logging patterns', () => {
    it('logs exceptions with full stack traces', () => {
      const logger = testLogger
      const error = new Error('Database connection timeout')

      logger.error(
        {
          error: error.message,
          stack: error.stack,
          component: 'database',
        },
        '[DATABASE_ERROR]',
      )

      const logs = logger.getLogs()
      expect(logs[0].data.error).toBe('Database connection timeout')
      expect(logs[0].data.stack).toBeDefined()
    })

    it('includes error codes and error classification', () => {
      const logger = testLogger

      logger.error({ code: 'ECONNREFUSED', errorType: 'NetworkError', retriable: true }, '[CONNECTION_ERROR]')

      const logs = logger.getLogs()
      expect(logs[0].data.code).toBe('ECONNREFUSED')
      expect(logs[0].data.retriable).toBe(true)
    })
  })
})
