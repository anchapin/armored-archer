import winston from 'winston';
import { config } from '../config';
import {
  captureRpcError as sentryCaptureRpcError,
  SessionContext,
  GameStateContext,
} from './errorTracking';
import { LogScrubber, logScrubber as defaultScrubber } from './logScrubber';

/**
 * Initialize log scrubber with configuration from config.
 */
function initializeLogScrubber(): LogScrubber {
  return new LogScrubber({
    enabled: config.logger.scrubLogs,
    additionalSensitiveFields: config.logger.additionalSensitiveFields,
    maxDepth: config.logger.maxScrubDepth,
  });
}

// Create the log scrubber instance with configuration
const logScrubberInstance = initializeLogScrubber();

/**
 * Custom format that scrubs sensitive data from log messages and metadata.
 */
const scrubFormat = winston.format((info: winston.Logform.TransformableInfo) => {
  const { message, ...meta } = info;

  // Scrub the message if it's a string
  let scrubbedMessage = message;
  if (typeof message === 'string') {
    const scrubbed = logScrubberInstance.scrubLog(message, meta as Record<string, unknown>);
    scrubbedMessage = scrubbed.message;
  }

  // Scrub metadata
  let scrubbedMeta = meta;
  if (typeof meta === 'object' && meta !== null) {
    scrubbedMeta = logScrubberInstance.scrub(meta) as Record<string, unknown>;
  }

  return {
    ...scrubbedMeta,
    message: scrubbedMessage,
  };
});

/**
 * Log levels for the application.
 * Uses custom levels for more granular control in different environments.
 */
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Color mappings for console output.
 */
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(logColors);

/**
 * Structured log metadata interface.
 * All structured logs should include this metadata for consistent formatting.
 */
export interface StructuredLogMetadata {
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
 * Creates a structured metadata object for RPC operations.
 *
 * @param options - RPC context options
 * @returns Structured metadata object
 */
export function createRpcMetadata(options: {
  rpcName: string;
  userId?: string;
  requestId?: string;
  payload?: unknown;
}): StructuredLogMetadata {
  const metadata: StructuredLogMetadata = {
    rpcName: options.rpcName,
  };

  if (options.userId) {
    metadata.userId = options.userId;
  }

  if (options.requestId) {
    metadata.requestId = options.requestId;
  }

  if (options.payload) {
    metadata.payload =
      typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload);
  }

  return metadata;
}

/**
 * Creates a metadata object for system events.
 *
 * @param event - The event name
 * @param data - Additional event data
 * @returns Structured metadata object
 */
export function createSystemEventMetadata(
  event: string,
  data: Record<string, unknown> = {}
): StructuredLogMetadata {
  return {
    event,
    ...data,
  };
}

/**
 * JSON format for structured logging.
 * Outputs logs in JSON format with consistent fields.
 * Includes log scrubbing to prevent sensitive data in logs.
 */
const jsonFormat = winston.format.combine(
  scrubFormat(),
  winston.format.timestamp({
    format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Console format for human-readable output.
 * Includes colors and formatted output for development.
 * Includes log scrubbing to prevent sensitive data in logs.
 */
const consoleFormat = winston.format.combine(
  scrubFormat(),
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.printf(
    ({ timestamp, level, message, ...meta }: winston.Logform.TransformableInfo) => {
      // Build structured context string
      const contextParts: string[] = [];
      if (meta.requestId) {
        contextParts.push(`req:${meta.requestId}`);
      }
      if (meta.userId) {
        contextParts.push(`user:${meta.userId}`);
      }
      if (meta.rpcName) {
        contextParts.push(`rpc:${meta.rpcName}`);
      }
      if (meta.event) {
        contextParts.push(`event:${meta.event}`);
      }
      if (meta.operation) {
        contextParts.push(`op:${meta.operation}`);
      }

      let msg = `${timestamp} [${level}]: ${message}`;
      if (contextParts.length > 0) {
        msg += ` [${contextParts.join(', ')}]`;
      }
      if (Object.keys(meta).length > 0) {
        // Filter out fields already shown in context
        const filteredMeta = { ...meta };
        delete filteredMeta.requestId;
        delete filteredMeta.userId;
        delete filteredMeta.rpcName;
        delete filteredMeta.event;
        delete filteredMeta.operation;
        if (Object.keys(filteredMeta).length > 0) {
          msg += ` ${JSON.stringify(filteredMeta)}`;
        }
      }
      return msg;
    }
  )
);

/**
 * Get the appropriate format based on configuration.
 */
function getFormat() {
  return config.logger.format === 'json' ? jsonFormat : consoleFormat;
}

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: getFormat(),
  }),
];

