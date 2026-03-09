/**
 * Structured Logger Module.
 * @fileoverview Provides structured logging for Nakama RPC handlers with JSON format.
 * Ensures all logs include: timestamp, level, message, and context.
 * Includes integration with log scrubbing for sensitive data protection.
 */

import { Runtime } from '../types/nakama';
import { logScrubber, LogScrubber } from './logScrubber';

/**
 * Log levels supported by the structured logger.
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Structured log context that provides additional metadata for log entries.
 */
export interface LogContext {
  /** Unique identifier for the request/operation */
  requestId?: string;
  /** User ID if applicable */
  userId?: string;
  /** RPC name for RPC operations */
  rpcName?: string;
  /** Operation name (e.g., 'cache_get', 'db_write') */
  operation?: string;
  /** Additional context-specific data */
  [key: string]: unknown;
}

/**
 * Structured log entry format.
 * All logs are output in this JSON format for easy parsing and analysis.
 */
export interface StructuredLogEntry {
  /** Timestamp in ISO 8601 format */
  timestamp: string;
  /** Log level (info, warn, error, debug) */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Context metadata */
  context: LogContext;
  /** Optional error stack trace */
  stack?: string;
  /** Service identifier */
  service: string;
}

/**
 * Creates a structured metadata object for RPC operations.
 *
 * @param options - RPC context options
 * @returns Structured metadata object
 */
export function createRpcContext(options: {
  rpcName: string;
  userId?: string;
  requestId?: string;
  payload?: unknown;
}): LogContext {
  const context: LogContext = {
    rpcName: options.rpcName,
  };

  if (options.userId) {
    context.userId = options.userId;
  }

  if (options.requestId) {
    context.requestId = options.requestId;
  }

  if (options.payload) {
    context.payload =
      typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload);
  }

  return context;
}

/**
 * Creates a metadata object for system events.
 *
 * @param event - The event name
 * @param data - Additional event data
 * @returns Structured metadata object
 */
export function createSystemEventContext(
  event: string,
  data: Record<string, unknown> = {}
): LogContext {
  return {
    event,
    ...data,
  };
}

/**
 * Structured Logger class that wraps Nakama's Runtime.Logger
 * and outputs logs in JSON format with structured context.
 *
 * Features:
 * - JSON output format for easy parsing
 * - Consistent log structure: timestamp, level, message, context
 * - Automatic context enrichment
 * - Integration with Nakama's logging system
 */
export class StructuredLogger {
  private readonly runtimeLogger: Runtime.Logger;
  private readonly serviceName: string;
  private defaultContext: LogContext;
  private scrubber: LogScrubber;

  /**
   * Creates a new StructuredLogger instance.
   *
   * @param runtimeLogger - The Nakama Runtime.Logger instance
   * @param serviceName - Name of the service (default: 'armored-archer-backend')
   * @param defaultContext - Default context to include in all logs
   * @param scrubber - Optional LogScrubber instance (defaults to global instance)
   */
  constructor(
    runtimeLogger: Runtime.Logger,
    serviceName: string = 'armored-archer-backend',
    defaultContext: LogContext = {},
    scrubber: LogScrubber = logScrubber
  ) {
    this.runtimeLogger = runtimeLogger;
    this.serviceName = serviceName;
    this.defaultContext = defaultContext;
    this.scrubber = scrubber;
  }

  /**
   * Creates a child logger with additional default context.
   *
   * @param additionalContext - Additional context to merge with default
   * @returns New StructuredLogger with enriched context
   */
  public child(additionalContext: LogContext): StructuredLogger {
    return new StructuredLogger(
      this.runtimeLogger,
      this.serviceName,
      {
        ...this.defaultContext,
        ...additionalContext,
      },
      this.scrubber
    );
  }

  /**
   * Scrubs sensitive data from message and context.
   *
   * @param level - Log level for per-level scrubbing
   * @param message - Log message
   * @param context - Log context
   * @returns Scrubbed message and context
   */
  private scrub(level: LogLevel, message: string, context: LogContext): {
    message: string;
    context: LogContext;
  } {
    if (!this.scrubber.isEnabled()) {
      return { message, context };
    }

    const scrubbed = this.scrubber.scrubLogByLevel(message, level, context);
    return {
      message: scrubbed.message,
      context: (scrubbed.meta as LogContext) || context,
    };
  }

  /**
   * Formats a log entry as JSON string.
   *
   * @param level - Log level
   * @param message - Log message
   * @param context - Log context
   * @param error - Optional error for stack trace
   * @returns JSON string representation of the log entry
   */
  private formatLogEntry(
    level: LogLevel,
    message: string,
    context: LogContext,
    error?: Error
  ): string {
    // Scrub sensitive data before formatting
    const { message: scrubbedMessage, context: scrubbedContext } = this.scrub(
      level,
      message,
      context
    );

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: scrubbedMessage,
      context: { ...this.defaultContext, ...scrubbedContext },
      service: this.serviceName,
    };

