/**
 * Shared cache utilities for consistent cache operations across the codebase.
 * This module extracts common patterns for cache management.
 */
/**
 * Cache operation types for logging
 */
export type CacheOperation = 'hit' | 'miss' | 'set' | 'delete' | 'clear' | 'destroy';
/**
 * Log cache operation for debugging and metrics
 */
export declare function logCacheOperation(_operation: CacheOperation, _cacheName: string, _key: string): void;
/**
 * Validate cache key format
 */
export declare function isValidCacheKey(key: string): boolean;
/**
 * Validate cache name format
 */
export declare function isValidCacheName(name: string): boolean;
/**
 * Sanitize cache key for logging (truncate if too long)
 */
export declare function sanitizeCacheKeyForLog(key: string, maxLength?: number): string;
/**
 * Standard cache key prefixes for different data types
 */
export declare const CACHE_KEYS: {
    readonly PLAYER_STATS: "player_stats";
    readonly LEADERBOARD: "leaderboard";
    readonly SEASON_INFO: "season_info";
    readonly STORE_CATALOG: "store_catalog";
    readonly GEAR_DEFINITIONS: "gear_definitions";
};
/**
 * Get cache key for player data
 */
export declare function getPlayerCacheKey(userId: string, type: string): string;
/**
 * Invalidate all cache entries for a user (multi-cache)
 * This is a helper function to invalidate related caches when user data changes
 */
export declare function getRelatedCacheKeys(userId: string): string[];
/**
 * Logger interface for cache operations
 */
export interface CacheLogger {
    error: (message: string, metadata?: Record<string, unknown>) => void;
    info?: (message: string, metadata?: Record<string, unknown>) => void;
    debug?: (message: string, metadata?: Record<string, unknown>) => void;
}
/**
 * Standard cache not found error message
 */
export declare const CACHE_ERROR_MESSAGES: {
    readonly NOT_FOUND: "Cache not found";
};
/**
 * Get a cache entry with consistent error handling and metrics logging.
 * This helper reduces duplication in cache get operations.
 *
 * @param cache - The cache Map
 * @param metrics - The metrics tracker
 * @param logger - Optional logger (can be null, undefined, or a logger)
 * @param cacheName - Name of the cache for logging
 * @param key - Cache key
 * @returns The cached value or undefined
 */
export declare function getCacheEntry<T>(cache: Map<string, T> | undefined, metrics: {
    hits: number;
    misses: number;
} | undefined, logger: CacheLogger | null | undefined, cacheName: string, key: string): T | undefined;
/**
 * Set a cache entry with consistent error handling.
 * This helper reduces duplication in cache set operations.
 *
 * @param cache - The cache Map
 * @param logger - Optional logger (can be null, undefined, or a logger)
 * @param cacheName - Name of the cache for logging
 * @param key - Cache key
 * @param value - Value to cache
 */
export declare function setCacheEntry(cache: Map<string, unknown> | undefined, logger: CacheLogger | null | undefined, cacheName: string, key: string, value: unknown): void;
/**
 * Delete a cache entry with consistent error handling.
 * This helper reduces duplication in cache delete operations.
 *
 * @param cache - The cache Map
 * @param logger - Optional logger (can be null, undefined, or a logger)
 * @param cacheName - Name of the cache for logging
 * @param key - Cache key to delete
 */
export declare function deleteCacheEntry(cache: Map<string, unknown> | undefined, logger: CacheLogger | null | undefined, cacheName: string, key: string): void;
