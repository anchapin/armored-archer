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

import { Runtime } from '../types/nakama';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

// --- Configuration ---

export interface NPlusOneConfig {
  enabled: boolean;
  threshold: number; // Minimum queries to trigger warning
  logEnabled: boolean;
  metricsEnabled: boolean;
  slowQueryThresholdMs: number;
  autoTrackStorage: boolean;
}

const defaultConfig: NPlusOneConfig = {
  enabled: process.env.N_PLUS_ONE_ENABLED === 'true',
  threshold: parseInt(process.env.N_PLUS_ONE_THRESHOLD || '3', 10),
  logEnabled: process.env.N_PLUS_ONE_LOG_ENABLED !== 'false',
  metricsEnabled: process.env.N_PLUS_ONE_METRICS_ENABLED !== 'false',
  slowQueryThresholdMs: parseInt(process.env.N_PLUS_ONE_SLOW_QUERY_MS || '100', 10),
  autoTrackStorage: process.env.N_PLUS_ONE_AUTO_TRACK_STORAGE !== 'false',
};

let nPlusOneConfig: NPlusOneConfig = { ...defaultConfig };

// --- Query Tracking State ---

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

interface OperationContext {
  operationName: string;
  queries: QueryRecord[];
  startTime: number;
  isActive: boolean;
}

// Track queries per operation context
const operationContexts: Map<string, OperationContext> = new Map();

// Query statistics
interface QueryStats {
  totalQueries: number;
  totalDurationMs: number;
  byType: Record<string, { count: number; totalDurationMs: number }>;
  nPlusOneDetected: boolean;
  operationName?: string;
}

const queryStats: Map<string, QueryStats> = new Map();

// Global query counter
let globalQueryCount = 0;
let globalNPlusOneCount = 0;

// --- Prometheus Metrics ---

let nPlusOneDetectedCounter: Counter | null = null;
let queryDurationHistogram: Histogram | null = null;
let activeOperationsGauge: Gauge | null = null;
let nPlusOneAlertsGauge: Gauge | null = null;

function initializeMetrics(registry: Registry): void {
  if (!nPlusOneConfig.metricsEnabled) return;

  nPlusOneDetectedCounter = new Counter({
    name: 'armored_archer_n_plus_one_detected_total',
    help: 'Total number of N+1 query patterns detected',
    labelNames: ['operation', 'severity'] as const,
    registers: [registry],
  });

  queryDurationHistogram = new Histogram({
    name: 'armored_archer_query_duration_seconds',
    help: 'Query duration in seconds',
    labelNames: ['operation', 'query_type'] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [registry],
  });

  activeOperationsGauge = new Gauge({
    name: 'armored_archer_n_plus_one_active_operations',
    help: 'Number of currently tracked operations',
    registers: [registry],
  });

  nPlusOneAlertsGauge = new Gauge({
    name: 'armored_archer_n_plus_one_alerts',
    help: 'Current number of N+1 alerts',
    labelNames: ['operation'] as const,
    registers: [registry],
  });
}

// --- Query Tracking Functions ---

/**
 * Track a single database query operation
 */
export function trackQuery<T>(
  operationName: string,
  queryType: QueryRecord['queryType'],
  fn: () => T,
  options?: {
    collection?: string;
    key?: string;
    userId?: string;
  }
): T {
  if (!nPlusOneConfig.enabled) {
    return fn();
  }

  const startTime = performance.now();
  let success = true;

  try {
    return fn();
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const durationMs = performance.now() - startTime;
    globalQueryCount++;

    // Record the query
    const record: QueryRecord = {
      operation: operationName,
      queryType,
      timestamp: Date.now(),
      durationMs,
      collection: options?.collection,
      key: options?.key,
      userId: options?.userId,
      success,
    };

    // Add to current operation context
    const context = operationContexts.get(operationName);
    if (context && context.isActive) {
      context.queries.push(record);
    }

    // Update stats
    updateQueryStats(operationName, queryType, durationMs);

    // Emit metrics
    if (nPlusOneConfig.metricsEnabled && queryDurationHistogram) {
      queryDurationHistogram.observe(
        { operation: operationName, query_type: queryType },
        durationMs / 1000
      );
    }

    // Log slow queries
    if (nPlusOneConfig.logEnabled && durationMs > nPlusOneConfig.slowQueryThresholdMs) {
      console.log(
        `[N+1] Slow query detected: ${operationName} (${queryType}) took ${durationMs.toFixed(2)}ms`
      );
    }
  }
}

