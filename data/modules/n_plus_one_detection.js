"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackQuery = trackQuery;
exports.trackQueryAsync = trackQueryAsync;
exports.startOperationTracking = startOperationTracking;
exports.stopOperationTracking = stopOperationTracking;
exports.withNPlusOneTracking = withNPlusOneTracking;
exports.withNPlusOneTrackingAsync = withNPlusOneTrackingAsync;
exports.setNPlusOneConfig = setNPlusOneConfig;
exports.getNPlusOneConfig = getNPlusOneConfig;
exports.setNPlusOneEnabled = setNPlusOneEnabled;
exports.isNPlusOneEnabled = isNPlusOneEnabled;
exports.getQueryStats = getQueryStats;
exports.getAllQueryStats = getAllQueryStats;
exports.getNPlusOneReport = getNPlusOneReport;
exports.getFormattedNPlusOneReport = getFormattedNPlusOneReport;
exports.initializeNPlusOneDetection = initializeNPlusOneDetection;
exports.initializeNPlusOneDetectionWithMetrics = initializeNPlusOneDetectionWithMetrics;
exports.resetNPlusOneDetection = resetNPlusOneDetection;
exports.wrapRpcWithNPlusOneTracking = wrapRpcWithNPlusOneTracking;
exports.registerRpcWithNPlusOneTracking = registerRpcWithNPlusOneTracking;
exports.wrapStorageRead = wrapStorageRead;
exports.wrapStorageWrite = wrapStorageWrite;
exports.wrapStorageList = wrapStorageList;
var tslib_1 = require("tslib");
var prom_client_1 = require("prom-client");
var logger_1 = require("../config/logger");
var defaultConfig = {
    enabled: process.env.N_PLUS_ONE_ENABLED === 'true',
    threshold: parseInt(process.env.N_PLUS_ONE_THRESHOLD || '3', 10),
    logEnabled: process.env.N_PLUS_ONE_LOG_ENABLED !== 'false',
    metricsEnabled: process.env.N_PLUS_ONE_METRICS_ENABLED !== 'false',
    slowQueryThresholdMs: parseInt(process.env.N_PLUS_ONE_SLOW_QUERY_MS || '100', 10),
    autoTrackStorage: process.env.N_PLUS_ONE_AUTO_TRACK_STORAGE !== 'false',
};
var nPlusOneConfig = tslib_1.__assign({}, defaultConfig);
// Track queries per operation context
var operationContexts = new Map();
var queryStats = new Map();
// Global query counter
var globalQueryCount = 0;
var globalNPlusOneCount = 0;
// --- Prometheus Metrics ---
var nPlusOneDetectedCounter = null;
var queryDurationHistogram = null;
var activeOperationsGauge = null;
var nPlusOneAlertsGauge = null;
function initializeMetrics(registry) {
    if (!nPlusOneConfig.metricsEnabled)
        return;
    nPlusOneDetectedCounter = new prom_client_1.Counter({
        name: 'armored_archer_n_plus_one_detected_total',
        help: 'Total number of N+1 query patterns detected',
        labelNames: ['operation', 'severity'],
        registers: [registry],
    });
    queryDurationHistogram = new prom_client_1.Histogram({
        name: 'armored_archer_query_duration_seconds',
        help: 'Query duration in seconds',
        labelNames: ['operation', 'query_type'],
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
        registers: [registry],
    });
    activeOperationsGauge = new prom_client_1.Gauge({
        name: 'armored_archer_n_plus_one_active_operations',
        help: 'Number of currently tracked operations',
        registers: [registry],
    });
    nPlusOneAlertsGauge = new prom_client_1.Gauge({
        name: 'armored_archer_n_plus_one_alerts',
        help: 'Current number of N+1 alerts',
        labelNames: ['operation'],
        registers: [registry],
    });
}
/**
 * Records query execution metrics and updates internal state.
 * This is the shared implementation for both sync and async query tracking.
 *
 * @param operationName - Name of the operation
 * @param queryType - Type of query (read, write, etc.)
 * @param durationMs - Duration of the query in milliseconds
 * @param success - Whether the query succeeded
 * @param options - Additional options (collection, key, userId)
 */
