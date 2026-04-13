"use strict";
/**
 * Profiling Instrumentation Module
 *
 * Provides runtime profiling capabilities for the Nakama backend.
 * This module wraps critical code paths with timing instrumentation
 * and integrates with the existing metrics system.
 *
 * Profiling Tools:
 * - Built-in timing instrumentation (this module)
 * - 0x - Flame graph profiler (npm package)
 * - clinic.js - Doctor, Bubbleprof, and Flame profiling
 * - Node.js built-in profiler (--prof, --inspect)
 *
 * Usage:
 *   // In your RPC handler
 *   import { profileFunction } from './modules/profiling';
 *
 *   async function myHandler(ctx, logger, nk, payload) {
 *     return profileFunction('my_handler', async () => {
 *       // ... handler code ...
 *     });
 *   }
 *
 * Production Profiling:
 *   # Using 0x for flame graphs
 *   npx 0x npm run dev
 *
 *   # Using clinic.js for flame graphs
 *   npx clinic doctor -- node build/index.js
 *   npx clinic flame -- node build/index.js
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileSync = profileSync;
exports.profileAsync = profileAsync;
exports.profileFunction = profileFunction;
exports.createProfileBlock = createProfileBlock;
exports.setProfilingConfig = setProfilingConfig;
exports.getProfilingConfig = getProfilingConfig;
exports.setProfilingEnabled = setProfilingEnabled;
exports.isProfilingEnabled = isProfilingEnabled;
exports.getProfileData = getProfileData;
exports.getAllProfileData = getAllProfileData;
exports.getProfileReport = getProfileReport;
exports.getFormattedProfileReport = getFormattedProfileReport;
exports.clearProfileData = clearProfileData;
exports.resetProfiling = resetProfiling;
exports.wrapRpcWithProfiling = wrapRpcWithProfiling;
exports.registerRpcWithProfiling = registerRpcWithProfiling;
exports.initializeProfiling = initializeProfiling;
exports.logProfileReport = logProfileReport;
exports.profileMethod = profileMethod;
exports.profileCriticalPath = profileCriticalPath;
var tslib_1 = require("tslib");
var logger_1 = require("../config/logger");
var defaultConfig = {
    enabled: process.env.PROFILING_ENABLED === 'true',
    slowThresholdMs: parseInt(process.env.PROFILING_SLOW_THRESHOLD_MS || '100', 10),
    logSlowOperations: process.env.PROFILING_LOG_SLOW !== 'false',
};
var profilingConfig = tslib_1.__assign({}, defaultConfig);
var profileData = new Map();
// --- Profiling Utilities ---
/**
 * Get or create profile data for a given name
 */
function getOrCreateProfileData(name) {
    var data = profileData.get(name);
    if (!data) {
        data = {
            callCount: 0,
            totalTimeMs: 0,
            minTimeMs: Number.MAX_SAFE_INTEGER,
            maxTimeMs: 0,
            errors: 0,
            lastCalled: 0,
        };
        profileData.set(name, data);
    }
    return data;
}
/**
 * Profile a synchronous function
 */
function profileSync(name, fn) {
    if (!profilingConfig.enabled) {
        return fn();
    }
    var startTime = hrtimeMs();
    var result;
    var error = null;
    try {
        result = fn();
    }
    catch (e) {
        error = e;
        throw e;
    }
    finally {
        var duration = hrtimeMs() - startTime;
        recordProfileData(name, duration, error);
    }
    return result;
}
/**
 * Profile an async function
 */
function profileAsync(name, fn) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var startTime, result, error, e_1, duration;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!profilingConfig.enabled) {
                        return [2 /*return*/, fn()];
                    }
                    startTime = hrtimeMs();
                    error = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, fn()];
                case 2:
                    result = _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    e_1 = _a.sent();
                    error = e_1;
                    throw e_1;
                case 4:
                    duration = hrtimeMs() - startTime;
                    recordProfileData(name, duration, error);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/, result];
            }
        });
    });
}
/**
 * Profile a function (works with both sync and async)
 * Detects the type automatically
 */
