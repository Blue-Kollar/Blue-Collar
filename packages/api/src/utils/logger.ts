import { logger as pinoLogger } from '@/config/logger.js'

/**
 * Standardized logger for service layer
 * Provides consistent log levels and context
 */
export class ServiceLogger {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  /**
   * Log info level message
   */
  info(message: string, data?: Record<string, unknown>) {
    pinoLogger.info({ context: this.context, ...data }, message)
  }

  /**
   * Log warning level message
   */
  warn(message: string, data?: Record<string, unknown>) {
    pinoLogger.warn({ context: this.context, ...data }, message)
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
    const errorData = error instanceof Error ? { error: error.message, stack: error.stack } : { error }
    pinoLogger.error({ context: this.context, ...errorData, ...data }, message)
  }

  /**
   * Log debug level message
   */
  debug(message: string, data?: Record<string, unknown>) {
    pinoLogger.debug({ context: this.context, ...data }, message)
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext: string) {
    return new ServiceLogger(`${this.context}:${childContext}`)
  }
}

/**
 * Factory function to create a logger for a service
 */
export function createServiceLogger(serviceName: string): ServiceLogger {
  return new ServiceLogger(serviceName)
}
