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

import { Runtime } from '../types/nakama';

// --- Profiling Configuration ---

interface ProfilingConfig {
  enabled: boolean;
  slowThresholdMs: number;
  logSlowOperations: boolean;
}

const defaultConfig: ProfilingConfig = {
  enabled: process.env.PROFILING_ENABLED === 'true',
  slowThresholdMs: parseInt(process.env.PROFILING_SLOW_THRESHOLD_MS || '100', 10),
  logSlowOperations: process.env.PROFILING_LOG_SLOW !== 'false',
};

let profilingConfig: ProfilingConfig = { ...defaultConfig };

// --- Profiling State ---

interface ProfileData {
  callCount: number;
  totalTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  errors: number;
  lastCalled: number;
}

const profileData: Map<string, ProfileData> = new Map();

// --- Profiling Utilities ---

/**
 * Get or create profile data for a given name
 */
function getOrCreateProfileData(name: string): ProfileData {
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
export function profileSync<T>(name: string, fn: () => T): T {
  if (!profilingConfig.enabled) {
    return fn();
  }

  const startTime = hrtimeMs();
  let result: T;
  let error: Error | null = null;

  try {
    result = fn();
  } catch (e) {
    error = e as Error;
    throw e;
  } finally {
    const duration = hrtimeMs() - startTime;
    recordProfileData(name, duration, error);
  }

  return result;
}

/**
 * Profile an async function
 */
export async function profileAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!profilingConfig.enabled) {
    return fn();
  }

  const startTime = hrtimeMs();
  let result: T;
  let error: Error | null = null;

  try {
    result = await fn();
  } catch (e) {
    error = e as Error;
    throw e;
  } finally {
    const duration = hrtimeMs() - startTime;
    recordProfileData(name, duration, error);
  }

  return result;
}

/**
 * Profile a function (works with both sync and async)
 * Detects the type automatically
 */
export function profileFunction<T>(
  name: string,
  fn: (() => T) | (() => Promise<T>)
): T | Promise<T> {
  if (!profilingConfig.enabled) {
    return fn();
  }

  // Check if function returns a promise
  const isAsync = fn.constructor.name === 'AsyncFunction';

  if (isAsync) {
    return profileAsync(name, fn as () => Promise<T>);
  } else {
    return profileSync(name, fn as () => T);
  }
}

/**
 * Create a profile block that automatically records timing
 * when the returned function is called and completes
 */
export function createProfileBlock(name: string): {
  end: () => void;
  getDuration: () => number;
} {
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
function hrtimeMs(): number {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + nanoseconds / 1e6;
}

/**
 * Record profiling data
 */
function recordProfileData(name: string, durationMs: number, error: Error | null): void {
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
    console.log(
      `[PROFILING] Slow operation: ${name} took ${durationMs.toFixed(2)}ms (threshold: ${profilingConfig.slowThresholdMs}ms)`
    );
  }
}

// --- Profiling Configuration ---

/**
 * Update profiling configuration
 */
export function setProfilingConfig(config: Partial<ProfilingConfig>): void {
  profilingConfig = { ...profilingConfig, ...config };
}

/**
 * Get current profiling configuration
 */
export function getProfilingConfig(): ProfilingConfig {
  return { ...profilingConfig };
}

/**
 * Enable or disable profiling
 */
export function setProfilingEnabled(enabled: boolean): void {
  profilingConfig.enabled = enabled;
}

/**
 * Check if profiling is enabled
 */
export function isProfilingEnabled(): boolean {
  return profilingConfig.enabled;
}

// --- Profile Data Retrieval ---

/**
 * Get profile data for a specific operation
 */
export function getProfileData(name: string): ProfileData | null {
  return profileData.get(name) || null;
}

/**
 * Get all profile data
 */
export function getAllProfileData(): Map<string, ProfileData> {
  return new Map(profileData);
}

/**
 * Get profile report as array sorted by total time
 */