/**
 * Track an async database query operation
 */
export async function trackQueryAsync<T>(
  operationName: string,
  queryType: QueryRecord['queryType'],
  fn: () => Promise<T>,
  options?: {
    collection?: string;
    key?: string;
    userId?: string;
  }
): Promise<T> {
  if (!nPlusOneConfig.enabled) {
    return fn();
  }

  const startTime = performance.now();
  let success = true;

  try {
    return await fn();
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const durationMs = performance.now() - startTime;
    globalQueryCount++;

    // Record the query
    const record: QueryRecord = {
      operation: operationName,
      queryType,
      timestamp: Date.now(),
      durationMs,
      collection: options?.collection,
      key: options?.key,
      userId: options?.userId,
      success,
    };

    // Add to current operation context
    const context = operationContexts.get(operationName);
    if (context && context.isActive) {
      context.queries.push(record);
    }

    // Update stats
    updateQueryStats(operationName, queryType, durationMs);

    // Emit metrics
    if (nPlusOneConfig.metricsEnabled && queryDurationHistogram) {
      queryDurationHistogram.observe(
        { operation: operationName, query_type: queryType },
        durationMs / 1000
      );
    }

    // Log slow queries
    if (nPlusOneConfig.logEnabled && durationMs > nPlusOneConfig.slowQueryThresholdMs) {
      console.log(
        `[N+1] Slow query detected: ${operationName} (${queryType}) took ${durationMs.toFixed(2)}ms`
      );
    }
  }
}

/**
 * Update query statistics
 */
function updateQueryStats(
  operationName: string,
  queryType: string,
  durationMs: number
): void {
  let stats = queryStats.get(operationName);
  if (!stats) {
    stats = {
      totalQueries: 0,
      totalDurationMs: 0,
      byType: {},
      nPlusOneDetected: false,
    };
    queryStats.set(operationName, stats);
  }

  stats.totalQueries++;
  stats.totalDurationMs += durationMs;

  if (!stats.byType[queryType]) {
    stats.byType[queryType] = { count: 0, totalDurationMs: 0 };
  }
  stats.byType[queryType].count++;
  stats.byType[queryType].totalDurationMs += durationMs;
}

// --- Operation Context Management ---

/**
 * Start tracking an operation (e.g., an RPC handler)
 */
export function startOperationTracking(operationName: string): void {
  if (!nPlusOneConfig.enabled) return;

  const context: OperationContext = {
    operationName,
    queries: [],
    startTime: Date.now(),
    isActive: true,
  };

  operationContexts.set(operationName, context);

  if (activeOperationsGauge) {
    activeOperationsGauge.set(operationContexts.size);
  }
}

/**
 * Stop tracking an operation and check for N+1 patterns
 */