function profileFunction(name, fn) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var isAsync;
        return tslib_1.__generator(this, function (_a) {
            if (!profilingConfig.enabled) {
                return [2 /*return*/, fn()];
            }
            isAsync = fn.constructor.name === 'AsyncFunction';
            if (isAsync) {
                return [2 /*return*/, profileAsync(name, fn)];
            }
            else {
                return [2 /*return*/, profileSync(name, fn)];
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Create a profile block that automatically records timing
 * when the returned function is called and completes
 */
function createProfileBlock(name) {
    var startTime = hrtimeMs();
    return {
        end: function () {
            if (profilingConfig.enabled) {
                var duration = hrtimeMs() - startTime;
                recordProfileData(name, duration, null);
            }
        },
        getDuration: function () { return hrtimeMs() - startTime; },
    };
}
/**
 * High-resolution time in milliseconds
 */
function hrtimeMs() {
    var _a = tslib_1.__read(process.hrtime(), 2), seconds = _a[0], nanoseconds = _a[1];
    return seconds * 1000 + nanoseconds / 1e6;
}
/**
 * Record profiling data
 */
function recordProfileData(name, durationMs, error) {
    var data = getOrCreateProfileData(name);
    data.callCount++;
    data.totalTimeMs += durationMs;
    data.minTimeMs = Math.min(data.minTimeMs, durationMs);
    data.maxTimeMs = Math.max(data.maxTimeMs, durationMs);
    data.lastCalled = Date.now();
    if (error) {
        data.errors++;
    }
    // Log slow operations
    if (profilingConfig.logSlowOperations && durationMs > profilingConfig.slowThresholdMs) {
        logger_1.logger.info("Slow operation: ".concat(name, " took ").concat(durationMs.toFixed(2), "ms (threshold: ").concat(profilingConfig.slowThresholdMs, "ms)"));
    }
}
// --- Profiling Configuration ---
/**
 * Update profiling configuration
 */
function setProfilingConfig(config) {
    profilingConfig = tslib_1.__assign(tslib_1.__assign({}, profilingConfig), config);
}
/**
 * Get current profiling configuration
 */
function getProfilingConfig() {
    return tslib_1.__assign({}, profilingConfig);
}
/**
 * Enable or disable profiling
 */
function setProfilingEnabled(enabled) {
    profilingConfig.enabled = enabled;
}
/**
 * Check if profiling is enabled
 */
function isProfilingEnabled() {
    return profilingConfig.enabled;
}
// --- Profile Data Retrieval ---
/**
 * Get profile data for a specific operation
 */
function getProfileData(name) {
    return profileData.get(name) || null;
}
/**
 * Get all profile data
 */
function getAllProfileData() {
    return new Map(profileData);
}
/**
 * Get profile report as array sorted by total time
 */
function getProfileReport() {
    var e_2, _a;
    var report = [];
    try {
        for (var profileData_1 = tslib_1.__values(profileData), profileData_1_1 = profileData_1.next(); !profileData_1_1.done; profileData_1_1 = profileData_1.next()) {
            var _b = tslib_1.__read(profileData_1_1.value, 2), name = _b[0], data = _b[1];
            report.push({
                name: name,
                callCount: data.callCount,
                totalTimeMs: data.totalTimeMs,
                avgTimeMs: data.callCount > 0 ? data.totalTimeMs / data.callCount : 0,
                minTimeMs: data.minTimeMs === Number.MAX_SAFE_INTEGER ? 0 : data.minTimeMs,
                maxTimeMs: data.maxTimeMs,
                errors: data.errors,
                errorRate: data.callCount > 0 ? data.errors / data.callCount : 0,
                lastCalled: data.lastCalled,
            });
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (profileData_1_1 && !profileData_1_1.done && (_a = profileData_1.return)) _a.call(profileData_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    // Sort by total time descending
    report.sort(function (a, b) { return b.totalTimeMs - a.totalTimeMs; });
    return report;
}
/**
 * Get formatted profile report for logging
 */
function getFormattedProfileReport() {
    var e_3, _a;
    var report = getProfileReport();
    if (report.length === 0) {
        return 'No profiling data recorded.';
    }
    var lines = [];
    lines.push('=== Profiling Report ===');
    lines.push("Profiling Enabled: ".concat(profilingConfig.enabled));
    lines.push("Slow Threshold: ".concat(profilingConfig.slowThresholdMs, "ms"));
    lines.push('');
    lines.push('Top Operations (by total time):');
    lines.push("".concat('Operation'.padEnd(40), " ").concat('Calls'.padEnd(8), " ").concat('Total(ms)'.padEnd(12), " ").concat('Avg(ms)'.padEnd(12), " ").concat('Max(ms)'.padEnd(12), " ").concat('Errors'.padEnd(8)));
    lines.push('-'.repeat(100));
    try {
        // Show top 20 operations
        for (var _b = tslib_1.__values(report.slice(0, 20)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var op = _c.value;
            lines.push("".concat(op.name.substring(0, 40).padEnd(40), " ").concat(op.callCount.toString().padEnd(8), " ").concat(op.totalTimeMs.toFixed(2).padEnd(12), " ").concat(op.avgTimeMs.toFixed(2).padEnd(12), " ").concat(op.maxTimeMs.toFixed(2).padEnd(12), " ").concat(op.errors.toString().padEnd(8), " ").concat((op.errorRate * 100).toFixed(1).padEnd(8)));
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return lines.join('\n');
}
/**
 * Clear all profiling data
 */
function clearProfileData() {
    profileData.clear();
}
/**
 * Reset profiling (clear data and optionally update config)
 */
function resetProfiling(newConfig) {
    clearProfileData();
    if (newConfig) {
        setProfilingConfig(newConfig);
    }
}
/**
 * Wrap an RPC handler with profiling
 */
function wrapRpcWithProfiling(rpcName, handler) {
    return function (ctx, logger, nk, payload) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var profileBlock, result, error_1, data;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        profileBlock = createProfileBlock("rpc.".concat(rpcName));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, handler(ctx, logger, nk, payload)];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 3:
                        error_1 = _a.sent();
                        data = getOrCreateProfileData("rpc.".concat(rpcName));
                        data.errors++;
                        throw error_1;
                    case 4:
                        profileBlock.end();
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
}
/**
 * Register an RPC with profiling
 */
function registerRpcWithProfiling(initializer, rpcId, rpcName, handler) {
    var wrappedHandler = wrapRpcWithProfiling(rpcName, handler);
    initializer.registerRpc(rpcId, wrappedHandler);
}
// --- Integration with Existing Systems ---
/**
 * Initialize profiling module
 */
function initializeProfiling(_logger) {
    logger_1.logger.info("Profiling initialized - Enabled: ".concat(profilingConfig.enabled, ", Slow Threshold: ").concat(profilingConfig.slowThresholdMs, "ms"));
}
/**
 * Log profiling report (useful for debugging)
 */
function logProfileReport(_logger) {
    var report = getFormattedProfileReport();
    logger_1.logger.info(report);
}
// --- Decorator-style Profiling (for TypeScript) ---
/**
 * Method decorator for profiling class methods
 * Note: This requires experimental decorators in tsconfig
 *
 * Usage:
 *   class MyService {
 *     @profileMethod('my_method')
 *     async myMethod() { ... }
 *   }
 */
function profileMethod(name) {
    return function (target, propertyKey, descriptor) {
        var originalMethod = descriptor.value;
        descriptor.value = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return tslib_1.__awaiter(this, void 0, void 0, function () {
                var targetObj, fullName;
                var _this = this;
                var _a;
                return tslib_1.__generator(this, function (_b) {
                    targetObj = target;
                    fullName = "".concat(((_a = targetObj.constructor) === null || _a === void 0 ? void 0 : _a.name) || 'unknown', ".").concat(name);
                    return [2 /*return*/, profileAsync(fullName, function () { return originalMethod.apply(_this, args); })];
                });
            });
        };
        return descriptor;
    };
}
/**
 * Profile a critical code path
 * This is a simpler alternative to the decorator for manual profiling
 */
function profileCriticalPath(pathName) {
    var startTime = hrtimeMs();
    var ended = false;
    return {
        start: function () {
            if (!profilingConfig.enabled || ended)
                return;
            // Already started, get current time
        },
        end: function () {
            if (!profilingConfig.enabled || ended)
                return;
            ended = true;
            var duration = hrtimeMs() - startTime;
            recordProfileData("critical.".concat(pathName), duration, null);
        },
        getDuration: function () { return hrtimeMs() - startTime; },
    };
}