export function getProfileReport(): Array<{
  name: string;
  callCount: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  errorRate: number;
  errors: number;
  lastCalled: number;
}> {
  const report: Array<{
    name: string;
    callCount: number;
    totalTimeMs: number;
    avgTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    errorRate: number;
    errors: number;
    lastCalled: number;
  }> = [];

  for (const [name, data] of profileData) {
    report.push({
      name,
      callCount: data.callCount,
      totalTimeMs: data.totalTimeMs,
      avgTimeMs: data.callCount > 0 ? data.totalTimeMs / data.callCount : 0,
      minTimeMs: data.minTimeMs === Number.MAX_SAFE_INTEGER ? 0 : data.minTimeMs,
      maxTimeMs: data.maxTimeMs,
      errorRate: data.callCount > 0 ? data.errors / data.callCount : 0,
      errors: data.errors,
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
export function getFormattedProfileReport(): string {
  const report = getProfileReport();

  if (report.length === 0) {
    return 'No profiling data recorded.';
  }

  const lines: string[] = [];
  lines.push('=== Profiling Report ===');
  lines.push(`Profiling Enabled: ${profilingConfig.enabled}`);
  lines.push(`Slow Threshold: ${profilingConfig.slowThresholdMs}ms`);
  lines.push('');
  lines.push('Top Operations (by total time):');
  lines.push(
    `${'Operation'.padEnd(40)} ${'Calls'.padEnd(8)} ${'Total(ms)'.padEnd(12)} ${'Avg(ms)'.padEnd(12)} ${'Max(ms)'.padEnd(12)} ${'Errors'.padEnd(8)}`
  );
  lines.push('-'.repeat(100));

  // Show top 20 operations
  for (const op of report.slice(0, 20)) {
    lines.push(
      `${op.name.substring(0, 40).padEnd(40)} ${op.callCount.toString().padEnd(8)} ${op.totalTimeMs.toFixed(2).padEnd(12)} ${op.avgTimeMs.toFixed(2).padEnd(12)} ${op.maxTimeMs.toFixed(2).padEnd(12)} ${op.errors.toString().padEnd(8)}`
    );
  }

  return lines.join('\n');
}

/**
 * Clear all profiling data
 */
export function clearProfileData(): void {
  profileData.clear();
}

/**
 * Reset profiling (clear data and optionally update config)
 */
export function resetProfiling(newConfig?: Partial<ProfilingConfig>): void {
  clearProfileData();
  if (newConfig) {
    setProfilingConfig(newConfig);
  }
}

// --- RPC Handler Registration ---

/**
 * Type for RPC handlers
 */
export type RpcHandler = (
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
) => string | Promise<string>;

/**
 * Wrap an RPC handler with profiling
 */
export function wrapRpcWithProfiling(rpcName: string, handler: RpcHandler): RpcHandler {
  return async function (
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
  ): Promise<string> {
    // Create profile block for the RPC
    const profileBlock = createProfileBlock(`rpc.${rpcName}`);

    try {
      const result = await handler(ctx, logger, nk, payload);
      return result;
    } catch (error) {
      // Record the error in profile data
      const data = getOrCreateProfileData(`rpc.${rpcName}`);
      data.errors++;
      throw error;
    } finally {
      profileBlock.end();
    }
  };
}

/**
 * Register an RPC with profiling
 */
export function registerRpcWithProfiling(
  initializer: Runtime.Initializer,
  rpcId: string,
  rpcName: string,
  handler: RpcHandler
): void {
  const wrappedHandler = wrapRpcWithProfiling(rpcName, handler);
  initializer.registerRpc(rpcId, wrappedHandler);
}

// --- Integration with Existing Systems ---

/**
 * Initialize profiling module
 */
export function initializeProfiling(logger?: Runtime.Logger): void {
  if (logger) {
    logger.info(
      `Profiling initialized - Enabled: ${profilingConfig.enabled}, Slow Threshold: ${profilingConfig.slowThresholdMs}ms`
    );
  } else {
    console.log(
      `[PROFILING] Initialized - Enabled: ${profilingConfig.enabled}, Slow Threshold: ${profilingConfig.slowThresholdMs}ms`
    );
  }
}

/**
 * Log profiling report (useful for debugging)
 */
export function logProfileReport(logger?: Runtime.Logger): void {
  const report = getFormattedProfileReport();

  if (logger) {
    logger.info(report);
  } else {
    console.log(report);
  }
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
export function profileMethod(name: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const targetName =
        (target as { constructor?: { name?: string } })?.constructor?.name || 'unknown';
      const fullName = `${targetName}.${name}`;
      return profileAsync(fullName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Profile a critical code path
 * This is a simpler alternative to the decorator for manual profiling
 */
export function profileCriticalPath(pathName: string): {
  start: () => void;
  end: () => void;
  getDuration: () => number;
} {
  const startTime = hrtimeMs();
  let ended = false;

  return {
    start: () => {
      if (!profilingConfig.enabled || ended) return;
      // Already started, get current time
    },
    end: () => {
      if (!profilingConfig.enabled || ended) return;
      ended = true;
      const duration = hrtimeMs() - startTime;
      recordProfileData(`critical.${pathName}`, duration, null);
    },
    getDuration: () => hrtimeMs() - startTime,
  };
}