export function stopOperationTracking(
  operationName: string,
  logger?: Runtime.Logger
): { queryCount: number; nPlusOneDetected: boolean; warnings: string[] } {
  if (!nPlusOneConfig.enabled) {
    return { queryCount: 0, nPlusOneDetected: false, warnings: [] };
  }

  const context = operationContexts.get(operationName);
  if (!context) {
    return { queryCount: 0, nPlusOneDetected: false, warnings: [] };
  }

  context.isActive = false;
  const queryCount = context.queries.length;
  const warnings: string[] = [];

  // Detect N+1 patterns
  const nPlusOneResult = detectNPlusOnePatterns(context.queries, operationName);

  if (nPlusOneResult.detected) {
    globalNPlusOneCount++;
    const severity = queryCount > nPlusOneConfig.threshold * 3 ? 'critical' : 'warning';

    warnings.push(...nPlusOneResult.warnings);

    if (nPlusOneConfig.logEnabled) {
      const logMessage = `[N+1] ${severity.toUpperCase()}: ${operationName} - ${nPlusOneResult.summary}`;
      if (logger) {
        logger.warn(logMessage);
      } else {
        console.warn(logMessage);
      }
    }

    // Emit metrics
    if (nPlusOneConfig.metricsEnabled && nPlusOneDetectedCounter) {
      nPlusOneDetectedCounter.inc({ operation: operationName, severity });
    }

    if (nPlusOneAlertsGauge) {
      nPlusOneAlertsGauge.set({ operation: operationName }, queryCount);
    }
  }

  // Update stats with operation name
  const stats = queryStats.get(operationName);
  if (stats) {
    stats.nPlusOneDetected = nPlusOneResult.detected;
    stats.operationName = operationName;
  }

  // Clean up context
  operationContexts.delete(operationName);

  if (activeOperationsGauge) {
    activeOperationsGauge.set(operationContexts.size);
  }

  return {
    queryCount,
    nPlusOneDetected: nPlusOneResult.detected,
    warnings,
  };
}

/**
 * Detect N+1 patterns in query records
 */
function detectNPlusOnePatterns(
  queries: QueryRecord[],
  operationName: string
): { detected: boolean; warnings: string[]; summary: string } {
  if (queries.length < nPlusOneConfig.threshold) {
    return { detected: false, warnings: [], summary: '' };
  }

  const warnings: string[] = [];

  // Group queries by type and collection
  const byCollection = new Map<string, number>();
  const byType = new Map<string, number>();

  for (const query of queries) {
    const collectionKey = query.collection || query.key || 'unknown';
    byCollection.set(collectionKey, (byCollection.get(collectionKey) || 0) + 1);
    byType.set(query.queryType, (byType.get(query.queryType) || 0) + 1);
  }

  // Check for N+1 pattern: same collection queried multiple times
  for (const [collection, count] of byCollection) {
    if (count >= nPlusOneConfig.threshold) {
      warnings.push(
        `Potential N+1: ${count} queries to collection/key "${collection}" in ${operationName}`
      );
    }
  }

  // Check for high query count
  if (queries.length >= nPlusOneConfig.threshold * 2) {
    warnings.push(
      `High query count: ${queries.length} total queries in ${operationName} (threshold: ${nPlusOneConfig.threshold})`
    );
  }

  const detected = warnings.length > 0;
  const summary = detected
    ? `Found ${queries.length} queries with potential N+1 pattern`
    : '';

  return { detected, warnings, summary };
}

// --- Wrapper Functions ---

/**
 * Wrap a function with N+1 query tracking
 */
export function withNPlusOneTracking<T>(
  operationName: string,
  fn: () => T,
  logger?: Runtime.Logger
): T {
  startOperationTracking(operationName);
  try {
    return fn();
  } finally {
    stopOperationTracking(operationName, logger);
  }
}

/**
 * Wrap an async function with N+1 query tracking
 */
export async function withNPlusOneTrackingAsync<T>(
  operationName: string,
  fn: () => Promise<T>,
  logger?: Runtime.Logger
): Promise<T> {
  startOperationTracking(operationName);
  try {
    return await fn();
  } finally {
    stopOperationTracking(operationName, logger);
  }
}

// --- Configuration Functions ---

/**
 * Set N+1 detection configuration
 */
export function setNPlusOneConfig(config: Partial<NPlusOneConfig>): void {
  nPlusOneConfig = { ...nPlusOneConfig, ...config };
}

/**
 * Get current N+1 detection configuration
 */
export function getNPlusOneConfig(): NPlusOneConfig {
  return { ...nPlusOneConfig };
}

/**
 * Enable or disable N+1 detection
 */
export function setNPlusOneEnabled(enabled: boolean): void {
  nPlusOneConfig.enabled = enabled;
}

