/**
 * Shared cache utilities for consistent cache operations across the codebase.
 * This module extracts common patterns for cache management.
 */

import { setCacheHitRatio } from '../modules/metrics';

/**
 * Cache operation types for logging
 */
export type CacheOperation = 'hit' | 'miss' | 'set' | 'delete' | 'clear' | 'destroy';

/**
 * Log cache operation for debugging and metrics
 */
export function logCacheOperation(
  _operation: CacheOperation,
  _cacheName: string,
  _key: string
): void {
  // This is a shared implementation - actual logging is done by CacheManager
  // which has access to the logger
}

/**
 * Validate cache key format
 */
export function isValidCacheKey(key: string): boolean {
  return typeof key === 'string' && key.length > 0 && key.length <= 256;
}

/**
 * Validate cache name format
 */
export function isValidCacheName(name: string): boolean {
  return typeof name === 'string' && name.length > 0 && name.length <= 64;
}

/**
 * Sanitize cache key for logging (truncate if too long)
 */
export function sanitizeCacheKeyForLog(key: string, maxLength: number = 100): string {
  if (key.length <= maxLength) {
    return key;
  }
  return key.substring(0, maxLength) + '...';
}

/**
 * Standard cache key prefixes for different data types
 */
export const CACHE_KEYS = {
  PLAYER_STATS: 'player_stats',
  LEADERBOARD: 'leaderboard',
  SEASON_INFO: 'season_info',
  STORE_CATALOG: 'store_catalog',
  GEAR_DEFINITIONS: 'gear_definitions',
} as const;

/**
 * Get cache key for player data
 */
export function getPlayerCacheKey(userId: string, type: string): string {
  return `${type}:${userId}`;
}

/**
 * Invalidate all cache entries for a user (multi-cache)
 * This is a helper function to invalidate related caches when user data changes
 */
export function getRelatedCacheKeys(userId: string): string[] {
  return [
    getPlayerCacheKey(userId, CACHE_KEYS.PLAYER_STATS),
    getPlayerCacheKey(userId, CACHE_KEYS.LEADERBOARD),
  ];
}

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
export const CACHE_ERROR_MESSAGES = {
  NOT_FOUND: 'Cache not found',
} as const;

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
export function getCacheEntry<T>(
  cache: Map<string, T> | undefined,
  metrics: { hits: number; misses: number } | undefined,
  logger: CacheLogger | null | undefined,
  cacheName: string,
  key: string
): T | undefined {
  if (!cache || !metrics) {
    if (logger) {
      logger.error(CACHE_ERROR_MESSAGES.NOT_FOUND, {
        cacheName,
        operation: 'cache_not_found',
      });
    }
    return undefined;
  }

  const value = cache.get(key);

  if (value !== undefined) {
    metrics.hits++;
    logCacheOperation('hit', cacheName, key);
  } else {
    metrics.misses++;
    logCacheOperation('miss', cacheName, key);
  }
  // Issue #1093: feed the cache_hit_ratio gauge so dashboards stop
  // reporting 0 for events that already happen. (setCacheHitRatio is a
  // gauge so each call replaces the prior value; no client aggregation
  // concern.)
  const total = metrics.hits + metrics.misses;
  if (total > 0) {
    setCacheHitRatio(cacheName, metrics.hits / total);
  }

  const total = metrics.hits + metrics.misses;
  if (total > 0) {
    setCacheHitRatio(cacheName, metrics.hits / total);
  }

  return value;
}

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
export function setCacheEntry(
  cache: Map<string, unknown> | undefined,
  logger: CacheLogger | null | undefined,
  cacheName: string,
  key: string,
  value: unknown
): void {
  if (!cache) {
    if (logger) {
      logger.error(CACHE_ERROR_MESSAGES.NOT_FOUND, {
        cacheName,
        operation: 'cache_not_found',
      });
    }
    return;
  }

  cache.set(key, value);
  logCacheOperation('set', cacheName, key);
}

/**
 * Delete a cache entry with consistent error handling.
 * This helper reduces duplication in cache delete operations.
 *
 * @param cache - The cache Map
 * @param logger - Optional logger (can be null, undefined, or a logger)
 * @param cacheName - Name of the cache for logging
 * @param key - Cache key to delete
 */
export function deleteCacheEntry(
  cache: Map<string, unknown> | undefined,
  logger: CacheLogger | null | undefined,
  cacheName: string,
  key: string
): void {
  if (!cache) {
    if (logger) {
      logger.error(CACHE_ERROR_MESSAGES.NOT_FOUND, {
        cacheName,
        operation: 'cache_not_found',
      });
    }
    return;
  }

  cache.delete(key);
  logCacheOperation('delete', cacheName, key);
}
