import { logger as pinoLogger } from '@/config/logger.js';

/**
 * Standardized logger for service layer
 * Provides consistent log levels and context
 */
export class ServiceLogger {
  private context: string;
  private requestId?: string;

  constructor(context: string, requestId?: string) {
    this.context = context;
    this.requestId = requestId;
  }

  /**
   * Build the base bindings forwarded to pino on every log call
   */
  private bindings(data?: Record<string, unknown>): Record<string, unknown> {
    return {
      context: this.context,
      ...(this.requestId ? { requestId: this.requestId } : {}),
      ...data,
    };
  }

  /**
   * Log info level message
   */
  info(message: string, data?: Record<string, unknown>) {
    pinoLogger.info(this.bindings(data), message);
  }

  /**
   * Log warning level message
   */
  warn(message: string, data?: Record<string, unknown>) {
    pinoLogger.warn(this.bindings(data), message);
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
    const errorData =
      error instanceof Error ? { error: error.message, stack: error.stack } : { error };
    pinoLogger.error(this.bindings({ ...errorData, ...data }), message);
  }

  /**
   * Log debug level message
   */
  debug(message: string, data?: Record<string, unknown>) {
    pinoLogger.debug(this.bindings(data), message);
  }

  /**
   * Create a child logger with additional context
   * Inherits the requestId from the parent logger
   */
  child(childContext: string) {
    return new ServiceLogger(`${this.context}:${childContext}`, this.requestId);
  }

  /**
   * Create a child logger bound to a specific request ID
   */
  withRequestId(requestId: string) {
    return new ServiceLogger(this.context, requestId);
  }
}

/**
 * Factory function to create a logger for a service
 */
export function createServiceLogger(serviceName: string, requestId?: string): ServiceLogger {
  return new ServiceLogger(serviceName, requestId);
}