/**
 * Check if N+1 detection is enabled
 */
export function isNPlusOneEnabled(): boolean {
  return nPlusOneConfig.enabled;
}

// --- Report Functions ---

/**
 * Get query statistics for a specific operation
 */
export function getQueryStats(operationName: string): QueryStats | null {
  return queryStats.get(operationName) || null;
}

/**
 * Get all query statistics
 */
export function getAllQueryStats(): Map<string, QueryStats> {
  return new Map(queryStats);
}

/**
 * Get N+1 detection report
 */
export function getNPlusOneReport(): {
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
} {
  const operations: Array<{
    name: string;
    totalQueries: number;
    totalDurationMs: number;
    nPlusOneDetected: boolean;
    avgQueriesPerCall: number;
  }> = [];

  for (const [name, stats] of queryStats) {
    operations.push({
      name,
      totalQueries: stats.totalQueries,
      totalDurationMs: stats.totalDurationMs,
      nPlusOneDetected: stats.nPlusOneDetected,
      avgQueriesPerCall: stats.totalQueries, // Simplified - could track call count separately
    });
  }

  // Sort by total queries descending
  operations.sort((a, b) => b.totalQueries - a.totalQueries);

  return {
    globalQueryCount,
    globalNPlusOneCount,
    operations,
    config: { ...nPlusOneConfig },
  };
}

/**
 * Get formatted N+1 report for logging
 */
export function getFormattedNPlusOneReport(): string {
  const report = getNPlusOneReport();

  const lines: string[] = [];
  lines.push('=== N+1 Query Detection Report ===');
  lines.push(`Detection Enabled: ${report.config.enabled}`);
  lines.push(`Threshold: ${report.config.threshold} queries`);
  lines.push('');
  lines.push(`Global Query Count: ${report.globalQueryCount}`);
  lines.push(`Global N+1 Count: ${report.globalNPlusOneCount}`);
  lines.push('');

  if (report.operations.length === 0) {
    lines.push('No operations tracked.');
    return lines.join('\n');
  }

  lines.push('Top Operations (by query count):');
  lines.push(
    `${'Operation'.padEnd(40)} ${'Queries'.padEnd(10)} ${'Duration(ms)'.padEnd(15)} ${'N+1'.padEnd(6)}`
  );
  lines.push('-'.repeat(80));

  for (const op of report.operations.slice(0, 20)) {
    lines.push(
      `${op.name.substring(0, 40).padEnd(40)} ${op.totalQueries.toString().padEnd(10)} ${op.totalDurationMs.toFixed(2).padEnd(15)} ${op.nPlusOneDetected ? 'YES' : 'no'.padEnd(6)}`
    );
  }

  return lines.join('\n');
}

// --- Initialization ---

/**
 * Initialize N+1 detection module
 */
