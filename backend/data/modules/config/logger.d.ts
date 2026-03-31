import winston from 'winston';
import { SessionContext, GameStateContext } from './errorTracking';
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
export declare function createRpcMetadata(options: {
    rpcName: string;
    userId?: string;
    requestId?: string;
    payload?: unknown;
}): StructuredLogMetadata;
/**
 * Creates a metadata object for system events.
 *
 * @param event - The event name
 * @param data - Additional event data
 * @returns Structured metadata object
 */
export declare function createSystemEventMetadata(event: string, data?: Record<string, unknown>): StructuredLogMetadata;
/**
 * Winston logger instance configured for structured logging.
 *
 * Features:
 * - Configurable log levels via LOG_LEVEL env var
 * - JSON and console output formats
 * - File output support
 * - Custom log levels for granular control
 */
export declare const logger: winston.Logger;
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
export declare function logRpcEntry(rpcName: string, userId: string, requestId: string, payload?: unknown): void;
/**
 * Logs an RPC exit event.
 * Should be called after successful RPC handler completion.
 *
 * @param rpcName - Name of the RPC that completed
 * @param userId - User ID who made the request
 * @param requestId - Unique request identifier
 * @param durationMs - Time taken to execute the RPC in milliseconds
 */
export declare function logRpcExit(rpcName: string, userId: string, requestId: string, durationMs: number): void;
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
export declare function logRpcError(rpcName: string, userId: string, requestId: string, error: Error, durationMs: number): void;
/**
 * Logs a system-level event.
 * Used for tracking system initialization, configuration changes, etc.
 *
 * @param level - Log level for the event
 * @param event - Event name
 * @param data - Additional event data
 */
export declare function logSystemEvent(level: LogLevel, event: string, data?: Record<string, unknown>): void;
/**
 * Logs a cache operation for debugging and monitoring.
 *
 * @param operation - Cache operation (hit, miss, set, delete)
 * @param cacheName - Name of the cache
 * @param key - Cache key
 * @param metadata - Additional metadata
 */
export declare function logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear' | 'destroy', cacheName: string, key: string, metadata?: Record<string, unknown>): void;
/**
 * Logs database operation for debugging and monitoring.
 *
 * @param operation - Database operation type
 * @param collection - Storage collection name
 * @param metadata - Additional metadata
 */
export declare function logDatabaseOperation(operation: 'read' | 'write' | 'delete' | 'list', collection: string, metadata?: Record<string, unknown>): void;
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
export declare function captureRpcErrorWithContext(rpcName: string, userId: string, requestId: string, error: Error, durationMs: number, payload?: string, sessionContext?: SessionContext, gameStateContext?: GameStateContext): void;
