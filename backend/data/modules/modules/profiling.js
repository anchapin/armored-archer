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
const logger_1 = require("../config/logger");
const defaultConfig = {
    enabled: process.env.PROFILING_ENABLED === 'true',
    slowThresholdMs: parseInt(process.env.PROFILING_SLOW_THRESHOLD_MS || '100', 10),
    logSlowOperations: process.env.PROFILING_LOG_SLOW !== 'false',
};
let profilingConfig = { ...defaultConfig };
const profileData = new Map();
// --- Profiling Utilities ---
/**
 * Get or create profile data for a given name
 */
function getOrCreateProfileData(name) {
    let data = profileData.get(name);
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
    const startTime = hrtimeMs();
    let result;
    let error = null;
    try {
        result = fn();
    }
    catch (e) {
        error = e;
        throw e;
    }
    finally {
        const duration = hrtimeMs() - startTime;
        recordProfileData(name, duration, error);
    }
    return result;
}
/**
 * Profile an async function
 */
async function profileAsync(name, fn) {
    if (!profilingConfig.enabled) {
        return fn();
    }
    const startTime = hrtimeMs();
    let result;
    let error = null;
    try {
        result = await fn();
    }
    catch (e) {
        error = e;
        throw e;
    }
    finally {
        const duration = hrtimeMs() - startTime;
        recordProfileData(name, duration, error);
    }
    return result;
}
/**
 * Profile a function (works with both sync and async)
 * Detects the type automatically
 */
async function profileFunction(name, fn) {
    if (!profilingConfig.enabled) {
        return fn();
    }
    // Check if function returns a promise
    const isAsync = fn.constructor.name === 'AsyncFunction';
    if (isAsync) {
        return profileAsync(name, fn);
    }
    else {
        return profileSync(name, fn);
    }
}
/**
 * Create a profile block that automatically records timing
 * when the returned function is called and completes
 */
function createProfileBlock(name) {
    const startTime = hrtimeMs();
    return {
        end: () => {
            if (profilingConfig.enabled) {
                const duration = hrtimeMs() - startTime;
                recordProfileData(name, duration, null);
            }
        },
        getDuration: () => hrtimeMs() - startTime,
    };
}
/**
 * High-resolution time in milliseconds
 */
function hrtimeMs() {
    const [seconds, nanoseconds] = process.hrtime();
    return seconds * 1000 + nanoseconds / 1e6;
}
/**
 * Record profiling data
 */
function recordProfileData(name, durationMs, error) {
    const data = getOrCreateProfileData(name);
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
        logger_1.logger.info(`Slow operation: ${name} took ${durationMs.toFixed(2)}ms (threshold: ${profilingConfig.slowThresholdMs}ms)`);
    }
}
// --- Profiling Configuration ---
/**
 * Update profiling configuration
 */
function setProfilingConfig(config) {
    profilingConfig = { ...profilingConfig, ...config };
}
/**
 * Get current profiling configuration
 */
function getProfilingConfig() {
    return { ...profilingConfig };
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
    const report = [];
    for (const [name, data] of profileData) {
        report.push({
            name,
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
    // Sort by total time descending
    report.sort((a, b) => b.totalTimeMs - a.totalTimeMs);
    return report;
}
/**
 * Get formatted profile report for logging
 */
function getFormattedProfileReport() {
    const report = getProfileReport();
    if (report.length === 0) {
        return 'No profiling data recorded.';
    }
    const lines = [];
    lines.push('=== Profiling Report ===');
    lines.push(`Profiling Enabled: ${profilingConfig.enabled}`);
    lines.push(`Slow Threshold: ${profilingConfig.slowThresholdMs}ms`);
    lines.push('');
    lines.push('Top Operations (by total time):');
    lines.push(`${'Operation'.padEnd(40)} ${'Calls'.padEnd(8)} ${'Total(ms)'.padEnd(12)} ${'Avg(ms)'.padEnd(12)} ${'Max(ms)'.padEnd(12)} ${'Errors'.padEnd(8)}`);
    lines.push('-'.repeat(100));
    // Show top 20 operations
    for (const op of report.slice(0, 20)) {
        lines.push(`${op.name.substring(0, 40).padEnd(40)} ${op.callCount.toString().padEnd(8)} ${op.totalTimeMs.toFixed(2).padEnd(12)} ${op.avgTimeMs.toFixed(2).padEnd(12)} ${op.maxTimeMs.toFixed(2).padEnd(12)} ${op.errors.toString().padEnd(8)} ${(op.errorRate * 100).toFixed(1).padEnd(8)}`);
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
    return async function (ctx, logger, nk, payload) {
        // Create profile block for the RPC
        const profileBlock = createProfileBlock(`rpc.${rpcName}`);
        try {
            const result = await handler(ctx, logger, nk, payload);
            return result;
        }
        catch (error) {
            // Record the error in profile data
            const data = getOrCreateProfileData(`rpc.${rpcName}`);
            data.errors++;
            throw error;
        }
        finally {
            profileBlock.end();
        }
    };
}
/**
 * Register an RPC with profiling
 */
function registerRpcWithProfiling(initializer, rpcId, rpcName, handler) {
    const wrappedHandler = wrapRpcWithProfiling(rpcName, handler);
    initializer.registerRpc(rpcId, wrappedHandler);
}
// --- Integration with Existing Systems ---
/**
 * Initialize profiling module
 */
function initializeProfiling(_logger) {
    logger_1.logger.info(`Profiling initialized - Enabled: ${profilingConfig.enabled}, Slow Threshold: ${profilingConfig.slowThresholdMs}ms`);
}
/**
 * Log profiling report (useful for debugging)
 */
function logProfileReport(_logger) {
    const report = getFormattedProfileReport();
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
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const targetObj = target;
            const fullName = `${targetObj.constructor?.name || 'unknown'}.${name}`;
            return profileAsync(fullName, () => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
/**
 * Profile a critical code path
 * This is a simpler alternative to the decorator for manual profiling
 */
function profileCriticalPath(pathName) {
    const startTime = hrtimeMs();
    let ended = false;
    return {
        start: () => {
            if (!profilingConfig.enabled || ended)
                return;
            // Already started, get current time
        },
        end: () => {
            if (!profilingConfig.enabled || ended)
                return;
            ended = true;
            const duration = hrtimeMs() - startTime;
            recordProfileData(`critical.${pathName}`, duration, null);
        },
        getDuration: () => hrtimeMs() - startTime,
    };
}