if (config.logger.output === 'file' || process.env.LOG_FILE_PATH) {
  const logFilePath = process.env.LOG_FILE_PATH || './logs/app.log';
  transports.push(
    new winston.transports.File({
      filename: logFilePath,
      format: jsonFormat,
      level: 'debug',
    }),
    new winston.transports.File({
      filename: logFilePath.replace('.log', '.error.log'),
      level: 'error',
      format: jsonFormat,
    })
  );
}

/**
 * Winston logger instance configured for structured logging.
 *
 * Features:
 * - Configurable log levels via LOG_LEVEL env var
 * - JSON and console output formats
 * - File output support
 * - Custom log levels for granular control
 */
export const logger = winston.createLogger({
  levels: logLevels,
  level: config.logger.level,
  format: jsonFormat,
  transports,
  exitOnError: false,
  defaultMeta: {
    environment: config.environment,
    service: 'armored-archer-backend',
  },
});

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Logs an RPC entry event.
 * Should be called at the beginning of RPC handler execution.
 *
 * @param rpcName - Name of the RPC being executed
 * @param userId - User ID making the request
 * @param requestId - Unique request identifier
 * @param payload - Optional request payload
 */
export function logRpcEntry(
  rpcName: string,
  userId: string,
  requestId: string,
  payload?: unknown
): void {
  logger.info('RPC entry', {
    rpc: rpcName,
    userId,
    requestId,
    payload: payload
      ? typeof payload === 'string'
        ? payload
        : JSON.stringify(payload)
      : undefined,
    operation: 'rpc_entry',
  });
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
export function logRpcExit(
  rpcName: string,
  userId: string,
  requestId: string,
  durationMs: number
): void {
  logger.info('RPC exit', {
    rpc: rpcName,
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
export function logRpcError(
  rpcName: string,
  userId: string,
  requestId: string,
  error: Error,
  durationMs: number
): void {
  logger.error('RPC error', {
    rpc: rpcName,
    userId,
    requestId,
    durationMs,
    error: error.message,
    stack: error.stack,
    operation: 'rpc_error',
  });
}

/**
 * Logs a system-level event.
 * Used for tracking system initialization, configuration changes, etc.
 *
 * @param level - Log level for the event
 * @param event - Event name
 * @param data - Additional event data
 */
export function logSystemEvent(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {}
): void {
  logger[level]('System event', {
    event,
    ...data,
    operation: 'system_event',
  });
}

/**
 * Logs a cache operation for debugging and monitoring.
 *
 * @param operation - Cache operation (hit, miss, set, delete)
 * @param cacheName - Name of the cache
 * @param key - Cache key
 * @param metadata - Additional metadata
 */
export function logCacheOperation(
  operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear',
  cacheName: string,
  key: string,
  metadata?: Record<string, unknown>
): void {
  logger.debug(`Cache ${operation}`, {
    cacheName,
    key,
    operation: `cache_${operation}`,
    ...metadata,
  });
}

/**
 * Logs database operation for debugging and monitoring.
 *
 * @param operation - Database operation type
 * @param collection - Storage collection name
 * @param metadata - Additional metadata
 */
export function logDatabaseOperation(
  operation: 'read' | 'write' | 'delete' | 'list',
  collection: string,
  metadata?: Record<string, unknown>
): void {
  logger.debug(`Database ${operation}`, {
    collection,
    operation: `db_${operation}`,
    ...metadata,
  });
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use logRpcError instead
 */
export function captureRpcError(
  rpcName: string,
  userId: string,
  error: Error,
  _payload?: string
): void {
  logRpcError(rpcName, userId, 'unknown', error, 0);
}

/**
 * Captures an RPC error with Sentry for error tracking.
 * This version supports extended context for better debugging.
 *
 * @param rpcName - Name of the RPC that errored
 * @param userId - User ID who made the request
 * @param requestId - Unique request identifier
 * @param error - The error that occurred
 * @param durationMs - Time taken before the error occurred
 * @param payload - Optional payload for debugging
 * @param sessionContext - Optional session context
 * @param gameStateContext - Optional game state context
 */
export function captureRpcErrorWithContext(
  rpcName: string,
  userId: string,
  requestId: string,
  error: Error,
  durationMs: number,
  payload?: string,
  sessionContext?: SessionContext,
  gameStateContext?: GameStateContext
): void {
  // Log the error locally
  logRpcError(rpcName, userId, requestId, error, durationMs);

  // Also send to Sentry with full context
  sentryCaptureRpcError(rpcName, userId, error, payload, sessionContext, gameStateContext);
}