    if (error) {
      entry.stack = error.stack;
    }

    return JSON.stringify(entry);
  }

  /**
   * Logs an info level message.
   *
   * @param message - Log message
   * @param context - Log context
   */
  public info(message: string, context: LogContext = {}): void {
    const formattedLog = this.formatLogEntry('info', message, context);
    this.runtimeLogger.info(formattedLog);
  }

  /**
   * Logs a warn level message.
   *
   * @param message - Log message
   * @param context - Log context
   */
  public warn(message: string, context: LogContext = {}): void {
    const formattedLog = this.formatLogEntry('warn', message, context);
    this.runtimeLogger.warn(formattedLog);
  }

  /**
   * Logs an error level message.
   *
   * @param message - Log message
   * @param context - Log context
   * @param error - Optional error object for stack trace
   */
  public error(message: string, context: LogContext = {}, error?: Error): void {
    const formattedLog = this.formatLogEntry('error', message, context, error);
    this.runtimeLogger.error(formattedLog);
  }

  /**
   * Logs a debug level message.
   *
   * @param message - Log message
   * @param context - Log context
   */
  public debug(message: string, context: LogContext = {}): void {
    const formattedLog = this.formatLogEntry('debug', message, context);
    this.runtimeLogger.debug(formattedLog);
  }

  /**
   * Logs an RPC entry event.
   * Should be called at the beginning of RPC handler execution.
   *
   * @param rpcName - Name of the RPC being executed
   * @param userId - User ID making the request
   * @param requestId - Unique request identifier
   * @param payload - Optional request payload
   */
  public logRpcEntry(rpcName: string, userId: string, requestId: string, payload?: unknown): void {
    this.info('RPC entry', createRpcContext({ rpcName, userId, requestId, payload }));
  }

  /**
   * Logs an RPC exit event.
   * Should be called after successful RPC handler completion.
   *
   * @param rpcName - Name of the RPC that completed
   * @param userId - User ID who made the request
   * @param requestId - Unique request identifier
   * @param durationMs - Time taken to execute the RPC in milliseconds
   */
  public logRpcExit(rpcName: string, userId: string, requestId: string, durationMs: number): void {
    this.info('RPC exit', {
      rpcName,
      userId,
      requestId,
      durationMs,
      operation: 'rpc_exit',
    });
  }

  /**
   * Logs an RPC error event.
   * Should be called when an RPC handler throws an error.
   *
   * @param rpcName - Name of the RPC that errored
   * @param userId - User ID who made the request
   * @param requestId - Unique request identifier
   * @param error - The error that occurred
   * @param durationMs - Time taken before the error occurred
   */
  public logRpcError(
    rpcName: string,
    userId: string,
    requestId: string,
    error: Error,
    durationMs: number
  ): void {
    this.error(
      'RPC error',
      {
        rpcName,
        userId,
        requestId,
        durationMs,
        operation: 'rpc_error',
        errorMessage: error.message,
      },
      error
    );
  }

  /**
   * Logs a system-level event.
   * Used for tracking system initialization, configuration changes, etc.
   *
   * @param level - Log level for the event
   * @param event - Event name
   * @param data - Additional event data
   */
  public logSystemEvent(level: LogLevel, event: string, data: Record<string, unknown> = {}): void {
    this[level]('System event', createSystemEventContext(event, data));
  }

  /**
   * Logs a cache operation for debugging and monitoring.
   *
   * @param operation - Cache operation (hit, miss, set, delete)
   * @param cacheName - Name of the cache
   * @param key - Cache key
   * @param metadata - Additional metadata
   */
  public logCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear',
    cacheName: string,
    key: string,
    metadata?: Record<string, unknown>
  ): void {
    this.debug(`Cache ${operation}`, {
      cacheName,
      key,
      operation: `cache_${operation}`,
      ...metadata,
    });
  }

  /**
   * Logs database operation for debugging and monitoring.
   *
   * @operation - Database operation type
   * @param collection - Storage collection name
   * @param metadata - Additional metadata
   */
  public logDatabaseOperation(
    operation: 'read' | 'write' | 'delete' | 'list',
    collection: string,
    metadata?: Record<string, unknown>
  ): void {
    this.debug(`Database ${operation}`, {
      collection,
      operation: `db_${operation}`,
      ...metadata,
    });
  }
}

/**
 * Creates a new StructuredLogger instance.
 *
 * @param runtimeLogger - The Nakama Runtime.Logger instance
 * @param serviceName - Name of the service
 * @param defaultContext - Default context to include in all logs
 * @param scrubber - Optional LogScrubber instance (defaults to global instance)
 * @returns A new StructuredLogger instance
 */
export function createStructuredLogger(
  runtimeLogger: Runtime.Logger,
  serviceName: string = 'armored-archer-backend',
  defaultContext: LogContext = {},
  scrubber: LogScrubber = logScrubber
): StructuredLogger {
  return new StructuredLogger(runtimeLogger, serviceName, defaultContext, scrubber);
}
