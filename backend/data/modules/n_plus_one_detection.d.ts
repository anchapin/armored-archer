/**
 * N+1 Query Detection Module
 *
 * This module provides runtime detection of N+1 query patterns in the Nakama backend.
 * It tracks database operations and detects when queries are executed inside loops,
 * which can cause significant performance issues.
 *
 * Detection Methods:
 * 1. Query Logging - Track all database operations with timing
 * 2. Pattern Detection - Identify N+1 patterns during runtime
 * 3. Static Analysis - Already implemented in scripts/detect-n-plus-one.ts
 *
 * Usage:
 *   // Wrap database operations with tracking
 *   import { trackQuery, detectNPlusOne, getNPlusOneReport } from './modules/n_plus_one_detection';
 *
 *   // Track individual queries
 *   const result = trackQuery('get_player_inventory', () => {
 *     return nk.storageRead([...]);
 *   });
 *
 *   // Or use the auto-detection feature
 *   initializeNPlusOneDetection(logger, config);
 *
 * Configuration:
 *   N_PLUS_ONE_ENABLED=true - Enable N+1 detection
 *   N_PLUS_ONE_THRESHOLD=3 - Minimum queries to trigger warning
 *   N_PLUS_ONE_LOG_ENABLED=true - Log warnings
 *   N_PLUS_ONE_METRICS_ENABLED=true - Emit metrics
 */
import { Registry } from 'prom-client';
import { Runtime } from '../types/nakama';
export interface NPlusOneConfig {
    enabled: boolean;
    threshold: number;
    logEnabled: boolean;
    metricsEnabled: boolean;
    slowQueryThresholdMs: number;
    autoTrackStorage: boolean;
}
interface QueryRecord {
    operation: string;
    queryType: 'storage' | 'database' | 'leaderboard' | 'match' | 'notification' | 'http';
    timestamp: number;
    durationMs: number;
    collection?: string;
    key?: string;
    userId?: string;
    success: boolean;
}
interface QueryStats {
    totalQueries: number;
    totalDurationMs: number;
    byType: Record<string, {
        count: number;
        totalDurationMs: number;
    }>;
    nPlusOneDetected: boolean;
    operationName?: string;
}
/**
 * Options for query tracking functions
 */
export interface QueryTrackingOptions {
    collection?: string;
    key?: string;
    userId?: string;
}
/**
 * Track a single database query operation
 */
export declare function trackQuery<T>(operationName: string, queryType: QueryRecord['queryType'], fn: () => T, options?: QueryTrackingOptions): T;
/**
 * Track an async database query operation
 */
export declare function trackQueryAsync<T>(operationName: string, queryType: QueryRecord['queryType'], fn: () => Promise<T>, options?: QueryTrackingOptions): Promise<T>;
/**
 * Start tracking an operation (e.g., an RPC handler)
 */
export declare function startOperationTracking(operationName: string): void;
/**
 * Stop tracking an operation and check for N+1 patterns
 */
export declare function stopOperationTracking(operationName: string, _logger?: Runtime.Logger): {
    queryCount: number;
    nPlusOneDetected: boolean;
    warnings: string[];
};
/**
 * Wrap a function with N+1 query tracking
 */
export declare function withNPlusOneTracking<T>(operationName: string, fn: () => T, logger?: Runtime.Logger): T;
/**
 * Wrap an async function with N+1 query tracking
 */
export declare function withNPlusOneTrackingAsync<T>(operationName: string, fn: () => Promise<T>, logger?: Runtime.Logger): Promise<T>;
/**
 * Set N+1 detection configuration
 */
export declare function setNPlusOneConfig(config: Partial<NPlusOneConfig>): void;
/**
 * Get current N+1 detection configuration
 */
export declare function getNPlusOneConfig(): NPlusOneConfig;
/**
 * Enable or disable N+1 detection
 */
export declare function setNPlusOneEnabled(enabled: boolean): void;
/**
 * Check if N+1 detection is enabled
 */
export declare function isNPlusOneEnabled(): boolean;
/**
 * Get query statistics for a specific operation
 */
export declare function getQueryStats(operationName: string): QueryStats | null;
/**
 * Get all query statistics
 */
export declare function getAllQueryStats(): Map<string, QueryStats>;
/**
 * Get N+1 detection report
 */
export declare function getNPlusOneReport(): {
    globalQueryCount: number;
    globalNPlusOneCount: number;
    operations: Array<{
        name: string;
        totalQueries: number;
        totalDurationMs: number;
        nPlusOneDetected: boolean;
        avgQueriesPerCall: number;
    }>;
    config: NPlusOneConfig;
};
/**
 * Get formatted N+1 report for logging
 */
export declare function getFormattedNPlusOneReport(): string;
/**
 * Initialize N+1 detection module
 */
export declare function initializeNPlusOneDetection(logger?: Runtime.Logger, _appConfig?: {
    metrics?: {
        namespace?: string;
        prefix?: string;
        prometheusPort?: number;
    };
}): void;
/**
 * Initialize N+1 detection with metrics registry
 */
export declare function initializeNPlusOneDetectionWithMetrics(registry: Registry, logger?: Runtime.Logger): void;
/**
 * Reset all N+1 detection data
 */
export declare function resetNPlusOneDetection(): void;
export type RpcHandler = (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => string | Promise<string>;
/**
 * Wrap an RPC handler with N+1 query tracking
 */
export declare function wrapRpcWithNPlusOneTracking(rpcName: string, handler: RpcHandler): RpcHandler;
/**
 * Register an RPC with N+1 query tracking
 */
export declare function registerRpcWithNPlusOneTracking(initializer: Runtime.Initializer, rpcId: string, rpcName: string, handler: RpcHandler): void;
/**
 * Wrap storageRead with N+1 tracking
 */
export declare function wrapStorageRead(nk: Runtime.Nakama, objects: Runtime.StorageRead[], operationName?: string): Runtime.StorageObject[];
/**
 * Wrap storageWrite with N+1 tracking
 */
export declare function wrapStorageWrite(nk: Runtime.Nakama, objects: Runtime.StorageWrite[], operationName?: string): void;
/**
 * Wrap storageList with N+1 tracking
 */
export declare function wrapStorageList(nk: Runtime.Nakama, userId: string, collection: string, limit: number, cursor: string, operationName?: string): Runtime.StorageObject[];
export type { QueryRecord, QueryStats };
