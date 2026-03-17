"use strict";
/**
 * N+1 Query Detection Utility
 *
 * This utility provides infrastructure for detecting N+1 query patterns
 * in the database layer. It can be used during development and testing
 * to identify performance issues.
 *
 * Usage:
 *   import { N1QueryDetector } from './utils/n1-query-detector';
 *
 *   // Wrap database operations
 *   const result = await N1QueryDetector.track(async () => {
 *     const players = await getAllPlayers();
 *     for (const player of players) {
 *       // Each iteration triggers a separate query - N+1 pattern
 *       const stats = await getPlayerStats(player.id);
 *     }
 *   });
 *
 *   if (result.n1Queries.length > 0) {
 *     console.warn('N+1 queries detected:', result.n1Queries);
 *   }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.N1QueryDetector = void 0;
var tslib_1 = require("tslib");
var N1QueryDetectorClass = /** @class */ (function () {
    function N1QueryDetectorClass() {
        this.queryLog = [];
        this.enabled = process.env.NODE_ENV !== 'production';
        this.threshold = 5; // Warn if more than 5 queries per operation
    }
    /**
     * Enable or disable query tracking
     */
    N1QueryDetectorClass.prototype.setEnabled = function (enabled) {
        this.enabled = enabled;
    };
    /**
     * Set the threshold for N+1 detection
     * @param threshold - Number of queries that triggers warning
     */
    N1QueryDetectorClass.prototype.setThreshold = function (threshold) {
        this.threshold = threshold;
    };
    /**
     * Log a query execution
     */
    N1QueryDetectorClass.prototype.logQuery = function (sql, duration, stackTrace) {
        if (!this.enabled)
            return;
        this.queryLog.push({
            sql: this.sanitizeSql(sql),
            timestamp: Date.now(),
            duration: duration,
            stackTrace: stackTrace,
        });
    };
    /**
     * Track and analyze queries for an operation
     */
    N1QueryDetectorClass.prototype.track = function (operation) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var previousLogLength, startTime, result, queries_1, operationDuration;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.enabled) {
                            return [2 /*return*/, operation()];
                        }
                        previousLogLength = this.queryLog.length;
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, operation()];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 3:
                        queries_1 = this.queryLog.slice(previousLogLength);
                        operationDuration = Date.now() - startTime;
                        // Mark queries with duration for analysis
                        queries_1.forEach(function (q, i) {
                            if (i > 0 && queries_1[i - 1].duration) {
                                q.duration = q.timestamp - queries_1[i - 1].timestamp;
                            }
                        });
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Analyze logged queries for N+1 patterns
     */
    N1QueryDetectorClass.prototype.analyze = function () {
        var e_1, _a;
        // Simple heuristic: detect repeated similar SELECT queries
        var selectQueries = this.queryLog.filter(function (q) {
            return q.sql.trim().toUpperCase().startsWith('SELECT');
        });
        var queryPatterns = new Map();
        var n1Queries = [];
        try {
            for (var selectQueries_1 = tslib_1.__values(selectQueries), selectQueries_1_1 = selectQueries_1.next(); !selectQueries_1_1.done; selectQueries_1_1 = selectQueries_1.next()) {
                var query = selectQueries_1_1.value;
                // Extract table name from query
                var tableMatch = query.sql.match(/FROM\s+(\w+)/i);
                if (tableMatch) {
                    var table = tableMatch[1].toLowerCase();
                    var count = queryPatterns.get(table) || 0;
                    queryPatterns.set(table, count + 1);
                    // If same table is queried more than threshold times, flag as N+1
                    if (count + 1 > this.threshold && !n1Queries.includes(table)) {
                        n1Queries.push(table);
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (selectQueries_1_1 && !selectQueries_1_1.done && (_a = selectQueries_1.return)) _a.call(selectQueries_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return {
            totalQueries: this.queryLog.length,
            n1Queries: n1Queries,
            queries: tslib_1.__spreadArray([], tslib_1.__read(this.queryLog), false),
            maxQueriesPerOperation: Math.max.apply(Math, tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(queryPatterns.values()), false), [0], false)),
        };
    };
    /**
     * Clear the query log
     */
    N1QueryDetectorClass.prototype.clear = function () {
        this.queryLog = [];
    };
    /**
     * Get recent queries
     */
    N1QueryDetectorClass.prototype.getRecentQueries = function (count) {
        if (count === void 0) { count = 10; }
        return this.queryLog.slice(-count);
    };
    /**
     * Sanitize SQL for logging (remove sensitive values)
     */
    N1QueryDetectorClass.prototype.sanitizeSql = function (sql) {
        // Remove string literals to avoid logging sensitive data
        return sql.replace(/'[^']*'/g, '?');
    };
    return N1QueryDetectorClass;
}());
exports.N1QueryDetector = new N1QueryDetectorClass();
exports.default = exports.N1QueryDetector;