function recordQueryMetrics(operationName, queryType, durationMs, success, options) {
    // Record the query
    var record = {
        operation: operationName,
        queryType: queryType,
        timestamp: Date.now(),
        durationMs: durationMs,
        collection: options === null || options === void 0 ? void 0 : options.collection,
        key: options === null || options === void 0 ? void 0 : options.key,
        userId: options === null || options === void 0 ? void 0 : options.userId,
        success: success,
    };
    // Add to current operation context
    var context = operationContexts.get(operationName);
    if (context && context.isActive) {
        context.queries.push(record);
    }
    // Update stats
    updateQueryStats(operationName, queryType, durationMs);
    // Emit metrics
    if (nPlusOneConfig.metricsEnabled && queryDurationHistogram) {
        queryDurationHistogram.observe({ operation: operationName, query_type: queryType }, durationMs / 1000);
    }
    // Log slow queries
    if (nPlusOneConfig.logEnabled && durationMs > nPlusOneConfig.slowQueryThresholdMs) {
        logger_1.logger.info("Slow query detected: ".concat(operationName, " (").concat(queryType, ") took ").concat(durationMs.toFixed(2), "ms"));
    }
}
/**
 * Track a single database query operation
 */
function trackQuery(operationName, queryType, fn, options) {
    if (!nPlusOneConfig.enabled) {
        return fn();
    }
    var startTime = performance.now();
    var success = true;
    try {
        return fn();
    }
    catch (error) {
        success = false;
        throw error;
    }
    finally {
        var durationMs = performance.now() - startTime;
        globalQueryCount++;
        recordQueryMetrics(operationName, queryType, durationMs, success, options);
    }
}
/**
 * Track an async database query operation
 */
function trackQueryAsync(operationName, queryType, fn, options) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var startTime, success, error_1, durationMs;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!nPlusOneConfig.enabled) {
                        return [2 /*return*/, fn()];
                    }
                    startTime = performance.now();
                    success = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, fn()];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_1 = _a.sent();
                    success = false;
                    throw error_1;
                case 4:
                    durationMs = performance.now() - startTime;
                    globalQueryCount++;
                    recordQueryMetrics(operationName, queryType, durationMs, success, options);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Update query statistics
 */
