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
interface ProfilingConfig {
    enabled: boolean;
    slowThresholdMs: number;
    logSlowOperations: boolean;
}
interface ProfileData {
    callCount: number;
    totalTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    errors: number;
    lastCalled: number;
}
/**
 * Profile a synchronous function
 */
export declare function profileSync<T>(name: string, fn: () => T): T;
/**
 * Profile an async function
 */
export declare function profileAsync<T>(name: string, fn: () => Promise<T>): Promise<T>;
/**
 * Profile a function (works with both sync and async)
 * Detects the type automatically
 */
export declare function profileFunction<T>(name: string, fn: (() => T) | (() => Promise<T>)): Promise<T>;
/**
 * Create a profile block that automatically records timing
 * when the returned function is called and completes
 */
export declare function createProfileBlock(name: string): {
    end: () => void;
    getDuration: () => number;
};
/**
 * Update profiling configuration
 */
export declare function setProfilingConfig(config: Partial<ProfilingConfig>): void;
/**
 * Get current profiling configuration
 */
export declare function getProfilingConfig(): ProfilingConfig;
/**
 * Enable or disable profiling
 */
export declare function setProfilingEnabled(enabled: boolean): void;
/**
 * Check if profiling is enabled
 */
export declare function isProfilingEnabled(): boolean;
/**
 * Get profile data for a specific operation
 */
export declare function getProfileData(name: string): ProfileData | null;
/**
 * Get all profile data
 */
export declare function getAllProfileData(): Map<string, ProfileData>;
/**
 * Get profile report as array sorted by total time
 */
export declare function getProfileReport(): Array<{
    name: string;
    callCount: number;
    totalTimeMs: number;
    avgTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    errors: number;
    errorRate: number;
    lastCalled: number;
}>;
/**
 * Get formatted profile report for logging
 */
export declare function getFormattedProfileReport(): string;
/**
 * Clear all profiling data
 */
export declare function clearProfileData(): void;
/**
 * Reset profiling (clear data and optionally update config)
 */
export declare function resetProfiling(newConfig?: Partial<ProfilingConfig>): void;
/**
 * Type for RPC handlers
 */
export type RpcHandler = (ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string) => string | Promise<string>;
/**
 * Wrap an RPC handler with profiling
 */
export declare function wrapRpcWithProfiling(rpcName: string, handler: RpcHandler): RpcHandler;
/**
 * Register an RPC with profiling
 */
export declare function registerRpcWithProfiling(initializer: Runtime.Initializer, rpcId: string, rpcName: string, handler: RpcHandler): void;
/**
 * Initialize profiling module
 */
export declare function initializeProfiling(_logger?: Runtime.Logger): void;
/**
 * Log profiling report (useful for debugging)
 */
export declare function logProfileReport(_logger?: Runtime.Logger): void;
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
export declare function profileMethod(name: string): (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Profile a critical code path
 * This is a simpler alternative to the decorator for manual profiling
 */
export declare function profileCriticalPath(pathName: string): {
    start: () => void;
    end: () => void;
    getDuration: () => number;
};
export {};