export function initializeNPlusOneDetection(
  logger?: Runtime.Logger,
<<<<<<< HEAD
  _appConfig?: { metrics?: { namespace?: string; prefix?: string; prometheusPort?: number } }
=======
  appConfig?: { metrics?: { namespace?: string; prefix?: string; prometheusPort?: number } }
>>>>>>> b269644 (feat: n_plus_one_detection implementation (#330))
): void {
  if (!nPlusOneConfig.enabled) {
    if (logger) {
      logger.info('N+1 detection is disabled');
    }
    return;
  }

  // Note: We can't directly add to the metrics registry here because
  // the metrics module has its own registry. The integration should be done
  // by calling initializeMetrics with the metrics registry from the metrics module.

  if (logger) {
    logger.info(
      `N+1 detection initialized - Enabled: ${nPlusOneConfig.enabled}, Threshold: ${nPlusOneConfig.threshold}, Log: ${nPlusOneConfig.logEnabled}, Metrics: ${nPlusOneConfig.metricsEnabled}`
    );
  }

  console.log(
    `[N+1] Detection initialized - Enabled: ${nPlusOneConfig.enabled}, Threshold: ${nPlusOneConfig.threshold}`
  );
}

/**
 * Initialize N+1 detection with metrics registry
 */
export function initializeNPlusOneDetectionWithMetrics(
  registry: Registry,
  logger?: Runtime.Logger
): void {
  initializeMetrics(registry);
  initializeNPlusOneDetection(logger);
}

/**
 * Reset all N+1 detection data
 */
export function resetNPlusOneDetection(): void {
  operationContexts.clear();
  queryStats.clear();
  globalQueryCount = 0;
  globalNPlusOneCount = 0;

  if (nPlusOneAlertsGauge) {
    nPlusOneAlertsGauge.set({}, 0);
  }
}

// --- RPC Integration ---

export type RpcHandler = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string | Promise<string>;

/**
 * Wrap an RPC handler with N+1 query tracking
 */
<<<<<<< HEAD
export function wrapRpcWithNPlusOneTracking(rpcName: string, handler: RpcHandler): RpcHandler {
=======
export function wrapRpcWithNPlusOneTracking(
  rpcName: string,
  handler: RpcHandler
): RpcHandler {
>>>>>>> b269644 (feat: n_plus_one_detection implementation (#330))
  return async function (
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): Promise<string> {
    const operationName = `rpc.${rpcName}`;

    if (nPlusOneConfig.enabled) {
      startOperationTracking(operationName);
    }

    try {
      const result = await handler(ctx, logger, nk, payload);
      return result;
    } finally {
      if (nPlusOneConfig.enabled) {
        stopOperationTracking(operationName, logger);
      }
    }
  };
}

/**
 * Register an RPC with N+1 query tracking
 */
export function registerRpcWithNPlusOneTracking(
  initializer: Runtime.Initializer,
  rpcId: string,
  rpcName: string,
  handler: RpcHandler
): void {
  const wrappedHandler = wrapRpcWithNPlusOneTracking(rpcName, handler);
  initializer.registerRpc(rpcId, wrappedHandler);
}

// --- Storage Operation Wrappers ---

/**
 * Wrap storageRead with N+1 tracking
 */
<<<<<<< HEAD
export function wrapStorageRead(
=======
export function wrapStorageRead<T>(
>>>>>>> b269644 (feat: n_plus_one_detection implementation (#330))
  nk: Runtime.Nakama,
  objects: Runtime.StorageRead[],
  operationName: string = 'storage_read'
): Runtime.StorageObject[] {
<<<<<<< HEAD
  return trackQuery(operationName, 'storage', () => nk.storageRead(objects), {
    collection: objects[0]?.collection,
    key: objects[0]?.key,
  });
=======
  return trackQuery(
    operationName,
    'storage',
    () => nk.storageRead(objects),
    { collection: objects[0]?.collection, key: objects[0]?.key }
  );
>>>>>>> b269644 (feat: n_plus_one_detection implementation (#330))
}

/**
 * Wrap storageWrite with N+1 tracking
 */
export function wrapStorageWrite(
  nk: Runtime.Nakama,
  objects: Runtime.StorageWrite[],
  operationName: string = 'storage_write'
): void {
<<<<<<< HEAD
  trackQuery(operationName, 'storage', () => nk.storageWrite(objects), {
    collection: objects[0]?.collection,
    key: objects[0]?.key,
  });
=======
  trackQuery(
    operationName,
    'storage',
    () => nk.storageWrite(objects),
    { collection: objects[0]?.collection, key: objects[0]?.key }
  );
>>>>>>> b269644 (feat: n_plus_one_detection implementation (#330))
}

/**
 * Wrap storageList with N+1 tracking
 */
export function wrapStorageList(
  nk: Runtime.Nakama,
  userId: string,
  collection: string,
  limit: number,
  cursor: string,
  operationName: string = 'storage_list'
): Runtime.StorageObject[] {
  return trackQuery(
    operationName,
    'storage',
    () => nk.storageList(userId, collection, limit, cursor, ''),
    { collection, userId }
  );
}

// Export types
export type { QueryRecord, QueryStats };