function updateQueryStats(operationName, queryType, durationMs) {
    var stats = queryStats.get(operationName);
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
function startOperationTracking(operationName) {
    if (!nPlusOneConfig.enabled)
        return;
    var context = {
        operationName: operationName,
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
function stopOperationTracking(operationName, _logger) {
    if (!nPlusOneConfig.enabled) {
        return { queryCount: 0, nPlusOneDetected: false, warnings: [] };
    }
    var context = operationContexts.get(operationName);
    if (!context) {
        return { queryCount: 0, nPlusOneDetected: false, warnings: [] };
    }
    context.isActive = false;
    var queryCount = context.queries.length;
    var warnings = [];
    // Detect N+1 patterns
    var nPlusOneResult = detectNPlusOnePatterns(context.queries, operationName);
    if (nPlusOneResult.detected) {
        globalNPlusOneCount++;
        var severity = queryCount > nPlusOneConfig.threshold * 3 ? 'critical' : 'warning';
        warnings.push.apply(warnings, tslib_1.__spreadArray([], tslib_1.__read(nPlusOneResult.warnings), false));
        if (nPlusOneConfig.logEnabled) {
            var logMessage = "N+1 ".concat(severity.toUpperCase(), ": ").concat(operationName, " - ").concat(nPlusOneResult.summary);
            logger_1.logger.warn(logMessage);
        }
        // Emit metrics
        if (nPlusOneConfig.metricsEnabled && nPlusOneDetectedCounter) {
            nPlusOneDetectedCounter.inc({ operation: operationName, severity: severity });
        }
        if (nPlusOneAlertsGauge) {
            nPlusOneAlertsGauge.set({ operation: operationName }, queryCount);
        }
    }
    // Update stats with operation name
    var stats = queryStats.get(operationName);
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
        queryCount: queryCount,
        nPlusOneDetected: nPlusOneResult.detected,
        warnings: warnings,
    };
}
/**
 * Detect N+1 patterns in query records
 */
function detectNPlusOnePatterns(queries, operationName) {
    var e_1, _a, e_2, _b;
    if (queries.length < nPlusOneConfig.threshold) {
        return { detected: false, warnings: [], summary: '' };
    }
    var warnings = [];
    // Group queries by type and collection
    var byCollection = new Map();
    var byType = new Map();
    try {
        for (var queries_1 = tslib_1.__values(queries), queries_1_1 = queries_1.next(); !queries_1_1.done; queries_1_1 = queries_1.next()) {
            var query = queries_1_1.value;
            var collectionKey = query.collection || query.key || 'unknown';
            byCollection.set(collectionKey, (byCollection.get(collectionKey) || 0) + 1);
            byType.set(query.queryType, (byType.get(query.queryType) || 0) + 1);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (queries_1_1 && !queries_1_1.done && (_a = queries_1.return)) _a.call(queries_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    try {
        // Check for N+1 pattern: same collection queried multiple times
        for (var byCollection_1 = tslib_1.__values(byCollection), byCollection_1_1 = byCollection_1.next(); !byCollection_1_1.done; byCollection_1_1 = byCollection_1.next()) {
            var _c = tslib_1.__read(byCollection_1_1.value, 2), collection = _c[0], count = _c[1];
            if (count >= nPlusOneConfig.threshold) {
                warnings.push("Potential N+1: ".concat(count, " queries to collection/key \"").concat(collection, "\" in ").concat(operationName));
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (byCollection_1_1 && !byCollection_1_1.done && (_b = byCollection_1.return)) _b.call(byCollection_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    // Check for high query count
    if (queries.length >= nPlusOneConfig.threshold * 2) {
        warnings.push("High query count: ".concat(queries.length, " total queries in ").concat(operationName, " (threshold: ").concat(nPlusOneConfig.threshold, ")"));
    }
    var detected = warnings.length > 0;
    var summary = detected ? "Found ".concat(queries.length, " queries with potential N+1 pattern") : '';
    return { detected: detected, warnings: warnings, summary: summary };
}
// --- Wrapper Functions ---
/**
 * Wrap a function with N+1 query tracking
 */
function withNPlusOneTracking(operationName, fn, logger) {
    startOperationTracking(operationName);
    try {
        return fn();
    }
    finally {
        stopOperationTracking(operationName, logger);
    }
}
/**
 * Wrap an async function with N+1 query tracking
 */
function withNPlusOneTrackingAsync(operationName, fn, logger) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startOperationTracking(operationName);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, fn()];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    stopOperationTracking(operationName, logger);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// --- Configuration Functions ---
/**
 * Set N+1 detection configuration
 */
function setNPlusOneConfig(config) {
    nPlusOneConfig = tslib_1.__assign(tslib_1.__assign({}, nPlusOneConfig), config);
}
/**
 * Get current N+1 detection configuration
 */
function getNPlusOneConfig() {
    return tslib_1.__assign({}, nPlusOneConfig);
}
/**
 * Enable or disable N+1 detection
 */
function setNPlusOneEnabled(enabled) {
    nPlusOneConfig.enabled = enabled;
}
/**
 * Check if N+1 detection is enabled
 */
function isNPlusOneEnabled() {
    return nPlusOneConfig.enabled;
}
// --- Report Functions ---
/**
 * Get query statistics for a specific operation
 */
function getQueryStats(operationName) {
    return queryStats.get(operationName) || null;
}
/**
 * Get all query statistics
 */
function getAllQueryStats() {
    return new Map(queryStats);
}
/**
 * Get N+1 detection report
 */
function getNPlusOneReport() {
    var e_3, _a;
    var operations = [];
    try {
        for (var queryStats_1 = tslib_1.__values(queryStats), queryStats_1_1 = queryStats_1.next(); !queryStats_1_1.done; queryStats_1_1 = queryStats_1.next()) {
            var _b = tslib_1.__read(queryStats_1_1.value, 2), name = _b[0], stats = _b[1];
            operations.push({
                name: name,
                totalQueries: stats.totalQueries,
                totalDurationMs: stats.totalDurationMs,
                nPlusOneDetected: stats.nPlusOneDetected,
                avgQueriesPerCall: stats.totalQueries, // Simplified - could track call count separately
            });
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (queryStats_1_1 && !queryStats_1_1.done && (_a = queryStats_1.return)) _a.call(queryStats_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    // Sort by total queries descending
    operations.sort(function (a, b) { return b.totalQueries - a.totalQueries; });
    return {
        globalQueryCount: globalQueryCount,
        globalNPlusOneCount: globalNPlusOneCount,
        operations: operations,
        config: tslib_1.__assign({}, nPlusOneConfig),
    };
}
/**
 * Get formatted N+1 report for logging
 */
function getFormattedNPlusOneReport() {
    var e_4, _a;
    var report = getNPlusOneReport();
    var lines = [];
    lines.push('=== N+1 Query Detection Report ===');
    lines.push("Detection Enabled: ".concat(report.config.enabled));
    lines.push("Threshold: ".concat(report.config.threshold, " queries"));
    lines.push('');
    lines.push("Global Query Count: ".concat(report.globalQueryCount));
    lines.push("Global N+1 Count: ".concat(report.globalNPlusOneCount));
    lines.push('');
    if (report.operations.length === 0) {
        lines.push('No operations tracked.');
        return lines.join('\n');
    }
    lines.push('Top Operations (by query count):');
    lines.push("".concat('Operation'.padEnd(40), " ").concat('Queries'.padEnd(10), " ").concat('Duration(ms)'.padEnd(15), " ").concat('N+1'.padEnd(6)));
    lines.push('-'.repeat(80));
    try {
        for (var _b = tslib_1.__values(report.operations.slice(0, 20)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var op = _c.value;
            lines.push("".concat(op.name.substring(0, 40).padEnd(40), " ").concat(op.totalQueries.toString().padEnd(10), " ").concat(op.totalDurationMs.toFixed(2).padEnd(15), " ").concat(op.nPlusOneDetected ? 'YES' : 'no'.padEnd(6)));
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return lines.join('\n');
}
// --- Initialization ---
/**
 * Initialize N+1 detection module
 */
function initializeNPlusOneDetection(logger, _appConfig) {
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
        logger.info("N+1 detection initialized - Enabled: ".concat(nPlusOneConfig.enabled, ", Threshold: ").concat(nPlusOneConfig.threshold, ", Log: ").concat(nPlusOneConfig.logEnabled, ", Metrics: ").concat(nPlusOneConfig.metricsEnabled));
    }
    // Also log using the app logger
    logger_1.logger.info("Detection initialized - Enabled: ".concat(nPlusOneConfig.enabled, ", Threshold: ").concat(nPlusOneConfig.threshold));
}
/**
 * Initialize N+1 detection with metrics registry
 */
function initializeNPlusOneDetectionWithMetrics(registry, logger) {
    initializeMetrics(registry);
    initializeNPlusOneDetection(logger);
}
/**
 * Reset all N+1 detection data
 */
function resetNPlusOneDetection() {
    operationContexts.clear();
    queryStats.clear();
    globalQueryCount = 0;
    globalNPlusOneCount = 0;
    if (nPlusOneAlertsGauge) {
        nPlusOneAlertsGauge.set({}, 0);
    }
}
/**
 * Wrap an RPC handler with N+1 query tracking
 */
function wrapRpcWithNPlusOneTracking(rpcName, handler) {
    return function (ctx, logger, nk, payload) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var operationName, result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operationName = "rpc.".concat(rpcName);
                        if (nPlusOneConfig.enabled) {
                            startOperationTracking(operationName);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, handler(ctx, logger, nk, payload)];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 3:
                        if (nPlusOneConfig.enabled) {
                            stopOperationTracking(operationName, logger);
                        }
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
}
/**
 * Register an RPC with N+1 query tracking
 */
function registerRpcWithNPlusOneTracking(initializer, rpcId, rpcName, handler) {
    var wrappedHandler = wrapRpcWithNPlusOneTracking(rpcName, handler);
    initializer.registerRpc(rpcId, wrappedHandler);
}
// --- Storage Operation Wrappers ---
/**
 * Wrap storageRead with N+1 tracking
 */
function wrapStorageRead(nk, objects, operationName) {
    var _a, _b;
    if (operationName === void 0) { operationName = 'storage_read'; }
    return trackQuery(operationName, 'storage', function () { return nk.storageRead(objects); }, {
        collection: (_a = objects[0]) === null || _a === void 0 ? void 0 : _a.collection,
        key: (_b = objects[0]) === null || _b === void 0 ? void 0 : _b.key,
    });
}
/**
 * Wrap storageWrite with N+1 tracking
 */
function wrapStorageWrite(nk, objects, operationName) {
    var _a, _b;
    if (operationName === void 0) { operationName = 'storage_write'; }
    trackQuery(operationName, 'storage', function () { return nk.storageWrite(objects); }, {
        collection: (_a = objects[0]) === null || _a === void 0 ? void 0 : _a.collection,
        key: (_b = objects[0]) === null || _b === void 0 ? void 0 : _b.key,
    });
}
/**
 * Wrap storageList with N+1 tracking
 */
function wrapStorageList(nk, userId, collection, limit, cursor, operationName) {
    if (operationName === void 0) { operationName = 'storage_list'; }
    return trackQuery(operationName, 'storage', function () { return nk.storageList(userId, collection, limit, cursor, ''); }, { collection: collection, userId: userId });
}
